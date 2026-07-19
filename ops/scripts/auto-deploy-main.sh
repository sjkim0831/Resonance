#!/usr/bin/env bash
set -euo pipefail

# Agent policy is deterministic and must pass before any model-generated change can deploy.
bash "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/ops/scripts/verify-kilo-m3-policy.sh"
bash "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/ops/scripts/verify-hermes-nvidia-two-tier.sh"
bash "$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)/ops/scripts/verify-hermes-project-work-policy.sh"

ROOT_DIR="${CARBONET_DEPLOY_ROOT:-/opt/Resonance}"
BRANCH="${CARBONET_DEPLOY_BRANCH:-main}"
REMOTE="${CARBONET_DEPLOY_REMOTE:-origin}"
LOCK_FILE="${CARBONET_DEPLOY_LOCK_FILE:-/tmp/carbonet-auto-deploy.lock}"
DEPLOY_STATE_FILE="${CARBONET_DEPLOY_STATE_FILE:-/opt/resonance-data/deploy/carbonet-main-success.commit}"
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

mkdir -p "$(dirname "$LOCK_FILE")" "$BACKUP_DIR" "$(dirname "$DEPLOY_STATE_FILE")"
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
deployed_commit="$(cat "$DEPLOY_STATE_FILE" 2>/dev/null || true)"
if ! git cat-file -e "${deployed_commit}^{commit}" 2>/dev/null; then
  deployed_commit="$current_commit"
fi

if [[ "$deployed_commit" == "$target_commit" ]]; then
  echo "[auto-deploy] already deployed: $deployed_commit"
  exit 0
fi

eval "$(bash ops/scripts/plan-incremental-work.sh "$deployed_commit" "$target_commit" --format env)"
echo "[auto-deploy] incremental plan: runtime=$PLAN_RUNTIME_REQUIRED frontend=$PLAN_FRONTEND_REQUIRED backend=$PLAN_BACKEND_REQUIRED database=$PLAN_DATABASE_REQUIRED"
echo "[auto-deploy] selected checks: $PLAN_TESTS ($PLAN_REASONS)"

root_usage="$(df -P / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')"
if [[ "$root_usage" -ge 88 ]]; then
  echo "[auto-deploy] root usage ${root_usage}%: pruning unused Docker images before build"
  sudo docker image prune -a -f >/dev/null
  sudo apt-get clean
  root_usage="$(df -P / | awk 'NR==2 {gsub(/%/,"",$5); print $5}')"
fi
if [[ "$root_usage" -ge 88 ]]; then
  echo "[auto-deploy] refusing deployment: root disk usage remains ${root_usage}%" >&2
  exit 16
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

# Documentation, design metadata, catalog and automation-only changes do not
# alter the running application. Fast-forward and refresh the searchable source
# catalog without an unnecessary DB dump, JVM build, image build or rollout.
if [[ "$PLAN_RUNTIME_REQUIRED" != "true" ]]; then
  git merge --ff-only "$target_commit"
  while IFS= read -r changed_script; do
    [[ "$changed_script" == *.sh && -f "$changed_script" ]] && bash -n "$changed_script"
  done < <(git diff --name-only --diff-filter=ACMR "$deployed_commit" "$target_commit")
  bash ops/scripts/sync-unified-asset-catalog.sh
  bash ops/scripts/validate-e4b-selectable-assets.sh
  printf '%s\n' "$target_commit" > "${DEPLOY_STATE_FILE}.tmp"
  mv "${DEPLOY_STATE_FILE}.tmp" "$DEPLOY_STATE_FILE"
  echo "[auto-deploy] catalog-only update completed without application rollout: $target_commit"
  exit 0
fi

