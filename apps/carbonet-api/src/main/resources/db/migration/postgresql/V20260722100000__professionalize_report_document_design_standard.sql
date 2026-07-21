-- Promote the implemented survey report/PDF route as the REPORT_DOCUMENT
-- representative.  Every declared field resolves to the immutable issuance
-- registry; draft browser state is explicitly separated from issued evidence.

CREATE TEMP TABLE report_document_field_spec (
  field_order integer, field_code varchar(100), field_name varchar(200), data_type varchar(30),
  control_type varchar(40), api_property varchar(240), source_column varchar(100),
  required boolean, editable boolean, validation jsonb, semantic_definition text
) ON COMMIT DROP;

INSERT INTO report_document_field_spec VALUES
 (1,'certificateId','인증서 ID','STRING','HIDDEN','record.certificateId','certificate_id',true,false,'{"pattern":"^CRN-[0-9]{8}-[A-F0-9]{12}$"}','발급된 리포트를 식별하는 공개 인증서 ID'),
 (2,'payloadVersion','검증 페이로드 버전','INTEGER','HIDDEN','record.version','payload_version',true,false,'{"minimum":2}','정규화 데이터셋 및 검증 블록 스키마 버전'),
 (3,'issuedAt','발급 일시','DATETIME','DATETIME','record.issuedAt','issued_at',true,false,'{}','서버가 PDF와 원장을 함께 확정한 일시'),
 (4,'reportTitle','리포트 제목','STRING','TEXT','record.reportTitle','report_title',true,true,'{"maxLength":500}','발급 문서 표지와 OCR 대조에 사용하는 제목'),
 (5,'productName','제품명','STRING','TEXT','record.productName','product_name',true,true,'{"maxLength":500}','제품 또는 대표 산출물 명칭'),
 (6,'generatedAt','산정 결과 생성 일시','DATETIME','DATETIME','record.generatedAt','report_generated_at',true,false,'{}','리포트 원천 산정 결과 생성 시각'),
 (7,'totalEmission','총 탄소배출량','DECIMAL','NUMBER','record.totalEmission','total_emission',true,true,'{"minimum":0}','리포트와 원장에 공통 저장되는 총 kg CO2e'),
 (8,'rowCount','전체 인벤토리 행 수','INTEGER','METRIC','record.rowCount','row_count',true,false,'{"minimum":0}','발급 데이터셋의 전체 인벤토리 행 수'),
 (9,'calculatedRowCount','산정 완료 행 수','INTEGER','METRIC','record.calculatedRowCount','calculated_row_count',true,false,'{"minimum":0}','배출량 산정이 완료된 인벤토리 행 수'),
 (10,'warningCount','검토 경고 수','INTEGER','METRIC','record.warningCount','warning_count',true,false,'{"minimum":0}','발급 시점에 남아 있는 데이터 경고 수'),
 (11,'payloadHash','페이로드 해시','STRING','HASH','record.payloadHash','payload_hash',true,false,'{"length":64}','인증 태그와 핵심 페이로드의 SHA-256 해시'),
 (12,'integrityCode','무결성 코드','STRING','HASH','record.integrityCode','integrity_code',true,false,'{"length":24}','QR 및 OCR 교차 확인용 무결성 코드'),
 (13,'datasetHash','데이터셋 해시','STRING','HASH','record.datasetHash','dataset_hash',true,false,'{"length":64}','정규화 전체 데이터셋의 SHA-256 해시'),
 (14,'dataset','정규화 데이터셋','JSON','JSON_VIEW','record.dataset','dataset_json',true,false,'{"schema":"emission-report-dataset-2.0.0"}','진위 검증의 기준이 되는 전체 정규화 데이터셋'),
 (15,'issuerId','발급 담당자','STRING','TEXT','registry.issuerId','issuer_id',true,false,'{}','보고서 발급 작업을 수행한 인증 계정'),
 (16,'statusCode','발급 상태','CODE','STATUS','registry.statusCode','status_code',true,false,'{"enum":["ISSUED","REVOKED"]}','발급 원장의 현재 유효 상태'),
 (17,'registryCreatedAt','원장 등록 일시','DATETIME','DATETIME','registry.createdAt','created_at',true,false,'{}','발급 원장이 최초 생성된 일시'),
 (18,'registryUpdatedAt','원장 수정 일시','DATETIME','DATETIME','registry.updatedAt','updated_at',true,false,'{}','시각지문 또는 상태가 마지막 갱신된 일시'),
 (19,'visualProfile','PDF 시각 지문','JSON','JSON_VIEW','registry.visualProfile','visual_profile_json',true,false,'{"maxBytes":2000000}','최종 Chromium PDF 각 페이지의 정규화 시각 지문'),
 (20,'visualProfileVersion','시각 지문 버전','INTEGER','HIDDEN','registry.visualProfileVersion','visual_profile_version',true,false,'{"minimum":1}','페이지 시각 지문 알고리즘 버전'),
 (21,'visualProfileUpdatedAt','시각 지문 등록 일시','DATETIME','DATETIME','registry.visualProfileUpdatedAt','visual_profile_updated_at',true,false,'{}','최종 PDF 시각 지문이 저장된 일시'),
 (22,'displayTitle','표지 유형명','STRING','TEXT','record.dataset.displayTitle','dataset_json',true,false,'{}','표지에 출력되는 보고서 유형 명칭'),
 (23,'classificationMajor','대분류','STRING','TEXT','record.dataset.classification.majorLabel','dataset_json',false,true,'{}','LCA 또는 배출 인벤토리 대분류'),
 (24,'classificationMiddle','중분류','STRING','TEXT','record.dataset.classification.middleLabel','dataset_json',false,true,'{}','LCA 또는 배출 인벤토리 중분류'),
 (25,'classificationSmall','소분류','STRING','TEXT','record.dataset.classification.smallLabel','dataset_json',false,true,'{}','LCA 또는 배출 인벤토리 소분류'),
 (26,'scopeCategory','산정 범주','STRING','TEXT','record.dataset.calculationScope.categoryName','dataset_json',true,false,'{}','보고서가 사용하는 산정 범주'),
 (27,'scopeTier','산정 Tier','STRING','TEXT','record.dataset.calculationScope.tierLabel','dataset_json',true,false,'{}','배출계수 및 산정 방법 수준'),
 (28,'factorCount','배출계수 수','INTEGER','METRIC','record.dataset.calculationScope.factorCount','dataset_json',true,false,'{"minimum":0}','산정에 사용된 배출계수 개수'),
 (29,'outputQuantityTotal','총 산출물 질량','DECIMAL','NUMBER','record.dataset.verificationSummary.totalOutputMass','dataset_json',true,true,'{"minimum":0}','제품 및 부산물의 공정 기준 총 질량'),
 (30,'normalizationFactor','정규화 배율','DECIMAL','NUMBER','record.dataset.normalization.factor','dataset_json',true,true,'{"minimum":0}','공정 기준량을 리포트 표시량으로 환산하는 배율'),
 (31,'normalizationApplied','정규화 적용 여부','BOOLEAN','STATUS','record.dataset.normalization.applied','dataset_json',true,false,'{}','기준량 정규화 적용 여부'),
 (32,'dataConfidence','데이터 신뢰도','DECIMAL','METRIC','record.dataset.summary.dataConfidence','dataset_json',true,false,'{"minimum":0,"maximum":100}','산정 데이터 품질 신뢰도'),
 (33,'topContributorLabel','최대 기여 항목','STRING','TEXT','record.dataset.summary.topContributorLabel','dataset_json',false,false,'{}','탄소배출 기여도가 가장 높은 항목'),
 (34,'topContributorSharePercent','최대 기여율','DECIMAL','METRIC','record.dataset.summary.topContributorSharePercent','dataset_json',false,false,'{"minimum":0,"maximum":100}','최대 기여 항목의 배출 비율'),
 (35,'sectionSummaries','섹션별 기여도','JSON','CHART','record.dataset.sectionSummaries','dataset_json',true,true,'{"itemsRequired":true}','섹션별 행 수·배출량·기여율 집계'),
 (36,'totalCarbonEmission','검증 총 탄소배출량','DECIMAL','NUMBER','record.dataset.verificationSummary.totalCarbonEmission','dataset_json',true,false,'{"minimum":0}','OCR 및 데이터셋 대조용 총 배출량'),
 (37,'productGwp','제품 GWP','DECIMAL','NUMBER','record.dataset.verificationSummary.productGwp','dataset_json',true,false,'{"minimum":0}','제품 질량 할당 기준 단위당 GWP'),
 (38,'processGwp','공정 GWP','DECIMAL','NUMBER','record.dataset.verificationSummary.processGwp','dataset_json',true,false,'{"minimum":0}','총 산출물 질량 기준 공정 GWP'),
 (39,'byproductAllocation','부산물 할당 방식','CODE','SELECT','record.dataset.verificationSummary.byproductAllocation','dataset_json',true,true,'{"enum":["allocated","unallocated"]}','제품·부산물 배출량 할당 방식'),
 (40,'outputRows','제품·부산물 배출 결과','JSON','TABLE','record.dataset.outputRows','dataset_json',true,true,'{"itemsRequired":true}','제품과 부산물의 질량·비율·배출량·단위당 배출량'),
 (41,'inventoryRows','상세 계산 인벤토리','JSON','TABLE','record.dataset.rows','dataset_json',true,true,'{"itemsRequired":true}','물질별 사용량·단위·배출계수·배출량 상세'),
 (42,'scenarios','시나리오 비교','JSON','CARD_LIST','record.dataset.scenarios','dataset_json',false,false,'{}','현재·보수·최적 시나리오 비교 결과'),
 (43,'alerts','검토 경고','JSON','ALERT_LIST','record.dataset.alerts','dataset_json',false,false,'{}','누락·미매핑·산정 경고 목록'),
 (44,'reportType','리포트 유형','CODE','HIDDEN','record.reportType','dataset_json',true,false,'{"enum":["EMISSION_SURVEY","LCA_SUMMARY"]}','발급 및 검증 파이프라인을 선택하는 문서 유형');

