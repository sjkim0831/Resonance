package egovframework.com.feature.auth.service;

import egovframework.com.common.context.ProjectRuntimeContext;
import egovframework.com.feature.auth.domain.repository.EmployeeMemberRepository;
import egovframework.com.feature.auth.domain.repository.EnterpriseMemberRepository;
import egovframework.com.feature.auth.util.JwtTokenProvider;
import egovframework.com.platform.codex.service.AuthGroupManageService;
import io.jsonwebtoken.Claims;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.doAnswer;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CurrentUserContextServiceAccessValidationTest {

    private JwtTokenProvider provider;
    private AuthGroupManageService authGroups;
    private CurrentUserContextService service;
    private HttpServletRequest request;

    @BeforeEach
    void setUp() {
        provider = mock(JwtTokenProvider.class);
        authGroups = mock(AuthGroupManageService.class);
        EmployeeMemberRepository employees = mock(EmployeeMemberRepository.class);
        EnterpriseMemberRepository enterprises = mock(EnterpriseMemberRepository.class);
        ProjectRuntimeContext project = mock(ProjectRuntimeContext.class);
        Environment environment = mock(Environment.class);
        when(environment.acceptsProfiles(any(Profiles.class))).thenReturn(false);
        service = new CurrentUserContextService(
                provider, authGroups, employees, enterprises, project, environment);

        request = statefulRequest();
        when(provider.getCookie(request, "accessToken")).thenReturn("access-token");
    }

    @Test
    void deletedTokenStoreRowProducesAnonymousContextAndCachesFailure() {
        when(provider.accessValidateToken("access-token")).thenReturn(401);

        assertAnonymous(service.resolve(request));
        assertAnonymous(service.resolve(request));

        verify(provider, times(1)).accessValidateToken("access-token");
        verify(provider, never()).accessExtractClaims(anyString());
    }

    @Test
    void tokenStoreOutageProducesAnonymousContextAndCachesFailure() {
        when(provider.accessValidateToken("access-token")).thenReturn(503);

        assertAnonymous(service.resolve(request));
        assertAnonymous(service.resolve(request));

        verify(provider, times(1)).accessValidateToken("access-token");
        verify(provider, never()).accessExtractClaims(anyString());
    }

    @Test
    void unexpectedValidationFailureAlsoFailsClosed() {
        when(provider.accessValidateToken("access-token")).thenThrow(new IllegalStateException("store unavailable"));

        assertAnonymous(service.resolve(request));
        assertAnonymous(service.resolve(request));

        verify(provider, times(1)).accessValidateToken("access-token");
    }

    @Test
    void missingCookieRemainsAnonymousWithoutTokenParsing() {
        when(provider.getCookie(request, "accessToken")).thenReturn("");

        assertAnonymous(service.resolve(request));
        assertAnonymous(service.resolve(request));

        verify(provider, never()).accessValidateToken(anyString());
        verify(provider, never()).accessExtractClaims(anyString());
    }

    @Test
    void validPersistedTokenIsCheckedOncePerRequestThenResolvesIdentity() throws Exception {
        Claims claims = mock(Claims.class);
        when(provider.accessValidateToken("access-token")).thenReturn(200);
        when(provider.accessExtractClaims("access-token")).thenReturn(claims);
        when(claims.get("userId")).thenReturn("encrypted-webmaster");
        when(provider.decrypt("encrypted-webmaster")).thenReturn("webmaster");
        when(authGroups.selectAuthorFeatureCodes("ROLE_SYSTEM_MASTER")).thenReturn(List.of());

        CurrentUserContextService.CurrentUserContext first = service.resolve(request);
        CurrentUserContextService.CurrentUserContext second = service.resolve(request);

        assertTrue(first.isAuthenticated());
        assertEquals("webmaster", first.getActualUserId());
        assertEquals("ROLE_SYSTEM_MASTER", first.getAuthorCode());
        assertTrue(second.isAuthenticated());
        verify(provider, times(1)).accessValidateToken("access-token");
        verify(provider, times(2)).accessExtractClaims("access-token");
    }

    private HttpServletRequest statefulRequest() {
        HttpServletRequest result = mock(HttpServletRequest.class);
        Map<String, Object> attributes = new HashMap<>();
        when(result.getAttribute(anyString())).thenAnswer(invocation -> attributes.get(invocation.getArgument(0)));
        doAnswer(invocation -> {
            attributes.put(invocation.getArgument(0), invocation.getArgument(1));
            return null;
        }).when(result).setAttribute(anyString(), any());
        return result;
    }

    private void assertAnonymous(CurrentUserContextService.CurrentUserContext context) {
        assertFalse(context.isAuthenticated());
        assertEquals("", context.getActualUserId());
        assertEquals("", context.getUserId());
        assertEquals("anonymous", context.getCompanyScope());
    }
}
