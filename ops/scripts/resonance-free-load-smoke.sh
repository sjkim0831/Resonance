#!/usr/bin/env bash
set -euo pipefail
URL="${URL:-http://10.102.247.178/actuator/health}"
CONCURRENCY="${CONCURRENCY:-50}"
REQUESTS="${REQUESTS:-1000}"
DURATION="${DURATION:-}"
OUT_DIR="${OUT_DIR:-/opt/Resonance/var/ai-runtime}"
mkdir -p "$OUT_DIR"
ts="$(date +%Y%m%d-%H%M%S)"
log="$OUT_DIR/load-smoke-$ts.log"
if command -v hey >/dev/null 2>&1; then
  if [[ -n "$DURATION" ]]; then
    hey -z "$DURATION" -c "$CONCURRENCY" "$URL" | tee "$log"
  else
    hey -n "$REQUESTS" -c "$CONCURRENCY" "$URL" | tee "$log"
  fi
else
  ab -n "$REQUESTS" -c "$CONCURRENCY" "$URL" | tee "$log"
fi
printf ts:%sn "$(date -Iseconds)" "$URL" "$CONCURRENCY" "$REQUESTS" "$log" >> "$OUT_DIR/load-smoke-events.jsonl"
