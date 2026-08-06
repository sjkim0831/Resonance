package egovframework.com.feature.home.web;

import egovframework.com.feature.auth.service.CurrentUserContextService;
import egovframework.com.feature.home.service.EmissionProjectRegistryService;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
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
}
