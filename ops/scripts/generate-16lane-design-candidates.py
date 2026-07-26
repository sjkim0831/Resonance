#!/usr/bin/env python3
"""Generate bounded Korean design candidates with one sequential queue per NVIDIA key.

The result is review input only. It cannot mutate source, DB, or deployment state.
E4B must select a registered candidate and the deterministic generator applies it.
"""
from __future__ import annotations

import argparse
import concurrent.futures
import json
import os
import stat
import time
import urllib.request
from pathlib import Path
from typing import Any, Callable

ENDPOINT = "https://integrate.api.nvidia.com/v1/chat/completions"
MODEL = "minimaxai/minimax-m3"


def load_keys(path: Path, lanes: int) -> list[str]:
    if not path.is_file():
        raise SystemExit(f"missing secure key file: {path}")
    if stat.S_IMODE(path.stat().st_mode) & 0o077:
        raise SystemExit("secure key file must be mode 0600")
    keys = list(dict.fromkeys(x.strip() for x in path.read_text().splitlines() if x.strip()))
    if len(keys) < lanes or any(not x.startswith("nvapi-") for x in keys):
        raise SystemExit(f"at least {lanes} distinct NVIDIA keys are required")
    return keys[:lanes]


def call(key: str, task: dict[str, Any], timeout: int = 90) -> dict[str, Any]:
    system = (
        "Carbonet CCUS 전문 설계 후보 생성기다. 제공된 액터, 프로세스, 단계, 데이터 계약과 "
        "등록 자산 ID만 사용한다. 사용자 문구와 필드 라벨은 정확한 한국어로 작성한다. "
        "모바일은 4열 단일 흐름, 태블릿 8열, 데스크톱 12열 CSS Grid/Flex 계약을 포함한다. "
        "새 API, 테이블, 권한, 자산 ID를 발명하지 않는다. JSON 객체만 반환한다."
    )
    payload = json.dumps({
        "model": MODEL, "temperature": 0.1, "max_tokens": 4096,
        "messages": [{"role": "system", "content": system},
                     {"role": "user", "content": json.dumps(task, ensure_ascii=False)}],
    }).encode()
    request = urllib.request.Request(
        ENDPOINT, data=payload, method="POST",
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        content = json.loads(response.read()).get("choices", [{}])[0].get("message", {}).get("content", "")
    start, end = content.find("{"), content.rfind("}")
    if start < 0 or end < start:
        raise ValueError("model returned no JSON object")
    candidate = json.loads(content[start:end + 1])
    return {"taskId": task["taskId"], "status": "CANDIDATE", "candidate": candidate}


def run(tasks: list[dict[str, Any]], keys: list[str],
        caller: Callable[[str, dict[str, Any]], dict[str, Any]] = call) -> list[dict[str, Any]]:
    lanes = [[] for _ in keys]
    for index, task in enumerate(tasks):
        if not task.get("taskId"):
            raise ValueError("every task requires taskId")
        lanes[index % len(keys)].append((index, task))

    def worker(lane: int) -> list[tuple[int, dict[str, Any]]]:
        result = []
        for index, task in lanes[lane]:
            error = ""
            for attempt in range(3):
                try:
                    result.append((index, caller(keys[lane], task)))
                    break
                except Exception as exc:
                    error = type(exc).__name__
                    time.sleep(min(2 ** attempt, 4))
            else:
                result.append((index, {"taskId": task["taskId"], "status": "FAILED", "errorType": error}))
        return result

    rows: list[tuple[int, dict[str, Any]]] = []
    with concurrent.futures.ThreadPoolExecutor(max_workers=len(keys)) as pool:
        for lane_rows in pool.map(worker, range(len(keys))):
            rows.extend(lane_rows)
    return [row for _, row in sorted(rows)]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("tasks", nargs="?", type=Path)
    parser.add_argument("--out", type=Path)
    parser.add_argument("--keys", type=Path, default=Path("/etc/resonance/secrets/nvidia-api-keys"))
    parser.add_argument("--lanes", type=int, default=16)
    parser.add_argument("--self-test", action="store_true")
    args = parser.parse_args()
    if not 1 <= args.lanes <= 16:
        raise SystemExit("lanes must be between 1 and 16")
    if args.self_test:
        tasks = [{"taskId": f"T{i:04d}"} for i in range(1000)]
        fake = lambda _key, task: {"taskId": task["taskId"], "status": "CANDIDATE", "candidate": {}}
        rows = run(tasks, [f"nvapi-test-{i}" for i in range(args.lanes)], fake)
        print(json.dumps({"success": len(rows) == 1000 and all(x["status"] == "CANDIDATE" for x in rows),
                          "tasks": len(rows), "lanes": args.lanes}))
        return
    if not args.tasks or not args.out:
        raise SystemExit("tasks and --out are required")
    tasks = json.loads(args.tasks.read_text())
    if not isinstance(tasks, list) or len(tasks) > 1000:
        raise SystemExit("tasks must be an array with at most 1000 entries")
    rows = run(tasks, load_keys(args.keys, args.lanes))
    failed = sum(x["status"] == "FAILED" for x in rows)
    result = {"schemaVersion": "1.0.0", "model": MODEL, "lanes": args.lanes,
              "candidateCount": len(rows) - failed, "failedCount": failed, "candidates": rows}
    temporary = args.out.with_suffix(args.out.suffix + ".tmp")
    temporary.parent.mkdir(parents=True, exist_ok=True)
    temporary.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    os.replace(temporary, args.out)
    print(json.dumps({k: result[k] for k in ("lanes", "candidateCount", "failedCount")}))


if __name__ == "__main__":
    main()
