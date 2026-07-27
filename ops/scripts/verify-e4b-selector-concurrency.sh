#!/usr/bin/env bash
set -euo pipefail

service="${E4B_SERVICE:-resonance-shadow-gemma4-e4b.service}"
base_url="${E4B_BASE_URL:-http://127.0.0.1:24451}"
workers="${E4B_VERIFY_WORKERS:-4}"
max_gpu_memory_mib="${E4B_MAX_GPU_MEMORY_MIB:-12288}"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

fail() {
  echo "[e4b-concurrency] FAIL $*" >&2
  exit 1
}

[[ "$(systemctl is-active "$service")" == active ]] ||
  fail "service is not active: $service"
curl -fsS "$base_url/health" >/dev/null ||
  fail "health endpoint is unavailable: $base_url/health"
exec_start="$(systemctl show "$service" -p ExecStart --value)"
key_file="$(sed -n 's/.*--api-key-file \([^ ;}]*\).*/\1/p' <<<"$exec_start" | head -1)"
[[ -n "$key_file" ]] || fail "active service does not use --api-key-file"
key_file="${key_file%\"}"
key_file="${key_file#\"}"
[[ -f "$key_file" ]] || fail "API key file does not exist"
[[ "$(stat -c '%a' "$key_file")" == "600" ]] ||
  fail "API key file mode must be 600"
key="$(<"$key_file")"
[[ -n "$key" ]] || fail "API key file is empty"

request() {
  local id="$1" started ended
  started="$(date +%s%N)"
  if curl -fsS --max-time 90 \
      -H "Authorization: Bearer $key" \
      -H 'Content-Type: application/json' \
      -d '{"model":"gemma4-e4b-gpu-shadow","temperature":0,"max_tokens":24,"messages":[{"role":"system","content":"Return strict JSON only."},{"role":"user","content":"Choose A. Return {\"choice\":\"A\"}."}]}' \
      "$base_url/v1/chat/completions" >"$work/$id.json" 2>"$work/$id.err" &&
      jq -e '.choices[0].message.content|type == "string" and length>0' \
        "$work/$id.json" >/dev/null 2>>"$work/$id.err"; then
    ended="$(date +%s%N)"
    echo "$(((ended-started)/1000000))" >"$work/$id.ms"
  else
    echo FAIL >"$work/$id.ms"
  fi
}
export -f request
export base_url key work
seq 1 "$workers" | xargs -P "$workers" -I{} bash -c 'request "$1"' _ {}

failures="$(
  { grep -l '^FAIL$' "$work"/*.ms 2>/dev/null || true; } |
    wc -l
)"
if (( failures != 0 )); then
  for error in "$work"/*.err; do
    [[ -s "$error" ]] && sed 's/^/[e4b-concurrency] request: /' "$error" >&2
  done
  fail "$failures of $workers requests failed"
fi
main_pid="$(systemctl show "$service" -p MainPID --value)"
[[ "$main_pid" =~ ^[1-9][0-9]*$ ]] || fail "service MainPID is invalid"
gpu_memory="$(nvidia-smi --query-compute-apps=pid,used_memory \
  --format=csv,noheader,nounits |
  awk -F, -v pid="$main_pid" '
    {gsub(/ /, "", $1); gsub(/ /, "", $2)}
    $1 == pid {sum += $2}
    END {print sum + 0}
  ')"
(( gpu_memory <= max_gpu_memory_mib )) ||
  fail "service GPU memory ${gpu_memory}MiB exceeds ${max_gpu_memory_mib}MiB"
p95="$(grep -h '^[0-9]' "$work"/*.ms | sort -n |
  awk '{v[NR]=$1} END{print v[int((NR-1)*.95)+1]}')"
[[ "$p95" =~ ^[0-9]+$ ]] || fail "p95 latency could not be calculated"
echo "[e4b-concurrency] PASS workers=$workers failures=$failures p95=${p95}ms gpuMemory=${gpu_memory}MiB"
