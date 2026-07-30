#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${CARBONET_DEPLOY_ROOT:-/opt/Resonance}"
NAMESPACE="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"
POSTGRES_CONTAINER="${CARBONET_POSTGRES_CONTAINER:-patroni}"
POSTGRES_DB="${POSTGRES_DB:-carbonet}"
POSTGRES_USER="${POSTGRES_ADMIN_USER:-postgres}"
BASE_REVISION="${1:-}"
TARGET_REVISION="${2:-HEAD}"
INCREMENTAL_LIMIT="${UNIFIED_ASSET_INCREMENTAL_LIMIT:-2000}"
tsv="$(mktemp)"
deleted_tsv="$(mktemp)"
sql="$(mktemp)"
trap 'rm -f "$tsv" "$deleted_tsv" "$sql"' EXIT

cd "$ROOT_DIR"

asset_type() {
  local path="$1"
  case "$path" in
    *.java) echo "JAVA_CLASS" ;;
    *.tsx|*.ts|*.jsx|*.js) echo "FRONTEND_SOURCE" ;;
    apps/carbonet-api/src/main/resources/db/migration/postgresql/*.sql) echo "DB_MIGRATION" ;;
    *.sql) echo "SQL_SOURCE" ;;
    *.xml) echo "MAPPER_OR_CONFIG" ;;
    *.css|*.scss) echo "STYLE_SOURCE" ;;
    *.sh|*.ps1|*.mjs) echo "AUTOMATION_SOURCE" ;;
    *.md|*.txt) echo "DOCUMENT" ;;
    *) return 1 ;;
  esac
}

append_asset() {
  local path="$1" index_meta type hash
  type="$(asset_type "$path")" || return 0
  index_meta="$(git ls-files -s -- "$path")"
  [[ -n "$index_meta" ]] || return 0
  hash="${index_meta#* }"
  hash="${hash%% *}"
  [[ -n "$hash" ]] || return 0
  printf '%s\t%s\t%s\n' "$path" "$type" "$hash" >> "$tsv"
}

sync_mode="full"
if [[ -n "$BASE_REVISION" ]] &&
   git cat-file -e "$BASE_REVISION^{commit}" 2>/dev/null &&
   git cat-file -e "$TARGET_REVISION^{commit}" 2>/dev/null &&
   git merge-base --is-ancestor "$BASE_REVISION" "$TARGET_REVISION"; then
  changed_count="$(git diff --no-renames --name-only "$BASE_REVISION" "$TARGET_REVISION" | wc -l)"
  if (( changed_count <= INCREMENTAL_LIMIT )); then
    sync_mode="incremental"
    while IFS= read -r path; do
      [[ -n "$path" ]] && append_asset "$path"
    done < <(git diff --no-renames --name-only --diff-filter=ACMR "$BASE_REVISION" "$TARGET_REVISION")
    while IFS= read -r path; do
      [[ -n "$path" ]] && printf '%s\n' "$path" >> "$deleted_tsv"
    done < <(git diff --no-renames --name-only --diff-filter=D "$BASE_REVISION" "$TARGET_REVISION")
  fi
fi

if [[ "$sync_mode" == "full" ]]; then
  # One Git index scan is retained as a fail-safe for first use, divergent
  # history, or unusually large changes.
  while IFS=$'\t' read -r index_meta path; do
    type="$(asset_type "$path")" || continue
    hash="${index_meta#* }"
    hash="${hash%% *}"
    [[ -n "$hash" ]] || continue
    printf '%s\t%s\t%s\n' "$path" "$type" "$hash" >> "$tsv"
  done < <(git ls-files -s)
fi

cat > "$sql" <<'SQL'
BEGIN;
CREATE TEMP TABLE source_asset_stage(asset_path text,asset_type varchar(40),content_hash varchar(64)) ON COMMIT DROP;
CREATE TEMP TABLE deleted_asset_stage(asset_path text) ON COMMIT DROP;
\copy source_asset_stage FROM '/tmp/unified-source-assets.tsv' WITH (FORMAT text,DELIMITER E'\t');
\copy deleted_asset_stage FROM '/tmp/unified-source-assets-deleted.tsv' WITH (FORMAT text);
INSERT INTO framework_unified_asset(asset_id,asset_type,asset_code,asset_name,asset_path,domain_code,description,search_document,metadata_json,source_system,content_hash)
SELECT 'SOURCE:'||md5(asset_path),asset_type,asset_path,regexp_replace(asset_path,'^.*/',''),asset_path,
       CASE WHEN asset_path LIKE 'projects/carbonet-frontend/%' THEN 'FRONTEND' WHEN asset_path LIKE 'apps/%' THEN 'APPLICATION' WHEN asset_path LIKE 'modules/%' THEN 'FRAMEWORK' WHEN asset_path LIKE 'ops/%' THEN 'OPERATIONS' ELSE 'PROJECT' END,
       'Git tracked source asset',replace(asset_path,'/',' ')||' '||asset_type,
       jsonb_build_object('gitPath',asset_path,'extension',regexp_replace(asset_path,'^.*\.','')),'GIT',content_hash
