#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RUNNER="$SCRIPT_DIR/run-incremental-generator.mjs"
TMP_ROOT="$(mktemp -d)"
trap 'rm -rf "$TMP_ROOT"' EXIT
repo="$TMP_ROOT/repo"
mkdir -p "$repo/scripts" "$repo/src/input" "$repo/src/generated" "$repo/node_modules/.cache"
git -C "$repo" init -q
git -C "$repo" config user.email test@localhost
git -C "$repo" config user.name test
printf 'alpha\n' > "$repo/src/input/value.txt"
cat > "$repo/scripts/generate.mjs" <<'NODE'
import fs from 'node:fs';
fs.mkdirSync('src/generated', { recursive: true });
const countPath = 'generator-count.txt';
const count = Number(fs.existsSync(countPath) ? fs.readFileSync(countPath, 'utf8') : 0) + 1;
fs.writeFileSync(countPath, String(count));
fs.writeFileSync('src/generated/output.txt', fs.readFileSync('src/input/value.txt'));
NODE
git -C "$repo" add .
git -C "$repo" commit -qm baseline

(cd "$repo" && node "$RUNNER" sample scripts/generate.mjs src/generated/output.txt src/input)
test "$(cat "$repo/generator-count.txt")" = 1
touch "$repo/src/input/value.txt"
(cd "$repo" && node "$RUNNER" sample scripts/generate.mjs src/generated/output.txt src/input)
test "$(cat "$repo/generator-count.txt")" = 1
printf 'tampered\n' > "$repo/src/generated/output.txt"
(cd "$repo" && node "$RUNNER" sample scripts/generate.mjs src/generated/output.txt src/input)
test "$(cat "$repo/generator-count.txt")" = 2
grep -qx alpha "$repo/src/generated/output.txt"
printf 'beta\n' > "$repo/src/input/value.txt"
(cd "$repo" && node "$RUNNER" sample scripts/generate.mjs src/generated/output.txt src/input)
test "$(cat "$repo/generator-count.txt")" = 3
grep -qx beta "$repo/src/generated/output.txt"
echo '[incremental-generator-cache-test] PASS mtime ignored and input/output drift detected'
