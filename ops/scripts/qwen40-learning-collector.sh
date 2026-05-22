#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${ROOT_DIR:-/opt/Resonance}"
EVOLVING_DIR="$ROOT_DIR/var/self-evolving"
CHECKPOINT_DIR="$EVOLVING_DIR/checkpoints"
TRAINING_DIR="$EVOLVING_DIR/training/hermes-carbonet"
OUTPUT_JSONL="$TRAINING_DIR/self_evolving_cycles.jsonl"
SUMMARY_JSON="$TRAINING_DIR/summary.json"

mkdir -p "$TRAINING_DIR"

collect() {
  python3 - "$CHECKPOINT_DIR" "$OUTPUT_JSONL" "$SUMMARY_JSON" <<'PY'
import json
import pathlib
import sys
from datetime import datetime, timezone

checkpoint_dir = pathlib.Path(sys.argv[1])
output = pathlib.Path(sys.argv[2])
summary_path = pathlib.Path(sys.argv[3])
records = []
for cycle in sorted(checkpoint_dir.glob("cycle-*")):
    if not cycle.is_dir():
        continue
    request = (cycle / "request.txt").read_text(encoding="utf-8", errors="replace") if (cycle / "request.txt").exists() else ""
    plan = (cycle / "plan.json").read_text(encoding="utf-8", errors="replace") if (cycle / "plan.json").exists() else ""
    execution = (cycle / "execution.log").read_text(encoding="utf-8", errors="replace")[-50000:] if (cycle / "execution.log").exists() else ""
    verification = (cycle / "verification.json").read_text(encoding="utf-8", errors="replace") if (cycle / "verification.json").exists() else ""
    learning = (cycle / "learning.json").read_text(encoding="utf-8", errors="replace") if (cycle / "learning.json").exists() else ""
    status = "unknown"
    low = verification.lower()
    if '"pass"' in low or "pass" in low:
        status = "pass"
    elif '"fail"' in low or "fail" in low:
        status = "fail"
    elif '"partial"' in low or "partial" in low:
        status = "partial"
    reward = {"pass": 1.0, "partial": 0.3, "fail": -0.5}.get(status, 0.0)
    records.append({
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "cycleId": cycle.name,
        "instruction": request,
        "input": {"plan": plan},
        "output": execution,
        "verification": verification,
        "reflection": learning,
        "reward": reward,
        "status": status,
    })
with output.open("w", encoding="utf-8") as f:
    for record in records:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")
summary = {
    "generatedAt": datetime.now(timezone.utc).isoformat(),
    "records": len(records),
    "pass": sum(1 for r in records if r["status"] == "pass"),
    "partial": sum(1 for r in records if r["status"] == "partial"),
    "fail": sum(1 for r in records if r["status"] == "fail"),
    "output": str(output),
}
summary_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(summary, ensure_ascii=False, indent=2))
PY
}

summarize() {
  if [[ -f "$SUMMARY_JSON" ]]; then
    cat "$SUMMARY_JSON"
  else
    collect
  fi
}

case "${1:-collect}" in
  collect) collect ;;
  summary) summarize ;;
  *) echo "Usage: $0 {collect|summary}" >&2; exit 2 ;;
esac
