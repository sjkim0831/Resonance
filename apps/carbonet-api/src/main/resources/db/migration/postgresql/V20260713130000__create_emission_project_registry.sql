CREATE TABLE IF NOT EXISTS emission_project_registry (
    project_id varchar(40) PRIMARY KEY,
    project_name varchar(240) NOT NULL,
    site_name varchar(160) NOT NULL,
    calculation_period varchar(80) NOT NULL,
    scope_name varchar(80) NOT NULL,
    owner_name varchar(100) NOT NULL,
    progress_percent integer NOT NULL DEFAULT 0 CHECK (progress_percent BETWEEN 0 AND 100),
    current_step varchar(120) NOT NULL,
    due_date date,
    project_status varchar(30) NOT NULL DEFAULT '진행',
    created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_emission_project_registry_status ON emission_project_registry(project_status);
CREATE INDEX IF NOT EXISTS idx_emission_project_registry_due ON emission_project_registry(due_date);

INSERT INTO emission_project_registry (project_id, project_name, site_name, calculation_period, scope_name, owner_name, progress_percent, current_step, due_date, project_status)
VALUES
('PRJ-2026-001','2026년 정기 온실가스 배출량 산정','울산 제1사업장','2026.01–12','Scope 1·2','김민준',72,'데이터 검증',CURRENT_DATE + 5,'검증'),
('PRJ-2026-002','포항 사업장 분기 배출량 관리','포항 제1사업장','2026 Q2','Scope 1·2·3','이서연',46,'활동자료 수집',CURRENT_DATE + 12,'진행'),
('PRJ-2026-003','광양 공정 배출량 재산정','광양 제2사업장','2026.01–06','Scope 1','박지훈',88,'검토·승인',CURRENT_DATE + 2,'검증'),
('PRJ-2025-018','2025년 연간 배출량 확정','전 사업장','2025.01–12','Scope 1·2·3','최유진',100,'보고서 완료',CURRENT_DATE - 30,'완료'),
('PRJ-2026-004','인천 물류센터 배출량 산정','인천 물류센터','2026 Q2','Scope 1·2','정도현',31,'증빙자료 등록',CURRENT_DATE + 18,'진행'),
('PRJ-2026-005','부산 사업장 전력 사용량 검증','부산 사업장','2026.04–06','Scope 2','한지우',64,'배출량 산정',CURRENT_DATE + 8,'진행')
ON CONFLICT (project_id) DO NOTHING;
