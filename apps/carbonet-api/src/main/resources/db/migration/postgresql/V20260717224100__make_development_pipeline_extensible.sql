CREATE TABLE IF NOT EXISTS framework_development_phase (
  job_type varchar(50) PRIMARY KEY,
  phase_code varchar(50) NOT NULL,
  phase_name varchar(120) NOT NULL,
  phase_order integer NOT NULL CHECK (phase_order > 0),
  default_execution_mode varchar(20) NOT NULL DEFAULT 'SEQUENTIAL'
    CHECK (default_execution_mode IN ('SEQUENTIAL','PARALLEL','JOIN')),
  active_yn char(1) NOT NULL DEFAULT 'Y' CHECK (active_yn IN ('Y','N')),
  created_at timestamp NOT NULL DEFAULT current_timestamp,
  updated_at timestamp NOT NULL DEFAULT current_timestamp
);

INSERT INTO framework_development_phase(job_type,phase_code,phase_name,phase_order,default_execution_mode) VALUES
 ('REFERENCE_ANALYSIS','REFERENCE','레퍼런스·기개발 분석',5,'PARALLEL'),
 ('DESIGN','DESIGN','액터·프로세스·테스트·화면 설계',10,'SEQUENTIAL'),
 ('DESIGN_PREFLIGHT','DESIGN','설계 자산 사전검사',15,'PARALLEL'),
 ('FRONTEND_USER','FRONTEND','사용자 프론트엔드',20,'PARALLEL'),
 ('FRONTEND_ADMIN','FRONTEND','관리자 프론트엔드',20,'PARALLEL'),
 ('COMPONENT_COMMON','FRONTEND_QUALITY','공통 컴포넌트 정리',25,'PARALLEL'),
 ('CLASS_PROPERTY_COMMON','FRONTEND_QUALITY','공통 클래스·속성 정리',25,'PARALLEL'),
 ('UI_QUALITY','FRONTEND_QUALITY','UI·반응형·접근성 검증',25,'JOIN'),
 ('DATABASE','BACKEND_DATA','DB 스키마·마이그레이션',30,'SEQUENTIAL'),
 ('DATABASE_QUALITY','BACKEND_DATA','DB 품질·인덱스 검증',35,'JOIN'),
 ('API','BACKEND_API','API 계약·컨트롤러',40,'PARALLEL'),
 ('API_QUALITY','BACKEND_API','API 품질·권한 검증',45,'JOIN'),
 ('BACKEND','BACKEND','백엔드 업무 로직',50,'SEQUENTIAL'),
 ('NOTIFICATION','BACKEND','알림·마감 정책',55,'PARALLEL'),
 ('SEARCH','OPTIMIZATION','검색·자산 인덱스',60,'PARALLEL'),
 ('PERFORMANCE','OPTIMIZATION','성능 예산 검증',60,'PARALLEL'),
 ('ACTOR_TEST','TEST','액터 권한·업무분리 테스트',70,'PARALLEL'),
 ('TEST','TEST','정상·예외·권한·격리·복구 테스트',70,'PARALLEL'),
 ('INTEGRATION','INTEGRATION','화면·API·DB·메뉴 통합',80,'JOIN'),
 ('DEPLOYMENT','DELIVERY','빌드·배포·복구 검증',90,'JOIN')
ON CONFLICT(job_type) DO UPDATE SET
 phase_code=excluded.phase_code,phase_name=excluded.phase_name,phase_order=excluded.phase_order,
 default_execution_mode=excluded.default_execution_mode,active_yn='Y',updated_at=current_timestamp;

ALTER TABLE framework_development_job_dependency
  ADD COLUMN IF NOT EXISTS dependency_source varchar(20) NOT NULL DEFAULT 'MANUAL';

CREATE OR REPLACE FUNCTION framework_sync_development_dependencies(target_process varchar)
RETURNS TABLE(deleted_dependencies integer, created_dependencies integer)
LANGUAGE plpgsql
AS $$
DECLARE
  removed integer := 0;
  inserted integer := 0;
BEGIN
  DELETE FROM framework_development_job_dependency d
  USING framework_development_job j
  WHERE d.job_id=j.job_id AND j.process_code=target_process
    AND d.dependency_source='PIPELINE';
  GET DIAGNOSTICS removed = ROW_COUNT;

  UPDATE framework_development_job j SET
    execution_mode=p.default_execution_mode,
    job_group_code=p.phase_code,
    updated_at=current_timestamp
  FROM framework_development_phase p
  WHERE j.process_code=target_process AND p.job_type=j.job_type AND p.active_yn='Y';

  INSERT INTO framework_development_job_dependency(job_id,depends_on_job_id,dependency_type,dependency_source)
  SELECT j.job_id,prior.job_id,'REQUIRED','PIPELINE'
  FROM framework_development_job j
  JOIN framework_development_phase current_phase ON current_phase.job_type=j.job_type AND current_phase.active_yn='Y'
  JOIN framework_development_job prior ON prior.process_code=j.process_code AND prior.step_code=j.step_code
    AND prior.required AND prior.job_id<>j.job_id
  JOIN framework_development_phase prior_phase ON prior_phase.job_type=prior.job_type AND prior_phase.active_yn='Y'
  WHERE j.process_code=target_process AND j.required
    AND prior_phase.phase_order<current_phase.phase_order
  ON CONFLICT(job_id,depends_on_job_id) DO NOTHING;
  GET DIAGNOSTICS inserted = ROW_COUNT;
  RETURN QUERY SELECT removed,inserted;
END;
$$;

CREATE OR REPLACE VIEW framework_development_pipeline AS
SELECT j.process_code,j.step_code,j.job_id,j.job_type,p.phase_code,p.phase_name,
       coalesce(p.phase_order,1000) AS phase_order,j.execution_mode,j.job_status,j.approval_status,
       count(d.depends_on_job_id) FILTER (WHERE d.dependency_type='REQUIRED') AS required_dependencies,
       count(d.depends_on_job_id) FILTER (WHERE d.dependency_type='REQUIRED' AND prior.job_status IN ('VERIFIED','COMPLETED')) AS completed_dependencies,
       bool_and(prior.job_status IN ('VERIFIED','COMPLETED')) FILTER (WHERE d.dependency_type='REQUIRED') AS dependencies_complete
FROM framework_development_job j
LEFT JOIN framework_development_phase p ON p.job_type=j.job_type AND p.active_yn='Y'
LEFT JOIN framework_development_job_dependency d ON d.job_id=j.job_id
LEFT JOIN framework_development_job prior ON prior.job_id=d.depends_on_job_id
GROUP BY j.process_code,j.step_code,j.job_id,j.job_type,p.phase_code,p.phase_name,p.phase_order,j.execution_mode,j.job_status,j.approval_status;

SELECT * FROM framework_sync_development_dependencies('EMISSION_PROJECT');

COMMENT ON TABLE framework_development_phase IS '새 개발 단계와 작업 유형을 코드 수정 없이 추가·재정렬하는 파이프라인 정본';
COMMENT ON FUNCTION framework_sync_development_dependencies(varchar) IS '현재 단계 카탈로그로 프로세스 개발 작업의 실행 모드와 의존성을 재생성한다.';
