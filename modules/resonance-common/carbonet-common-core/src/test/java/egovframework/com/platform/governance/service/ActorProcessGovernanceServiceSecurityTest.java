package egovframework.com.platform.governance.service;

import egovframework.com.platform.codex.service.CodexProvisioningService;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ActorProcessGovernanceServiceSecurityTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final ActorProcessGovernanceService service = new ActorProcessGovernanceService(
            jdbc, mock(ScreenDevelopmentNoteService.class), mock(CodexProvisioningService.class), mock(ScreenContractRuntimeService.class));

    @Test
    void persistedDesignCompleteStatusCanBeSavedAgain() {
        assertTrue(ActorProcessGovernanceService.isSupportedProfessionalContractStatus("DESIGN_COMPLETE"));
        assertFalse(ActorProcessGovernanceService.isSupportedProfessionalContractStatus("IMPLEMENTED"));
    }

    @Test
    void screenContractFieldSelectionPreservesEverySupportedAudience() {
        assertEquals("USER", ActorProcessGovernanceService.preferredScreenContractAudience("USER"));
        assertEquals("ADMIN", ActorProcessGovernanceService.preferredScreenContractAudience("admin"));
        assertEquals("PUBLIC", ActorProcessGovernanceService.preferredScreenContractAudience(" public "));
        assertEquals("USER", ActorProcessGovernanceService.preferredScreenContractAudience("UNBOUND"));
    }

    @Test
    void systemReportKeepsFixtureSuiteSeparateFromContractAuditAndBusinessE2e() {
        when(jdbc.queryForList(argThat(sql -> sql.contains("fixture_suite_cases")
                        && sql.contains("fixtureSuiteCoverageState")
                        && sql.contains("fixtureSuiteExecutionState")
                        && sql.contains("businessTestResult")),
                any(Object[].class))).thenReturn(List.of());

        Map<String, Object> report = service.systemProcessTestReport("", "", "");
        @SuppressWarnings("unchecked") Map<String, Object> summary = (Map<String, Object>) report.get("summary");

        ArgumentCaptor<String> sqlCaptor=ArgumentCaptor.forClass(String.class);
        verify(jdbc).queryForList(sqlCaptor.capture(),any(Object[].class));
        assertFalse(sqlCaptor.getValue().contains("p.domain_code,p.process_code,p.process_name"),
                "scoped_steps must expose process_code exactly once; s.* already contains it");
        assertTrue(sqlCaptor.getValue().contains("scope_metrics as materialized"),
                "scope metrics must execute once instead of being rescanned for every report row");
        assertTrue(sqlCaptor.getValue().contains("scoped_screen_ids as materialized"),
                "screen-level hashes must be restricted to the requested process scope");
        assertTrue(sqlCaptor.getValue().contains("left join lateral")
                        && !sqlCaptor.getValue().contains("row_number() over(partition by target.process_code"),
                "latest immutable evidence must use a bounded lookup instead of joining and sorting every historical run");
        assertTrue(sqlCaptor.getValue().contains("binding_targets as (")
                        && sqlCaptor.getValue().contains("left join framework_screen_capability c using(screen_resource_id)")
                        && sqlCaptor.getValue().contains("coalesce(c.capability_code,'ALL') capability_code"),
                "contract evidence must retain every active screen binding and actual capability target");
        assertTrue(sqlCaptor.getValue().contains("framework_current_business_e2e_evidence")
                        && sqlCaptor.getValue().contains("current_business_e2e as materialized")
                        && sqlCaptor.getValue().contains("current_runtime_source_commit"),
                "business evidence must be read only through the current runtime-version ledger view");
        assertTrue(sqlCaptor.getValue().contains("report_options as (select ?::boolean compact,?::int compact_limit_bytes)")
                        && sqlCaptor.getValue().contains("options.compact_limit_bytes"),
                "the report query must compact oversized evidence before JDBC materializes the response");

        assertEquals("CONTRACT_ONLY", report.get("auditMode"));
        assertEquals(false, report.get("businessFunctionsExecuted"));
        assertEquals(5, summary.get("fixtureSuiteRequiredTypeCount"));
        assertEquals(0, summary.get("fixtureSuiteBindingCount"));
        assertEquals("INVENTORY_AND_SIMULATION_EVIDENCE_ONLY", summary.get("fixtureSuiteMode"));
        assertEquals("NO_CURRENT_VERSION_EVIDENCE", summary.get("businessEvidenceStatus"));
        assertEquals("ACTIVE_BINDING_CAPABILITY", summary.get("auditTargetMode"));
    }

    @Test
    void compactSystemReportPreservesAuditFieldsAndBoundsOversizedEvidence() throws Exception {
        String oversized="{\"payload\":\""+"x".repeat(200_000)+"\"}";
        Map<String,Object> source=new java.util.LinkedHashMap<>();
        source.put("processCode","EMISSION_PROJECT");
        source.put("stepCode","EMISSION_PROJECT_COLLECT");
        source.put("inputContract","{\"required\":[\"projectId\"]}");
        source.put("outputContract","{\"activityDataId\":\"string\"}");
        source.put("apiContract","[\"POST /home/api/emission/activity-data\"]");
        source.put("latestInput",oversized);
        source.put("latestOutput",oversized);
        source.put("evidenceJson",oversized);
        source.put("simulationEvidenceJson",oversized);
        source.put("fixtureSuiteCasesJson",oversized);
        source.put("businessEvidenceJson",oversized);

        Map<String,Object> compacted=ActorProcessGovernanceService.compactSystemTestItem(source);
        byte[] serialized=new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsBytes(compacted);

        assertEquals("EMISSION_PROJECT",compacted.get("processCode"));
        assertEquals(source.get("inputContract"),compacted.get("inputContract"));
        for(String field:List.of("latestInput","latestOutput","evidenceJson","simulationEvidenceJson","fixtureSuiteCasesJson","businessEvidenceJson")){
            String value=String.valueOf(compacted.get(field));
            assertTrue(value.contains("\"compact\":true"),field+" must remain present as compact evidence metadata");
            assertTrue(value.contains("\"sha256\":"),field+" must retain an integrity digest");
            assertTrue(value.length()<512,field+" must not retain the oversized payload");
        }
        assertTrue(serialized.length<8_000,"compact evidence must have a bounded response size");
    }

    @Test
    void qaEvidenceFailsClosedWhenTheCurrentContractFingerprintIsUnavailable() {
        when(jdbc.queryForList(argThat(sql -> sql.contains("framework_current_process_step_contract_fingerprint")),
                any(Object[].class))).thenReturn(List.of());

        assertThrows(IllegalStateException.class, () -> service.recordQaResult(
                "EMISSION_PROJECT", "EMISSION_PROJECT_COLLECT", "PASSED",
                Map.of("verified", true), "", "qa-runner"));

        verify(jdbc, never()).update(argThat(sql -> sql.contains("framework_process_qa_run")), any(Object[].class));
    }

    @Test
    void qaEvidenceFailsClosedWhenTheDatabaseReturnsANullFingerprint() {
        Map<String,Object> contract=new java.util.LinkedHashMap<>();
        contract.put("processVersion","1.0.0");
        contract.put("contractFingerprint",null);
        when(jdbc.queryForList(argThat(sql -> sql.contains("framework_current_process_step_contract_fingerprint")),
                any(Object[].class))).thenReturn(List.of(contract));

        assertThrows(IllegalStateException.class, () -> service.recordQaResult(
                "EMISSION_PROJECT", "EMISSION_PROJECT_COLLECT", "PASSED", Map.of(), "", "qa-runner"));
        verify(jdbc, never()).update(argThat(sql -> sql.contains("framework_process_qa_run")), any(Object[].class));
    }

    @Test
    void bulkContractAuditIsCapabilityPagedAndLoadsFixturesInTheTargetQuery() {
        when(jdbc.queryForList(argThat(sql -> sql.contains("limit ? offset ?")
                        && sql.contains("fixture.test_case_id")
                        && sql.contains("left join framework_screen_capability capability using(screen_resource_id)")
                        && sql.contains("test.capability_code in(coalesce(capability.capability_code,'ALL'),'ALL')")),
                any(Object[].class))).thenReturn(List.of());

        Map<String,Object> result=service.auditSystemProcessContracts(Map.of(),"system-auditor");

        assertEquals(250,result.get("maxTargets"));
        assertEquals(0,result.get("targetOffset"));
        assertEquals(false,result.get("hasMore"));
        assertEquals("CONTRACT_ONLY",result.get("auditMode"));
        assertEquals("ACTIVE_BINDING_CAPABILITY",result.get("auditTargetMode"));
        assertEquals(false,result.get("businessFunctionsExecuted"));
        verify(jdbc,never()).queryForList(argThat(sql -> sql.startsWith("select test_case_id")),any(Object[].class));
    }

    @Test
    void compactBulkContractAuditResponseBoundsEvidenceAndPreservesFailureDiagnostics() throws Exception {
        String oversized="x".repeat(250_000);
        List<Map<String,Object>> runs=new java.util.ArrayList<>();
        for(int index=0;index<20;index++){
            Map<String,Object> run=new java.util.LinkedHashMap<>();
            run.put("runId",index+1L);run.put("processCode","PROCESS_"+index);run.put("stepCode","STEP_"+index);
            run.put("routePath","/generated/"+index);run.put("capabilityCode","SAVE");
            run.put("result",index<8?"ERROR":index<14?"BLOCKED":"PASSED");
            run.put("message",index<8?"ERROR_REASON_"+(index%2)+oversized:"");
            run.put("blockerCodes",List.of("FIELD_CONTRACT","PREINPUT_REQUIRED"));
            run.put("checks",List.of(Map.of("evidence",oversized)));
            runs.add(run);
        }

        Map<String,Object> compact=ActorProcessGovernanceService.compactContractAuditDiagnostics(runs);
        byte[] serialized=new com.fasterxml.jackson.databind.ObjectMapper().writeValueAsBytes(compact);

        assertEquals(20,compact.get("runCount"));
        assertEquals(10,compact.get("runsOmittedCount"));
        assertEquals(5,((List<?>)compact.get("errorSamples")).size());
        assertEquals(5,((List<?>)compact.get("blockedSamples")).size());
        assertTrue(((Map<?,?>)compact.get("reasonCounts")).containsKey("FIELD_CONTRACT"));
        assertTrue(serialized.length<20_000,"compact audit diagnostics must remain bounded even when stored evidence is oversized");
        assertFalse(new String(serialized,java.nio.charset.StandardCharsets.UTF_8).contains(oversized));
    }

    @Test
    void compactBulkContractAuditRequestKeepsPaginationAndTruthfulOutcome() {
        when(jdbc.queryForList(argThat(sql -> sql.contains("limit ? offset ?")),any(Object[].class))).thenReturn(List.of());

        Map<String,Object> result=service.auditSystemProcessContracts(Map.of("compact",true,"targetOffset",250,"maxTargets",100),"system-auditor");

        assertEquals(true,result.get("compact"));
        assertEquals("BLOCKED",result.get("outcome"));
        assertEquals(250,result.get("targetOffset"));
        assertEquals(100,result.get("maxTargets"));
        assertEquals(false,result.get("hasMore"));
        assertEquals(0,result.get("runCount"));
        assertEquals(List.of(),result.get("runs"));
        assertEquals(false,result.get("businessFunctionsExecuted"));
    }

    @Test
    void bulkContractAuditReturnsAStableNextOffsetWithoutProcessingTheLookaheadRow() {
        when(jdbc.queryForList(argThat(sql -> sql.contains("limit ? offset ?")
                        && sql.contains("left join framework_screen_capability capability using(screen_resource_id)")),
                any(Object[].class))).thenReturn(List.of(
                        Map.of("processCode","PROCESS_A","stepCode","STEP_1"),
                        Map.of("processCode","PROCESS_A","stepCode","STEP_2")));

        Map<String,Object> result=service.auditSystemProcessContracts(
                Map.of("targetOffset",7,"maxTargets",1),"system-auditor");

        assertEquals(1,result.get("targetCount"));
        assertEquals(true,result.get("hasMore"));
        assertEquals(8,result.get("nextTargetOffset"));
        assertEquals(1,result.get("errorCount"));
        @SuppressWarnings("unchecked") List<Map<String,Object>> runs=(List<Map<String,Object>>)result.get("runs");
        assertEquals(1,runs.size(),"the maxTargets+1 lookahead row must not be audited");
    }

    @Test
    void controlPlaneAdministratorComesFromExistingAuthorityData() {
        when(jdbc.queryForObject(argThat(sql -> sql.contains("ROLE_SYSTEM_MASTER")),
                org.mockito.ArgumentMatchers.eq(Integer.class), any(Object[].class)))
                .thenReturn(1);

        assertTrue(service.isControlPlaneAdministrator("platform-admin"));
    }

    @Test
    void controlPlaneCommandRequiresTheAuthenticatedAccount() {
        UUID executionId=UUID.randomUUID();
        when(jdbc.queryForList(argThat(sql -> sql.contains("from framework_process_execution e")),
                any(Object[].class))).thenReturn(List.of(Map.of(
                        "tenantId","TENANT_A","projectId","PROJECT_A",
                        "processCode","EMISSION_PROJECT","stepCode","EMISSION_PROJECT_COLLECT",
                        "executionStatus","RUNNING","actorCode","SITE_DATA_OWNER",
                        "commandCode","SUBMIT_ACTIVITY_DATA")));

        SecurityException failure=assertThrows(SecurityException.class,
                () -> service.validateProcessCommandFromControlPlane(
                        executionId,Map.of(),"BACKSTAGE_CONTROL_PLANE"));

        assertTrue(failure.getMessage().contains("Authenticated control-plane account"));
        verify(jdbc,never()).queryForList(argThat(sql -> sql.contains(
                "from framework_account_actor_assignment")),any(Object[].class));
    }

    @Test
    void nonDomainProcessKeepsUsingTheMetadataDraftContract() {
        assertFalse(service.verifyDomainCompletion(Map.of(
                "processCode","CONTENT_PUBLISH",
                "stepCode","CONTENT_DRAFT")));
    }

    @Test
    void completedEmissionDomainTaskDoesNotRequireADuplicateGenericDraft() {
        when(jdbc.queryForList(argThat(sql -> sql.contains("from emission_project_task")),
                any(Object[].class))).thenReturn(List.of(Map.of(
                        "taskStatus","DONE","blockedReason","","targetUrl","/emission/activity-data")));

        assertTrue(service.verifyDomainCompletion(Map.of(
                "processCode","EMISSION_PROJECT",
                "stepCode","EMISSION_PROJECT_COLLECT",
                "projectId","PROJECT_A",
                "tenantId","TENANT_A")));
    }

    @Test
    void incompleteActivityCollectionReportsTheRealDomainReadiness() {
        when(jdbc.queryForList(argThat(sql -> sql.contains("from emission_project_task")),
                any(Object[].class))).thenReturn(List.of(Map.of(
                        "taskStatus","IN_PROGRESS","blockedReason","","targetUrl","/emission/activity-data")));
        when(jdbc.queryForMap(argThat(sql -> sql.contains("emission_activity_quality_run")),
                any(Object[].class))).thenReturn(Map.of(
                        "activityCount",4L,"qualityReady",true,
                        "submittedCount",1L,"openRequestCount",1L));

        IllegalStateException failure=assertThrows(IllegalStateException.class,
                () -> service.verifyDomainCompletion(Map.of(
                        "processCode","EMISSION_PROJECT",
                        "stepCode","EMISSION_PROJECT_COLLECT",
                        "projectId","PROJECT_A",
                        "tenantId","TENANT_A")));

        assertTrue(failure.getMessage().contains("saved=4"));
        assertTrue(failure.getMessage().contains("qualityReady=true"));
        assertTrue(failure.getMessage().contains("openRequests=1"));
        assertTrue(failure.getMessage().contains("/emission/activity-data"));
    }

    @Test
    void orphanedEmissionExecutionFailsClosedInsteadOfUsingAGenericDraft() {
        when(jdbc.queryForList(argThat(sql -> sql.contains("from emission_project_task")),
                any(Object[].class))).thenReturn(List.of());

        IllegalStateException failure=assertThrows(IllegalStateException.class,
                () -> service.verifyDomainCompletion(Map.of(
                        "processCode","EMISSION_PROJECT",
                        "stepCode","EMISSION_PROJECT_COLLECT",
                        "projectId","DELETED_PROJECT",
                        "tenantId","TENANT_A")));

        assertTrue(failure.getMessage().contains("missing or orphaned"));
        assertTrue(failure.getMessage().contains("DELETED_PROJECT"));
    }

    @Test
    void startRequiresCurrentAccountsActorAssignment() {
        when(jdbc.queryForList(anyString(), any(Object[].class))).thenReturn(List.of(Map.of(
                "step_code", "STEP_1", "actor_code", "COMPANY_MANAGER", "from_state", "READY")));
        when(jdbc.queryForObject(argThat(sql -> sql.contains("lower(account_id)=lower(?)")),
                org.mockito.ArgumentMatchers.eq(Integer.class), any(Object[].class))).thenReturn(0);

        assertThrows(SecurityException.class, () -> service.startProcessExecution(Map.of(
                "tenantId", "TENANT_A", "projectId", "PROJECT_A", "processCode", "PROCESS_A",
                "actorCode", "COMPANY_MANAGER"), "user-a"));

        verify(jdbc).queryForObject(argThat(sql ->
                        sql.contains("(project_id=? or project_id='*')")
                                && sql.contains("lower(account_id)=lower(?)")),
                org.mockito.ArgumentMatchers.eq(Integer.class), any(Object[].class));
    }

    @Test
    void idempotencyEvidenceIsNotReadBeforeExecutionContextValidation() {
        UUID executionId = UUID.randomUUID();
        when(jdbc.queryForList(argThat(sql -> sql != null && sql.contains("from framework_process_execution where execution_id=? for update")),
                any(Object[].class))).thenReturn(List.of(Map.of(
                "execution_status", "RUNNING", "tenant_id", "TENANT_B", "project_id", "PROJECT_B",
                "process_code", "PROCESS_A", "current_step_code", "STEP_1")));

        assertThrows(SecurityException.class, () -> service.executeProcessCommand(executionId, Map.of(
                "tenantId", "TENANT_A", "projectId", "PROJECT_A", "processCode", "PROCESS_A",
                "stepCode", "STEP_1", "actorCode", "COMPANY_MANAGER", "commandCode", "RUN",
                "idempotencyKey", "same-key"), "user-a"));

        verify(jdbc, never()).queryForList(argThat(sql -> sql.contains("framework_process_execution_event")
                && sql.contains("idempotency_key")), any(Object[].class));
    }

    @Test
    void idempotentReplayKeepsTheOriginalCommandResponseContract() {
        UUID executionId = UUID.randomUUID();
        when(jdbc.queryForList(anyString(), any(Object[].class))).thenAnswer(invocation -> {
            String sql = invocation.getArgument(0);
            if (sql.contains("from framework_process_execution where execution_id=? for update")) {
                return List.of(Map.of(
                        "execution_status", "RUNNING", "tenant_id", "TENANT_A", "project_id", "PROJECT_A",
                        "process_code", "PROCESS_A", "current_step_code", "STEP_2"));
            }
            if (sql.contains("framework_process_execution_event") && sql.contains("idempotency_key")) {
                return List.of(Map.of("eventId", 73L, "toState", "SUBMITTED"));
            }
            return List.of();
        });

        Map<String, Object> replay = service.executeProcessCommand(executionId, Map.of(
                "tenantId", "TENANT_A", "projectId", "PROJECT_A", "processCode", "PROCESS_A",
                "stepCode", "STEP_1", "actorCode", "COMPANY_MANAGER", "commandCode", "RUN",
                "idempotencyKey", "same-key"), "user-a");

        assertTrue((Boolean) replay.get("idempotent"));
        assertEquals(73L, replay.get("eventId"));
        assertEquals("SUBMITTED", replay.get("toState"));
        assertEquals(73L, ((Map<?, ?>) replay.get("event")).get("eventId"));
    }

    @Test
    void designSaveWithoutProcessBindingReturnsAnExplicitGenerationGate() {
        ScreenDevelopmentNoteService notes = mock(ScreenDevelopmentNoteService.class);
        ActorProcessGovernanceService isolated = new ActorProcessGovernanceService(
                jdbc, notes, mock(CodexProvisioningService.class), mock(ScreenContractRuntimeService.class));
        when(notes.save(any(), anyString())).thenReturn(Map.of("version", 3));
        when(jdbc.queryForList(argThat(sql -> sql.contains("framework_professional_screen_contract")),
                org.mockito.ArgumentMatchers.eq(String.class), any(Object[].class))).thenReturn(List.of());
        UUID recoveryRun=UUID.randomUUID();
        when(jdbc.queryForObject(argThat(sql -> sql.contains("framework_design_self_healing_run")),
                org.mockito.ArgumentMatchers.eq(UUID.class), any(Object[].class))).thenReturn(recoveryRun);
        when(jdbc.queryForList(argThat(sql -> sql.contains("from framework_screen_blueprint where")),
                any(Object[].class))).thenReturn(List.of());

        Map<String, Object> result = isolated.saveDesignAndGenerate(Map.of(
                "routePath", "/emission/unbound",
                "designNote", "layout",
                "functionNote", "function",
                "acceptanceNote", "acceptance"), "designer");

        assertEquals("PROCESS_BINDING_REQUIRED", result.get("generationStatus"));
        assertEquals(false, result.get("buildRequired"));
        assertEquals(List.of(), result.get("codeOutputs"));
        assertEquals(recoveryRun, result.get("selfHealingRunId"));
        assertEquals("TRANSACTION_ROLLBACK", result.get("rollbackPolicy"));
        verify(jdbc).update(argThat(sql -> sql.contains("update framework_design_self_healing_run")), any(Object[].class));
    }

    @Test
    void dashboardDevelopmentRequestApprovesOnlyTheSelectedJob() {
        when(jdbc.queryForList(argThat(sql -> sql.contains("from framework_development_job where job_id=? for update")), any(Object[].class)))
                .thenReturn(List.of(Map.of("job_id", 41L, "process_code", "EMISSION_PROJECT", "step_code", "COLLECT", "job_status", "FAILED", "approval_status", "PENDING")));
        when(jdbc.update(anyString(), any(Object[].class))).thenReturn(1);

        Map<String, Object> result = service.requestDevelopmentJob(41L, "webmaster");

        assertEquals("RETRY", result.get("status"));
        assertEquals(true, result.get("changed"));
        verify(jdbc).update(argThat(sql -> sql.contains("approval_status='APPROVED'") && sql.contains("where job_id=?")), any(Object[].class));
        verify(jdbc).update(argThat(sql -> sql.contains("framework_development_job_event")), any(Object[].class));
    }

    @Test
    void dashboardDevelopmentRequestDoesNotReopenVerifiedWork() {
        when(jdbc.queryForList(argThat(sql -> sql.contains("from framework_development_job where job_id=? for update")), any(Object[].class)))
                .thenReturn(List.of(Map.of("job_id", 42L, "process_code", "EMISSION_PROJECT", "step_code", "REPORT", "job_status", "VERIFIED", "approval_status", "APPROVED")));

        Map<String, Object> result = service.requestDevelopmentJob(42L, "webmaster");

        assertEquals(false, result.get("changed"));
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }

    @Test
    void workDraftRejectsAnActorThatDoesNotOwnTheStep() {
        when(jdbc.queryForList(argThat(sql -> sql != null && sql.contains("select actor_code from framework_process_step")), any(Object[].class)))
                .thenReturn(List.of(Map.of("actor_code", "SITE_DATA_OWNER")));

        assertThrows(SecurityException.class, () -> service.saveWorkDraft(Map.of(
                "tenantId", "TENANT_A", "projectId", "PROJECT_A", "processCode", "EMISSION_PROJECT",
                "stepCode", "EMISSION_PROJECT_COLLECT", "actorCode", "UNAUTHORIZED_ACTOR",
                "expectedVersion", 0, "payloadJson", "{}", "evidenceJson", "{}"), "user-a"));

        verify(jdbc, never()).update(argThat(sql -> sql != null && sql.contains("framework_process_work_draft")), any(Object[].class));
    }

    @Test
    void workDraftRejectsAStaleOptimisticVersion() {
        when(jdbc.queryForList(argThat(sql -> sql != null && sql.contains("select actor_code from framework_process_step")), any(Object[].class)))
                .thenReturn(List.of(Map.of("actor_code", "SITE_DATA_OWNER")));
        when(jdbc.queryForObject(argThat(sql -> sql != null && sql.contains("lower(account_id)=lower(?)")),
                org.mockito.ArgumentMatchers.eq(Integer.class), any(Object[].class))).thenReturn(1);
        when(jdbc.queryForList(argThat(sql -> sql != null && sql.contains("from framework_process_work_draft") && sql.contains("for update")), any(Object[].class)))
                .thenReturn(List.of(Map.of("draft_id", UUID.randomUUID(), "draft_version", 2, "draft_status", "DRAFT")));

        assertThrows(IllegalStateException.class, () -> service.saveWorkDraft(Map.of(
                "tenantId", "TENANT_A", "projectId", "PROJECT_A", "processCode", "EMISSION_PROJECT",
                "stepCode", "EMISSION_PROJECT_COLLECT", "actorCode", "SITE_DATA_OWNER",
                "expectedVersion", 1, "payloadJson", "{}", "evidenceJson", "{}"), "user-a"));

        verify(jdbc, never()).update(argThat(sql -> sql != null && sql.startsWith("update framework_process_work_draft")), any(Object[].class));
    }

    @Test
    void projectDeliveryRequiresEveryBlueprintActorBindingBeforeMutation() {
        when(jdbc.queryForObject(argThat(sql -> sql.contains("select specification::text")),
                org.mockito.ArgumentMatchers.eq(String.class), any(Object[].class)))
                .thenReturn("{\"actors\":[{\"actorCode\":\"COMPANY_MANAGER\"},{\"actorCode\":\"SITE_DATA_OWNER\"}],\"processCodes\":[\"ACTIVITY_DATA\"]}");

        IllegalArgumentException failure=assertThrows(IllegalArgumentException.class,
                () -> service.applyProjectDeliveryBlueprint(Map.of(
                        "blueprintCode","EMISSION_STANDARD","tenantId","TENANT_A","projectId","PROJECT_A",
                        "actorBindings",List.of(Map.of("actorCode","COMPANY_MANAGER","accountId","manager-a"))),
                        "webmaster"));

        assertTrue(failure.getMessage().contains("every blueprint actor"));
        verify(jdbc,never()).queryForObject(argThat(sql -> sql.contains("framework_apply_project_delivery_blueprint")),
                org.mockito.ArgumentMatchers.eq(String.class),any(Object[].class));
    }

    @Test
    void actorAssignmentRejectsANonManagerBeforeAnyMutation() {
        when(jdbc.queryForObject(argThat(sql -> sql.contains("actor_code='COMPANY_MANAGER'")&&sql.contains("data_scope='*'")),
                org.mockito.ArgumentMatchers.eq(Integer.class),any(Object[].class))).thenReturn(0);

        SecurityException failure=assertThrows(SecurityException.class,()->service.assignActorAuthorized(Map.of(
                "accountId","data-owner","tenantId","TENANT_A","projectId","*","actorCode","SITE_DATA_OWNER"),
                "data-owner","TENANT_A","ROLE_USER",false));

        assertEquals("ACTOR_ASSIGNMENT_COMPANY_MANAGER_REQUIRED",failure.getMessage());
        verify(jdbc,never()).update(argThat(sql -> sql.contains("framework_account_actor_assignment")),any(Object[].class));
    }

    @Test
    void actorAssignmentRejectsACrossTenantManagerBeforeAnyMutation() {
        SecurityException failure=assertThrows(SecurityException.class,()->service.assignActorAuthorized(Map.of(
                "accountId","target-user","tenantId","TENANT_B","projectId","*","actorCode","SITE_DATA_OWNER"),
                "company-manager","TENANT_A","ROLE_ADMIN",false));

        assertEquals("ACTOR_ASSIGNMENT_TENANT_FORBIDDEN",failure.getMessage());
        verify(jdbc,never()).queryForObject(anyString(),org.mockito.ArgumentMatchers.eq(Integer.class),any(Object[].class));
        verify(jdbc,never()).update(anyString(),any(Object[].class));
    }

    @Test
    void actorAssignmentRejectsAProjectOutsideTheRequestedTenantBeforeAnyMutation() {
        when(jdbc.queryForObject(argThat(sql -> sql.contains("from emission_project_registry")&&sql.contains("project_id=?")&&sql.contains("tenant_id=?")),
                org.mockito.ArgumentMatchers.eq(Integer.class),any(Object[].class))).thenReturn(0);

        SecurityException failure=assertThrows(SecurityException.class,()->service.assignActorAuthorized(Map.of(
                "accountId","target-user","tenantId","TENANT_A","projectId","FOREIGN_PROJECT","actorCode","SITE_DATA_OWNER"),
                "platform-admin","DEFAULT","ROLE_SYSTEM_MASTER",true));

        assertEquals("ACTOR_ASSIGNMENT_PROJECT_TENANT_FORBIDDEN",failure.getMessage());
        verify(jdbc,never()).update(anyString(),any(Object[].class));
    }

    @Test
    void actorAssignmentRejectsATargetAccountOutsideTheManagersTenant() {
        when(jdbc.queryForObject(argThat(sql -> sql.contains("from comtnemplyrinfo")&&sql.contains("comtnentrprsmber")),
                org.mockito.ArgumentMatchers.eq(Integer.class),any(Object[].class))).thenReturn(0);

        SecurityException failure=assertThrows(SecurityException.class,()->service.assignActorAuthorized(Map.of(
                "accountId","foreign-user","tenantId","TENANT_A","projectId","*","actorCode","SITE_DATA_OWNER"),
                "company-manager","TENANT_A","ROLE_ADMIN",false));

        assertEquals("ACTOR_ASSIGNMENT_TARGET_TENANT_FORBIDDEN",failure.getMessage());
        verify(jdbc,never()).update(argThat(sql -> sql.contains("framework_account_actor_assignment")),any(Object[].class));
    }

    @Test
    void sameTenantCompanyManagerCanAssignAnExistingTenantAccount() {
        when(jdbc.queryForObject(argThat(sql -> sql.contains("from comtnemplyrinfo")&&sql.contains("comtnentrprsmber")),
                org.mockito.ArgumentMatchers.eq(Integer.class),any(Object[].class))).thenReturn(1);

        service.assignActorAuthorized(Map.of(
                "accountId","data-owner","tenantId","TENANT_A","projectId","*","actorCode","SITE_DATA_OWNER"),
                "company-manager","TENANT_A","ROLE_ADMIN",false);

        verify(jdbc).update(argThat(sql -> sql.contains("insert into framework_account_actor_assignment")),any(Object[].class));
    }

    @Test
    void activeCompanyManagerActorCanAssignWithoutAPlatformOrBootstrapAdminRole() {
        when(jdbc.queryForObject(argThat(sql -> sql.contains("actor_code='COMPANY_MANAGER'")&&sql.contains("data_scope='*'")),
                org.mockito.ArgumentMatchers.eq(Integer.class),any(Object[].class))).thenReturn(1);
        when(jdbc.queryForObject(argThat(sql -> sql.contains("from comtnemplyrinfo")&&sql.contains("comtnentrprsmber")),
                org.mockito.ArgumentMatchers.eq(Integer.class),any(Object[].class))).thenReturn(1);

        service.assignActorAuthorized(Map.of(
                "accountId","data-owner","tenantId","TENANT_A","projectId","*","actorCode","SITE_DATA_OWNER"),
                "company-manager","TENANT_A","ROLE_USER",false);

        verify(jdbc).update(argThat(sql -> sql.contains("insert into framework_account_actor_assignment")),any(Object[].class));
    }

    @Test
    void sameTenantCompanyManagerRetainsAValidProjectSpecificAssignmentPath() {
        when(jdbc.queryForObject(argThat(sql -> sql.contains("from emission_project_registry")&&sql.contains("project_id=?")&&sql.contains("tenant_id=?")),
                org.mockito.ArgumentMatchers.eq(Integer.class),any(Object[].class))).thenReturn(1);
        when(jdbc.queryForObject(argThat(sql -> sql.contains("from comtnemplyrinfo")&&sql.contains("comtnentrprsmber")),
                org.mockito.ArgumentMatchers.eq(Integer.class),any(Object[].class))).thenReturn(1);

        service.assignActorAuthorized(Map.of(
                "accountId","data-owner","tenantId","TENANT_A","projectId","PROJECT_A","actorCode","SITE_DATA_OWNER"),
                "company-manager","TENANT_A","ROLE_ADMIN",false);

        verify(jdbc).update(argThat(sql -> sql.contains("insert into framework_project_actor_assignment")),any(Object[].class));
        verify(jdbc).update(argThat(sql -> sql.contains("update emission_project_task set assignee_id")),any(Object[].class));
    }

    @Test
    void platformAdministratorRetainsTheControlPlaneAssignmentPath() {
        service.assignActorAuthorized(Map.of(
                "accountId","bootstrap-user","tenantId","TENANT_A","projectId","*","actorCode","SITE_DATA_OWNER"),
                "platform-admin","DEFAULT","ROLE_SYSTEM_MASTER",true);

        verify(jdbc).update(argThat(sql -> sql.contains("insert into framework_account_actor_assignment")),any(Object[].class));
        verify(jdbc,never()).queryForObject(anyString(),org.mockito.ArgumentMatchers.eq(Integer.class),any(Object[].class));
    }
}
