#!/usr/bin/env bash
set -euo pipefail

# Bootstrap an empty project database from the current canonical PostgreSQL schema.
# No application rows are copied. Subsequent changes belong in project Flyway migrations.

PROJECT_ID="${1:-}"
MODE="${2:---dry-run}"
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NAMESPACE="${NAMESPACE:-carbonet-prod}"
SOURCE_DATABASE="${SOURCE_DATABASE:-carbonet}"
MANIFEST="$ROOT/projects/$PROJECT_ID/manifest.json"

if [[ ! "$PROJECT_ID" =~ ^[A-Za-z][A-Za-z0-9_-]{1,31}$ ]]; then
  echo "A valid project-id is required." >&2
  exit 2
fi
if [[ "$MODE" != "--dry-run" && "$MODE" != "--apply" ]]; then
  echo "Mode must be --dry-run or --apply." >&2
  exit 2
fi
[[ -f "$MANIFEST" ]] || { echo "Project manifest not found: $MANIFEST" >&2; exit 1; }

readarray -t binding < <(python3 - "$MANIFEST" <<'PY'
import json
import re
import sys
from urllib.parse import urlparse

manifest = json.load(open(sys.argv[1], encoding="utf-8-sig"))
project_id = manifest["metadata"]["projectId"]
url = manifest["bindings"]["database"]["projectDb"]["url"]
parsed = urlparse(url.removeprefix("jdbc:"))
database = parsed.path.lstrip("/")
role = re.sub(r"[^a-z0-9_]", "_", project_id.lower()) + "_app"
print(database)
print(role)
PY
)
database="${binding[0]}"
role="${binding[1]}"

echo "projectId=$PROJECT_ID source=$SOURCE_DATABASE target=$database role=$role mode=$MODE"
if [[ "$MODE" == "--dry-run" ]]; then
  exit 0
fi

bash "$ROOT/ops/scripts/patroni-health-check.sh"
leader=""
for pod in $(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name); do
  pod="${pod#pod/}"
  if kubectl -n "$NAMESPACE" exec "$pod" -- curl -fsS http://127.0.0.1:8008/master >/dev/null 2>&1; then
    leader="$pod"
    break
  fi
done
[[ -n "$leader" ]] || { echo "Patroni leader not found." >&2; exit 1; }

table_count="$(kubectl -n "$NAMESPACE" exec "$leader" -- \
  psql -h 127.0.0.1 -U postgres -d "$database" -X -Atc \
    "select count(*) from pg_tables where schemaname = 'public';")"
if (( table_count > 0 )); then
  marker="$(kubectl -n "$NAMESPACE" exec "$leader" -- \
    psql -h 127.0.0.1 -U postgres -d "$database" -X -Atc \
      "select to_regclass('public.resonance_project_schema_bootstrap') is not null;" || true)"
  [[ "$marker" == "t" ]] && { echo "Project schema already bootstrapped."; exit 0; }
  echo "Target database is not empty and has no Resonance bootstrap marker." >&2
  exit 1
fi

# A schema-only dump omits extension-owned objects. Install source extensions
# first so operator classes such as pg_trgm.gin_trgm_ops exist for indexes.
while IFS= read -r extension; do
  [[ -n "$extension" ]] || continue
  kubectl -n "$NAMESPACE" exec -i "$leader" -- \
    psql -h 127.0.0.1 -U postgres -d "$database" -X -v ON_ERROR_STOP=1 \
      -v extension_name="$extension" <<'SQL' >/dev/null
SELECT format('CREATE EXTENSION IF NOT EXISTS %I', :'extension_name')
\gexec
SQL
done < <(kubectl -n "$NAMESPACE" exec "$leader" -- \
  psql -h 127.0.0.1 -U postgres -d "$SOURCE_DATABASE" -X -Atc \
    "select extname from pg_extension where extname <> 'plpgsql' order by extname")

# Keep the dump inside the leader pod. A second interactive kubectl stream can
# remain open after its producer exits; using a bounded temporary file avoids
# that deadlock and is substantially faster for large canonical schemas.
dump_path="/tmp/resonance-${database}-schema-$$.sql"
kubectl -n "$NAMESPACE" exec "$leader" -- sh -ceu '
  source_database=$1
  target_database=$2
  target_role=$3
  dump_path=$4
  trap '\''rm -f "$dump_path"'\'' EXIT
  {
    printf '\''SET ROLE %s;\n'\'' "$target_role"
    pg_dump -h 127.0.0.1 -U postgres -d "$source_database" \
      --schema-only --no-owner --no-privileges --schema=public
  } >"$dump_path"
  sed -i '\''/^CREATE SCHEMA public;$/d'\'' "$dump_path"
  psql -h 127.0.0.1 -U postgres -d "$target_database" -X \
    -v ON_ERROR_STOP=1 -f "$dump_path" >/dev/null
' sh "$SOURCE_DATABASE" "$database" "$role" "$dump_path"

kubectl -n "$NAMESPACE" exec -i "$leader" -- \
  psql -h 127.0.0.1 -U postgres -d "$database" -X -v ON_ERROR_STOP=1 <<SQL
SET ROLE $role;
CREATE TABLE resonance_project_schema_bootstrap (
  project_id varchar(32) PRIMARY KEY,
  source_database varchar(63) NOT NULL,
  bootstrapped_at timestamptz NOT NULL DEFAULT current_timestamp
);
INSERT INTO resonance_project_schema_bootstrap(project_id, source_database)
VALUES ('$PROJECT_ID', '$SOURCE_DATABASE');
SQL

bash "$ROOT/ops/scripts/patroni-health-check.sh"
echo "Project schema bootstrap complete."
