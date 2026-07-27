CREATE TABLE IF NOT EXISTS framework_legacy_section_adoption (
  adoption_id bigserial PRIMARY KEY,
  reference_id varchar(80) NOT NULL,
  section_id varchar(100) NOT NULL,
  screen_resource_id bigint NOT NULL
    REFERENCES framework_screen_resource(screen_resource_id)
    ON DELETE CASCADE,
  adoption_status varchar(24) NOT NULL DEFAULT 'DESIGN_LINKED'
    CHECK(adoption_status IN ('DESIGN_LINKED','APPLY_APPROVED','APPLIED','REVOKED')),
  generator_status varchar(24) NOT NULL DEFAULT 'PENDING'
    CHECK(generator_status IN ('PENDING','GENERATED','VERIFIED','BLOCKED')),
  applied_to_page boolean NOT NULL DEFAULT false,
  approved_by varchar(100) NOT NULL,
  approval_reason text NOT NULL,
  approved_at timestamp NOT NULL DEFAULT current_timestamp,
  applied_at timestamp,
  updated_at timestamp NOT NULL DEFAULT current_timestamp,
  UNIQUE(reference_id,section_id,screen_resource_id),
  FOREIGN KEY(reference_id,section_id)
    REFERENCES framework_legacy_frontend_section_candidate(
      reference_id,section_id
    ) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS framework_legacy_section_review_event (
  review_event_id bigserial PRIMARY KEY,
  reference_id varchar(80) NOT NULL,
  section_id varchar(100) NOT NULL,
  screen_resource_id bigint,
  review_action varchar(16) NOT NULL
    CHECK(review_action IN ('APPROVE','REJECT','RESET')),
  previous_status varchar(24) NOT NULL,
  resulting_status varchar(24) NOT NULL,
  reviewer varchar(100) NOT NULL,
  reason text NOT NULL,
  evidence_snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  reviewed_at timestamp NOT NULL DEFAULT current_timestamp,
  FOREIGN KEY(reference_id,section_id)
    REFERENCES framework_legacy_frontend_section_candidate(
      reference_id,section_id
    ) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_legacy_section_adoption_status
  ON framework_legacy_section_adoption(
    adoption_status,generator_status,applied_to_page
  );
CREATE INDEX IF NOT EXISTS idx_legacy_section_review_event_reference
  ON framework_legacy_section_review_event(
    reference_id,section_id,reviewed_at DESC
  );

CREATE OR REPLACE FUNCTION framework_review_legacy_section_candidate(
  requested_reference_id varchar,
  requested_section_id varchar,
  requested_action varchar,
  requested_reviewer varchar,
  requested_reason text,
  requested_screen_resource_id bigint DEFAULT NULL
) RETURNS jsonb LANGUAGE plpgsql AS $function$
DECLARE
  candidate framework_legacy_frontend_section_candidate%rowtype;
  target_screen_id bigint;
  previous_status varchar;
  resulting_status varchar;
  evidence jsonb;
BEGIN
  IF requested_action NOT IN ('APPROVE','REJECT','RESET') THEN
    RAISE EXCEPTION 'unsupported review action: %',requested_action;
  END IF;
  IF nullif(btrim(requested_reviewer),'') IS NULL
     OR nullif(btrim(requested_reason),'') IS NULL THEN
    RAISE EXCEPTION 'reviewer and reason are required';
  END IF;

  SELECT * INTO candidate
  FROM framework_legacy_frontend_section_candidate
  WHERE reference_id=requested_reference_id
    AND section_id=requested_section_id
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown legacy section candidate: %/%',
      requested_reference_id,requested_section_id;
  END IF;
  previous_status := candidate.review_status;

  IF requested_action='APPROVE' THEN
    SELECT reuse.screen_resource_id INTO target_screen_id
    FROM framework_legacy_frontend_reuse_candidate reuse
    WHERE reuse.reference_id=requested_reference_id
      AND reuse.candidate_rank=1
      AND reuse.proposed_decision='REFERENCE_ONLY'
      AND reuse.match_score>=0.25
      AND (
        requested_screen_resource_id IS NULL
        OR reuse.screen_resource_id=requested_screen_resource_id
      );
    IF target_screen_id IS NULL THEN
      RAISE EXCEPTION
        'approval requires the reviewed top current-screen candidate with score >= 0.25';
    END IF;
    resulting_status := 'APPROVED';
    UPDATE framework_legacy_frontend_section_candidate
    SET review_status=resulting_status,updated_at=current_timestamp
    WHERE reference_id=requested_reference_id
      AND section_id=requested_section_id;

    INSERT INTO framework_legacy_section_adoption(
      reference_id,section_id,screen_resource_id,adoption_status,
      generator_status,applied_to_page,approved_by,approval_reason,
      approved_at,updated_at
    ) VALUES (
      requested_reference_id,requested_section_id,target_screen_id,
      'DESIGN_LINKED','PENDING',false,requested_reviewer,
      requested_reason,current_timestamp,current_timestamp
    )
    ON CONFLICT(reference_id,section_id,screen_resource_id) DO UPDATE SET
      adoption_status='DESIGN_LINKED',
      generator_status='PENDING',
      applied_to_page=false,
      approved_by=excluded.approved_by,
      approval_reason=excluded.approval_reason,
      approved_at=current_timestamp,
      updated_at=current_timestamp;
  ELSIF requested_action='REJECT' THEN
    resulting_status := 'REJECTED';
    UPDATE framework_legacy_frontend_section_candidate
    SET review_status=resulting_status,updated_at=current_timestamp
    WHERE reference_id=requested_reference_id
      AND section_id=requested_section_id;
    UPDATE framework_legacy_section_adoption
    SET adoption_status='REVOKED',generator_status='BLOCKED',
        updated_at=current_timestamp
    WHERE reference_id=requested_reference_id
      AND section_id=requested_section_id
      AND applied_to_page=false;
  ELSE
    resulting_status := 'CANDIDATE';
    UPDATE framework_legacy_frontend_section_candidate
    SET review_status=resulting_status,updated_at=current_timestamp
    WHERE reference_id=requested_reference_id
      AND section_id=requested_section_id;
    DELETE FROM framework_legacy_section_adoption
    WHERE reference_id=requested_reference_id
      AND section_id=requested_section_id
      AND applied_to_page=false;
  END IF;

  SELECT jsonb_build_object(
    'candidate',to_jsonb(candidate),
    'targetScreenResourceId',target_screen_id,
    'actualPageMutation',false,
    'secondApprovalRequired',true
  ) INTO evidence;

  INSERT INTO framework_legacy_section_review_event(
    reference_id,section_id,screen_resource_id,review_action,
    previous_status,resulting_status,reviewer,reason,evidence_snapshot
  ) VALUES (
    requested_reference_id,requested_section_id,target_screen_id,
    requested_action,previous_status,resulting_status,
    requested_reviewer,requested_reason,evidence
  );

  RETURN jsonb_build_object(
    'referenceId',requested_reference_id,
    'sectionId',requested_section_id,
    'action',requested_action,
    'previousStatus',previous_status,
    'resultingStatus',resulting_status,
    'screenResourceId',target_screen_id,
    'designLinked',requested_action='APPROVE',
    'appliedToPage',false,
    'secondApprovalRequired',true
  );
END
$function$;

CREATE OR REPLACE VIEW framework_legacy_section_adoption_review AS
SELECT
  review.reference_id,review.source_family,review.screen_name,
  review.language_code,review.source_path,review.section_id,
  review.section_name,review.section_type,review.confidence,
  review.component_ids,review.reuse_strategy,review.review_status,
  reuse.match_score,reuse.proposed_decision,
  screen.screen_resource_id,screen.route_key AS current_route,
  screen.screen_name AS current_screen_name,
  adoption.adoption_status,adoption.generator_status,
  coalesce(adoption.applied_to_page,false) AS applied_to_page,
  adoption.approved_by,adoption.approval_reason,adoption.approved_at,
  review.evidence
FROM framework_legacy_frontend_section_review review
JOIN framework_legacy_frontend_reuse_candidate reuse
  ON reuse.reference_id=review.reference_id
 AND reuse.candidate_rank=1
JOIN framework_screen_resource screen
  ON screen.screen_resource_id=reuse.screen_resource_id
LEFT JOIN framework_legacy_section_adoption adoption
  ON adoption.reference_id=review.reference_id
 AND adoption.section_id=review.section_id
 AND adoption.screen_resource_id=screen.screen_resource_id;

COMMENT ON FUNCTION framework_review_legacy_section_candidate IS
'과거 화면 공통 섹션 후보를 승인·반려한다. APPROVE는 설계 연결만 만들며 실제 페이지 적용에는 별도 2차 승인이 필요하다.';
