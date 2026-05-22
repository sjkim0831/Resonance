#!/usr/bin/env python3
from __future__ import annotations
import html
import json
import os
import subprocess
import threading
import time
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

ROOT = Path(os.environ.get("RESONANCE_ROOT", "/opt/Resonance"))
HOST = os.environ.get("QWEN40_BOT_HOST", "0.0.0.0")
PORT = int(os.environ.get("QWEN40_BOT_PORT", "17892"))
TOKEN = os.environ.get("QWEN40_BOT_TOKEN", "qwer1234")
INTERVAL_SECONDS = int(os.environ.get("QWEN40_BOT_INTERVAL_SECONDS", "900"))
SCRIPT = Path(os.environ.get("QWEN40_BOT_SCRIPT", str(ROOT / "ops/scripts/resonance-qwen40-improvement-loop.sh")))
OUT_DIR = Path(os.environ.get("QWEN40_BOT_OUT_DIR", str(ROOT / "var/ai-runtime")))
RUN_DIR = Path(os.environ.get("QWEN40_BOT_RUN_DIR", str(ROOT / "var/run")))
EVENT_LOG = OUT_DIR / "qwen40-improvement-bot-events.jsonl"
SUGGESTION_LOG = OUT_DIR / "qwen40-improvement-suggestions.jsonl"
LATEST_MD = OUT_DIR / "qwen40-improvement-suggestions-latest.md"
DISABLE_FILE = RUN_DIR / "resonance-qwen40-improvement-loop.disabled"
BOT_DISABLE_FILE = RUN_DIR / "resonance-qwen40-improvement-bot.disabled"
LOG_TAIL_BYTES = int(os.environ.get("QWEN40_BOT_LOG_TAIL_BYTES", "8000"))
RUN_TIMEOUT = int(os.environ.get("QWEN40_BOT_RUN_TIMEOUT_SECONDS", "540"))
MAX_LOAD_1M = float(os.environ.get("QWEN40_BOT_MAX_LOAD_1M", "4.0"))
MAX_ACTIVE_HERMES = int(os.environ.get("QWEN40_BOT_MAX_ACTIVE_HERMES", "0"))

OUT_DIR.mkdir(parents=True, exist_ok=True)
RUN_DIR.mkdir(parents=True, exist_ok=True)

state_lock = threading.Lock()
run_lock = threading.Lock()
state = {
    "active": False,
    "startedAt": None,
    "finishedAt": None,
    "lastExitCode": None,
    "lastMessage": "booting",
    "lastRunReason": None,
    "nextRunAt": None,
    "runCount": 0,
}
stop_event = threading.Event()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def append_event(status: str, code: str, message: str, extra: dict | None = None) -> None:
    event = {
        "ts": now_iso(),
        "script": "qwen40-improvement-bot",
        "status": status,
        "code": code,
        "message": message,
        "port": PORT,
    }
    if extra:
        event.update(extra)
    with EVENT_LOG.open("a", encoding="utf-8") as handle:
        handle.write(json.dumps(event, ensure_ascii=False) + "\n")


def tail(path: Path, max_bytes: int = LOG_TAIL_BYTES) -> str:
    try:
        data = path.read_bytes()
        return data[-max_bytes:].decode("utf-8", errors="replace")
    except FileNotFoundError:
        return ""
    except Exception as exc:
        return f"{type(exc).__name__}: {exc}"


def latest_jsonl(path: Path, count: int = 20) -> list[dict]:
    rows: list[dict] = []
    text = tail(path, max_bytes=max(LOG_TAIL_BYTES, 64000))
    for line in text.splitlines()[-count:]:
        try:
            rows.append(json.loads(line))
        except Exception:
            rows.append({"raw": line})
    return rows


def shell(cmd: list[str], timeout: int = 10) -> str:
    try:
        return subprocess.check_output(cmd, text=True, stderr=subprocess.STDOUT, timeout=timeout)
    except subprocess.CalledProcessError as exc:
        return exc.output
    except Exception as exc:
        return str(exc)


def disabled() -> bool:
    return DISABLE_FILE.exists() or BOT_DISABLE_FILE.exists()


def load_average_1m() -> float:
    try:
        return os.getloadavg()[0]
    except Exception:
        return 0.0


def active_interactive_hermes_count() -> int:
    output = shell(["bash", "-lc", "ps -eo args= | grep -F '/opt/util/ai/hermes-agent-v20260516/venv/bin/hermes' | grep -v grep | wc -l"], timeout=5)
    try:
        return int(output.strip() or "0")
    except ValueError:
        return 0


def guard_reason() -> str:
    load_1m = load_average_1m()
    if MAX_LOAD_1M > 0 and load_1m >= MAX_LOAD_1M:
        return f"load average {load_1m:.2f} >= limit {MAX_LOAD_1M:.2f}"
    active_hermes = active_interactive_hermes_count()
    if MAX_ACTIVE_HERMES >= 0 and active_hermes > MAX_ACTIVE_HERMES:
        return f"active interactive Hermes sessions {active_hermes} > limit {MAX_ACTIVE_HERMES}"
    return ""


