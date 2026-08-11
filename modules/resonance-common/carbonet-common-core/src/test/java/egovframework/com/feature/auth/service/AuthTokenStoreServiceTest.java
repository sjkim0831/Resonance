package egovframework.com.feature.auth.service;

import egovframework.com.feature.auth.mapper.AuthLoginMapper;
import egovframework.com.feature.auth.util.JwtTokenProvider;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.transaction.annotation.Transactional;

import java.lang.reflect.Method;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class AuthTokenStoreServiceTest {

    private AuthLoginMapper mapper;
    private JwtTokenProvider provider;
    private CredentialMutationLockService credentialMutationLockService;
    private AuthTokenStoreService service;

    @BeforeEach
    void setUp() {
        mapper = mock(AuthLoginMapper.class);
        provider = mock(JwtTokenProvider.class);
        credentialMutationLockService = mock(CredentialMutationLockService.class);
        service = new AuthTokenStoreService(mapper, provider, credentialMutationLockService);
        when(provider.generateTokenHash(anyString())).thenAnswer(invocation -> "hash-" + invocation.getArgument(0));
    }

    @Test
    void loginPersistenceIsTransactionalAndRequiresOneInsertedRow() throws Exception {
        Method method = AuthTokenStoreService.class.getMethod("saveLoginToken", String.class, String.class,
                String.class, String.class, long.class, HttpServletRequest.class);
        assertTrue(method.isAnnotationPresent(Transactional.class));

        when(mapper.insertAuthToken(any())).thenReturn(0);
        assertThrows(IllegalStateException.class,
                () -> service.saveLoginToken("member01", "USR", "access", "refresh", 60_000L, null));
    }

    @Test
    void loginPersistenceRejectsIncompleteCredentialsBeforeWriting() {
        assertThrows(IllegalArgumentException.class,
                () -> service.saveLoginToken("member01", "USR", "", "refresh", 60_000L, null));
        verify(mapper, never()).deleteAuthTokenByUserId(anyString());
        verify(mapper, never()).insertAuthToken(any());
    }

    @Test
    void loginPersistenceStoresBothHashesBeforeSessionCanBeIssued() {
        when(mapper.insertAuthToken(any())).thenReturn(1);
        service.saveLoginToken("member01", "USR", "access", "refresh", 60_000L, null);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> captor = ArgumentCaptor.forClass(Map.class);
        verify(mapper).insertAuthToken(captor.capture());
        assertTrue("hash-access".equals(captor.getValue().get("accessTokenHash")));
        assertTrue("hash-refresh".equals(captor.getValue().get("refreshTokenHash")));
    }

    @Test
    void loginPersistencePropagatesDatabaseFailure() {
        when(mapper.insertAuthToken(any()))
                .thenThrow(new DataAccessResourceFailureException("store unavailable"));
        assertThrows(DataAccessResourceFailureException.class,
                () -> service.saveLoginToken("member01", "USR", "access", "refresh", 60_000L, null));
    }

    @Test
    void refreshValidationFailsClosedOnDatabaseFailure() {
        when(mapper.selectActiveAuthToken("member01"))
                .thenThrow(new DataAccessResourceFailureException("store unavailable"));

        assertFalse(service.isRefreshTokenAccepted("member01", "refresh"));
    }

    @Test
    void refreshValidationUsesTheConstantTimeHashMatcher() {
        when(mapper.selectActiveAuthToken("member01"))
                .thenReturn(Map.of("refreshTokenHash", "expected", "tokenKey", "key"));
        when(provider.tokenHashMatches("expected", "refresh")).thenReturn(true);
        when(mapper.touchAuthToken("key")).thenReturn(1);

        assertTrue(service.isRefreshTokenAccepted("member01", "refresh"));
        verify(mapper).touchAuthToken("key");
    }

    @Test
    void refreshValidationRejectsRowDeletedBetweenReadAndTouch() {
        when(mapper.selectActiveAuthToken("member01"))
                .thenReturn(Map.of("refreshTokenHash", "expected", "tokenKey", "key"));
        when(provider.tokenHashMatches("expected", "refresh")).thenReturn(true);
        when(mapper.touchAuthToken("key")).thenReturn(0);

        assertFalse(service.isRefreshTokenAccepted("member01", "refresh"));
    }

    @Test
    void refreshRotationLocksValidatesAndUpdatesTheSameRowTransactionally() throws Exception {
        Method method = AuthTokenStoreService.class.getMethod("rotateLoginToken", String.class, String.class,
                String.class, String.class, String.class, long.class, HttpServletRequest.class);
        assertTrue(method.isAnnotationPresent(Transactional.class));

        when(mapper.selectActiveAuthTokenForUpdate("member01")).thenReturn(Map.of(
                "userSe", "USR", "refreshTokenHash", "expected", "tokenKey", "old-key"));
        when(provider.tokenHashMatches("expected", "old-refresh")).thenReturn(true);
        when(mapper.rotateAuthToken(any())).thenReturn(1);

        assertTrue(service.rotateLoginToken("member01", "", "old-refresh", "new-access", "new-refresh",
                60_000L, null));

        @SuppressWarnings("unchecked")
        ArgumentCaptor<Map<String, Object>> captor = ArgumentCaptor.forClass(Map.class);
        verify(mapper).rotateAuthToken(captor.capture());
        assertEquals("old-key", captor.getValue().get("currentTokenKey"));
        assertEquals("hash-new-access", captor.getValue().get("accessTokenHash"));
        assertEquals("hash-new-refresh", captor.getValue().get("refreshTokenHash"));
        assertEquals("USR", captor.getValue().get("userSe"));
    }

    @Test
    void refreshRotationRejectsARecoveryDeletedRowWithoutReinsert() {
        when(mapper.selectActiveAuthTokenForUpdate("member01")).thenReturn(null);

        assertFalse(service.rotateLoginToken("member01", "USR", "old-refresh", "new-access", "new-refresh",
                60_000L, null));
        verify(mapper, never()).rotateAuthToken(any());
        verify(mapper, never()).insertAuthToken(any());
    }

    @Test
    void refreshRotationRejectsStaleHashWithoutMutation() {
        when(mapper.selectActiveAuthTokenForUpdate("member01")).thenReturn(Map.of(
                "userSe", "USR", "refreshTokenHash", "expected", "tokenKey", "old-key"));
        when(provider.tokenHashMatches("expected", "stale-refresh")).thenReturn(false);

        assertFalse(service.rotateLoginToken("member01", "USR", "stale-refresh", "new-access", "new-refresh",
                60_000L, null));
        verify(mapper, never()).rotateAuthToken(any());
    }

    @Test
    void refreshRotationPropagatesDatabaseFailureAndNeverReinserts() {
        when(mapper.selectActiveAuthTokenForUpdate("member01"))
                .thenThrow(new DataAccessResourceFailureException("store unavailable"));

        assertThrows(DataAccessResourceFailureException.class,
                () -> service.rotateLoginToken("member01", "USR", "old-refresh", "new-access", "new-refresh",
                        60_000L, null));
        verify(mapper, never()).insertAuthToken(any());
    }
}
