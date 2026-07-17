#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${CARBONET_DEPLOY_ROOT:-/opt/Resonance}"
NAMESPACE="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"
POSTGRES_CONTAINER="${CARBONET_POSTGRES_CONTAINER:-patroni}"
POSTGRES_DB="${POSTGRES_DB:-carbonet}"
POSTGRES_USER="${POSTGRES_ADMIN_USER:-postgres}"
tsv="$(mktemp)"
sql="$(mktemp)"
trap 'rm -f "$tsv" "$sql"' EXIT

cd "$ROOT_DIR"
while IFS= read -r path; do
  case "$path" in
    *.java) type="JAVA_CLASS" ;;
    *.tsx|*.ts|*.jsx|*.js) type="FRONTEND_SOURCE" ;;
    apps/carbonet-api/src/main/resources/db/migration/postgresql/*.sql) type="DB_MIGRATION" ;;
    *.sql) type="SQL_SOURCE" ;;
    *.xml) type="MAPPER_OR_CONFIG" ;;
    *.css|*.scss) type="STYLE_SOURCE" ;;
    *.sh|*.ps1|*.mjs) type="AUTOMATION_SOURCE" ;;
    *.md|*.txt) type="DOCUMENT" ;;
    *) continue ;;
  esac
  hash="$(git rev-parse "HEAD:$path" 2>/dev/null || true)"
  [[ -n "$hash" ]] || continue
  printf '%s\t%s\t%s\n' "$path" "$type" "$hash" >> "$tsv"
done < <(git ls-files)

cat > "$sql" <<'SQL'
BEGIN;
CREATE TEMP TABLE source_asset_stage(asset_path text,asset_type varchar(40),content_hash varchar(64)) ON COMMIT DROP;
\copy source_asset_stage FROM '/tmp/unified-source-assets.tsv' WITH (FORMAT text,DELIMITER E'\t');
INSERT INTO framework_unified_asset(asset_id,asset_type,asset_code,asset_name,asset_path,domain_code,description,search_document,metadata_json,source_system,content_hash)
SELECT 'SOURCE:'||md5(asset_path),asset_type,asset_path,regexp_replace(asset_path,'^.*/',''),asset_path,
       CASE WHEN asset_path LIKE 'projects/carbonet-frontend/%' THEN 'FRONTEND' WHEN asset_path LIKE 'apps/%' THEN 'APPLICATION' WHEN asset_path LIKE 'modules/%' THEN 'FRAMEWORK' WHEN asset_path LIKE 'ops/%' THEN 'OPERATIONS' ELSE 'PROJECT' END,
       'Git tracked source asset',replace(asset_path,'/',' ')||' '||asset_type,
       jsonb_build_object('gitPath',asset_path,'extension',regexp_replace(asset_path,'^.*\.','')),'GIT',content_hash
FROM source_asset_stage
ON CONFLICT(asset_id) DO UPDATE SET asset_type=excluded.asset_type,asset_name=excluded.asset_name,asset_path=excluded.asset_path,domain_code=excluded.domain_code,search_document=excluded.search_document,metadata_json=excluded.metadata_json,content_hash=excluded.content_hash,active_yn='Y',last_seen_at=current_timestamp,updated_at=current_timestamp;

UPDATE framework_unified_asset SET active_yn='N',updated_at=current_timestamp
WHERE source_system='GIT' AND active_yn='Y' AND asset_path NOT IN (SELECT asset_path FROM source_asset_stage);

INSERT INTO framework_unified_asset_relation(source_asset_id,relation_type,target_asset_id,evidence_text)
SELECT 'SOURCE:'||md5(d.source_path),'DEFINES_PAGE','PAGE:'||d.page_id,d.route_path
FROM framework_design_asset_registry d JOIN source_asset_stage s ON s.asset_path=d.source_path
JOIN framework_unified_asset p ON p.asset_id='PAGE:'||d.page_id
WHERE d.active_yn='Y'
ON CONFLICT(source_asset_id,relation_type,target_asset_id) DO UPDATE SET evidence_text=excluded.evidence_text,active_yn='Y',updated_at=current_timestamp;

INSERT INTO framework_asset_catalog_sync_run(sync_scope,discovered_count,relation_count,changed_count,duration_ms,result,executed_by)
SELECT 'GIT_SOURCE',(SELECT count(*) FROM source_asset_stage),(SELECT count(*) FROM framework_unified_asset_relation WHERE active_yn='Y'),
       (SELECT count(*) FROM source_asset_stage s JOIN framework_unified_asset a ON a.asset_path=s.asset_path AND a.content_hash=s.content_hash),0,'COMPLETED','AUTO_DEPLOY';
SELECT * FROM framework_canonicalize_unified_assets('AUTO_DEPLOY');
COMMIT;
SQL

leader=""
while IFS= read -r pod; do
  if [[ "$(kubectl -n "$NAMESPACE" exec "$pod" -c "$POSTGRES_CONTAINER" -- psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Atqc 'select pg_is_in_recovery()' 2>/dev/null || true)" == "f" ]]; then leader="$pod"; break; fi
done < <(kubectl -n "$NAMESPACE" get pods -l app=postgres-patroni -o name | sed 's#^pod/##')
[[ -n "$leader" ]] || { echo "[asset-catalog] writable PostgreSQL leader not found" >&2; exit 1; }
kubectl -n "$NAMESPACE" cp "$tsv" "$leader:/tmp/unified-source-assets.tsv" -c "$POSTGRES_CONTAINER"
kubectl -n "$NAMESPACE" cp "$sql" "$leader:/tmp/sync-unified-source-assets.sql" -c "$POSTGRES_CONTAINER"
kubectl -n "$NAMESPACE" exec "$leader" -c "$POSTGRES_CONTAINER" -- psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" -v ON_ERROR_STOP=1 -q -f /tmp/sync-unified-source-assets.sql
echo "[asset-catalog] synchronized $(wc -l < "$tsv") Git assets"
