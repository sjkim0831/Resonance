#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
PLANNER="$ROOT_DIR/ops/scripts/plan-incremental-work.sh"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT

git -C "$tmp" init -q
git -C "$tmp" config user.email test@example.invalid
git -C "$tmp" config user.name test
mkdir -p "$tmp/docs" "$tmp/projects/carbonet-frontend/source/src" "$tmp/apps/carbonet-api/src/main/java" \
  "$tmp/apps/carbonet-api/src/main/resources/db/migration"
echo base > "$tmp/README.md"
git -C "$tmp" add . && git -C "$tmp" commit -qm base
base="$(git -C "$tmp" rev-parse HEAD)"

echo docs > "$tmp/docs/design.md"
git -C "$tmp" add . && git -C "$tmp" commit -qm docs
docs="$(git -C "$tmp" rev-parse HEAD)"
out="$(cd "$tmp" && bash "$PLANNER" "$base" "$docs")"
grep -q 'runtime=false' <<<"$out"
grep -q 'catalogOnly=true' <<<"$out"

echo ui > "$tmp/projects/carbonet-frontend/source/src/App.tsx"
git -C "$tmp" add . && git -C "$tmp" commit -qm frontend
frontend="$(git -C "$tmp" rev-parse HEAD)"
out="$(cd "$tmp" && bash "$PLANNER" "$docs" "$frontend")"
grep -q 'runtime=true frontend=true backend=true' <<<"$out"

echo java > "$tmp/apps/carbonet-api/src/main/java/App.java"
git -C "$tmp" add . && git -C "$tmp" commit -qm backend
backend="$(git -C "$tmp" rev-parse HEAD)"
out="$(cd "$tmp" && bash "$PLANNER" "$frontend" "$backend")"
grep -q 'runtime=true frontend=false backend=true' <<<"$out"

echo sql > "$tmp/apps/carbonet-api/src/main/resources/db/migration/V1__test.sql"
git -C "$tmp" add . && git -C "$tmp" commit -qm database
database="$(git -C "$tmp" rev-parse HEAD)"
out="$(cd "$tmp" && bash "$PLANNER" "$backend" "$database")"
grep -q 'runtime=true frontend=false backend=true database=true' <<<"$out"

echo '[incremental-plan-test] passed'
