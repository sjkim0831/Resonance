#!/usr/bin/env bash
set -Eeuo pipefail
umask 027

ROOT="${RESONANCE_ROOT:-/opt/resonance-data/control-plane/source}"
WORKSPACE_ROOT="${RESONANCE_PROJECT_WORKSPACE_ROOT:-/opt/resonance-data/project-workspaces}"
NAMESPACE="${BACKSTAGE_NAMESPACE:-resonance-ops}"
DB_NAMESPACE="${BACKSTAGE_DB_NAMESPACE:-carbonet-prod}"
DB_NAME="${BACKSTAGE_PROJECT_DB:-backstage_plugin_resonance-projects}"
WORKER_ID="${HOSTNAME:-unknown}:$$"
TASK_ID=""
PROJECT_ID=""
STAGING=""

require() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "[project-bootstrap] missing command: $1" >&2
    exit 1
  }
}
for command in kubectl jq node base64 sha256sum install; do require "$command"; done

DB_USER="$(kubectl -n "$NAMESPACE" get secret resonance-backstage-database \
  -o jsonpath='{.data.POSTGRES_USER}' | base64 -d)"
DB_PASSWORD="$(kubectl -n "$NAMESPACE" get secret resonance-backstage-database \
  -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d)"
DB_POD="$(kubectl -n "$DB_NAMESPACE" get pods -l app=postgres-patroni \
  -o jsonpath='{.items[0].metadata.name}')"
[[ -n "$DB_USER" && -n "$DB_PASSWORD" && -n "$DB_POD" ]] || {
  echo "[project-bootstrap] database binding is unavailable" >&2
  exit 2
}

db_sql() {
  local sql="$1"
  kubectl -n "$DB_NAMESPACE" exec "$DB_POD" -c patroni -- \
    env PGPASSWORD="$DB_PASSWORD" psql \
    -h postgres-haproxy.carbonet-prod.svc.cluster.local \
    -U "$DB_USER" -d "$DB_NAME" -v ON_ERROR_STOP=1 -Atq -c "$sql"
}

fail_task() {
  local exit_code=$?
  trap - ERR
  [[ -n "$STAGING" && "$STAGING" == "$WORKSPACE_ROOT/.staging/"* ]] &&
    rm -rf -- "$STAGING"
  if [[ -n "$TASK_ID" && "$TASK_ID" =~ ^[0-9]+$ ]]; then
    local message encoded
    message="bootstrap failed at line ${BASH_LINENO[0]:-unknown} (exit $exit_code)"
    encoded="$(printf '%s' "$message" | base64 -w0)"
    db_sql "
      update resonance_projects__task
         set status='FAILED',
             error_message=convert_from(decode('$encoded','base64'),'UTF8'),
             finished_at=now(),
             updated_at=now()
       where task_id=$TASK_ID and status='RUNNING';
      update resonance_projects__project
         set status='BOOTSTRAP_FAILED', updated_at=now()
       where project_id='$PROJECT_ID';
    " >/dev/null || true
  fi
  echo "[project-bootstrap] failed task=${TASK_ID:-none} project=${PROJECT_ID:-none}" >&2
  exit "$exit_code"
}
trap fail_task ERR

mkdir -p "$WORKSPACE_ROOT/.staging"

# A crashed oneshot cannot leave work permanently RUNNING. The timer safely
# retries only stale claims; a live run never overlaps because systemd does not
# start a second instance of the same oneshot unit.
db_sql "
  update resonance_projects__task
     set status='RETRY', worker_id=null, error_message='Recovered stale worker claim',
         updated_at=now()
   where task_type='PROJECT_BOOTSTRAP' and status='RUNNING'
     and started_at < now() - interval '30 minutes';
" >/dev/null

CLAIM="$(db_sql "
  with next_task as (
    select task_id
      from resonance_projects__task
     where task_type='PROJECT_BOOTSTRAP' and status in ('PLANNED','RETRY')
     order by task_id
     for update skip locked
     limit 1
  ), claimed as (
    update resonance_projects__task task
       set status='RUNNING', worker_id='$WORKER_ID',
           attempt_count=coalesce(attempt_count,0)+1,
           started_at=now(), finished_at=null, error_message=null, updated_at=now()
      from next_task
     where task.task_id=next_task.task_id
     returning task.task_id, task.project_id
  )
  select task_id || '|' || project_id from claimed;
")"

if [[ -z "$CLAIM" ]]; then
  echo "[project-bootstrap] no planned work"
  exit 0
fi
IFS='|' read -r TASK_ID PROJECT_ID <<<"$CLAIM"
[[ "$TASK_ID" =~ ^[0-9]+$ && "$PROJECT_ID" =~ ^[A-Z][A-Z0-9_-]{2,63}$ ]]

db_sql "
  update resonance_projects__project
     set status='BOOTSTRAPPING', updated_at=now()
   where project_id='$PROJECT_ID';
" >/dev/null

PROJECT_B64="$(db_sql "
  select encode(convert_to(row_to_json(project_row)::text,'UTF8'),'base64')
    from (
      select project_id, project_name, description, owner, source_repository,
             database_mode, runtime_mode, design_version
        from resonance_projects__project
       where project_id='$PROJECT_ID'
    ) project_row;
")"
PROJECT_JSON="$(printf '%s' "$PROJECT_B64" | base64 -d)"
[[ "$(jq -r '.project_id // empty' <<<"$PROJECT_JSON")" == "$PROJECT_ID" ]]

FINAL="$WORKSPACE_ROOT/$PROJECT_ID"
STAGING="$WORKSPACE_ROOT/.staging/${PROJECT_ID}-${TASK_ID}"
rm -rf -- "$STAGING"
install -d -m 0750 \
  "$STAGING/design" "$STAGING/frontend" "$STAGING/backend" \
  "$STAGING/db" "$STAGING/tests" "$STAGING/ops"