timestamp="$(date '+%Y%m%d-%H%M%S')"
backup_file="$BACKUP_DIR/carbonet-$timestamp-$current_commit.sql.gz"
roles_backup_file="$BACKUP_DIR/postgres-roles-$timestamp-$current_commit.sql.gz"
backup_required="$PLAN_DATABASE_REQUIRED"
[[ "${CARBONET_FORCE_PREDEPLOY_BACKUP:-false}" == "true" ]] && backup_required=true
menu_backup_only=false
governance_backup_only=false
activity_backup_only=false
if [[ "$PLAN_DATABASE_REQUIRED" == "true" && "${CARBONET_FORCE_PREDEPLOY_BACKUP:-false}" != "true" ]]; then
  database_change_files="$(git diff --name-only "$deployed_commit" "$target_commit" -- \
    apps/carbonet-api/src/main/resources/db/migration/postgresql)"
  if [[ -n "$database_change_files" ]] && ! grep -Evi '/[^/]*(menu|navigation)[^/]*\.sql$' <<<"$database_change_files" | grep -q .; then
    menu_backup_only=true
  elif [[ -n "$database_change_files" ]] && ! grep -Evi '/[^/]*(actor|process|governance|delivery|workflow|handoff|notification|assignment|assignee|emission_site|onboarding)[^/]*\.sql$' <<<"$database_change_files" | grep -q .; then
    governance_backup_only=true
  elif [[ -n "$database_change_files" ]] && ! grep -Evi '/[^/]*(activity|submission|quality|evidence|collection|acceptance|accepted|calculation|factor|mapping)[^/]*\.sql$' <<<"$database_change_files" | grep -q .; then
    activity_backup_only=true
  fi
fi
if [[ "$backup_required" == "true" ]]; then
  if [[ "$menu_backup_only" == "true" ]]; then
    backup_file="$BACKUP_DIR/carbonet-menu-$timestamp-$current_commit.sql.gz"
    echo "[auto-deploy] menu-only migration detected; creating targeted transactional backup"
    if ! timeout --signal=TERM --kill-after=30s "$BACKUP_TIMEOUT_SECONDS" \
      kubectl -n "$NAMESPACE" exec "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
        env "PGOPTIONS=-c statement_timeout=${BACKUP_TIMEOUT_SECONDS}s -c lock_timeout=30s" \
        pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges \
          -h 127.0.0.1 -t comtnmenuinfo -t comtccmmndetailcode \
      | gzip -1 > "$backup_file"; then
      rm -f "$backup_file"
      echo "[auto-deploy] refusing deployment: targeted menu backup failed" >&2
      exit 14
    fi
    backup_bytes="$(stat -c %s "$backup_file")"
    if [[ "$backup_bytes" -lt 1024 ]] || ! gzip -t "$backup_file"; then
      rm -f "$backup_file"
      echo "[auto-deploy] refusing deployment: targeted menu backup is invalid (${backup_bytes} bytes)" >&2
      exit 11
    fi
    echo "[auto-deploy] targeted menu backup verified: $backup_file (${backup_bytes} bytes)"
  elif [[ "$governance_backup_only" == "true" ]]; then
    backup_file="$BACKUP_DIR/carbonet-governance-$timestamp-$current_commit.sql.gz"
    echo "[auto-deploy] governance-only migration detected; creating targeted transactional backup"
    if ! timeout --signal=TERM --kill-after=30s "$BACKUP_TIMEOUT_SECONDS" \
      kubectl -n "$NAMESPACE" exec "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
        env "PGOPTIONS=-c statement_timeout=${BACKUP_TIMEOUT_SECONDS}s -c lock_timeout=30s" \
        pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges -h 127.0.0.1 \
          -t framework_actor_definition -t framework_account_actor_assignment \
          -t framework_process_definition -t framework_process_step \
          -t framework_simulation_case -t framework_simulation_run \
          -t framework_development_job -t framework_process_artifact \
          -t framework_project_actor_assignment \
          -t emission_project_registry -t emission_project_task \
          -t emission_project_history -t emission_workflow_notification \
          -t ui_component_registry -t ui_section_registry \
          -t framework_design_asset_registry \
      | gzip -1 > "$backup_file"; then
      rm -f "$backup_file"
      echo "[auto-deploy] refusing deployment: targeted governance backup failed" >&2
      exit 14
    fi
    backup_bytes="$(stat -c %s "$backup_file")"
    if [[ "$backup_bytes" -lt 1024 ]] || ! gzip -t "$backup_file"; then
      rm -f "$backup_file"
      echo "[auto-deploy] refusing deployment: targeted governance backup is invalid (${backup_bytes} bytes)" >&2
      exit 11
    fi
    echo "[auto-deploy] targeted governance backup verified: $backup_file (${backup_bytes} bytes)"
  elif [[ "$activity_backup_only" == "true" ]]; then
    backup_file="$BACKUP_DIR/carbonet-activity-$timestamp-$current_commit.sql.gz"
    echo "[auto-deploy] activity-workflow migration detected; creating targeted transactional backup"
    if ! timeout --signal=TERM --kill-after=30s "$BACKUP_TIMEOUT_SECONDS" \
      kubectl -n "$NAMESPACE" exec "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
        env "PGOPTIONS=-c statement_timeout=${BACKUP_TIMEOUT_SECONDS}s -c lock_timeout=30s" \
        pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" --no-owner --no-privileges -h 127.0.0.1 \
          -t emission_activity_request -t emission_activity_request_event \
          -t emission_activity_data -t emission_activity_quality_run -t emission_activity_quality_issue \
          -t emission_activity_submission -t emission_activity_submission_item \
          -t emission_activity_submission_evidence -t emission_activity_submission_event \
          -t emission_factor_reference -t emission_factor_mapping_decision \
          -t emission_calculation_run -t emission_calculation_item \
          -t emission_project_task -t emission_project_history -t emission_workflow_notification \
      | gzip -1 > "$backup_file"; then
      rm -f "$backup_file"
      echo "[auto-deploy] refusing deployment: targeted activity-workflow backup failed" >&2
      exit 14
    fi
    backup_bytes="$(stat -c %s "$backup_file")"
    if [[ "$backup_bytes" -lt 1024 ]] || ! gzip -t "$backup_file"; then
      rm -f "$backup_file"
      echo "[auto-deploy] refusing deployment: targeted activity-workflow backup is invalid (${backup_bytes} bytes)" >&2
      exit 11
    fi
    echo "[auto-deploy] targeted activity-workflow backup verified: $backup_file (${backup_bytes} bytes)"
  else
  echo "[auto-deploy] database migration detected; creating full pre-deploy backup"
  echo "[auto-deploy] backing up PostgreSQL roles to $roles_backup_file"
  if ! timeout --signal=TERM --kill-after=30s "$BACKUP_TIMEOUT_SECONDS" \
    kubectl -n "$NAMESPACE" exec "$POSTGRES_POD" -c "$POSTGRES_CONTAINER" -- \
      env "PGOPTIONS=-c statement_timeout=${BACKUP_TIMEOUT_SECONDS}s -c lock_timeout=30s" \
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
      env "PGOPTIONS=-c statement_timeout=${BACKUP_TIMEOUT_SECONDS}s -c lock_timeout=30s" \
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
  fi
