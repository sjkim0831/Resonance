-- Historical public/user HTML screens are reference material, not active
-- application routes. Keep them isolated from framework_screen_resource until
-- an explicit adoption review binds one to a governed screen and process step.

CREATE TABLE IF NOT EXISTS framework_legacy_frontend_reference (
  reference_id varchar(80) PRIMARY KEY,
  source_path text NOT NULL UNIQUE,
  source_family varchar(80) NOT NULL,
  screen_name varchar(300) NOT NULL,
  language_code varchar(12) NOT NULL DEFAULT 'ko',
  audience varchar(16) NOT NULL DEFAULT 'PUBLIC'
    CHECK (audience IN ('PUBLIC','USER')),
  asset_kind varchar(32) NOT NULL DEFAULT 'HTML_FRONTEND'
    CHECK (asset_kind='HTML_FRONTEND'),
  reference_status varchar(32) NOT NULL DEFAULT 'LEGACY_REFERENCE'
    CHECK (reference_status IN ('LEGACY_REFERENCE','REVIEWED','RETIRED')),
  reuse_decision varchar(32) NOT NULL DEFAULT 'REVIEW_REQUIRED'
    CHECK (reuse_decision IN (
      'REVIEW_REQUIRED','ADOPT_EXISTING','REUSE_SECTION',
      'REFERENCE_ONLY','REPLACED','RETIRED'
    )),
  content_hash varchar(64) NOT NULL,
  extracted_contract jsonb NOT NULL DEFAULT '{}'::jsonb,
  process_hints jsonb NOT NULL DEFAULT '[]'::jsonb,
  discovered_at timestamp NOT NULL DEFAULT current_timestamp,
  reviewed_at timestamp,
  reviewed_by varchar(100),
  updated_at timestamp NOT NULL DEFAULT current_timestamp
);

CREATE INDEX IF NOT EXISTS idx_legacy_frontend_family
  ON framework_legacy_frontend_reference(source_family,reference_status);
CREATE INDEX IF NOT EXISTS idx_legacy_frontend_decision
  ON framework_legacy_frontend_reference(reuse_decision,reference_status);

CREATE TABLE IF NOT EXISTS framework_legacy_frontend_process_candidate (
  reference_id varchar(80) NOT NULL
    REFERENCES framework_legacy_frontend_reference(reference_id)
    ON DELETE CASCADE,
  process_code varchar(80) NOT NULL
    REFERENCES framework_process_definition(process_code)
    ON DELETE CASCADE,
  step_code varchar(100) NOT NULL,
  match_reason text NOT NULL,
  confidence numeric(5,4) NOT NULL CHECK(confidence BETWEEN 0 AND 1),
  mapping_status varchar(24) NOT NULL DEFAULT 'CANDIDATE'
    CHECK(mapping_status IN ('CANDIDATE','APPROVED','REJECTED')),
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  updated_at timestamp NOT NULL DEFAULT current_timestamp,
  PRIMARY KEY(reference_id,process_code,step_code),
  FOREIGN KEY(process_code,step_code)
    REFERENCES framework_process_step(process_code,step_code)
    ON DELETE CASCADE
);

CREATE OR REPLACE FUNCTION framework_import_legacy_frontend_references(
  payload jsonb,
  imported_by varchar DEFAULT 'LEGACY_FRONTEND_INVENTORY'
) RETURNS jsonb LANGUAGE plpgsql AS $function$
DECLARE
  item jsonb;
  imported integer := 0;
