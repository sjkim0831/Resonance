package egovframework.com.feature.home.web;

import egovframework.com.feature.auth.service.CurrentUserContextService;
import egovframework.com.feature.home.service.EmissionProjectRegistryService;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.server.ResponseStatusException;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class EmissionProjectRegistryControllerAuthenticationTest {

    @Test
    void anonymousPortfolioApiFailsBeforeAnyProjectLookup() {
        EmissionProjectRegistryService projects = mock(EmissionProjectRegistryService.class);
        CurrentUserContextService users = mock(CurrentUserContextService.class);
        HttpServletRequest request = mock(HttpServletRequest.class);
        CurrentUserContextService.CurrentUserContext context = new CurrentUserContextService.CurrentUserContext();
        context.setAuthenticated(false);
        when(users.resolve(request)).thenReturn(context);
        when(request.getRequestURI()).thenReturn("/home/api/emission-projects");
        EmissionProjectRegistryController controller = new EmissionProjectRegistryController(projects, users);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> controller.enforceAuthenticatedTenant(request));

        assertEquals(HttpStatus.UNAUTHORIZED, error.getStatusCode());
        assertEquals("AUTHENTICATION_REQUIRED", error.getReason());
    }

    @Test
    void authenticatedActorCanReadOneActivityThroughScopedService() {
        EmissionProjectRegistryService projects = mock(EmissionProjectRegistryService.class);
        CurrentUserContextService users = mock(CurrentUserContextService.class);
        HttpServletRequest request = mock(HttpServletRequest.class);
        CurrentUserContextService.CurrentUserContext context = authenticatedContext();
        when(users.resolve(request)).thenReturn(context);
        when(projects.activity("PRJ-1", 7L, "TENANT-1", "data.owner", false))
                .thenReturn(Map.of("id", 7L, "name", "전력 사용량"));
        EmissionProjectRegistryController controller = new EmissionProjectRegistryController(projects, users);

        ResponseEntity<?> response = controller.activity("PRJ-1", 7L, request);

        assertEquals(HttpStatus.OK, response.getStatusCode());
        verify(projects).activity("PRJ-1", 7L, "TENANT-1", "data.owner", false);
    }

    @Test
    void activityDeleteDependencyConflictIsReportedWithoutDeleting() {
        EmissionProjectRegistryService projects = mock(EmissionProjectRegistryService.class);
        CurrentUserContextService users = mock(CurrentUserContextService.class);
        HttpServletRequest request = mock(HttpServletRequest.class);
        CurrentUserContextService.CurrentUserContext context = authenticatedContext();
        when(users.resolve(request)).thenReturn(context);
        when(projects.deleteActivity("PRJ-1", 7L, "TENANT-1", "data.owner", false))
                .thenThrow(new IllegalStateException("ACTIVITY_DELETE_BLOCKED_BY_DEPENDENCY"));
        EmissionProjectRegistryController controller = new EmissionProjectRegistryController(projects, users);

        ResponseEntity<?> response = controller.deleteActivity("PRJ-1", 7L, request);

        assertEquals(HttpStatus.CONFLICT, response.getStatusCode());
        verify(projects).deleteActivity("PRJ-1", 7L, "TENANT-1", "data.owner", false);
    }

    @Test
    void anonymousActorCannotMutateOneActivity() {
        EmissionProjectRegistryService projects = mock(EmissionProjectRegistryService.class);
        CurrentUserContextService users = mock(CurrentUserContextService.class);
        HttpServletRequest request = mock(HttpServletRequest.class);
        CurrentUserContextService.CurrentUserContext context = new CurrentUserContextService.CurrentUserContext();
        when(users.resolve(request)).thenReturn(context);
        EmissionProjectRegistryController controller = new EmissionProjectRegistryController(projects, users);

        ResponseEntity<?> response = controller.updateActivity("PRJ-1", 7L, Map.of(), request);

        assertEquals(HttpStatus.UNAUTHORIZED, response.getStatusCode());
    }

    private CurrentUserContextService.CurrentUserContext authenticatedContext() {
        CurrentUserContextService.CurrentUserContext context = new CurrentUserContextService.CurrentUserContext();
        context.setAuthenticated(true);
        context.setUserId("data.owner");
        context.setInsttId("TENANT-1");
        return context;
    }
}
