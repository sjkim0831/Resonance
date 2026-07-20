-- Complete business process catalog. Existing implemented definitions are never overwritten.
-- Newly cataloged work stays DRAFT/PLANNED until implementation and evidence gates pass.
INSERT INTO framework_actor_definition(actor_code,actor_name,actor_name_en,actor_type,purpose,capability_codes,delegation_allowed)
VALUES
('PUBLIC_APPLICANT','가입 신청자','Public Applicant','BUSINESS','약관에 동의하고 본인·기업 정보를 제출하여 계정 승인을 요청한다.','REGISTER,VERIFY_IDENTITY,CONSENT',false),
('MEMBER_USER','일반 회원','Member User','BUSINESS','승인된 권한 범위에서 개인 업무와 프로젝트를 수행한다.','PROFILE_VIEW,PROFILE_EDIT,WORK_EXECUTE',true),
('MEMBER_ADMIN','회원 관리자','Member Administrator','OPERATION','회원 가입·상태·잠금·탈퇴와 로그인 이력을 관리한다.','MEMBER_REVIEW,MEMBER_APPROVE,MEMBER_SUSPEND',true),
('COMPANY_ADMIN','기업 관리자','Company Administrator','OPERATION','기업·조직·부서·사업장과 담당자를 관리한다.','COMPANY_APPROVE,ORG_MANAGE,SITE_MANAGE',true),
('AUTHORITY_ADMIN','권한 관리자','Authority Administrator','APPROVAL','역할·메뉴·데이터 범위·승인 권한을 분리 통제한다.','ROLE_MANAGE,AUTHORITY_APPROVE,ACCESS_REVOKE',false),
('CONTENT_MANAGER','콘텐츠 관리자','Content Manager','OPERATION','공지·자료·FAQ·배너·뉴스레터를 검토하고 게시한다.','CONTENT_EDIT,CONTENT_PUBLISH,NEWSLETTER_SEND',true),
('EDUCATION_MANAGER','교육 관리자','Education Manager','OPERATION','교육 과정·일정·신청·진도·평가·수료를 관리한다.','COURSE_MANAGE,ATTENDANCE_MANAGE,CERTIFICATE_ISSUE',true),
('SUPPORT_AGENT','고객지원 담당자','Support Agent','OPERATION','문의·장애·개선 요청을 접수하고 해결한다.','INQUIRY_REPLY,INCIDENT_MANAGE,GUIDE_MANAGE',true),
('TRADE_OPERATOR','거래 운영자','Trade Operator','BUSINESS','공급·수요·매칭·계약·거래 이력을 관리한다.','TRADE_REVIEW,TRADE_MATCH,TRADE_CLOSE',true),
('SETTLEMENT_OPERATOR','정산 담당자','Settlement Operator','BUSINESS','결제·정산·환불·계좌 검증을 수행한다.','PAYMENT_VIEW,SETTLEMENT_EXECUTE,REFUND_APPROVE',false),
('CERTIFICATE_OFFICER','인증 담당자','Certificate Officer','APPROVAL','보고서와 인증서의 발급·검토·진위·이의를 관리한다.','CERTIFICATE_REVIEW,CERTIFICATE_ISSUE,VERIFY',false),
('DATA_ANALYST','데이터 분석가','Data Analyst','BUSINESS','조직·사업장·Scope·기간별 분석과 품질·이상치를 해석한다.','ANALYZE,EXPORT,SHARE',true),
('PRIVACY_OFFICER','개인정보 보호책임자','Privacy Officer','AUDIT','개인정보 접근·보유·파기와 침해 대응을 감독한다.','PRIVACY_AUDIT,ACCESS_REVIEW,ERASURE_APPROVE',false),
('REGULATOR','규제기관 담당자','Regulator','REVIEW','법정 제출 자료를 접수·검토하고 보완·수리 결과를 통지한다.','SUBMISSION_REVIEW,CORRECTION_REQUEST,ACCEPT',false),
('EXTERNAL_VERIFIER','외부 검증자','External Verifier','REVIEW','독립성 원칙에 따라 산정·LCA·인증 산출물을 검증한다.','INDEPENDENT_VERIFY,OPINION_ISSUE,FINDING_MANAGE',false)
ON CONFLICT(actor_code) DO NOTHING;

