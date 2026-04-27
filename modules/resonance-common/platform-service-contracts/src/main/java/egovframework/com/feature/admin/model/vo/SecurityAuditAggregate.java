package egovframework.com.feature.admin.model.vo;

import egovframework.com.common.logging.RequestExecutionLogVO;
import lombok.Getter;

import java.util.Locale;

@Getter
public class SecurityAuditAggregate {

    private long deniedCount;
    private long globalBypassCount;
    private long implicitSelfCount;
    private long mismatchCount;

    public void accept(RequestExecutionLogVO item) {
        String decision = item == null ? "" : safeDecision(item.getCompanyScopeDecision());
        if (decision.startsWith("DENY_")) {
            deniedCount++;
        }
        if ("ALLOW_GLOBAL_NO_CONTEXT".equals(decision)) {
            globalBypassCount++;
        }
        if ("ALLOW_IMPLICIT_SELF".equals(decision)) {
            implicitSelfCount++;
        }
        if ("DENY_COMPANY_MISMATCH".equals(decision)) {
            mismatchCount++;
        }
    }

    public static SecurityAuditAggregate empty() {
        return new SecurityAuditAggregate();
    }

    private static String safeDecision(String value) {
        return value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
    }
}
