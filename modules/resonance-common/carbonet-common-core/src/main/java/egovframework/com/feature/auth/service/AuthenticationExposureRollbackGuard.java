package egovframework.com.feature.auth.service;

import egovframework.com.feature.auth.util.JwtTokenProvider;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.util.Objects;

/**
 * Removes every browser and server authentication trace when token issuance
 * reaches a commit-time rollback after authentication exposure has begun.
 */
@Service
@RequiredArgsConstructor
public class AuthenticationExposureRollbackGuard {

    private final JwtTokenProvider jwtTokenProvider;

    public void register(HttpServletRequest request, HttpServletResponse response) {
        Objects.requireNonNull(request, "Authentication request is required");
        Objects.requireNonNull(response, "Authentication response is required");
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            throw new IllegalStateException("Authentication exposure requires transaction synchronization");
        }
        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCompletion(int status) {
                if (status == TransactionSynchronization.STATUS_COMMITTED) {
                    return;
                }
                SecurityContextHolder.clearContext();
                try {
                    HttpSession session = request.getSession(false);
                    if (session != null) {
                        session.invalidate();
                    }
                } finally {
                    response.setHeader(HttpHeaders.SET_COOKIE, "");
                    jwtTokenProvider.deleteCookie(request, response, "accessToken");
                    jwtTokenProvider.deleteCookie(request, response, "refreshToken");
                }
            }
        });
    }
}
