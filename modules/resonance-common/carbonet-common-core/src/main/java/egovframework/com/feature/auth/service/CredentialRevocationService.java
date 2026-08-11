package egovframework.com.feature.auth.service;

import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

/**
 * Central fail-closed revocation contract for every credential mutation.
 *
 * <p>The caller must already own the credential-mutation transaction. Deleting
 * the persisted access/refresh pair and every Spring Session in that same
 * transaction means a password update can never commit while an old credential
 * remains usable.</p>
 */
@Service
@RequiredArgsConstructor
public class CredentialRevocationService {

    private final AuthTokenStoreService authTokenStoreService;
    private final JdbcTemplate jdbcTemplate;

    @Transactional(propagation = Propagation.MANDATORY, rollbackFor = Exception.class)
    public void revokeAfterPasswordChange(String userId) {
        String normalizedUserId = userId == null ? "" : userId.trim();
        if (!StringUtils.hasText(normalizedUserId)) {
            throw new IllegalArgumentException("A user ID is required for credential revocation");
        }

        authTokenStoreService.revokeAll(normalizedUserId);
        jdbcTemplate.update("""
                DELETE FROM SPRING_SESSION
                 WHERE lower(PRINCIPAL_NAME)=lower(?)
                """, normalizedUserId);
    }
}