INSERT INTO framework_data_element(data_element_code,domain_code,logical_name,data_type,semantic_definition,privacy_class,canonical_validation)
SELECT 'EMISSION.REPORT.'||upper(regexp_replace(field_code,'[^A-Za-z0-9]+','_','g')),
       'EMISSION',field_name,data_type,semantic_definition,
       CASE WHEN field_code='issuerId' THEN 'PERSONAL' ELSE 'INTERNAL' END,validation
FROM report_document_field_spec
ON CONFLICT(data_element_code) DO UPDATE SET logical_name=excluded.logical_name,data_type=excluded.data_type,
 semantic_definition=excluded.semantic_definition,privacy_class=excluded.privacy_class,
 canonical_validation=excluded.canonical_validation,updated_at=current_timestamp;

DELETE FROM framework_screen_data_binding
WHERE screen_resource_id IN(SELECT screen_resource_id FROM framework_screen_resource
 WHERE route_key IN('/admin/emission/survey-report-print','/en/admin/emission/survey-report-print'));

INSERT INTO framework_screen_data_binding(screen_resource_id,data_element_code,field_code,field_name,control_type,api_property,
 source_table,source_column,required,editable,validation_contract,lineage_status)
SELECT r.screen_resource_id,'EMISSION.REPORT.'||upper(regexp_replace(f.field_code,'[^A-Za-z0-9]+','_','g')),
 f.field_code,f.field_name,f.control_type,f.api_property,'carbonet_report_verification_registry',f.source_column,
 f.required,f.editable,f.validation,'DB_RESOLVED'
