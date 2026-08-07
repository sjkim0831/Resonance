-- Canonical route lifecycle policy.  A frontend route is not automatically an
-- executable workflow merely because it exists, and a review item must never
-- be promoted by a fallback match.
CREATE TABLE IF NOT EXISTS framework_screen_workflow_policy (
  route_key varchar(500) PRIMARY KEY,
  classification varchar(24) NOT NULL
    CHECK (classification IN (
      'EXECUTABLE','INFORMATIONAL','EXCLUDED','REVIEW_REQUIRED'
    )),
  reason_code varchar(100) NOT NULL,
  reason_text text NOT NULL,
  source varchar(100) NOT NULL,
  review_status varchar(24) NOT NULL DEFAULT 'PENDING'
    CHECK (review_status IN (
      'AUTO_APPROVED','PENDING','APPROVED','REJECTED','CONFLICT'
    )),
  reviewed_by varchar(100),
  reviewed_at timestamp,
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  updated_at timestamp NOT NULL DEFAULT current_timestamp,
  CHECK (route_key LIKE '/%'),
  CHECK (
    (review_status IN ('APPROVED','REJECTED')
      AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL)
    OR review_status NOT IN ('APPROVED','REJECTED')
  )
);

CREATE INDEX IF NOT EXISTS idx_screen_workflow_policy_classification
  ON framework_screen_workflow_policy(classification,review_status,route_key);

CREATE TABLE IF NOT EXISTS framework_screen_workflow_sync_audit (
  sync_run_id bigserial PRIMARY KEY,
  sync_mode varchar(16) NOT NULL CHECK(sync_mode IN ('DRY_RUN','APPLY')),
  source varchar(100) NOT NULL,
  raw_route_count integer NOT NULL CHECK(raw_route_count>=0),
  canonical_route_count integer NOT NULL CHECK(canonical_route_count>=0),
  canonical_collision_count integer NOT NULL CHECK(canonical_collision_count>=0),
  executable_count integer NOT NULL CHECK(executable_count>=0),
  deterministic_mapping_count integer NOT NULL CHECK(deterministic_mapping_count>=0),
  informational_count integer NOT NULL CHECK(informational_count>=0),
  excluded_count integer NOT NULL CHECK(excluded_count>=0),
  review_required_count integer NOT NULL CHECK(review_required_count>=0),
  conflict_count integer NOT NULL CHECK(conflict_count>=0),
  inserted_resource_count integer NOT NULL DEFAULT 0 CHECK(inserted_resource_count>=0),
  inserted_binding_count integer NOT NULL DEFAULT 0 CHECK(inserted_binding_count>=0),
  duplicate_binding_count integer NOT NULL DEFAULT 0 CHECK(duplicate_binding_count>=0),
  summary_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  executed_by varchar(100) NOT NULL,
  started_at timestamp NOT NULL DEFAULT current_timestamp,
  completed_at timestamp NOT NULL DEFAULT current_timestamp
);

CREATE OR REPLACE VIEW framework_screen_workflow_policy_summary AS
SELECT
  count(*) AS route_count,
  count(*) FILTER (WHERE classification='EXECUTABLE') AS executable_count,
  count(*) FILTER (WHERE classification='INFORMATIONAL') AS informational_count,
  count(*) FILTER (WHERE classification='EXCLUDED') AS excluded_count,
  count(*) FILTER (WHERE classification='REVIEW_REQUIRED') AS review_required_count,
  count(*) FILTER (WHERE review_status='CONFLICT') AS conflict_count,
  count(*) FILTER (WHERE reviewed_by IS NOT NULL) AS human_reviewed_count,
  max(updated_at) AS last_updated_at
FROM framework_screen_workflow_policy;

COMMENT ON TABLE framework_screen_workflow_policy IS
  '프론트 canonical route의 실행 업무 여부를 fail-closed로 관리하는 원장. REVIEW_REQUIRED는 실행 후보로 자동 승격하지 않는다.';
COMMENT ON TABLE framework_screen_workflow_sync_audit IS
  'TypeScript AST 라우트 원장과 실행 설계 그래프의 동기화 결과 및 재실행 중복 증적.';
