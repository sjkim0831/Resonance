#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="${RESONANCE_ROOT:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260807134000__close_company_reapplication_public_contract.sql"
RESPONSE_MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260808010000__add_company_reapplication_applicant_response.sql"
RESPONSE_POLICY_MIGRATION="$ROOT/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260808020000__reset_company_reapplication_policy_for_response_revision.sql"
PROMOTER="$ROOT/ops/scripts/promote-screen-contract-after-e2e.sh"
PROMOTER_TEST="$ROOT/ops/scripts/test-promote-screen-contract-after-e2e.sh"
RUNTIME_E2E="$ROOT/ops/scripts/validate-company-reapplication-runtime.sh"
BUSINESS_E2E_WRAPPER="$ROOT/ops/tests/run-company-reapplication-business-e2e.sh"
BROWSER_E2E="$ROOT/ops/scripts/validate-company-reapplication-browser.mjs"
REAPPLY_UI="$ROOT/projects/carbonet-frontend/source/src/features/join-company-reapply/JoinCompanyReapplyMigrationPage.tsx"
REAPPLY_CONTROLLER="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/member/web/MemberJoinController.java"
APPROVAL_UI="$ROOT/projects/carbonet-frontend/source/src/features/company-approve/companyApproveSections.tsx"
ROUTE_GUARD_TEST="$ROOT/ops/tests/test-company-reapplication-route-guards.sh"
APPROVAL_CONTROLLER="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/admin/web/AdminApprovalController.java"
APPROVAL_COMMAND="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/admin/web/AdminApprovalCommandService.java"
APPROVAL_ACTION="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/admin/web/AdminApprovalActionService.java"
APPROVAL_STATUS="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/admin/web/AdminApprovalStatusChangeService.java"
MEMBER_SERVICE="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/member/service/impl/EnterpriseMemberServiceImpl.java"
MEMBER_MAPPER_XML="$ROOT/modules/resonance-common/carbonet-common-core/src/main/resources/egovframework/mapper/com/feature/member/EntrprsManageMapper.xml"
EVIDENCE_RECONCILER="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/member/service/support/InstitutionEvidenceReconciler.java"
EVIDENCE_SCHEDULER="$ROOT/modules/resonance-common/carbonet-common-core/src/main/java/egovframework/com/feature/member/service/support/InstitutionEvidenceReconciliationScheduler.java"
EVIDENCE_RECONCILER_TEST="$ROOT/modules/resonance-common/carbonet-common-core/src/test/java/egovframework/com/feature/member/service/support/InstitutionEvidenceReconcilerTest.java"
ADMIN_ACTIONS="$ROOT/projects/carbonet-frontend/source/src/lib/api/adminActions.ts"
ADMIN_API_CORE="$ROOT/projects/carbonet-frontend/source/src/lib/api/core.ts"

fail() { echo "[company-reapplication-contract-test] FAIL: $*" >&2; exit 1; }
for file in "$MIGRATION" "$RESPONSE_MIGRATION" "$RESPONSE_POLICY_MIGRATION" "$PROMOTER" "$PROMOTER_TEST" "$RUNTIME_E2E" \
  "$BUSINESS_E2E_WRAPPER" "$BROWSER_E2E" "$ROUTE_GUARD_TEST" \
  "$APPROVAL_CONTROLLER" "$APPROVAL_COMMAND" "$APPROVAL_ACTION" "$APPROVAL_STATUS" \
  "$MEMBER_SERVICE" "$MEMBER_MAPPER_XML" \
  "$EVIDENCE_RECONCILER" "$EVIDENCE_SCHEDULER" "$EVIDENCE_RECONCILER_TEST" \
  "$ADMIN_ACTIONS" "$ADMIN_API_CORE" "$REAPPLY_UI" "$REAPPLY_CONTROLLER" "$APPROVAL_UI"; do
  [[ -f "$file" ]] || fail "missing $file"
done
bash -n "$PROMOTER" "$PROMOTER_TEST" "$RUNTIME_E2E" "$ROUTE_GUARD_TEST" "$0"
bash "$ROUTE_GUARD_TEST"

