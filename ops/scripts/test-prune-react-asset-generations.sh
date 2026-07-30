#!/usr/bin/env bash
set -euo pipefail

root="$(mktemp -d)"
trap 'rm -rf "$root"' EXIT
mkdir -p "$root/overlay/.vite" "$root/overlay/assets"

printf old >"$root/overlay/assets/old.js"
printf stale >"$root/overlay/assets/stale.js"
cat >"$root/previous.json" <<'JSON'
{"old":{"file":"assets/old.js"}}
JSON
cat >"$root/overlay/.vite/manifest.json" <<'JSON'
{"current":{"file":"assets/current.js","css":["assets/current.css"]}}
JSON
printf current >"$root/overlay/assets/current.js"
printf css >"$root/overlay/assets/current.css"

result="$(
  node ops/scripts/prune-react-asset-generations.mjs \
    "$root/overlay" "$root/previous.json"
)"
node -e '
  const value = JSON.parse(process.argv[1]);
  if (value.status !== "PASS" ||
      value.retainedGenerations !== 2 ||
      value.removedFiles !== 1) process.exit(1);
' "$result"
[[ -f "$root/overlay/assets/old.js" ]]
[[ -f "$root/overlay/assets/current.js" ]]
[[ ! -e "$root/overlay/assets/stale.js" ]]

echo "[react-asset-prune-test] PASS current=true previous=true stale=removed"
