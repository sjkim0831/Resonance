CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS framework_legacy_frontend_reuse_candidate (
  reference_id varchar(80) NOT NULL
    REFERENCES framework_legacy_frontend_reference(reference_id)
    ON DELETE CASCADE,
  screen_resource_id bigint NOT NULL
    REFERENCES framework_screen_resource(screen_resource_id)
    ON DELETE CASCADE,
  candidate_rank integer NOT NULL CHECK(candidate_rank BETWEEN 1 AND 3),
  match_score numeric(6,5) NOT NULL CHECK(match_score BETWEEN 0 AND 1),
  title_similarity numeric(6,5) NOT NULL CHECK(title_similarity BETWEEN 0 AND 1),
  exact_route_match boolean NOT NULL DEFAULT false,
  process_match boolean NOT NULL DEFAULT false,
  proposed_decision varchar(32) NOT NULL CHECK(proposed_decision IN (
    'REPLACED','REUSE_SECTION','REFERENCE_ONLY','REVIEW_REQUIRED'
  )),
  match_evidence jsonb NOT NULL DEFAULT '{}'::jsonb,
  review_status varchar(24) NOT NULL DEFAULT 'UNREVIEWED'
    CHECK(review_status IN ('UNREVIEWED','APPROVED','REJECTED')),
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  updated_at timestamp NOT NULL DEFAULT current_timestamp,
  PRIMARY KEY(reference_id,screen_resource_id)
);

CREATE INDEX IF NOT EXISTS idx_legacy_reuse_candidate_review
  ON framework_legacy_frontend_reuse_candidate(
    proposed_decision,review_status,match_score DESC
  );

CREATE OR REPLACE FUNCTION framework_classify_legacy_frontend_reuse(
  classified_by varchar DEFAULT 'LEGACY_FRONTEND_CLASSIFIER'
) RETURNS jsonb LANGUAGE plpgsql AS $function$
DECLARE
  result jsonb;
