#!/usr/bin/env bash
set -Eeuo pipefail
umask 027

ROOT="${RESONANCE_ROOT:-/opt/resonance-data/control-plane/source}"
QUEUE_ROOT="${RESONANCE_DESIGN_ASSET_QUEUE_ROOT:-/opt/resonance-data/control-plane/design-asset-promotion-queue}"
STATE_ROOT="${RESONANCE_DESIGN_ASSET_STATE_ROOT:-/opt/resonance-data/control-plane/design-asset-runtime}"
NAMESPACE="${CARBONET_NAMESPACE:-carbonet-prod}"
POD="${CARBONET_POSTGRES_POD:-postgres-patroni-0}"
BACKSTAGE_NAMESPACE="${BACKSTAGE_NAMESPACE:-resonance-ops}"
BACKSTAGE_DB_NAME="${BACKSTAGE_PROJECT_DB:-backstage_plugin_resonance-projects}"
QUEUE_FILE=""
BACKUP_FILE=""

for command in kubectl jq base64 sha256sum install find sort; do
  command -v "$command" >/dev/null || {
    echo "[design-asset-runtime] missing command: $command" >&2
    exit 1
  }
done

install -d -m 0750 \
  "$QUEUE_ROOT" "$STATE_ROOT/backups" "$STATE_ROOT/receipts" "$STATE_ROOT/failures"

WRITE_POD="$(
  for candidate in $(
    kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni \
      -o jsonpath='{range .items[*]}{.metadata.name}{"\n"}{end}'
  ); do
    if [[ "$(
      kubectl -n "$NAMESPACE" exec "$candidate" -- \
        psql -h 127.0.0.1 -U postgres -d postgres -Atq \
        -c 'select pg_is_in_recovery()' 2>/dev/null
    )" == "f" ]]; then
      printf '%s' "$candidate"
      break
    fi
  done
)"
if [[ -z "$WRITE_POD" ]]; then
  echo "[design-asset-runtime] Patroni writable leader not found" >&2
  exit 1
fi

QUEUE_FILE="$(
  find "$QUEUE_ROOT" -maxdepth 1 -type f -name '*.json' -print |
    sort |
    while IFS= read -r candidate; do
      marker="$STATE_ROOT/receipts/$(basename "$candidate").receipt.json"
      failure="$STATE_ROOT/failures/$(basename "$candidate").failure.json"
      if [[ ! -e "$marker" && ! -e "$failure" ]]; then
        printf '%s\n' "$candidate"
        break
      fi
    done
)"
if [[ -z "$QUEUE_FILE" ]]; then
  echo "[design-asset-runtime] no ready work"
  exit 0
fi

jq -e '
  .schemaVersion==1
  and .sourceOfTruth=="BACKSTAGE"
  and .status=="READY"
  and (.action=="APPLY_VERIFIED_DESIGN_ASSET_PATCH"
       or .action=="ROLLBACK_VERIFIED_DESIGN_ASSET_PATCH")
  and (.projectId|type=="string")
  and (.draftId|type=="number")
  and (.assetType|IN("THEME","CSS","SECTION","COMPONENT","SCREEN","MENU"))
  and (.assetId|type=="string" and length>0)
  and (.baseFingerprint|test("^[0-9a-f]{64}$"))
  and (.patch|type=="object")
' "$QUEUE_FILE" >/dev/null

PROJECT_ID="$(jq -r '.projectId' "$QUEUE_FILE")"
DRAFT_ID="$(jq -r '.draftId' "$QUEUE_FILE")"
ASSET_TYPE="$(jq -r '.assetType' "$QUEUE_FILE")"
ASSET_ID="$(jq -r '.assetId' "$QUEUE_FILE")"
BASE_FINGERPRINT="$(jq -r '.baseFingerprint' "$QUEUE_FILE")"
ACTION="$(jq -r '.action' "$QUEUE_FILE")"
[[ "$PROJECT_ID" =~ ^[A-Z][A-Z0-9_-]{2,63}$ && "$DRAFT_ID" =~ ^[0-9]+$ ]]

DATABASE="$(
  kubectl -n "$NAMESPACE" exec "$POD" -- sh -lc '
    for db in $(psql -h 127.0.0.1 -U postgres -d postgres -Atc "select datname from pg_database where datallowconn and not datistemplate"); do
      if [ "$(psql -h 127.0.0.1 -U postgres -d "$db" -Atc "select to_regclass('\''public.ui_component_registry'\'') is not null")" = "t" ]; then
        printf "%s" "$db"
        exit 0
      fi
    done
    exit 1
  '
)"

