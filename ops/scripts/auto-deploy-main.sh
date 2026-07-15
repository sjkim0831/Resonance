#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${CARBONET_DEPLOY_ROOT:-/opt/Resonance}"
BRANCH="${CARBONET_DEPLOY_BRANCH:-main}"
REMOTE="${CARBONET_DEPLOY_REMOTE:-origin}"
LOCK_FILE="${CARBONET_DEPLOY_LOCK_FILE:-/tmp/carbonet-auto-deploy.lock}"
BACKUP_DIR="${CARBONET_DB_BACKUP_DIR:-/opt/resonance-backups/postgresql/pre-deploy}"
NAMESPACE="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"
DEPLOYMENT="${CARBONET_K8S_DEPLOYMENT:-carbonet-runtime}"
POSTGRES_POD="${CARBONET_POSTGRES_POD:-}"
POSTGRES_CONTAINER="${CARBONET_POSTGRES_CONTAINER:-patroni}"
POSTGRES_DB="${POSTGRES_DB:-carbonet}"
POSTGRES_USER="${POSTGRES_ADMIN_USER:-postgres}"
MIN_BACKUP_BYTES="${CARBONET_MIN_BACKUP_BYTES:-1048576}"
BACKUP_TIMEOUT_SECONDS="${CARBONET_BACKUP_TIMEOUT_SECONDS:-1200}"
KUBECONFIG="${CARBONET_KUBECONFIG:-${KUBECONFIG:-/home/sjkim/.kube/config}}"
export KUBECONFIG

if [[ ! -r "$KUBECONFIG" ]]; then
  echo "[auto-deploy] refusing deployment: kubeconfig is not readable ($KUBECONFIG)" >&2
  exit 8
fi

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

# Readiness alone is insufficient: a running Patroni process can report a
# recoverable state after its hostPath was unlinked. Require the PostgreSQL
# control marker on every member before any backup or rollout is attempted.
while IFS= read -r candidate; do
  if ! kubectl -n "$NAMESPACE" exec "$candidate" -c "$POSTGRES_CONTAINER" -- \
    test -s "/home/postgres/pgdata/${candidate}/pgroot/data/PG_VERSION"; then
    echo "[auto-deploy] refusing deployment: PostgreSQL data directory is missing on $candidate" >&2
    exit 15
  fi
done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name | sed 's#^pod/##')

# Patroni can promote any ordinal. Never assume postgres-patroni-0 is the
# writable leader: pg_dump on a recovering replica can be cancelled by WAL
# replay and would unnecessarily block every deployment.
if [[ -z "$POSTGRES_POD" ]]; then
  while IFS= read -r candidate; do
    if [[ "$(kubectl -n "$NAMESPACE" exec "$candidate" -c "$POSTGRES_CONTAINER" -- \
      psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)" == "f" ]]; then
      POSTGRES_POD="$candidate"
      break
    fi
  done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name | sed 's#^pod/##')
fi
if [[ -z "$POSTGRES_POD" ]]; then
  echo "[auto-deploy] refusing deployment: writable PostgreSQL leader was not found" >&2
  exit 12
fi
echo "[auto-deploy] PostgreSQL backup leader: $POSTGRES_POD"
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
generated_paths=(
  .gradle
  projects/carbonet-assets/static/react-app
  projects/carbonet-backend-metadata/builder/platform-builder-store.json
  projects/carbonet-backend-metadata/customer-trace/customer-approval-ledger.json
  projects/carbonet-frontend/src/main/resources/static/react-app
  projects/carbonet-frontend/source/src/features/builder-studio/pageCompletenessInventory.ts
  projects/carbonet-frontend/source/src/features/builder-studio/routeSourceInventory.ts
  projects/carbonet-frontend/source/tsconfig.app.tsbuildinfo
  projects/carbonet-frontend/target
)
for generated_path in "${generated_paths[@]}"; do
  # A missing/ignored path must not cancel restoration of every later path.
  # This was the cause of repeated merge failures after successful builds.
  if git ls-files -- "$generated_path" | grep -q .; then
    git restore --worktree -- "$generated_path"
  fi
