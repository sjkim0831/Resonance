#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="${CARBONET_DEPLOY_ROOT:-/opt/Resonance}"
POSTGRES_ADAPTER="$ROOT_DIR/ops/scripts/lib/carbonet-postgres-query.sh"
NAMESPACE="${CARBONET_K8S_NAMESPACE:-carbonet-prod}"
POSTGRES_CONTAINER="${CARBONET_POSTGRES_CONTAINER:-patroni}"
POSTGRES_DB="${POSTGRES_DB:-carbonet}"
POSTGRES_USER="${POSTGRES_ADMIN_USER:-postgres}"
BASE_REVISION="${1:-}"
TARGET_REVISION="${2:-HEAD}"
INCREMENTAL_LIMIT="${UNIFIED_ASSET_INCREMENTAL_LIMIT:-2000}"
tsv="$(mktemp)"
deleted_tsv="$(mktemp)"
manifest_tsv="$(mktemp)"
sql="$(mktemp)"
trap 'rm -f "$tsv" "$deleted_tsv" "$manifest_tsv" "$sql"' EXIT

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
    *.json|*.jsonl|*.yaml|*.yml|*.toml|*.properties|*.conf|*.ini|*.env.example) echo "CONFIGURATION" ;;
    *.gradle|*.kts|gradlew|gradlew.bat|Dockerfile|*/Dockerfile) echo "BUILD_SOURCE" ;;
    *.png|*.jpg|*.jpeg|*.gif|*.webp|*.svg|*.ico) echo "IMAGE_ASSET" ;;
    *.woff|*.woff2|*.ttf|*.otf) echo "FONT_ASSET" ;;
    *.pdf|*.doc|*.docx|*.xls|*.xlsx|*.ppt|*.pptx) echo "REFERENCE_DOCUMENT" ;;
    *.csv|*.tsv|*.parquet) echo "DATA_ASSET" ;;
    *) echo "PROJECT_FILE" ;;
  esac
}

append_asset() {
  local path="$1" index_meta type hash
  type="$(asset_type "$path")"
  index_meta="$(git ls-files -s -- "$path")"
  [[ -n "$index_meta" ]] || return 0
  hash="${index_meta#* }"
  hash="${hash%% *}"
  [[ -n "$hash" ]] || return 0
  printf '%s\t%s\t%s\n' "$path" "$type" "$hash" >> "$tsv"
}

build_complete_manifest() {
  # Full/nightly reconciliation remains authoritative. Incremental deploys use
  # the Git revision delta as their bounded contract and avoid sending 40k+
  # unchanged rows through PostgreSQL on every commit.
  git ls-files -s | awk '
function asset_type(path, lower) {
  lower=tolower(path)
  if (lower ~ /\.java$/) return "JAVA_CLASS"
  if (lower ~ /\.(tsx|ts|jsx|js)$/) return "FRONTEND_SOURCE"
  if (lower ~ /^apps\/carbonet-api\/src\/main\/resources\/db\/migration\/postgresql\/.*\.sql$/) return "DB_MIGRATION"
  if (lower ~ /\.sql$/) return "SQL_SOURCE"
  if (lower ~ /\.xml$/) return "MAPPER_OR_CONFIG"
  if (lower ~ /\.(css|scss)$/) return "STYLE_SOURCE"
  if (lower ~ /\.(sh|ps1|mjs)$/) return "AUTOMATION_SOURCE"
  if (lower ~ /\.(md|txt)$/) return "DOCUMENT"
  if (lower ~ /\.(json|jsonl|yaml|yml|toml|properties|conf|ini|env\.example)$/) return "CONFIGURATION"
  if (lower ~ /\.(gradle|kts)$/ || lower ~ /(^|\/)gradlew(\.bat)?$/ || lower ~ /(^|\/)dockerfile$/) return "BUILD_SOURCE"
  if (lower ~ /\.(png|jpg|jpeg|gif|webp|svg|ico)$/) return "IMAGE_ASSET"
  if (lower ~ /\.(woff|woff2|ttf|otf)$/) return "FONT_ASSET"
  if (lower ~ /\.(pdf|doc|docx|xls|xlsx|ppt|pptx)$/) return "REFERENCE_DOCUMENT"
  if (lower ~ /\.(csv|tsv|parquet)$/) return "DATA_ASSET"
  return "PROJECT_FILE"
}
{
  tab=index($0, "\t")
  if (!tab) next
  metadata=substr($0, 1, tab-1)
  path=substr($0, tab+1)
  split(metadata, fields, " ")
  hash=fields[2]
  if (path != "" && hash != "") print path "\t" asset_type(path) "\t" hash
}' > "$manifest_tsv"
}