WITH catalog(process_code,process_name,domain_code,parent_code,owner_code,development_order,goal) AS (VALUES
('TERMS_CONSENT','약관·개인정보·GWP 고지 동의','IDENTITY','MEMBER_LIFECYCLE','PUBLIC_APPLICANT',200,'가입 전 필수 약관과 CCUS 정보 제공 및 GWP 관련 법적 고지를 버전별로 동의한다.'),
('MEMBER_REGISTRATION','회원가입 신청','IDENTITY','MEMBER_LIFECYCLE','PUBLIC_APPLICANT',201,'본인·연락처·소속·기업 정보를 검증 가능한 형태로 제출한다.'),
('IDENTITY_VERIFICATION','이메일·휴대전화·본인 확인','IDENTITY','MEMBER_LIFECYCLE','PUBLIC_APPLICANT',202,'가입 신청자의 소유 채널과 본인 식별정보를 검증한다.'),
('MEMBER_APPROVAL','가입 검토·승인·반려','MEMBER','MEMBER_LIFECYCLE','MEMBER_ADMIN',203,'가입 요건과 기업 소속을 검토하여 승인 또는 보완·반려한다.'),
('LOGIN_AUTHENTICATION','로그인·세션·로그아웃','IDENTITY','MEMBER_LIFECYCLE','MEMBER_USER',204,'계정 상태와 인증수단을 확인하고 안전한 세션을 발급·종료한다.'),
('MFA_MANAGEMENT','다중인증 등록·복구','IDENTITY','MEMBER_LIFECYCLE','MEMBER_USER',205,'OTP·인증서 등 2차 인증수단의 등록과 분실 복구를 통제한다.'),
('PASSWORD_RECOVERY','비밀번호 재설정','IDENTITY','MEMBER_LIFECYCLE','MEMBER_USER',206,'본인 확인 후 기존 세션을 폐기하고 새 비밀번호를 설정한다.'),
('ACCOUNT_LOCK_RECOVERY','휴면·잠금 계정 복구','IDENTITY','MEMBER_LIFECYCLE','MEMBER_ADMIN',207,'휴면·실패 잠금 계정을 신원 확인과 감사 기록 후 복구한다.'),
('PROFILE_MANAGEMENT','내 정보·알림·보안 설정','MEMBER','MEMBER_LIFECYCLE','MEMBER_USER',208,'개인정보·업무·알림·마케팅·API 설정을 권한 범위에서 관리한다.'),
('ACCOUNT_WITHDRAWAL','회원 탈퇴·보유정보 처리','MEMBER','MEMBER_LIFECYCLE','PRIVACY_OFFICER',209,'진행 업무와 법정 보존정보를 확인하고 계정 탈퇴·파기를 완료한다.'),
('MEMBER_ADMINISTRATION','회원 상태·이력 관리','MEMBER','MEMBER_LIFECYCLE','MEMBER_ADMIN',210,'회원 상태와 가입·잠금·휴면·탈퇴·로그인 이력을 일관되게 관리한다.'),
('COMPANY_REGISTRATION_APPROVAL','기업 등록·승인','MEMBER','MEMBER_LIFECYCLE','COMPANY_ADMIN',211,'사업자·법인 정보와 대표 권한을 검증하고 기업 계정을 승인한다.'),
('ORGANIZATION_DEPARTMENT','조직·부서 관리','MEMBER','MEMBER_LIFECYCLE','COMPANY_ADMIN',212,'기업의 조직·부서 계층과 책임자를 유효기간과 함께 관리한다.'),
('BUSINESS_SITE_ADMINISTRATION','사업장 관리','MEMBER','MEMBER_LIFECYCLE','COMPANY_ADMIN',213,'사업장 식별·주소·시설·운영기간과 배출 프로젝트 연결을 관리한다.'),
('ROLE_AUTHORITY_MANAGEMENT','역할·권한 그룹 관리','GOVERNANCE','GOVERNANCE_CHANGE','AUTHORITY_ADMIN',214,'최소권한과 직무분리를 반영한 역할 및 권한 그룹을 관리한다.'),
('USER_AUTHORITY_ASSIGNMENT','사용자별 권한 배정','GOVERNANCE','GOVERNANCE_CHANGE','AUTHORITY_ADMIN',215,'사용자에게 기간·테넌트·프로젝트 범위가 명확한 권한을 부여한다.'),
('MENU_ACCESS_CONTROL','메뉴 접근 권한 관리','GOVERNANCE','GOVERNANCE_CHANGE','AUTHORITY_ADMIN',216,'메뉴·기능·라우트 접근권한을 역할과 액터 계약에 연결한다.'),
('DATA_SCOPE_AUTHORITY','데이터 범위 권한 관리','GOVERNANCE','GOVERNANCE_CHANGE','AUTHORITY_ADMIN',217,'조직·사업장·프로젝트·기간별 데이터 접근 범위를 통제한다.'),
('APPROVAL_AUTHORITY','승인 권한·한도 관리','GOVERNANCE','GOVERNANCE_CHANGE','AUTHORITY_ADMIN',218,'승인 종류·금액·위험도·대리 권한과 직무분리를 관리한다.'),
('REDUCTION_TARGET_PLANNING','감축 목표·기준연도 설정','REDUCTION','REDUCTION_EXECUTION','REDUCTION_MANAGER',230,'기준연도와 조직·사업장별 감축 목표를 검증 가능한 기준으로 설정한다.'),
('REDUCTION_ROADMAP','감축 로드맵 수립','REDUCTION','REDUCTION_EXECUTION','REDUCTION_MANAGER',231,'목표 달성을 위한 연차별 수단·투자·감축량 로드맵을 수립한다.'),
('REDUCTION_PROJECT_REGISTRATION','감축 과제 등록','REDUCTION','REDUCTION_EXECUTION','REDUCTION_MANAGER',232,'담당자·예산·일정·기준선·예상 감축량을 포함한 과제를 등록한다.'),
('REDUCTION_PROJECT_APPROVAL','감축 과제 검토·승인','REDUCTION','REDUCTION_EXECUTION','APPROVER',233,'중복·추가성·실현가능성·비용을 검토하여 과제를 승인한다.'),
('REDUCTION_PERFORMANCE','감축 실적·효과 관리','REDUCTION','REDUCTION_EXECUTION','REDUCTION_MANAGER',234,'과제 실적과 목표·비용 대비 효과를 증빙 기반으로 관리한다.'),
('REDUCTION_SCENARIO','감축 시나리오 비교','REDUCTION','REDUCTION_EXECUTION','DATA_ANALYST',235,'수단·비용·가격·일정 조건별 감축 결과를 비교한다.'),
('MACC_PORTFOLIO','한계감축비용·포트폴리오','REDUCTION','REDUCTION_EXECUTION','DATA_ANALYST',236,'한계감축비용과 제약조건으로 투자 우선순위를 구성한다.'),
('REDUCTION_REPORTING','감축 성과 보고','REDUCTION','REDUCTION_EXECUTION','REDUCTION_MANAGER',237,'목표·실적·비용·검증 결과를 승인된 성과 보고서로 확정한다.'),
('INTEGRATED_MONITORING','통합 탄소 현황 모니터링','MONITORING','MONITORING_ANALYSIS','DATA_ANALYST',240,'배출·LCA·감축 핵심 지표를 조직과 기간별로 통합 모니터링한다.'),
('DATA_QUALITY_MONITORING','데이터 품질 모니터링','MONITORING','MONITORING_ANALYSIS','VERIFIER',241,'완전성·적시성·정확성·일관성·추적성 품질을 지속 평가한다.'),
('ANOMALY_ALERT_MANAGEMENT','이상치·경보 관리','MONITORING','MONITORING_ANALYSIS','DATA_ANALYST',242,'임계치·추세·교차검증으로 이상치를 탐지하고 조치한다.'),
('REGULATORY_STATUS_MONITORING','규제 대응 현황 관리','MONITORING','MONITORING_ANALYSIS','REGULATOR',243,'법정 기한·제출·보완·수리 상태를 통합 추적한다.'),
('ANALYSIS_EXPORT','분석 데이터 내보내기','MONITORING','MONITORING_ANALYSIS','DATA_ANALYST',244,'권한과 개인정보 정책을 적용해 재현 가능한 분석 데이터를 내보낸다.'),
('STAKEHOLDER_SHARING','이해관계자 공유','MONITORING','MONITORING_ANALYSIS','APPROVER',245,'승인된 범위·대상·기간에만 지표와 보고서를 공유한다.'),
('CO2_SUPPLY_REGISTRATION','CO2 공급 정보 등록','TRADE','TRADE_EXECUTION','TRADE_OPERATOR',250,'CO2 출처·수량·품질·위치·가용기간과 MRV 근거를 등록한다.'),
('CO2_DEMAND_REGISTRATION','CO2 수요 정보 등록','TRADE','TRADE_EXECUTION','TRADE_OPERATOR',251,'수요 용도·품질·수량·위치·기간·인허가 조건을 등록한다.'),
('SUPPLY_DEMAND_MATCHING','공급·수요 매칭','TRADE','TRADE_EXECUTION','TRADE_OPERATOR',252,'호환성·거리·기간·수량·품질 기준으로 매칭 후보를 산출한다.'),
('TRADE_PROPOSAL','거래 제안·협상','TRADE','TRADE_EXECUTION','TRADE_OPERATOR',253,'가격·수량·품질·인도·책임 조건을 제안하고 협상 이력을 남긴다.'),
('TRADE_CONTRACT','거래 계약·승인','TRADE','TRADE_EXECUTION','APPROVER',254,'합의 조건과 당사자 권한을 검증하여 계약을 체결한다.'),
('TRADE_EXECUTION_TRACKING','거래 이행·인수인계','TRADE','TRADE_EXECUTION','TRADE_OPERATOR',255,'출고·운송·인수·검수 상태와 수량 차이를 추적한다.'),
('TRADE_SETTLEMENT','거래 정산','PAYMENT','PAYMENT_SETTLEMENT','SETTLEMENT_OPERATOR',256,'검수된 이행량과 계약 조건으로 결제·정산을 확정한다.'),
('REFUND_MANAGEMENT','환불 요청·처리','PAYMENT','PAYMENT_SETTLEMENT','SETTLEMENT_OPERATOR',257,'환불 사유·원거래·승인 권한을 검증하고 환불을 처리한다.'),
('MRV_TRACEABILITY','MRV 출처·이동 추적','CCUS_MRV','TRADE_EXECUTION','SYSTEM_INTEGRATOR',258,'CO2의 출처·이동·인수인계와 MRV 증적을 연속적으로 연결한다.'),
('DOUBLE_USE_PREVENTION','중복 사용·이중계상 방지','CERTIFICATE','CERTIFICATE_ISSUANCE','AUDITOR',259,'동일 감축량·CO2·인증서의 중복 발급·사용·청구를 차단한다.'),
('CARBON_CREDIT_MANAGEMENT','탄소크레딧 발급·보유·소각','CERTIFICATE','CERTIFICATE_ISSUANCE','CERTIFICATE_OFFICER',260,'크레딧의 발급·이전·보유·소각과 잔액 무결성을 관리한다.'),
('COURSE_MANAGEMENT','교육 과정 관리','EDUCATION','CONTENT_OPERATION','EDUCATION_MANAGER',270,'학습목표·대상·교재·평가·수료 기준을 포함한 과정을 관리한다.'),
('EDUCATION_SCHEDULE','교육 일정·강사 관리','EDUCATION','CONTENT_OPERATION','EDUCATION_MANAGER',271,'교육 회차·정원·강사·장소·온라인 접속 정보를 관리한다.'),
('EDUCATION_APPLICATION','교육 신청·승인','EDUCATION','CONTENT_OPERATION','MEMBER_USER',272,'대상 자격과 정원을 확인해 교육을 신청·승인·취소한다.'),
('ATTENDANCE_PROGRESS','출석·진도 관리','EDUCATION','CONTENT_OPERATION','EDUCATION_MANAGER',273,'출석과 학습 진도를 위변조 방지 증적으로 기록한다.'),
('EDUCATION_ASSESSMENT','교육 평가 관리','EDUCATION','CONTENT_OPERATION','EDUCATION_MANAGER',274,'문항·응시·채점·재응시와 이의처리를 관리한다.'),
('TRAINING_CERTIFICATE','교육 수료·수료증 발급','EDUCATION','CONTENT_OPERATION','CERTIFICATE_OFFICER',275,'출석·진도·평가 기준 충족을 확인하고 수료증을 발급한다.'),
('NOTICE_PUBLICATION','공지사항 게시','CONTENT','CONTENT_OPERATION','CONTENT_MANAGER',276,'공지 초안·검토·예약·게시·수정·종료를 관리한다.'),
('RESOURCE_PUBLICATION','자료실·기술자료 게시','CONTENT','CONTENT_OPERATION','CONTENT_MANAGER',277,'자료 버전·분류·첨부·공개범위·저작권을 검토하고 게시한다.'),
('FAQ_MANAGEMENT','FAQ 관리','CONTENT','CONTENT_OPERATION','CONTENT_MANAGER',278,'반복 문의를 분석해 FAQ를 작성·검토·게시한다.'),
('CUSTOMER_INQUIRY','문의 접수·답변','CONTENT','CONTENT_OPERATION','SUPPORT_AGENT',279,'문의 분류·담당 배정·답변·만족도·재문의 이력을 관리한다.'),
('INCIDENT_IMPROVEMENT_REQUEST','장애·개선 요청','PLATFORM','PLATFORM_OPERATION','SUPPORT_AGENT',280,'장애와 개선 요청을 영향도·우선순위·SLA에 따라 처리한다.'),
('NEWSLETTER_OPERATION','뉴스레터 구독·발송','CONTENT','CONTENT_OPERATION','CONTENT_MANAGER',281,'수신 동의·대상·콘텐츠·발송·반송·철회를 관리한다.'),
('REPORT_TEMPLATE_MANAGEMENT','보고서 양식 관리','REPORTING','REPORT_CERTIFICATION','CERTIFICATE_OFFICER',290,'언어·법령·브랜드·검증 요소를 포함한 보고서 양식을 버전 관리한다.'),
('REPORT_GENERATION','보고서 생성·미리보기','REPORTING','REPORT_CERTIFICATION','CALCULATOR',291,'확정 데이터 스냅샷에서 재현 가능한 보고서를 생성한다.'),
('REPORT_SUBMISSION','보고서 제출·접수','REPORTING','REPORT_CERTIFICATION','COMPANY_MANAGER',292,'승인된 보고서를 대상 기관에 제출하고 접수·보완 상태를 추적한다.'),
('CERTIFICATE_REVIEW_ISSUANCE','인증서 검토·발급','CERTIFICATE','CERTIFICATE_ISSUANCE','CERTIFICATE_OFFICER',293,'산출물·승인·중복 여부를 검토하고 고유 인증서를 발급한다.'),
('CERTIFICATE_VERIFICATION','인증서 진위 확인','CERTIFICATE','CERTIFICATE_ISSUANCE','AUDITOR',294,'QR·해시·시각지문·OCR·저장 데이터셋을 대조해 진위를 판정한다.'),
('CERTIFICATE_OBJECTION','인증서 이의신청·감사','CERTIFICATE','CERTIFICATE_ISSUANCE','AUDITOR',295,'진위·발급·내용에 대한 이의를 독립 검토하고 조치한다.'),
('EXTERNAL_SYSTEM_REGISTRY','외부 연계 시스템 관리','INTEGRATION','DATA_INTEGRATION','SYSTEM_INTEGRATOR',300,'연계 기관·시스템·책임자·환경·SLA를 등록한다.'),
('API_CONNECTION_MANAGEMENT','API 연결 관리','INTEGRATION','DATA_INTEGRATION','SYSTEM_INTEGRATOR',301,'엔드포인트·인증·네트워크·타임아웃·재시도 정책을 관리한다.'),
('API_KEY_LIFECYCLE','API 키 수명주기 관리','INTEGRATION','DATA_INTEGRATION','SYSTEM_INTEGRATOR',302,'API 키의 발급·범위·회전·폐기와 사용 이력을 관리한다.'),
('DATA_SCHEMA_CONTRACT','데이터 스키마·계약 관리','INTEGRATION','DATA_INTEGRATION','SYSTEM_INTEGRATOR',303,'필드·타입·필수값·버전·호환성 계약을 관리한다.'),
('WEBHOOK_MANAGEMENT','웹훅 관리','INTEGRATION','DATA_INTEGRATION','SYSTEM_INTEGRATOR',304,'이벤트·수신 URL·서명·재전송·비활성 정책을 관리한다.'),
('SYNC_EXECUTION','동기화 실행·스케줄','INTEGRATION','DATA_INTEGRATION','SYSTEM_INTEGRATOR',305,'증분 기준과 중복 방지 키로 동기화를 실행·예약한다.'),
('INTEGRATION_FAILURE_RETRY','연계 실패·재시도','INTEGRATION','DATA_INTEGRATION','SYSTEM_INTEGRATOR',306,'실패 원인을 분류하고 멱등 재시도·보정·격리를 수행한다.'),
('API_USAGE_MONITORING','API 사용량·제한 관리','INTEGRATION','DATA_INTEGRATION','SYSTEM_INTEGRATOR',307,'호출량·오류율·지연·쿼터·비용을 모니터링한다.'),
('INTEGRATION_LOG_AUDIT','연계 로그·감사','INTEGRATION','DATA_INTEGRATION','AUDITOR',308,'요청·응답·변환·재시도 로그를 민감정보 마스킹과 함께 감사한다.'),
('VALIDATION_RULE_MANAGEMENT','검증 규칙 관리','GOVERNANCE','GOVERNANCE_CHANGE','VERIFIER',320,'필수값·범위·교차검증·품질 규칙을 버전 관리한다.'),
('OUTLIER_RULE_MANAGEMENT','이상치 규칙 관리','GOVERNANCE','GOVERNANCE_CHANGE','DATA_ANALYST',321,'통계·업무 임계치와 예외 승인 기준을 관리한다.'),
('QUALITY_SCORING_POLICY','품질 점수 기준 관리','GOVERNANCE','GOVERNANCE_CHANGE','VERIFIER',322,'품질 차원별 가중치·등급·최소 통과 기준을 관리한다.'),
('APPROVAL_LINE_MANAGEMENT','승인선 관리','GOVERNANCE','GOVERNANCE_CHANGE','AUTHORITY_ADMIN',323,'업무·조직·금액·위험도별 승인선을 관리한다.'),
('APPROVAL_WORKFLOW_MANAGEMENT','승인 워크플로 관리','GOVERNANCE','GOVERNANCE_CHANGE','AUTHORITY_ADMIN',324,'상태 전이·병렬·합의·반려·재상신 규칙을 관리한다.'),
('TASK_TEMPLATE_MANAGEMENT','Task 템플릿 관리','GOVERNANCE','GOVERNANCE_CHANGE','PLATFORM_OPERATOR',325,'업무 단계·담당 액터·입출력·완료조건·SLA 템플릿을 관리한다.'),
('PROCESS_COMPLETION_POLICY','단계별 완료조건·진행률 관리','GOVERNANCE','GOVERNANCE_CHANGE','PLATFORM_OPERATOR',326,'증적 기반 완료조건과 단계별 진행률 가중치를 관리한다.'),
('DEADLINE_NOTIFICATION_POLICY','마감·알림 정책 관리','GOVERNANCE','GOVERNANCE_CHANGE','PLATFORM_OPERATOR',327,'마감 산정·사전 알림·지연·에스컬레이션 정책을 관리한다.'),
('AUTOMATION_RULE_MANAGEMENT','자동 처리 규칙 관리','GOVERNANCE','GOVERNANCE_CHANGE','PLATFORM_OPERATOR',328,'자동 실행 조건·한도·승인·중단·복구 규칙을 관리한다.'),
('MENU_SCREEN_GOVERNANCE','메뉴·페이지·화면 연결 관리','PLATFORM','PLATFORM_OPERATION','PLATFORM_OPERATOR',340,'메뉴·라우트·페이지·화면·권한·다국어 연결을 트랜잭션으로 관리한다.'),
('DESIGN_ASSET_GOVERNANCE','테마·섹션·컴포넌트·CSS 관리','PLATFORM','PLATFORM_OPERATION','PLATFORM_OPERATOR',341,'공통 디자인 자산을 중복 없이 등록·버전·재사용한다.'),
('BUILDER_GENERATOR_OPERATION','빌더·제너레이터 운영','PLATFORM','PLATFORM_OPERATION','PLATFORM_OPERATOR',342,'설계 계약으로 화면·API·DB·테스트 산출물을 결정적으로 생성한다.'),
('FEATURE_API_GOVERNANCE','기능·API·함수·모듈 관리','PLATFORM','PLATFORM_OPERATION','PLATFORM_OPERATOR',343,'재사용 기능과 API·함수·컨트롤러·모듈 계약을 관리한다.'),
('SECURITY_POLICY_OPERATION','보안 정책·접근 통제','PLATFORM','PLATFORM_OPERATION','PRIVACY_OFFICER',344,'인증·세션·암호·차단·허용·민감정보 정책을 운영한다.'),
('AUDIT_LOG_OPERATION','접속·감사·오류 로그 관리','PLATFORM','PLATFORM_OPERATION','AUDITOR',345,'접속·로그인·감사·오류·개인정보 접근 로그를 보존·검색한다.'),
('SYSTEM_MONITORING_RECOVERY','시스템·DB 모니터링·자가복구','PLATFORM','PLATFORM_OPERATION','PLATFORM_OPERATOR',346,'애플리케이션·DB·인프라 상태를 감시하고 안전하게 자가복구한다.'),
('BATCH_SCHEDULE_OPERATION','배치·스케줄 운영','PLATFORM','PLATFORM_OPERATION','PLATFORM_OPERATOR',347,'배치 의존성·일정·중복방지·재시도·실행 이력을 관리한다.'),
('GIT_BUILD_DEPLOYMENT','Git·증분 빌드·무중단 배포','PLATFORM','PLATFORM_OPERATION','PLATFORM_OPERATOR',348,'변경 범위만 검증·빌드하고 DB 백업 후 무중단 배포한다.'),
('VERSION_BACKUP_RECOVERY','버전·백업·복구 관리','PLATFORM','PLATFORM_OPERATION','PLATFORM_OPERATOR',349,'소스·DB·자산 버전과 백업·복구·PITR 증적을 관리한다.'),
('EXTERNAL_SERVICE_STATUS','외부 서비스 상태 관리','PLATFORM','PLATFORM_OPERATION','SYSTEM_INTEGRATOR',350,'외부 API·인증·메일·스토리지 상태와 유지보수 일정을 관리한다.'),
('NOTIFICATION_CENTER_OPERATION','알림센터 운영','PLATFORM','PLATFORM_OPERATION','PLATFORM_OPERATOR',351,'업무·장애·보안 알림 템플릿·채널·발송·수신을 관리한다.')
)
INSERT INTO framework_process_definition(process_code,process_name,domain_code,process_version,goal,start_condition,completion_condition,process_status,development_order,prerequisite_codes,parent_process_code,process_level,automation_mode,owner_actor_code,risk_level,sla_hours,review_cycle_days,lifecycle_status,effective_from,next_review_at,definition_locked)
SELECT process_code,process_name,domain_code,'1.0.0',goal,
       '요청자 계정, 담당 액터, 테넌트·프로젝트 범위, 필수 기준정보와 선행 업무가 준비되어 있다.',
       '최종 상태, 산출물, 승인·반려 근거, 감사 이벤트와 후속 업무가 모두 저장된다.',
       'DRAFT',development_order,parent_code,parent_code,2,'GENERATOR_READY',owner_code,'HIGH',72,90,'DESIGN',current_date,current_timestamp+interval '90 days',false