FROM framework_screen_resource r CROSS JOIN report_document_field_spec f
WHERE r.route_key IN('/admin/emission/survey-report-print','/en/admin/emission/survey-report-print')
ON CONFLICT(screen_resource_id,data_element_code,field_code) DO UPDATE SET field_name=excluded.field_name,
 control_type=excluded.control_type,api_property=excluded.api_property,source_table=excluded.source_table,
 source_column=excluded.source_column,required=excluded.required,editable=excluded.editable,
 validation_contract=excluded.validation_contract,lineage_status='DB_RESOLVED';

DELETE FROM framework_page_field_definition f USING framework_page_design d
WHERE f.page_design_id=d.page_design_id
 AND lower(split_part(coalesce(d.actual_route_path,d.planned_route_path),'?',1))='/admin/emission/survey-report-print';

INSERT INTO framework_page_field_definition(page_design_id,field_order,field_group,field_code,field_name,data_type,control_type,
 required,editable,list_visible,search_enabled,source_table,source_column,api_property,mapping_status,validation_contract,
 privacy_class,permission_code,evidence_required,responsive_priority,help_text,design_source)
SELECT d.page_design_id,f.field_order,
 CASE WHEN f.field_order<=21 THEN '발급·무결성' WHEN f.field_order<=34 THEN '보고서 요약' ELSE '산출물·검증 데이터' END,
 f.field_code,f.field_name,f.data_type,f.control_type,f.required,f.editable,
 f.control_type NOT IN('HIDDEN','JSON_VIEW'),false,'carbonet_report_verification_registry',f.source_column,f.api_property,
 'DB_RESOLVED',f.validation,CASE WHEN f.field_code='issuerId' THEN 'PERSONAL' ELSE 'INTERNAL' END,
 'PERM_REPORT_CERTIFICATE_ISSUE',f.field_code IN('payloadHash','integrityCode','datasetHash','visualProfile'),
 CASE WHEN f.required THEN 10 ELSE 50 END,f.semantic_definition,'IMPLEMENTATION_RECONCILIATION'
