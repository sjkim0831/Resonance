#!/usr/bin/env bash
set -euo pipefail

service="${E4B_SERVICE:-resonance-shadow-gemma4-e4b.service}"
base_url="${E4B_BASE_URL:-http://127.0.0.1:24451}"
workers="${E4B_VERIFY_WORKERS:-4}"
max_gpu_memory_mib="${E4B_MAX_GPU_MEMORY_MIB:-12288}"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

[[ "$(systemctl is-active "$service")" == active ]]
curl -fsS "$base_url/health" >/dev/null
exec_start="$(systemctl show "$service" -p ExecStart --value)"
key_file="$(sed -n 's/.*--api-key-file \([^ ;}]*\).*/\1/p' <<<"$exec_start" | head -1)"
[[ -f "$key_file" ]]
[[ "$(stat -c '%a' "$key_file")" == "600" ]]
key="$(<"$key_file")"

request() {
  local id="$1" started ended
  started="$(date +%s%3N)"
  if curl -fsS --max-time 90 \
      -H "Authorization: Bearer $key" \
      -H 'Content-Type: application/json' \
      -d '{"model":"gemma4-e4b-gpu-shadow","temperature":0,"max_tokens":24,"messages":[{"role":"system","content":"Return strict JSON only."},{"role":"user","content":"Choose A. Return {\"choice\":\"A\"}."}]}' \
      "$base_url/v1/chat/completions" >"$work/$id.json" &&
      jq -e '.choices[0].message.content|length>0' "$work/$id.json" >/dev/null; then
    ended="$(date +%s%3N)"
    echo "$((ended-started))" >"$work/$id.ms"
  else
    echo FAIL >"$work/$id.ms"
  fi
}
export -f request
export base_url key work
seq 1 "$workers" | xargs -P "$workers" -I{} bash -c 'request "$1"' _ {}

failures="$(grep -l '^FAIL$' "$work"/*.ms 2>/dev/null | wc -l)"
(( failures == 0 ))
gpu_memory="$(nvidia-smi --query-compute-apps=process_name,used_memory \
  --format=csv,noheader,nounits |
  awk '/llama-server/{sum+=$NF} END{print sum+0}')"
(( gpu_memory <= max_gpu_memory_mib ))
p95="$(grep -h '^[0-9]' "$work"/*.ms | sort -n |
  awk '{v[NR]=$1} END{print v[int((NR-1)*.95)+1]}')"
echo "[e4b-concurrency] PASS workers=$workers failures=$failures p95=${p95}ms gpuMemory=${gpu_memory}MiB"