node - "$MIGRATION" "$PROMOTER" "$RUNTIME_E2E" "$APPROVAL_CONTROLLER" \
  "$APPROVAL_COMMAND" "$APPROVAL_ACTION" "$APPROVAL_STATUS" \
  "$MEMBER_SERVICE" "$MEMBER_MAPPER_XML" \
  "$EVIDENCE_RECONCILER" "$EVIDENCE_SCHEDULER" "$EVIDENCE_RECONCILER_TEST" \
  "$ADMIN_ACTIONS" "$ADMIN_API_CORE" <<'NODE'
const fs = require('fs');
const [migrationPath, promoterPath, runtimePath, controllerPath, commandPath,
  actionPath, statusPath, memberServicePath, memberMapperXmlPath,
  evidenceReconcilerPath, evidenceSchedulerPath, evidenceReconcilerTestPath,
  adminActionsPath, adminCorePath] = process.argv.slice(2);
const sql = fs.readFileSync(migrationPath, 'utf8');
const promoter = fs.readFileSync(promoterPath, 'utf8');
const runtime = fs.readFileSync(runtimePath, 'utf8');
const controller = fs.readFileSync(controllerPath, 'utf8');
const command = fs.readFileSync(commandPath, 'utf8');
const action = fs.readFileSync(actionPath, 'utf8');
const status = fs.readFileSync(statusPath, 'utf8');
const memberService = fs.readFileSync(memberServicePath, 'utf8');
const memberMapperXml = fs.readFileSync(memberMapperXmlPath, 'utf8');
const evidenceReconciler = fs.readFileSync(evidenceReconcilerPath, 'utf8');
const evidenceScheduler = fs.readFileSync(evidenceSchedulerPath, 'utf8');
const evidenceReconcilerTest = fs.readFileSync(evidenceReconcilerTestPath, 'utf8');
const adminActions = fs.readFileSync(adminActionsPath, 'utf8');
const adminCore = fs.readFileSync(adminCorePath, 'utf8');
const assert = (value, message) => { if (!value) throw new Error(message); };

assert(sql.includes("'COMPANY_REAPPLICATION_PUBLIC'"), 'process contract missing');
assert(sql.includes("'COMPANY_REAPPLICATION_PUBLIC_RESUBMIT'"), 'public resubmit step missing');
assert(sql.includes("'COMPANY_REAPPLICATION_APPROVER_REVIEW'"), 'approver review step missing');
assert(/step_count\s*<>\s*2/i.test(sql), 'exact two-step assertion missing');
assert(sql.includes("'/join/companyreapply'"), 'canonical lowercase route missing');
assert(sql.includes('"/join/companyReapply"'), 'implemented camel-case alias missing');
assert(sql.includes("'PUBLIC','PUBLIC_APPLICANT','PRIMARY'"), 'exact PUBLIC actor binding missing');
assert(/active_target_count\s*<>\s*0/i.test(sql), 'pre-E2E active-target zero guard missing');
assert(/draft_target_count\s*<>\s*1/i.test(sql), 'one DRAFT target guard missing');
assert(sql.includes("binding_status='DRAFT'"), 'PUBLIC binding must be DRAFT before E2E');

for (const fragment of [
  'framework_company_reapplication_audit',
  'UNIQUE(project_id,instt_id,application_version)',
  "DEFAULT 'PUBLIC_APPLICANT'",
  "DEFAULT 'RESUBMIT_COMPANY_APPLICATION'",
  "DEFAULT 'REJECTED'",
  "DEFAULT 'APPLIED'",
  'change_hash varchar(64)',
  'framework_page_field_definition',
  'framework_screen_capability',
  'framework_state_transition_contract',
  'framework_process_data_handoff',
  'framework_step_execution_spec',
  'framework_simulation_case',
  'framework_step_test_binding',
  'framework_development_job',
  'framework_instt_file_scope_quarantine',
  'trg_enforce_instt_file_write_scope',
  'trg_company_reapplication_audit_immutable',
  'PLANNED_AFTER_QUARANTINE_EMPTY',
]) assert(sql.includes(fragment), `required contract fragment missing: ${fragment}`);

// Legacy institution evidence must never inherit a guessed project.  Only a
// unique institution match may be scoped; every unresolved row is quarantined.
for (const column of ['project_id','scope_status','file_sha256'])
  assert(new RegExp(`ALTER TABLE comtninsttfile ADD COLUMN IF NOT EXISTS ${column}`, 'i').test(sql),
    `COMTNINSTTFILE scope column missing: ${column}`);