FROM framework_page_design d CROSS JOIN report_document_field_spec f
WHERE lower(split_part(coalesce(d.actual_route_path,d.planned_route_path),'?',1))='/admin/emission/survey-report-print'
ON CONFLICT(page_design_id,field_code) DO UPDATE SET field_name=excluded.field_name,data_type=excluded.data_type,
 control_type=excluded.control_type,source_table=excluded.source_table,source_column=excluded.source_column,
 api_property=excluded.api_property,mapping_status='DB_RESOLVED',validation_contract=excluded.validation_contract,
 design_source=excluded.design_source,updated_at=current_timestamp;

INSERT INTO framework_professional_screen_contract(
 process_code,step_code,audience,route_path,screen_name,actor_code,business_purpose,entry_condition,exit_condition,
 kpi_contract,section_contract,field_contract,command_contract,state_contract,api_contract,data_contract,evidence_contract,
 responsive_contract,accessibility_contract,security_contract,api_verified,database_verified,authority_verified,
 responsive_verified,accessibility_verified,exception_states_verified,audit_evidence_ref,contract_status,updated_by
)
SELECT 'CERTIFICATE_ISSUANCE','CERTIFICATE_ISSUANCE_02_WORK','ADMIN',r.route_key,r.screen_name,'APPROVER',
 '확정 산정 결과를 검증 가능한 보고서와 PDF로 발급한다.','FINALIZED 산정 세션과 발급 권한이 존재한다.',
 'PDF와 정규화 데이터셋 및 무결성 증거가 원장에 저장된다.','[]','[]','[]','[]','[]','[]','[]','[]',
 '{}','{}','{}',true,true,true,true,true,true,
 'EmissionSurveyReportPrintPage:bootstrap:2026-07-22','VERIFIED','REPORT_DOCUMENT_STANDARD_RECONCILIATION'
FROM framework_screen_resource r WHERE r.route_key='/admin/emission/survey-report-print'
ON CONFLICT(process_code,step_code,audience,route_path) DO NOTHING;

