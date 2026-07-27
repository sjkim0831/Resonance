#!/usr/bin/env bash
set -euo pipefail

root="${1:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
namespace="${NAMESPACE:-carbonet-prod}"
database="${POSTGRES_DB:-carbonet}"
user="${POSTGRES_USER:-postgres}"
history_table="${FLYWAY_HISTORY_TABLE:-carbonet_flyway_schema_history}"
migration_dir="$root/apps/carbonet-api/src/main/resources/db/migration/postgresql"
work="$(mktemp)"
trap 'rm -f "$work"' EXIT

pod="${POSTGRES_POD:-}"
if [[ -z "$pod" ]]; then
  while IFS= read -r candidate; do
    if [[ "$(
      kubectl -n "$namespace" exec "$candidate" -c patroni -- \
        psql -h 127.0.0.1 -U "$user" -d "$database" -Atqc \
        'select pg_is_in_recovery()' 2>/dev/null || true
    )" == f ]]; then
      pod="$candidate"
      break
    fi
  done < <(
    kubectl -n "$namespace" get pods -l app=postgres-patroni -o name |
      sed 's#^pod/##'
  )
fi
[[ -n "$pod" ]] || {
  echo "[flyway-immutability] writable Patroni leader not found" >&2
  exit 2
}

kubectl -n "$namespace" exec "$pod" -c patroni -- \
  psql -h 127.0.0.1 -U "$user" -d "$database" -X -q -At \
  -F $'\t' \
  -c "select script,checksum from ${history_table}
      where success and version is not null
        and type='SQL' and checksum is not null
      order by installed_rank" >"$work"

python3 - "$migration_dir" "$work" <<'PY'
import pathlib
import sys
import zlib

migration_dir = pathlib.Path(sys.argv[1])
history = pathlib.Path(sys.argv[2])
errors = []
checked = 0

for record in history.read_text(encoding="utf-8").splitlines():
    script, expected_text = record.split("\t", 1)
    matches = list(migration_dir.glob(script))
    if not matches:
        errors.append(f"applied migration is missing locally: {script}")
        continue
    if len(matches) != 1:
        errors.append(f"migration is not unique: {script}")
        continue
    checksum = 0
    for line in matches[0].read_text(encoding="utf-8").splitlines():
        checksum = zlib.crc32(line.encode("utf-8"), checksum)
    if checksum >= 2**31:
        checksum -= 2**32
    expected = int(expected_text)
    if checksum != expected:
        errors.append(
            f"checksum mismatch: {script} database={expected} source={checksum}"
        )
    checked += 1

if errors:
    for error in errors:
        print(f"[flyway-immutability] FAIL {error}", file=sys.stderr)
    raise SystemExit(1)
print(f"[flyway-immutability] PASS appliedMigrations={checked}")
PY
