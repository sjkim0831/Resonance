#!/usr/bin/env bash
set -euo pipefail

# Provision an isolated PostgreSQL role/database and Kubernetes runtime bindings.
# Usage: PROJECT_DB_PASSWORD=... provision-project-postgres.sh <project-id> [--apply]

PROJECT_ID="${1:-}"
MODE="${2:---dry-run}"
ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
NAMESPACE="${NAMESPACE:-carbonet-prod}"
MANIFEST="$ROOT/projects/$PROJECT_ID/manifest.json"

if [[ ! "$PROJECT_ID" =~ ^[A-Za-z][A-Za-z0-9_-]{1,31}$ ]]; then
  echo "A valid project-id is required." >&2
  exit 2
fi
if [[ "$MODE" != "--dry-run" && "$MODE" != "--apply" ]]; then
  echo "Mode must be --dry-run or --apply." >&2
  exit 2
fi
if [[ ! -f "$MANIFEST" ]]; then
  echo "Project manifest not found: $MANIFEST" >&2
  exit 1
fi

readarray -t BINDING < <(python3 - "$MANIFEST" <<'PY'
import json
import re
import sys
from urllib.parse import urlparse

manifest = json.load(open(sys.argv[1], encoding="utf-8-sig"))
project_id = manifest["metadata"]["projectId"]
url = manifest["bindings"]["database"]["projectDb"]["url"]
if not url.startswith("jdbc:postgresql://"):
    raise SystemExit("projectDb.url must use jdbc:postgresql")
parsed = urlparse(url.removeprefix("jdbc:"))
database = parsed.path.lstrip("/")
role = re.sub(r"[^a-z0-9_]", "_", project_id.lower()) + "_app"
if not re.fullmatch(r"[a-z][a-z0-9_]{1,62}", database):
    raise SystemExit(f"invalid database name: {database}")
if not re.fullmatch(r"[a-z][a-z0-9_]{1,62}", role):
    raise SystemExit(f"invalid role name: {role}")
print(database)
print(role)
print(url)
PY
)

DATABASE_NAME="${BINDING[0]}"
DATABASE_ROLE="${BINDING[1]}"
DATABASE_URL="${BINDING[2]}"
RESOURCE_ID="$(tr '[:upper:]_' '[:lower:]-' <<<"$PROJECT_ID" | sed 's/[^a-z0-9-]//g')"
SECRET_NAME="$RESOURCE_ID-runtime-secret"
CONFIGMAP_NAME="$RESOURCE_ID-runtime-manifest"

cat <<EOF
projectId=$PROJECT_ID
database=$DATABASE_NAME
role=$DATABASE_ROLE
secret=$SECRET_NAME
manifestConfigMap=$CONFIGMAP_NAME
mode=$MODE
EOF

if [[ "$MODE" == "--dry-run" ]]; then
  echo "Dry run only. Set PROJECT_DB_PASSWORD and pass --apply to provision."
  exit 0
fi
if [[ -z "${PROJECT_DB_PASSWORD:-}" ]]; then
  echo "PROJECT_DB_PASSWORD is required with --apply." >&2
  exit 1
fi
command -v kubectl >/dev/null || { echo "kubectl is required." >&2; exit 1; }

bash "$ROOT/ops/scripts/patroni-health-check.sh"
LEADER=""
for pod in $(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name); do
  pod="${pod#pod/}"
  if kubectl -n "$NAMESPACE" exec "$pod" -- curl -fsS http://127.0.0.1:8008/master >/dev/null 2>&1; then
    LEADER="$pod"
    break
  fi
done
[[ -n "$LEADER" ]] || { echo "Patroni leader not found." >&2; exit 1; }

kubectl -n "$NAMESPACE" exec -i "$LEADER" -- \
  psql -h 127.0.0.1 -U postgres -d postgres -v ON_ERROR_STOP=1 \
    -v role_name="$DATABASE_ROLE" -v db_name="$DATABASE_NAME" -v role_password="$PROJECT_DB_PASSWORD" <<'SQL'
SELECT format('CREATE ROLE %I LOGIN PASSWORD %L', :'role_name', :'role_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = :'role_name')
\gexec
SELECT format('ALTER ROLE %I LOGIN PASSWORD %L', :'role_name', :'role_password')
\gexec
SELECT format('CREATE DATABASE %I OWNER %I', :'db_name', :'role_name')
WHERE NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = :'db_name')
\gexec
SELECT format('REVOKE CONNECT ON DATABASE %I FROM PUBLIC', :'db_name')
\gexec
SELECT format('GRANT CONNECT ON DATABASE %I TO %I', :'db_name', :'role_name')
\gexec
SQL

kubectl -n "$NAMESPACE" exec -i "$LEADER" -- \
  psql -h 127.0.0.1 -U postgres -d "$DATABASE_NAME" -v ON_ERROR_STOP=1 \
    -v role_name="$DATABASE_ROLE" <<'SQL'
SELECT format('ALTER SCHEMA public OWNER TO %I', :'role_name')
\gexec
SELECT format('GRANT ALL ON SCHEMA public TO %I', :'role_name')
\gexec
SQL

secret_env="$(mktemp)"
trap 'rm -f "$secret_env"' EXIT
chmod 600 "$secret_env"
cat >"$secret_env" <<EOF
DB_USERNAME=$DATABASE_ROLE
DB_PASSWORD=$PROJECT_DB_PASSWORD
SPRING_DATASOURCE_USERNAME=$DATABASE_ROLE
SPRING_DATASOURCE_PASSWORD=$PROJECT_DB_PASSWORD
SPRING_DATASOURCE_URL=$DATABASE_URL
EOF
kubectl -n "$NAMESPACE" create secret generic "$SECRET_NAME" \
  --from-env-file="$secret_env" --dry-run=client -o yaml | kubectl apply -f -
kubectl -n "$NAMESPACE" create configmap "$CONFIGMAP_NAME" \
  --from-file=manifest.json="$MANIFEST" --dry-run=client -o yaml | kubectl apply -f -

bash "$ROOT/ops/scripts/patroni-health-check.sh"
kubectl -n "$NAMESPACE" exec "$LEADER" -- \
  psql -h 127.0.0.1 -U postgres -d postgres -Atc \
  "select datname from pg_database where datname = '$DATABASE_NAME';"
echo "Project PostgreSQL binding provisioned."
