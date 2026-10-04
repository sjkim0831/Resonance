package egovframework.com.platform.workbench.web;

import egovframework.com.platform.executiongate.support.OperationsConsoleGateSupport;
import egovframework.com.feature.auth.service.CurrentUserContextService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.test.util.ReflectionTestUtils;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.*;

class AdminSrWorkbenchDevelopmentTest {
    OperationsConsoleGateSupport gate;
    AdminSrWorkbenchController controller;
    MockHttpServletRequest request;
    CurrentUserContextService users;
    CurrentUserContextService.CurrentUserContext admin;
    public static class Login { public String getId(){return "fixture-admin";} }
    @BeforeEach void setup(){
        gate=mock(OperationsConsoleGateSupport.class);
        controller=new AdminSrWorkbenchController(gate,mock(ObjectProvider.class));
        request=new MockHttpServletRequest(); request.getSession().setAttribute("LoginVO",new Login());
        when(gate.payloadForCurrentAdmin(any(),anyString(),any(),anyMap())).thenReturn(Map.of("success",true));
        users=mock(CurrentUserContextService.class);
        admin=mock(CurrentUserContextService.CurrentUserContext.class);
        when(admin.isAuthenticated()).thenReturn(true); when(admin.getAuthorCode()).thenReturn("ROLE_SYSTEM_ADMIN");
        when(users.resolve(any(MockHttpServletRequest.class))).thenAnswer(i->i.getArgument(0)==request?admin:null);
        ReflectionTestUtils.setField(controller,"developmentUserContext",users);
        ReflectionTestUtils.setField(controller,"developmentOnly",true);
        ReflectionTestUtils.setField(controller,"developmentRunnerEnabled",true);
        ReflectionTestUtils.setField(controller,"developmentBuildCommand","fixture-build");
        ReflectionTestUtils.setField(controller,"developmentPlanCommand","fixture-plan");
        ReflectionTestUtils.setField(controller,"developmentDeployCommand","");
    }
    @Test void anonymousCapabilities401(){assertEquals(401,controller.developmentCapabilities(new MockHttpServletRequest()).getStatusCode().value());verifyNoInteractions(gate);}
    @Test void anonymousExecute401(){assertEquals(401,controller.developmentExecute("T",null,new MockHttpServletRequest()).getStatusCode().value());verifyNoInteractions(gate);}
    @Test void anonymousPlan401(){assertEquals(401,controller.developmentPlan("T",new MockHttpServletRequest()).getStatusCode().value());verifyNoInteractions(gate);}
    @Test void deploymentHookBlocksExecution(){ReflectionTestUtils.setField(controller,"developmentDeployCommand","deploy");assertEquals(409,controller.developmentExecute("T",null,request).getStatusCode().value());verifyNoInteractions(gate);}
    @Test void nonDevelopmentEnvironmentBlocks(){ReflectionTestUtils.setField(controller,"developmentOnly",false);assertEquals(409,controller.developmentPlan("T",request).getStatusCode().value());verifyNoInteractions(gate);}
    @Test void disabledRunnerBlocks(){ReflectionTestUtils.setField(controller,"developmentRunnerEnabled",false);assertEquals(409,controller.developmentExecute("T",null,request).getStatusCode().value());verifyNoInteractions(gate);}
    @Test void missingBuildCommandBlocks(){ReflectionTestUtils.setField(controller,"developmentBuildCommand","");assertEquals(409,controller.developmentExecute("T",null,request).getStatusCode().value());verifyNoInteractions(gate);}
    @Test void safeExecuteUsesExistingPermissionGate(){assertEquals(200,controller.developmentExecute("T",null,request).getStatusCode().value());verify(gate).payloadForCurrentAdmin(eq(request),eq("sr-workbench.tickets.execute"),eq("T"),argThat(m->"T".equals(m.get("ticketId"))));}
    @Test void safePlanUsesExistingPermissionGate(){assertEquals(200,controller.developmentPlan("T",request).getStatusCode().value());verify(gate).payloadForCurrentAdmin(eq(request),eq("sr-workbench.tickets.plan"),eq("T"),anyMap());}
    @Test void permissionDenialNotSwallowed(){when(gate.payloadForCurrentAdmin(any(),anyString(),any(),anyMap())).thenThrow(new SecurityException("FORBIDDEN"));assertThrows(SecurityException.class,()->controller.developmentExecute("T",null,request));}
    @Test void capabilityNeverOffersDeployment(){var body=controller.developmentCapabilities(request).getBody();assertEquals(false,body.get("deploymentEnabled"));assertEquals(true,body.get("executeEnabled"));}
    @Test void capabilitiesUseGate(){controller.developmentCapabilities(request);verify(gate).payloadForCurrentAdmin(eq(request),eq("sr-workbench.page.get"),isNull(),anyMap());}
    @Test void ordinaryUserForbidden(){when(admin.getAuthorCode()).thenReturn("ROLE_USER");assertEquals(403,controller.developmentExecute("T",null,request).getStatusCode().value());verifyNoInteractions(gate);}
    @Test void anonymousDetailDenied(){assertEquals(401,controller.developmentDetail("T",new MockHttpServletRequest()).getStatusCode().value());verifyNoInteractions(gate);}
    @Test void anonymousArtifactDenied(){assertEquals(401,controller.developmentArtifact("T","diff",new MockHttpServletRequest()).getStatusCode().value());verifyNoInteractions(gate);}
    @Test void detailUsesExistingGate(){controller.developmentDetail("T",request);verify(gate).payloadForCurrentAdmin(eq(request),eq("codex-admin.tickets.detail"),eq("T"),eq(Map.of("ticketId","T")));}
    @Test void artifactUsesExistingGate(){controller.developmentArtifact("T","diff",request);verify(gate).payloadForCurrentAdmin(eq(request),eq("codex-admin.tickets.artifact"),eq("T"),eq(Map.of("ticketId","T","artifactType","diff")));}
}