assert(sql.includes("candidate.candidate_count=1"), 'unique-only legacy project backfill missing');
assert(!/SET\s+project_id\s*=\s*'P003'/i.test(sql), 'legacy files are falsely assigned to P003');
assert(sql.includes("scope_status IN ('ORPHAN','AMBIGUOUS','MISSCOPED')"), 'unresolved file quarantine missing');
assert(sql.includes('observed_project_id'), 'mis-scoped original project identity is not preserved');
assert(sql.includes('FOREIGN KEY(project_id,instt_id)'), 'project/institution composite FK missing');
assert(sql.includes('uq_comtninsttfile_project_file'), 'project/file unique index missing');
assert(sql.includes("nullable_project_column<>1"), 'nullable-until-quarantine-empty closure guard missing');
assert(sql.includes('COMTNINSTTFILE_PROJECT_SCOPE_REQUIRED'), 'new file write scope guard missing');
assert(sql.includes('COMTNINSTTFILE_SCOPE_IDENTITY_IMMUTABLE'), 'file scope identity mutation guard missing');
assert(sql.includes('UPDATE OF file_id,instt_id,project_id,scope_status,file_sha256'),
  'scope trigger does not cover every identity column');
assert(sql.includes("current_setting('resonance.file_scope_resolver',true)"), 'resolver-only scope mutation gate missing');
assert(sql.includes("requiredScope\":\"SCOPED"), 'SCOPED lineage contract missing');
assert(sql.includes("hashColumn\":\"file_sha256"), 'file SHA lineage contract missing');
assert(!sql.includes('instt_file_id'), 'nonexistent COMTNINSTTFILE key remains');

for (const column of ['evidence_file_ids','evidence_object_keys','evidence_sha256']) {
  assert(sql.includes(`${column} text[]`), `audit evidence identity column missing: ${column}`);
  assert(sql.includes(column), `audit evidence identity contract missing: ${column}`);
}
assert(sql.includes('COMPANY_REAPPLICATION_AUDIT_APPEND_ONLY'), 'append-only audit mutation guard missing');
assert(sql.includes("change_hash ~ '^[0-9a-f]{64}$'"), 'audit change hash validation missing');
assert(sql.includes('framework_unique_text_array'), 'duplicate evidence identity guard missing');
assert(sql.includes('"registeredContact"'), 'registered contact identity field missing');
assert(sql.includes('"maxCount":10') && sql.includes('"maxItems":10'), 'file count 1..10 contract missing');
assert(sql.includes('"required":["success","insttId","insttNm","bizrno","status","regDate","receipt"]'),
  'exact public response envelope missing');
assert(sql.includes('"required":["applicationVersion","evidenceFileCount","changeHash","fileIds","fileSha256s"]'),
  'exact nested receipt contract missing');
assert(!sql.includes('"auditId":"required"'), 'internal auditId is exposed as public response requirement');
assert(!sql.includes('"evidenceObjectKeys":"nonblank-array"'), 'internal object keys are exposed in public response');
assert(sql.includes('resource.screen_code,true,false'), 'both steps must require current project context');
assert(sql.includes("'PUBLIC_APPLICANT','PROJECT'"), 'PUBLIC actor data scope must be PROJECT');
assert(sql.includes("'APPROVER','PROJECT'"), 'APPROVER data scope must be PROJECT');
assert(sql.includes('"adminLookupScope":"CURRENT_PROJECT_MASTER_ADMIN"'),
  'admin data lookup is not current-project scoped');
assert(!sql.includes('"adminLookupScope":"GLOBAL_MASTER_ADMIN"'),
  'global unscoped admin data lookup remains');
assert(!sql.includes('"projectGuard":false'), 'an API contract bypasses current project guard');
assert(!sql.includes('"projectIsolated":false'), 'a persistence contract bypasses project isolation');
assert(sql.includes("'projectIsolation',true"), 'generated page/actor/nonfunctional project isolation missing');
assert(sql.includes('"projectContext":"ProjectRuntimeContext"'), 'admin API runtime project context missing');
assert(sql.includes('"authorityScope":"GLOBAL_MASTER_ADMIN"'),
  'master administrator global authority semantics were lost');
