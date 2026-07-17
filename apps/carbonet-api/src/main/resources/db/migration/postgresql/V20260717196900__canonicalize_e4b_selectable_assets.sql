-- E4B must select one semantic asset, while preserving distinct menus and process steps.
CREATE TABLE IF NOT EXISTS framework_asset_canonical_map (
  duplicate_asset_id varchar(180) PRIMARY KEY REFERENCES framework_unified_asset(asset_id) ON DELETE CASCADE,
  canonical_asset_id varchar(180) NOT NULL REFERENCES framework_unified_asset(asset_id),
  semantic_key text NOT NULL,
  merge_reason varchar(80) NOT NULL,
  merged_at timestamp NOT NULL DEFAULT current_timestamp,
  merged_by varchar(100) NOT NULL
);

CREATE OR REPLACE FUNCTION framework_canonicalize_unified_assets(p_actor varchar DEFAULT 'SYSTEM')
RETURNS TABLE(duplicate_groups integer, merged_assets integer, selectable_assets integer)
LANGUAGE plpgsql AS $$
DECLARE v_groups integer := 0; v_merged integer := 0; v_selectable integer := 0;
BEGIN
  DROP TABLE IF EXISTS pg_temp.canonical_candidate;
  CREATE TEMP TABLE canonical_candidate ON COMMIT DROP AS
  WITH keyed AS (
    SELECT a.*,
      CASE
        WHEN asset_type IN ('COMPONENT','SECTION','PROPERTY') AND nullif(content_hash,'') IS NOT NULL
          THEN asset_type||':FINGERPRINT:'||lower(content_hash)
        WHEN asset_type='PAGE' AND nullif(trim(asset_path),'') IS NOT NULL
          THEN asset_type||':ROUTE:'||lower(regexp_replace(split_part(trim(asset_path),'?',1),'/+$',''))
        WHEN source_system='GIT' AND nullif(trim(asset_path),'') IS NOT NULL
          THEN asset_type||':SOURCE:'||lower(replace(trim(asset_path),chr(92),'/'))
        ELSE asset_type||':CODE:'||lower(trim(asset_code))
      END semantic_key
    FROM framework_unified_asset a WHERE active_yn='Y'
  ), ranked AS (
    SELECT k.*,
      first_value(asset_id) OVER (PARTITION BY semantic_key ORDER BY
        CASE WHEN source_system IN ('PAGE_DB','DESIGN_DB','PROCESS_DB','MENU_DB') THEN 0 ELSE 1 END,
        first_seen_at,asset_id) canonical_asset_id,
      count(*) OVER (PARTITION BY semantic_key) group_size
    FROM keyed k
  )
  SELECT asset_id duplicate_asset_id,canonical_asset_id,semantic_key,group_size
  FROM ranked WHERE asset_id<>canonical_asset_id;

  SELECT count(DISTINCT semantic_key),count(*) INTO v_groups,v_merged FROM canonical_candidate;

  INSERT INTO framework_asset_canonical_map(duplicate_asset_id,canonical_asset_id,semantic_key,merge_reason,merged_by)
  SELECT duplicate_asset_id,canonical_asset_id,semantic_key,'SEMANTIC_DUPLICATE',p_actor
  FROM canonical_candidate
  ON CONFLICT(duplicate_asset_id) DO UPDATE SET canonical_asset_id=excluded.canonical_asset_id,
    semantic_key=excluded.semantic_key,merged_at=current_timestamp,merged_by=excluded.merged_by;

  INSERT INTO framework_unified_asset_relation(source_asset_id,relation_type,target_asset_id,evidence_text,active_yn,updated_at)
  SELECT DISTINCT coalesce(s.canonical_asset_id,r.source_asset_id),r.relation_type,
         coalesce(t.canonical_asset_id,r.target_asset_id),r.evidence_text,'Y',current_timestamp
  FROM framework_unified_asset_relation r
  LEFT JOIN canonical_candidate s ON s.duplicate_asset_id=r.source_asset_id
  LEFT JOIN canonical_candidate t ON t.duplicate_asset_id=r.target_asset_id
  WHERE r.active_yn='Y' AND (s.duplicate_asset_id IS NOT NULL OR t.duplicate_asset_id IS NOT NULL)
    AND coalesce(s.canonical_asset_id,r.source_asset_id)<>coalesce(t.canonical_asset_id,r.target_asset_id)
  ON CONFLICT(source_asset_id,relation_type,target_asset_id) DO UPDATE
    SET evidence_text=excluded.evidence_text,active_yn='Y',updated_at=current_timestamp;

  UPDATE framework_unified_asset_relation r SET active_yn='N',updated_at=current_timestamp
  WHERE EXISTS (SELECT 1 FROM canonical_candidate c
                WHERE c.duplicate_asset_id=r.source_asset_id OR c.duplicate_asset_id=r.target_asset_id);

  UPDATE framework_unified_asset a SET active_yn='N',updated_at=current_timestamp,
    metadata_json=a.metadata_json||jsonb_build_object('canonicalAssetId',c.canonical_asset_id,'duplicateStatus','MERGED')
  FROM canonical_candidate c WHERE a.asset_id=c.duplicate_asset_id;

  SELECT count(*) INTO v_selectable FROM framework_unified_asset WHERE active_yn='Y';
  RETURN QUERY SELECT v_groups,v_merged,v_selectable;