sync_mode="full"
validate_e4b=true
if [[ -n "$BASE_REVISION" ]] &&
   git cat-file -e "$BASE_REVISION^{commit}" 2>/dev/null &&
   git cat-file -e "$TARGET_REVISION^{commit}" 2>/dev/null &&
   git merge-base --is-ancestor "$BASE_REVISION" "$TARGET_REVISION"; then
  changed_count="$(git diff --no-renames --name-only "$BASE_REVISION" "$TARGET_REVISION" | wc -l)"
  if (( changed_count <= INCREMENTAL_LIMIT )); then
    sync_mode="incremental"
    validate_e4b=false
    while IFS= read -r path; do
      if [[ -n "$path" ]]; then
        append_asset "$path"
        case "$path" in
          *.md|*.txt) ;;
          *) validate_e4b=true ;;
        esac
      fi
    done < <(git diff --no-renames --name-only --diff-filter=ACMR "$BASE_REVISION" "$TARGET_REVISION")
    while IFS= read -r path; do
      if [[ -n "$path" ]]; then
        printf '%s\n' "$path" >> "$deleted_tsv"
        case "$path" in
          *.md|*.txt) ;;
          *) validate_e4b=true ;;
        esac
      fi
    done < <(git diff --no-renames --name-only --diff-filter=D "$BASE_REVISION" "$TARGET_REVISION")
  fi
fi

if [[ "$sync_mode" == "full" ]]; then
  build_complete_manifest
  cp "$manifest_tsv" "$tsv"
fi

cat > "$sql" <<'SQL'
BEGIN;
CREATE TEMP TABLE source_asset_stage(asset_path text,asset_type varchar(40),content_hash varchar(64)) ON COMMIT DROP;
CREATE TEMP TABLE deleted_asset_stage(asset_path text) ON COMMIT DROP;
CREATE TEMP TABLE source_manifest_stage(asset_path text,asset_type varchar(40),content_hash varchar(64)) ON COMMIT DROP;
CREATE TEMP TABLE asset_sync_control(is_full boolean,validate_e4b boolean) ON COMMIT DROP;
CREATE TEMP TABLE asset_sync_delta(active_before integer,additions integer,deletions integer) ON COMMIT DROP;
INSERT INTO asset_sync_control VALUES (:'is_full'::boolean,:'validate_e4b'::boolean);
\copy source_asset_stage FROM '/tmp/unified-source-assets.tsv' WITH (FORMAT text,DELIMITER E'\t');
\copy deleted_asset_stage FROM '/tmp/unified-source-assets-deleted.tsv' WITH (FORMAT text);
\copy source_manifest_stage FROM '/tmp/unified-source-assets-manifest.tsv' WITH (FORMAT text,DELIMITER E'\t');
INSERT INTO asset_sync_delta(active_before,additions,deletions)
SELECT
  coalesce(
    (
      SELECT discovered_count
      FROM framework_asset_catalog_sync_run
      WHERE sync_scope LIKE 'GIT_SOURCE_%' AND result='COMPLETED'
      ORDER BY sync_run_id DESC
      LIMIT 1
    ),
    (
      SELECT count(*)
      FROM framework_unified_asset
      WHERE source_system='GIT' AND active_yn='Y'
    )
  ),
  (
    SELECT count(*)
    FROM source_asset_stage changed
    LEFT JOIN framework_unified_asset asset
      ON asset.source_system='GIT'
     AND asset.asset_path=changed.asset_path
     AND asset.active_yn='Y'
    WHERE asset.asset_id IS NULL
  ),
  (
    SELECT count(*)
    FROM deleted_asset_stage deleted
    JOIN framework_unified_asset asset
      ON asset.source_system='GIT'
     AND asset.asset_path=deleted.asset_path
     AND asset.active_yn='Y'
  );