def run_once(reason: str) -> bool:
    if disabled():
        append_event("SKIP", "DISABLED", "bot or Qwen40 loop disabled", {"reason": reason})
        return False
    guard = guard_reason()
    if guard:
        append_event("SKIP", "LOAD_GUARD", guard, {"reason": reason})
        with state_lock:
            state.update({"lastExitCode": 0, "lastMessage": f"skipped: {guard}", "lastRunReason": reason})
        return False
    if not SCRIPT.exists():
        append_event("FAIL", "SCRIPT_MISSING", str(SCRIPT), {"reason": reason})
        return False
    if not run_lock.acquire(blocking=False):
        append_event("SKIP", "ALREADY_RUNNING", "previous Qwen40 improvement run still active", {"reason": reason})
        return False
    def worker() -> None:
        started = now_iso()
        with state_lock:
            state.update({"active": True, "startedAt": started, "lastRunReason": reason, "lastMessage": "running"})
        append_event("START", "RUN_STARTED", "Qwen40 improvement run started", {"reason": reason})
        code = 0
        message = "completed"
        try:
            proc = subprocess.run(["bash", str(SCRIPT)], cwd=str(ROOT), text=True, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=RUN_TIMEOUT)
            code = proc.returncode
            if code != 0:
                message = proc.stdout[-2000:] if proc.stdout else f"exit {code}"
        except subprocess.TimeoutExpired as exc:
            code = 124
            message = f"timeout after {RUN_TIMEOUT}s: {(exc.stdout or '')[-1200:] if isinstance(exc.stdout, str) else ''}"
        except Exception as exc:
            code = 1
            message = f"{type(exc).__name__}: {exc}"
        finally:
            finished = now_iso()
            with state_lock:
                state.update({
                    "active": False,
                    "finishedAt": finished,
                    "lastExitCode": code,
                    "lastMessage": message,
                    "runCount": int(state.get("runCount") or 0) + 1,
                })
            append_event("OK" if code == 0 else "FAIL", "RUN_FINISHED" if code == 0 else "RUN_FAILED", message, {"reason": reason, "exitCode": code})
            run_lock.release()
    threading.Thread(target=worker, daemon=True).start()
    return True


def scheduler() -> None:
    append_event("OK", "BOT_STARTED", "Qwen40 improvement bot started", {"intervalSeconds": INTERVAL_SECONDS})
    time.sleep(3)
    run_once("startup")
    while not stop_event.is_set():
        next_run = time.time() + INTERVAL_SECONDS
        with state_lock:
            state["nextRunAt"] = datetime.fromtimestamp(next_run, timezone.utc).isoformat()
        while time.time() < next_run and not stop_event.is_set():
            time.sleep(min(5, max(1, next_run - time.time())))
        if stop_event.is_set():
            break
        run_once("interval")


