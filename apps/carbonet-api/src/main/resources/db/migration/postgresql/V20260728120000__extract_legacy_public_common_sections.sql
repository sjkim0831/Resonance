-- Register only genuinely reusable section contracts. These assets become
-- selectable in design management but are not applied to any route/page.
INSERT INTO ui_section_registry(
  section_id,section_name,section_type,layout_contract,responsive_contract,
  accessibility_contract,design_reference,asset_fingerprint,active_yn,
  updated_at
) VALUES
  (
    'GLOBAL_SERVICE_HEADER','Global Service Header','GLOBAL_NAVIGATION',
    'government banner,brand,primary navigation,utility actions,account state',
    'desktop mega navigation; tablet compact navigation; mobile drawer without horizontal overflow',
    'skip link,landmark navigation,keyboard submenu,visible focus,current page state',
    'KRDS_GOV_DEFAULT',md5('GLOBAL_SERVICE_HEADER|KRDS|1'),'Y',
    current_timestamp
  ),
  (
    'AUTHENTICATION_PANEL','Authentication Panel','AUTHENTICATION',
    'identity context,credential fields,verification method,security notice,primary and recovery actions',
    'single column mobile; bounded readable width; controls remain at least 44px',
    'labelled controls,error summary,autocomplete contract,status announcement,no color-only errors',
    'KRDS_GOV_DEFAULT',md5('AUTHENTICATION_PANEL|KRDS|1'),'Y',
    current_timestamp
  ),
  (
    'PROCESS_STEP_FLOW','Process Step Flow','PROCESS_NAVIGATION',
    'ordered steps,current step,completion state,blocked reason,next action',
    'horizontal desktop; compact or vertical mobile; labels never clipped',
    'ordered-list semantics,aria-current,non-color status,keyboard reachable steps',
    'KRDS_GOV_DEFAULT',md5('PROCESS_STEP_FLOW|KRDS|1'),'Y',
    current_timestamp
  ),
  (
    'HELP_SUPPORT_PANEL','Help and Support Panel','SUPPORT',
    'context help,frequent questions,contact action,related links',
    'sidebar desktop; inline collapsible mobile',
    'labelled disclosure,descriptive links,keyboard operation,contact alternatives',
    'KRDS_GOV_DEFAULT',md5('HELP_SUPPORT_PANEL|KRDS|1'),'Y',
    current_timestamp
  )
ON CONFLICT(section_id) DO UPDATE SET
  section_name=excluded.section_name,
  section_type=excluded.section_type,
  layout_contract=excluded.layout_contract,
  responsive_contract=excluded.responsive_contract,
  accessibility_contract=excluded.accessibility_contract,
  design_reference='KRDS_GOV_DEFAULT',
  asset_fingerprint=excluded.asset_fingerprint,
  active_yn='Y',
  updated_at=current_timestamp;

CREATE TABLE IF NOT EXISTS framework_legacy_frontend_section_candidate (
  reference_id varchar(80) NOT NULL
    REFERENCES framework_legacy_frontend_reference(reference_id)
    ON DELETE CASCADE,
  section_id varchar(100) NOT NULL
    REFERENCES ui_section_registry(section_id)
    ON DELETE CASCADE,
  extraction_rule varchar(80) NOT NULL,
  confidence numeric(5,4) NOT NULL CHECK(confidence BETWEEN 0 AND 1),
  component_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  reuse_strategy varchar(32) NOT NULL CHECK(reuse_strategy IN (
    'REUSE_EXISTING_COMMON','REGISTERED_COMMON'
  )),
  review_status varchar(24) NOT NULL DEFAULT 'CANDIDATE'
    CHECK(review_status IN ('CANDIDATE','APPROVED','REJECTED')),
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  updated_at timestamp NOT NULL DEFAULT current_timestamp,
  PRIMARY KEY(reference_id,section_id)
);

CREATE INDEX IF NOT EXISTS idx_legacy_section_candidate_review
  ON framework_legacy_frontend_section_candidate(
    section_id,review_status,confidence DESC
  );

CREATE OR REPLACE FUNCTION framework_extract_legacy_common_sections(
  extracted_by varchar DEFAULT 'LEGACY_COMMON_SECTION_EXTRACTOR'
) RETURNS jsonb LANGUAGE plpgsql AS $function$
DECLARE
  result jsonb;
