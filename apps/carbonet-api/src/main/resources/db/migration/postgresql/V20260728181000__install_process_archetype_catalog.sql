create table if not exists framework_process_archetype (
    archetype_code varchar(80) primary key,
    archetype_name varchar(160) not null,
    category_code varchar(40) not null,
    purpose text not null,
    input_contract jsonb not null default '[]'::jsonb,
    output_contract jsonb not null default '[]'::jsonb,
    command_contract jsonb not null default '[]'::jsonb,
    state_contract jsonb not null default '["READY","RUNNING","COMPLETED","FAILED","CANCELLED"]'::jsonb,
    exception_contract jsonb not null default '["REJECTED","RETRY_REQUIRED","EXPIRED","RECOVERY_REQUIRED"]'::jsonb,
    test_contract jsonb not null default '["SUCCESS","VALIDATION","AUTHORITY","ISOLATION","RECOVERY"]'::jsonb,
    recommended_screen_types text[] not null default array['WORKSPACE'],
    sort_order integer not null,
    active_yn char(1) not null default 'Y' check (active_yn in ('Y','N')),
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp
);

create table if not exists framework_screen_process_archetype_binding (
    binding_id bigserial primary key,
    route_path varchar(1000) not null,
    archetype_code varchar(80) not null references framework_process_archetype(archetype_code),
    binding_role varchar(20) not null default 'PRIMARY' check (binding_role in ('PRIMARY','SUBPROCESS','EXCEPTION','COMMON')),
    process_code varchar(80),
    step_code varchar(80),
    actor_code varchar(80),
    entry_condition text,
    completion_condition text,
    binding_options jsonb not null default '{}'::jsonb,
    sort_order integer not null default 1,
    active_yn char(1) not null default 'Y' check (active_yn in ('Y','N')),
    created_by varchar(120) not null default 'SYSTEM',
    created_at timestamptz not null default current_timestamp,
    updated_at timestamptz not null default current_timestamp,
    unique (route_path, archetype_code, process_code, step_code)
);

create unique index if not exists uq_screen_process_archetype_primary
    on framework_screen_process_archetype_binding(route_path)
    where binding_role='PRIMARY' and active_yn='Y';
create index if not exists ix_screen_process_archetype_archetype
    on framework_screen_process_archetype_binding(archetype_code, active_yn);
create index if not exists ix_screen_process_archetype_process
    on framework_screen_process_archetype_binding(process_code, step_code, active_yn);

insert into framework_process_archetype
    (archetype_code, archetype_name, category_code, purpose, input_contract, output_contract, command_contract, recommended_screen_types, sort_order)
