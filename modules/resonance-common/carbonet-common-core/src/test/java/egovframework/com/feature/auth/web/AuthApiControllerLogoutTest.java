package egovframework.com.feature.auth.web;

import egovframework.com.feature.auth.service.AccountRecoveryService;
import egovframework.com.feature.auth.service.AuthenticationExposureRollbackGuard;
import egovframework.com.feature.auth.service.AuthService;
import egovframework.com.feature.auth.service.AuthTokenStoreService;
import egovframework.com.feature.auth.service.CurrentUserContextService;
import egovframework.com.feature.auth.service.CredentialMutationLockService;
import egovframework.com.feature.auth.util.JwtTokenProvider;
import egovframework.com.platform.observability.service.AdminLoginHistoryService;
import org.egovframe.boot.security.bean.EgovReloadableFilterInvocationSecurityMetadataSource;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.context.support.ReloadableResourceBundleMessageSource;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.context.SecurityContextHolder;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthApiControllerLogoutTest {

    private JwtTokenProvider provider;
    private AuthTokenStoreService tokenStore;
    private AuthApiController controller;

    @BeforeEach
    void setUp() {
        provider = mock(JwtTokenProvider.class);
        tokenStore = mock(AuthTokenStoreService.class);
        controller = new AuthApiController(
                mock(AuthService.class),
                mock(AdminLoginHistoryService.class),
                provider,
                tokenStore,
                mock(AccountRecoveryService.class),
                mock(CurrentUserContextService.class),
                mock(ReloadableResourceBundleMessageSource.class),
                mock(CredentialMutationLockService.class),
                mock(AuthenticationExposureRollbackGuard.class),
                mock(EgovReloadableFilterInvocationSecurityMetadataSource.class));
    }

    @AfterEach
    void clearSecurityContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void accessOnlyLogoutRevokesAndClearsBothCookies() {
        HttpServletRequest request = request("access", "");
        HttpServletResponse response = mock(HttpServletResponse.class);
        when(tokenStore.revokeLogoutTokens("access", ""))
                .thenReturn(AuthTokenStoreService.LogoutRevocationResult.REVOKED);

        ResponseEntity<?> result = controller.actionLogout(request, response);

        assertEquals(200, result.getStatusCode().value());
        assertEquals("success", body(result).get("status"));
        verify(provider).deleteCookie(request, response, "accessToken");
        verify(provider).deleteCookie(request, response, "refreshToken");
    }

    @Test
    void normalRefreshLogoutRevokesAndReturnsSuccess() {
        HttpServletRequest request = request("access", "refresh");
        HttpServletResponse response = mock(HttpServletResponse.class);
        when(tokenStore.revokeLogoutTokens("access", "refresh"))
                .thenReturn(AuthTokenStoreService.LogoutRevocationResult.REVOKED);

        ResponseEntity<?> result = controller.actionLogout(request, response);

        assertEquals(200, result.getStatusCode().value());
    }

    @Test
    void staleRefreshFailsClosedButStillClearsCookies() {
        HttpServletRequest request = request("", "stale");
        HttpServletResponse response = mock(HttpServletResponse.class);
        when(tokenStore.revokeLogoutTokens("", "stale"))
                .thenReturn(AuthTokenStoreService.LogoutRevocationResult.INVALID_OR_MISSING_TOKEN);

        ResponseEntity<?> result = controller.actionLogout(request, response);

        assertEquals(401, result.getStatusCode().value());
        assertEquals("INVALID_OR_STALE_LOGOUT_TOKEN", body(result).get("error"));
        verify(provider).deleteCookie(request, response, "accessToken");
        verify(provider).deleteCookie(request, response, "refreshToken");
    }

    @Test
    void databaseFailureReturns503ButStillClearsCookies() {
        HttpServletRequest request = request("access", "refresh");
        HttpServletResponse response = mock(HttpServletResponse.class);
        when(tokenStore.revokeLogoutTokens("access", "refresh"))
                .thenThrow(new IllegalStateException("offline"));

        ResponseEntity<?> result = controller.actionLogout(request, response);

        assertEquals(503, result.getStatusCode().value());
        assertEquals("TOKEN_REVOCATION_UNAVAILABLE", body(result).get("error"));
        verify(provider).deleteCookie(request, response, "accessToken");
        verify(provider).deleteCookie(request, response, "refreshToken");
    }

    private HttpServletRequest request(String accessToken, String refreshToken) {
        HttpServletRequest request = mock(HttpServletRequest.class);
        when(request.getMethod()).thenReturn("POST");
        when(request.getRequestURI()).thenReturn("/signin/actionLogout");
        when(provider.getCookie(request, "accessToken")).thenReturn(accessToken);
        when(provider.getCookie(request, "refreshToken")).thenReturn(refreshToken);
        return request;
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> body(ResponseEntity<?> response) {
        return (Map<String, Object>) response.getBody();
    }
}