BEGIN
  DELETE FROM framework_legacy_frontend_reuse_candidate
  WHERE review_status='UNREVIEWED';

  WITH raw_score AS (
    SELECT
      legacy.reference_id,
      screen.screen_resource_id,
      similarity(lower(legacy.screen_name),lower(screen.screen_name))
        AS title_similarity,
      EXISTS (
        SELECT 1
        FROM jsonb_array_elements_text(
          coalesce(legacy.extracted_contract->'routeCandidates','[]'::jsonb)
        ) route(value)
        WHERE lower(split_part(route.value,'?',1))=screen.route_key
      ) AS exact_route_match,
      EXISTS (
        SELECT 1
        FROM framework_process_step_screen_binding binding
        WHERE binding.screen_resource_id=screen.screen_resource_id
          AND binding.binding_status='ACTIVE'
          AND binding.process_code IN (
            SELECT value
            FROM jsonb_array_elements_text(
              coalesce(legacy.process_hints,'[]'::jsonb)
            )
          )
      ) AS process_match,
      screen.implementation_status,
      screen.route_key,
      screen.screen_name AS current_screen_name
    FROM framework_legacy_frontend_reference legacy
    CROSS JOIN framework_screen_resource screen
    WHERE screen.route_key NOT LIKE '/admin/%'
      AND screen.route_key NOT LIKE '/generated/%'
  ), scored AS (
    SELECT raw_score.*,
      least(1.0,
        CASE WHEN exact_route_match THEN 0.78 ELSE 0 END
        + title_similarity * 0.67
        + CASE WHEN process_match THEN 0.18 ELSE 0 END
        + CASE implementation_status
            WHEN 'VERIFIED' THEN 0.07
            WHEN 'IMPLEMENTED' THEN 0.04
            ELSE 0
          END
      ) AS match_score
    FROM raw_score
  ), ranked AS (
    SELECT scored.*,
      row_number() OVER (
        PARTITION BY reference_id
        ORDER BY match_score DESC,exact_route_match DESC,
          title_similarity DESC,screen_resource_id
      ) AS candidate_rank
    FROM scored
  )
  INSERT INTO framework_legacy_frontend_reuse_candidate(
    reference_id,screen_resource_id,candidate_rank,match_score,
    title_similarity,exact_route_match,process_match,proposed_decision,
    match_evidence,review_status,updated_at
  )
  SELECT
    reference_id,screen_resource_id,candidate_rank,match_score,
    title_similarity,exact_route_match,process_match,
    CASE
      WHEN exact_route_match OR match_score>=0.82 THEN 'REPLACED'
      WHEN match_score>=0.52 THEN 'REUSE_SECTION'
      WHEN match_score>=0.25 THEN 'REFERENCE_ONLY'
      ELSE 'REVIEW_REQUIRED'
    END,
    jsonb_build_object(
      'classifierVersion','1.0.0',
      'currentRoute',route_key,
      'currentScreenName',current_screen_name,
      'currentImplementationStatus',implementation_status,
      'exactRouteMatch',exact_route_match,
      'titleSimilarity',round(title_similarity::numeric,5),
      'processMatch',process_match,
      'scoreWeights',jsonb_build_object(
        'exactRoute',0.78,'title',0.67,'process',0.18,
        'verified',0.07,'implemented',0.04
      ),
      'classifiedBy',classified_by
    ),
    'UNREVIEWED',current_timestamp
  FROM ranked
  WHERE candidate_rank<=3
  ON CONFLICT(reference_id,screen_resource_id) DO UPDATE SET
    candidate_rank=excluded.candidate_rank,
    match_score=excluded.match_score,
    title_similarity=excluded.title_similarity,
    exact_route_match=excluded.exact_route_match,
    process_match=excluded.process_match,
    proposed_decision=excluded.proposed_decision,
    match_evidence=excluded.match_evidence,
    updated_at=current_timestamp;

  WITH best AS (
    SELECT DISTINCT ON(reference_id)
      reference_id,screen_resource_id,match_score,proposed_decision,
      match_evidence
    FROM framework_legacy_frontend_reuse_candidate
    ORDER BY reference_id,candidate_rank
  )
  UPDATE framework_legacy_frontend_reference legacy
  SET extracted_contract=legacy.extracted_contract || jsonb_build_object(
        'reuseRecommendation',jsonb_build_object(
          'proposedDecision',best.proposed_decision,
          'matchScore',best.match_score,
          'screenResourceId',best.screen_resource_id,
          'evidence',best.match_evidence,
          'requiresHumanApproval',true
        )
      ),
      updated_at=current_timestamp
  FROM best
  WHERE best.reference_id=legacy.reference_id;

  SELECT jsonb_build_object(
    'references',(SELECT count(*) FROM framework_legacy_frontend_reference),
    'referencesWithCandidate',(
      SELECT count(DISTINCT reference_id)
      FROM framework_legacy_frontend_reuse_candidate
    ),
    'candidateCount',(
      SELECT count(*) FROM framework_legacy_frontend_reuse_candidate
    ),
    'recommendations',coalesce((
      SELECT jsonb_object_agg(proposed_decision,total)
      FROM (
        SELECT proposed_decision,count(*) total
        FROM framework_legacy_frontend_reuse_candidate
        WHERE candidate_rank=1
        GROUP BY proposed_decision
      ) recommendation_counts
    ),'{}'::jsonb),
    'approved',(
      SELECT count(*) FROM framework_legacy_frontend_reuse_candidate
      WHERE review_status='APPROVED'
    ),
    'classifiedBy',classified_by
  ) INTO result;
  RETURN result;
END
$function$;

CREATE OR REPLACE VIEW framework_legacy_frontend_reuse_review AS
SELECT
  legacy.reference_id,legacy.source_family,legacy.screen_name,
  legacy.language_code,legacy.audience,legacy.source_path,
  legacy.reuse_decision AS human_decision,
  candidate.proposed_decision,candidate.match_score,
  candidate.title_similarity,candidate.exact_route_match,
  candidate.process_match,candidate.candidate_rank,
  candidate.review_status,
  screen.route_key AS current_route,
  screen.screen_name AS current_screen_name,
  screen.implementation_status AS current_implementation_status,
  candidate.match_evidence
FROM framework_legacy_frontend_reference legacy
LEFT JOIN framework_legacy_frontend_reuse_candidate candidate
  ON candidate.reference_id=legacy.reference_id
LEFT JOIN framework_screen_resource screen
  ON screen.screen_resource_id=candidate.screen_resource_id;

COMMENT ON VIEW framework_legacy_frontend_reuse_review IS
'과거 공개·사용자 HTML과 현재 비관리자 화면의 자동 비교 결과. 추천은 검토 근거이며 활성 메뉴나 라우트를 변경하지 않는다.';
