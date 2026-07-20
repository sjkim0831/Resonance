CREATE TABLE IF NOT EXISTS framework_business_work_type (
    work_type_code varchar(60) PRIMARY KEY,
    work_type_name varchar(160) NOT NULL,
    work_type_name_en varchar(160) NOT NULL DEFAULT '',
    description text NOT NULL DEFAULT '',
    sort_order integer NOT NULL DEFAULT 100,
    use_at char(1) NOT NULL DEFAULT 'Y',
    created_at timestamp NOT NULL DEFAULT current_timestamp,
    updated_at timestamp NOT NULL DEFAULT current_timestamp,
    CONSTRAINT ck_framework_business_work_type_use_at CHECK (use_at IN ('Y','N')),
    CONSTRAINT ck_framework_business_work_type_code CHECK (work_type_code ~ '^[A-Z][A-Z0-9_]{1,59}$')
);

CREATE INDEX IF NOT EXISTS idx_framework_business_work_type_order
    ON framework_business_work_type(use_at, sort_order, work_type_code);

INSERT INTO framework_business_work_type(work_type_code,work_type_name,work_type_name_en,description,sort_order)
VALUES
('EMISSION','탄소배출 관리','Carbon Emissions','배출량 프로젝트, 활동자료, 산정, 검증, 승인, 보고 업무',10),
('LCA','제품 LCA','Product LCA','제품 생애주기 인벤토리, 영향평가, 보고 업무',20),
('REDUCTION','감축 관리','Reduction Management','감축 목표, 과제, 실적, 시나리오 업무',30),
('MONITORING','모니터링·분석','Monitoring and Analytics','통합 모니터링, 품질, 경보, 분석 업무',40),
('TRADE','탄소·자원 거래','Carbon and Resource Trading','공급·수요, 거래, 추적, 인증 업무',50),
('CERTIFICATE','보고서·인증','Reports and Certificates','보고서 생성, 인증서 발급 및 진위 확인 업무',60),
('EDUCATION','교육·지원','Education and Support','교육, 콘텐츠, 고객지원 업무',70),
('MEMBER','회원·기업·권한','Members and Organizations','회원, 기업, 조직, 권한 업무',80),
('SYSTEM','시스템 운영','System Operations','기준정보, 워크플로, 외부연계, 시스템 운영 업무',90),
('COMMON','공통 업무','Common Tasks','여러 업무 영역이 함께 사용하는 공통 업무',100)
ON CONFLICT(work_type_code) DO NOTHING;

INSERT INTO framework_business_work_type(work_type_code,work_type_name,work_type_name_en,description,sort_order)
SELECT DISTINCT upper(trim(domain_code)), trim(domain_code), trim(domain_code), '기존 프로세스 정의에서 자동 등록된 업무 종류', 900
FROM framework_process_definition
WHERE coalesce(trim(domain_code),'')<>''
  AND upper(trim(domain_code)) ~ '^[A-Z][A-Z0-9_]{1,59}$'
ON CONFLICT(work_type_code) DO NOTHING;