PROJECT_NAME="$(jq -r '.project_name' <<<"$PROJECT_JSON")"
OWNER="$(jq -r '.owner' <<<"$PROJECT_JSON")"
DESCRIPTION="$(jq -r '.description' <<<"$PROJECT_JSON")"
DATABASE_MODE="$(jq -r '.database_mode' <<<"$PROJECT_JSON")"
RUNTIME_MODE="$(jq -r '.runtime_mode' <<<"$PROJECT_JSON")"
SOURCE_REPOSITORY="$(jq -r '.source_repository' <<<"$PROJECT_JSON")"
PROJECT_SLUG="$(tr '[:upper:]_' '[:lower:]-' <<<"$PROJECT_ID")"
DB_SCHEMA="project_$(tr '[:upper:]-' '[:lower:]_' <<<"$PROJECT_ID")"

jq -n \
  --arg id "$PROJECT_ID" --arg name "$PROJECT_NAME" --arg description "$DESCRIPTION" \
  --arg owner "$OWNER" --arg dbMode "$DATABASE_MODE" --arg runtimeMode "$RUNTIME_MODE" \
  --arg schema "$DB_SCHEMA" --arg slug "$PROJECT_SLUG" --arg source "$SOURCE_REPOSITORY" \
  '{
    schemaVersion: 1,
    metadata: {projectId:$id, projectName:$name, description:$description, owner:$owner},
    bindings: {
      database: {
        bindingMode:$dbMode,
        projectDb:{url:("jdbc:postgresql://postgres-haproxy.carbonet-prod.svc.cluster.local:5432/"+$id),schema:$schema}
      },
      theme:{id:"krds-default"},
      menu:{source:"database", projectId:$id}
    },
    runtime: {
      packagePath:("projects/"+$id),
      manifestPath:("projects/"+$id+"/manifest.json"),
      runtimeMode:$runtimeMode,
      routing:{routePrefix:("/projects/"+$slug),infoPath:("/projects/"+$slug+"/info")}
    },
    source:{repository:$source}
  }' >"$STAGING/manifest.json"

jq -n --arg id "$PROJECT_ID" --arg name "$PROJECT_NAME" \
  '{schemaVersion:1,projectId:$id,projectName:$name,designVersion:1,model:"Actor -> Process -> Step -> State -> Action -> Screen -> Contract",status:"READY_FOR_DESIGN"}' \
  >"$STAGING/design/project-contract.json"
jq -n --arg id "$PROJECT_ID" \
  '{schemaVersion:1,projectId:$id,renderer:"resonance-screen-runtime",screens:[],sharedAssets:{theme:"krds-default",sections:[],components:[],css:[]}}' \
  >"$STAGING/frontend/screen-contracts.json"
jq -n --arg id "$PROJECT_ID" \
  '{schemaVersion:1,projectId:$id,contractStyle:"OpenAPI + JSON Schema",apis:[],commands:[],queries:[]}' \
  >"$STAGING/backend/api-contracts.json"
jq -n --arg id "$PROJECT_ID" --arg schema "$DB_SCHEMA" \
  '{schemaVersion:1,projectId:$id,schema:$schema,entities:[],migrations:[],sharedContracts:[]}' \
  >"$STAGING/db/schema-contract.json"
jq -n --arg id "$PROJECT_ID" \
  '{schemaVersion:1,projectId:$id,scenarios:[],qualityGates:["REFERENCE_INTEGRITY","DATA_CONTRACT","ACTOR_POLICY","PROCESS_REACHABILITY","ACCESSIBILITY","RESPONSIVE","E2E"]}' \
  >"$STAGING/tests/scenarios.json"
jq -n --arg id "$PROJECT_ID" --arg mode "$RUNTIME_MODE" \
  '{schemaVersion:1,projectId:$id,runtimeMode:$mode,environments:["development","staging","production"],deploymentStatus:"NOT_DEPLOYED"}' \
  >"$STAGING/ops/runtime.json"

node "$ROOT/ops/scripts/validate-project-bootstrap.mjs" "$STAGING" >/dev/null
CHECKSUM="$(find "$STAGING" -type f -print0 | sort -z | xargs -0 sha256sum | sha256sum | awk '{print $1}')"

if [[ -e "$FINAL" ]]; then
  ARCHIVE="$WORKSPACE_ROOT/.archive/${PROJECT_ID}-$(date -u +%Y%m%dT%H%M%SZ)"
  install -d -m 0750 "$(dirname "$ARCHIVE")"
  mv "$FINAL" "$ARCHIVE"
fi
mv "$STAGING" "$FINAL"
STAGING=""

RESULT_JSON="$(jq -nc \
  --arg workspace "$FINAL" --arg manifest "$FINAL/manifest.json" \
  --arg checksum "$CHECKSUM" \
  '{workspacePath:$workspace,manifestPath:$manifest,checksumSha256:$checksum,validation:"PASS",generatedArtifacts:7}')"
RESULT_B64="$(printf '%s' "$RESULT_JSON" | base64 -w0)"
db_sql "
  begin;
  update resonance_projects__task
     set status='COMPLETED',
         result=convert_from(decode('$RESULT_B64','base64'),'UTF8')::jsonb,
         error_message=null, finished_at=now(), updated_at=now()
   where task_id=$TASK_ID and status='RUNNING' and worker_id='$WORKER_ID';
  update resonance_projects__project
     set status='READY_FOR_DESIGN', updated_at=now()
   where project_id='$PROJECT_ID';
  commit;
" >/dev/null

echo "[project-bootstrap] completed task=$TASK_ID project=$PROJECT_ID workspace=$FINAL"
