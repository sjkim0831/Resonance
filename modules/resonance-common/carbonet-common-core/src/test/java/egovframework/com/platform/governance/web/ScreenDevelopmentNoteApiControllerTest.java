package egovframework.com.platform.governance.web;

import egovframework.com.feature.auth.service.CurrentUserContextService;
import egovframework.com.platform.governance.service.ScreenDevelopmentNoteService;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.http.ResponseEntity;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class ScreenDevelopmentNoteApiControllerTest {
    @Test
    void servesEveryDesignOperationForAnAuthenticatedSessionWithoutAServletPrincipal(){
        ScreenDevelopmentNoteService service=mock(ScreenDevelopmentNoteService.class);
        CurrentUserContextService users=mock(CurrentUserContextService.class);
        HttpServletRequest request=mock(HttpServletRequest.class);
        CurrentUserContextService.CurrentUserContext user=new CurrentUserContextService.CurrentUserContext();
        user.setAuthenticated(true);
        user.setUserId("sjkim");
        when(users.resolve(request)).thenReturn(user);
        Map<String,Object> body=Map.of("routePath","/emission/project_list");
        when(service.find("/emission/project_list")).thenReturn(Map.of("success",true,"operation","find"));
        when(service.save(body,"sjkim")).thenReturn(Map.of("success",true,"operation","save"));
        when(service.saveMockup(2,body,"sjkim")).thenReturn(Map.of("success",true,"operation","mockup"));
        when(service.selectMockup(2,body,"sjkim")).thenReturn(Map.of("success",true,"operation","select"));
        ScreenDevelopmentNoteApiController controller=new ScreenDevelopmentNoteApiController(service,users);

        List<ResponseEntity<?>> responses=List.of(
            controller.find("/emission/project_list",request),
            controller.save(body,request),
            controller.saveMockup(2,body,request),
            controller.selectMockup(2,body,request));

        responses.forEach(response->assertEquals(200,response.getStatusCode().value()));
        verify(service).find("/emission/project_list");
        verify(service).save(body,"sjkim");
        verify(service).saveMockup(2,body,"sjkim");
        verify(service).selectMockup(2,body,"sjkim");
    }

    @Test
    void rejectsEveryDesignOperationForAnAnonymousSession(){
        ScreenDevelopmentNoteService service=mock(ScreenDevelopmentNoteService.class);
        CurrentUserContextService users=mock(CurrentUserContextService.class);
        HttpServletRequest request=mock(HttpServletRequest.class);
        CurrentUserContextService.CurrentUserContext user=new CurrentUserContextService.CurrentUserContext();
        user.setAuthenticated(false);
        when(users.resolve(request)).thenReturn(user);
        Map<String,Object> body=Map.of("routePath","/emission/project_list");
        ScreenDevelopmentNoteApiController controller=new ScreenDevelopmentNoteApiController(service,users);

        List<ResponseEntity<?>> responses=List.of(
            controller.find("/emission/project_list",request),
            controller.save(body,request),
            controller.saveMockup(2,body,request),
            controller.selectMockup(2,body,request));

        responses.forEach(response->assertEquals(401,response.getStatusCode().value()));
        verifyNoInteractions(service);
    }
}