BEGIN
  IF jsonb_typeof(payload) <> 'array' THEN
    RAISE EXCEPTION 'legacy frontend payload must be an array';
  END IF;

  FOR item IN SELECT value FROM jsonb_array_elements(payload)
  LOOP
    IF coalesce(item->>'sourcePath','') !~ '^/opt/reference/screen/' THEN
      RAISE EXCEPTION 'source outside governed legacy root: %',
        item->>'sourcePath';
    END IF;
    IF coalesce(item->>'assetKind','') <> 'HTML_FRONTEND' THEN
      RAISE EXCEPTION 'unsupported legacy asset kind: %',
        item->>'assetKind';
    END IF;

    INSERT INTO framework_legacy_frontend_reference(
      reference_id,source_path,source_family,screen_name,language_code,
      audience,asset_kind,reference_status,reuse_decision,content_hash,
      extracted_contract,process_hints,updated_at
    ) VALUES (
      item->>'referenceId',item->>'sourcePath',item->>'sourceFamily',
      item->>'screenName',coalesce(nullif(item->>'languageCode',''),'ko'),
      coalesce(nullif(item->>'audience',''),'PUBLIC'),'HTML_FRONTEND',
      'LEGACY_REFERENCE',
      CASE
        WHEN item->>'reuseDecision' IN (
          'ADOPT_EXISTING','REUSE_SECTION','REFERENCE_ONLY',
          'REPLACED','REVIEW_REQUIRED','RETIRED'
        ) THEN item->>'reuseDecision'
        ELSE 'REVIEW_REQUIRED'
      END,
      item->>'contentHash',coalesce(item->'contract','{}'::jsonb),
      coalesce(item->'processHints','[]'::jsonb),current_timestamp
    )
    ON CONFLICT(reference_id) DO UPDATE SET
      source_path=excluded.source_path,
      source_family=excluded.source_family,
      screen_name=excluded.screen_name,
      language_code=excluded.language_code,
      audience=excluded.audience,
      content_hash=excluded.content_hash,
      extracted_contract=excluded.extracted_contract,
      process_hints=excluded.process_hints,
      -- Never overwrite a human review decision during rediscovery.
      reuse_decision=CASE
        WHEN framework_legacy_frontend_reference.reuse_decision='REVIEW_REQUIRED'
          THEN excluded.reuse_decision
        ELSE framework_legacy_frontend_reference.reuse_decision
      END,
      updated_at=current_timestamp;
    imported := imported + 1;
  END LOOP;

  DELETE FROM framework_legacy_frontend_process_candidate c
  USING framework_legacy_frontend_reference r
  WHERE c.reference_id=r.reference_id
    AND c.mapping_status='CANDIDATE';

  INSERT INTO framework_legacy_frontend_process_candidate(
    reference_id,process_code,step_code,match_reason,confidence,mapping_status
  )
  SELECT
    r.reference_id,p.process_code,step.step_code,
    'HTML 제목·경로·헤딩에서 추출된 프로세스 힌트: ' || hint.process_code,
    CASE
      WHEN hint.process_code='CUSTOMER_WORK_COORDINATION' THEN 0.5500
      ELSE 0.8000
    END,
    'CANDIDATE'
  FROM framework_legacy_frontend_reference r
  CROSS JOIN LATERAL jsonb_array_elements_text(r.process_hints)
    AS hint(process_code)
  JOIN framework_process_definition p
    ON p.process_code=hint.process_code
  JOIN LATERAL (
    SELECT s.step_code
    FROM framework_process_step s
    WHERE s.process_code=p.process_code
    ORDER BY s.step_order,s.step_code
    LIMIT 1
  ) step ON true
  ON CONFLICT(reference_id,process_code,step_code) DO UPDATE SET
    match_reason=excluded.match_reason,
    confidence=excluded.confidence,
    updated_at=current_timestamp;

  RETURN jsonb_build_object(
    'imported',imported,
    'catalogTotal',(SELECT count(*) FROM framework_legacy_frontend_reference),
    'reviewRequired',(SELECT count(*) FROM framework_legacy_frontend_reference
      WHERE reuse_decision='REVIEW_REQUIRED'),
    'processCandidates',(
      SELECT count(*) FROM framework_legacy_frontend_process_candidate
      WHERE mapping_status='CANDIDATE'
    ),
    'unmappedReferences',(
      SELECT count(*) FROM framework_legacy_frontend_reference r
      WHERE NOT EXISTS(
        SELECT 1 FROM framework_legacy_frontend_process_candidate c
        WHERE c.reference_id=r.reference_id
      )
    ),
    'importedBy',imported_by
  );
END
$function$;

CREATE OR REPLACE VIEW framework_legacy_frontend_reference_status AS
SELECT
  r.reference_id,r.source_family,r.screen_name,r.language_code,r.audience,
  r.reference_status,r.reuse_decision,r.source_path,r.content_hash,
  jsonb_array_length(coalesce(r.extracted_contract->'sections','[]'::jsonb))
    AS section_count,
  jsonb_array_length(coalesce(r.extracted_contract->'links','[]'::jsonb))
    AS link_count,
  jsonb_array_length(coalesce(r.extracted_contract->'forms','[]'::jsonb))
    AS form_count,
  jsonb_array_length(coalesce(r.process_hints,'[]'::jsonb))
    AS process_hint_count,
  count(c.*) FILTER (WHERE c.mapping_status='APPROVED')
    AS approved_process_binding_count,
  r.updated_at
FROM framework_legacy_frontend_reference r
LEFT JOIN framework_legacy_frontend_process_candidate c
  ON c.reference_id=r.reference_id
GROUP BY r.reference_id;

COMMENT ON TABLE framework_legacy_frontend_reference IS
'과거 비관리자 HTML 화면의 격리된 참조 카탈로그. 명시적 검토 전에는 메뉴, 라우트, 활성 프로세스에 연결하지 않는다.';
COMMENT ON TABLE framework_legacy_frontend_process_candidate IS
'과거 화면과 현재 프로세스 단계의 N:M 검토 후보. APPROVED만 채택 자동화의 입력이 된다.';