INSERT INTO source_asset_stage(asset_path,asset_type,content_hash)
SELECT manifest.asset_path,manifest.asset_type,manifest.content_hash
FROM source_manifest_stage manifest
LEFT JOIN framework_unified_asset asset
  ON asset.source_system='GIT'
 AND asset.asset_path=manifest.asset_path
 AND asset.active_yn='Y'
WHERE (asset.asset_id IS NULL
   OR asset.content_hash IS DISTINCT FROM manifest.content_hash)
  AND NOT EXISTS (
    SELECT 1 FROM source_asset_stage changed WHERE changed.asset_path=manifest.asset_path
  );
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
  AND EXISTS (
    SELECT 1 FROM deleted_asset_stage deleted WHERE deleted.asset_path=asset.asset_path
  );
UPDATE framework_unified_asset asset
SET active_yn='N',updated_at=current_timestamp
WHERE (SELECT is_full FROM asset_sync_control)
  AND asset.source_system='GIT' AND asset.active_yn='Y'
  AND NOT EXISTS (
    SELECT 1 FROM source_manifest_stage manifest WHERE manifest.asset_path=asset.asset_path
  );

DO $$
DECLARE
  missing_count integer;
  stale_count integer;
  hash_mismatch_count integer;
  duplicate_count integer;
  changed_missing_count integer;
  changed_hash_mismatch_count integer;
  deleted_active_count integer;
  missing_examples text;
BEGIN
  SELECT count(*) INTO missing_count
  FROM source_manifest_stage manifest
  LEFT JOIN framework_unified_asset asset
    ON asset.source_system='GIT'
   AND asset.asset_path=manifest.asset_path
   AND asset.active_yn='Y'
  WHERE asset.asset_id IS NULL;
  SELECT string_agg(asset_path, ', ' ORDER BY asset_path)
  INTO missing_examples
  FROM (
    SELECT manifest.asset_path
    FROM source_manifest_stage manifest
    LEFT JOIN framework_unified_asset asset
      ON asset.source_system='GIT'
     AND asset.asset_path=manifest.asset_path
     AND asset.active_yn='Y'
    WHERE asset.asset_id IS NULL
    ORDER BY manifest.asset_path
    LIMIT 20
  ) missing;
  SELECT count(*) INTO stale_count
  FROM framework_unified_asset asset
  WHERE (SELECT is_full FROM asset_sync_control)
    AND asset.source_system='GIT' AND asset.active_yn='Y'
    AND NOT EXISTS (
      SELECT 1 FROM source_manifest_stage manifest WHERE manifest.asset_path=asset.asset_path
    );
  SELECT count(*) INTO hash_mismatch_count
  FROM source_manifest_stage manifest
  JOIN framework_unified_asset asset
    ON asset.source_system='GIT'
   AND asset.asset_path=manifest.asset_path
   AND asset.active_yn='Y'
  WHERE asset.content_hash IS DISTINCT FROM manifest.content_hash;
  IF (SELECT is_full FROM asset_sync_control) THEN
    SELECT count(*) INTO duplicate_count
    FROM (
      SELECT asset_path
      FROM framework_unified_asset
      WHERE source_system='GIT' AND active_yn='Y'
      GROUP BY asset_path
      HAVING count(*) > 1
    ) duplicate;
  ELSE
    SELECT count(*) INTO duplicate_count
    FROM (
      SELECT asset.asset_path
      FROM framework_unified_asset asset
      JOIN source_asset_stage changed ON changed.asset_path=asset.asset_path
      WHERE asset.source_system='GIT' AND asset.active_yn='Y'
      GROUP BY asset.asset_path
      HAVING count(*) > 1
    ) duplicate;
  END IF;
  SELECT count(*) INTO changed_missing_count
  FROM source_asset_stage changed
  LEFT JOIN framework_unified_asset asset
    ON asset.source_system='GIT'
   AND asset.asset_path=changed.asset_path
   AND asset.active_yn='Y'
  WHERE asset.asset_id IS NULL;
  SELECT count(*) INTO changed_hash_mismatch_count
  FROM source_asset_stage changed
  JOIN framework_unified_asset asset
    ON asset.source_system='GIT'
   AND asset.asset_path=changed.asset_path
   AND asset.active_yn='Y'
  WHERE asset.content_hash IS DISTINCT FROM changed.content_hash;
  SELECT count(*) INTO deleted_active_count
  FROM deleted_asset_stage deleted
  JOIN framework_unified_asset asset
    ON asset.source_system='GIT'
   AND asset.asset_path=deleted.asset_path
   AND asset.active_yn='Y';
  IF missing_count > 0 OR stale_count > 0 OR hash_mismatch_count > 0 OR duplicate_count > 0
     OR changed_missing_count > 0 OR changed_hash_mismatch_count > 0 OR deleted_active_count > 0 THEN
    RAISE EXCEPTION
      'unified asset closure failed missing=% stale=% hash_mismatch=% duplicate=% changed_missing=% changed_hash_mismatch=% deleted_active=% examples=%',
      missing_count, stale_count, hash_mismatch_count, duplicate_count,
      changed_missing_count, changed_hash_mismatch_count, deleted_active_count,
      coalesce(missing_examples, '-');
  END IF;
