#!/usr/bin/env bash
set -Eeuo pipefail
umask 027

ROOT="${RESONANCE_ROOT:-/opt/resonance-data/control-plane/source}"
WORKSPACE_ROOT="${RESONANCE_PROJECT_WORKSPACE_ROOT:-/opt/resonance-data/project-workspaces}"
QUEUE_ROOT="${RESONANCE_DESIGN_QUEUE_ROOT:-/opt/resonance-data/design-release-queue}"
NAMESPACE="${BACKSTAGE_NAMESPACE:-resonance-ops}"
DB_NAMESPACE="${BACKSTAGE_DB_NAMESPACE:-carbonet-prod}"
DB_NAME="${BACKSTAGE_PROJECT_DB:-backstage_plugin_resonance-projects}"
WORKER_ID="${HOSTNAME:-unknown}:$$"
TASK_ID=""
PROJECT_ID=""

for command in kubectl jq base64 sha256sum install; do
  command -v "$command" >/dev/null || {
    echo "[design-release] missing command: $command" >&2
    exit 1
  }
done

DB_USER="$(kubectl -n "$NAMESPACE" get secret resonance-backstage-database \
  -o jsonpath='{.data.POSTGRES_USER}' | base64 -d)"
DB_PASSWORD="$(kubectl -n "$NAMESPACE" get secret resonance-backstage-database \
  -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d)"
DB_POD="$(kubectl -n "$DB_NAMESPACE" get pods -l app=postgres-patroni \
  -o jsonpath='{.items[0].metadata.name}')"

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
  if [[ -n "$TASK_ID" && "$TASK_ID" =~ ^[0-9]+$ ]]; then
    db_sql "
      update resonance_projects__task
         set status='FAILED',
             error_message='Design release worker failed',
             finished_at=now(), updated_at=now()
       where task_id=$TASK_ID and status='RUNNING';
      update resonance_projects__project
         set status='DESIGN_PROMOTION_FAILED', updated_at=now()
       where project_id='$PROJECT_ID';
    " >/dev/null || true
  fi
  exit "$exit_code"
}
trap fail_task ERR

mkdir -p "$WORKSPACE_ROOT" "$QUEUE_ROOT"
db_sql "
  update resonance_projects__task
     set status='RETRY', worker_id=null,
         error_message='Recovered stale design promotion claim', updated_at=now()
   where task_type='DESIGN_PROMOTION' and status='RUNNING'
     and started_at < now() - interval '30 minutes';
" >/dev/null

CLAIM="$(db_sql "
  with next_task as (
    select task_id
      from resonance_projects__task
     where task_type='DESIGN_PROMOTION' and status in ('PLANNED','RETRY')
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
  echo "[design-release] no planned work"
  exit 0
fi
IFS='|' read -r TASK_ID PROJECT_ID <<<"$CLAIM"
[[ "$TASK_ID" =~ ^[0-9]+$ && "$PROJECT_ID" =~ ^[A-Z][A-Z0-9_-]{2,63}$ ]]

RELEASE_B64="$(db_sql "
  select encode(convert_to(json_build_object(
    'schemaVersion',1,
    'projectId',release.project_id,
    'tenantId',release.contract_payload->>'tenantId',
    'designVersion',release.design_version,
    'releaseStatus',release.release_status,
    'contractSha256',release.contract_sha256,
    'sourceOfTruth','BACKSTAGE',
    'generator',json_build_object(
      'strategy','METADATA_FIRST',
      'endpoint','/admin/api/system/actor-process/generation/compile-and-queue'
    ),
    'contract',release.contract_payload
  )::text,'UTF8'),'base64')
  from resonance_projects__design_release release
  join resonance_projects__task task
    on task.task_id=$TASK_ID and task.project_id=release.project_id
   and release.design_version=(task.payload->>'designVersion')::integer
  where release.project_id='$PROJECT_ID'
    and release.release_status='PROMOTED';
")"
[[ -n "$RELEASE_B64" ]]

PROJECT_DIR="$WORKSPACE_ROOT/$PROJECT_ID"
install -d -m 0750 "$PROJECT_DIR/design" "$QUEUE_ROOT"
STAGED="$(mktemp "$PROJECT_DIR/design/.backstage-development-contract.XXXXXX")"
printf '%s' "$RELEASE_B64" | base64 -d > "$STAGED"
jq -e \
  --arg project "$PROJECT_ID" \
  '.sourceOfTruth=="BACKSTAGE"
   and .projectId==$project
   and .releaseStatus=="PROMOTED"
   and (.contract.workspaces|length)==4
   and ([.contract.workspaces[].tabs[]]|length)==33' \
  "$STAGED" >/dev/null
ARTIFACT_SHA256="$(sha256sum "$STAGED" | awk '{print $1}')"
mv -f "$STAGED" "$PROJECT_DIR/design/backstage-development-contract.json"

DESIGN_VERSION="$(jq -r '.designVersion' "$PROJECT_DIR/design/backstage-development-contract.json")"
QUEUE_FILE="$QUEUE_ROOT/${PROJECT_ID}-${DESIGN_VERSION}.json"
jq -n \
  --arg projectId "$PROJECT_ID" \
  --argjson designVersion "$DESIGN_VERSION" \
  --arg contractPath "$PROJECT_DIR/design/backstage-development-contract.json" \
  --arg artifactSha256 "$ARTIFACT_SHA256" \
  '{
    schemaVersion:1,
    projectId:$projectId,
    tenantId:"DEFAULT",
    designVersion:$designVersion,
    contractPath:$contractPath,
    artifactSha256:$artifactSha256,
    action:"COMPILE_AND_QUEUE",
    status:"READY"
  }' > "$QUEUE_FILE.tmp"
mv -f "$QUEUE_FILE.tmp" "$QUEUE_FILE"

RESULT="$(jq -nc \
  --arg contractPath "$PROJECT_DIR/design/backstage-development-contract.json" \
  --arg queueFile "$QUEUE_FILE" \
  --arg artifactSha256 "$ARTIFACT_SHA256" \
  '{validation:"PASS",contractPath:$contractPath,queueFile:$queueFile,artifactSha256:$artifactSha256}')"
RESULT_B64="$(printf '%s' "$RESULT" | base64 -w0)"
db_sql "
  begin;
  update resonance_projects__task
     set status='COMPLETED',
         result=convert_from(decode('$RESULT_B64','base64'),'UTF8')::jsonb,
         error_message=null, finished_at=now(), updated_at=now()
   where task_id=$TASK_ID and status='RUNNING' and worker_id='$WORKER_ID';
  update resonance_projects__project
     set status='READY_FOR_GENERATION', updated_at=now()
   where project_id='$PROJECT_ID';
  commit;
" >/dev/null

echo "[design-release] PASS project=$PROJECT_ID version=$DESIGN_VERSION queue=$QUEUE_FILE"
