#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
TARGET="$ROOT/ops/scripts/generate-db-screen-source.sh"

bash -n "$TARGET"
generator_line="$(grep -n 'node scripts/generate-screen-blueprints.mjs' "$TARGET" | cut -d: -f1)"
hash_branch_line="$(grep -n 'if \[\[ "$next_hash" != "$previous_hash"' "$TARGET" | cut -d: -f1)"
[[ -n "$generator_line" && -n "$hash_branch_line" && "$generator_line" -lt "$hash_branch_line" ]] || {
  echo '[db-screen-source-self-heal] FAIL generator remains inside the design-hash branch' >&2
  exit 1
}
grep -Fq ".contractFilesChanged//0" "$TARGET"
grep -Fq ".staleFilesRemoved//0" "$TARGET"
grep -Fq 'contractFilesChanged>=0' "$TARGET"
grep -Fq '"$next_hash" != "$previous_hash" || "$generated" == true' "$TARGET"
echo '[db-screen-source-self-heal] PASS unchanged design can repair missing generated files'
