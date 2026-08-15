package egovframework.com.platform.governance.web;

import egovframework.com.feature.auth.service.CurrentUserContextService;
import egovframework.com.platform.governance.service.ActorProcessGovernanceService;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;

import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ActorProcessGovernanceApiControllerAssignmentTest {
    private final ActorProcessGovernanceService service=mock(ActorProcessGovernanceService.class);
    private final CurrentUserContextService users=mock(CurrentUserContextService.class);
    private final HttpServletRequest request=mock(HttpServletRequest.class);
    private final ActorProcessGovernanceApiController controller=new ActorProcessGovernanceApiController(service,users,"");

    @Test
    void unauthenticatedAssignmentRequestReturns401WithoutCallingTheService(){
        when(users.resolve(request)).thenReturn(context("","","",false,false));

        var response=controller.assignment(Map.of("accountId","target"),request);

        assertEquals(401,response.getStatusCode().value());
        verify(service,never()).assignActorAuthorized(any(),any(),any(),any(),org.mockito.ArgumentMatchers.anyBoolean());
    }

    @Test
    void serviceAuthorizationFailureIsExposedAs403(){
        Map<String,Object> body=Map.of("accountId","data-owner","tenantId","TENANT_A","actorCode","SITE_DATA_OWNER");
        when(users.resolve(request)).thenReturn(context("data-owner","TENANT_A","ROLE_USER",true,false));
        doThrow(new SecurityException("ACTOR_ASSIGNMENT_COMPANY_MANAGER_REQUIRED"))
                .when(service).assignActorAuthorized(body,"data-owner","TENANT_A","ROLE_USER",false);

        var response=controller.assignment(body,request);

        assertEquals(403,response.getStatusCode().value());
        assertEquals("ACTOR_ASSIGNMENT_COMPANY_MANAGER_REQUIRED",((Map<?,?>)response.getBody()).get("message"));
    }

    @Test
    void sameTenantCompanyAdministratorContextIsPassedToTheService(){
        Map<String,Object> body=Map.of("accountId","data-owner","tenantId","TENANT_A","actorCode","SITE_DATA_OWNER");
        when(users.resolve(request)).thenReturn(context("company-manager","TENANT_A","ROLE_ADMIN",true,false));

        var response=controller.assignment(body,request);

        assertEquals(200,response.getStatusCode().value());
        verify(service).assignActorAuthorized(body,"company-manager","TENANT_A","ROLE_ADMIN",false);
    }

    @Test
    void anonymousDesignGenerationReturns401WithoutMutation(){
        Map<String,Object> body=Map.of("routePath","/design/route");
        when(users.resolve(request)).thenReturn(context("","","",false,false));

        var response=controller.saveDesignAndGenerate(body,request);

        assertEquals(401,response.getStatusCode().value());
        assertEquals("AUTHENTICATION_REQUIRED",((Map<?,?>)response.getBody()).get("message"));
        verify(service,never()).saveDesignAndGenerate(any(),anyString());
    }

    @Test
    void operationAdministratorCannotMutateCanonicalDesign(){
        Map<String,Object> body=Map.of("routePath","/design/route");
        when(users.resolve(request)).thenReturn(
            context("operations-user","DEFAULT","ROLE_OPERATION_ADMIN",true,false));

        var response=controller.saveDesignAndGenerate(body,request);

        assertEquals(403,response.getStatusCode().value());
        assertEquals("DESIGN_ADMIN_REQUIRED",((Map<?,?>)response.getBody()).get("message"));
        verify(service,never()).saveDesignAndGenerate(any(),anyString());
    }

    @Test
    void ordinaryAuthenticatedAccountReturns403WithoutMutation(){
        Map<String,Object> body=Map.of("routePath","/design/route");
        when(users.resolve(request)).thenReturn(context("designer","TENANT_A","ROLE_ADMIN",true,false));

        var response=controller.saveDesignAndGenerate(body,request);

        assertEquals(403,response.getStatusCode().value());
        assertEquals("DESIGN_ADMIN_REQUIRED",((Map<?,?>)response.getBody()).get("message"));
        verify(service,never()).saveDesignAndGenerate(any(),anyString());
    }

    @Test
    void platformAdministratorCanSaveAndGenerateWithResolvedIdentity(){
        Map<String,Object> body=Map.of("routePath","/design/route");
        when(users.resolve(request)).thenReturn(context("system-admin","DEFAULT","ROLE_SYSTEM_ADMIN",true,false));
        when(service.saveDesignAndGenerate(body,"system-admin"))
            .thenReturn(Map.of("success",true,"buildRequired",false));

        var response=controller.saveDesignAndGenerate(body,request);

        assertEquals(200,response.getStatusCode().value());
        verify(service).saveDesignAndGenerate(body,"system-admin");
    }

    @Test
    void ordinaryAdministratorCannotMutateDesignOrInvokeGeneration(){
        Map<String,Object> body=Map.of("processCode","PROCESS_A","stepCode","STEP_A");
        when(users.resolve(request)).thenReturn(context("ordinary-admin","TENANT_A","ROLE_ADMIN",true,false));

        assertEquals(403,controller.actor(body,request).getStatusCode().value());
        assertEquals(403,controller.process(body,request).getStatusCode().value());
        assertEquals(403,controller.step(body,request).getStatusCode().value());
        assertEquals(403,controller.compileScreens(body,request).getStatusCode().value());

        verify(service,never()).createActor(any());
        verify(service,never()).createProcess(any());
        verify(service,never()).addStep(any(),anyString());
        verify(service,never()).compileScreenBlueprints(any(),anyString());
    }

    @Test
    void systemAdministratorCanMutateDesignAndGenerateWithResolvedIdentity(){
        Map<String,Object> body=Map.of("processCode","PROCESS_A","stepCode","STEP_A");
        when(users.resolve(request)).thenReturn(context("system-admin","DEFAULT","ROLE_SYSTEM_ADMIN",true,false));
        when(service.addStep(body,"system-admin")).thenReturn(Map.of("success",true));
        when(service.compileScreenBlueprints(body,"system-admin")).thenReturn(Map.of("success",true));

        assertEquals(200,controller.actor(body,request).getStatusCode().value());
        assertEquals(200,controller.process(body,request).getStatusCode().value());
        assertEquals(200,controller.step(body,request).getStatusCode().value());
        assertEquals(200,controller.compileScreens(body,request).getStatusCode().value());

        verify(service).createActor(body);
        verify(service).createProcess(body);
        verify(service).addStep(body,"system-admin");
        verify(service).compileScreenBlueprints(body,"system-admin");
    }

    @Test
    void anonymousProcessActorCannotStartAnExecution(){
        Map<String,Object> body=Map.of("tenantId","TENANT_A","projectId","PROJECT_A","processCode","PROCESS_A","actorCode","REQUESTER");
        when(users.resolve(request)).thenReturn(context("","","",false,false));

        assertEquals(401,controller.startExecution(body,request).getStatusCode().value());
        verify(service,never()).startProcessExecution(any(),anyString());
    }

    @Test
    void assignedProcessActorIdentityIsPassedToTheExistingServiceGuard(){
        Map<String,Object> body=Map.of("tenantId","TENANT_A","projectId","PROJECT_A","processCode","PROCESS_A","actorCode","REQUESTER");
        when(users.resolve(request)).thenReturn(context("assigned-user","TENANT_A","ROLE_USER",true,false));
        when(service.startProcessExecution(body,"assigned-user")).thenReturn(Map.of("success",true));

        assertEquals(200,controller.startExecution(body,request).getStatusCode().value());
        verify(service).startProcessExecution(body,"assigned-user");
    }

    @Test
    void unassignedProcessActorDenialIsReturnedAs403(){
        UUID executionId=UUID.randomUUID();
        Map<String,Object> body=Map.of("tenantId","TENANT_A","projectId","PROJECT_A","processCode","PROCESS_A","stepCode","STEP_A","actorCode","APPROVER","commandCode","APPROVE","idempotencyKey","key-1");
        when(users.resolve(request)).thenReturn(context("unassigned-user","TENANT_A","ROLE_USER",true,false));
        doThrow(new SecurityException("계정에 해당 액터 권한이 없습니다."))
                .when(service).executeProcessCommand(executionId,body,"unassigned-user");

        var response=controller.executeCommand(executionId,body,request);

        assertEquals(403,response.getStatusCode().value());
        assertEquals("계정에 해당 액터 권한이 없습니다.",((Map<?,?>)response.getBody()).get("message"));
    }

    @Test
    void workerEndpointsRequireTheExistingControlPlaneToken(){
        Map<String,Object> body=Map.of("workerId","worker-1");
        var workerController=new ActorProcessGovernanceApiController(service,users,"control-token");

        assertEquals(401,workerController.claim(body,request).getStatusCode().value());
        when(request.getHeader("X-Resonance-Token")).thenReturn("wrong-token");
        assertEquals(401,workerController.claim(body,request).getStatusCode().value());
        verify(service,never()).claimDevelopmentJob(anyString());

        when(request.getHeader("X-Resonance-Token")).thenReturn("control-token");
        when(service.claimDevelopmentJob("worker-1")).thenReturn(Map.of("success",true,"available",false));
        assertEquals(200,workerController.claim(body,request).getStatusCode().value());
        verify(service).claimDevelopmentJob("worker-1");
    }

    @Test
    void anonymousSystemReportReadIsRejectedBeforeTheService(){
        when(users.resolve(request)).thenReturn(context("","","",false,false));

        var response=controller.systemTestReport("","","",true,0,50,request);

        assertEquals(401,response.getStatusCode().value());
        verify(service,never()).systemProcessTestReport(anyString(),anyString(),anyString(),anyBoolean(),anyInt(),anyInt());
    }

    @Test
    void systemReportPageBootstrapDatasetsUseTheSameFailClosedRoleGuard(){
        when(users.resolve(request)).thenReturn(context("company-user","TENANT_A","ROLE_ADMIN",true,false));
        assertEquals(403,controller.dashboard(request).getStatusCode().value());
        assertEquals(403,controller.dashboardCore(request).getStatusCode().value());
        assertEquals(403,controller.designAssets(request).getStatusCode().value());
        verify(service,never()).dashboard();
        verify(service,never()).dashboardCore();
        verify(service,never()).designAssetInventory();

        when(users.resolve(request)).thenReturn(context("system-admin","DEFAULT","ROLE_SYSTEM_ADMIN",true,false));
        assertEquals(200,controller.dashboard(request).getStatusCode().value());
        assertEquals(200,controller.dashboardCore(request).getStatusCode().value());
        assertEquals(200,controller.designAssets(request).getStatusCode().value());
    }

    @Test
    void ordinaryAndOperationAdministratorsCannotReadTheSystemReport(){
        when(users.resolve(request)).thenReturn(context("company-user","TENANT_A","ROLE_ADMIN",true,false));
        assertEquals(403,controller.systemTestReport("","","",true,0,50,request).getStatusCode().value());
        when(users.resolve(request)).thenReturn(context("operations-user","DEFAULT","ROLE_OPERATION_ADMIN",true,false));
        assertEquals(403,controller.systemTestReport("","","",true,0,50,request).getStatusCode().value());
        verify(service,never()).systemProcessTestReport(anyString(),anyString(),anyString(),anyBoolean(),anyInt(),anyInt());
    }

    @Test
    void systemAdministratorCanReadTheBoundedCompactReport(){
        when(users.resolve(request)).thenReturn(context("system-admin","DEFAULT","ROLE_SYSTEM_ADMIN",true,false));

        var response=controller.systemTestReport("EMISSION","EMISSION_PROJECT","",true,2,50,request);

        assertEquals(200,response.getStatusCode().value());
        verify(service).systemProcessTestReport("EMISSION","EMISSION_PROJECT","",true,2,50);
    }

    @Test
    void professionalScreenContractPreviewRequiresSystemAdministrationAndUsesResolvedIdentity(){
        Map<String,Object> body=Map.of("contractId","26");
        when(users.resolve(request)).thenReturn(context("company-user","TENANT_A","ROLE_ADMIN",true,false));
        assertEquals(403,controller.professionalScreenContractPreview(body,request).getStatusCode().value());
        verify(service,never()).saveProfessionalScreenContractPreview(any(),anyString());

        when(users.resolve(request)).thenReturn(context("system-admin","DEFAULT","ROLE_SYSTEM_ADMIN",true,false));
        when(service.saveProfessionalScreenContractPreview(body,"system-admin"))
                .thenReturn(Map.of("success",true,"preview",true,"rolledBack",true,"committed",false));
        var response=controller.professionalScreenContractPreview(body,request);
        assertEquals(200,response.getStatusCode().value());
        verify(service).saveProfessionalScreenContractPreview(body,"system-admin");
    }

    @Test
    void stepDetailRequiresPlatformAdministrationAndReturnsOnlyTheFullSelectedStep(){
        when(users.resolve(request)).thenReturn(context("company-user","TENANT_A","ROLE_ADMIN",true,false));
        assertEquals(403,controller.systemTestReportStepDetail("EMISSION_PROJECT","STEP_1",request).getStatusCode().value());
        verify(service,never()).systemProcessTestReportStepDetail(anyString(),anyString());

        when(users.resolve(request)).thenReturn(context("system-admin","DEFAULT","ROLE_SYSTEM_ADMIN",true,false));
        when(service.systemProcessTestReportStepDetail("EMISSION_PROJECT","STEP_1")).thenReturn(Map.of(
                "success",true,"detailMode","SELECTED_STEP_FULL","reviewCriticalFieldsComplete",true,"item",Map.of()));
        var response=controller.systemTestReportStepDetail("EMISSION_PROJECT","STEP_1",request);
        assertEquals(200,response.getStatusCode().value());
        assertEquals(true,((Map<?,?>)response.getBody()).get("reviewCriticalFieldsComplete"));
        verify(service).systemProcessTestReportStepDetail("EMISSION_PROJECT","STEP_1");
    }

    @Test
    void missingStepDetailIsA404InsteadOfAnEmptyReviewableRow(){
        when(users.resolve(request)).thenReturn(context("system-admin","DEFAULT","ROLE_SYSTEM_ADMIN",true,false));
        when(service.systemProcessTestReportStepDetail("EMISSION_PROJECT","MISSING"))
                .thenThrow(new java.util.NoSuchElementException("SYSTEM_TEST_REPORT_STEP_NOT_FOUND"));

        var response=controller.systemTestReportStepDetail("EMISSION_PROJECT","MISSING",request);

        assertEquals(404,response.getStatusCode().value());
        assertEquals("SYSTEM_TEST_REPORT_STEP_NOT_FOUND",((Map<?,?>)response.getBody()).get("message"));
    }

    @Test
    void ordinaryUserCannotAuditOrReviewTheSystemReport(){
        when(users.resolve(request)).thenReturn(context("company-user","TENANT_A","ROLE_ADMIN",true,false));

        assertEquals(403,controller.auditSystemTestReport(Map.of("processCode","EMISSION_PROJECT"),request).getStatusCode().value());
        assertEquals(403,controller.saveSystemTestReportReview(Map.of("processCode","EMISSION_PROJECT"),request).getStatusCode().value());
        verify(service,never()).auditSystemProcessContracts(any(),anyString());
        verify(service,never()).saveSystemUsageReview(any(),anyString());
    }

    @Test
    void systemMasterIdentityIsTheOnlyAuditAndReviewExecutor(){
        when(users.resolve(request)).thenReturn(context("platform-reviewer","DEFAULT","ROLE_SYSTEM_MASTER",true,false));
        Map<String,Object> audit=Map.of("processCode","EMISSION_PROJECT");
        Map<String,Object> review=Map.of("processCode","EMISSION_PROJECT","stepCode","STEP_1","reviewStatus","APPROVED");

        assertEquals(200,controller.auditSystemTestReport(audit,request).getStatusCode().value());
        assertEquals(200,controller.saveSystemTestReportReview(review,request).getStatusCode().value());
        verify(service).auditSystemProcessContracts(audit,"platform-reviewer");
        verify(service).saveSystemUsageReview(review,"platform-reviewer");
    }

    @Test
    void reviewIdempotencyReuseMismatchIs409WhileOrdinaryValidationRemains400(){
        when(users.resolve(request)).thenReturn(context("system-admin","DEFAULT","ROLE_SYSTEM_ADMIN",true,false));
        Map<String,Object> mismatch=Map.of("processCode","P","stepCode","S","idempotencyKey","same-key");
        when(service.saveSystemUsageReview(mismatch,"system-admin"))
                .thenThrow(new IllegalArgumentException("IDEMPOTENCY_KEY_REUSE_MISMATCH"));
        assertEquals(409,controller.saveSystemTestReportReview(mismatch,request).getStatusCode().value());
        assertEquals("IDEMPOTENCY_KEY_REUSE_MISMATCH",((Map<?,?>)controller.saveSystemTestReportReview(mismatch,request).getBody()).get("message"));

        Map<String,Object> invalid=Map.of("processCode","P","stepCode","S","reviewStatus","CHANGE_REQUESTED");
        when(service.saveSystemUsageReview(invalid,"system-admin"))
                .thenThrow(new IllegalArgumentException("reviewNote is required for CHANGE_REQUESTED"));
        assertEquals(400,controller.saveSystemTestReportReview(invalid,request).getStatusCode().value());
    }

    private CurrentUserContextService.CurrentUserContext context(String user,String tenant,String authority,boolean authenticated,boolean webmaster){
        var context=new CurrentUserContextService.CurrentUserContext();
        context.setUserId(user);context.setInsttId(tenant);context.setAuthorCode(authority);
        context.setAuthenticated(authenticated);context.setWebmaster(webmaster);
        return context;
    }
}
