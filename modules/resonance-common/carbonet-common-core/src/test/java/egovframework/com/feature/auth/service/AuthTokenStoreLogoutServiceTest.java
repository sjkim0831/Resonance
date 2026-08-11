package egovframework.com.feature.auth.service;

import egovframework.com.feature.auth.mapper.AuthLoginMapper;
import egovframework.com.feature.auth.util.JwtTokenProvider;
import io.jsonwebtoken.Claims;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthTokenStoreLogoutServiceTest {

    private AuthLoginMapper mapper;
    private JwtTokenProvider provider;
    private AuthTokenStoreService service;

    @BeforeEach
    void setUp() {
        mapper = mock(AuthLoginMapper.class);
        provider = mock(JwtTokenProvider.class);
        service = new AuthTokenStoreService(mapper, provider, mock(CredentialMutationLockService.class));
    }

    @Test
    void accessOnlyLogoutRevokesTheBoundCanonicalUser() {
        bindAccess("access", "member01");
        when(mapper.deleteAuthTokenByUserId("member01")).thenReturn(1);

        assertEquals(AuthTokenStoreService.LogoutRevocationResult.REVOKED,
                service.revokeLogoutTokens("access", ""));
        verify(mapper).deleteAuthTokenByUserId("member01");
    }

    @Test
    void normalRefreshLogoutRevokesExactlyOneBoundRow() {
        bindRefresh("refresh", "member01");
        when(mapper.deleteAuthTokenByUserId("member01")).thenReturn(1);

        assertEquals(AuthTokenStoreService.LogoutRevocationResult.REVOKED,
                service.revokeLogoutTokens("", "refresh"));
        verify(mapper).deleteAuthTokenByUserId("member01");
    }

    @Test
    void staleRefreshCannotSelectAnAccountForRevocation() {
        Claims claims = claims("encoded-member01");
        when(provider.refreshExtractClaims("stale-refresh")).thenReturn(claims);
        when(provider.decrypt("encoded-member01")).thenReturn("member01");
        when(mapper.selectActiveAuthToken("member01")).thenReturn(tokenRow("member01"));
        when(provider.tokenHashMatches("refresh-hash", "stale-refresh")).thenReturn(false);

        assertEquals(AuthTokenStoreService.LogoutRevocationResult.INVALID_OR_MISSING_TOKEN,
                service.revokeLogoutTokens("", "stale-refresh"));
        verify(mapper, never()).deleteAuthTokenByUserId(anyString());
    }

    @Test
    void databaseFailureFailsClosed() {
        Claims claims = claims("encoded-member01");
        when(provider.accessExtractClaims("access")).thenReturn(claims);
        when(provider.decrypt("encoded-member01")).thenReturn("member01");
        when(mapper.selectActiveAuthToken("member01"))
                .thenThrow(new DataAccessResourceFailureException("offline"));

        assertThrows(IllegalStateException.class, () -> service.revokeLogoutTokens("access", ""));
        verify(mapper, never()).deleteAuthTokenByUserId(anyString());
    }

    @Test
    void zeroDeletedRowsFailsClosed() {
        bindAccess("access", "member01");
        when(mapper.deleteAuthTokenByUserId("member01")).thenReturn(0);

        assertThrows(IllegalStateException.class, () -> service.revokeLogoutTokens("access", ""));
    }

    private void bindAccess(String token, String userId) {
        Claims claims = claims("encoded-" + userId);
        when(provider.accessExtractClaims(token)).thenReturn(claims);
        when(provider.decrypt("encoded-" + userId)).thenReturn(userId);
        when(mapper.selectActiveAuthToken(userId)).thenReturn(tokenRow(userId));
        when(provider.tokenHashMatches("access-hash", token)).thenReturn(true);
    }

    private void bindRefresh(String token, String userId) {
        Claims claims = claims("encoded-" + userId);
        when(provider.refreshExtractClaims(token)).thenReturn(claims);
        when(provider.decrypt("encoded-" + userId)).thenReturn(userId);
        when(mapper.selectActiveAuthToken(userId)).thenReturn(tokenRow(userId));
        when(provider.tokenHashMatches("refresh-hash", token)).thenReturn(true);
    }

    private Claims claims(String encodedUserId) {
        Claims claims = mock(Claims.class);
        when(claims.get("userId")).thenReturn(encodedUserId);
        return claims;
    }

    private Map<String, Object> tokenRow(String userId) {
        return Map.of(
                "userId", userId,
                "accessTokenHash", "access-hash",
                "refreshTokenHash", "refresh-hash");
    }
}
