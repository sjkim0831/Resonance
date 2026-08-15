package egovframework.com.platform.governance.service;

import egovframework.com.platform.codex.service.CodexProvisioningService;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.mockito.ArgumentCaptor;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ActorProcessGovernanceServiceSecurityTest {
    private final JdbcTemplate jdbc = mock(JdbcTemplate.class);
    private final ScreenContractRuntimeService runtimeService = mock(ScreenContractRuntimeService.class);
    private final ActorProcessGovernanceService service = spy(new ActorProcessGovernanceService(
            jdbc, mock(ScreenDevelopmentNoteService.class), mock(CodexProvisioningService.class), runtimeService));

    ActorProcessGovernanceServiceSecurityTest() {
        when(jdbc.queryForObject(argThat(sql -> sql != null
                        && sql.contains("framework_authorize_step_permissions")),
                eq(Boolean.class), any(Object[].class))).thenReturn(true);
    }

    @Test
    void persistedDesignCompleteStatusCanBeSavedAgain() {
        assertTrue(ActorProcessGovernanceService.isSupportedProfessionalContractStatus("DESIGN_COMPLETE"));
        assertFalse(ActorProcessGovernanceService.isSupportedProfessionalContractStatus("IMPLEMENTED"));
    }

    @Test
    void professionalScreenContractPreviewPredictsWithoutCanonicalSaveOrMutationSql() {
        Map<String,Object> body=new LinkedHashMap<>();
        body.put("contractId","26");
        body.put("businessPurpose","A complete professional business purpose for preview validation.");
        body.put("entryCondition","A valid assigned actor and target exist.");
        body.put("exitCondition","The completed result and immutable audit evidence are available.");
        body.put("kpiContract","[\"completionRate\"]");
        body.put("sectionContract","[\"SUMMARY\"]");
        body.put("fieldContract","[\"version\"]");
        body.put("commandContract","[\"SAVE\"]");
        body.put("stateContract","[\"LOADING\",\"EMPTY\",\"ERROR\",\"FORBIDDEN\",\"READY\"]");
        body.put("apiContract","[\"POST /preview\"]");
        body.put("dataContract","[\"version\"]");
        body.put("evidenceContract","[\"versionAudit\"]");
        body.put("apiVerified",true);body.put("databaseVerified",true);body.put("authorityVerified",true);
        body.put("responsiveVerified",true);body.put("accessibilityVerified",true);body.put("exceptionStatesVerified",true);
        body.put("auditEvidenceRef","qa-run:sha256:0123456789abcdef");
        body.put("contractStatus","DESIGN_COMPLETE");
        when(jdbc.queryForList(argThat(sql->sql!=null&&sql.contains("select menu_verified")),any(Object[].class)))
                .thenReturn(List.of(Map.of("menuVerified",true)));
        when(jdbc.queryForMap(argThat(sql->sql!=null&&sql.contains("framework_page_design_assurance g")
                        &&sql.contains("bindingCount")),any(Object[].class)))
                .thenReturn(Map.of("routePath","/preview","actorPassed",true,"processPassed",true,
                        "lineagePassed",true,"transitionPassed",true,"adminCounterpartPassed",true,
                        "testPassed",true,"bindingCount",1));
        when(jdbc.queryForList(argThat(sql->sql!=null&&sql.contains("business_purpose as \"businessPurpose\"")
                        &&sql.contains("order by contract_id")),any(Object[].class)))
                .thenReturn(List.of(Map.of("contractId",26L)));
        when(runtimeService.predictProfessionalContract(eq(26L),argThat(values->"VERIFIED".equals(values.get("contractStatus"))
                        &&!values.containsKey("contractId")&&!values.containsKey("kpiContract"))))
                .thenReturn(Map.of("contractId",26L,"predicted",true,"published",false,"wouldPublish",true,
                        "applied",false,"reason","DESIGN_CHANGED","contractHash","ae5c83c034aab359960c3558d4b0406b"));
        when(jdbc.queryForObject(argThat(sql->sql!=null&&sql.contains("select process_code from framework_professional_screen_contract")),
                eq(String.class),any(Object[].class))).thenReturn("DISCLOSURE_CORRECTION");

        Map<String,Object> preview=service.saveProfessionalScreenContractPreview(body,"system-admin");

        verify(service,never()).saveProfessionalScreenContract(any(),anyString());
        verify(runtimeService).predictProfessionalContract(eq(26L),argThat(values->"VERIFIED".equals(values.get("contractStatus"))
                &&!values.containsKey("contractId")&&!values.containsKey("kpiContract")));
        verify(runtimeService,never()).publishProfessionalContract(anyLong(),anyString());
        verify(jdbc,never()).update(anyString(),any(Object[].class));
        assertEquals(true,preview.get("success"));
        assertEquals(true,preview.get("preview"));
        assertEquals(true,preview.get("rolledBack"));
        assertEquals(false,preview.get("committed"));
        assertEquals("READ_ONLY_PREDICTION",preview.get("mutationScope"));
        assertEquals("NO_MUTATION_REQUIRED",preview.get("rollbackMode"));
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
        @SuppressWarnings("unchecked") Map<String,Object> orderContract=(Map<String,Object>)report.get("orderContract");

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
        assertTrue(sqlCaptor.getValue().contains("evidence.audit_batch_id is null")
                        && sqlCaptor.getValue().contains("framework_screen_workflow_audit_incident_run incident_run")
                        && sqlCaptor.getValue().contains("audit_batch.batch_status='COMPLETE'"),
                "latest evidence must independently index legacy rows, exclude FAILED_UNBOUND rows, and expose only COMPLETE batches");
        assertFalse(sqlCaptor.getValue().contains("framework_current_screen_workflow_test_run evidence"),
                "the UNION current view must not prevent target predicates and order/limit from reaching the evidence index");
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
        assertTrue(sqlCaptor.getValue().contains("evidence.evidence_json ?? 'contractFingerprint'"),
                "PGJDBC JSON existence operators must be escaped as ?? so the ten report bind parameters stay aligned");
        assertTrue(sqlCaptor.getValue().contains("framework_business_process_sequence")
                        && sqlCaptor.getValue().contains("p.workflow_order,p.process_code,p.step_order"),
                "actual-use rows must follow the business workflow sequence instead of development priority");
        assertTrue(sqlCaptor.getValue().contains("p.domain_code,p.domain_name,p.domain_order,p.process_code,p.process_name")
                        &&sqlCaptor.getValue().contains("p.workflow_order,p.workflow_phase,p.process_role,p.process_version"),
                "whole-step human review fingerprints must become stale when canonical work/process ordering metadata changes");
        assertTrue(sqlCaptor.getValue().contains("capability_scope_fingerprints")
                        &&sqlCaptor.getValue().contains("string_agg(contract_fingerprint,'|' order by audience)"),
                "capability review freshness must aggregate every active audience instead of accepting any one audience");
        assertTrue(sqlCaptor.getValue().contains("'BUSINESS_E2E'")
                        && sqlCaptor.getValue().contains("'CONTRACT_SIMULATION'")
                        && sqlCaptor.getValue().contains("'HUMAN_REVIEW_ONLY'"),
                "evidence and human review tiers must be explicit and non-interchangeable");

        assertEquals("CONTRACT_ONLY", report.get("auditMode"));
        assertEquals(false, report.get("businessFunctionsExecuted"));
        assertEquals(5, summary.get("fixtureSuiteRequiredTypeCount"));
        assertEquals(0, summary.get("fixtureSuiteBindingCount"));
        assertEquals("INVENTORY_AND_SIMULATION_EVIDENCE_ONLY", summary.get("fixtureSuiteMode"));
        assertEquals("NO_CURRENT_VERSION_EVIDENCE", summary.get("businessEvidenceStatus"));
        assertEquals("ACTIVE_BINDING_CAPABILITY", summary.get("auditTargetMode"));
        assertEquals(List.of("domainOrder","workflowOrder","processCode","stepOrder","stepCode"),orderContract.get("fields"));
    }

    @Test
    void nextDestinationInventoryKeepsEdgeAndTargetActorsAndDualRoutesDistinct() {
        when(jdbc.queryForList(argThat(sql -> sql.contains("as \"nextDestinationsJson\"")
                        &&sql.contains("'routeResolution'")),any(Object[].class))).thenReturn(List.of());

        service.systemProcessTestReport("","","",true,0,50);

        ArgumentCaptor<String> sqlCaptor=ArgumentCaptor.forClass(String.class);
        verify(jdbc).queryForList(sqlCaptor.capture(),any(Object[].class));
        String sql=sqlCaptor.getValue();
        assertTrue(sql.contains("'edgeActorCode',edge.actor_code")&&sql.contains("'targetActorCode',target.actor_code"));
        assertTrue(sql.contains("'userRoutePath',coalesce(target.user_path,'')")
                &&sql.contains("'adminRoutePath',coalesce(target.admin_path,'')"));
        assertTrue(sql.contains("'MULTIPLE_CANDIDATES'")&&sql.contains("'MISSING'")&&sql.contains("'SINGLE'"));
        assertTrue(sql.contains("'screenRouteInventory'")&&sql.contains("binding.binding_status='ACTIVE'"));
        assertFalse(sql.contains("'actorCode',edge.actor_code"),"an edge actor must never be presented as the target actor");
    }

    @Test
    void secondaryAudienceContractMutationInvalidatesTheAggregateCapabilityReviewFingerprint() {
        String original=ActorProcessGovernanceService.aggregateReviewFingerprints(
                List.of("USER-CONTRACT-V1","ADMIN-CONTRACT-V1"));
        String secondaryChanged=ActorProcessGovernanceService.aggregateReviewFingerprints(
                List.of("USER-CONTRACT-V1","ADMIN-CONTRACT-V2"));

        assertFalse(original.equals(secondaryChanged),
                "a secondary audience mutation must stale the prior capability review and its idempotency contract");
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
        assertEquals(false,compacted.get("reviewCriticalFieldsComplete"));
        assertEquals(false,compacted.get("reviewAllowed"));
        for(String field:List.of("latestInput","latestOutput","evidenceJson","simulationEvidenceJson","fixtureSuiteCasesJson","businessEvidenceJson")){
            String value=String.valueOf(compacted.get(field));
            assertTrue(value.contains("\"compact\":true"),field+" must remain present as compact evidence metadata");
            assertTrue(value.contains("\"sha256\":"),field+" must retain an integrity digest");
            assertTrue(value.length()<512,field+" must not retain the oversized payload");
        }
        assertTrue(serialized.length<8_000,"compact evidence must have a bounded response size");
    }

    @Test
    void systemReportRecursivelyRedactsSecretsWithoutRemovingStructuralKeys() {
        String evidence="""
            {"processCode":"MEMBER_REGISTRATION","password":"plain-secret",
             "nested":{"accessToken":"access-secret","refresh_token":"refresh-secret","otp":"123456",
                       "verificationCode":"code-secret","apiKey":"api-key-secret",
                       "private_key":"private-key-secret","safeCode":"MEMBER_S1"},
             "items":[{"authorization":"Bearer secret","cookie":"session-secret","amount":42,
                       "deep":{"credential":"credential-secret","sessionId":"session-id-secret",
                                  "csrf_token":"csrf-secret","jwt":"jwt-secret"}}]}
            """;
        Map<String,Object> source=new java.util.LinkedHashMap<>();
        source.put("actualInput",evidence);source.put("actualOutput",evidence);
        source.put("businessEvidenceJson",evidence);source.put("screenFunctionInventoryJson",evidence);
        source.put("reviewScopesJson",evidence);source.put("processCode","MEMBER_REGISTRATION");

        Map<String,Object> redacted=ActorProcessGovernanceService.redactSystemTestItem(source);
        String serialized=String.valueOf(redacted);

        assertEquals("MEMBER_REGISTRATION",redacted.get("processCode"));
        assertTrue(serialized.contains("processCode")&&serialized.contains("safeCode")&&serialized.contains("MEMBER_S1"));
        assertTrue(serialized.contains("password")&&serialized.contains("accessToken")&&serialized.contains("refresh_token"));
        assertTrue(serialized.contains("apiKey")&&serialized.contains("private_key")
                &&serialized.contains("credential")&&serialized.contains("sessionId")
                &&serialized.contains("csrf_token")&&serialized.contains("jwt"));
        assertFalse(serialized.contains("plain-secret")||serialized.contains("access-secret")
                ||serialized.contains("refresh-secret")||serialized.contains("123456")
                ||serialized.contains("code-secret")||serialized.contains("Bearer secret")||serialized.contains("session-secret")
                ||serialized.contains("api-key-secret")||serialized.contains("private-key-secret")
                ||serialized.contains("credential-secret")||serialized.contains("session-id-secret")
                ||serialized.contains("csrf-secret")||serialized.contains("jwt-secret"));
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
                        && sql.contains("test.capability_code in(target.capability_code,'ALL')")),
                any(Object[].class))).thenReturn(List.of());

        Map<String,Object> result=service.auditSystemProcessContracts(Map.of(),"system-auditor");

        assertEquals(250,result.get("maxTargets"));
        assertEquals(0,result.get("targetOffset"));
        assertEquals(false,result.get("hasMore"));
        assertEquals("CONTRACT_ONLY",result.get("auditMode"));
        assertEquals("ACTIVE_BINDING_CAPABILITY",result.get("auditTargetMode"));
        assertEquals(false,result.get("businessFunctionsExecuted"));
        assertEquals(0L,result.get("totalEligibleTargetCount"));
        assertEquals("COMPLETE",result.get("targetCoverageState"));
        ArgumentCaptor<String> sqlCaptor=ArgumentCaptor.forClass(String.class);
        verify(jdbc).queryForList(sqlCaptor.capture(),any(Object[].class));
        assertTrue(sqlCaptor.getValue().contains("left join framework_process_step_screen_binding b")
                &&sqlCaptor.getValue().contains("b.binding_status='ACTIVE'")
                &&sqlCaptor.getValue().contains("count(*) over() total_eligible_target_count")
                &&sqlCaptor.getValue().contains("order by development_order,process_code,step_order,step_code"));
        assertTrue(sqlCaptor.getValue().contains("from framework_page_development_item master"),
                "audit paging must not expand the expensive all-screen development master view for every target");
        assertFalse(sqlCaptor.getValue().contains("b.binding_status='DRAFT'"),"draft bindings are not executable audit targets");
        assertFalse(sqlCaptor.getValue().contains("select candidate.*"),"audit inventory must not collapse bindings through limit 1");
        verify(jdbc,never()).queryForList(argThat(sql -> sql.startsWith("select test_case_id")),any(Object[].class));
    }

    @Test
    void hourlyBatchRejectsScopedAndReducedCatalogRequests() {
        String batchId="11111111-1111-4111-8111-111111111111";
        when(jdbc.queryForList(argThat(sql -> sql!=null&&sql.contains("from framework_screen_workflow_audit_batch where audit_batch_id")),
                any(Object[].class))).thenReturn(List.of(Map.of(
                        "auditBatchId",batchId,"batchStatus","RUNNING","requestedBy","system-auditor")));

        assertThrows(IllegalArgumentException.class, () -> service.auditSystemProcessContracts(
                Map.of("auditBatchId",batchId,"processCode","MEMBER_REGISTRATION"),"system-auditor"));
        assertThrows(IllegalArgumentException.class, () -> service.auditSystemProcessContracts(
                Map.of("auditBatchId",batchId,"maxSteps",1),"system-auditor"));

        verify(jdbc,never()).queryForList(argThat(sql -> sql!=null&&sql.contains(
                "framework_screen_workflow_audit_batch_target target")),any(Object[].class));
    }

    @Test
    void hourlyBatchPagesOnlyTheAttemptFixedTargetSnapshot() throws Exception {
        String batchId="22222222-2222-4222-8222-222222222222";
        Map<String,Object> batch=Map.ofEntries(
                Map.entry("auditBatchId",batchId),Map.entry("sourceCommit","a".repeat(40)),
                Map.entry("runtimeIdentityHash","b".repeat(64)),Map.entry("catalogFingerprint","c".repeat(64)),
                Map.entry("targetInventoryFingerprint","d".repeat(64)),Map.entry("expectedPageCount",1),
                Map.entry("expectedTargetCount",1L),Map.entry("pageSize",250),
                Map.entry("batchStatus","RUNNING"),Map.entry("requestedBy","system-auditor"));
        String targetMaterial=String.join("\u001f","201","PROCESS_A","STEP_A","101","USER","/screen-a","SAVE");
        String targetKey=java.util.HexFormat.of().formatHex(java.security.MessageDigest.getInstance("SHA-256")
                .digest(targetMaterial.getBytes(java.nio.charset.StandardCharsets.UTF_8)));
        Map<String,Object> target=new java.util.LinkedHashMap<>();
        target.put("bindingId",101L);target.put("audience","USER");target.put("bindingStatus","ACTIVE");
        target.put("screenResourceId",201L);target.put("routePath","/screen-a");target.put("screenName","Screen A");
        target.put("implementationStatus","VERIFIED");target.put("processCode","PROCESS_A");target.put("stepCode","STEP_A");
        target.put("capabilityCode","SAVE");target.put("totalEligibleTargetCount",1L);
        target.put("auditTargetOrdinal",0L);target.put("auditTargetKey",targetKey);
        when(jdbc.queryForList(argThat(sql -> sql!=null&&sql.contains("from framework_screen_workflow_audit_batch where audit_batch_id")),
                any(Object[].class))).thenReturn(List.of(batch));
        when(jdbc.queryForList(argThat(sql -> sql!=null&&sql.contains("from framework_screen_workflow_audit_batch_target target")),
                any(Object[].class))).thenReturn(List.of(target));
        when(jdbc.queryForObject(argThat(sql -> sql!=null&&sql.contains("framework_record_screen_workflow_audit_page")),
                org.mockito.ArgumentMatchers.eq(String.class),any(Object[].class)))
                .thenReturn("{\"pageFingerprint\":\""+"e".repeat(64)+"\"}");

        Map<String,Object> result=service.auditSystemProcessContracts(
                Map.of("auditBatchId",batchId,"maxTargets",250,"targetOffset",0),"system-auditor");

        assertEquals(1L,result.get("totalEligibleTargetCount"));
        assertEquals(0,result.get("auditPageNumber"));
        assertEquals("ERROR",result.get("outcome"));
        ArgumentCaptor<String> sqlCaptor=ArgumentCaptor.forClass(String.class);
        verify(jdbc,org.mockito.Mockito.atLeastOnce()).queryForList(sqlCaptor.capture(),any(Object[].class));
        String snapshotSql=sqlCaptor.getAllValues().stream()
                .filter(sql -> sql.contains("framework_screen_workflow_audit_batch_target target"))
                .findFirst().orElseThrow();
        assertTrue(snapshotSql.contains("target.target_ordinal>=?")
                        &&snapshotSql.contains("order by target.target_ordinal limit ?"));
        assertFalse(snapshotSql.contains("with scoped_steps as materialized"),
                "a RUNNING attempt must never reselect a mutable same-count target inventory");
    }

    @Test
    void rowContractAuditScopesTheRequestedStep() {
        when(jdbc.queryForList(argThat(sql -> sql.contains("(?='' or s.step_code=?)")
                        && sql.contains("limit ? offset ?")),any(Object[].class))).thenReturn(List.of());

        Map<String,Object> result=service.auditSystemProcessContracts(Map.of(
                "processCode","EMISSION_PROJECT","stepCode","EMISSION_PROJECT_COLLECT"),"reviewer");

        @SuppressWarnings("unchecked") Map<String,Object> filters=(Map<String,Object>)result.get("filters");
        assertEquals("EMISSION_PROJECT_COLLECT",filters.get("stepCode"));
        assertEquals(false,result.get("businessFunctionsExecuted"));
    }

    @Test
    void changeRequestRequiresANoteBeforeAnyDatabaseMutation() {
        IllegalArgumentException failure=assertThrows(IllegalArgumentException.class,()->service.saveSystemUsageReview(Map.of(
                "processCode","EMISSION_PROJECT","stepCode","EMISSION_PROJECT_COLLECT",
                "reviewStatus","CHANGE_REQUESTED","reviewNote","  "),"reviewer"));

        assertTrue(failure.getMessage().contains("reviewNote"));
        verify(jdbc,never()).queryForObject(argThat(sql -> sql.contains("framework_system_usage_review")),
                org.mockito.ArgumentMatchers.eq(Long.class),any(Object[].class));
    }

    @Test
    void humanApprovalIsPersistedWithoutChangingRuntimeEvidence() {
        stubStepReviewContract("0123456789abcdef0123456789abcdef01234567","fingerprint-1");
        when(jdbc.queryForList(argThat(sql -> sql!=null&&sql.contains("where idempotency_key=?")),any(Object[].class))).thenReturn(List.of());
        when(jdbc.queryForObject(argThat(sql -> sql.contains("insert into framework_system_usage_review")),
                org.mockito.ArgumentMatchers.eq(Long.class),any(Object[].class))).thenReturn(91L);

        Map<String,Object> result=service.saveSystemUsageReview(Map.of(
                "processCode","EMISSION_PROJECT","stepCode","EMISSION_PROJECT_COLLECT",
                "reviewStatus","APPROVED","reviewNote","화면과 기능 확인"),"reviewer");

        @SuppressWarnings("unchecked") Map<String,Object> review=(Map<String,Object>)result.get("review");
        assertEquals(91L,review.get("reviewId"));
        assertEquals("HUMAN_REVIEW_ONLY",review.get("reviewEvidenceScope"));
        assertEquals("0123456789abcdef0123456789abcdef01234567",review.get("reviewSourceCommit"));
        verify(jdbc,never()).update(argThat(sql -> sql.contains("framework_process_qa_run")
                ||sql.contains("framework_screen_workflow_test_run")),any(Object[].class));
    }

    @Test
    void repeatedHumanReviewReturnsTheExistingDecisionWithoutCreatingAJob() {
        String commit="0123456789abcdef0123456789abcdef01234567";
        stubStepReviewContract(commit,"fingerprint-1");
        when(jdbc.queryForList(argThat(sql -> sql!=null&&sql.contains("where idempotency_key=?")),any(Object[].class)))
                .thenReturn(List.of(Map.ofEntries(Map.entry("reviewId",91L),Map.entry("processCode","EMISSION_PROJECT"),
                        Map.entry("stepCode","EMISSION_PROJECT_COLLECT"),Map.entry("reviewStatus","CHANGE_REQUESTED"),
                        Map.entry("reviewNote","수정"),Map.entry("processVersion","2.1.0"),Map.entry("capabilityCode","ALL"),
                        Map.entry("contractFingerprint","fingerprint-1"),Map.entry("reviewSourceCommit",commit),
                        Map.entry("linkedJobId",71L),Map.entry("reviewedBy","reviewer"))));

        Map<String,Object> result=service.saveSystemUsageReview(Map.of(
                "processCode","EMISSION_PROJECT","stepCode","EMISSION_PROJECT_COLLECT",
                "reviewStatus","CHANGE_REQUESTED","reviewNote","수정","idempotencyKey","retry-key"),"reviewer");

        @SuppressWarnings("unchecked") Map<String,Object> review=(Map<String,Object>)result.get("review");
        assertEquals(true,review.get("idempotent"));
        assertEquals(71L,review.get("linkedJobId"));
        assertEquals("reviewer",review.get("reviewedBy"));
        assertThrows(IllegalArgumentException.class,()->service.saveSystemUsageReview(Map.of(
                "processCode","EMISSION_PROJECT","stepCode","EMISSION_PROJECT_COLLECT",
                "reviewStatus","CHANGE_REQUESTED","reviewNote","수정","idempotencyKey","retry-key"),"second-reviewer"));
        verify(jdbc,never()).queryForObject(argThat(sql -> sql.contains("insert into framework_system_usage_review")),
                org.mockito.ArgumentMatchers.eq(Long.class),any(Object[].class));
        verify(jdbc,never()).queryForObject(argThat(sql -> sql.contains("insert into framework_development_job")),
                org.mockito.ArgumentMatchers.eq(Long.class),any(Object[].class));
    }

    @Test
    void changeRequestCreatesOnlyAManuallyApprovedPlannedDesignReviewJob() {
        String commit="0123456789abcdef0123456789abcdef01234567";
        stubStepReviewContract(commit,"fingerprint-1");
        when(jdbc.queryForList(argThat(sql -> sql!=null&&sql.contains("where idempotency_key=?")),any(Object[].class))).thenReturn(List.of());
        when(jdbc.queryForObject(argThat(sql -> sql!=null&&sql.contains("insert into framework_system_usage_review")),
                org.mockito.ArgumentMatchers.eq(Long.class),any(Object[].class))).thenReturn(92L);
        when(jdbc.queryForObject(argThat(sql -> sql!=null&&sql.contains("insert into framework_development_job")),
                org.mockito.ArgumentMatchers.eq(Long.class),any(Object[].class))).thenReturn(72L);

        Map<String,Object> result=service.saveSystemUsageReview(Map.of(
                "processCode","EMISSION_PROJECT","stepCode","EMISSION_PROJECT_COLLECT",
                "reviewStatus","CHANGE_REQUESTED","reviewNote","Clarify the submit action",
                "idempotencyKey","change-request-92"),"reviewer");

        @SuppressWarnings("unchecked") Map<String,Object> review=(Map<String,Object>)result.get("review");
        assertEquals(72L,review.get("linkedJobId"));
        assertEquals("DEVELOPMENT_REVIEW_PENDING",review.get("nextAction"));
        verify(jdbc).queryForObject(argThat(sql -> sql.contains("'DESIGN_REVIEW'")
                        &&sql.contains("'PLANNED','PENDING'")&&sql.contains("returning job_id")),
                org.mockito.ArgumentMatchers.eq(Long.class),any(Object[].class));
        verify(jdbc,never()).update(argThat(sql -> sql.contains("approval_status='APPROVED'")
                ||sql.contains("framework_process_qa_run")||sql.contains("framework_screen_workflow_test_run")),any(Object[].class));
    }

    @Test
    void capabilityReviewRequiresAnActivelyBoundScreen() {
        IllegalArgumentException failure=assertThrows(IllegalArgumentException.class,()->service.saveSystemUsageReview(Map.of(
                "processCode","EMISSION_PROJECT","stepCode","EMISSION_PROJECT_COLLECT",
                "capabilityCode","SAVE","reviewStatus","APPROVED"),"reviewer"));

        assertTrue(failure.getMessage().contains("screenResourceId"));
        verify(jdbc,never()).queryForList(argThat(sql -> sql!=null&&sql.contains("framework_current_process_step_contract_fingerprint")),
                any(Object[].class));
    }

    @Test
    void bulkContractAuditPreservesOneErrorTargetWhenNoActiveBindingExists() {
        Map<String,Object> target=new java.util.LinkedHashMap<>();
        target.put("processCode","COMPANY_REAPPLICATION_PUBLIC");
        target.put("stepCode","COMPANY_REAPPLICATION_PUBLIC_RESUBMIT");target.put("capabilityCode","ALL");
        target.put("totalEligibleTargetCount",1L);
        when(jdbc.queryForList(argThat(sql -> sql.contains("with scoped_steps as materialized")),any(Object[].class)))
                .thenReturn(List.of(target));

        Map<String,Object> result=service.auditSystemProcessContracts(Map.of(),"system-auditor");

        assertEquals("ERROR",result.get("outcome"));
        assertEquals(1,result.get("errorCount"));
        assertEquals(0,result.get("blockedCount"));
        assertEquals("COMPLETE",result.get("targetCoverageState"));
        @SuppressWarnings("unchecked") List<Map<String,Object>> runs=(List<Map<String,Object>>)result.get("runs");
        assertEquals("ACTIVE_SCREEN_BINDING_NOT_FOUND",runs.get(0).get("message"));
    }

    @Test
    void bulkContractAuditPreservesEveryEligibleBindingAndReportsCompleteCoverage() {
        Map<String,Object> first=new java.util.LinkedHashMap<>();
        first.put("bindingId",101L);first.put("audience","USER");
        first.put("bindingStatus","ACTIVE");first.put("screenResourceId",201L);
        first.put("processCode","MULTI_BINDING_PROCESS");first.put("stepCode","STEP_1");
        first.put("capabilityCode","SAVE");first.put("totalEligibleTargetCount",2L);
        Map<String,Object> second=new java.util.LinkedHashMap<>(first);
        second.put("bindingId",102L);second.put("audience","ADMIN");
        second.put("screenResourceId",202L);second.put("capabilityCode","APPROVE");
        when(jdbc.queryForList(argThat(sql -> sql.contains("count(*) over() total_eligible_target_count")),any(Object[].class)))
                .thenReturn(List.of(first,second));

        Map<String,Object> result=service.auditSystemProcessContracts(
                Map.of("processCode","MULTI_BINDING_PROCESS","stepCode","STEP_1"),"system-auditor");

        assertEquals(2,result.get("targetCount"));
        assertEquals(2,result.get("auditedBindingCount"));
        assertEquals(2L,result.get("auditedCapabilityTargetCount"));
        assertEquals(2L,result.get("totalEligibleTargetCount"));
        assertEquals(2L,result.get("coveredTargetCount"));
        assertEquals("COMPLETE",result.get("targetCoverageState"));
        assertEquals(false,result.get("hasMore"));
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
    void controlPlaneValidationDoesNotAllocateAnEventIdOrExecuteDml() {
        UUID executionId=UUID.randomUUID();
        java.util.concurrent.atomic.AtomicLong eventSequence=new java.util.concurrent.atomic.AtomicLong(41);
        when(jdbc.queryForList(anyString(),any(Object[].class))).thenAnswer(invocation -> {
            String sql=invocation.getArgument(0);
            if(sql.contains("from framework_process_execution e")){
                return List.of(Map.of(
                        "tenantId","TENANT_A","projectId","PROJECT_A",
                        "processCode","PROCESS_A","stepCode","STEP_1",
                        "executionStatus","RUNNING","actorCode","COMPANY_MANAGER",
                        "commandCode","RUN"));
            }
            if(sql.contains("from framework_account_actor_assignment")){
                return List.of(Map.of("accountId","manager-a"));
            }
            if(sql.contains("from framework_process_execution where execution_id=? for update")){
                return List.of(Map.of(
                        "tenant_id","TENANT_A","project_id","PROJECT_A",
                        "process_code","PROCESS_A","current_step_code","STEP_1",
                        "current_state","READY","execution_status","RUNNING"));
            }
            if(sql.contains("from framework_process_step where process_code=? and step_code=?")){
                return List.of(Map.of(
                        "step_order",1,"actor_code","COMPANY_MANAGER",
                        "command_code","RUN","from_state","READY","to_state","DONE"));
            }
            return List.of();
        });
        when(jdbc.queryForObject(argThat(sql -> sql != null && sql.contains("ROLE_SYSTEM_MASTER")),
                org.mockito.ArgumentMatchers.eq(Integer.class),any(Object[].class))).thenReturn(0);
        when(jdbc.queryForObject(argThat(sql -> sql != null && sql.contains("select count(*) from framework_account_actor_assignment")),
                org.mockito.ArgumentMatchers.eq(Integer.class),any(Object[].class))).thenReturn(1);
        when(jdbc.queryForObject(argThat(sql -> sql != null && sql.contains("insert into framework_process_execution_event")),
                org.mockito.ArgumentMatchers.eq(Long.class),any(Object[].class)))
                .thenAnswer(invocation -> eventSequence.incrementAndGet());

        long sequenceBefore=eventSequence.get();
        Map<String,Object> reviewerValidation=service.validateProcessCommandFromControlPlane(
                executionId,Map.of("requestingAccount","manager-a","requireDraft",false),
                "REVIEWER");
        Map<String,Object> approverValidation=service.validateProcessCommandFromControlPlane(
                executionId,Map.of("requestingAccount","manager-a","requireDraft",false),
                "APPROVER");

        for(Map<String,Object> validation:List.of(reviewerValidation,approverValidation)){
            assertEquals(true,validation.get("success"));
            assertEquals(true,validation.get("validated"));
            assertEquals(false,validation.get("committed"));
            assertEquals("READ_ONLY_VALIDATION",validation.get("mutationScope"));
            assertEquals(0,validation.get("databaseCurrentWrites"));
            assertEquals("COMPLETED",validation.get("executionStatus"));
            assertEquals(true,validation.get("relayCompleted"));
        }
        assertEquals(sequenceBefore,eventSequence.get(),"two allowed validations must not allocate event ids");
        verify(jdbc,never()).queryForObject(argThat(sql -> sql != null && sql.contains(
                "insert into framework_process_execution_event")),
                org.mockito.ArgumentMatchers.eq(Long.class),any(Object[].class));
        verify(jdbc,never()).update(anyString(),any(Object[].class));
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
    void workerHeartbeatRequiresTheMatchingLeaseTokenAndWorkerIdentity() {
        when(jdbc.update(argThat(sql -> sql.contains("lease_token=?") && sql.contains("worker_id=?")),
                any(Object[].class))).thenReturn(0);

        assertThrows(IllegalArgumentException.class,
                () -> service.heartbeatDevelopmentJob(17L,"wrong-lease","worker-a"));
    }

    @Test
    void workerHeartbeatRenewsOnlyAnUnexpiredLease() {
        when(jdbc.update(argThat(sql -> sql.contains("lease_until is not null")
                        && sql.contains("lease_until>current_timestamp")
                        && sql.contains("lease_token=?") && sql.contains("worker_id=?")),
                any(Object[].class))).thenReturn(1);

        Map<String,Object> result=service.heartbeatDevelopmentJob(17L,"current-lease","worker-a");

        assertEquals(true,result.get("success"));
        assertEquals(17L,result.get("jobId"));
    }

    @Test
    void workerCompletionRequiresTheMatchingRunningLeaseBeforeAnyMutation() {
        when(jdbc.queryForList(argThat(sql -> sql.contains("lease_token=?")
                        && sql.contains("worker_id=?") && sql.contains("job_status='RUNNING'")),
                any(Object[].class))).thenReturn(List.of());

        assertThrows(IllegalArgumentException.class, () -> service.completeDevelopmentJob(Map.of(
                "jobId",17L,"leaseToken","wrong-lease","result","VERIFIED"),"worker-a"));

        verify(jdbc,never()).update(argThat(sql -> sql.startsWith(
                "update framework_development_job set job_status=")),any(Object[].class));
    }

    @Test
    void workerCompletionQueryRequiresAnUnexpiredLease() {
        when(jdbc.queryForList(anyString(),any(Object[].class))).thenReturn(List.of());

        assertThrows(IllegalArgumentException.class, () -> service.completeDevelopmentJob(Map.of(
                "jobId",17L,"leaseToken","current-lease","result","VERIFIED"),"worker-a"));

        ArgumentCaptor<String> sql=ArgumentCaptor.forClass(String.class);
        verify(jdbc).queryForList(sql.capture(),any(Object[].class));
        assertTrue(sql.getValue().contains("lease_until is not null"));
        assertTrue(sql.getValue().contains("lease_until>current_timestamp"));
    }

    @Test
    void expiredLeaseIsReclaimedAtTheBoundaryWithANewToken() {
        when(jdbc.queryForList(anyString())).thenReturn(List.of(Map.of(
                "job_id",17L,"job_status","RUNNING","lease_token","expired-token")));

        Map<String,Object> result=service.claimDevelopmentJob("worker-a");

        ArgumentCaptor<String> sql=ArgumentCaptor.forClass(String.class);
        verify(jdbc).queryForList(sql.capture());
        assertTrue(sql.getValue().contains("j.lease_until is not null"));
        assertTrue(sql.getValue().contains("j.lease_until<=current_timestamp"));
        assertFalse("expired-token".equals(result.get("leaseToken")));
        UUID.fromString(String.valueOf(result.get("leaseToken")));
    }

    @Test
    void startPermissionDenialHappensBeforeExecutionMutation() {
        when(jdbc.queryForList(argThat(sql -> sql != null
                        && sql.contains("from framework_process_step where process_code=?")
                        && sql.contains("order by step_order limit 1")), any(Object[].class)))
                .thenReturn(List.of(Map.of(
                        "step_code", "STEP_1", "actor_code", "COMPANY_MANAGER", "from_state", "READY")));
        when(jdbc.queryForObject(argThat(sql -> sql != null
                        && sql.contains("framework_account_actor_assignment")),
                eq(Integer.class), any(Object[].class))).thenReturn(1);
        when(jdbc.queryForObject(argThat(sql -> sql != null
                        && sql.contains("framework_authorize_step_permissions")),
                eq(Boolean.class), any(Object[].class))).thenReturn(false);

        SecurityException denial=assertThrows(SecurityException.class,
                () -> service.startProcessExecution(Map.of(
                        "tenantId", "TENANT_A", "projectId", "PROJECT_A", "processCode", "PROCESS_A",
                        "actorCode", "COMPANY_MANAGER"), "user-a"));

        assertTrue(denial.getMessage().contains("STEP_PERMISSION_DENIED"));
        verify(jdbc, never()).update(argThat(sql -> sql != null
                && sql.startsWith("insert into framework_process_execution")), any(Object[].class));
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
    void unassignedActorCannotReadIdempotencyEvidence() {
        UUID executionId = UUID.randomUUID();
        when(jdbc.queryForList(argThat(sql -> sql != null
                        && sql.contains("from framework_process_execution where execution_id=? for update")),
                any(Object[].class))).thenReturn(List.of(Map.of(
                "execution_status", "COMPLETED", "tenant_id", "TENANT_A", "project_id", "PROJECT_A",
                "process_code", "PROCESS_A", "current_step_code", "FINAL_STEP")));
        when(jdbc.queryForObject(argThat(sql -> sql != null
                        && sql.contains("framework_account_actor_assignment")),
                eq(Integer.class), any(Object[].class))).thenReturn(0);

        assertThrows(SecurityException.class, () -> service.executeProcessCommand(executionId, Map.of(
                "tenantId", "TENANT_A", "projectId", "PROJECT_A", "processCode", "PROCESS_A",
                "stepCode", "STEP_1", "actorCode", "COMPANY_MANAGER", "commandCode", "RUN",
                "idempotencyKey", "unauthorized-replay"), "unassigned-user"));

        verify(jdbc, never()).queryForList(argThat(sql -> sql != null
                && sql.contains("framework_process_execution_event")
                && sql.contains("idempotency_key")), any(Object[].class));
    }

    @Test
    void commandPermissionDenialHappensBeforeReplayReadOrTransitionMutation() {
        UUID executionId = UUID.randomUUID();
        when(jdbc.queryForList(argThat(sql -> sql != null
                        && sql.contains("from framework_process_execution where execution_id=? for update")),
                any(Object[].class))).thenReturn(List.of(Map.of(
                "execution_status", "RUNNING", "tenant_id", "TENANT_A", "project_id", "PROJECT_A",
                "process_code", "PROCESS_A", "current_step_code", "STEP_1", "current_state", "READY")));
        when(jdbc.queryForObject(argThat(sql -> sql != null
                        && sql.contains("framework_account_actor_assignment")),
                eq(Integer.class), any(Object[].class))).thenReturn(1);
        when(jdbc.queryForObject(argThat(sql -> sql != null
                        && sql.contains("framework_authorize_step_permissions")),
                eq(Boolean.class), any(Object[].class))).thenReturn(false);

        SecurityException denial=assertThrows(SecurityException.class,
                () -> service.executeProcessCommand(executionId, Map.of(
                        "tenantId", "TENANT_A", "projectId", "PROJECT_A", "processCode", "PROCESS_A",
                        "stepCode", "STEP_1", "actorCode", "COMPANY_MANAGER", "commandCode", "RUN",
                        "idempotencyKey", "denied-key"), "user-a"));

        assertTrue(denial.getMessage().contains("STEP_PERMISSION_DENIED"));
        verify(jdbc, never()).queryForList(argThat(sql -> sql != null
                && sql.contains("framework_process_execution_event")
                && sql.contains("idempotency_key")), any(Object[].class));
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }

    @Test
    void freshProcessCommandCommitsExactlyOneTransition() {
        UUID executionId = UUID.randomUUID();
        when(jdbc.queryForList(anyString(), any(Object[].class))).thenAnswer(invocation -> {
            String sql = invocation.getArgument(0);
            if (sql.contains("from framework_process_execution where execution_id=? for update")) {
                return List.of(Map.of(
                        "execution_status", "RUNNING", "tenant_id", "TENANT_A", "project_id", "PROJECT_A",
                        "process_code", "PROCESS_A", "current_step_code", "STEP_1", "current_state", "READY"));
            }
            if (sql.contains("framework_process_execution_event") && sql.contains("idempotency_key")) {
                return List.of();
            }
            if (sql.contains("select step_order,actor_code,command_code,from_state,to_state")) {
                return List.of(Map.of("step_order", 1, "actor_code", "COMPANY_MANAGER",
                        "command_code", "RUN", "from_state", "READY", "to_state", "SUBMITTED"));
            }
            if (sql.contains("step_code<>?")) {
                return List.of(Map.of("step_code", "STEP_2", "actor_code", "REVIEWER",
                        "user_path", "/review", "admin_path", "/admin/review"));
            }
            return List.of();
        });
        when(jdbc.queryForObject(argThat(sql -> sql != null
                        && sql.contains("framework_account_actor_assignment")),
                eq(Integer.class), any(Object[].class))).thenReturn(1);
        when(jdbc.queryForObject(argThat(sql -> sql != null
                        && sql.startsWith("insert into framework_process_execution_event")),
                eq(Long.class), any(Object[].class))).thenReturn(77L);

        Map<String, Object> result = service.executeProcessCommand(executionId, Map.of(
                "tenantId", "TENANT_A", "projectId", "PROJECT_A", "processCode", "PROCESS_A",
                "stepCode", "STEP_1", "actorCode", "COMPANY_MANAGER", "commandCode", "RUN",
                "idempotencyKey", "fresh-key"), "user-a");

        assertFalse((Boolean) result.get("idempotent"));
        assertEquals(77L, result.get("eventId"));
        assertEquals("SUBMITTED", result.get("toState"));
        assertEquals("RUNNING", result.get("executionStatus"));
        verify(jdbc).queryForObject(argThat(sql -> sql != null
                        && sql.startsWith("insert into framework_process_execution_event")),
                eq(Long.class), any(Object[].class));
    }

    @Test
    void runningExecutionReplayReturnsTheFrozenFourKeyContract() {
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
        when(jdbc.queryForObject(argThat(sql -> sql != null
                        && sql.contains("framework_account_actor_assignment")),
                eq(Integer.class), any(Object[].class))).thenReturn(1);

        Map<String, Object> replay = service.executeProcessCommand(executionId, Map.of(
                "tenantId", "TENANT_A", "projectId", "PROJECT_A", "processCode", "PROCESS_A",
                "stepCode", "STEP_1", "actorCode", "COMPANY_MANAGER", "commandCode", "RUN",
                "idempotencyKey", "same-key"), "user-a");

        assertEquals(Set.of("success", "idempotent", "eventId", "toState"), replay.keySet());
        assertTrue((Boolean) replay.get("idempotent"));
        assertEquals(73L, replay.get("eventId"));
        assertEquals("SUBMITTED", replay.get("toState"));
    }

    @Test
    void completedExecutionReplayReturnsTheFrozenFourKeyContractBeforeLifecycleGates() {
        UUID executionId = UUID.randomUUID();
        when(jdbc.queryForList(anyString(), any(Object[].class))).thenAnswer(invocation -> {
            String sql = invocation.getArgument(0);
            if (sql.contains("from framework_process_execution where execution_id=? for update")) {
                return List.of(Map.of(
                        "execution_status", "COMPLETED", "tenant_id", "TENANT_A", "project_id", "PROJECT_A",
                        "process_code", "PROCESS_A", "current_step_code", "FINAL_STEP"));
            }
            if (sql.contains("framework_process_execution_event") && sql.contains("idempotency_key")) {
                return List.of(Map.of("eventId", 91L, "toState", "COMPLETED"));
            }
            return List.of();
        });
        when(jdbc.queryForObject(argThat(sql -> sql != null
                        && sql.contains("framework_account_actor_assignment")),
                eq(Integer.class), any(Object[].class))).thenReturn(1);

        Map<String, Object> replay = service.executeProcessCommand(executionId, Map.of(
                "tenantId", "TENANT_A", "projectId", "PROJECT_A", "processCode", "PROCESS_A",
                "stepCode", "STEP_1", "actorCode", "COMPANY_MANAGER", "commandCode", "RUN",
                "idempotencyKey", "completed-retry"), "user-a");

        assertEquals(Set.of("success", "idempotent", "eventId", "toState"), replay.keySet());
        assertTrue((Boolean) replay.get("idempotent"));
        assertEquals(91L, replay.get("eventId"));
        assertEquals("COMPLETED", replay.get("toState"));
        verify(jdbc, never()).queryForList(argThat(sql -> sql != null
                && sql.contains("from framework_process_step")), any(Object[].class));
        verify(jdbc, never()).update(anyString(), any(Object[].class));
    }

    @Test
    void designSaveWithoutExactCanonicalIdentityFailsBeforeWrite() {
        ScreenDevelopmentNoteService notes = mock(ScreenDevelopmentNoteService.class);
        ActorProcessGovernanceService isolated = new ActorProcessGovernanceService(
                jdbc, notes, mock(CodexProvisioningService.class), mock(ScreenContractRuntimeService.class));
        when(jdbc.queryForList(argThat(sql -> sql != null && sql.contains("for update of b,c")),
                any(Object[].class))).thenReturn(List.of());

        IllegalStateException error=assertThrows(IllegalStateException.class,()->isolated.saveDesignAndGenerate(Map.of(
                "routePath", "/emission/unbound",
                "designNote", "layout",
                "functionNote", "function",
                "acceptanceNote", "acceptance"), "designer"));

        assertTrue(error.getMessage().contains("CANONICAL_SCREEN_IDENTITY_NOT_EXACT"));
        verify(notes,never()).save(any(),anyString());
        verify(jdbc,never()).update(anyString(),any(Object[].class));
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
    void workDraftResponseExposesTheGeneratedEvidenceObjectCount() {
        when(jdbc.queryForList(argThat(sql -> sql != null && sql.contains("runtime_step.step_code as \"stepCode\"")),
                any(Object[].class))).thenReturn(List.of(Map.of("actorCode", "SITE_DATA_OWNER")));
        when(jdbc.queryForObject(argThat(sql -> sql != null && sql.contains("framework_account_actor_assignment")
                        && sql.contains("actor_code=?")), eq(Integer.class), any(Object[].class))).thenReturn(1);
        when(jdbc.queryForList(argThat(sql -> sql != null
                        && sql.contains("evidence_count as \"evidenceCount\"")
                        && sql.contains("from framework_process_work_draft")), any(Object[].class)))
                .thenReturn(List.of(Map.of(
                        "draftId", UUID.randomUUID(), "evidenceJson", "{\"documentId\":\"DOC-1\"}",
                        "evidenceCount", 1, "draftVersion", 3, "draftStatus", "DRAFT")));
        when(jdbc.queryForList(argThat(sql -> sql != null && sql.contains("with target as (")),
                any(Object[].class))).thenReturn(List.of());
        when(jdbc.queryForList(argThat(sql -> sql != null && sql.contains("as \"defaultPayloadJson\"")),
                any(Object[].class))).thenReturn(List.of());
        doReturn(Map.of("ready", true, "items", List.of())).when(service)
                .relayPrerequisiteReadiness("TENANT_A", "PROJECT_A", "EMISSION_PROJECT", "EMISSION_PROJECT_COLLECT");

        Map<String,Object> response=service.loadWorkDraft(
                "TENANT_A", "PROJECT_A", "EMISSION_PROJECT", "EMISSION_PROJECT_COLLECT", "user-a");

        Map<?,?> draft=(Map<?,?>)response.get("draft");
        assertEquals(1,draft.get("evidenceCount"));
        assertEquals("{\"documentId\":\"DOC-1\"}",draft.get("evidenceJson"));
        verify(jdbc).queryForList(argThat(sql -> sql != null
                && sql.contains("evidence_count as \"evidenceCount\"")), any(Object[].class));
    }

    @Test
    void workDraftResponseExposesZeroEvidenceCountWhenNoDraftExists() {
        when(jdbc.queryForList(argThat(sql -> sql != null && sql.contains("runtime_step.step_code as \"stepCode\"")),
                any(Object[].class))).thenReturn(List.of(Map.of("actorCode", "SITE_DATA_OWNER")));
        when(jdbc.queryForObject(argThat(sql -> sql != null && sql.contains("framework_account_actor_assignment")
                        && sql.contains("actor_code=?")), eq(Integer.class), any(Object[].class))).thenReturn(1);
        when(jdbc.queryForList(argThat(sql -> sql != null
                        && sql.contains("evidence_count as \"evidenceCount\"")
                        && sql.contains("from framework_process_work_draft")), any(Object[].class)))
                .thenReturn(List.of());
        when(jdbc.queryForList(argThat(sql -> sql != null && sql.contains("with target as (")),
                any(Object[].class))).thenReturn(List.of());
        when(jdbc.queryForList(argThat(sql -> sql != null && sql.contains("as \"defaultPayloadJson\"")),
                any(Object[].class))).thenReturn(List.of());
        doReturn(Map.of("ready", true, "items", List.of())).when(service)
                .relayPrerequisiteReadiness("TENANT_A", "PROJECT_A", "EMISSION_PROJECT", "EMISSION_PROJECT_COLLECT");

        Map<String,Object> response=service.loadWorkDraft(
                "TENANT_A", "PROJECT_A", "EMISSION_PROJECT", "EMISSION_PROJECT_COLLECT", "user-a");

        Map<?,?> draft=(Map<?,?>)response.get("draft");
        assertEquals(false,response.get("found"));
        assertEquals(0,draft.get("evidenceCount"));
        assertEquals("NOT_SAVED",draft.get("draftStatus"));
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
        when(jdbc.queryForObject(argThat(sql -> sql!=null&&sql.contains("actor_code='COMPANY_MANAGER'")&&sql.contains("data_scope='*'")),
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
    void operationAdministratorCannotBypassCrossTenantAssignmentBeforeAnyMutation() {
        SecurityException failure=assertThrows(SecurityException.class,()->service.assignActorAuthorized(Map.of(
                "accountId","target-user","tenantId","TENANT_B","projectId","*","actorCode","SITE_DATA_OWNER"),
                "operations-user","TENANT_A","ROLE_OPERATION_ADMIN",false));

        assertEquals("ACTOR_ASSIGNMENT_TENANT_FORBIDDEN",failure.getMessage());
        verify(jdbc,never()).queryForObject(anyString(),org.mockito.ArgumentMatchers.eq(Integer.class),any(Object[].class));
        verify(jdbc,never()).update(anyString(),any(Object[].class));
    }

    @Test
    void actorAssignmentRejectsAProjectOutsideTheRequestedTenantBeforeAnyMutation() {
        when(jdbc.queryForObject(argThat(sql -> sql!=null&&sql.contains("from emission_project_registry")&&sql.contains("project_id=?")&&sql.contains("tenant_id=?")),
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
        when(jdbc.queryForObject(argThat(sql -> sql!=null&&sql.contains("actor_code='COMPANY_MANAGER'")&&sql.contains("data_scope='*'")),
                org.mockito.ArgumentMatchers.eq(Integer.class),any(Object[].class))).thenReturn(1);
        when(jdbc.queryForObject(argThat(sql -> sql!=null&&sql.contains("from comtnemplyrinfo")&&sql.contains("comtnentrprsmber")),
                org.mockito.ArgumentMatchers.eq(Integer.class),any(Object[].class))).thenReturn(1);

        service.assignActorAuthorized(Map.of(
                "accountId","data-owner","tenantId","TENANT_A","projectId","*","actorCode","SITE_DATA_OWNER"),
                "company-manager","TENANT_A","ROLE_USER",false);

        verify(jdbc).update(argThat(sql -> sql.contains("insert into framework_account_actor_assignment")),any(Object[].class));
    }

    @Test
    void sameTenantCompanyManagerRetainsAValidProjectSpecificAssignmentPath() {
        when(jdbc.queryForObject(argThat(sql -> sql!=null&&sql.contains("from emission_project_registry")&&sql.contains("project_id=?")&&sql.contains("tenant_id=?")),
                org.mockito.ArgumentMatchers.eq(Integer.class),any(Object[].class))).thenReturn(1);
        when(jdbc.queryForObject(argThat(sql -> sql!=null&&sql.contains("from comtnemplyrinfo")&&sql.contains("comtnentrprsmber")),
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

    private void stubStepReviewContract(String sourceCommit,String contractFingerprint){
        when(jdbc.queryForList(argThat(sql -> sql!=null&&sql.contains("select p.process_version as \"processVersion\"")
                        &&sql.contains("framework_runtime_release_state")),any(Object[].class)))
                .thenReturn(List.of(Map.of("processVersion","2.1.0","sourceCommit",sourceCommit)));
        doReturn(Map.of("success",true,"item",Map.of("contractFingerprint",contractFingerprint)))
                .when(service).systemProcessTestReportStepDetail("EMISSION_PROJECT","EMISSION_PROJECT_COLLECT");
    }
}
