package egovframework.com.feature.auth.web;

import egovframework.com.feature.home.web.ReactAppViewSupport;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.junit.jupiter.api.Test;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.web.context.HttpSessionSecurityContextRepository;
import org.springframework.ui.Model;

import java.time.Duration;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Stateful controller tests for the result-page session grant. Dependencies
 * unused by these routes are passed as null so optional JWT runtime classes do
 * not have to be instrumented by Mockito.
 */
class AccountRecoveryResultSessionControllerTest {

    @Test
    void resultRouteConsumesGrantAndRefreshRedirects() {
        ReactAppViewSupport react = mock(ReactAppViewSupport.class);
        AuthPageController controller = new AuthPageController(null, null, react);
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpSession session = statefulSession();
        Model model = mock(Model.class);
        when(request.getSession(true)).thenReturn(session);
        when(request.getSession(false)).thenReturn(session);
        when(request.getRequestURI()).thenReturn("/signin/findPassword/result");
        when(react.render(model, "signin-find-password-result", false, false)).thenReturn("react-app");
        AccountRecoveryResultSession.grant(request);

        assertEquals("react-app", controller.findPasswordResult(null, model, request));
        assertEquals("redirect:/signin/findPassword", controller.findPasswordResult(null, model, request));
        verify(react).render(model, "signin-find-password-result", false, false);
    }

    @Test
    void directEnglishResultRouteRedirectsToEnglishRecovery() {
        ReactAppViewSupport react = mock(ReactAppViewSupport.class);
        AuthPageController controller = new AuthPageController(null, null, react);
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getSession(false)).thenReturn(null);
        when(request.getRequestURI()).thenReturn("/en/signin/findPassword/result");

        assertEquals("redirect:/en/signin/findPassword",
                controller.findPasswordResult(null, mock(Model.class), request));
        verify(react, never()).render(any(), anyString(), anyBoolean(), anyBoolean());
    }

    @Test
    void freshGrantCanBeConsumedExactlyOnce() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpSession session = statefulSession();
        when(request.getSession(true)).thenReturn(session);
        when(request.getSession(false)).thenReturn(session);

        AccountRecoveryResultSession.grant(request);

        assertTrue(AccountRecoveryResultSession.consume(request));
        assertFalse(AccountRecoveryResultSession.consume(request));
    }

    @Test
    void missingSessionCannotEnterResultPage() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getSession(false)).thenReturn(null);

        assertFalse(AccountRecoveryResultSession.consume(request));
    }

    @Test
    void expiredGrantIsConsumedButRejected() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpSession session = statefulSession();
        when(request.getSession(false)).thenReturn(session);
        session.setAttribute(AccountRecoveryResultSession.COMPLETED_AT_ATTRIBUTE,
                System.currentTimeMillis() - Duration.ofMinutes(6).toMillis());

        assertFalse(AccountRecoveryResultSession.consume(request));
        assertFalse(AccountRecoveryResultSession.consume(request));
    }

    @Test
    void recoveryCompletionInvalidatesAuthenticatedSessionAndGrantsOnlyFreshAnonymousResultSession() {
        HttpServletRequest request = mock(HttpServletRequest.class);
        HttpSession previous = statefulSession();
        HttpSession fresh = statefulSession();
        when(request.getSession(false)).thenReturn(previous);
        when(request.getSession(true)).thenReturn(fresh);
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("member01", "credential"));
        previous.setAttribute(
                HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY,
                SecurityContextHolder.getContext());

        try {
            AccountRecoveryResultSession.rotateAndGrant(request);

            assertNull(SecurityContextHolder.getContext().getAuthentication());
            verify(previous).invalidate();
            assertNull(fresh.getAttribute(HttpSessionSecurityContextRepository.SPRING_SECURITY_CONTEXT_KEY));
            assertNotNull(fresh.getAttribute(AccountRecoveryResultSession.COMPLETED_AT_ATTRIBUTE));
        } finally {
            SecurityContextHolder.clearContext();
        }
    }

    private HttpSession statefulSession() {
        HttpSession session = mock(HttpSession.class);
        Map<String, Object> attributes = new HashMap<>();
        when(session.getAttribute(anyString())).thenAnswer(invocation -> attributes.get(invocation.getArgument(0)));
        doAnswer(invocation -> {
            attributes.put(invocation.getArgument(0), invocation.getArgument(1));
            return null;
        }).when(session).setAttribute(anyString(), org.mockito.ArgumentMatchers.any());
        doAnswer(invocation -> {
            attributes.remove(invocation.getArgument(0));
            return null;
        }).when(session).removeAttribute(anyString());
        return session;
    }
}
