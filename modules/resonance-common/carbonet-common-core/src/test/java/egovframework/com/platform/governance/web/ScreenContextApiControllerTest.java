package egovframework.com.platform.governance.web;

import egovframework.com.feature.auth.service.CurrentUserContextService;
import egovframework.com.platform.governance.service.ActorProcessGovernanceService;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class ScreenContextApiControllerTest {
    @Test
    void delegatesEveryContextSelectorToTheCommonService(){
        ActorProcessGovernanceService service=mock(ActorProcessGovernanceService.class);
        CurrentUserContextService users=mock(CurrentUserContextService.class);
        HttpServletRequest request=mock(HttpServletRequest.class);
        CurrentUserContextService.CurrentUserContext user=new CurrentUserContextService.CurrentUserContext();
        user.setAuthenticated(true);
        user.setUserId("ACCOUNT-1");
        user.setInsttId("TENANT-1");
        when(users.resolve(request)).thenReturn(user);
        ScreenContextApiController controller=new ScreenContextApiController(service,users);
        Map<String,Object> expected=Map.of(
            "identity",Map.of("routeKey","/emission/workspace"),
            "candidates",List.of(),
            "selectionRequired",false);
        when(service.screenContext(
            "/emission/workspace","PAGE-1","PROJECT-1","PROCESS-1","STEP-1","ACTOR-1","USER","SAVE",
            Set.of("USER","PUBLIC"),"ACCOUNT-1","TENANT-1",false))
            .thenReturn(expected);

        ResponseEntity<?> response=controller.find(
            "/emission/workspace","PAGE-1","PROJECT-1","PROCESS-1","STEP-1","ACTOR-1","USER","SAVE",request);

        assertEquals(200,response.getStatusCode().value());
        assertEquals(expected,response.getBody());
        verify(service).screenContext(
            "/emission/workspace","PAGE-1","PROJECT-1","PROCESS-1","STEP-1","ACTOR-1","USER","SAVE",
            Set.of("USER","PUBLIC"),"ACCOUNT-1","TENANT-1",false);
    }

    @Test
    void rejectsAnonymousRequestsBeforeContractLookup(){
        ActorProcessGovernanceService service=mock(ActorProcessGovernanceService.class);
        CurrentUserContextService users=mock(CurrentUserContextService.class);
        HttpServletRequest request=mock(HttpServletRequest.class);
        CurrentUserContextService.CurrentUserContext user=new CurrentUserContextService.CurrentUserContext();
        user.setAuthenticated(false);
        when(users.resolve(request)).thenReturn(user);
        ScreenContextApiController controller=new ScreenContextApiController(service,users);

        ResponseEntity<?> response=controller.find("/emission/workspace","","","","","","","",request);

        assertEquals(401,response.getStatusCode().value());
        assertEquals("AUTHENTICATION_REQUIRED",((Map<?,?>)response.getBody()).get("message"));
        verifyNoInteractions(service);
    }

    @Test
    void allowsOnlyPublicMetadataForAnAnonymousJoinRoute(){
        ActorProcessGovernanceService service=mock(ActorProcessGovernanceService.class);
        CurrentUserContextService users=mock(CurrentUserContextService.class);
        HttpServletRequest request=mock(HttpServletRequest.class);
        CurrentUserContextService.CurrentUserContext user=new CurrentUserContextService.CurrentUserContext();
        user.setAuthenticated(false);
        when(users.resolve(request)).thenReturn(user);
        Map<String,Object> expected=Map.of(
            "classification","INFORMATIONAL",
            "identity",Map.of("routeKey","/join/step1"));
        when(service.screenContext(
            "/en/join/step1?ref=public","JOIN-STEP-1","","TERMS_CONSENT","TERMS_CONSENT_S1","PUBLIC_VISITOR",
            "PUBLIC","",Set.of("PUBLIC"),"","",true)).thenReturn(expected);
        ScreenContextApiController controller=new ScreenContextApiController(service,users);

        ResponseEntity<?> response=controller.find(
            "/en/join/step1?ref=public","JOIN-STEP-1","PROJECT-MUST-NOT-LEAK","TERMS_CONSENT",
            "TERMS_CONSENT_S1","PUBLIC_VISITOR","PUBLIC","",request);

        assertEquals(200,response.getStatusCode().value());
        assertEquals(expected,response.getBody());
        verify(service).screenContext(
            "/en/join/step1?ref=public","JOIN-STEP-1","","TERMS_CONSENT","TERMS_CONSENT_S1","PUBLIC_VISITOR",
            "PUBLIC","",Set.of("PUBLIC"),"","",true);
    }

    @Test
    void keepsAuthenticationRequiredForExcludedAnonymousRoutes(){
        ActorProcessGovernanceService service=mock(ActorProcessGovernanceService.class);
        CurrentUserContextService users=mock(CurrentUserContextService.class);
        HttpServletRequest request=mock(HttpServletRequest.class);
        CurrentUserContextService.CurrentUserContext user=new CurrentUserContextService.CurrentUserContext();
        user.setAuthenticated(false);
        when(users.resolve(request)).thenReturn(user);
        ScreenContextApiController controller=new ScreenContextApiController(service,users);

        for(String route:List.of("/signin","/join/find-password","/join/step1/print","/login")){
            ResponseEntity<?> response=controller.find(route,"","","","","","PUBLIC","",request);
            assertEquals(401,response.getStatusCode().value(),route);
        }
        verifyNoInteractions(service);
    }

    @Test
    void hidesInternalResolutionErrors(){
        ActorProcessGovernanceService service=mock(ActorProcessGovernanceService.class);
        CurrentUserContextService users=mock(CurrentUserContextService.class);
        HttpServletRequest request=mock(HttpServletRequest.class);
        CurrentUserContextService.CurrentUserContext user=new CurrentUserContextService.CurrentUserContext();
        user.setAuthenticated(true);
        user.setUserId("ACCOUNT-1");
        user.setInsttId("TENANT-1");
        when(users.resolve(request)).thenReturn(user);
        when(service.screenContext("/emission/workspace","","","","","","","",Set.of("USER","PUBLIC"),
            "ACCOUNT-1","TENANT-1",false))
            .thenThrow(new IllegalStateException("sensitive database detail"));
        ScreenContextApiController controller=new ScreenContextApiController(service,users);

        ResponseEntity<?> response=controller.find("/emission/workspace","","","","","","","",request);

        assertEquals(500,response.getStatusCode().value());
        assertEquals("SCREEN_CONTEXT_RESOLUTION_FAILED",((Map<?,?>)response.getBody()).get("message"));
    }

    @Test
    void forbidsAdminAudienceForOrdinaryUsersWithoutContractLookup(){
        ActorProcessGovernanceService service=mock(ActorProcessGovernanceService.class);
        CurrentUserContextService users=mock(CurrentUserContextService.class);
        HttpServletRequest request=mock(HttpServletRequest.class);
        CurrentUserContextService.CurrentUserContext user=new CurrentUserContextService.CurrentUserContext();
        user.setAuthenticated(true);
        user.setAuthorCode("ROLE_USER");
        when(users.resolve(request)).thenReturn(user);
        ScreenContextApiController controller=new ScreenContextApiController(service,users);

        ResponseEntity<?> response=controller.find(
            "/admin/emission/workspace","","","","","","ADMIN","",request);

        assertEquals(403,response.getStatusCode().value());
        assertEquals("SCREEN_CONTEXT_AUDIENCE_FORBIDDEN",((Map<?,?>)response.getBody()).get("message"));
        verifyNoInteractions(service);
    }

    @Test
    void returnsGenericForbiddenWhenTheRequestedActorIsOutsideTheAccountScope(){
        ActorProcessGovernanceService service=mock(ActorProcessGovernanceService.class);
        CurrentUserContextService users=mock(CurrentUserContextService.class);
        HttpServletRequest request=mock(HttpServletRequest.class);
        CurrentUserContextService.CurrentUserContext user=new CurrentUserContextService.CurrentUserContext();
        user.setAuthenticated(true);
        user.setUserId("ACCOUNT-1");
        user.setInsttId("TENANT-1");
        when(users.resolve(request)).thenReturn(user);
        when(service.screenContext("/emission/workspace","","PROJECT-1","","","VERIFIER","USER","",
            Set.of("USER","PUBLIC"),"ACCOUNT-1","TENANT-1",false))
            .thenThrow(new SecurityException("internal assignment detail"));
        ScreenContextApiController controller=new ScreenContextApiController(service,users);

        ResponseEntity<?> response=controller.find(
            "/emission/workspace","","PROJECT-1","","","VERIFIER","USER","",request);

        assertEquals(403,response.getStatusCode().value());
        assertEquals("SCREEN_CONTEXT_ACTOR_FORBIDDEN",((Map<?,?>)response.getBody()).get("message"));
    }
}