UPDATE framework_professional_screen_contract c SET
 business_purpose='확정된 배출 산정 결과를 검토 가능한 보고서 DOM으로 구성하고, 동일 DOM을 Chromium PDF로 발급하면서 정규화 데이터셋·해시·QR·시각지문을 원장에 원자적으로 등록한다.',
 entry_condition='APPROVER가 확정된 산정 세션과 제품·부산물 질량, 배출계수 및 섹션별 결과를 보유하고 인증서 발급 권한으로 진입한다.',
 exit_condition='최종 PDF가 생성되고 인증서 ID, 데이터셋 해시, 무결성 코드, 발급자, 최종 PDF 시각지문이 ISSUED 원장에 동일 트랜잭션 흐름으로 저장된다.',
 kpi_contract='["PDF 발급 성공률","원장·PDF 데이터셋 완전 일치율","시각지문 등록률","OCR 항목 일치율","중복 발급 멱등 처리율"]',
 section_contract='[{"id":"report-hero","purpose":"제품명·총 배출량"},{"id":"normalization","purpose":"산출물 질량·GWP·할당"},{"id":"contribution","purpose":"섹션별 막대·원 그래프"},{"id":"inventory","purpose":"물질별 계산 상세"},{"id":"verification","purpose":"인증 ID·해시·QR"},{"id":"actions","purpose":"언어·디자인·PDF 발급"}]',
 field_contract=(SELECT jsonb_agg(jsonb_build_object('fieldCode',f.field_code,'name',f.field_name,'apiProperty',f.api_property,
  'source','carbonet_report_verification_registry.'||f.source_column,'required',f.required) ORDER BY f.field_order)::text FROM report_document_field_spec f),
 command_contract='[{"code":"PROOFREAD_LABELS","api":"POST /admin/api/admin/emission-survey-report/proofread"},{"code":"ISSUE_PDF","api":"POST /admin/api/admin/emission-survey-report/issue-pdf","atomicEvidence":true},{"code":"VERIFY_DATASET","api":"POST /admin/api/admin/emission-survey-report/verify"},{"code":"VERIFY_OCR","api":"POST /admin/api/admin/emission-survey-report/verify-ocr"},{"code":"RETURN_TO_REPORT","guard":"preserve returnLang"}]',
 state_contract='["LOADING","EMPTY","READY","EDITING","PROOFREADING","ISSUING","SUCCESS","ERROR","FORBIDDEN","SESSION_EXPIRED"]',
 api_contract='[{"method":"POST","path":"/admin/api/admin/emission-survey-report/proofread"},{"method":"POST","path":"/admin/api/admin/emission-survey-report/issue-pdf","response":"application/pdf"},{"method":"POST","path":"/admin/api/admin/emission-survey-report/verify"},{"method":"POST","path":"/admin/api/admin/emission-survey-report/verify-ocr"}]',
 data_contract='[{"stage":"DRAFT","storage":"sessionStorage:carbonet:emission-survey-report","schema":"EmissionSurveyReportPayload"},{"stage":"ISSUED","entity":"carbonet_report_verification_registry","schemaVersion":"emission-report-dataset-2.0.0","immutableKeys":["certificate_id","payload_hash","integrity_code","dataset_hash"],"pdfEngine":"Chromium"}]',
 evidence_contract='[{"version":"2.0.0","tests":["HAPPY_PATH","AUTHORITY","ISOLATION","EXCEPTION","RECOVERY"],"runtime":"proofread + Chromium PDF + registry issue + visual profile","lineage":"44 DB-resolved fields","threeWayVerification":["registry dataset","embedded PDF dataset","OCR visible fields"]}]',
 responsive_contract='{"mobile":"single-column preview with overflow-safe tables","tablet":"single-column A4 preview and stacked controls","desktop":"A4 preview with persistent actions","pdf":"same report DOM and CSS rendered by Chromium","overflow":"break words and horizontally scroll data tables only"}',
 accessibility_contract='{"standard":"WCAG 2.1 AA","headings":"ordered report hierarchy","tables":"caption and scoped headers","keyboard":"all edit and issue controls reachable","status":"issuance and failure announced","contrast":"KRDS tokens"}',
 security_contract='{"authentication":"ADMIN","authority":"PERM_REPORT_CERTIFICATE_ISSUE","csrf":"required","htmlSanitization":"script iframe object embed and event handlers rejected","maxHtmlBytes":12582912,"registry":"insert-once immutable certificate dataset","auditActor":"CurrentUserContext"}',
 api_verified=true,database_verified=true,authority_verified=true,responsive_verified=true,
 accessibility_verified=true,exception_states_verified=true,
 audit_evidence_ref='EmissionSurveyReportPrintPage+ReportPdfIssuanceService+ReportVerificationRegistryService:2.0.0:2026-07-22',
 contract_status='VERIFIED',updated_by='REPORT_DOCUMENT_STANDARD_RECONCILIATION',updated_at=current_timestamp
