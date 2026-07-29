package egovframework.com.feature.auth.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class AdminConsoleAccessPolicyTest {
    @Test
    void allowsOnlyAdministrativeAuthorityCodes() {
        assertTrue(AdminConsoleAccessPolicy.allows("ROLE_SYSTEM_MASTER"));
        assertTrue(AdminConsoleAccessPolicy.allows("role_system_admin"));
        assertTrue(AdminConsoleAccessPolicy.allows(" ROLE_OPERATION_ADMIN "));
        assertTrue(AdminConsoleAccessPolicy.allows("ROLE_ADMIN"));
    }

    @Test
    void rejectsAuthenticatedBusinessActorsWithoutAdminAuthority() {
        assertFalse(AdminConsoleAccessPolicy.allows("ROLE_USER"));
        assertFalse(AdminConsoleAccessPolicy.allows("ROLE_COMPANY_MANAGER"));
        assertFalse(AdminConsoleAccessPolicy.allows(""));
        assertFalse(AdminConsoleAccessPolicy.allows(null));
    }
}