FROM catalog
ON CONFLICT(process_code) DO NOTHING;

WITH targets AS (
 SELECT p.process_code,p.process_name,p.owner_actor_code
 FROM framework_process_definition p
 WHERE p.development_order BETWEEN 200 AND 351
), stages(ord,suffix,label) AS (VALUES
 (1,'REQUEST','요청·범위·필수정보 확인'),(2,'EXECUTE','업무 실행·중간 결과 저장'),
 (3,'REVIEW','독립 검토·보완·권한 검증'),(4,'COMPLETE','승인·확정·통지·후속업무 연결')
)
INSERT INTO framework_process_step(process_code,step_order,step_code,step_name,actor_code,from_state,command_code,to_state,completion_rule,parent_step_code,step_type,requirement_text,input_contract,output_contract,requires_user_page,requires_admin_page,requires_api,requires_database,requires_notification,user_path,admin_path,api_contract,automation_status,sla_hours,escalation_actor_code,evidence_required,evidence_types,segregation_actor_codes,rollback_command_code,decision_rule)
SELECT t.process_code,s.ord,t.process_code||'_S'||s.ord,t.process_name||' - '||s.label,
       CASE s.ord WHEN 3 THEN CASE WHEN t.owner_actor_code IN ('VERIFIER','AUDITOR','APPROVER','AUTHORITY_ADMIN') THEN t.owner_actor_code ELSE 'VERIFIER' END WHEN 4 THEN CASE WHEN t.owner_actor_code='APPROVER' THEN 'AUDITOR' ELSE 'APPROVER' END ELSE t.owner_actor_code END,
       CASE s.ord WHEN 1 THEN 'READY' ELSE 'STEP_'||(s.ord-1)||'_COMPLETED' END,
       t.process_code||'_'||s.suffix,'STEP_'||s.ord||'_COMPLETED',
       '필수 입력, 액터 권한, 테넌트·프로젝트 격리, 증적, 멱등성과 상태 전이가 모두 검증되어야 한다.',
       NULL,CASE WHEN s.ord>=3 THEN 'DECISION' ELSE 'TASK' END,
       t.process_name||'의 전문 업무 규칙과 실패·보완·복구 경로를 적용한다.',
       jsonb_build_object('tenantId','required','projectId','contextual','actorCode','required','idempotencyKey','required','businessPayload','required')::text,
       jsonb_build_object('state','STEP_'||s.ord||'_COMPLETED','evidence','required','auditEvent','required','nextTaskCreated',s.ord<4)::text,
       true,true,true,true,s.ord>=3,NULL,NULL,NULL,'PLANNED',CASE WHEN s.ord=4 THEN 24 ELSE 12 END,
       CASE WHEN t.owner_actor_code='APPROVER' THEN 'AUDITOR' ELSE 'APPROVER' END,true,
       '원본 입력, 변경 전후 값, 담당자·시각, 결정 근거, 상태전이 로그, 생성 산출물 해시',
       CASE WHEN t.owner_actor_code='APPROVER' THEN 'AUDITOR' ELSE 'APPROVER' END,
       t.process_code||'_ROLLBACK_'||s.ord,
       '필수값·권한·직무분리·격리·기한·증적·중복요청을 통과한 경우에만 전이한다.'
