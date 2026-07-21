-- Replace cross-contaminated generated project-setup fields with the exact
-- frontend/API/SQL contract implemented by EmissionMyTasksPage.

INSERT INTO framework_data_element(data_element_code,domain_code,logical_name,data_type,semantic_definition,privacy_class,canonical_validation)
SELECT 'EMISSION.TASK.'||upper(regexp_replace(field_code,'([a-z0-9])([A-Z])','\1_\2','g')),
       'EMISSION',field_name,data_type,semantic_definition,privacy_class,validation::jsonb
FROM (VALUES
 ('id','업무 ID','LONG','프로젝트 업무를 식별하는 내부 키','INTERNAL','{"minimum":1}'),
 ('taskCode','업무 코드','STRING','프로젝트 내 업무 종류 코드','INTERNAL','{"required":true}'),
 ('stepOrder','업무 순서','INTEGER','프로세스 실행 순서','INTERNAL','{"minimum":1}'),
 ('projectId','프로젝트 ID','STRING','업무가 속한 배출량 프로젝트 식별자','INTERNAL','{"required":true}'),
 ('projectName','프로젝트명','STRING','사용자에게 표시하는 프로젝트 명칭','INTERNAL','{"required":true}'),
 ('site','사업장','STRING','업무 대상 사업장 명칭','INTERNAL','{}'),
 ('name','업무명','STRING','프로세스 단계의 사용자 업무 명칭','INTERNAL','{"required":true}'),
 ('type','업무 유형','CODE','업무 실행 유형 코드','INTERNAL','{}'),
 ('status','업무 상태','CODE','대기·실행·차단·완료 상태','INTERNAL','{"enum":["READY","IN_PROGRESS","WAITING","BLOCKED","DONE"]}'),
 ('priority','우선순위','CODE','업무 처리 우선순위','INTERNAL','{"enum":["URGENT","HIGH","NORMAL","LOW"]}'),
 ('assignee','담당자','STRING','업무를 배정받은 계정 ID','PERSONAL','{}'),
 ('dueDate','마감일','DATE','업무 완료 예정일','INTERNAL','{}'),
 ('targetUrl','업무 화면 경로','STRING','업무를 수행할 사용자 화면 경로','INTERNAL','{"pattern":"^/(?!admin/).*"}'),
 ('processCode','프로세스 코드','STRING','업무가 속한 표준 프로세스 코드','INTERNAL','{}'),
 ('processName','프로세스명','STRING','표준 프로세스 명칭','INTERNAL','{}'),
 ('domainCode','업무 종류 코드','STRING','프로세스를 분류하는 업무 도메인','INTERNAL','{}'),
 ('processStepCode','프로세스 단계 코드','STRING','현재 업무에 연결된 프로세스 단계','INTERNAL','{}'),
 ('actorCode','담당 액터','STRING','업무 수행 책임 액터','INTERNAL','{}'),
 ('completionRule','완료 조건','TEXT','실제 업무 완료를 판정하는 규칙','INTERNAL','{}'),
 ('blockedReason','차단 사유','TEXT','업무를 실행할 수 없는 원인','INTERNAL','{}'),
 ('entryState','진입 상태','STRING','프로세스 단계 시작 상태','INTERNAL','{}'),
 ('workPurpose','업무 목적','TEXT','단계에서 달성해야 하는 업무 목적','INTERNAL','{}'),
 ('requiredInputs','필수 입력 계약','JSON','업무 수행에 필요한 입력 계약','INTERNAL','{}'),
 ('expectedOutput','기대 산출물 계약','JSON','업무 완료 시 생성되는 산출물 계약','INTERNAL','{}'),
 ('commandCode','실행 명령','STRING','상태 전이를 발생시키는 명령 코드','INTERNAL','{}'),
 ('nextTaskName','다음 업무명','STRING','현재 단계 이후 인계할 업무','INTERNAL','{}'),
 ('nextActorCode','다음 담당 액터','STRING','다음 업무를 수행할 액터','INTERNAL','{}'),
 ('pendingPredecessors','미완료 선행업무','STRING','현재 업무를 차단하는 선행업무 목록','INTERNAL','{}'),
 ('actionable','실행 가능 여부','BOOLEAN','상태와 선행업무를 기준으로 계산한 실행 가능 여부','INTERNAL','{}'),
 ('completionSatisfied','완료 충족 여부','BOOLEAN','업무 산출물과 완료 규칙의 충족 여부','INTERNAL','{}'),
 ('completionEvidence','완료 근거','TEXT','완료 판정에 사용한 근거 요약','INTERNAL','{}'),
 ('summaryTotal','전체 업무 수','INTEGER','현재 조회 범위의 전체 업무 수','INTERNAL','{"minimum":0}'),
 ('summaryCompleted','완료 업무 수','INTEGER','현재 조회 범위의 완료 업무 수','INTERNAL','{"minimum":0}'),
 ('summaryToday','오늘 마감 수','INTEGER','오늘 마감되는 미완료 업무 수','INTERNAL','{"minimum":0}'),
 ('summaryOverdue','지연 업무 수','INTEGER','마감일이 지난 미완료 업무 수','INTERNAL','{"minimum":0}'),
 ('summaryApproval','승인 대기 수','INTEGER','승인 유형 미완료 업무 수','INTERNAL','{"minimum":0}'),
 ('notificationId','알림 ID','LONG','업무 인계 알림 식별자','INTERNAL','{"minimum":1}'),
 ('notificationTitle','알림 제목','STRING','업무 인계 알림 제목','INTERNAL','{}'),
 ('notificationMessage','알림 내용','TEXT','업무 인계 알림 본문','INTERNAL','{}'),
 ('notificationReadAt','알림 확인 일시','DATETIME','사용자가 알림을 확인한 시각','INTERNAL','{}')
) x(field_code,field_name,data_type,semantic_definition,privacy_class,validation)
ON CONFLICT(data_element_code) DO UPDATE SET logical_name=excluded.logical_name,data_type=excluded.data_type,
  semantic_definition=excluded.semantic_definition,privacy_class=excluded.privacy_class,
  canonical_validation=excluded.canonical_validation,updated_at=current_timestamp;