class Handler(BaseHTTPRequestHandler):
    server_version = "Qwen40ImprovementBot/1.0"
    def authorized(self) -> bool:
        if not TOKEN:
            return True
        parsed = urlparse(self.path)
        query = parse_qs(parsed.query)
        return query.get("token", [""])[0] == TOKEN or self.headers.get("X-Resonance-Token") == TOKEN

    def send_body(self, body: str | bytes, content_type: str = "text/html; charset=utf-8", status: int = 200) -> None:
        if isinstance(body, str):
            body = body.encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def json_payload(self) -> dict:
        with state_lock:
            snapshot = dict(state)
        return {
            "ts": now_iso(),
            "host": HOST,
            "port": PORT,
            "intervalSeconds": INTERVAL_SECONDS,
            "disabled": disabled(),
            "loadAverage1m": load_average_1m(),
            "maxLoadAverage1m": MAX_LOAD_1M,
            "activeInteractiveHermesSessions": active_interactive_hermes_count(),
            "maxActiveInteractiveHermesSessions": MAX_ACTIVE_HERMES,
            "guardReason": guard_reason(),
            "state": snapshot,
            "qwenHealth": shell(["/usr/local/bin/qwen40-ask", "health"], timeout=15).strip(),
            "service": shell(["bash", "-lc", "systemctl is-active resonance-qwen40-improvement-bot.service 2>/dev/null || true"], timeout=5).strip(),
            "latestSuggestionsPath": str(LATEST_MD),
            "eventLog": str(EVENT_LOG),
            "suggestionLog": str(SUGGESTION_LOG),
            "latestEvents": latest_jsonl(EVENT_LOG, 12),
            "latestSuggestionEvents": latest_jsonl(SUGGESTION_LOG, 8),
        }

    def page(self) -> str:
        data = self.json_payload()
        latest_md = tail(LATEST_MD, max_bytes=24000)
        latest_events = "\n".join(json.dumps(row, ensure_ascii=False) for row in data["latestEvents"])
        suggestions = "\n".join(json.dumps(row, ensure_ascii=False) for row in data["latestSuggestionEvents"])
        disabled_label = "DISABLED" if data["disabled"] else "RUNNING"
        return f"""<!doctype html><html lang='ko'><head><meta charset='utf-8'><meta name='viewport' content='width=device-width,initial-scale=1'><title>Qwen40 Improvement Bot</title><style>body{{font-family:system-ui;margin:0;background:#f6f8fb;color:#172033}}header{{background:#101828;color:white;padding:18px 24px}}main{{max-width:1280px;margin:auto;padding:20px}}.grid{{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}}.panel{{background:white;border:1px solid #d8e0ec;border-radius:8px;padding:14px;margin:14px 0}}button{{width:100%;padding:12px;border:1px solid #b7c3d7;border-radius:8px;background:white;font-weight:800;cursor:pointer}}button:hover{{background:#eef4ff}}pre{{background:#101828;color:#d6e4ff;padding:14px;border-radius:8px;overflow:auto;white-space:pre-wrap}}code{{background:#eef4ff;padding:2px 5px;border-radius:4px}}.ok{{color:#067647;font-weight:800}}.warn{{color:#b54708;font-weight:800}}</style></head><body><header><h1>Qwen40 Improvement Bot</h1><div>24시간 개선사항 감시 · 포트 {PORT} · 상태 <span>{html.escape(disabled_label)}</span></div></header><main><section class='grid'><form method='post' action='/run?token={html.escape(TOKEN)}'><button>즉시 개선 제안 생성</button></form><form method='post' action='/enable?token={html.escape(TOKEN)}'><button>봇 활성화</button></form><form method='post' action='/disable?token={html.escape(TOKEN)}'><button>봇 일시중지</button></form><form method='get' action='/api/status'><input type='hidden' name='token' value='{html.escape(TOKEN)}'><button>JSON 상태</button></form></section><section class='panel'><h2>상태</h2><pre>{html.escape(json.dumps(data, ensure_ascii=False, indent=2))}</pre></section><section class='panel'><h2>최신 개선 제안</h2><pre>{html.escape(latest_md or '아직 생성된 제안이 없습니다. 첫 실행이 끝나면 표시됩니다.')}</pre></section><section class='panel'><h2>봇 이벤트</h2><pre>{html.escape(latest_events)}</pre></section><section class='panel'><h2>개선 제안 JSONL</h2><pre>{html.escape(suggestions)}</pre></section><p>로그 파일: <code>{html.escape(str(EVENT_LOG))}</code> / <code>{html.escape(str(SUGGESTION_LOG))}</code></p></main></body></html>"""

    def do_GET(self) -> None:
        parsed = urlparse(self.path)
        if not self.authorized():
            return self.send_body("unauthorized", "text/plain; charset=utf-8", 401)
        if parsed.path == "/api/status":
            return self.send_body(json.dumps(self.json_payload(), ensure_ascii=False, indent=2), "application/json; charset=utf-8")
        if parsed.path == "/latest":
            return self.send_body(tail(LATEST_MD, max_bytes=64000), "text/markdown; charset=utf-8")
        if parsed.path == "/events":
            return self.send_body(tail(EVENT_LOG, max_bytes=64000), "application/jsonl; charset=utf-8")
        if parsed.path == "/suggestions":
            return self.send_body(tail(SUGGESTION_LOG, max_bytes=64000), "application/jsonl; charset=utf-8")
        return self.send_body(self.page())

    def do_POST(self) -> None:
        parsed = urlparse(self.path)
        if not self.authorized():
            return self.send_body("unauthorized", "text/plain; charset=utf-8", 401)
        if parsed.path == "/run":
            ok = run_once("manual-web")
            self.send_response(303)
            self.send_header("Location", f"/?token={TOKEN}")
            self.end_headers()
            return
        if parsed.path == "/disable":
            BOT_DISABLE_FILE.write_text(now_iso() + "\n", encoding="utf-8")
            append_event("WARN", "BOT_DISABLED", "disabled by web request")
            self.send_response(303); self.send_header("Location", f"/?token={TOKEN}"); self.end_headers(); return
        if parsed.path == "/enable":
            for path in (BOT_DISABLE_FILE, DISABLE_FILE):
                try:
                    path.unlink()
                except FileNotFoundError:
                    pass
            append_event("OK", "BOT_ENABLED", "enabled by web request")
            self.send_response(303); self.send_header("Location", f"/?token={TOKEN}"); self.end_headers(); return
        return self.send_body("not found", "text/plain; charset=utf-8", 404)


def main() -> None:
    thread = threading.Thread(target=scheduler, daemon=True)
    thread.start()
    print(f"Qwen40 improvement bot listening on {HOST}:{PORT}", flush=True)
    ThreadingHTTPServer((HOST, PORT), Handler).serve_forever()


if __name__ == "__main__":
    main()
