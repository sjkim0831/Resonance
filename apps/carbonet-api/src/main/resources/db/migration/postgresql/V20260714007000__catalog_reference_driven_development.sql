CREATE TABLE IF NOT EXISTS framework_screen_type (
 screen_type varchar(40) PRIMARY KEY, screen_type_name varchar(100) NOT NULL,
 required_sections text NOT NULL, default_test_expectations text NOT NULL,
 development_weight numeric(6,2) NOT NULL DEFAULT 1, use_at char(1) NOT NULL DEFAULT 'Y'
);

CREATE TABLE IF NOT EXISTS framework_reference_asset (
 reference_id bigserial PRIMARY KEY, source_path varchar(1000) NOT NULL UNIQUE,
 source_name varchar(300) NOT NULL, source_type varchar(30) NOT NULL,
 content_fingerprint varchar(64) NOT NULL, file_size bigint NOT NULL DEFAULT 0,
 domain_code varchar(60) NOT NULL, screen_type varchar(40) REFERENCES framework_screen_type(screen_type),
 process_code varchar(80) REFERENCES framework_process_definition(process_code),
 analysis_status varchar(30) NOT NULL DEFAULT 'DISCOVERED', confidence numeric(5,2) NOT NULL DEFAULT 0,
 discovered_at timestamp NOT NULL DEFAULT current_timestamp, analyzed_at timestamp
);

CREATE TABLE IF NOT EXISTS framework_reference_expectation (
 expectation_id bigserial PRIMARY KEY, reference_id bigint NOT NULL REFERENCES framework_reference_asset(reference_id) ON DELETE CASCADE,
 process_code varchar(80) NOT NULL REFERENCES framework_process_definition(process_code) ON DELETE CASCADE,
 expectation_type varchar(30) NOT NULL, expectation_text text NOT NULL,
 test_status varchar(30) NOT NULL DEFAULT 'PLANNED', evidence_ref varchar(500),
 created_at timestamp NOT NULL DEFAULT current_timestamp,
 UNIQUE(reference_id,process_code,expectation_type)
);

CREATE TABLE IF NOT EXISTS framework_automation_metric (
 metric_id bigserial PRIMARY KEY, process_code varchar(80), metric_type varchar(40) NOT NULL,
 metric_value numeric(12,3) NOT NULL, sample_count integer NOT NULL DEFAULT 1,
 measured_at timestamp NOT NULL DEFAULT current_timestamp, detail_json text NOT NULL DEFAULT '{}'
);

INSERT INTO framework_screen_type(screen_type,screen_type_name,required_sections,default_test_expectations,development_weight) VALUES
('HOME','홈·허브','HEADER,HERO,SEARCH,SUMMARY,QUICK_LINK','반응형 GNB;핵심 업무 진입;인증 전 공개 범위;검색 접근성',1.4),
('LIST','목록·현황','PAGE_HEADER,SEARCH_FILTER,WORK_TABLE','검색·초기화;페이지당 10건;정렬;빈 결과;권한별 데이터 격리',1.0),
('FORM','등록·입력','PAGE_HEADER,FORM,VALIDATION,ACTIONS','필수값;임시저장;중복 제출;오류 복구;모바일 입력',1.3),
('DETAIL','상세·조회','PAGE_HEADER,SUMMARY,TABS,HISTORY,ACTIONS','존재하지 않는 데이터;권한 차단;변경 이력;연관 업무 이동',1.1),
('WORKFLOW','신청·승인','PAGE_HEADER,STATUS,FORM,HISTORY,ACTIONS','상태 전이;반려·재제출;중복 승인;승인 권한;감사 이력',1.6),
('DASHBOARD','통계·모니터링','PAGE_HEADER,SUMMARY_METRICS,CHART,FILTER','집계 정확성;기간 필터;빈 데이터;내보내기;비색상 상태 표현',1.5),
('SEARCH','통합 검색','PAGE_HEADER,SEARCH_FILTER,RESULT_GROUP','빈 검색;섹션 구분;더보기;상세 이동;권한 필터',1.2),
('AUTH','인증·계정','PAGE_HEADER,AUTH_FORM,SECURITY_NOTICE','실패 횟수;잠금;세션;2차 인증;개인정보 노출 방지',1.7),
('UPLOAD','파일·자료 수집','PAGE_HEADER,UPLOAD,MAPPING,VALIDATION','확장자·용량;양식 파싱;행 오류;전체 저장;재업로드 멱등성',1.7),
('REPORT','보고서·인증서','PAGE_HEADER,PREVIEW,DOWNLOAD,VERIFY','언어 유지;PDF 생성;진위 검증;다운로드 이력;위변조 방지',1.6),
('ADMIN','기준·시스템 관리','PAGE_HEADER,SEARCH_FILTER,WORK_TABLE,FORM','CRUD 트랜잭션;중복 방지;권한;캐시 무효화;감사 로그',1.4),
('CONTENT','콘텐츠·안내','PAGE_HEADER,CONTENT,RELATED_LINK','게시 상태;예약 공개;모바일 가독성;첨부파일;검색 노출',0.8)
ON CONFLICT(screen_type) DO UPDATE SET screen_type_name=excluded.screen_type_name,required_sections=excluded.required_sections,default_test_expectations=excluded.default_test_expectations,development_weight=excluded.development_weight,use_at='Y';

CREATE INDEX IF NOT EXISTS idx_reference_asset_classification ON framework_reference_asset(domain_code,screen_type,analysis_status);
CREATE INDEX IF NOT EXISTS idx_reference_expectation_process ON framework_reference_expectation(process_code,test_status);
