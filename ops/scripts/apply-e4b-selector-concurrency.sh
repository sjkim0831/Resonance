#!/usr/bin/env bash
set -euo pipefail

root="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
service="${E4B_SERVICE:-resonance-shadow-gemma4-e4b.service}"
source_dropin="$root/ops/systemd/resonance-shadow-gemma4-e4b.service.d/20-always-on.conf"
target_dir="/etc/systemd/system/${service}.d"
target_dropin="$target_dir/20-always-on.conf"
backup="$(mktemp)"
had_target=false

[[ -f "$source_dropin" ]]
binary="/opt/util/ai/vLLM/llama.cpp-tq3/build/bin/llama-server"
binary_help="$("$binary" --help 2>&1 || true)"
grep -q -- '--api-key-file' <<<"$binary_help"
[[ -s /etc/resonance/secrets/e4b-api-key ]]
[[ "$(stat -c '%a' /etc/resonance/secrets/e4b-api-key)" == "600" ]]

if [[ -f "$target_dropin" ]]; then
  cp "$target_dropin" "$backup"
  had_target=true
fi
rollback() {
  if [[ "$had_target" == true ]]; then
    sudo install -m 0644 "$backup" "$target_dropin"
  else
    sudo rm -f "$target_dropin"
  fi
  sudo systemctl daemon-reload
  sudo systemctl restart "$service" || true
}
trap 'rollback' ERR

sudo install -d -m 0755 "$target_dir"
sudo install -m 0644 "$source_dropin" "$target_dropin"
sudo systemctl daemon-reload
sudo systemctl restart "$service"

for _ in {1..60}; do
  if curl -fsS http://127.0.0.1:24451/health >/dev/null 2>&1; then
    break
  fi
  sleep 1
done
curl -fsS http://127.0.0.1:24451/health >/dev/null
E4B_VERIFY_WORKERS=4 bash "$root/ops/scripts/verify-e4b-selector-concurrency.sh"
trap - ERR
rm -f "$backup"
echo "[e4b-concurrency] applied slots=4 context=16384 selectorWorkers=4"
