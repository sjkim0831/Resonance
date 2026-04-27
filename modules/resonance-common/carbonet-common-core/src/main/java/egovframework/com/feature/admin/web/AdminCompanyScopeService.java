package egovframework.com.feature.admin.web;

import egovframework.com.platform.codex.service.AdminAuthorityPagePayloadSupport;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AdminCompanyScopeService {

    private final AdminAuthorityPagePayloadSupport authorityPagePayloadSupport;

    public CompanyScope resolve(String currentUserId) {
        String userId = safeString(currentUserId);
        String authorCode = authorityPagePayloadSupport.resolveCurrentUserAuthorCode(userId);
        String insttId = authorityPagePayloadSupport.resolveCurrentUserInsttId(userId);
        boolean canManageAllCompanies = authorityPagePayloadSupport.hasGlobalDeptRoleAccess(userId, authorCode);
        boolean canManageOwnCompany = authorityPagePayloadSupport.hasOwnCompanyDeptRoleAccess(userId, authorCode);
        boolean canManageMemberScope = authorityPagePayloadSupport.hasMemberManagementCompanyOperatorAccess(userId, authorCode);
        boolean canManageMemberScopeAllCompanies = authorityPagePayloadSupport.hasMemberManagementMasterAccess(userId, authorCode);
        return new CompanyScope(
                userId,
                authorCode,
                insttId,
                canManageAllCompanies,
                !canManageAllCompanies && canManageOwnCompany,
                canManageMemberScope,
                canManageMemberScopeAllCompanies);
    }

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }

    public String resolveScopedInsttIdForQuery(String currentUserId, String requestedInsttId, boolean fullListQuery) {
        return resolve(resolve(currentUserId), requestedInsttId, fullListQuery);
    }

    public String resolveScopedInsttIdForQuery(CompanyScope scope, String requestedInsttId, boolean fullListQuery) {
        return resolve(scope, requestedInsttId, fullListQuery);
    }

    public boolean canExecuteScopedQuery(CompanyScope scope, boolean fullListQuery) {
        CompanyScope normalizedScope = scope == null ? new CompanyScope("", "", "", false, false, false, false) : scope;
        if (normalizedScope.isMasterLike() || fullListQuery) {
            return true;
        }
        return normalizedScope.hasInsttId();
    }

    private String resolve(CompanyScope scope, String requestedInsttId, boolean fullListQuery) {
        CompanyScope normalizedScope = scope == null ? new CompanyScope("", "", "", false, false, false, false) : scope;
        if (normalizedScope.isMasterLike()) {
            return safeString(requestedInsttId);
        }
        if (fullListQuery) {
            return normalizedScope.getInsttId();
        }
        return normalizedScope.getInsttId();
    }

    public static final class CompanyScope {
        private final String userId;
        private final String authorCode;
        private final String insttId;
        private final boolean canManageAllCompanies;
        private final boolean canManageOwnCompany;
        private final boolean canManageMemberScope;
        private final boolean canManageMemberScopeAllCompanies;

        public CompanyScope(
                String userId,
                String authorCode,
                String insttId,
                boolean canManageAllCompanies,
                boolean canManageOwnCompany,
                boolean canManageMemberScope,
                boolean canManageMemberScopeAllCompanies) {
            this.userId = userId;
            this.authorCode = authorCode;
            this.insttId = insttId;
            this.canManageAllCompanies = canManageAllCompanies;
            this.canManageOwnCompany = canManageOwnCompany;
            this.canManageMemberScope = canManageMemberScope;
            this.canManageMemberScopeAllCompanies = canManageMemberScopeAllCompanies;
        }

        public String getUserId() {
            return userId;
        }

        public String getAuthorCode() {
            return authorCode;
        }

        public String getInsttId() {
            return insttId;
        }

        public boolean canManageAllCompanies() {
            return canManageAllCompanies;
        }

        public boolean canManageOwnCompany() {
            return canManageOwnCompany;
        }

        public boolean canManageMemberScope() {
            return canManageMemberScope;
        }

        public boolean canManageMemberScopeAllCompanies() {
            return canManageMemberScopeAllCompanies;
        }

        public boolean hasInsttId() {
            return insttId != null && !insttId.trim().isEmpty();
        }

        public boolean isMasterLike() {
            return canManageAllCompanies || canManageMemberScopeAllCompanies;
        }
    }
}
