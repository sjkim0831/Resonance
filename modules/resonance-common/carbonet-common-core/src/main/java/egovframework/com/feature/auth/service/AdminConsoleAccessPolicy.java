package egovframework.com.feature.auth.service;

import java.util.Locale;
import java.util.Set;

public final class AdminConsoleAccessPolicy {
    private static final Set<String> ADMIN_AUTHOR_CODES = Set.of(
            "ROLE_SYSTEM_MASTER",
            "ROLE_SYSTEM_ADMIN",
            "ROLE_OPERATION_ADMIN",
            "ROLE_ADMIN"
    );

    private AdminConsoleAccessPolicy() {
    }

    public static boolean allows(String authorCode) {
        if (authorCode == null) {
            return false;
        }
        return ADMIN_AUTHOR_CODES.contains(authorCode.trim().toUpperCase(Locale.ROOT));
    }
}