carbonet_sql() {
  kubectl -n "$NAMESPACE" exec -i "$WRITE_POD" -- \
    psql -h 127.0.0.1 -U postgres -d "$DATABASE" \
    -v ON_ERROR_STOP=1 -Atq
}

BACKSTAGE_DB_USER="$(kubectl -n "$BACKSTAGE_NAMESPACE" get secret resonance-backstage-database \
  -o jsonpath='{.data.POSTGRES_USER}' | base64 -d)"
BACKSTAGE_DB_PASSWORD="$(kubectl -n "$BACKSTAGE_NAMESPACE" get secret resonance-backstage-database \
  -o jsonpath='{.data.POSTGRES_PASSWORD}' | base64 -d)"

backstage_sql() {
  kubectl -n "$NAMESPACE" exec -i "$POD" -c patroni -- \
    env PGPASSWORD="$BACKSTAGE_DB_PASSWORD" psql \
    -h postgres-haproxy.carbonet-prod.svc.cluster.local \
    -U "$BACKSTAGE_DB_USER" -d "$BACKSTAGE_DB_NAME" \
    -v ON_ERROR_STOP=1 -Atq
}

id_b64="$(printf '%s' "$ASSET_ID" | base64 -w0)"
if [[ "$ACTION" == "ROLLBACK_VERIFIED_DESIGN_ASSET_PATCH" ]]; then
  RESTORE_BACKUP="$(jq -r '.backup // ""' "$QUEUE_FILE")"
  case "$RESTORE_BACKUP" in
    "$STATE_ROOT"/backups/*.json) ;;
    *)
      echo "[design-asset-runtime] blocked: backup path is outside managed storage" >&2
      exit 1
      ;;
  esac
  [[ -s "$RESTORE_BACKUP" ]]
  patch_b64="$(base64 -w0 "$RESTORE_BACKUP")"
else
  RESTORE_BACKUP=""
  patch_b64="$(jq -c '.patch' "$QUEUE_FILE" | base64 -w0)"
fi

asset_select_sql() {
  case "$ASSET_TYPE" in
    THEME)
      cat <<SQL
select jsonb_build_object(
  'assetType','THEME','assetId',theme_id,'assetName',theme_nm,
  'version','v1','active',(use_at='Y' and is_active='Y'),
  'payload',jsonb_build_object('themeType',theme_type,'isDefault',is_default)
) from comtnthemedefinition
where theme_id=convert_from(decode('$id_b64','base64'),'UTF8');
SQL
      ;;
    CSS)
      cat <<SQL
select jsonb_build_object(
  'assetType','CSS','assetId',class_set_id,'assetName',class_set_nm,
  'version','v1','active',(use_at='Y'),
  'payload',jsonb_build_object('themeId',theme_id,'targetComponent',target_component,'baseClasses',base_classes,'responsiveClasses',responsive_classes)
) from comtnthemeclassset
where class_set_id=convert_from(decode('$id_b64','base64'),'UTF8');
SQL
      ;;
    SECTION)
      cat <<SQL
select jsonb_build_object(
  'assetType','SECTION','assetId',section_id,'assetName',section_name,
  'version','v1','active',(active_yn='Y'),
  'payload',jsonb_build_object('sectionType',section_type,'layoutContract',layout_contract,'responsiveContract',responsive_contract,'accessibilityContract',accessibility_contract,'designReference',design_reference)
) from ui_section_registry
where section_id=convert_from(decode('$id_b64','base64'),'UTF8');
SQL
      ;;
    COMPONENT)
      cat <<SQL
select jsonb_build_object(
  'assetType','COMPONENT','assetId',component_id,'assetName',component_name,
  'version','v1','active',(active_yn='Y'),
  'payload',jsonb_build_object('componentType',component_type,'ownerDomain',owner_domain,'designReference',design_reference,'fingerprint',asset_fingerprint)
) from ui_component_registry
where component_id=convert_from(decode('$id_b64','base64'),'UTF8');
SQL
      ;;
    SCREEN)
      cat <<SQL
select jsonb_build_object(
  'assetType','SCREEN','assetId',page_id,'assetName',coalesce(page_name,page_title,page_id),
  'routePath',coalesce(route_path,page_url,''),'version',coalesce(layout_version,'v1'),
  'active',(active_yn='Y'),
  'payload',jsonb_build_object('domainCode',domain_code,'designTokenVersion',design_token_version,'versionStatus',version_status)
) from ui_page_manifest
where page_id=convert_from(decode('$id_b64','base64'),'UTF8');
SQL
      ;;
    MENU)
      cat <<SQL
select jsonb_build_object(
  'assetType','MENU','assetId',menu_code,'assetName',menu_nm,
  'routePath',coalesce(menu_url,''),'version','v1',
  'active',(use_at='Y' and coalesce(expsr_at,'Y')='Y'),
  'payload',jsonb_build_object('nameEn',menu_nm_en,'icon',menu_icon)
) from comtnmenuinfo
where menu_code=convert_from(decode('$id_b64','base64'),'UTF8');
SQL
      ;;
  esac
}

normalize_asset() {
  jq -c '{
    assetType,
    assetId,
    assetName,
    routePath:(.routePath // ""),
    version:(.version // "v1"),
    active:(.active != false),
    payload:(.payload // {})
  }'
}

LIVE_JSON="$(asset_select_sql | carbonet_sql)"
[[ -n "$LIVE_JSON" ]]
LIVE_CANONICAL="$(printf '%s' "$LIVE_JSON" | normalize_asset)"
LIVE_FINGERPRINT="$(printf '%s' "$LIVE_CANONICAL" | sha256sum | awk '{print $1}')"
if [[ "$LIVE_FINGERPRINT" != "$BASE_FINGERPRINT" ]]; then
  jq -n \
    --arg projectId "$PROJECT_ID" --argjson draftId "$DRAFT_ID" \
    --arg expected "$BASE_FINGERPRINT" --arg actual "$LIVE_FINGERPRINT" \
    '{status:"BLOCKED",reason:"SOURCE_FINGERPRINT_CHANGED",projectId:$projectId,draftId:$draftId,expected:$expected,actual:$actual}' \
    >"$STATE_ROOT/failures/$(basename "$QUEUE_FILE").failure.json"
  echo "[design-asset-runtime] blocked: source fingerprint changed" >&2
  exit 1
fi

if [[ "$ACTION" == "ROLLBACK_VERIFIED_DESIGN_ASSET_PATCH" ]]; then
  BACKUP_FILE="$STATE_ROOT/backups/${PROJECT_ID}-${DRAFT_ID}-${ASSET_TYPE}-${ASSET_ID}-before-rollback.json"
else
  BACKUP_FILE="$STATE_ROOT/backups/${PROJECT_ID}-${DRAFT_ID}-${ASSET_TYPE}-${ASSET_ID}.json"
fi
printf '%s\n' "$LIVE_CANONICAL" >"$BACKUP_FILE.tmp"
mv -f "$BACKUP_FILE.tmp" "$BACKUP_FILE"

apply_sql() {
  local payload_b64="$1"
  case "$ASSET_TYPE" in
    THEME)
      cat <<SQL
begin;
with p as (select convert_from(decode('$payload_b64','base64'),'UTF8')::jsonb patch)
update comtnthemedefinition t set
  theme_nm=case when p.patch ? 'assetName' then p.patch->>'assetName' else t.theme_nm end,
  theme_type=case when p.patch->'payload' ? 'themeType' then p.patch->'payload'->>'themeType' else t.theme_type end,
  is_default=case when p.patch->'payload' ? 'isDefault' then case when lower(p.patch->'payload'->>'isDefault') in ('true','y') then 'Y' else 'N' end else t.is_default end,
  use_at=case when p.patch ? 'active' then case when (p.patch->>'active')::boolean then 'Y' else 'N' end else t.use_at end,
  is_active=case when p.patch ? 'active' then case when (p.patch->>'active')::boolean then 'Y' else 'N' end else t.is_active end,
  updt_pnttm=current_timestamp,updt_user_id='backstage-runtime'
from p where t.theme_id=convert_from(decode('$id_b64','base64'),'UTF8');
commit;
SQL
      ;;
    CSS)
      cat <<SQL
begin;
with p as (select convert_from(decode('$payload_b64','base64'),'UTF8')::jsonb patch)
update comtnthemeclassset t set
  class_set_nm=case when p.patch ? 'assetName' then p.patch->>'assetName' else t.class_set_nm end,
  theme_id=case when p.patch->'payload' ? 'themeId' then p.patch->'payload'->>'themeId' else t.theme_id end,
  target_component=case when p.patch->'payload' ? 'targetComponent' then p.patch->'payload'->>'targetComponent' else t.target_component end,
  base_classes=case when p.patch->'payload' ? 'baseClasses' then p.patch->'payload'->>'baseClasses' else t.base_classes end,
  responsive_classes=case when p.patch->'payload' ? 'responsiveClasses' then p.patch->'payload'->>'responsiveClasses' else t.responsive_classes end,
  use_at=case when p.patch ? 'active' then case when (p.patch->>'active')::boolean then 'Y' else 'N' end else t.use_at end,
  updt_pnttm=current_timestamp,updt_user_id='backstage-runtime'
from p where t.class_set_id=convert_from(decode('$id_b64','base64'),'UTF8');
commit;
SQL
      ;;
    SECTION)
      cat <<SQL
begin;
with p as (select convert_from(decode('$payload_b64','base64'),'UTF8')::jsonb patch)
update ui_section_registry t set
  section_name=case when p.patch ? 'assetName' then p.patch->>'assetName' else t.section_name end,
  section_type=case when p.patch->'payload' ? 'sectionType' then p.patch->'payload'->>'sectionType' else t.section_type end,
  layout_contract=case when p.patch->'payload' ? 'layoutContract' then p.patch->'payload'->>'layoutContract' else t.layout_contract end,
  responsive_contract=case when p.patch->'payload' ? 'responsiveContract' then p.patch->'payload'->>'responsiveContract' else t.responsive_contract end,
  accessibility_contract=case when p.patch->'payload' ? 'accessibilityContract' then p.patch->'payload'->>'accessibilityContract' else t.accessibility_contract end,
  design_reference=case when p.patch->'payload' ? 'designReference' then p.patch->'payload'->>'designReference' else t.design_reference end,
  active_yn=case when p.patch ? 'active' then case when (p.patch->>'active')::boolean then 'Y' else 'N' end else t.active_yn end,
  updated_at=current_timestamp
from p where t.section_id=convert_from(decode('$id_b64','base64'),'UTF8');
commit;
SQL
      ;;
    COMPONENT)
      cat <<SQL
begin;
with p as (select convert_from(decode('$payload_b64','base64'),'UTF8')::jsonb patch)
update ui_component_registry t set
  component_name=case when p.patch ? 'assetName' then p.patch->>'assetName' else t.component_name end,
  component_type=case when p.patch->'payload' ? 'componentType' then p.patch->'payload'->>'componentType' else t.component_type end,
  owner_domain=case when p.patch->'payload' ? 'ownerDomain' then p.patch->'payload'->>'ownerDomain' else t.owner_domain end,
  design_reference=case when p.patch->'payload' ? 'designReference' then p.patch->'payload'->>'designReference' else t.design_reference end,
  asset_fingerprint=case when p.patch->'payload' ? 'fingerprint' then p.patch->'payload'->>'fingerprint' else t.asset_fingerprint end,
  active_yn=case when p.patch ? 'active' then case when (p.patch->>'active')::boolean then 'Y' else 'N' end else t.active_yn end,
  updated_at=current_timestamp
from p where t.component_id=convert_from(decode('$id_b64','base64'),'UTF8');
commit;
SQL
      ;;
    SCREEN)
      cat <<SQL
begin;
with p as (select convert_from(decode('$payload_b64','base64'),'UTF8')::jsonb patch)
update ui_page_manifest t set
  page_name=case when p.patch ? 'assetName' then p.patch->>'assetName' else t.page_name end,
  route_path=case when p.patch ? 'routePath' then p.patch->>'routePath' else t.route_path end,
  layout_version=case when p.patch ? 'version' then p.patch->>'version' else t.layout_version end,
  domain_code=case when p.patch->'payload' ? 'domainCode' then p.patch->'payload'->>'domainCode' else t.domain_code end,
  design_token_version=case when p.patch->'payload' ? 'designTokenVersion' then p.patch->'payload'->>'designTokenVersion' else t.design_token_version end,
  version_status=case when p.patch->'payload' ? 'versionStatus' then p.patch->'payload'->>'versionStatus' else t.version_status end,
  active_yn=case when p.patch ? 'active' then case when (p.patch->>'active')::boolean then 'Y' else 'N' end else t.active_yn end,
  updated_at=current_timestamp
from p where t.page_id=convert_from(decode('$id_b64','base64'),'UTF8');
commit;
SQL
      ;;
    MENU)
      cat <<SQL
begin;
with p as (select convert_from(decode('$payload_b64','base64'),'UTF8')::jsonb patch)
update comtnmenuinfo t set
  menu_nm=case when p.patch ? 'assetName' then p.patch->>'assetName' else t.menu_nm end,
  menu_url=case when p.patch ? 'routePath' then p.patch->>'routePath' else t.menu_url end,
  menu_nm_en=case when p.patch->'payload' ? 'nameEn' then p.patch->'payload'->>'nameEn' else t.menu_nm_en end,
  menu_icon=case when p.patch->'payload' ? 'icon' then p.patch->'payload'->>'icon' else t.menu_icon end,
  use_at=case when p.patch ? 'active' then case when (p.patch->>'active')::boolean then 'Y' else 'N' end else t.use_at end,
  expsr_at=case when p.patch ? 'active' then case when (p.patch->>'active')::boolean then 'Y' else 'N' end else t.expsr_at end,
  last_updt_pnttm=current_timestamp
from p where t.menu_code=convert_from(decode('$id_b64','base64'),'UTF8');
commit;
SQL
      ;;
  esac
}

apply_sql "$patch_b64" | carbonet_sql >/dev/null
if [[ "$ACTION" == "ROLLBACK_VERIFIED_DESIGN_ASSET_PATCH" ]]; then
  EXPECTED_CANONICAL="$(normalize_asset <"$RESTORE_BACKUP")"
else
  EXPECTED_CANONICAL="$(
    jq -nc --argjson live "$LIVE_CANONICAL" --argjson patch "$(jq -c '.patch' "$QUEUE_FILE")" \
      '$live + $patch | {
        assetType,assetId,assetName,
        routePath:(.routePath // ""),version:(.version // "v1"),
        active:(.active != false),payload:(.payload // {})
      }'
  )"
fi
EXPECTED_FINGERPRINT="$(printf '%s' "$EXPECTED_CANONICAL" | sha256sum | awk '{print $1}')"
AFTER_JSON="$(asset_select_sql | carbonet_sql)"
AFTER_CANONICAL="$(printf '%s' "$AFTER_JSON" | normalize_asset)"
AFTER_FINGERPRINT="$(printf '%s' "$AFTER_CANONICAL" | sha256sum | awk '{print $1}')"

if [[ "$AFTER_FINGERPRINT" != "$EXPECTED_FINGERPRINT" ]]; then
  rollback_b64="$(base64 -w0 "$BACKUP_FILE")"
  apply_sql "$rollback_b64" | carbonet_sql >/dev/null
  jq -n \
    --arg projectId "$PROJECT_ID" --argjson draftId "$DRAFT_ID" \
    --arg expected "$EXPECTED_FINGERPRINT" --arg actual "$AFTER_FINGERPRINT" \
    --arg backup "$BACKUP_FILE" \
    '{status:"ROLLED_BACK",reason:"POST_APPLY_FINGERPRINT_MISMATCH",projectId:$projectId,draftId:$draftId,expected:$expected,actual:$actual,backup:$backup}' \
    >"$STATE_ROOT/failures/$(basename "$QUEUE_FILE").failure.json"
  echo "[design-asset-runtime] rolled back: post-apply fingerprint mismatch" >&2
  exit 1
fi

bash "$ROOT/ops/scripts/resonance-design-asset-snapshot.sh" "$PROJECT_ID" >/dev/null
receipt_file="$STATE_ROOT/receipts/$(basename "$QUEUE_FILE").receipt.json"
FINAL_STATUS="APPLIED"
FINAL_DRAFT_STATUS="APPLIED"
if [[ "$ACTION" == "ROLLBACK_VERIFIED_DESIGN_ASSET_PATCH" ]]; then
  FINAL_STATUS="ROLLED_BACK"
  FINAL_DRAFT_STATUS="ROLLED_BACK"
fi
jq -n \
  --arg projectId "$PROJECT_ID" --argjson draftId "$DRAFT_ID" \
  --arg assetType "$ASSET_TYPE" --arg assetId "$ASSET_ID" \
  --arg before "$LIVE_FINGERPRINT" --arg after "$AFTER_FINGERPRINT" \
  --arg backup "$BACKUP_FILE" --arg status "$FINAL_STATUS" \
  --arg completedAt "$(date -u +%FT%TZ)" \
  '{status:$status,validation:"PASS",projectId:$projectId,draftId:$draftId,assetType:$assetType,assetId:$assetId,beforeFingerprint:$before,afterFingerprint:$after,backup:$backup,completedAt:$completedAt}' \
  >"$receipt_file.tmp"
mv -f "$receipt_file.tmp" "$receipt_file"

receipt_b64="$(jq -c . "$receipt_file" | base64 -w0)"
backstage_sql <<SQL
update resonance_projects__design_asset_draft
   set draft_status='$FINAL_DRAFT_STATUS',
       validation_report=coalesce(validation_report,'{}'::jsonb) ||
         convert_from(decode('$receipt_b64','base64'),'UTF8')::jsonb,
       updated_at=now()
 where project_id='$PROJECT_ID' and draft_id=$DRAFT_ID
   and draft_status in ('PROMOTED','ROLLBACK_QUEUED');
SQL

echo "[design-asset-runtime] PASS status=$FINAL_STATUS project=$PROJECT_ID draft=$DRAFT_ID asset=$ASSET_TYPE:$ASSET_ID"