END $$;

-- E4B selection integrity belongs to the same atomic contract as source
-- catalog synchronization. Validate it before COMMIT so deployment never
-- needs a second leader discovery/session and a failed invariant rolls back
-- the catalog mutation rather than observing it after the fact.
DO $$
DECLARE
  active_duplicate_count integer;
  broken_relation_count integer;
  page_count integer;
  classified_page_count integer;
BEGIN
  IF NOT (SELECT validate_e4b FROM asset_sync_control) THEN
    RETURN;
  END IF;
  SELECT count(*) INTO active_duplicate_count
  FROM framework_asset_canonical_map map
  JOIN framework_unified_asset asset
    ON asset.asset_id=map.duplicate_asset_id
  WHERE asset.active_yn='Y';

  SELECT count(*) INTO broken_relation_count
  FROM framework_unified_asset_relation relation
  LEFT JOIN framework_unified_asset source
    ON source.asset_id=relation.source_asset_id
  LEFT JOIN framework_unified_asset target
    ON target.asset_id=relation.target_asset_id
  WHERE relation.active_yn='Y'
    AND (source.active_yn<>'Y' OR target.active_yn<>'Y');

  SELECT count(*) INTO page_count
  FROM framework_e4b_selectable_asset
  WHERE asset_type='PAGE';

  SELECT count(*) INTO classified_page_count
  FROM framework_e4b_page_development_queue;

  IF active_duplicate_count <> 0
     OR broken_relation_count <> 0
     OR page_count <> classified_page_count THEN
    RAISE EXCEPTION
      'E4B asset integrity failed active_duplicates=% broken_relations=% pages=% classified=%',
      active_duplicate_count,broken_relation_count,page_count,classified_page_count;
  END IF;
END $$;

INSERT INTO framework_asset_catalog_sync_run(sync_scope,discovered_count,relation_count,changed_count,duration_ms,result,executed_by)
SELECT :'sync_scope',
       CASE WHEN (SELECT is_full FROM asset_sync_control)
         THEN (SELECT count(*) FROM source_manifest_stage)
         ELSE (
           SELECT active_before + additions - deletions
           FROM asset_sync_delta
         )
       END,
       (SELECT count(*) FROM framework_unified_asset_relation WHERE active_yn='Y'),
       (SELECT count(*) FROM source_asset_stage)+(SELECT count(*) FROM deleted_asset_stage),0,'COMPLETED','AUTO_DEPLOY';