assert(sql.includes('"dataScope":"CURRENT_PROJECT"'),
  'master administrator current-project data scope missing');

assert(/CHECK\s*\(audience IN \('PUBLIC','USER','ADMIN'\)\)/i.test(sql), 'PUBLIC professional audience constraint missing');
assert(/contract_status\s*,?[^;]{0,1200}'REVIEW_REQUIRED'/is.test(sql), 'review-required professional contract missing');
assert(sql.includes("'DESIGN_COMPLETE','REVIEW_REQUIRED','BLOCKED'"), 'fail-closed execution spec missing');
assert(sql.includes("'PLANNED','APPROVED'"), 'planned development task contract missing');
assert(!/INSERT\s+INTO\s+framework_process_qa_run/i.test(sql), 'migration forges QA evidence');
assert(!/UPDATE\s+framework_development_job[\s\S]{0,1000}?SET[\s\S]{0,500}?job_status\s*=\s*'VERIFIED'/i.test(sql), 'migration promotes a job to VERIFIED');
assert(!/UPDATE\s+framework_professional_screen_contract[\s\S]{0,1200}?SET[\s\S]{0,800}?contract_status\s*=\s*'VERIFIED'/i.test(sql), 'migration promotes a screen contract to VERIFIED');

assert(sql.includes('EXECUTABLE +0, REVIEW_REQUIRED +0, canonical route total +0'), 'pre-E2E route policy delta missing');
assert(sql.includes('EXECUTABLE +1 / REVIEW_REQUIRED -1'), 'post-E2E route policy expectation missing');
assert(sql.includes('PENDING:validate-company-reapplication-runtime.sh'), 'runtime evidence must remain pending');
assert(runtime.includes('COMPANY_REAPPLICATION_PUBLIC_RESUBMIT'), 'runtime harness uses a different step code');
assert(runtime.includes('framework_company_reapplication_audit'), 'runtime harness does not reread the audit ledger');
assert(runtime.includes('COMTNINSTTINFO') || runtime.toLowerCase().includes('comtninsttinfo'), 'runtime harness does not reread institution state');
assert(runtime.includes('COMTNINSTTFILE') || runtime.toLowerCase().includes('comtninsttfile'), 'runtime harness does not verify evidence rows');
assert(runtime.includes('promotionEligible:false'), 'runtime scaffold must remain non-promoting until real E2E');
assert(!/(?:password|passwd|userPw)\s*[:=]\s*['"][^'"$\n]{3,}['"]/i.test(runtime), 'runtime harness contains a literal password');

for (const contractType of [
  'STEP_ACTOR_AUTHORITY','STEP_BUSINESS','STEP_GUIDE',
  'STEP_NONFUNCTIONAL','STEP_TRANSITION','STEP_PERSISTENCE'
]) assert(sql.includes(`'contractType','${contractType}'`) || sql.includes(`"contractType":"${contractType}"`),
  `promotion-ready ${contractType} missing`);
assert(sql.includes("'sla',jsonb_build_object("), 'nonfunctional SLA object missing');

