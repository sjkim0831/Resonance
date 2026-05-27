#!/usr/bin/env python3
"""Export Hermes session logs into retraining-ready JSONL datasets.

The raw Hermes session files remain the source of truth. This exporter creates
derived datasets with three lanes:
  - train.jsonl: useful request -> tool/action -> answer examples
  - tool-traces.jsonl: all tool-bearing turns for audit/RAG/replay
  - failures.jsonl: loops, interruptions, empty responses, and meta chatter
"""

from __future__ import annotations

import argparse
import collections
import hashlib
import json
import os
import pathlib
import re
from datetime import datetime, timezone
from typing import Any


SCHEMA = "2026-05-23.hermes-session-learning.v1"
DEFAULT_SESSION_DIR = "/home/sjkim/.hermes/sessions"
DEFAULT_OUTPUT_DIR = "/opt/Resonance/var/ai-runtime/hermes-learning"
DEFAULT_MAX_SESSIONS = 500

META_PATTERNS = [
    "the user is asking",
    "the user wants",
    "the user asked",
    "let me ",
    "i should ",
    "i need to ",
    "i will ",
    "from the code i've read",
    "looking at the code",
]

LOOP_HINTS = [
    "let me check",
    "let me read",
    "i need to check",
    "i'll optimize",
    "the fix should be",
]

TASK_HINTS = [
    "fix",
    "deploy",
    "build",
    "verify",
    "error",
    "search",
    "inspect",
    "수정",
    "고쳐",
    "고쳐줘",
    "확인",
    "분석",
    "배포",
    "빌드",
    "재배포",
    "검색",
    "오류",
    "문제",
    "느림",
    "딜레이",
    "학습",
    "기록",
    "재학습",
    "설명",
    "왜",
    "어떻게",
]

TRIVIAL_USER_TEXTS = {
    "하이",
    "안녕",
    "안녕하세요",
    "ㅎㅇ",
    "hi",
    "hello",
    "네",
    "ㅇ",
    "응",
    "오케이",
    "ok",
}

COMPACTION_MARKERS = [
    "[CONTEXT COMPACTION",
    "Earlier turns were compacted",
    "Preflight compression",
]


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def read_json(path: pathlib.Path) -> dict[str, Any] | None:
    try:
        value = json.loads(path.read_text(encoding="utf-8", errors="replace"))
    except Exception:
        return None
    if isinstance(value, dict):
        return value
    return None


