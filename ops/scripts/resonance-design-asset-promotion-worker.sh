#!/usr/bin/env bash
set -Eeuo pipefail
umask 027

QUEUE_ROOT="${RESONANCE_DESIGN_ASSET_QUEUE_ROOT:-/opt/resonance-data/control-plane/design-asset-promotion-queue}"
NAMESPACE="${BACKSTAGE_NAMESPACE:-resonance-ops}"
DB_NAMESPACE="${BACKSTAGE_DB_NAMESPACE:-carbonet-prod}"
DB_NAME="${BACKSTAGE_PROJECT_DB:-backstage_plugin_resonance-projects}"
WORKER_ID="${HOSTNAME:-unknown}:$$"
TASK_ID=""
TASK_TYPE=""

for command in kubectl jq base64 sha256sum install; do
  command -v "$command" >/dev/null || {
    echo "[design-asset-promotion] missing command: $command" >&2
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
         set status='RETRY',
             error_message='Design asset promotion worker failed',
             worker_id=null, finished_at=now(), updated_at=now()
       where task_id=$TASK_ID and status='RUNNING';
    " >/dev/null || true
  fi
  exit "$exit_code"
}
trap fail_task ERR

install -d -m 0750 "$QUEUE_ROOT"
db_sql "
  update resonance_projects__task
     set status='RETRY', worker_id=null,
         error_message='Recovered stale design asset promotion claim',
         finished_at=now(), updated_at=now()
   where task_type in ('DESIGN_ASSET_PROMOTION','DESIGN_ASSET_ROLLBACK')
     and status='RUNNING'
     and started_at < now() - interval '30 minutes';
" >/dev/null

CLAIM="$(db_sql "
  with next_task as (
    select task_id, task_type
      from resonance_projects__task
     where task_type in ('DESIGN_ASSET_PROMOTION','DESIGN_ASSET_ROLLBACK')
       and status in ('PLANNED','RETRY')
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
    returning task.task_id, task.task_type
  )
  select task_id || '|' || task_type from claimed;
")"

if [[ -z "$CLAIM" ]]; then
  echo "[design-asset-promotion] no planned work"
  exit 0
fi
IFS='|' read -r TASK_ID TASK_TYPE <<<"$CLAIM"
[[ "$TASK_ID" =~ ^[0-9]+$ ]]
[[ "$TASK_TYPE" =~ ^DESIGN_ASSET_(PROMOTION|ROLLBACK)$ ]]

if [[ "$TASK_TYPE" == "DESIGN_ASSET_PROMOTION" ]]; then
  ARTIFACT_B64="$(db_sql "
    select encode(convert_to(json_build_object(
      'schemaVersion',1,
      'projectId',draft.project_id,
      'draftId',draft.draft_id,
      'assetType',draft.asset_type,
      'assetId',draft.asset_id,
      'baseFingerprint',draft.base_sha256,
      'patch',draft.patch_payload,
      'validationReport',draft.validation_report,
      'action','APPLY_VERIFIED_DESIGN_ASSET_PATCH',
      'status','READY',
      'sourceOfTruth','BACKSTAGE'
    )::text,'UTF8'),'base64')
    from resonance_projects__design_asset_draft draft
    join resonance_projects__task task
      on task.task_id=$TASK_ID
     and task.project_id=draft.project_id
     and draft.draft_id=(task.payload->>'draftId')::bigint
    where draft.draft_status='PROMOTED'
      and draft.base_sha256=task.payload->>'baseFingerprint';
  ")"
else
  ARTIFACT_B64="$(db_sql "
    select encode(convert_to(json_build_object(
      'schemaVersion',1,
      'projectId',draft.project_id,
      'draftId',draft.draft_id,
      'assetType',draft.asset_type,
      'assetId',draft.asset_id,
      'baseFingerprint',task.payload->>'appliedFingerprint',
      'backup',task.payload->>'backup',
      'patch','{}'::jsonb,
      'validationReport',draft.validation_report,
      'action','ROLLBACK_VERIFIED_DESIGN_ASSET_PATCH',
      'status','READY',
      'sourceOfTruth','BACKSTAGE'
    )::text,'UTF8'),'base64')
    from resonance_projects__design_asset_draft draft
    join resonance_projects__task task
      on task.task_id=$TASK_ID
     and task.project_id=draft.project_id
     and draft.draft_id=(task.payload->>'draftId')::bigint
    where draft.draft_status='ROLLBACK_QUEUED'
      and task.payload->>'backup'=draft.validation_report->>'backup'
      and task.payload->>'appliedFingerprint'=draft.validation_report->>'afterFingerprint';
  ")"
fi
[[ -n "$ARTIFACT_B64" ]]

STAGED="$(mktemp "$QUEUE_ROOT/.design-asset-promotion.XXXXXX")"
printf '%s' "$ARTIFACT_B64" | base64 -d > "$STAGED"
jq -e \
  '.schemaVersion==1
   and .sourceOfTruth=="BACKSTAGE"
   and .status=="READY"
   and (.action=="APPLY_VERIFIED_DESIGN_ASSET_PATCH"
        or .action=="ROLLBACK_VERIFIED_DESIGN_ASSET_PATCH")
   and (.projectId|type=="string")
   and (.draftId|type=="number")
   and (.baseFingerprint|test("^[0-9a-f]{64}$"))
   and (.patch|type=="object")' \
  "$STAGED" >/dev/null

PROJECT_ID="$(jq -r '.projectId' "$STAGED")"
DRAFT_ID="$(jq -r '.draftId' "$STAGED")"
[[ "$PROJECT_ID" =~ ^[A-Z][A-Z0-9_-]{2,63}$ && "$DRAFT_ID" =~ ^[0-9]+$ ]]
if [[ "$TASK_TYPE" == "DESIGN_ASSET_ROLLBACK" ]]; then
  QUEUE_FILE="$QUEUE_ROOT/${PROJECT_ID}-${DRAFT_ID}-rollback.json"
else
  QUEUE_FILE="$QUEUE_ROOT/${PROJECT_ID}-${DRAFT_ID}.json"
fi
ARTIFACT_SHA256="$(sha256sum "$STAGED" | awk '{print $1}')"
mv -f "$STAGED" "$QUEUE_FILE"

RESULT="$(jq -nc \
  --arg queueFile "$QUEUE_FILE" \
  --arg artifactSha256 "$ARTIFACT_SHA256" \
  --arg taskType "$TASK_TYPE" \
  '{validation:"PASS",delivery:"READY_FOR_RUNTIME_APPLIER",taskType:$taskType,queueFile:$queueFile,artifactSha256:$artifactSha256}')"
RESULT_B64="$(printf '%s' "$RESULT" | base64 -w0)"
db_sql "
  update resonance_projects__task
     set status='COMPLETED',
         result=convert_from(decode('$RESULT_B64','base64'),'UTF8')::jsonb,
         error_message=null, finished_at=now(), updated_at=now()
   where task_id=$TASK_ID and status='RUNNING' and worker_id='$WORKER_ID';
" >/dev/null

echo "[design-asset-promotion] PASS project=$PROJECT_ID draft=$DRAFT_ID queue=$QUEUE_FILE"