done

remaining_generated_changes="$(git diff --name-only -- "${generated_paths[@]}")"
if [[ -n "$remaining_generated_changes" ]]; then
  echo "[auto-deploy] refusing deployment: generated files could not be restored" >&2
  printf '%s\n' "$remaining_generated_changes" >&2
  exit 13
fi

timestamp="$(date '+%Y%m%d-%H%M%S')"
backup_file="$BACKUP_DIR/carbonet-$timestamp-$current_commit.sql.gz"
roles_backup_file="$BACKUP_DIR/postgres-roles-$timestamp-$current_commit.sql.gz"
echo "[auto-deploy] backing up PostgreSQL roles to $roles_backup_file"
if ! timeout --signal=TERM --kill-after=30s "$BACKUP_TIMEOUT_SECONDS" \
  kubectl -n "$NAMESPACE" exec "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
    pg_dumpall -U "$POSTGRES_USER" --roles-only -h 127.0.0.1 \
  | gzip -1 > "$roles_backup_file"; then
  rm -f "$roles_backup_file"
  echo "[auto-deploy] refusing deployment: PostgreSQL role backup failed" >&2
  exit 16
fi
if [[ "$(stat -c %s "$roles_backup_file")" -lt 100 ]] || ! gzip -t "$roles_backup_file"; then
  rm -f "$roles_backup_file"
  echo "[auto-deploy] refusing deployment: PostgreSQL role backup is invalid" >&2
  exit 17
fi
echo "[auto-deploy] backing up database to $backup_file"
if ! timeout --signal=TERM --kill-after=30s "$BACKUP_TIMEOUT_SECONDS" \
  kubectl -n "$NAMESPACE" exec "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
    pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges \
      -h 127.0.0.1 \
  | gzip -1 > "$backup_file"; then
  rm -f "$backup_file"
  echo "[auto-deploy] refusing deployment: database backup failed or exceeded ${BACKUP_TIMEOUT_SECONDS}s" >&2
  exit 14
fi
test -s "$backup_file"
backup_bytes="$(stat -c %s "$backup_file")"
if [[ "$backup_bytes" -lt "$MIN_BACKUP_BYTES" ]] || ! gzip -t "$backup_file"; then
  rm -f "$backup_file"
  echo "[auto-deploy] refusing deployment: database backup is invalid or too small (${backup_bytes} bytes)" >&2
  exit 11
fi

# Backend-only and migration-only commits reuse the last verified immutable
# frontend closure. Rebuilding TypeScript for such commits creates avoidable
# I/O pressure and can starve the running Kubernetes workloads.
skip_frontend=true
while IFS= read -r changed_path; do
  case "$changed_path" in
    projects/carbonet-frontend/source/*|projects/carbonet-frontend/src/main/resources/static/*|projects/carbonet-assets/*|frontend/*)
      skip_frontend=false
      break
      ;;
  esac
done < <(git diff --name-only "$current_commit" "$target_commit")
echo "[auto-deploy] frontend build required: $([[ "$skip_frontend" == "true" ]] && echo no || echo yes)"

git merge --ff-only "$target_commit"

# Flyway is the only schema migration owner. Liquibase stays disabled to avoid
# two migration engines changing the same schema during a rollout.
kubectl -n "$NAMESPACE" set env deployment/"$DEPLOYMENT" \
  CARBONET_FLYWAY_ENABLED=true \
  CARBONET_LIQUIBASE_ENABLED=false

IMMUTABLE_FRONTEND_IMAGE=true \
SKIP_FRONTEND="$skip_frontend" \
SKIP_NOTIFY="${SKIP_NOTIFY:-true}" \
  bash ops/scripts/resonance-k8s-build-deploy-80-v2.sh

kubectl -n "$NAMESPACE" rollout status deployment/"$DEPLOYMENT" --timeout=600s
echo "[auto-deploy] deployed $target_commit with Flyway enabled"
