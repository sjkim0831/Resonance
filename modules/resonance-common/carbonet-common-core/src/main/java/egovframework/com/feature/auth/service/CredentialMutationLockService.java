package egovframework.com.feature.auth.service;

import egovframework.com.feature.auth.mapper.AuthLoginMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.util.StringUtils;

import java.util.Objects;
import java.util.function.Supplier;

/**
 * Serializes credential validation/token issuance and credential replacement for
 * one canonical user id across every application pod.
 */
@Service
@RequiredArgsConstructor
public class CredentialMutationLockService {

    private final AuthLoginMapper authLoginMapper;

    @Transactional(rollbackFor = Exception.class)
    public <T> T executeLocked(String userId, Supplier<T> action) {
        Objects.requireNonNull(action, "Locked credential action is required");
        acquire(userId);
        return action.get();
    }

    @Transactional(rollbackFor = Exception.class)
    public void executeLocked(String userId, Runnable action) {
        Objects.requireNonNull(action, "Locked credential action is required");
        acquire(userId);
        action.run();
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public void acquireInCurrentTransaction(String userId) {
        acquire(userId);
    }

    private void acquire(String userId) {
        String canonicalUserId = userId == null ? "" : userId.trim().toLowerCase(java.util.Locale.ROOT);
        if (!StringUtils.hasText(canonicalUserId)) {
            throw new IllegalArgumentException("Canonical user id is required for credential mutation lock");
        }
        if (!TransactionSynchronizationManager.isActualTransactionActive()) {
            throw new IllegalStateException("Credential mutation lock requires an active transaction");
        }
        Integer acquired = authLoginMapper.acquireCredentialMutationLock(canonicalUserId);
        if (!Integer.valueOf(1).equals(acquired)) {
            throw new IllegalStateException("Credential mutation lock was not acquired");
        }
    }
}
