#!/usr/bin/env bash
set -euo pipefail

TMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMP_ROOT"' EXIT
staging="$TMP_ROOT/staging"
overlay="$TMP_ROOT/overlay"
mkdir -p "$staging/assets" "$staging/.vite" "$overlay/assets" "$overlay/.vite"
printf 'immutable-existing\n' > "$overlay/assets/shared.js"
printf 'must-not-overwrite\n' > "$staging/assets/shared.js"
printf 'new-asset\n' > "$staging/assets/new.js"
printf 'old-manifest\n' > "$overlay/.vite/manifest.json"
printf 'new-manifest\n' > "$staging/.vite/manifest.json"
printf 'new-index\n' > "$staging/index.html"

rsync -a --ignore-existing "$staging/assets/" "$overlay/assets/"
rsync -a --exclude='/index.html' --exclude='/assets/' "$staging/" "$overlay/"
cp "$staging/index.html" "$overlay/.index.html.next"
mv -f "$overlay/.index.html.next" "$overlay/index.html"

grep -qx immutable-existing "$overlay/assets/shared.js"
grep -qx new-asset "$overlay/assets/new.js"
grep -qx new-manifest "$overlay/.vite/manifest.json"
grep -qx new-index "$overlay/index.html"
echo '[overlay-sync-test] PASS immutable assets reused and metadata promoted'