BEGIN
  DELETE FROM framework_legacy_frontend_section_candidate
  WHERE review_status='CANDIDATE';

  WITH reference_scope AS (
    SELECT legacy.*,
      lower(
        legacy.screen_name || ' ' || legacy.source_path || ' ' ||
        coalesce(legacy.extracted_contract->>'documentTitle','')
      ) AS corpus
    FROM framework_legacy_frontend_reference legacy
    JOIN framework_legacy_frontend_reuse_candidate reuse
      ON reuse.reference_id=legacy.reference_id
     AND reuse.candidate_rank=1
     AND reuse.proposed_decision='REFERENCE_ONLY'
  ), extracted AS (
    SELECT reference_id,'PAGE_HEADER'::varchar section_id,
      'ALL_CONTENT_PAGES_NEED_PAGE_CONTEXT'::varchar extraction_rule,
      0.7600::numeric confidence,
      '["COMMON_PAGE_HEADER","COMMON_BREADCRUMB"]'::jsonb component_ids
    FROM reference_scope
    WHERE source_family<>'0. Gnb메뉴'

    UNION ALL
    SELECT reference_id,'GLOBAL_SERVICE_HEADER','GNB_OR_MAIN_FAMILY',0.9300,
      '["COMMON_PAGE_HEADER"]'::jsonb
    FROM reference_scope
    WHERE source_family IN('0. Gnb메뉴','1. 메인화면')

    UNION ALL
    SELECT reference_id,'HERO_SECTION','MAIN_SCREEN_FAMILY',0.9000,
      '["COMMON_HERO","COMMON_ACTION_BAR"]'::jsonb
    FROM reference_scope WHERE source_family='1. 메인화면'

    UNION ALL
    SELECT reference_id,'SUMMARY_METRICS','MAIN_SCREEN_SUMMARY',0.7200,
      '["COMMON_SUMMARY_METRIC","COMMON_CONTENT_CARD"]'::jsonb
    FROM reference_scope WHERE source_family='1. 메인화면'

    UNION ALL
    SELECT reference_id,'SEARCH_FILTER','SEARCH_DISCOVERABILITY',0.8800,
      '["COMMON_SEARCH_FILTER","COMMON_ACTION_BAR"]'::jsonb
    FROM reference_scope
    WHERE corpus ~ '(검색|search)'

    UNION ALL
    SELECT reference_id,'AUTHENTICATION_PANEL','AUTH_OR_MEMBER_CONTEXT',0.9400,
      '["COMMON_FORM_SECTION","COMMON_FORM_FIELD","COMMON_ACTION_BAR","COMMON_STATUS_BADGE"]'::jsonb
    FROM reference_scope
    WHERE source_family='2. 회원인증'
       OR corpus ~ '(로그인|인증|비밀번호|회원가입|login|password|identity|registration)'

    UNION ALL
    SELECT reference_id,'PROCESS_STEP_FLOW','MULTI_STEP_MEMBER_FLOW',0.8600,
      '["COMMON_STEP_FLOW","COMMON_STATUS_BADGE","COMMON_ACTION_BAR"]'::jsonb
    FROM reference_scope
    WHERE source_family='2. 회원인증'
      AND (
        corpus ~ '(단계|step|가입|registration|신청|승인)'
        OR jsonb_array_length(coalesce(
          extracted_contract->'forms','[]'::jsonb
        ))>0
      )

    UNION ALL
    SELECT reference_id,'FORM_SECTION','FORM_OR_INPUT_EVIDENCE',0.8200,
      '["COMMON_FORM_SECTION","COMMON_FORM_FIELD","COMMON_ACTION_BAR"]'::jsonb
    FROM reference_scope
    WHERE jsonb_array_length(coalesce(
      extracted_contract->'fields','[]'::jsonb
    ))>0

    UNION ALL
    SELECT reference_id,'HELP_SUPPORT_PANEL','SUPPORT_OR_GUIDANCE_CONTEXT',0.8800,
      '["COMMON_HELP_PANEL","COMMON_CONTENT_CARD"]'::jsonb
    FROM reference_scope
    WHERE source_family='고객지원 메뉴'
       OR corpus ~ '(도움|안내|문의|faq|support|help|guide)'

    UNION ALL
    SELECT reference_id,'ACTION_BAR','INTERACTIVE_ACTION_EVIDENCE',0.7800,
      '["COMMON_ACTION_BAR"]'::jsonb
    FROM reference_scope
    WHERE jsonb_array_length(coalesce(
      extracted_contract->'buttons','[]'::jsonb
    ))>0
  )
  INSERT INTO framework_legacy_frontend_section_candidate(
    reference_id,section_id,extraction_rule,confidence,component_ids,
    evidence,reuse_strategy,review_status,updated_at
  )
  SELECT DISTINCT ON(reference_id,section_id)
    extracted.reference_id,extracted.section_id,extracted.extraction_rule,
    extracted.confidence,extracted.component_ids,
    jsonb_build_object(
      'sourceFamily',legacy.source_family,
      'screenName',legacy.screen_name,
      'headingCount',jsonb_array_length(coalesce(
        legacy.extracted_contract->'sections','[]'::jsonb
      )),
      'fieldCount',jsonb_array_length(coalesce(
        legacy.extracted_contract->'fields','[]'::jsonb
      )),
      'buttonCount',jsonb_array_length(coalesce(
        legacy.extracted_contract->'buttons','[]'::jsonb
      )),
      'extractorVersion','1.0.0',
      'extractedBy',extracted_by,
      'appliedToPage',false
    ),
    CASE
      WHEN extracted.section_id IN(
        'GLOBAL_SERVICE_HEADER','AUTHENTICATION_PANEL',
        'PROCESS_STEP_FLOW','HELP_SUPPORT_PANEL'
      ) THEN 'REGISTERED_COMMON'
      ELSE 'REUSE_EXISTING_COMMON'
    END,
    'CANDIDATE',current_timestamp
  FROM extracted
  JOIN framework_legacy_frontend_reference legacy
    ON legacy.reference_id=extracted.reference_id
  ORDER BY reference_id,section_id,confidence DESC
  ON CONFLICT(reference_id,section_id) DO UPDATE SET
    extraction_rule=excluded.extraction_rule,
    confidence=excluded.confidence,
    component_ids=excluded.component_ids,
    evidence=excluded.evidence,
    reuse_strategy=excluded.reuse_strategy,
    updated_at=current_timestamp;

  SELECT jsonb_build_object(
    'sourceReferences',(
      SELECT count(DISTINCT reference_id)
      FROM framework_legacy_frontend_section_candidate
    ),
    'sectionCandidates',(
      SELECT count(*) FROM framework_legacy_frontend_section_candidate
    ),
    'commonSectionTypes',(
      SELECT count(DISTINCT section_id)
      FROM framework_legacy_frontend_section_candidate
    ),
    'newCommonSections',(
      SELECT count(DISTINCT section_id)
      FROM framework_legacy_frontend_section_candidate
      WHERE reuse_strategy='REGISTERED_COMMON'
    ),
    'existingCommonSectionsReused',(
      SELECT count(DISTINCT section_id)
      FROM framework_legacy_frontend_section_candidate
      WHERE reuse_strategy='REUSE_EXISTING_COMMON'
    ),
    'approved',(
      SELECT count(*) FROM framework_legacy_frontend_section_candidate
      WHERE review_status='APPROVED'
    ),
    'extractedBy',extracted_by
  ) INTO result;
  RETURN result;
END
$function$;

CREATE OR REPLACE VIEW framework_legacy_frontend_section_review AS
SELECT
  candidate.reference_id,legacy.source_family,legacy.screen_name,
  legacy.language_code,legacy.source_path,
  candidate.section_id,section_asset.section_name,
  section_asset.section_type,candidate.extraction_rule,
  candidate.confidence,candidate.component_ids,candidate.reuse_strategy,
  candidate.review_status,candidate.evidence,
  section_asset.design_reference,section_asset.active_yn
FROM framework_legacy_frontend_section_candidate candidate
JOIN framework_legacy_frontend_reference legacy
  ON legacy.reference_id=candidate.reference_id
JOIN ui_section_registry section_asset
  ON section_asset.section_id=candidate.section_id;

COMMENT ON VIEW framework_legacy_frontend_section_review IS
'과거 공개 화면에서 추출한 공통 섹션 재사용 후보. 관리 자산으로 조회 가능하지만 APPROVED 전에는 페이지 조합에 반영하지 않는다.';