FROM source_asset_stage
ON CONFLICT(asset_id) DO UPDATE SET asset_type=excluded.asset_type,asset_name=excluded.asset_name,asset_path=excluded.asset_path,domain_code=excluded.domain_code,search_document=excluded.search_document,metadata_json=excluded.metadata_json,content_hash=excluded.content_hash,active_yn='Y',last_seen_at=current_timestamp,updated_at=current_timestamp;

INSERT INTO framework_unified_asset_relation(source_asset_id,relation_type,target_asset_id,evidence_text)
SELECT 'SOURCE:'||md5(d.source_path),'DEFINES_PAGE','PAGE:'||d.page_id,d.route_path
FROM framework_design_asset_registry d JOIN source_asset_stage s ON s.asset_path=d.source_path
JOIN framework_unified_asset p ON p.asset_id='PAGE:'||d.page_id
WHERE d.active_yn='Y'
ON CONFLICT(source_asset_id,relation_type,target_asset_id) DO UPDATE SET evidence_text=excluded.evidence_text,active_yn='Y',updated_at=current_timestamp;

UPDATE framework_unified_asset_relation relation
SET active_yn='N',updated_at=current_timestamp
WHERE relation.source_asset_id IN (
  SELECT 'SOURCE:'||md5(asset_path) FROM deleted_asset_stage
);
UPDATE framework_unified_asset asset
SET active_yn='N',updated_at=current_timestamp
WHERE asset.source_system='GIT' AND asset.active_yn='Y'
  AND asset.asset_path IN (SELECT asset_path FROM deleted_asset_stage);

INSERT INTO framework_asset_catalog_sync_run(sync_scope,discovered_count,relation_count,changed_count,duration_ms,result,executed_by)
SELECT :'sync_scope',(SELECT count(*) FROM source_asset_stage),(SELECT count(*) FROM framework_unified_asset_relation WHERE active_yn='Y'),
       (SELECT count(*) FROM source_asset_stage)+(SELECT count(*) FROM deleted_asset_stage),0,'COMPLETED','AUTO_DEPLOY';
COMMIT;
SQL

if [[ "$sync_mode" == "full" ]]; then
  # A full snapshot is authoritative for removals and performs global
  # canonicalization. Incremental Git assets are already unique by normalized
  # source path, so the fast path does not need this table-wide operation.
  sed -i "/INSERT INTO framework_asset_catalog_sync_run/i\\
UPDATE framework_unified_asset SET active_yn='N',updated_at=current_timestamp\\
WHERE source_system='GIT' AND active_yn='Y' AND asset_path NOT IN (SELECT asset_path FROM source_asset_stage);" "$sql"
  sed -i '/COMMIT;/i SELECT * FROM framework_canonicalize_unified_assets('\''AUTO_DEPLOY'\'');' "$sql"
fi

leader=""
while IFS= read -r pod; do
  if [[ "$(kubectl -n "$NAMESPACE" exec "$pod" -c "$POSTGRES_CONTAINER" -- psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)" == "f" ]]; then leader="$pod"; break; fi
done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name | sed 's#^pod/##')
[[ -n "$leader" ]] || { echo "[asset-catalog] writable PostgreSQL leader not found" >&2; exit 1; }
kubectl -n "$NAMESPACE" cp "$tsv" "$leader:/tmp/unified-source-assets.tsv" -c "$POSTGRES_CONTAINER"
kubectl -n "$NAMESPACE" cp "$deleted_tsv" "$leader:/tmp/unified-source-assets-deleted.tsv" -c "$POSTGRES_CONTAINER"
kubectl -n "$NAMESPACE" cp "$sql" "$leader:/tmp/sync-unified-source-assets.sql" -c "$POSTGRES_CONTAINER"
kubectl -n "$NAMESPACE" exec "$leader" -c "$POSTGRES_CONTAINER" -- \
  psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
  -v ON_ERROR_STOP=1 -v sync_scope="GIT_SOURCE_${sync_mode^^}" -q \
  -f /tmp/sync-unified-source-assets.sql
echo "[asset-catalog] mode=$sync_mode upserted=$(wc -l < "$tsv") deleted=$(wc -l < "$deleted_tsv") base=${BASE_REVISION:-none} target=$TARGET_REVISION"
