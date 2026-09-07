package egovframework.com.feature.auth.service;

import egovframework.com.feature.auth.util.JwtTokenProvider;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthenticationExposureRollbackGuardTest {

    private JwtTokenProvider provider;
    private AuthenticationExposureRollbackGuard guard;
    private HttpServletRequest request;
    private HttpServletResponse response;
    private HttpSession session;

    @BeforeEach
    void setUp() {
        provider = mock(JwtTokenProvider.class);
        guard = new AuthenticationExposureRollbackGuard(provider);
        request = mock(HttpServletRequest.class);
        response = mock(HttpServletResponse.class);
        session = mock(HttpSession.class);
        when(request.getSession(false)).thenReturn(session);
    }

    @AfterEach
    void tearDown() {
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.clearSynchronization();
        }
        SecurityContextHolder.clearContext();
    }

    @Test
    void commitTimeRollbackClearsContextInvalidatesSessionAndDeletesCookies() {
        TransactionSynchronizationManager.initSynchronization();
        SecurityContextHolder.getContext().setAuthentication(
                new UsernamePasswordAuthenticationToken("member01", "credential"));
        guard.register(request, response);

        TransactionSynchronization synchronization =
                TransactionSynchronizationManager.getSynchronizations().get(0);
        synchronization.afterCompletion(TransactionSynchronization.STATUS_ROLLED_BACK);

        assertFalse(SecurityContextHolder.getContext().getAuthentication() != null);
        verify(session).invalidate();
        verify(response).setHeader(HttpHeaders.SET_COOKIE, "");
        verify(provider).deleteCookie(request, response, "accessToken");
        verify(provider).deleteCookie(request, response, "refreshToken");
    }

    @Test
    void successfulCommitPreservesAuthenticationExposure() {
        TransactionSynchronizationManager.initSynchronization();
        guard.register(request, response);

        TransactionSynchronization synchronization =
                TransactionSynchronizationManager.getSynchronizations().get(0);
        synchronization.afterCompletion(TransactionSynchronization.STATUS_COMMITTED);

        verify(session, never()).invalidate();
        verify(response, never()).setHeader(HttpHeaders.SET_COOKIE, "");
        verify(provider, never()).deleteCookie(request, response, "accessToken");
        verify(provider, never()).deleteCookie(request, response, "refreshToken");
    }

    @Test
    void exposureWithoutTransactionSynchronizationFailsClosed() {
        assertThrows(IllegalStateException.class, () -> guard.register(request, response));
    }
}
