-- Separate the stable business-process name from its concrete execution step.
ALTER TABLE framework_process_definition DISABLE TRIGGER trg_guard_locked_process_definition;

UPDATE framework_process_definition
SET process_name='배출량 프로젝트 포트폴리오 관리',
    updated_at=current_timestamp
WHERE process_code='EMISSION_PROJECT_PORTFOLIO';

ALTER TABLE framework_process_definition ENABLE TRIGGER trg_guard_locked_process_definition;

ALTER TABLE framework_process_step DISABLE TRIGGER trg_guard_locked_process_step;

UPDATE framework_process_step
SET step_name='프로젝트 검색·현황 확인·다음 업무 선택'
WHERE process_code='EMISSION_PROJECT_PORTFOLIO'
  AND step_code='EMISSION_PROJECT_PORTFOLIO_LIST';

ALTER TABLE framework_process_step ENABLE TRIGGER trg_guard_locked_process_step;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM framework_process_definition
    WHERE process_code='EMISSION_PROJECT_PORTFOLIO'
      AND process_name='배출량 프로젝트 포트폴리오 관리'
  ) THEN
    RAISE EXCEPTION 'Portfolio process Korean name was not applied';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM framework_process_step
    WHERE process_code='EMISSION_PROJECT_PORTFOLIO'
      AND step_code='EMISSION_PROJECT_PORTFOLIO_LIST'
      AND step_name='프로젝트 검색·현황 확인·다음 업무 선택'
  ) THEN
    RAISE EXCEPTION 'Portfolio step Korean name was not applied';
  END IF;
END $$;
