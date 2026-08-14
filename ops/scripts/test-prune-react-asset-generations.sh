#!/usr/bin/env bash
set -euo pipefail

root="$(mktemp -d)"
trap 'rm -rf "$root"' EXIT
mkdir -p "$root/overlay/.vite" "$root/overlay/assets/fonts" \
  "$root/public/assets/fonts"

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
printf license >"$root/public/assets/fonts/LICENSE.txt"
cp "$root/public/assets/fonts/LICENSE.txt" \
  "$root/overlay/assets/fonts/LICENSE.txt"

result="$(
  node ops/scripts/prune-react-asset-generations.mjs \
    "$root/overlay" "$root/previous.json" "$root/public"
)"
node -e '
  const value = JSON.parse(process.argv[1]);
  if (value.status !== "PASS" ||
      value.retainedGenerations !== 2 ||
      value.preservedFiles !== 1 ||
      value.removedFiles !== 1) process.exit(1);
' "$result"
[[ -f "$root/overlay/assets/old.js" ]]
[[ -f "$root/overlay/assets/current.js" ]]
cmp "$root/public/assets/fonts/LICENSE.txt" \
  "$root/overlay/assets/fonts/LICENSE.txt"
[[ ! -e "$root/overlay/assets/stale.js" ]]

printf retained-before-reject >"$root/overlay/assets/unrelated.js"
printf corrupt >"$root/overlay/assets/fonts/LICENSE.txt"
if node ops/scripts/prune-react-asset-generations.mjs \
  "$root/overlay" "$root/previous.json" "$root/public" \
  >"$root/corrupt.out" 2>"$root/corrupt.err"; then
  echo "corrupt public asset was accepted" >&2
  exit 1
fi
grep -Fq 'preserved asset closure damaged before pruning' "$root/corrupt.err"
test -f "$root/overlay/assets/unrelated.js"
grep -Fq 'retained-before-reject' "$root/overlay/assets/unrelated.js"

rm -rf "$root/public/assets/fonts"
mkdir -p "$root/public/assets/fonts"
ln -s "$root/overlay/assets/current.js" \
  "$root/public/assets/fonts/current.js"
if node ops/scripts/prune-react-asset-generations.mjs \
  "$root/overlay" "$root/previous.json" "$root/public" \
  >"$root/symlink.out" 2>"$root/symlink.err"; then
  echo "public symlink was accepted" >&2
  exit 1
fi
grep -Fq 'refusing symlink in preserved asset tree' "$root/symlink.err"

mkdir -p "$root/symlink-overlay/.vite" "$root/real-assets"
cp "$root/overlay/.vite/manifest.json" "$root/symlink-overlay/.vite/manifest.json"
cp "$root/overlay/assets/current.js" "$root/real-assets/current.js"
ln -s "$root/real-assets" "$root/symlink-overlay/assets"
if node ops/scripts/prune-react-asset-generations.mjs \
  "$root/symlink-overlay" "$root/previous.json" "$root/overlay" \
  >"$root/root-symlink.out" 2>"$root/root-symlink.err"; then
  echo "overlay asset-root symlink was accepted" >&2
  exit 1
fi
grep -Fq 'invalid React overlay' "$root/root-symlink.err"

ln -s "$root/overlay" "$root/overlay-root-link"
if node ops/scripts/prune-react-asset-generations.mjs \
  "$root/overlay-root-link" "$root/previous.json" "$root/overlay" \
  >"$root/overlay-root-link.out" 2>"$root/overlay-root-link.err"; then
  echo "overlay root symlink was accepted" >&2
  exit 1
fi
grep -Fq 'invalid React overlay' "$root/overlay-root-link.err"

echo "[react-asset-prune-test] PASS current=true previous=true public=true stale=removed rejectWrite0=true mutants=5"
