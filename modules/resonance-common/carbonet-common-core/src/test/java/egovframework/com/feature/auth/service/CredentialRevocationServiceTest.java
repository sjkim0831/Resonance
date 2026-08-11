package egovframework.com.feature.auth.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.dao.DataAccessResourceFailureException;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CredentialRevocationServiceTest {

    private AuthTokenStoreService tokenStore;
    private JdbcTemplate jdbcTemplate;
    private CredentialRevocationService service;

    @BeforeEach
    void setUp() {
        tokenStore = mock(AuthTokenStoreService.class);
        jdbcTemplate = mock(JdbcTemplate.class);
        service = new CredentialRevocationService(tokenStore, jdbcTemplate);
    }

    @Test
    void revokesPersistedTokenPairBeforeDeletingEveryPrincipalSession() {
        service.revokeAfterPasswordChange("  Account-1  ");

        InOrder ordered = inOrder(tokenStore, jdbcTemplate);
        ordered.verify(tokenStore).revokeAll("Account-1");
        ordered.verify(jdbcTemplate).update(anyString(), eq("Account-1"));
    }

    @Test
    void blankIdentityFailsClosedWithoutMutatingCredentialState() {
        assertThrows(IllegalArgumentException.class, () -> service.revokeAfterPasswordChange("  "));

        verify(tokenStore, never()).revokeAll(anyString());
        verify(jdbcTemplate, never()).update(anyString(), eq(""));
    }

    @Test
    void sessionStoreFailureEscapesSoOwningPasswordTransactionRollsBack() {
        when(jdbcTemplate.update(anyString(), eq("Account-1")))
                .thenThrow(new DataAccessResourceFailureException("session store unavailable"));

        assertThrows(DataAccessResourceFailureException.class,
                () -> service.revokeAfterPasswordChange("Account-1"));
        verify(tokenStore).revokeAll("Account-1");
    }
}
