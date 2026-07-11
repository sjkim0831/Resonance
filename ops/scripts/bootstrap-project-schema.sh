#!/usr/bin/env bash
set -euo pipefail

# Bootstrap an empty project database from the current canonical PostgreSQL schema.
# No application rows are copied. Subsequent changes belong in project Flyway migrations.

PROJECT_ID="${1:-}"
MODE="${2:---dry-run}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
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
resource_id="$(tr '[:upper:]_' '[:lower:]-' <<<"$PROJECT_ID" | sed 's/[^a-z0-9-]//g')"
secret="$resource_id-runtime-secret"

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
password="$(kubectl -n "$NAMESPACE" get secret "$secret" -o jsonpath='{.data.DB_PASSWORD}' | base64 -d)"

table_count="$(kubectl -n "$NAMESPACE" exec "$leader" -- env PGPASSWORD="$password" \
  psql -h 127.0.0.1 -U "$role" -d "$database" -Atc \
  "select count(*) from pg_tables where schemaname = 'public';")"
if (( table_count > 0 )); then
  marker="$(kubectl -n "$NAMESPACE" exec "$leader" -- env PGPASSWORD="$password" \
    psql -h 127.0.0.1 -U "$role" -d "$database" -Atc \
    "select to_regclass('public.resonance_project_schema_bootstrap') is not null;" || true)"
  [[ "$marker" == "t" ]] && { echo "Project schema already bootstrapped."; exit 0; }
  echo "Target database is not empty and has no Resonance bootstrap marker." >&2
  exit 1
fi

kubectl -n "$NAMESPACE" exec "$leader" -- \
  pg_dump -h 127.0.0.1 -U postgres -d "$SOURCE_DATABASE" \
    --schema-only --clean --if-exists --no-owner --no-privileges --schema=public \
  | kubectl -n "$NAMESPACE" exec -i "$leader" -- env PGPASSWORD="$password" \
      psql -h 127.0.0.1 -U "$role" -d "$database" -v ON_ERROR_STOP=1 >/dev/null

kubectl -n "$NAMESPACE" exec -i "$leader" -- env PGPASSWORD="$password" \
  psql -h 127.0.0.1 -U "$role" -d "$database" -v ON_ERROR_STOP=1 <<SQL
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
