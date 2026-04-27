package egovframework.com.feature.admin.web;

import egovframework.com.platform.codex.service.AdminAuthorityPagePayloadSupport;

import egovframework.com.platform.codex.model.AdminRoleAssignmentVO;
import egovframework.com.platform.codex.service.AuthGroupManageService;
import egovframework.com.feature.auth.domain.entity.EmplyrInfo;
import egovframework.com.feature.auth.domain.repository.EmployeeMemberRepository;
import egovframework.com.platform.service.observability.PlatformObservabilityCompanyScopePort;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminListQuerySupportService {

    private static final String ROLE_SYSTEM_MASTER = "ROLE_SYSTEM_MASTER";

    private final EmployeeMemberRepository employMemberRepository;
    private final AuthGroupManageService authGroupManageService;
    private final AdminRequestContextSupport adminRequestContextSupport;
    private final AdminAuthorityPagePayloadSupport adminAuthorityPagePayloadSupport;
    private final AdminAdminAccountAccessService adminAdminAccountAccessService;
    private final PlatformObservabilityCompanyScopePort platformObservabilityCompanyScopePort;
    private final AdminCompanyAccountSupportService adminCompanyAccountSupportService;

    public String extractCurrentUserId(HttpServletRequest request) {
        return adminRequestContextSupport.extractCurrentUserId(request);
    }

    public String resolveCurrentUserAuthorCode(String currentUserId) {
        return adminAuthorityPagePayloadSupport.resolveCurrentUserAuthorCode(currentUserId);
    }

    public String resolveCurrentUserInsttId(String currentUserId) {
        return adminAuthorityPagePayloadSupport.resolveCurrentUserInsttId(currentUserId);
    }

    public boolean hasMemberManagementCompanyOperatorAccess(String currentUserId, String currentUserAuthorCode) {
        return adminAuthorityPagePayloadSupport.hasMemberManagementCompanyOperatorAccess(currentUserId, currentUserAuthorCode);
    }

    public boolean hasMemberManagementCompanyAdminAccess(String currentUserId, String currentUserAuthorCode) {
        return adminAuthorityPagePayloadSupport.hasMemberManagementCompanyAdminAccess(currentUserId, currentUserAuthorCode);
    }

    public boolean hasMemberManagementMasterAccess(String currentUserId, String currentUserAuthorCode) {
        return adminAuthorityPagePayloadSupport.hasMemberManagementMasterAccess(currentUserId, currentUserAuthorCode);
    }

    public boolean requiresMemberManagementCompanyScope(String currentUserId, String currentUserAuthorCode) {
        return adminAuthorityPagePayloadSupport.requiresMemberManagementCompanyScope(currentUserId, currentUserAuthorCode);
    }

    public boolean requiresOwnCompanyAccess(String currentUserId, String currentUserAuthorCode) {
        return adminAuthorityPagePayloadSupport.requiresOwnCompanyAccess(currentUserId, currentUserAuthorCode);
    }

    public boolean canCreateAdminAccounts(String currentUserId, String currentUserAuthorCode) {
        return adminAdminAccountAccessService.canCreateAdminAccounts(currentUserId, currentUserAuthorCode);
    }

    public List<Map<String, String>> loadAccessHistoryCompanyOptions() {
        return platformObservabilityCompanyScopePort.loadAccessHistoryCompanyOptions();
    }

    public List<Map<String, String>> buildScopedAccessHistoryCompanyOptions(String currentUserInsttId) {
        return platformObservabilityCompanyScopePort.buildScopedAccessHistoryCompanyOptions(currentUserInsttId);
    }

    public String resolveSelectedInsttId(String requestedInsttId, List<Map<String, String>> companyOptions, boolean allowEmptySelection) {
        return adminAuthorityPagePayloadSupport.resolveSelectedInsttId(requestedInsttId, companyOptions, allowEmptySelection);
    }

    public List<EmplyrInfo> selectVisibleAdminMembers(
            String currentUserId,
            String currentUserAuthorCode,
            String keyword,
            String status) throws Exception {
        String actorInsttId = resolveCurrentUserInsttId(currentUserId);
        boolean masterAccess = hasMemberManagementMasterAccess(currentUserId, currentUserAuthorCode);
        List<EmplyrInfo> employees = employMemberRepository.searchAdminMembersForManagement(
                safeString(keyword),
                safeString(status).toUpperCase(Locale.ROOT),
                masterAccess ? "" : actorInsttId,
                Sort.by(Sort.Order.desc("sbscrbDe"), Sort.Order.asc("emplyrId")));
        Map<String, String> authorCodeByUserId = new LinkedHashMap<>();
        for (AdminRoleAssignmentVO assignment : authGroupManageService.selectAdminRoleAssignments()) {
            authorCodeByUserId.put(
                    safeString(assignment.getEmplyrId()),
                    safeString(assignment.getAuthorCode()).toUpperCase(Locale.ROOT));
        }
        return employees.stream()
                .filter(item -> {
                    String userId = safeString(item.getEmplyrId());
                    String authorCode = authorCodeByUserId.getOrDefault(userId, "");
                    if (authorCode.isEmpty()) {
                        return false;
                    }
                    if (!masterAccess) {
                        String targetInsttId = safeString(item.getInsttId());
                        if (actorInsttId.isEmpty() || !actorInsttId.equals(targetInsttId)) {
                            return false;
                        }
                        if (ROLE_SYSTEM_MASTER.equals(authorCode)) {
                            return false;
                        }
                    }
                    return true;
                })
                .collect(Collectors.toList());
    }

    public String safeString(String value) {
        return adminCompanyAccountSupportService.safeString(value);
    }

    public String normalizeMembershipCode(String membershipType) {
        return adminCompanyAccountSupportService.normalizeMembershipCode(membershipType);
    }
}