values
('IDENTITY_REGISTER','계정 등록','IDENTITY','신규 사용자의 식별정보와 동의를 검증하여 계정을 생성한다.','["identity","termsConsent"]','["accountId","registrationStatus"]','["VALIDATE","REGISTER"]','{CREATE,WIZARD}',101),
('IDENTITY_AUTHENTICATE','사용자 인증','IDENTITY','자격증명과 보안정책을 검증하여 세션을 발급한다.','["credential","securityContext"]','["session","actorAssignments"]','["AUTHENTICATE"]','{FORM}',102),
('IDENTITY_RECOVER','계정 복구','IDENTITY','본인확인 후 잠금 또는 자격증명을 안전하게 복구한다.','["identityProof"]','["recoveryResult"]','["VERIFY","RECOVER"]','{WIZARD}',103),
('IDENTITY_APPROVE','가입 승인','IDENTITY','신청 정보와 기업 소속을 검토하여 가입을 승인하거나 반려한다.','["registration"]','["approvalDecision"]','["APPROVE","REJECT"]','{APPROVAL}',104),
('IDENTITY_ASSIGN_ROLE','역할·권한 부여','IDENTITY','계정에 액터·역할·데이터 범위를 부여한다.','["accountId","role","dataScope"]','["authorityBinding"]','["ASSIGN","CHANGE"]','{DETAIL,APPROVAL}',105),
('IDENTITY_REVOKE','접근 회수','IDENTITY','만료·퇴사·위반 계정의 접근권한과 세션을 회수한다.','["accountId","reason"]','["revocationEvidence"]','["REVOKE"]','{APPROVAL,HISTORY}',106),
('PROJECT_CREATE','프로젝트 생성','PROJECT','업무 수행에 필요한 프로젝트 기본정보와 경계를 등록한다.','["projectProfile","scope"]','["projectId","initialTasks"]','["VALIDATE","CREATE"]','{WIZARD,CREATE}',201),
('PROJECT_CONFIGURE','프로젝트 설정','PROJECT','산정기간·조직경계·방법론·워크플로 정책을 설정한다.','["projectId","policies"]','["projectConfiguration"]','["CONFIGURE"]','{SETTINGS}',202),
('PROJECT_ASSIGN','프로젝트 담당자 배정','PROJECT','액터별 담당자와 책임·마감일을 배정한다.','["projectId","actorAssignments"]','["taskAssignments"]','["ASSIGN"]','{WORKSPACE,APPROVAL}',203),
('PROJECT_LAUNCH','프로젝트 착수','PROJECT','착수 조건 충족 여부를 검증하고 프로젝트 실행을 개시한다.','["projectId","readiness"]','["executionId"]','["LAUNCH"]','{WORKSPACE}',204),
('PROJECT_CHANGE','프로젝트 변경','PROJECT','진행 중 프로젝트의 범위·일정·담당 변경을 통제한다.','["changeRequest"]','["approvedChange"]','["REQUEST","REVIEW","APPLY"]','{APPROVAL,HISTORY}',205),
('PROJECT_CLOSE','프로젝트 종료','PROJECT','완료 조건과 미결 업무를 확인하여 프로젝트를 종료·보관한다.','["projectId","completionEvidence"]','["closureRecord"]','["CLOSE","ARCHIVE"]','{WORKSPACE,REPORT}',206),
('DATA_REQUEST','자료 제출 요청','DATA','필요 자료·기간·책임자·양식을 지정해 제출을 요청한다.','["requestScope","requiredFields"]','["dataRequest"]','["REQUEST"]','{CREATE,WORKSPACE}',301),
('DATA_MANUAL_ENTRY','자료 직접 입력','DATA','업무 데이터를 폼과 그리드에서 검증하며 입력한다.','["fieldContract"]','["validatedDataset"]','["SAVE","SUBMIT"]','{FORM,GRID}',302),
('DATA_FILE_IMPORT','파일 업로드·반영','DATA','표준 파일을 파싱·매핑·검증하여 데이터셋으로 반영한다.','["file","mappingRules"]','["importedDataset","audit"]','["UPLOAD","MAP","IMPORT"]','{UPLOAD,MAPPING}',303),
('DATA_EXTERNAL_SYNC','외부 데이터 연계','DATA','외부 API·파일·웹훅 데이터를 계약에 따라 동기화한다.','["connection","syncContract"]','["synchronizedDataset"]','["CONNECT","SYNC","RETRY"]','{INTEGRATION,MONITORING}',304),
('DATA_RECEIVE','자료 접수','DATA','제출 자료의 버전·무결성·제출자를 확인하여 접수한다.','["submission"]','["receipt","validationQueue"]','["RECEIVE"]','{WORKSPACE,DETAIL}',305),
('DATA_SUPPLEMENT','자료 보완·재제출','DATA','보완 요청을 추적하고 수정 자료를 원본 이력과 함께 재제출한다.','["revisionRequest","priorSubmission"]','["resubmission"]','["CORRECT","RESUBMIT"]','{WORKSPACE,HISTORY}',306),
('QUALITY_FORMAT_VALIDATE','형식 검증','QUALITY','스키마·타입·단위·필수값 형식을 자동 검증한다.','["dataset","schema"]','["formatFindings"]','["VALIDATE"]','{VALIDATION}',401),
('QUALITY_COMPLETENESS','완전성 검사','QUALITY','기간·조직·항목별 누락과 중복을 탐지한다.','["dataset","coverageRules"]','["completenessFindings"]','["CHECK"]','{VALIDATION,DASHBOARD}',402),
('QUALITY_ANOMALY','이상치 탐지','QUALITY','통계·규칙·과거값을 이용해 이상치를 분류한다.','["dataset","anomalyRules"]','["anomalyFindings"]','["DETECT","CLASSIFY"]','{ANALYSIS,VALIDATION}',403),
('QUALITY_EVIDENCE','증빙 검증','QUALITY','데이터와 증빙 파일의 연결·해시·유효기간을 검증한다.','["records","evidence"]','["evidenceFindings"]','["VERIFY"]','{EVIDENCE,VALIDATION}',404),
('QUALITY_CROSS_CHECK','교차 검증','QUALITY','연관 데이터·총계·외부 기준을 상호 대조한다.','["datasets","reconciliationRules"]','["reconciliationResult"]','["RECONCILE"]','{COMPARISON,VALIDATION}',405),
('QUALITY_CORRECT','오류 보정','QUALITY','검증 오류를 담당자에게 배정하고 수정·재검증한다.','["finding","correction"]','["correctedRecord"]','["ASSIGN","CORRECT","REVALIDATE"]','{WORKSPACE}',406),
('CALC_MAP_FACTOR','기준·계수 매핑','CALCULATION','입력 항목을 승인된 기준정보와 배출계수에 매핑한다.','["activityItem","factorCatalog"]','["factorMapping"]','["SEARCH","MAP","CONFIRM"]','{MAPPING}',501),
('CALC_UNIT_CONVERT','단위 환산','CALCULATION','원본 단위를 표준 단위로 환산하고 근거를 보존한다.','["value","sourceUnit","targetUnit"]','["convertedValue"]','["CONVERT"]','{CALCULATION}',502),
('CALC_EXECUTE','산정 실행','CALCULATION','확정 입력·계수·계산식으로 결과를 산정한다.','["validatedInputs","formula"]','["calculationResult"]','["CALCULATE"]','{CALCULATION,WORKSPACE}',503),
('CALC_RECALCULATE','재산정','CALCULATION','변경 원인을 기록하고 영향 범위만 다시 산정한다.','["changeSet","priorResult"]','["recalculatedResult","diff"]','["RECALCULATE"]','{COMPARISON,CALCULATION}',504),
('CALC_ALLOCATE','배분 계산','CALCULATION','제품·공정·조직 기준에 따라 결과를 배분한다.','["result","allocationRule"]','["allocatedResult"]','["ALLOCATE"]','{CALCULATION,COMPARISON}',505),
('CALC_AGGREGATE','결과 집계','CALCULATION','기간·Scope·조직·제품별 결과를 일관되게 집계한다.','["calculationResults"]','["aggregates"]','["AGGREGATE"]','{DASHBOARD,ANALYSIS}',506),
('COLLAB_TASK_REQUEST','업무 요청','COLLABORATION','대상·담당·기한·완료 조건을 포함한 업무를 요청한다.','["taskRequest"]','["assignedTask"]','["REQUEST","ACCEPT"]','{TASK,WORKSPACE}',601),
('COLLAB_COMMENT','댓글·협의','COLLABORATION','업무 객체에 의견·멘션·첨부를 기록한다.','["message","context"]','["discussionEntry"]','["COMMENT","REPLY"]','{DISCUSSION}',602),
('COLLAB_NOTIFY','알림 전달','COLLABORATION','업무 이벤트를 수신자 정책에 따라 전달한다.','["event","recipientPolicy"]','["notification"]','["NOTIFY"]','{NOTIFICATION}',603),
('COLLAB_REASSIGN','담당자 변경','COLLABORATION','책임 이관 사유와 인수인계를 기록하며 담당자를 변경한다.','["task","newAssignee"]','["reassignment"]','["REASSIGN"]','{TASK,APPROVAL}',604),
('COLLAB_DEADLINE','마감 관리','COLLABORATION','마감·지연·예외 연장과 경보를 관리한다.','["task","deadlinePolicy"]','["deadlineStatus"]','["EXTEND","REMIND"]','{DASHBOARD,TASK}',605),
('COLLAB_ESCALATE','업무 에스컬레이션','COLLABORATION','지연·충돌·미응답 업무를 상위 책임자에게 이관한다.','["task","escalationRule"]','["escalation"]','["ESCALATE"]','{TASK,APPROVAL}',606),
('APPROVAL_SUBMIT','검토 제출','APPROVAL','완료 조건을 검증하고 검토 가능한 버전으로 제출한다.','["workItem","evidence"]','["submission"]','["SUBMIT"]','{SUBMIT,WORKSPACE}',701),
('APPROVAL_REVIEW','전문 검토','APPROVAL','제출 데이터·근거·검증 결과를 검토하고 의견을 기록한다.','["submission","reviewChecklist"]','["reviewResult"]','["REVIEW","COMMENT"]','{APPROVAL,COMPARISON}',702),
('APPROVAL_REJECT','반려·보완 요청','APPROVAL','불충족 항목과 기한을 명시하여 반려한다.','["reviewResult","findings"]','["revisionRequest"]','["REJECT","REQUEST_REVISION"]','{APPROVAL}',703),
('APPROVAL_RESUBMIT','보완 재제출','APPROVAL','반려 항목별 조치 결과와 변경 이력을 제출한다.','["revisionRequest","corrections"]','["resubmission"]','["RESUBMIT"]','{WORKSPACE,HISTORY}',704),
('APPROVAL_APPROVE','승인','APPROVAL','권한·분리 원칙과 체크리스트를 확인하고 승인한다.','["reviewedSubmission"]','["approvalRecord"]','["APPROVE"]','{APPROVAL}',705),
('APPROVAL_CONFIRM','결과 확정','APPROVAL','승인된 결과를 잠그고 후속 보고·인증 업무를 개방한다.','["approvalRecord"]','["confirmedVersion"]','["CONFIRM"]','{APPROVAL,HISTORY}',706),
('REPORT_GENERATE','보고서 생성','REPORT','확정 데이터와 템플릿으로 추적 가능한 보고서를 생성한다.','["confirmedData","template"]','["report"]','["GENERATE"]','{REPORT}',801),
('REPORT_PREVIEW','보고서 미리보기','REPORT','출력 전 내용·레이아웃·언어·페이지를 검토한다.','["report"]','["previewFindings"]','["PREVIEW"]','{REPORT}',802),
('REPORT_EXPORT','보고서 다운로드','REPORT','동일 DOM과 인쇄 규칙으로 PDF·엑셀 산출물을 생성한다.','["report","exportOptions"]','["exportFile","hash"]','["EXPORT"]','{REPORT}',803),
('REPORT_SUBMIT','보고서 제출','REPORT','보고서와 부속 증적을 수신기관에 제출한다.','["reportPackage"]','["submissionReceipt"]','["SUBMIT"]','{SUBMIT}',804),
('REPORT_REVISE','보고서 정정','REPORT','정정 사유·영향·버전을 기록하고 보고서를 재발행한다.','["report","correction"]','["revisedReport"]','["REVISE"]','{REPORT,HISTORY}',805),
('REPORT_ARCHIVE','보고서 보관','REPORT','보고서·데이터셋·검증 증적을 보존정책에 따라 보관한다.','["reportPackage"]','["archiveRecord"]','["ARCHIVE"]','{HISTORY}',806),
('CERT_ISSUE','인증서 발급','CERTIFICATE','확정 결과와 발급 정책을 검증하여 인증서를 발급한다.','["confirmedResult","issuancePolicy"]','["certificate"]','["ISSUE"]','{CERTIFICATE}',901),
('CERT_VERIFY','인증서 검토','CERTIFICATE','발급 전 데이터·서명·중복·권한을 검토한다.','["certificateDraft"]','["verificationResult"]','["VERIFY"]','{APPROVAL,VALIDATION}',902),
('CERT_REVOKE','인증서 취소','CERTIFICATE','취소 사유와 효력을 기록하고 공개 상태를 갱신한다.','["certificate","revocationReason"]','["revocationRecord"]','["REVOKE"]','{APPROVAL,HISTORY}',903),
('CERT_REISSUE','인증서 재발급','CERTIFICATE','정정·만료·손상 사유에 따라 이전 인증서를 연결해 재발급한다.','["certificate","reissueReason"]','["reissuedCertificate"]','["REISSUE"]','{CERTIFICATE,HISTORY}',904),
('CERT_AUTHENTICATE','진위 확인','CERTIFICATE','PDF·QR·OCR·데이터셋·해시를 대조하여 진위를 판정한다.','["uploadedDocument","verificationKey"]','["authenticityResult"]','["EXTRACT","COMPARE","VERIFY"]','{VERIFICATION,COMPARISON}',905),
('CERT_APPEAL','이의 신청','CERTIFICATE','판정 또는 인증 결과에 대한 이의를 접수·심사한다.','["appeal","evidence"]','["appealDecision"]','["SUBMIT","REVIEW","DECIDE"]','{WORKSPACE,APPROVAL}',906),
('OPS_MONITOR','운영 모니터링','OPERATIONS','서비스·DB·배치·연계 상태와 핵심 지표를 관제한다.','["telemetry"]','["healthStatus"]','["MONITOR"]','{DASHBOARD,MONITORING}',1001),
('OPS_ALERT','장애·이상 경보','OPERATIONS','임계치와 이벤트를 평가해 담당자에게 경보한다.','["event","alertRule"]','["alert"]','["ALERT","ACKNOWLEDGE"]','{MONITORING,NOTIFICATION}',1002),
('OPS_RETRY','실패 재시도','OPERATIONS','실패 원인을 분류하고 멱등성을 보장하며 재시도한다.','["failedJob","retryPolicy"]','["retryResult"]','["RETRY"]','{MONITORING,TASK}',1003),
('OPS_AUDIT','감사 추적','OPERATIONS','주요 조회·변경·승인·배포 행위를 불변 증적으로 추적한다.','["auditEvents"]','["auditTrail"]','["SEARCH","EXPORT"]','{HISTORY,REPORT}',1004),
('OPS_BACKUP','백업','OPERATIONS','DB·파일·설정의 일관된 복구 지점을 생성·검증한다.','["backupScope","retentionPolicy"]','["backupSet"]','["BACKUP","VERIFY"]','{MONITORING,SETTINGS}',1005),
('OPS_RECOVER','복구','OPERATIONS','검증된 복구 지점으로 서비스를 복구하고 무결성을 확인한다.','["incident","backupSet"]','["recoveryEvidence"]','["RECOVER","VERIFY"]','{WORKSPACE,MONITORING}',1006)
on conflict (archetype_code) do update set
    archetype_name=excluded.archetype_name,
    category_code=excluded.category_code,
    purpose=excluded.purpose,
    input_contract=excluded.input_contract,
    output_contract=excluded.output_contract,
    command_contract=excluded.command_contract,
    recommended_screen_types=excluded.recommended_screen_types,
    sort_order=excluded.sort_order,
    active_yn='Y',
    updated_at=current_timestamp;

create or replace view framework_process_archetype_coverage as
select
    a.archetype_code,
    a.archetype_name,
    a.category_code,
    count(distinct b.route_path) filter (where b.active_yn='Y') as screen_count,
    count(distinct b.process_code) filter (where b.active_yn='Y') as process_count,
    count(distinct b.actor_code) filter (where b.active_yn='Y') as actor_count,
    count(*) filter (where b.active_yn='Y' and b.binding_role='PRIMARY') as primary_binding_count
from framework_process_archetype a
left join framework_screen_process_archetype_binding b using(archetype_code)
where a.active_yn='Y'
group by a.archetype_code,a.archetype_name,a.category_code,a.sort_order
order by a.sort_order,a.archetype_code;
