package egovframework.com.platform.governance.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.platform.governance.service.ActorProcessGovernanceService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class ActorProcessControlPlaneBridgeProjectPurgeTest {
    private final JdbcTemplate jdbc=mock(JdbcTemplate.class);
    private final ActorProcessGovernanceService governance=
            mock(ActorProcessGovernanceService.class);
    private final ActorProcessControlPlaneBridgeController controller=
            new ActorProcessControlPlaneBridgeController(
                    jdbc,new ObjectMapper(),governance,"bridge-token");
    private static final String RECEIPT="aaaaaaaa-0000-0000-0000-000000000001";
    private static final String OPERATION="bbbbbbbb-0000-0000-0000-000000000001";
    private static final String CHECKSUM="c".repeat(64);
    private static final String SNAPSHOT="d".repeat(64);

    @AfterEach void close(){controller.shutdownGenerationExecutor();}

    @Test
    void previewRequiresBridgeTokenThenRuntimeSystemAdministrator(){
        Map<String,Object> body=previewBody();

        var unauthorized=controller.previewProjectRuntimePurge(
                "wrong","user:default/admin","runtime.admin",body);
        var forbidden=controller.previewProjectRuntimePurge(
                "bridge-token","user:default/admin","runtime.member",body);

        assertEquals(401,unauthorized.getStatusCode().value());
        assertEquals(403,forbidden.getStatusCode().value());
        verify(governance).isControlPlaneAdministrator("runtime.member");
        verifyNoInteractions(jdbc);
    }

    @Test
    void previewPassesExactAccountToDatabaseAuthorityBoundary(){
        when(governance.isControlPlaneAdministrator("runtime.admin")).thenReturn(true);
        when(jdbc.queryForObject(
                org.mockito.ArgumentMatchers.argThat(sql->sql!=null
                        &&sql.contains("framework_preview_project_runtime_purge")),
                eq(String.class),any(Object[].class))).thenReturn("""
                {"success":true,"status":"PREVIEWED","receiptId":"%s",
                 "snapshotSha256":"%s","impact":{"totalRows":20},
                 "blockers":{"blocked":false}}
                """.formatted(RECEIPT,SNAPSHOT));

        var response=controller.previewProjectRuntimePurge(
                "bridge-token","user:default/designer","runtime.admin",previewBody());

        assertEquals(200,response.getStatusCode().value());
        @SuppressWarnings("unchecked")
        Map<String,Object> receipt=(Map<String,Object>)response.getBody();
        assertEquals("PREVIEWED",receipt.get("status"));
        verify(jdbc).queryForObject(
                org.mockito.ArgumentMatchers.argThat(sql->sql!=null
                        &&sql.contains("framework_preview_project_runtime_purge")),
                eq(String.class),any(Object[].class));
        verify(jdbc,never()).queryForObject(
                eq("select set_config('carbonet.runtime.system_admin','true',true)"),
                eq(String.class));
    }

    @Test
    void noReleaseProjectRequiresExactRuntimeAbsenceProof(){
        when(governance.isControlPlaneAdministrator("runtime.admin")).thenReturn(true);
        when(jdbc.queryForObject(
                org.mockito.ArgumentMatchers.argThat(sql->sql!=null
                        &&sql.contains("framework_prove_project_runtime_absent")),
                eq(String.class),any(Object[].class))).thenReturn("""
                {"success":true,"status":"PROVEN_ABSENT",
                 "proofId":"aaaaaaaa-0000-0000-0000-000000000001",
                 "projectId":"RFP-PURGE-EMPTY","projectScopedRows":0,
                 "releaseRows":0,"sourceRows":0,"runtimeResourceRows":0,
                 "residualRows":0,"exactZero":true,"proofSha256":"%s"}
                """.formatted("e".repeat(64)));

        var response=controller.proveProjectRuntimeAbsent(
                "bridge-token","user:default/designer","runtime.admin",
                Map.of("proofId",RECEIPT,"projectId","RFP-PURGE-EMPTY"));

        assertEquals(200,response.getStatusCode().value());
        assertEquals("PROVEN_ABSENT",((Map<?,?>)response.getBody()).get("status"));
    }

    @Test
    void absenceProofTransactionAllowsItsPostgresRowLocks() throws Exception{
        var method=ActorProcessControlPlaneBridgeController.class.getMethod(
                "proveProjectRuntimeAbsent",String.class,String.class,String.class,
                Map.class);
        var transaction=method.getAnnotation(Transactional.class);

        assertFalse(transaction.readOnly(),
                "PostgreSQL authority CAS uses SELECT FOR UPDATE");
    }

    @Test
    void noReleaseDeleteActivatesAndCanReleaseDurableRuntimeFence(){
        when(governance.isControlPlaneAdministrator("runtime.admin")).thenReturn(true);
        when(jdbc.queryForObject(
                org.mockito.ArgumentMatchers.argThat(sql->sql!=null
                        &&sql.contains("framework_activate_project_runtime_absence_fence")),
                eq(String.class),any(Object[].class))).thenReturn("""
                {"success":true,"status":"PROVEN_ABSENT","proofId":"%s",
                 "projectId":"RFP-PURGE-EMPTY","residualRows":0,"exactZero":true,
                 "proofSha256":"%s","fenceStatus":"ACTIVE","activated":true,
                 "idempotent":false}
                """.formatted(RECEIPT,"e".repeat(64)));
        when(jdbc.queryForObject(
                org.mockito.ArgumentMatchers.argThat(sql->sql!=null
                        &&sql.contains("framework_release_project_runtime_absence_fence")),
                eq(String.class),any(Object[].class))).thenReturn("""
                {"success":true,"proofId":"%s","projectId":"RFP-PURGE-EMPTY",
                 "fenceStatus":"RELEASED","idempotent":false}
                """.formatted(RECEIPT));
        Map<String,Object> body=Map.of(
                "proofId",RECEIPT,"projectId","RFP-PURGE-EMPTY");

        var activated=controller.activateProjectRuntimeAbsenceFence(
                "bridge-token","user:default/designer","runtime.admin",body);
        var released=controller.releaseProjectRuntimeAbsenceFence(
                "bridge-token","user:default/designer","runtime.admin",body);

        assertEquals(200,activated.getStatusCode().value());
        assertEquals("ACTIVE",((Map<?,?>)activated.getBody()).get("fenceStatus"));
        assertEquals(200,released.getStatusCode().value());
        assertEquals("RELEASED",((Map<?,?>)released.getBody()).get("fenceStatus"));
    }

    @Test
    void manualOrAdoptPreviewIsConflictAndNeverCallsApply(){
        when(governance.isControlPlaneAdministrator("runtime.admin")).thenReturn(true);
        when(jdbc.queryForObject(
                org.mockito.ArgumentMatchers.argThat(sql->sql!=null
                        &&sql.contains("framework_preview_project_runtime_purge")),
                eq(String.class),any(Object[].class))).thenReturn("""
                {"success":false,"status":"BLOCKED","receiptId":"%s",
                 "snapshotSha256":"%s","impact":{"totalRows":2},
                 "blockers":{"blocked":true,"manualOrAdoptRowCount":1}}
                """.formatted(RECEIPT,SNAPSHOT));

        var response=controller.previewProjectRuntimePurge(
                "bridge-token","user:default/designer","runtime.admin",previewBody());

        assertEquals(409,response.getStatusCode().value());
        verify(jdbc,never()).queryForObject(
                org.mockito.ArgumentMatchers.argThat(sql->sql!=null
                        &&sql.contains("framework_apply_project_runtime_purge")),
                eq(String.class),any(Object[].class));
    }

    @Test
    void applyAndRestoreUseTheSameExactReceiptAndSnapshotCas(){
        when(governance.isControlPlaneAdministrator("runtime.admin")).thenReturn(true);
        when(jdbc.queryForObject(
                org.mockito.ArgumentMatchers.argThat(sql->sql!=null
                        &&sql.contains("framework_apply_project_runtime_purge")),
                eq(String.class),any(Object[].class))).thenReturn("""
                {"success":true,"status":"PURGED","receiptId":"%s",
                 "snapshotSha256":"%s","postcondition":{"exactZero":true}}
                """.formatted(RECEIPT,SNAPSHOT));
        when(jdbc.queryForObject(
                org.mockito.ArgumentMatchers.argThat(sql->sql!=null
                        &&sql.contains("framework_restore_project_runtime_purge")),
                eq(String.class),any(Object[].class))).thenReturn("""
                {"success":true,"status":"RESTORED","receiptId":"%s",
                 "snapshotSha256":"%s","aToBToA":true}
                """.formatted(RECEIPT,SNAPSHOT));
        Map<String,Object> body=mutationBody();

        var purge=controller.applyProjectRuntimePurge(
                "bridge-token","user:default/designer","runtime.admin",RECEIPT,body);
        var restore=controller.restoreProjectRuntimePurge(
                "bridge-token","user:default/designer","runtime.admin",RECEIPT,body);

        assertEquals(200,purge.getStatusCode().value());
        assertEquals(200,restore.getStatusCode().value());
        assertEquals("PURGED",((Map<?,?>)purge.getBody()).get("status"));
        assertEquals(true,((Map<?,?>)restore.getBody()).get("aToBToA"));
        verify(jdbc).queryForObject(
                org.mockito.ArgumentMatchers.argThat(sql->sql!=null
                        &&sql.contains("framework_apply_project_runtime_purge")),
                eq(String.class),any(Object[].class));
        verify(jdbc).queryForObject(
                org.mockito.ArgumentMatchers.argThat(sql->sql!=null
                        &&sql.contains("framework_restore_project_runtime_purge")),
                eq(String.class),any(Object[].class));
    }

    private static Map<String,Object> previewBody(){
        return Map.ofEntries(
                Map.entry("receiptId",RECEIPT),Map.entry("operationKey",OPERATION),
                Map.entry("projectId","RFP-PURGE-001"),
                Map.entry("processCode","RFP_TEST"),Map.entry("designVersion",1),
                Map.entry("contractSha256",CHECKSUM),
                Map.entry("scopeMode","EXACT_PROJECT"));
    }

    private static Map<String,Object> mutationBody(){
        return Map.of("projectId","RFP-PURGE-001","processCode","RFP_TEST",
                "designVersion",1,"contractSha256",CHECKSUM,
                "snapshotSha256",SNAPSHOT);
    }
}
