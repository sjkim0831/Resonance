package egovframework.com.feature.auth.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import org.springframework.security.core.context.SecurityContextHolder;

import java.time.Duration;

/**
 * One-time server-side grant for the account-recovery completion page.
 */
final class AccountRecoveryResultSession {

    static final String COMPLETED_AT_ATTRIBUTE =
            AccountRecoveryResultSession.class.getName() + ".COMPLETED_AT";
    private static final long RESULT_TTL_MILLIS = Duration.ofMinutes(5).toMillis();

    private AccountRecoveryResultSession() {
    }

    static void grant(HttpServletRequest request) {
        request.getSession(true).setAttribute(COMPLETED_AT_ATTRIBUTE, System.currentTimeMillis());
    }

    static void rotateAndGrant(HttpServletRequest request) {
        SecurityContextHolder.clearContext();
        HttpSession previous = request.getSession(false);
        if (previous != null) {
            previous.invalidate();
        }
        grant(request);
    }

    static boolean consume(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session == null) {
            return false;
        }
        Object completedAtValue;
        synchronized (session) {
            completedAtValue = session.getAttribute(COMPLETED_AT_ATTRIBUTE);
            session.removeAttribute(COMPLETED_AT_ATTRIBUTE);
        }
        if (!(completedAtValue instanceof Number completedAt)) {
            return false;
        }
        long age = System.currentTimeMillis() - completedAt.longValue();
        return age >= 0 && age <= RESULT_TTL_MILLIS;
    }
}