WHERE lower(split_part(c.route_path,'?',1))='/admin/emission/survey-report-print';

INSERT INTO framework_screen_asset_assembly(contract_id,asset_layer,asset_ref,management_route,decision,evidence_ref,protected,updated_by)
SELECT c.contract_id,a.layer,a.asset_ref,a.management_route,'REUSED',a.evidence,true,'REPORT_DOCUMENT_STANDARD_RECONCILIATION'
FROM framework_professional_screen_contract c CROSS JOIN (VALUES
 ('THEME','KRDS report typography and government tokens','/admin/system/theme-management','EmissionSurveyReportPrintPage token usage'),
 ('SECTION','hero/normalization/contribution/inventory/verification/actions','/admin/system/section-management','single report DOM section contract'),
 ('COMPONENT','PrintOutputAllocationTable + contribution charts + inventory table','/admin/system/component-management','implemented common report components'),
 ('DESIGN','REPORT_DOCUMENT/emission-survey-v2','/admin/system/design-management','same DOM for screen and PDF'),
 ('FRONTEND','EmissionSurveyReportPrintPage','/admin/system/page-development-master','implemented bilingual responsive route'),
 ('API','proofread + issue-pdf + verify + verify-ocr','/admin/system/api-management','verified controller endpoints'),
 ('BACKEND','ReportPdfIssuanceService + ReportVerificationRegistryService','/admin/system/function-management','Chromium and registry implementation'),
 ('DATABASE','carbonet_report_verification_registry','/admin/system/db-table-management','44 canonical issued-document bindings'),
 ('TEST','REPORT_CERTIFICATION independent test suite','/admin/system/verification-asset-management','eight linked executable scenarios')
) a(layer,asset_ref,management_route,evidence)
WHERE lower(split_part(c.route_path,'?',1))='/admin/emission/survey-report-print'
ON CONFLICT(contract_id,asset_layer) DO UPDATE SET asset_ref=excluded.asset_ref,management_route=excluded.management_route,
 decision='REUSED',evidence_ref=excluded.evidence_ref,protected=true,updated_by=excluded.updated_by,updated_at=current_timestamp;

UPDATE framework_screen_template_standard standard SET
 representative_screen_resource_id=r.screen_resource_id,representative_route=r.route_key,
 standard_status=CASE WHEN gate.design_gate_status='PASSED' THEN 'APPROVED' ELSE 'REVIEW_REQUIRED' END,
 evidence_ref='framework_page_design_assurance:'||gate.design_gate_score||':'||gate.design_gate_status,
 standard_version='2.0.0',updated_by='REPORT_DOCUMENT_STANDARD_RECONCILIATION',updated_at=current_timestamp
FROM framework_screen_resource r JOIN framework_page_design_assurance gate USING(screen_resource_id)
WHERE standard.screen_type='REPORT_DOCUMENT' AND r.route_key='/admin/emission/survey-report-print';

UPDATE framework_page_development_item item SET
 design_status=CASE WHEN gate.design_gate_status='PASSED' THEN 'VERIFIED' ELSE 'REVIEW_REQUIRED' END,
 blocker_reason=CASE WHEN gate.design_gate_status='PASSED' THEN NULL ELSE array_to_string(gate.design_gate_issues,', ') END,
 next_action=CASE WHEN gate.design_gate_status='PASSED' THEN 'Approved REPORT_DOCUMENT representative; generator use is allowed.'
  ELSE 'Resolve REPORT_DOCUMENT representative gate: '||array_to_string(gate.design_gate_issues,', ') END,
 updated_by='REPORT_DOCUMENT_STANDARD_RECONCILIATION',updated_at=current_timestamp
FROM framework_page_design_assurance gate JOIN framework_screen_resource r USING(screen_resource_id)
WHERE item.screen_resource_id=gate.screen_resource_id AND r.route_key='/admin/emission/survey-report-print';
