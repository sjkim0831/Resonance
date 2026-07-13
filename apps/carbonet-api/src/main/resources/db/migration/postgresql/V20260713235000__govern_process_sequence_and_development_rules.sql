ALTER TABLE framework_process_definition ADD COLUMN IF NOT EXISTS development_order integer NOT NULL DEFAULT 999;
ALTER TABLE framework_process_definition ADD COLUMN IF NOT EXISTS prerequisite_codes text NOT NULL DEFAULT '';
UPDATE framework_process_definition SET development_order=10,prerequisite_codes='' WHERE process_code='GOVERNANCE_CHANGE';
UPDATE framework_process_definition SET development_order=20,prerequisite_codes='GOVERNANCE_CHANGE' WHERE process_code='DATA_INTEGRATION';
UPDATE framework_process_definition SET development_order=30,prerequisite_codes='GOVERNANCE_CHANGE,DATA_INTEGRATION' WHERE process_code='ACTIVITY_DATA';
UPDATE framework_process_definition SET development_order=40,prerequisite_codes='GOVERNANCE_CHANGE,ACTIVITY_DATA' WHERE process_code='EMISSION_CALCULATION';
UPDATE framework_process_definition SET development_order=50,prerequisite_codes='ACTIVITY_DATA,EMISSION_CALCULATION' WHERE process_code='EMISSION_PROJECT';
UPDATE framework_process_definition SET development_order=60,prerequisite_codes='GOVERNANCE_CHANGE,DATA_INTEGRATION' WHERE process_code='LCA_EXECUTION';
UPDATE framework_process_definition SET development_order=70,prerequisite_codes='EMISSION_PROJECT' WHERE process_code='REDUCTION_EXECUTION';
UPDATE framework_process_definition SET development_order=80,prerequisite_codes='EMISSION_PROJECT,LCA_EXECUTION' WHERE process_code='REPORT_CERTIFICATION';

CREATE TABLE IF NOT EXISTS framework_development_rule (
 rule_code varchar(80) PRIMARY KEY, rule_group varchar(40) NOT NULL, rule_name varchar(180) NOT NULL,
 rule_description text NOT NULL, verification_method text NOT NULL, source_ref varchar(400), mandatory boolean NOT NULL DEFAULT true,
 use_at char(1) NOT NULL DEFAULT 'Y', updated_at timestamp NOT NULL DEFAULT current_timestamp
);
INSERT INTO framework_development_rule(rule_code,rule_group,rule_name,rule_description,verification_method,source_ref) VALUES
('DEV-SCOPE','WORKFLOW','프로세스·액터·완료조건 우선','메뉴나 화면보다 액터의 목표, 상태 전이, 예외, 완료조건을 먼저 확정한다.','프로세스 단계와 5종 시나리오 존재 확인','framework_process_definition'),
('DEV-ARTIFACT','WORKFLOW','필수 산출물 완전성','MENU·DESIGN·PAGE·API·DATA·AUTHORITY·RULE·NOTIFICATION·AUDIT·TEST·OPERATION을 누락 없이 관리한다.','필수 산출물 전부 VERIFIED','framework_process_artifact'),
('DEV-METADATA','ARCHITECTURE','페이지 개발은 메타데이터 우선','일반 UI 변경은 Build Studio·SDUI·overlay·backend-metadata를 우선하며 코어 변경을 최소화한다.','no-build apply와 overlay 제공 경로 확인','AGENTS.md'),
('DEV-BOUNDARY','ARCHITECTURE','모듈 경계와 공통 계약 준수','페이지 전용 로직을 공통 코어에 무분별하게 추가하지 않고 request/service port와 공통 컴포넌트를 재사용한다.','의존성 방향·중복 구현 코드리뷰','docs/resonance-architecture.md'),
('DEV-TENANT','SECURITY','테넌트·프로젝트 격리','모든 조회·저장·검색·다운로드·배치에 tenantId와 projectId 범위를 적용한다.','교차 테넌트·프로젝트 격리 테스트','ProjectRuntimeContext'),
('DEV-AUTH','SECURITY','서버 권한 검증','프론트 버튼 숨김에 의존하지 않고 서버가 액터·capability·데이터 범위를 검증한다.','비인가 요청 403 및 감사로그 확인','framework_account_actor_assignment'),
('DEV-TX','DATA','변경 작업 원자성·멱등성','다중 테이블 변경은 단일 트랜잭션으로 처리하고 재요청은 중복 데이터를 만들지 않는다.','실패 롤백·동일 요청 재실행 테스트','@Transactional'),
('DEV-MIGRATION','DATA','Flyway 전진 마이그레이션','스키마·기준정보 변경은 재실행 안전한 신규 Flyway로 적용하고 배포 전 DB 백업을 수행한다.','마이그레이션 이력·백업·재기동 확인','apps/carbonet-api/.../db/migration'),
('DEV-CACHE','RUNTIME','저장 후 캐시 즉시 일관성','DB 정본 변경 성공 후 서버·메뉴·페이지 캐시를 즉시 무효화하고 브라우저 강제 캐시 삭제에 의존하지 않는다.','저장 직후 신규 세션 조회 비교','MenuInfoServiceImpl'),
('DEV-AUDIT','OBSERVABILITY','감사·추적 가능성','상태 변경은 행위자·시각·전후값·사유·traceId·결과를 기록한다.','감사로그 및 trace 연계 확인','platform/observability'),
('DEV-UI','DESIGN','KRDS·공통 UI·반응형','KRDS 토큰, 공통 헤더·메가메뉴·컴포넌트와 모바일·접근성 규칙을 적용한다.','360·768·1280 및 키보드·명도 검사','krds-design-token-contract'),
('DEV-TEST','QUALITY','5종 시나리오 검증','정상·예외·권한·격리·복구 테스트와 증적 없이는 완료하지 않는다.','모든 필수 case APPROVED','framework_simulation_case'),
('DEV-BUNDLE','BUILD','React 번들 원자성','index.html과 해시 자산·manifest를 한 세트로 생성하고 수동 편집이나 신규 청크 누락을 금지한다.','react bundle integrity 스크립트 통과','ops/scripts/resonance-react-bundle-integrity.sh'),
('DEV-GIT','BUILD','안전한 변경 범위·커밋','Git 루트를 확인하고 관련 파일만 명시적으로 stage하며 사용자 변경·런타임 DB·비밀정보를 섞지 않는다.','codex-safe-status와 diff --check 통과','ops/scripts/codex-safe-status.sh'),
('DEV-DEPLOY','OPERATION','백업·무중단 자동 배포','푸시 후 DB 백업, 빌드, 마이그레이션, 2복제 rolling update, health와 실제 경로를 검증한다.','2/2 ready·rollout·health·DB 이력 확인','ops/scripts/auto-deploy-main.sh')
ON CONFLICT(rule_code) DO UPDATE SET rule_group=excluded.rule_group,rule_name=excluded.rule_name,rule_description=excluded.rule_description,verification_method=excluded.verification_method,source_ref=excluded.source_ref,updated_at=current_timestamp;