END $$;

CREATE OR REPLACE VIEW framework_e4b_selectable_asset AS
SELECT a.asset_id,a.asset_type,a.asset_code,a.asset_name,a.asset_path,a.domain_code,a.description,
       a.search_document,a.search_vector,a.metadata_json,a.source_system,a.content_hash,a.updated_at,
       coalesce(rel.reference_count,0) reference_count,
       CASE WHEN a.asset_type='PAGE' AND coalesce(rel.reference_count,0)=0 THEN 'EXTEND'
            WHEN a.asset_type='PAGE' THEN 'ADOPT'
            ELSE 'SELECTABLE' END selection_status
FROM framework_unified_asset a
LEFT JOIN (
  SELECT asset_id,count(*) reference_count FROM (
    SELECT source_asset_id asset_id FROM framework_unified_asset_relation WHERE active_yn='Y'
    UNION ALL SELECT target_asset_id FROM framework_unified_asset_relation WHERE active_yn='Y'
  ) r GROUP BY asset_id
) rel ON rel.asset_id=a.asset_id
WHERE a.active_yn='Y'
  AND NOT EXISTS (SELECT 1 FROM framework_asset_canonical_map m WHERE m.duplicate_asset_id=a.asset_id);

CREATE OR REPLACE VIEW framework_e4b_page_development_queue AS
SELECT asset_id,page_id,asset_name,asset_path,domain_code,reference_count,
       CASE
         WHEN source_count>0 AND menu_count>0 AND reference_count>0 THEN 'ADOPT'
         WHEN source_count>0 OR menu_count>0 THEN 'EXTEND'
         WHEN asset_path IS NULL OR trim(asset_path)='' THEN 'REPLACE'
         ELSE 'RETIRE_REVIEW'
       END development_decision
FROM (
  SELECT a.*,a.asset_code page_id,
    (SELECT count(*) FROM framework_unified_asset_relation r WHERE r.active_yn='Y' AND r.target_asset_id=a.asset_id AND r.relation_type='DEFINES_PAGE') source_count,
    (SELECT count(*) FROM framework_unified_asset_relation r WHERE r.active_yn='Y' AND r.target_asset_id=a.asset_id AND r.relation_type='ROUTES_TO') menu_count
  FROM framework_e4b_selectable_asset a WHERE a.asset_type='PAGE'
) q;

SELECT * FROM framework_canonicalize_unified_assets('FLYWAY');

CREATE UNIQUE INDEX IF NOT EXISTS uq_active_page_route
  ON framework_unified_asset(lower(regexp_replace(split_part(trim(asset_path),'?',1),'/+$','')))
  WHERE active_yn='Y' AND asset_type='PAGE' AND nullif(trim(asset_path),'') IS NOT NULL;
