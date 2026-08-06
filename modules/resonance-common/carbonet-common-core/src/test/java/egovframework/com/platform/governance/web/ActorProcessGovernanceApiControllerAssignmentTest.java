package egovframework.com.platform.governance.web;

import egovframework.com.feature.auth.service.CurrentUserContextService;
import egovframework.com.platform.governance.service.ActorProcessGovernanceService;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ActorProcessGovernanceApiControllerAssignmentTest {
    private final ActorProcessGovernanceService service=mock(ActorProcessGovernanceService.class);
    private final CurrentUserContextService users=mock(CurrentUserContextService.class);
    private final HttpServletRequest request=mock(HttpServletRequest.class);
    private final ActorProcessGovernanceApiController controller=new ActorProcessGovernanceApiController(service,users);

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

    private CurrentUserContextService.CurrentUserContext context(String user,String tenant,String authority,boolean authenticated,boolean webmaster){
        var context=new CurrentUserContextService.CurrentUserContext();
        context.setUserId(user);context.setInsttId(tenant);context.setAuthorCode(authority);
        context.setAuthenticated(authenticated);context.setWebmaster(webmaster);
        return context;
    }
}
