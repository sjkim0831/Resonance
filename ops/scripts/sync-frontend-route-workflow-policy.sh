#!/usr/bin/env bash
set -Eeuo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd -- "${SCRIPT_DIR}/../.." && pwd)"
EXPORTER="${SCRIPT_DIR}/export-frontend-route-registry.mjs"
SYNC_SQL="${SCRIPT_DIR}/sql/sync-frontend-route-workflow-policy.sql"
NAMESPACE="${NAMESPACE:-carbonet-prod}"
DATABASE="${DATABASE:-carbonet}"
EXECUTED_BY="${EXECUTED_BY:-route-policy-automation}"
SYNC_MODE="DRY_RUN"
DRY_RUN="true"
EMIT_ONLY=""

usage() {
  cat <<'USAGE'
Usage: sync-frontend-route-workflow-policy.sh [options]
  --dry-run                 Analyze and rollback (default)
  --apply                   Persist resources, policies, bindings, and audit
  --namespace NAME          Kubernetes namespace (default: carbonet-prod)
  --database NAME           PostgreSQL database (default: carbonet)
  --executed-by NAME        Audit actor (safe characters only)
  --emit-only FILE          Generate directly applicable SQL without executing it
USAGE
}

while (($#)); do
  case "$1" in
    --dry-run) SYNC_MODE="DRY_RUN"; DRY_RUN="true" ;;
    --apply) SYNC_MODE="APPLY"; DRY_RUN="false" ;;
    --namespace) NAMESPACE="${2:?missing namespace}"; shift ;;
    --database) DATABASE="${2:?missing database}"; shift ;;
    --executed-by) EXECUTED_BY="${2:?missing executed-by}"; shift ;;
    --emit-only) EMIT_ONLY="${2:?missing output path}"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage >&2; exit 2 ;;
  esac
  shift
done

for value in "$NAMESPACE" "$DATABASE" "$EXECUTED_BY"; do
  [[ "$value" =~ ^[A-Za-z0-9._:@-]+$ ]] || {
    echo "Unsafe option value: $value" >&2
    exit 2
  }
done

[[ -f "$EXPORTER" ]] || { echo "Missing exporter: $EXPORTER" >&2; exit 2; }
[[ -f "$SYNC_SQL" ]] || { echo "Missing sync SQL: $SYNC_SQL" >&2; exit 2; }
command -v node >/dev/null || { echo "node is required" >&2; exit 2; }

TEMP_DIR="$(mktemp -d)"
trap 'rm -rf -- "$TEMP_DIR"' EXIT
SUMMARY_FILE="${TEMP_DIR}/summary.json"
VALUES_FILE="${TEMP_DIR}/routes.values.sql"
GENERATED_SQL="${TEMP_DIR}/route-policy-sync.sql"

node "$EXPORTER" --repo-root "$REPO_ROOT" --format summary --out "$SUMMARY_FILE"
node "$EXPORTER" --repo-root "$REPO_ROOT" --format sql-values --out "$VALUES_FILE"

read -r RAW_COUNT CANONICAL_COUNT COLLISION_COUNT FAMILY_COUNT < <(
  node -e '
    const fs=require("node:fs");
    const value=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
    process.stdout.write([value.rawRouteCount,value.canonicalRouteCount,
      value.canonicalCollisionCount,value.familyFileCount].join(" ")+"\n");
  ' "$SUMMARY_FILE"
)

{
  printf '\\set sync_mode %s\n' "'$SYNC_MODE'"
  printf '\\set dry_run %s\n' "$DRY_RUN"
  printf '\\set raw_route_count %s\n' "$RAW_COUNT"
  printf '\\set canonical_collision_count %s\n' "$COLLISION_COUNT"
  printf '\\set executed_by %s\n' "'$EXECUTED_BY'"
  cat <<'SQL'
CREATE TEMP TABLE frontend_route_registry_input (
  route_key varchar(500) PRIMARY KEY,
  route_id varchar(200) NOT NULL,
  screen_name varchar(500) NOT NULL,
  family_file text NOT NULL,
  source_path text NOT NULL,
  ko_path varchar(500) NOT NULL,
  en_path varchar(500) NOT NULL,
  aliases jsonb NOT NULL
) ON COMMIT PRESERVE ROWS;
INSERT INTO frontend_route_registry_input(
  route_key,route_id,screen_name,family_file,source_path,ko_path,en_path,aliases
) VALUES
SQL
  cat "$VALUES_FILE"
  printf ';\n'
  cat "$SYNC_SQL"
} > "$GENERATED_SQL"

echo "[route-policy] mode=$SYNC_MODE raw=$RAW_COUNT canonical=$CANONICAL_COUNT aliases=$COLLISION_COUNT families=$FAMILY_COUNT" >&2

if [[ -n "$EMIT_ONLY" ]]; then
  mkdir -p -- "$(dirname -- "$EMIT_ONLY")"
  cp -- "$GENERATED_SQL" "$EMIT_ONLY"
  echo "[route-policy] generated=$EMIT_ONLY" >&2
  exit 0
fi

command -v kubectl >/dev/null || { echo "kubectl is required" >&2; exit 2; }
DISCOVERY_POD="$(kubectl -n "$NAMESPACE" get pods -o name \
  | sed -n 's#^pod/\(postgres-patroni-[0-9][0-9]*\)$#\1#p' | sort | head -n 1)"
[[ -n "$DISCOVERY_POD" ]] || { echo "No Patroni pod found" >&2; exit 3; }
LEADER_POD="$(kubectl -n "$NAMESPACE" exec "$DISCOVERY_POD" -c patroni -- \
  patronictl list 2>/dev/null \
  | awk -F'|' '$4 ~ /Leader/ {gsub(/[[:space:]]/,"",$2); print $2; exit}')"
[[ -n "$LEADER_POD" ]] || { echo "Patroni leader was not resolved" >&2; exit 3; }

kubectl -n "$NAMESPACE" exec -i "$LEADER_POD" -c patroni -- \
  psql -h 127.0.0.1 -U postgres -d "$DATABASE" < "$GENERATED_SQL"