def text_of(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    try:
        return json.dumps(value, ensure_ascii=False, sort_keys=True)
    except Exception:
        return str(value)


def clamp(text: str, limit: int) -> str:
    text = text_of(text).strip()
    if len(text) <= limit:
        return text
    return text[:limit] + "\n...[truncated]"


def stable_id(*parts: Any, length: int = 20) -> str:
    raw = "\n".join(text_of(part) for part in parts)
    return hashlib.sha1(raw.encode("utf-8", errors="replace")).hexdigest()[:length]


def has_compaction_marker(content: str) -> bool:
    return any(marker in content for marker in COMPACTION_MARKERS)


def is_meta_chatter(content: str) -> bool:
    low = content.strip().lower()
    if not low:
        return False
    hits = sum(1 for pattern in META_PATTERNS if pattern in low)
    if hits >= 2:
        return True
    if low.startswith(("the user ", "let me ", "i need ", "i should ")):
        return True
    return False


def is_probably_korean(text: str) -> bool:
    return bool(re.search(r"[\uac00-\ud7a3]", text))


def is_trivial_user_text(text: str) -> bool:
    normalized = re.sub(r"\s+", " ", text.strip().lower())
    return normalized in TRIVIAL_USER_TEXTS or len(normalized) <= 2


def looks_task_or_knowledge_request(text: str) -> bool:
    low = text.lower()
    if "?" in text or "？" in text:
        return True
    return any(hint in low for hint in TASK_HINTS)


def normalize_tool_call(call: Any) -> dict[str, Any]:
    if not isinstance(call, dict):
        return {"name": "unknown", "arguments": {}, "raw": text_of(call)[:1000]}
    fn = call.get("function") or {}
    if not isinstance(fn, dict):
        fn = {}
    name = call.get("name") or fn.get("name") or "unknown"
    args = call.get("arguments", fn.get("arguments", {}))
    if isinstance(args, str):
        try:
            args = json.loads(args)
        except Exception:
            args = {"raw": args}
    if not isinstance(args, dict):
        args = {"value": args}
    return {
        "id": call.get("id") or call.get("call_id") or call.get("tool_call_id") or "",
        "name": str(name),
        "arguments": args,
    }


def tool_signature(call: dict[str, Any]) -> str:
    return json.dumps(
        {
            "name": call.get("name"),
            "arguments": call.get("arguments") or {},
        },
        ensure_ascii=False,
        sort_keys=True,
    )


def parse_tool_result(message: dict[str, Any]) -> dict[str, Any]:
    content = message.get("content")
    parsed: Any = None
    if isinstance(content, str):
        try:
            parsed = json.loads(content)
        except Exception:
            parsed = None
    return {
        "tool_call_id": message.get("tool_call_id") or "",
        "name": message.get("name") or "tool",
        "content": clamp(text_of(content), 8000),
        "parsed": parsed if isinstance(parsed, dict) else None,
    }


def split_turns(messages: list[dict[str, Any]]) -> list[dict[str, Any]]:
    turns: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None
    for idx, message in enumerate(messages):
        if not isinstance(message, dict):
            continue
        role = message.get("role")
        if role == "user":
            if current:
                turns.append(current)
            current = {
                "user_index": idx,
                "user": message,
                "after": [],
            }
        elif current is not None:
            current["after"].append((idx, message))
    if current:
        turns.append(current)
    return turns


def classify_turn(user_text: str, assistant_texts: list[str], tool_calls: list[dict[str, Any]], tool_results: list[dict[str, Any]]) -> tuple[str, list[str], float]:
    reasons: list[str] = []
    joined_assistant = "\n".join(assistant_texts)
    low = joined_assistant.lower()
    if has_compaction_marker(joined_assistant):
        reasons.append("compaction-summary-in-content")
    if any(is_meta_chatter(text) for text in assistant_texts):
        reasons.append("meta-analysis-leak")
    if not tool_calls and any(hint in low for hint in LOOP_HINTS):
        reasons.append("analysis-only-no-tool")
    counter = collections.Counter(tool_signature(call) for call in tool_calls)
    if any(count >= 3 for count in counter.values()):
        reasons.append("repeated-identical-tool-call")
    if not assistant_texts and not tool_calls and not tool_results:
        reasons.append("empty-turn")
    if not tool_calls and is_trivial_user_text(user_text):
        reasons.append("smalltalk-not-training-data")
    if "api connectionerror" in low or "remoteprotocolerror" in low:
        reasons.append("model-connection-error")
    if "interrupted" in low or "keyboardinterrupt" in low:
        reasons.append("interrupted")

    if any(reason in reasons for reason in ["repeated-identical-tool-call", "analysis-only-no-tool", "compaction-summary-in-content"]):
        return "failure", reasons, -1.0
    if "model-connection-error" in reasons or "interrupted" in reasons:
        return "failure", reasons, -0.5
    if tool_calls:
        if any(name in {call.get("name") for call in tool_calls} for name in ["patch", "terminal", "read_file", "search_files", "browser_navigate"]):
            return "train", reasons, 1.0 if not reasons else 0.6
        return "trace", reasons, 0.5
    if assistant_texts and not reasons and looks_task_or_knowledge_request(user_text):
        reward = 0.4 if is_probably_korean(user_text + joined_assistant) else 0.3
        return "train", reasons, reward
    return "failure", reasons or ["low-signal-turn"], -0.2


def build_turn_records(path: pathlib.Path, data: dict[str, Any]) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    session_id = data.get("session_id") or path.stem.replace("session_", "")
    model = data.get("model") or ""
    base_url = data.get("base_url") or ""
    session_start = data.get("session_start") or ""
    last_updated = data.get("last_updated") or ""
    messages = data.get("messages") or []
    if not isinstance(messages, list):
        return [], [], []

    train: list[dict[str, Any]] = []
    traces: list[dict[str, Any]] = []
    failures: list[dict[str, Any]] = []

    for turn_no, turn in enumerate(split_turns(messages)):
        user_msg = turn["user"]
        user_text = text_of(user_msg.get("content")).strip()
        if not user_text or has_compaction_marker(user_text):
            continue

        assistant_texts: list[str] = []
        tool_calls: list[dict[str, Any]] = []
        tool_results: list[dict[str, Any]] = []
        assistant_messages: list[dict[str, Any]] = []
        for idx, message in turn["after"]:
            role = message.get("role")
            if role == "assistant":
                assistant_messages.append(message)
                content = text_of(message.get("content")).strip()
                if content:
                    assistant_texts.append(clamp(content, 12000))
                for call in message.get("tool_calls") or []:
                    tool_calls.append(normalize_tool_call(call))
            elif role == "tool":
                tool_results.append(parse_tool_result(message))

        lane, reasons, reward = classify_turn(user_text, assistant_texts, tool_calls, tool_results)
        final_answer = ""
        for text in reversed(assistant_texts):
            if text and not has_compaction_marker(text):
                final_answer = text
                break

        record_id = stable_id(session_id, turn_no, user_text, [tool_signature(call) for call in tool_calls])
        base = {
            "schema": SCHEMA,
            "id": record_id,
            "source": "hermes-session",
            "sessionId": session_id,
            "sessionPath": str(path),
            "turnIndex": turn_no,
            "model": model,
            "baseUrl": base_url,
            "sessionStart": session_start,
            "lastUpdated": last_updated,
            "exportedAt": now_iso(),
            "qualityLane": lane,
            "qualityReasons": reasons,
            "reward": reward,
            "user": clamp(user_text, 12000),
            "toolCalls": tool_calls,
            "toolResults": tool_results,
            "assistantText": clamp(final_answer, 16000),
        }

        training_messages = [
            {
                "role": "system",
                "content": (
                    "You are Hermes Agent for the Resonance/Carbonet framework. "
                    "When the user asks to inspect, fix, deploy, or verify, use tools first, "
                    "avoid meta-analysis chatter, preserve evidence, and close with concise Korean status."
                ),
            },
            {"role": "user", "content": user_text},
        ]
        if tool_calls:
            training_messages.append(
                {
                    "role": "assistant",
                    "content": "",
                    "tool_calls": [
                        {
                            "type": "function",
                            "function": {
                                "name": call.get("name") or "unknown",
                                "arguments": json.dumps(call.get("arguments") or {}, ensure_ascii=False),
                            },
                        }
                        for call in tool_calls[:12]
                    ],
                }
            )
            for result in tool_results[:12]:
                training_messages.append(
                    {
                        "role": "tool",
                        "name": result.get("name") or "tool",
                        "content": result.get("content") or "",
                    }
                )
        if final_answer:
            training_messages.append({"role": "assistant", "content": final_answer})
        base["messages"] = training_messages

        if tool_calls or tool_results:
            traces.append(base)
        if lane == "train":
            train.append(base)
        else:
            failures.append(base)

    return train, traces, failures


def write_jsonl(path: pathlib.Path, records: list[dict[str, Any]]) -> None:
    tmp = path.with_suffix(path.suffix + ".tmp")
    with tmp.open("w", encoding="utf-8") as handle:
        for record in records:
            handle.write(json.dumps(record, ensure_ascii=False, sort_keys=True) + "\n")
    tmp.replace(path)


def infer_development_patterns(records: list[dict[str, Any]], failures: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Build compact reusable development/ops pattern records from sessions."""
    patterns: dict[str, dict[str, Any]] = {}

    def add_pattern(key: str, title: str, record: dict[str, Any], evidence: str, tags: list[str]) -> None:
        item = patterns.setdefault(
            key,
            {
                "schema": "2026-05-23.hermes-development-pattern.v1",
                "patternKey": key,
                "title": title,
                "tags": sorted(set(tags)),
                "count": 0,
                "rewardTotal": 0.0,
                "examples": [],
                "updatedAt": now_iso(),
            },
        )
        item["count"] += 1
        item["rewardTotal"] += float(record.get("reward") or 0)
        item["tags"] = sorted(set(item["tags"]) | set(tags))
        if len(item["examples"]) < 12:
            item["examples"].append(
                {
                    "sessionId": record.get("sessionId"),
                    "turnIndex": record.get("turnIndex"),
                    "user": clamp(record.get("user") or "", 500),
                    "evidence": clamp(evidence, 1200),
                    "source": record.get("sessionPath"),
                }
            )

    for record in records:
        user = text_of(record.get("user")).lower()
        calls = record.get("toolCalls") or []
        call_names = {call.get("name") for call in calls if isinstance(call, dict)}
        result_text = "\n".join(text_of(result.get("content")) for result in record.get("toolResults") or [])
        evidence = result_text or text_of(record.get("assistantText"))
        if {"read_file", "search_files"} & call_names:
            add_pattern(
                "inspect-before-edit",
                "수정 전 파일/패턴을 먼저 탐색한다",
                record,
                evidence,
                ["development", "inspection", "tool-use"],
            )
        if "patch" in call_names:
            add_pattern(
                "patch-then-build",
                "패치 후 빌드/검증으로 완료 판정한다",
                record,
                evidence,
                ["development", "patch", "verification"],
            )
        if "terminal" in call_names and re.search(r"npm run build|mvn|gradle|kubectl rollout|actuator/health", evidence, re.I):
            add_pattern(
                "build-deploy-verify",
                "빌드/롤아웃/헬스체크를 한 묶음으로 검증한다",
                record,
                evidence,
                ["deployment", "ops", "verification"],
            )
        if "ecoinvent" in user or "자동완성" in user or "autocomplete" in user:
            add_pattern(
                "frontend-autocomplete-local-index",
                "자동완성은 페이지 진입 시 목록을 준비하고 입력 시 로컬 인덱스에서 즉시 필터링한다",
                record,
                evidence,
                ["frontend", "performance", "autocomplete"],
            )

    for record in failures:
        reasons = set(record.get("qualityReasons") or [])
        if "repeated-identical-tool-call" in reasons:
            add_pattern(
                "avoid-repeated-identical-tool-call",
                "같은 tool call 반복 대신 offset/query/path를 바꾸거나 현재 증거로 진행한다",
                record,
                text_of(record.get("assistantText")),
                ["agent", "tool-use", "regression-guard"],
            )
        if "analysis-only-no-tool" in reasons or "meta-analysis-leak" in reasons:
            add_pattern(
                "block-analysis-only-execution-request",
                "실행형 요청에서는 설명만 하지 않고 즉시 도구를 호출한다",
                record,
                text_of(record.get("assistantText")),
                ["agent", "execution-discipline", "regression-guard"],
            )

    out = []
    for item in patterns.values():
        count = max(int(item.get("count") or 1), 1)
        item["averageReward"] = round(float(item.pop("rewardTotal", 0.0)) / count, 3)
        out.append(item)
    out.sort(key=lambda row: (-int(row.get("count") or 0), row.get("patternKey") or ""))
    return out


def session_fingerprint(paths: list[pathlib.Path]) -> str:
    h = hashlib.sha1()
    for path in paths:
        try:
            st = path.stat()
        except OSError:
            continue
        h.update(str(path).encode())
        h.update(str(int(st.st_mtime_ns)).encode())
        h.update(str(st.st_size).encode())
    return h.hexdigest()


def export_sessions(session_dir: pathlib.Path, output_dir: pathlib.Path, max_sessions: int, force: bool = False) -> dict[str, Any]:
    output_dir.mkdir(parents=True, exist_ok=True)
    state_path = output_dir / "export-state.json"
    paths = sorted(session_dir.glob("session_*.json"), key=lambda p: p.stat().st_mtime, reverse=True)[:max_sessions]
    fingerprint = session_fingerprint(paths)
    if not force and state_path.exists():
        old = read_json(state_path) or {}
        if old.get("fingerprint") == fingerprint:
            summary = read_json(output_dir / "summary.json")
            if summary:
                summary["skipped"] = True
                return summary

    train: list[dict[str, Any]] = []
    traces: list[dict[str, Any]] = []
    failures: list[dict[str, Any]] = []
    unreadable = 0
    for path in paths:
        data = read_json(path)
        if not data:
            unreadable += 1
            continue
        a, b, c = build_turn_records(path, data)
        train.extend(a)
        traces.extend(b)
        failures.extend(c)

    write_jsonl(output_dir / "train.jsonl", train)
    write_jsonl(output_dir / "tool-traces.jsonl", traces)
    write_jsonl(output_dir / "failures.jsonl", failures)
    development_patterns = infer_development_patterns(train + traces, failures)
    write_jsonl(output_dir / "development-patterns.jsonl", development_patterns)

    reason_counts: collections.Counter[str] = collections.Counter()
    for record in failures:
        for reason in record.get("qualityReasons") or []:
            reason_counts[reason] += 1

    summary = {
        "schema": SCHEMA,
        "generatedAt": now_iso(),
        "sessionDir": str(session_dir),
        "outputDir": str(output_dir),
        "sessionsScanned": len(paths),
        "unreadableSessions": unreadable,
        "trainRecords": len(train),
        "toolTraceRecords": len(traces),
        "failureRecords": len(failures),
        "developmentPatternRecords": len(development_patterns),
        "failureReasons": dict(sorted(reason_counts.items())),
        "files": {
            "train": str(output_dir / "train.jsonl"),
            "toolTraces": str(output_dir / "tool-traces.jsonl"),
            "failures": str(output_dir / "failures.jsonl"),
            "developmentPatterns": str(output_dir / "development-patterns.jsonl"),
            "summary": str(output_dir / "summary.json"),
        },
        "skipped": False,
    }
    (output_dir / "summary.json").write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
    state_path.write_text(json.dumps({"fingerprint": fingerprint, "updatedAt": now_iso()}, ensure_ascii=False, indent=2), encoding="utf-8")
    return summary


def main() -> int:
    parser = argparse.ArgumentParser(description="Export Hermes sessions to learning JSONL")
    parser.add_argument("command", nargs="?", default="export", choices=["export", "summary"])
    parser.add_argument("--session-dir", default=os.environ.get("HERMES_SESSION_DIR", DEFAULT_SESSION_DIR))
    parser.add_argument("--output-dir", default=os.environ.get("HERMES_LEARNING_DIR", DEFAULT_OUTPUT_DIR))
    parser.add_argument("--max-sessions", type=int, default=int(os.environ.get("HERMES_LEARNING_MAX_SESSIONS", DEFAULT_MAX_SESSIONS)))
    parser.add_argument("--force", action="store_true")
    args = parser.parse_args()

    session_dir = pathlib.Path(args.session_dir)
    output_dir = pathlib.Path(args.output_dir)
    if args.command == "summary":
        summary = read_json(output_dir / "summary.json") or {}
    else:
        summary = export_sessions(session_dir, output_dir, args.max_sessions, force=args.force)
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