else
  echo "[auto-deploy] database backup skipped: no schema migration in selected work"
fi

# Backend-only and migration-only commits reuse the last verified immutable
# frontend closure. Rebuilding TypeScript for such commits creates avoidable
# I/O pressure and can starve the running Kubernetes workloads.
skip_frontend=true
[[ "$PLAN_FRONTEND_REQUIRED" == "true" ]] && skip_frontend=false
echo "[auto-deploy] frontend build required: $([[ "$skip_frontend" == "true" ]] && echo no || echo yes)"

git merge --ff-only "$target_commit"
bash ops/scripts/validate-deterministic-development-policy.sh

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
health_status="$(curl -fsS --max-time 10 http://127.0.0.1/actuator/health || true)"
if [[ "$health_status" != *'"status":"UP"'* ]]; then
  echo "[auto-deploy] refusing success marker: health check is not UP" >&2
  exit 17
fi
bash ops/scripts/validate-admin-menu-coverage.sh
bash ops/scripts/validate-home-menu-coverage.sh
bash ops/scripts/sync-unified-asset-catalog.sh
bash ops/scripts/validate-e4b-selectable-assets.sh
bash ops/scripts/validate-emission-project-workflow.sh
bash ops/scripts/validate-emission-activity-collection.sh
bash ops/scripts/complete-activity-data-evidence-jobs.sh
bash ops/scripts/validate-activity-workflow-links.sh
bash ops/scripts/validate-activity-data-runtime.sh
bash ops/scripts/complete-emission-calculation-evidence-jobs.sh
bash ops/scripts/validate-emission-calculation-runtime.sh
bash ops/scripts/complete-report-certification-evidence-jobs.sh
bash ops/scripts/validate-report-certification-runtime.sh
bash ops/scripts/validate-customer-work-journey.sh
bash ops/scripts/validate-actor-account-customer-journey.sh
bash ops/scripts/validate-design-direct-development.sh
bash ops/scripts/validate-common-design-assets.sh
bash ops/scripts/validate-project-auto-completion.sh
printf '%s\n' "$target_commit" > "${DEPLOY_STATE_FILE}.tmp"
mv "${DEPLOY_STATE_FILE}.tmp" "$DEPLOY_STATE_FILE"
sudo docker image prune -a -f >/dev/null || true
echo "[auto-deploy] deployed $target_commit with Flyway enabled"
