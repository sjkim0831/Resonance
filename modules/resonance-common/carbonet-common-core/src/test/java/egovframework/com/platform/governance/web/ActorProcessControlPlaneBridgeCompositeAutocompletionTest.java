package egovframework.com.platform.governance.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.platform.governance.service.ActorProcessGovernanceService;
import egovframework.com.platform.governance.service.CompositeDesignOperationalWorker;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ActorProcessControlPlaneBridgeCompositeAutocompletionTest {
    private final ActorProcessGovernanceService governance=mock(ActorProcessGovernanceService.class);
    private final CompositeDesignOperationalWorker worker=mock(CompositeDesignOperationalWorker.class);
    private final ActorProcessControlPlaneBridgeController controller=
        new ActorProcessControlPlaneBridgeController(mock(JdbcTemplate.class),new ObjectMapper(),
            governance,"bridge-token",worker);

    @AfterEach void close(){controller.shutdownGenerationExecutor();}

    @Test
    void inspectRejectsInvalidTokenWithoutCallingWorker(){
        var response=controller.inspectCompositeAutocompletion("wrong","ACTOR","system-admin");
        assertEquals(401,response.getStatusCode().value());
        verify(worker,never()).inspect();
    }

    @Test
    void inspectIsAuthenticatedDryRunAndDoesNotDispatch(){
        when(governance.isControlPlaneAdministrator("system-admin")).thenReturn(true);
        when(worker.inspect()).thenReturn(Map.of("success",true,"dryRun",true,
            "tenMinuteTarget","MEASUREMENT_REQUIRED"));
        var response=controller.inspectCompositeAutocompletion(
            "bridge-token","ACTOR","system-admin");
        assertEquals(200,response.getStatusCode().value());
        assertEquals(true,((Map<?,?>)response.getBody()).get("dryRun"));
        verify(worker).inspect();
        verify(worker,never()).dispatchCanary();
        verify(worker,never()).dispatchApproved(org.mockito.ArgumentMatchers.anyInt());
    }

    @Test
    void dispatchRejectsLimitAboveTwentyFiveWithoutWrite(){
        when(governance.isControlPlaneAdministrator("system-admin")).thenReturn(true);
        var response=controller.dispatchCompositeAutocompletion(
            "bridge-token","ACTOR","system-admin",Map.of("limit",26));
        assertEquals(422,response.getStatusCode().value());
        verify(worker,never()).dispatchCanary();
        verify(worker,never()).dispatchApproved(org.mockito.ArgumentMatchers.anyInt());
    }

    @Test
    void limitOneClaimsExactlyOneBoundCanary(){
        when(governance.isControlPlaneAdministrator("system-admin")).thenReturn(true);
        String canaryId=UUID.randomUUID().toString();
        when(worker.dispatchCanary()).thenReturn(Map.of(
            "success",true,"claimedCount",1,"canaryId",canaryId));

        var canary=controller.dispatchCompositeAutocompletion(
            "bridge-token","ACTOR","system-admin",Map.of("limit",1));

        assertEquals(202,canary.getStatusCode().value());
        assertEquals(true,((Map<?,?>)canary.getBody()).get("canary"));
        assertEquals(1,((Map<?,?>)canary.getBody()).get("claimedCount"));
        assertEquals(1,((Map<?,?>)canary.getBody()).get("requestedLimit"));
        assertEquals(canaryId,((Map<?,?>)canary.getBody()).get("canaryId"));
        verify(worker).dispatchCanary();
        verify(worker,never()).dispatchApproved(org.mockito.ArgumentMatchers.anyInt());
    }

    @Test
    void repeatedCanaryRefusalFailsClosed(){
        when(governance.isControlPlaneAdministrator("system-admin")).thenReturn(true);
        when(worker.dispatchCanary())
            .thenReturn(Map.of("success",true,"claimedCount",1,
                "canaryId",UUID.randomUUID().toString()))
            .thenThrow(new IllegalStateException("CANARY_ALREADY_EXISTS_FOR_RUNTIME"));

        var first=controller.dispatchCompositeAutocompletion(
            "bridge-token","ACTOR","system-admin",Map.of("limit",1));
        var repeated=controller.dispatchCompositeAutocompletion(
            "bridge-token","ACTOR","system-admin",Map.of("limit",1));

        assertEquals(202,first.getStatusCode().value());
        assertEquals(409,repeated.getStatusCode().value());
        assertEquals("DISPATCH_REJECTED",((Map<?,?>)repeated.getBody()).get("status"));
        assertTrue(String.valueOf(((Map<?,?>)repeated.getBody()).get("message"))
            .contains("CANARY_ALREADY_EXISTS_FOR_RUNTIME"));
        verify(worker,times(2)).dispatchCanary();
        verify(worker,never()).dispatchApproved(org.mockito.ArgumentMatchers.anyInt());
    }

    @Test
    void canaryMustClaimExactlyOneOrRequestIsRejected(){
        when(governance.isControlPlaneAdministrator("system-admin")).thenReturn(true);
        when(worker.dispatchCanary()).thenReturn(Map.of("success",true,"claimedCount",0));

        var response=controller.dispatchCompositeAutocompletion(
            "bridge-token","ACTOR","system-admin",Map.of("limit",1));

        assertEquals(409,response.getStatusCode().value());
        assertEquals("CANARY_NOT_CLAIMED",((Map<?,?>)response.getBody()).get("status"));
    }

    @Test
    void measuredPassAllowsBoundedTwentyFiveDispatch(){
        when(governance.isControlPlaneAdministrator("system-admin")).thenReturn(true);
        when(worker.dispatchApproved(25)).thenReturn(Map.of("success",true,"claimedCount",8));
        var response=controller.dispatchCompositeAutocompletion(
            "bridge-token","ACTOR","system-admin",Map.of("limit",25));
        assertEquals(202,response.getStatusCode().value());
        assertEquals(25,((Map<?,?>)response.getBody()).get("requestedLimit"));
        assertEquals(false,((Map<?,?>)response.getBody()).get("canary"));
        verify(worker).dispatchApproved(25);
        verify(worker,never()).dispatchCanary();
    }

    @Test
    void rejectedBulkApprovalFailsClosed(){
        when(governance.isControlPlaneAdministrator("system-admin")).thenReturn(true);
        when(worker.dispatchApproved(2)).thenThrow(
            new IllegalStateException("AUTOMATIC_ENABLEMENT_NOT_APPROVED"));

        var response=controller.dispatchCompositeAutocompletion(
            "bridge-token","ACTOR","system-admin",Map.of("limit",2));

        assertEquals(409,response.getStatusCode().value());
        assertEquals("DISPATCH_REJECTED",((Map<?,?>)response.getBody()).get("status"));
        verify(worker).dispatchApproved(2);
        verify(worker,never()).dispatchCanary();
    }

    @Test
    void dispatchAccessDenialsPerformNoWorkerWrite(){
        var unauthorized=controller.dispatchCompositeAutocompletion(
            "wrong","ACTOR","system-admin",Map.of("limit",1));
        var forbidden=controller.dispatchCompositeAutocompletion(
            "bridge-token","ACTOR","ordinary-user",Map.of("limit",25));

        assertEquals(401,unauthorized.getStatusCode().value());
        assertEquals(403,forbidden.getStatusCode().value());
        verify(worker,never()).dispatchCanary();
        verify(worker,never()).dispatchApproved(org.mockito.ArgumentMatchers.anyInt());
    }

    @Test
    void approvalAccessDenialsPerformNoGateWrite(){
        var unauthorized=controller.changeCompositeAutocompletionApproval(
            "wrong","ACTOR","system-admin",Map.of("action","REVOKE","expectedRevision",0));
        var forbidden=controller.changeCompositeAutocompletionApproval(
            "bridge-token","ACTOR","ordinary-user",
            Map.of("action","REVOKE","expectedRevision",0));

        assertEquals(401,unauthorized.getStatusCode().value());
        assertEquals(403,forbidden.getStatusCode().value());
        verify(worker,never()).approve(anyLong(),anyString(),anyString(),anyString(),anyString());
        verify(worker,never()).revokePrepared(anyLong(),anyString(),anyString(),anyString());
        verify(worker,never()).revoke(anyLong(),anyString(),anyString());
    }

    @Test
    void preparationDelegatesExactRevisionCommitAndFinalH1WithoutActivating(){
        when(governance.isControlPlaneAdministrator("system-admin")).thenReturn(true);
        String commit="a".repeat(40),hash="b".repeat(64);
        String candidate="postdeploy:test:20260817";
        when(worker.prepare(7L,commit,hash,candidate,"ACTOR")).thenReturn(Map.of(
            "success",true,"action","PREPARE","approvalStatus","PREPARED",
            "revision",8L,"effectiveWithoutRollout",false));

        var response=controller.changeCompositeAutocompletionApproval(
                "bridge-token","ACTOR","system-admin",Map.of("action","PREPARE",
                "expectedRevision",7L,"expectedRuntimeCommit",commit,
                "expectedFinalAuthorityHash",hash,
                "expectedPostdeployCandidateId",candidate));

        assertEquals(200,response.getStatusCode().value());
        assertEquals(false,((Map<?,?>)response.getBody()).get("effectiveWithoutRollout"));
        verify(worker).prepare(7L,commit,hash,candidate,"ACTOR");
        verify(worker,never()).revoke(anyLong(),anyString(),anyString());
    }

    @Test
    void activationDelegatesPreparedRevisionAndStableSourceH0WithoutRollout(){
        when(governance.isControlPlaneAdministrator("system-admin")).thenReturn(true);
        String commit="a".repeat(40),sourceH0="c".repeat(64);
        String candidate="postdeploy:test:20260817";
        when(worker.activate(8L,commit,sourceH0,candidate,"ACTOR")).thenReturn(Map.of(
            "success",true,"action","ACTIVATE","approvalStatus","ACTIVE",
            "revision",9L,"effectiveWithoutRollout",true));

        var response=controller.changeCompositeAutocompletionApproval(
                "bridge-token","ACTOR","system-admin",Map.of("action","ACTIVATE",
                "expectedRevision",8L,"expectedRuntimeCommit",commit,
                "expectedSourceInputAuthorityHash",sourceH0,
                "expectedPostdeployCandidateId",candidate));

        assertEquals(200,response.getStatusCode().value());
        assertEquals(true,((Map<?,?>)response.getBody()).get("effectiveWithoutRollout"));
        verify(worker).activate(8L,commit,sourceH0,candidate,"ACTOR");
        verify(worker,never()).prepare(anyLong(),anyString(),anyString(),anyString(),anyString());
        verify(worker,never()).revoke(anyLong(),anyString(),anyString());
    }

    @Test
    void preparedOnlyRevokeDelegatesExactCandidateAndCannotUseBroadRevoke(){
        when(governance.isControlPlaneAdministrator("system-admin")).thenReturn(true);
        String candidate="postdeploy:test:20260817";
        when(worker.revokePrepared(8L,candidate,"ACTOR","FINALIZER_FAILED")).thenReturn(Map.of(
            "success",true,"action","REVOKE_PREPARED","approvalStatus","REVOKED",
            "postdeployCandidateId",candidate,"revision",9L));

        var response=controller.changeCompositeAutocompletionApproval(
            "bridge-token","ACTOR","system-admin",Map.of("action","REVOKE_PREPARED",
                "expectedRevision",8L,"expectedPostdeployCandidateId",candidate,
                "reason","FINALIZER_FAILED"));

        assertEquals(200,response.getStatusCode().value());
        verify(worker).revokePrepared(8L,candidate,"ACTOR","FINALIZER_FAILED");
        verify(worker,never()).revoke(anyLong(),anyString(),anyString());
    }
}