COMMIT;
SQL

if [[ "$sync_mode" == "full" ]]; then
  # Incremental runs prove closure from the complete manifest; only global
  # semantic canonicalization remains exclusive to the full first-run path.
  sed -i '/COMMIT;/i SELECT * FROM framework_canonicalize_unified_assets('\''AUTO_DEPLOY'\'');' "$sql"
fi

[[ -f "$POSTGRES_ADAPTER" ]] || {
  echo "[asset-catalog] PostgreSQL query adapter is missing: $POSTGRES_ADAPTER" >&2
  exit 1
}
# shellcheck source=ops/scripts/lib/carbonet-postgres-query.sh
source "$POSTGRES_ADAPTER"
CARBONET_PG_NAMESPACE="$NAMESPACE"
CARBONET_PG_CONTAINER="$POSTGRES_CONTAINER"
carbonet_postgres_query_init
if [[ "$CARBONET_PG_MODE" == "direct" ]]; then
  sed -i \
    -e "s#/tmp/unified-source-assets.tsv#$tsv#g" \
    -e "s#/tmp/unified-source-assets-deleted.tsv#$deleted_tsv#g" \
    -e "s#/tmp/unified-source-assets-manifest.tsv#$manifest_tsv#g" \
    "$sql"
  PGPASSWORD="$CARBONET_PG_PASSWORD" \
    psql -w -X -q \
      -h "$CARBONET_PG_HOST" -p "$CARBONET_PG_PORT" \
      -U "$CARBONET_PG_USER" -d "$CARBONET_PG_DATABASE" \
      -v ON_ERROR_STOP=1 -v sync_scope="GIT_SOURCE_${sync_mode^^}" \
      -v is_full="$([[ "$sync_mode" == "full" ]] && echo true || echo false)" \
      -v validate_e4b="$validate_e4b" \
      -f "$sql"
else
  leader="$CARBONET_PG_LEADER"
  [[ -n "$leader" ]] || { echo "[asset-catalog] writable PostgreSQL leader not found" >&2; exit 1; }
  kubectl -n "$NAMESPACE" cp "$tsv" "$leader:/tmp/unified-source-assets.tsv" -c "$POSTGRES_CONTAINER"
  kubectl -n "$NAMESPACE" cp "$deleted_tsv" "$leader:/tmp/unified-source-assets-deleted.tsv" -c "$POSTGRES_CONTAINER"
  kubectl -n "$NAMESPACE" cp "$manifest_tsv" "$leader:/tmp/unified-source-assets-manifest.tsv" -c "$POSTGRES_CONTAINER"
  kubectl -n "$NAMESPACE" cp "$sql" "$leader:/tmp/sync-unified-source-assets.sql" -c "$POSTGRES_CONTAINER"
  kubectl -n "$NAMESPACE" exec "$leader" -c "$POSTGRES_CONTAINER" -- \
    psql -h 127.0.0.1 -U "$POSTGRES_USER" -d "$POSTGRES_DB" \
    -v ON_ERROR_STOP=1 -v sync_scope="GIT_SOURCE_${sync_mode^^}" \
    -v is_full="$([[ "$sync_mode" == "full" ]] && echo true || echo false)" \
    -v validate_e4b="$validate_e4b" -q \
    -f /tmp/sync-unified-source-assets.sql
fi
echo "[asset-catalog] mode=$sync_mode tracked=$(wc -l < "$manifest_tsv") changed=$(wc -l < "$tsv") deleted=$(wc -l < "$deleted_tsv") closure=verified e4b=$([[ "$validate_e4b" == "true" ]] && echo verified || echo unchanged) dbMode=$CARBONET_PG_MODE base=${BASE_REVISION:-none} target=$TARGET_REVISION"