// The administrator step is an exact contract of the implemented generic
// company approval API.  It must not invent version/hash review inputs.
assert(sql.includes('/admin/api/admin/member/company-approve/page'), 'resolved admin page API missing');
assert(sql.includes('/admin/api/admin/member/company-approve/action'), 'resolved admin action API missing');
assert(!/(?:GET|POST|"path":|"declaredContract":")\/api\/admin\/member\/company-approve\/(?:page|action)/.test(sql),
  'unresolved admin API path remains in contract');
for (const field of ['action','insttId','selectedIds','rejectReason','success','result','message'])
  assert(sql.includes(`"${field}"`) || sql.includes(`'${field}'`), `actual approval field missing: ${field}`);
for (const value of ['approve','batch_approve','reject','batch_reject','approved','batchApproved','rejected','batchRejected'])
  assert(sql.includes(`"${value}"`), `actual approval action/result missing: ${value}`);
assert(sql.includes('"approve":"P"') && sql.includes('"reject":"R"'), 'P/R state mapping missing');
for (const nonexistent of ['reviewDecision','reviewReason','reviewerId','reviewedAt','STALE_VERSION'])
  assert(!sql.includes(nonexistent), `nonexistent approval contract remains: ${nonexistent}`);

assert(controller.includes('@RequestMapping({"/admin", "/en/admin"})'), 'admin controller prefix evidence missing');
assert(controller.includes('@GetMapping("/api/admin/member/company-approve/page")'), 'controller page mapping evidence missing');
assert(controller.includes('@PostMapping("/api/admin/member/company-approve/action")'), 'controller action mapping evidence missing');
for (const key of ['payload.get("action")','payload.get("insttId")','payload.get("selectedIds")','payload.get("rejectReason")'])
  assert(command.includes(key), `command payload evidence missing: ${key}`);
for (const value of ['"approve"','"batch_approve"','"reject"','"batch_reject"'])
  assert(action.includes(value), `action normalization evidence missing: ${value}`);
assert(action.includes('? "P"') && action.includes('? "R"'), 'action targetStatus P/R evidence missing');
for (const response of ['response.put("success"','response.put("result"','response.put("selectedIds"','response.put("message"'])
  assert(action.includes(response), `API response evidence missing: ${response}`);
assert(status.includes('processCompanyApprovalStatusChange') && status.includes('vo.setInsttSttus(normalizedTargetStatus)'),
  'institution status persistence evidence missing');
assert(adminActions.includes('"/api/admin/member/company-approve/action"'), 'frontend logical action path missing');
assert(adminCore.includes('return buildLocalizedPath(`/admin${normalized}`'), 'frontend admin path resolver evidence missing');

// Global master authority does not imply global data.  Runtime service methods
// inject the selected project and every evidence lookup includes project_id.
assert(memberService.includes('private final ProjectRuntimeContext projectRuntimeContext'),
  'ProjectRuntimeContext dependency missing from member service');
assert(memberService.includes('searchCompanyListPaged(java.util.Map<String, Object> params)') &&
  memberService.includes('applyDefaultProjectId(params);'),
  'company approval list does not inject the current project');
assert(memberService.includes('selectInsttFiles(String insttId)') &&
  memberService.includes('selectInsttFileByFileId(String fileId)') &&
  (memberService.match(/requireCurrentProjectId\(\);/g) || []).length >= 2,
  'evidence lookup does not require current project context');
assert(/<select id="searchCompanyListPaged"[\s\S]*?AND PROJECT_ID = #\{projectId\}/.test(memberMapperXml),
  'company approval list SQL is not project-scoped');
assert(/<select id="selectInsttFiles"[\s\S]*?F\.PROJECT_ID = #\{projectId\}/.test(memberMapperXml),
  'institution evidence list SQL is not project-scoped');
assert(/<select id="selectInsttFileByFileId"[\s\S]*?F\.PROJECT_ID = #\{projectId\}/.test(memberMapperXml),
  'institution evidence detail SQL is not project-scoped');
assert(!/select[^\n]*InsttFile[^\n]*Global/i.test(memberService + memberMapperXml),
  'global unscoped institution-file lookup was introduced');

// Crash-window reconciliation is a SYSTEM_SUPPORT ledger item, never a third
// user journey step.  Contract identifiers must remain identical to runtime.
for (const [token, source] of [
  ['SYSTEM_RECOVERY', evidenceReconciler],
  ['COMPANY_REAPPLICATION_PUBLIC', evidenceReconciler],
  ['COMPANY_REAPPLICATION_EVIDENCE_RECONCILIATION', evidenceReconciler],
  ['TC_COMPANY_REAPPLICATION_EVIDENCE_CRASH_WINDOW', evidenceReconciler],
  ['TASK_COMPANY_REAPPLICATION_EVIDENCE_RECONCILE', evidenceReconciler],
]) assert(sql.includes(token) && source.includes(`"${token}"`), `recovery identifier drift: ${token}`);
assert(sql.includes('framework_system_support_contract'), 'system-support recovery ledger missing');
assert(sql.includes("'SYSTEM_RECOVERY','AUTOMATED'"), 'automated SYSTEM_RECOVERY ownership missing');
assert(sql.includes('"minimumAgeMinutes":60') && sql.includes('"scanLimit":500') &&
  sql.includes('"boundedScan":true'), 'age-60 bounded scan contract missing');
assert(sql.includes('"databaseFailureDeleteCount":0') &&
  sql.includes('"databaseLookupBeforeDelete":true'), 'DB-failure delete-zero contract missing');
assert(sql.includes('"local":"ReentrantLock.tryLock"') &&
  sql.includes('"shared":"FileChannel.tryLock"'), 'multi-pod lock contract missing');
assert(sql.includes('"legacyFilePreserved":true') && sql.includes('"symbolicLinkPreserved":true'),
  'legacy/symlink preservation contract missing');
assert(!/INSERT INTO framework_process_step\s*\([^;]*COMPANY_REAPPLICATION_EVIDENCE_RECONCILIATION/i.test(sql),
  'system recovery was inserted into the two-step user journey');
assert(/step_count\s*<>\s*2/i.test(sql), 'user step count no longer closes at two');
assert(evidenceScheduler.includes('@Scheduled(') &&
  evidenceScheduler.includes('minimum-age-minutes:60') &&
  evidenceScheduler.includes('scan-limit:500'), 'scheduler defaults drift from recovery contract');
assert(evidenceScheduler.includes('ReentrantLock') && evidenceScheduler.includes('FileLock') &&
  evidenceScheduler.includes('tryFileLock(channel)'), 'runtime multi-replica lock evidence missing');
assert(evidenceReconciler.includes('referenceLookup.findReferencedObjectKeys') &&
  evidenceReconciler.indexOf('referenceLookup.findReferencedObjectKeys') < evidenceReconciler.indexOf('Files.deleteIfExists'),
  'DB lookup does not fail closed before first delete');
assert(evidenceReconciler.includes('Files.isSymbolicLink') && evidenceReconciler.includes('scanLimit'),
  'symlink preservation or bounded scan implementation missing');
for (const testName of [
  'deletesOnlyOldNewContractFilesThatAreNotReferenced',
  'databaseFailureIsFailClosedAndDeletesNothing',
  'scanAndDatabaseQueryAreBounded',
  'actorProcessTestTaskEvidenceCodesRemainStable',
]) assert(evidenceReconcilerTest.includes(testName), `recovery unit evidence missing: ${testName}`);

assert(promoter.includes('USER|ADMIN|PUBLIC|ALL'), 'promoter usage does not expose PUBLIC');
assert(/\^\(USER\|ADMIN\|PUBLIC\|ALL\)\$/.test(promoter), 'promoter rejects PUBLIC audience');
assert(promoter.includes("binding.binding_status='DRAFT'"), 'promoter does not gate PUBLIC activation from DRAFT');
assert(promoter.includes("SET binding_status='ACTIVE'"), 'promoter does not activate exact PUBLIC binding');
assert(promoter.includes('active_exact_count<>public_contract_count'), 'promoter exact-binding count guard missing');
assert(promoter.includes('wrong_active_count<>0'), 'promoter wrong-active rollback guard missing');
assert(promoter.includes("audit_evidence_ref=concat('qa-run:sha256:'"), 'promoter does not bind exact E2E SHA');
assert(promoter.includes('resource.screen_resource_id IN ('), 'wrong-active guard is not scoped to the current route');
assert(promoter.includes('target_contract.process_code=current_setting'), 'current PUBLIC contract route scope missing');
NODE

# Validation-only mode is pure JSON contract checking and must accept PUBLIC
# without touching Kubernetes or PostgreSQL.
printf '%s' '{"status":"PASS","api":1,"database":1,"authority":1,"responsive":1,"accessibility":1,"exceptionStates":1,"audit":1,"recovery":1,"performanceP95Ms":250}' | \
  bash "$PROMOTER" COMPANY_REAPPLICATION_PUBLIC COMPANY_REAPPLICATION_PUBLIC_RESUBMIT \
    api PUBLIC --validate-only >/dev/null

node - "$RUNTIME_E2E" "$BROWSER_E2E" "$BUSINESS_E2E_WRAPPER" <<'NODE'
const fs=require('fs');
const [runtimePath,browserPath,wrapperPath]=process.argv.slice(2);
const runtime=fs.readFileSync(runtimePath,'utf8');
const browser=fs.readFileSync(browserPath,'utf8');
const wrapper=fs.readFileSync(wrapperPath,'utf8');
const assert=(value,message)=>{if(!value)throw new Error(message)};
for(const token of ['binding_status','REVIEW_REQUIRED','MISSING_WORKFLOW_EVIDENCE'])
  assert(runtime.includes(token),`pre-promotion screen-context evidence missing: ${token}`);
for(const token of ['desktop:1','mobile:1','accessibility:1','performanceSampleCount'])
  assert(browser.includes(token),`browser evidence missing: ${token}`);
assert(wrapper.includes('promotionEligible:true'),'complete evidence is not promotion eligible');
const preflight=wrapper.lastIndexOf('bash "$ROOT/ops/scripts/validate-company-reapplication-runtime.sh"');
const browserRun=wrapper.lastIndexOf('node "$ROOT/ops/scripts/validate-company-reapplication-browser.mjs"');
const promoter=wrapper.lastIndexOf('bash "$ROOT/ops/scripts/promote-screen-contract-after-e2e.sh"');
const postContext=wrapper.lastIndexOf('/home/api/screen-context');
assert(preflight>=0&&preflight<browserRun&&browserRun<promoter&&promoter<postContext,
  'required preflight -> browser -> promoter -> post-context order drifted');
NODE

node - "$RESPONSE_MIGRATION" "$REAPPLY_UI" "$REAPPLY_CONTROLLER" "$MEMBER_MAPPER_XML" "$APPROVAL_UI" "$BROWSER_E2E" <<'NODE'
const fs=require('fs');
const [migrationPath,uiPath,controllerPath,mapperPath,approvalPath,browserPath]=process.argv.slice(2);
const [migration,ui,controller,mapper,approval,browser]=[migrationPath,uiPath,controllerPath,mapperPath,approvalPath,browserPath].map(path=>fs.readFileSync(path,'utf8'));
const assert=(value,message)=>{if(!value)throw new Error(message)};
for(const token of ['applicant_response','framework_validate_company_reapplication_response','minLength":10','maxLength":2000'])
  assert(migration.includes(token),`applicant response migration contract missing: ${token}`);
for(const token of ['id="applicant-response"','보완·재신청 내용','applicantResponse.trim()'])
  assert(ui.includes(token),`applicant response UI contract missing: ${token}`);
for(const token of ['@RequestParam(value = "applicantResponse"','INVALID_APPLICANT_RESPONSE','applicantResponse.trim()'])
  assert(controller.includes(token),`applicant response API validation missing: ${token}`);
assert(mapper.includes('#{applicantResponse}')&&mapper.includes('applicant_response'), 'applicant response persistence mapping missing');
assert(approval.includes('신청자 보완 답변')&&approval.includes('reapplicationVersion'), 'admin re-review response comparison missing');
assert(browser.includes('#applicant-response')&&browser.includes('applicantResponseVerified'), 'browser E2E does not prove applicant response persistence');
NODE

node - "$RESPONSE_POLICY_MIGRATION" <<'NODE'
const fs=require('fs');
const migration=fs.readFileSync(process.argv[2],'utf8');
const assert=(value,message)=>{if(!value)throw new Error(message)};
for(const token of [
  "classification = 'REVIEW_REQUIRED'",
  "reason_code = 'MISSING_WORKFLOW_EVIDENCE'",
  "review_status = 'PENDING'",
  "policy.source = 'CONTRACT_E2E_PROMOTER'",
  "policy.review_status = 'AUTO_APPROVED'",
  "binding.binding_status = 'DRAFT'",
  "contract.contract_status = 'REVIEW_REQUIRED'",
  "v_policy<>1 OR v_binding<>1 OR v_contract<>1"
]) assert(migration.includes(token),`response policy reset contract missing: ${token}`);
assert(!/UPDATE[\s\S]+WHERE\s+policy\.route_key\s*=\s*'\/join\/companyreapply'\s*;/i.test(migration),
  'policy reset must preserve human review guards');
NODE

echo '[company-reapplication-contract-test] PASS process=1 userSteps=2 supportSteps=1 targetBinding=DRAFT:1/ACTIVE:0 publicAudience=1 cases=7 jobs=8 preE2E=REVIEW_REQUIRED postE2E=EXECUTABLE evidence=fail-closed'