DELETE FROM framework_screen_data_binding
WHERE screen_resource_id IN(SELECT screen_resource_id FROM framework_screen_resource WHERE route_key IN('/emission/my-tasks','/en/emission/my-tasks'));

WITH field_spec(field_order,field_code,field_name,control_type,api_property,source_table,source_column,required,editable,validation) AS (VALUES
 (1,'id','업무 ID','HIDDEN','id','emission_project_task','task_id',true,false,'{}'),
 (2,'taskCode','업무 코드','HIDDEN','taskCode','emission_project_task','task_code',true,false,'{}'),
 (3,'stepOrder','업무 순서','HIDDEN','stepOrder','emission_project_task','step_order',true,false,'{}'),
 (4,'projectId','프로젝트 ID','LINK','projectId','emission_project_task','project_id',true,false,'{}'),
 (5,'projectName','프로젝트명','TEXT','projectName','emission_project_registry','project_name',true,false,'{}'),
 (6,'site','사업장','TEXT','site','emission_project_registry','site_name',false,false,'{}'),
 (7,'name','업무명','TEXT','name','emission_project_task','task_name',true,false,'{}'),
 (8,'type','업무 유형','BADGE','type','emission_project_task','task_type',false,false,'{}'),
 (9,'status','업무 상태','SELECT','status','emission_project_task','task_status',true,false,'{"filter":true}'),
 (10,'priority','우선순위','BADGE','priority','emission_project_task','priority',true,false,'{}'),
 (11,'assignee','담당자','TEXT','assignee','emission_project_task','assignee_id',false,false,'{}'),
 (12,'dueDate','마감일','DATE','dueDate','emission_project_task','due_date',false,false,'{"filter":"period"}'),
 (13,'targetUrl','업무 화면 경로','LINK','targetUrl','emission_project_task','target_url',false,false,'{"rejectAdminRoute":true}'),
 (14,'processCode','프로세스 코드','TEXT','processCode','emission_project_task','process_code',false,false,'{}'),
 (15,'processName','프로세스명','TEXT','processName','framework_process_definition','process_name',false,false,'{}'),
 (16,'domainCode','업무 종류 코드','TEXT','domainCode','framework_process_definition','domain_code',false,false,'{}'),
 (17,'processStepCode','프로세스 단계 코드','TEXT','processStepCode','emission_project_task','process_step_code',false,false,'{}'),
 (18,'actorCode','담당 액터','TEXT','actorCode','emission_project_task','actor_code',false,false,'{}'),
 (19,'completionRule','완료 조건','TEXTAREA','completionRule','emission_project_task','completion_rule',false,false,'{}'),
 (20,'blockedReason','차단 사유','ALERT','blockedReason','emission_project_task','blocked_reason',false,false,'{}'),
 (21,'entryState','진입 상태','TEXT','entryState','framework_process_step','from_state',false,false,'{}'),
 (22,'workPurpose','업무 목적','TEXTAREA','workPurpose','framework_process_step','requirement_text',false,false,'{}'),
 (23,'requiredInputs','필수 입력 계약','JSON_VIEW','requiredInputs','framework_process_step','input_contract',false,false,'{}'),
 (24,'expectedOutput','기대 산출물 계약','JSON_VIEW','expectedOutput','framework_process_step','output_contract',false,false,'{}'),
 (25,'commandCode','실행 명령','TEXT','commandCode','framework_process_step','command_code',false,false,'{}'),
 (26,'nextTaskName','다음 업무명','TEXT','nextTaskName','emission_project_task','task_name',false,false,'{"derivation":"next step_order"}'),
 (27,'nextActorCode','다음 담당 액터','TEXT','nextActorCode','emission_project_task','actor_code',false,false,'{"derivation":"next step_order"}'),
 (28,'pendingPredecessors','미완료 선행업무','TEXT','pendingPredecessors','emission_project_task','predecessor_codes',false,false,'{"derivation":"unfinished predecessor names"}'),
 (29,'actionable','실행 가능 여부','STATUS','actionable','emission_project_task','task_status',true,false,'{"derivation":"READY or IN_PROGRESS and predecessors complete"}'),
 (30,'completionSatisfied','완료 충족 여부','STATUS','completionSatisfied','emission_project_task','completion_rule',false,false,'{"derivation":"completion evidence evaluation"}'),
 (31,'completionEvidence','완료 근거','TEXT','completionEvidence','emission_project_task','completion_rule',false,false,'{"derivation":"completion readiness explanation"}'),
 (32,'summaryTotal','전체 업무 수','METRIC','summary.total','emission_project_task','task_id',false,false,'{"aggregate":"count"}'),
 (33,'summaryCompleted','완료 업무 수','METRIC','summary.completed','emission_project_task','task_status',false,false,'{"aggregate":"count where DONE"}'),
 (34,'summaryToday','오늘 마감 수','METRIC','summary.today','emission_project_task','due_date',false,false,'{"aggregate":"count due today and not DONE"}'),
 (35,'summaryOverdue','지연 업무 수','METRIC','summary.overdue','emission_project_task','due_date',false,false,'{"aggregate":"count overdue and not DONE"}'),
 (36,'summaryApproval','승인 대기 수','METRIC','summary.approval','emission_project_task','task_code',false,false,'{"aggregate":"count APPROVAL and not DONE"}'),
 (37,'notificationId','알림 ID','HIDDEN','notifications[].id','emission_workflow_notification','notification_id',false,false,'{}'),
 (38,'notificationTitle','알림 제목','TEXT','notifications[].title','emission_workflow_notification','title',false,false,'{}'),
 (39,'notificationMessage','알림 내용','TEXT','notifications[].message','emission_workflow_notification','message_text',false,false,'{}'),
 (40,'notificationReadAt','알림 확인 일시','DATETIME','notifications[].readAt','emission_workflow_notification','read_at',false,false,'{}')
)
INSERT INTO framework_screen_data_binding(screen_resource_id,data_element_code,field_code,field_name,control_type,api_property,
  source_table,source_column,required,editable,validation_contract,lineage_status)
