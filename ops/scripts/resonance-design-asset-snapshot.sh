#!/usr/bin/env bash
set -euo pipefail

PROJECT_ID="${1:-CCUS-PLATFORM}"
BACKSTAGE_URL="${BACKSTAGE_URL:-https://backstage.172.16.1.232.nip.io}"
NAMESPACE="${CARBONET_NAMESPACE:-carbonet-prod}"
POD="${CARBONET_POSTGRES_POD:-postgres-patroni-0}"
WORK_DIR="${RESONANCE_DESIGN_SYNC_DIR:-/opt/resonance-data/design-asset-sync}"
mkdir -p "$WORK_DIR"
RAW="$WORK_DIR/${PROJECT_ID}.jsonl"
PAYLOAD="$WORK_DIR/${PROJECT_ID}.json"

DATABASE="$(
  kubectl -n "$NAMESPACE" exec "$POD" -- sh -lc '
    for db in $(psql -U "$POSTGRES_USER" -d postgres -Atc "select datname from pg_database where datallowconn and not datistemplate"); do
      if [ "$(psql -U "$POSTGRES_USER" -d "$db" -Atc "select to_regclass('\''public.ui_component_registry'\'') is not null")" = "t" ]; then
        printf "%s" "$db"
        exit 0
      fi
    done
    exit 1
  '
)"

kubectl -n "$NAMESPACE" exec "$POD" -- sh -lc \
  "psql -U \"\$POSTGRES_USER\" -d '$DATABASE' -At -v ON_ERROR_STOP=1" \
  >"$RAW" <<'SQL'
select jsonb_build_object(
  'assetType','THEME','assetId',theme_id,'assetName',theme_nm,
  'version','v1','active',(use_at='Y' and is_active='Y'),
  'payload',jsonb_build_object('themeType',theme_type,'isDefault',is_default)
) from comtnthemedefinition;
select jsonb_build_object(
  'assetType','CSS','assetId',class_set_id,'assetName',class_set_nm,
  'version','v1','active',(use_at='Y'),
  'payload',jsonb_build_object('themeId',theme_id,'targetComponent',target_component,'baseClasses',base_classes,'responsiveClasses',responsive_classes)
) from comtnthemeclassset;
select jsonb_build_object(
  'assetType','SECTION','assetId',section_id,'assetName',section_name,
  'version','v1','active',(active_yn='Y'),
  'payload',jsonb_build_object('sectionType',section_type,'layoutContract',layout_contract,'responsiveContract',responsive_contract,'accessibilityContract',accessibility_contract,'designReference',design_reference)
) from ui_section_registry;
select jsonb_build_object(
  'assetType','COMPONENT','assetId',component_id,'assetName',component_name,
  'version','v1','active',(active_yn='Y'),
  'payload',jsonb_build_object('componentType',component_type,'ownerDomain',owner_domain,'designReference',design_reference,'fingerprint',asset_fingerprint)
) from ui_component_registry;
select jsonb_build_object(
  'assetType','SCREEN','assetId',page_id,'assetName',coalesce(page_name,page_title,page_id),
  'routePath',coalesce(route_path,page_url,''),'version',coalesce(layout_version,'v1'),
  'active',(active_yn='Y'),
  'payload',jsonb_build_object('domainCode',domain_code,'designTokenVersion',design_token_version,'versionStatus',version_status)
) from ui_page_manifest;
select jsonb_build_object(
  'assetType','MENU','assetId',menu_code,'assetName',menu_nm,
  'routePath',coalesce(menu_url,''),'version','v1',
  'active',(use_at='Y' and coalesce(expsr_at,'Y')='Y'),
  'payload',jsonb_build_object('nameEn',menu_nm_en,'icon',menu_icon)
) from comtnmenuinfo;
SQL

jq -s '{assets: .}' "$RAW" >"$PAYLOAD"
TOKEN="$(
  curl -kfsS -X POST "$BACKSTAGE_URL/api/auth/guest/refresh" |
    jq -er '.backstageIdentity.token'
)"
RESULT="$(
  curl -kfsS \
    -H "Authorization: Bearer $TOKEN" \
    -H 'Content-Type: application/json' \
    --data-binary "@$PAYLOAD" \
    "$BACKSTAGE_URL/api/resonance-projects/design-assets/$PROJECT_ID/sync"
)"
jq -e '.synchronized > 0 and (.fingerprint | length) == 64' <<<"$RESULT" >/dev/null
printf '%s\n' "$RESULT"
