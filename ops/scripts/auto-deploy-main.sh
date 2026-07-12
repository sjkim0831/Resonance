#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${CARBONET_DEPLOY_ROOT:-/opt/Resonance}"
BRANCH="${CARBONET_DEPLOY_BRANCH:-main}"
REMOTE="${CARBONET_DEPLOY_REMOTE:-origin}"
LOCK_FILE="${CARBONET_DEPLOY_LOCK_FILE:-/tmp/carbonet-auto-deploy.lock}"
BACKUP_DIR="${CARBONET_DB_BACKUP_DIR:-/opt/resonance-backups/postgresql/pre-deploy}"
NAMESPACE="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"
DEPLOYMENT="${CARBONET_K8S_DEPLOYMENT:-carbonet-runtime}"
POSTGRES_POD="${CARBONET_POSTGRES_POD:-postgres-patroni-0}"
POSTGRES_CONTAINER="${CARBONET_POSTGRES_CONTAINER:-patroni}"
POSTGRES_DB="${POSTGRES_DB:-carbonet}"
POSTGRES_USER="${POSTGRES_ADMIN_USER:-postgres}"
MIN_BACKUP_BYTES="${CARBONET_MIN_BACKUP_BYTES:-1048576}"

mkdir -p "$(dirname "$LOCK_FILE")" "$BACKUP_DIR"
exec 9>"$LOCK_FILE"
flock -n 9 || { echo "[auto-deploy] another deployment is running"; exit 0; }

cd "$ROOT_DIR"

postgres_data_path="$(kubectl -n "$NAMESPACE" get statefulset postgres-patroni \
  -o jsonpath='{.spec.template.spec.volumes[?(@.name=="patroni-data-root")].hostPath.path}' 2>/dev/null || true)"
postgres_wal_path="$(kubectl -n "$NAMESPACE" get statefulset postgres-patroni \
  -o jsonpath='{.spec.template.spec.volumes[?(@.name=="wal-archive")].hostPath.path}' 2>/dev/null || true)"
for protected_path in "$postgres_data_path" "$postgres_wal_path"; do
  if [[ -z "$protected_path" || "$protected_path" == "$ROOT_DIR"/* || "$protected_path" != /opt/resonance-data/postgresql/* ]]; then
    echo "[auto-deploy] refusing deployment: PostgreSQL storage is not isolated ($protected_path)" >&2
    exit 9
  fi
done

# A deployment must never continue while the HA database has no elected,
# writable leader. Without this gate pg_dump can emit only an empty gzip
# header and the rollout then replaces healthy application pods with pods
# that cannot connect to PostgreSQL.
ready_patroni="$(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni \
  -o jsonpath='{range .items[*]}{.status.containerStatuses[0].ready}{"\n"}{end}' 2>/dev/null | grep -c '^true$' || true)"
if [[ "$ready_patroni" -lt 2 ]]; then
  echo "[auto-deploy] refusing deployment: Patroni quorum is not ready ($ready_patroni/3)" >&2
  exit 10
fi
git fetch --prune "$REMOTE" "$BRANCH"
target_commit="$(git rev-parse "$REMOTE/$BRANCH")"
current_commit="$(git rev-parse HEAD)"

if [[ "$current_commit" == "$target_commit" ]]; then
  echo "[auto-deploy] already current: $current_commit"
  exit 0
fi

tracked_source_changes="$(git diff --name-only -- \
  . \
  ':(exclude).gradle/**' \
  ':(exclude)projects/carbonet-assets/static/react-app/**' \
  ':(exclude)projects/carbonet-backend-metadata/builder/platform-builder-store.json' \
  ':(exclude)projects/carbonet-backend-metadata/customer-trace/customer-approval-ledger.json' \
  ':(exclude)projects/carbonet-frontend/src/main/resources/static/react-app/**' \
  ':(exclude)projects/carbonet-frontend/source/src/features/builder-studio/pageCompletenessInventory.ts' \
  ':(exclude)projects/carbonet-frontend/source/src/features/builder-studio/routeSourceInventory.ts' \
  ':(exclude)projects/carbonet-frontend/source/tsconfig.app.tsbuildinfo' \
  ':(exclude)projects/carbonet-frontend/target/**')"
if [[ -n "$tracked_source_changes" ]]; then
  echo "[auto-deploy] refusing deployment: tracked server files are modified" >&2
  printf '%s\n' "$tracked_source_changes" >&2
  exit 2
fi

if ! git merge-base --is-ancestor "$current_commit" "$target_commit"; then
  echo "[auto-deploy] refusing non-fast-forward update: $current_commit -> $target_commit" >&2
  exit 3
fi

# The standard build updates tracked generated bundles and Gradle state. They are
# deployment artifacts, not server-authored source changes, so restore only these
# known paths before the fast-forward merge.
git restore --worktree -- \
  .gradle \
  projects/carbonet-assets/static/react-app \
  projects/carbonet-backend-metadata/builder/platform-builder-store.json \
  projects/carbonet-backend-metadata/customer-trace/customer-approval-ledger.json \
  projects/carbonet-frontend/src/main/resources/static/react-app \
  projects/carbonet-frontend/source/src/features/builder-studio/pageCompletenessInventory.ts \
  projects/carbonet-frontend/source/src/features/builder-studio/routeSourceInventory.ts \
  projects/carbonet-frontend/source/tsconfig.app.tsbuildinfo \
  projects/carbonet-frontend/target 2>/dev/null || true

timestamp="$(date '+%Y%m%d-%H%M%S')"
backup_file="$BACKUP_DIR/carbonet-$timestamp-$current_commit.sql.gz"
echo "[auto-deploy] backing up database to $backup_file"
kubectl -n "$NAMESPACE" exec "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
  pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges \
    -h 127.0.0.1 \
  | gzip -1 > "$backup_file"
test -s "$backup_file"
backup_bytes="$(stat -c %s "$backup_file")"
if [[ "$backup_bytes" -lt "$MIN_BACKUP_BYTES" ]] || ! gzip -t "$backup_file"; then
  rm -f "$backup_file"
  echo "[auto-deploy] refusing deployment: database backup is invalid or too small (${backup_bytes} bytes)" >&2
  exit 11
fi

git merge --ff-only "$target_commit"

# Flyway is the only schema migration owner. Liquibase stays disabled to avoid
# two migration engines changing the same schema during a rollout.
kubectl -n "$NAMESPACE" set env deployment/"$DEPLOYMENT" \
  CARBONET_FLYWAY_ENABLED=true \
  CARBONET_LIQUIBASE_ENABLED=false

IMMUTABLE_FRONTEND_IMAGE=true \
SKIP_NOTIFY="${SKIP_NOTIFY:-true}" \
  bash ops/scripts/resonance-k8s-build-deploy-80-v2.sh

kubectl -n "$NAMESPACE" rollout status deployment/"$DEPLOYMENT" --timeout=600s
echo "[auto-deploy] deployed $target_commit with Flyway enabled"