SELECT r.screen_resource_id,'EMISSION.TASK.'||upper(regexp_replace(f.field_code,'([a-z0-9])([A-Z])','\1_\2','g')),
  f.field_code,f.field_name,f.control_type,f.api_property,f.source_table,f.source_column,f.required,f.editable,
  f.validation::jsonb,'DB_RESOLVED'
FROM framework_screen_resource r CROSS JOIN field_spec f
WHERE r.route_key IN('/emission/my-tasks','/en/emission/my-tasks')
ON CONFLICT(screen_resource_id,data_element_code,field_code) DO UPDATE SET field_name=excluded.field_name,
 control_type=excluded.control_type,api_property=excluded.api_property,source_table=excluded.source_table,
 source_column=excluded.source_column,required=excluded.required,editable=excluded.editable,
 validation_contract=excluded.validation_contract,lineage_status='DB_RESOLVED';

-- Keep the page-design catalog identical to the executable screen contract.
DELETE FROM framework_page_field_definition f USING framework_page_design d
WHERE f.page_design_id=d.page_design_id
  AND lower(split_part(coalesce(d.actual_route_path,d.planned_route_path),'?',1))='/emission/my-tasks';

INSERT INTO framework_page_field_definition(page_design_id,field_order,field_group,field_code,field_name,data_type,control_type,
 required,editable,list_visible,search_enabled,source_table,source_column,api_property,mapping_status,validation_contract,
 privacy_class,permission_code,evidence_required,responsive_priority,help_text,design_source)
