#!/usr/bin/env bash
set -Eeuo pipefail

if [[ $# -ne 1 ]]; then
  echo "usage: sync-screen-system-assets.sh <asset-contract.json>" >&2
  exit 2
fi

contract_path="$(readlink -f "$1")"
resonance_root="/opt/Resonance"
generator="$resonance_root/ops/scripts/generate-screen-system-assets.mjs"
run_dir="$resonance_root/var/run"
sql_path="$run_dir/screen-system-assets-$(basename "$contract_path" .json).sql"

mkdir -p "$run_dir"
node "$generator" --check "$contract_path"
node "$generator" "$contract_path" > "$sql_path"

pod="$(kubectl -n carbonet-prod get pods -l app=postgres-patroni -o jsonpath='{.items[0].metadata.name}')"
kubectl -n carbonet-prod exec -i "$pod" -c patroni -- \
  psql -h 127.0.0.1 -U postgres -d carbonet -X -v ON_ERROR_STOP=1 \
  < "$sql_path"

echo "SCREEN_SYSTEM_ASSET_SYNC_OK contract=$contract_path sql=$sql_path"
