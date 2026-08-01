CREATE TABLE IF NOT EXISTS framework_design_self_healing_run (
  run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  route_key varchar(500) NOT NULL,
  trigger_type varchar(30) NOT NULL DEFAULT 'DESIGN_SAVE',
  affected_process_codes text[] NOT NULL DEFAULT '{}',
  run_status varchar(30) NOT NULL DEFAULT 'RUNNING'
    CHECK (run_status IN ('RUNNING','GENERATED','UNCHANGED','DESIGN_INCOMPLETE','PROCESS_BINDING_REQUIRED')),
  regenerated_process_count integer NOT NULL DEFAULT 0,
  generated_screen_count integer NOT NULL DEFAULT 0,
  invalid_screen_count integer NOT NULL DEFAULT 0,
  build_required boolean NOT NULL DEFAULT false,
  rollback_policy varchar(60) NOT NULL DEFAULT 'TRANSACTION_ROLLBACK',
  result_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  executed_by varchar(100) NOT NULL,
  started_at timestamp NOT NULL DEFAULT current_timestamp,
  completed_at timestamp
);

CREATE INDEX IF NOT EXISTS ix_design_self_healing_route_time
  ON framework_design_self_healing_run(route_key,started_at DESC);

COMMENT ON TABLE framework_design_self_healing_run IS
  '설계 저장 후 영향 프로세스만 재생성하고 결과와 트랜잭션 복구 정책을 기록하는 실행 이력';