FROM targets t CROSS JOIN stages s
ON CONFLICT(process_code,step_code) DO NOTHING;

WITH targets AS (
 SELECT p.process_code,p.process_name FROM framework_process_definition p WHERE p.development_order BETWEEN 200 AND 351
), types(case_type,suffix,label,severity,minutes) AS (VALUES
 ('HAPPY_PATH','HAPPY','정상 완료','HIGH',30),('EXCEPTION','EXCEPTION','필수값·업무예외','HIGH',20),
 ('AUTHORITY','AUTH','권한·직무분리 위반','CRITICAL',15),('ISOLATION','ISOLATION','테넌트·프로젝트 격리','CRITICAL',15),
 ('RECOVERY','RECOVERY','중단·중복·롤백 복구','HIGH',25)
)
INSERT INTO framework_simulation_case(case_code,process_code,case_name,case_type,preconditions,steps_json,assertions_json,case_status,severity,required_evidence,automated,expected_duration_minutes)
SELECT t.process_code||'_'||x.suffix,t.process_code,t.process_name||' - '||x.label,x.case_type,
       '서로 다른 액터 계정, 두 개 이상의 테넌트·프로젝트, 정상·오류 입력과 감사 수집기가 준비되어 있다.',
       (SELECT jsonb_agg(jsonb_build_object('order',s.step_order,'stepCode',s.step_code,'actorCode',s.actor_code,'command',s.command_code) ORDER BY s.step_order)::text FROM framework_process_step s WHERE s.process_code=t.process_code),
       CASE x.case_type WHEN 'HAPPY_PATH' THEN '["최종 상태 도달","모든 증적 존재","후속 Task 연결","감사 로그 완전"]'
        WHEN 'EXCEPTION' THEN '["잘못된 입력 거부","상태 불변","보완 Task 생성","필드 오류 기록"]'
        WHEN 'AUTHORITY' THEN '["비인가 액션 거부","요청·검토·승인 직무분리","거부 감사 기록"]'
        WHEN 'ISOLATION' THEN '["타 테넌트·프로젝트 데이터 미노출","직접 식별자 접근 거부","파일·검색·내보내기 격리"]'
        ELSE '["중복 생성 없음","중단 단계부터 재개","롤백 후 원본 보존","재시도 이력 기록"]' END,
       'DRAFT',x.severity,'화면 캡처, API 응답, DB 상태, 감사 이벤트, 생성 파일 해시',true,x.minutes