SELECT d.page_design_id,row_number() over(order by b.field_code),
 CASE WHEN b.field_code like 'summary%' THEN '현황' WHEN b.field_code like 'notification%' THEN '알림' ELSE '업무 목록' END,
 b.field_code,b.field_name,'STRING',b.control_type,b.required,b.editable,
 b.control_type NOT IN('HIDDEN','JSON_VIEW'),b.field_code IN('status','dueDate'),b.source_table,b.source_column,b.api_property,
 'DB_RESOLVED',b.validation_contract,'INTERNAL','PERM_EMISSION_TASK_VIEW',false,
 CASE WHEN b.required THEN 10 ELSE 50 END,'실제 내 업무 API와 SQL 조회 계약에서 동기화됨','IMPLEMENTATION_RECONCILIATION'
FROM framework_page_design d
JOIN framework_screen_resource r ON r.route_key='/emission/my-tasks'
JOIN framework_screen_data_binding b ON b.screen_resource_id=r.screen_resource_id
WHERE lower(split_part(coalesce(d.actual_route_path,d.planned_route_path),'?',1))='/emission/my-tasks'
ON CONFLICT(page_design_id,field_code) DO UPDATE SET field_name=excluded.field_name,control_type=excluded.control_type,
 source_table=excluded.source_table,source_column=excluded.source_column,api_property=excluded.api_property,
 mapping_status='DB_RESOLVED',validation_contract=excluded.validation_contract,design_source=excluded.design_source,updated_at=current_timestamp;

UPDATE framework_professional_screen_contract
SET field_contract=(SELECT jsonb_agg(jsonb_build_object('fieldCode',b.field_code,'name',b.field_name,'apiProperty',b.api_property,
       'source',b.source_table||'.'||b.source_column,'required',b.required) ORDER BY b.field_code)::text
    FROM framework_screen_resource r JOIN framework_screen_data_binding b USING(screen_resource_id)
    WHERE r.route_key='/emission/my-tasks'),
    data_contract='[{"api":"GET /home/api/emission-tasks","entities":["emission_project_task","emission_project_registry","framework_process_step","framework_process_definition","emission_workflow_notification"],"tenantScoped":true,"actorScoped":true,"version":"task-contract-1.0.0"}]',
    evidence_contract='[{"version":"1.0.0","tests":["HAPPY_PATH","AUTHORITY","ISOLATION","EXCEPTION","RECOVERY"],"runtime":"GET tasks + POST task status + POST notification read","lineage":"40 DB-resolved fields"}]',
    audit_evidence_ref='EmissionMyTasksPage+EmissionProjectRegistryController+EmissionProjectRegistryService:2026-07-22',
    contract_status='VERIFIED',updated_by='MY_TASKS_STANDARD_RECONCILIATION',updated_at=current_timestamp
WHERE lower(split_part(route_path,'?',1))='/emission/my-tasks';

UPDATE framework_screen_template_standard standard
SET representative_screen_resource_id=r.screen_resource_id,representative_route=r.route_key,
 standard_status=CASE WHEN gate.design_gate_status='PASSED' THEN 'APPROVED' ELSE 'REVIEW_REQUIRED' END,
 evidence_ref='framework_page_design_assurance:'||gate.design_gate_score||':'||gate.design_gate_status,
 standard_version='1.0.0',updated_by='MY_TASKS_STANDARD_RECONCILIATION',updated_at=current_timestamp
FROM framework_screen_resource r JOIN framework_page_design_assurance gate USING(screen_resource_id)
WHERE standard.screen_type='WORKSPACE' AND r.route_key='/emission/my-tasks';

UPDATE framework_page_development_item item SET
 design_status=CASE WHEN gate.design_gate_status='PASSED' THEN 'VERIFIED' ELSE 'REVIEW_REQUIRED' END,
 blocker_reason=CASE WHEN gate.design_gate_status='PASSED' THEN NULL ELSE array_to_string(gate.design_gate_issues,', ') END,
 next_action=CASE WHEN gate.design_gate_status='PASSED' THEN 'Approved WORKSPACE representative; generator use is allowed.'
  ELSE 'Resolve WORKSPACE representative gate: '||array_to_string(gate.design_gate_issues,', ') END,
 updated_by='MY_TASKS_STANDARD_RECONCILIATION',updated_at=current_timestamp
FROM framework_page_design_assurance gate JOIN framework_screen_resource r USING(screen_resource_id)
WHERE item.screen_resource_id=gate.screen_resource_id AND r.route_key='/emission/my-tasks';