FROM targets t CROSS JOIN types x
ON CONFLICT(case_code) DO NOTHING;

INSERT INTO framework_development_job(process_code,step_code,job_type,job_name,target_path,specification_json,job_status,approval_status,created_by,execution_mode,job_group_code,required,progress_weight,max_attempts,quality_status,quality_report)
SELECT s.process_code,s.step_code,j.job_type,s.step_name||' - '||j.job_name,
       'design://process/'||lower(s.process_code)||'/'||lower(s.step_code)||'/'||lower(j.job_type),
       jsonb_build_object('processCode',s.process_code,'stepCode',s.step_code,'actorCode',s.actor_code,'completionRule',s.completion_rule,'inputContract',s.input_contract::jsonb,'outputContract',s.output_contract::jsonb,'commonAssetsOnly',true,'responsiveRequired',true,'accessibility','WCAG_2_1_AA','implementationClaimed',false)::text,
       'PLANNED','PENDING','COMPLETE_PROCESS_CATALOG','PARALLEL',j.group_code,true,j.weight,3,'PENDING','실제 구현·실행 증적이 있어야 완료 가능'
FROM framework_process_step s
CROSS JOIN (VALUES
 ('DESIGN','상세 설계 계약','DESIGN',1.0::numeric),('DATABASE','스키마·마이그레이션','BACKEND_DATA',1.0::numeric),
 ('API','API·권한·멱등성','BACKEND_API',1.0::numeric),('FRONTEND_USER','사용자 업무 화면','FRONTEND',1.0::numeric),
 ('FRONTEND_ADMIN','관리자 대응 화면','FRONTEND',1.0::numeric),('TEST','정상·예외·권한·격리·복구 테스트','TEST',1.0::numeric),
 ('INTEGRATION','메뉴·화면·API·DB 통합','INTEGRATION',1.0::numeric)
) j(job_type,job_name,group_code,weight)
WHERE s.process_code IN (SELECT process_code FROM framework_process_definition WHERE development_order BETWEEN 200 AND 351)
ON CONFLICT(process_code,step_code,job_type,target_path) DO NOTHING;

DO $$ DECLARE code varchar; BEGIN
 FOR code IN SELECT process_code FROM framework_process_definition WHERE development_order BETWEEN 200 AND 351 LOOP
   PERFORM framework_sync_development_dependencies(code);
 END LOOP;
END $$;
