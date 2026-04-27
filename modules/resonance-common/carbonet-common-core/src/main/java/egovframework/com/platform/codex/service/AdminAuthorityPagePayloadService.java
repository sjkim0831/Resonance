package egovframework.com.platform.codex.service;

import egovframework.com.feature.admin.web.*;

import egovframework.com.platform.codex.model.AdminRoleAssignmentVO;
import egovframework.com.platform.codex.model.AuthorInfoVO;
import egovframework.com.platform.codex.model.DepartmentRoleMappingVO;
import egovframework.com.platform.governance.model.vo.FeatureCatalogSectionVO;
import egovframework.com.platform.governance.model.vo.FeatureCatalogSummarySnapshot;
import egovframework.com.platform.codex.model.UserAuthorityTargetVO;
import egovframework.com.platform.governance.service.AuthorRoleProfileService;
import egovframework.com.platform.codex.service.AuthGroupManageService;
import egovframework.com.platform.read.AdminSummaryReadPort;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminAuthorityPagePayloadService {

    private static final Logger log = LoggerFactory.getLogger(AdminAuthorityPagePayloadService.class);

    private final AuthGroupManageService authGroupManageService;
    private final AdminSummaryReadPort adminSummaryReadPort;
    private final AuthorRoleProfileService authorRoleProfileService;
    private final AdminAuthorityPagePayloadSupport authorityPagePayloadSupport;
    private final AdminCompanyScopeService adminCompanyScopeService;

    public Map<String, Object> buildAuthGroupPagePayload(
            String authorCode,
            String roleCategory,
            String insttId,
            String menuCode,
            String featureCode,
            String userSearchKeyword,
            HttpServletRequest request,
            Locale locale) {
        Map<String, Object> response = new LinkedHashMap<>();
        boolean isEn = authorityPagePayloadSupport.isEnglishRequest(request, locale);
        authorityPagePayloadSupport.primeCsrfToken(request);
        String currentUserId = authorityPagePayloadSupport.extractCurrentUserId(request);
        AdminCompanyScopeService.CompanyScope companyScope = adminCompanyScopeService.resolve(currentUserId);
        boolean webmaster = "webmaster".equalsIgnoreCase(currentUserId);
        String currentUserAuthorCode = companyScope.getAuthorCode();
        boolean canManageScopedAuthorityGroups = webmaster
                || authorityPagePayloadSupport.requiresOwnCompanyAccess(currentUserId, currentUserAuthorCode);
        boolean canViewGeneralAuthorityGroups = false;
        String selectedRoleCategory = authorityPagePayloadSupport.resolveRoleCategory(roleCategory);
        String currentUserInsttId = companyScope.getInsttId();
        boolean globalAccess = companyScope.canManageAllCompanies();

        List<AuthorInfoVO> authorGroups;
        List<AuthorInfoVO> filteredAuthorGroups;
        List<FeatureCatalogSectionVO> featureSections;
        List<String> selectedFeatureCodes;
        AdminAuthorityPagePayloadSupport.AuthGroupScopeContext scopeContext;
        String selectedAuthorCode = "";
        String selectedAuthorName = "";
        String authGroupError = "";
        boolean featureCatalogDeferred = false;
        try {
            canViewGeneralAuthorityGroups = authorityPagePayloadSupport.hasGeneralAuthorityGroupAccess(currentUserId, webmaster);
            if (!canViewGeneralAuthorityGroups && "GENERAL".equals(selectedRoleCategory)) {
                selectedRoleCategory = "DEPARTMENT";
                authGroupError = isEn
                        ? "Only master authority can view general authority groups."
                        : "일반 권한 그룹은 마스터 권한이 있을 때만 조회할 수 있습니다.";
            }
            authorGroups = authGroupManageService.selectAuthorList();
            scopeContext = authorityPagePayloadSupport.buildAuthGroupScopeContext(
                    insttId,
                    userSearchKeyword,
                    selectedRoleCategory,
                    currentUserId,
                    currentUserAuthorCode,
                    currentUserInsttId,
                    webmaster,
                    globalAccess,
                    authorGroups,
                    isEn);
            filteredAuthorGroups = scopeContext.getReferenceAuthorGroups();
            selectedAuthorCode = authorityPagePayloadSupport.resolveSelectedAuthorCode(authorCode, filteredAuthorGroups);
            if (selectedAuthorCode.isEmpty()) {
                featureSections = Collections.emptyList();
                selectedFeatureCodes = Collections.emptyList();
                featureCatalogDeferred = true;
            } else {
                Map<String, Integer> featureAssignmentCounts = authorityPagePayloadSupport.toFeatureAssignmentCountMap(
                        authGroupManageService.selectFeatureAssignmentStats());
                Set<String> grantableFeatureCodes = authorityPagePayloadSupport.resolveGrantableFeatureCodeSet(currentUserId, webmaster);
                featureSections = authorityPagePayloadSupport.filterFeatureCatalogSectionsByGrantable(
                        authorityPagePayloadSupport.buildFeatureCatalogSections(
                                authorityPagePayloadSupport.applyFeatureAssignmentStats(
                                        authGroupManageService.selectFeatureCatalog(),
                                        featureAssignmentCounts),
                                isEn),
                        grantableFeatureCodes);
                selectedFeatureCodes = authorityPagePayloadSupport.filterFeatureCodesByGrantable(
                        authGroupManageService.selectAuthorFeatureCodes(selectedAuthorCode),
                        grantableFeatureCodes);
            }
            selectedAuthorName = authorityPagePayloadSupport.resolveSelectedAuthorName(selectedAuthorCode, filteredAuthorGroups);
            if (authGroupError.isEmpty()) {
                authGroupError = authorityPagePayloadSupport.safeValue(scopeContext.getErrorMessage());
            }
        } catch (Exception e) {
            log.error("Failed to load auth group page api.", e);
            authorGroups = Collections.emptyList();
            filteredAuthorGroups = Collections.emptyList();
            featureSections = Collections.emptyList();
            selectedFeatureCodes = Collections.emptyList();
            scopeContext = AdminAuthorityPagePayloadSupport.AuthGroupScopeContext.empty();
            authGroupError = isEn
                    ? "Failed to load permission groups and feature catalog."
                    : "권한 그룹 및 기능 목록을 불러오지 못했습니다.";
            featureCatalogDeferred = false;
        }

        response.put("isEn", isEn);
        response.put("currentUserId", currentUserId);
        response.put("isWebmaster", webmaster);
        response.put("authorGroups", filteredAuthorGroups);
        response.put("filteredAuthorGroups", filteredAuthorGroups);
        response.put("referenceAuthorGroups", filteredAuthorGroups);
        response.put("generalAuthorGroups", authorityPagePayloadSupport.filterAuthorGroups(
                authorGroups,
                "GENERAL",
                currentUserId,
                currentUserAuthorCode));
        FeatureCatalogSummarySnapshot featureCatalogSummary = adminSummaryReadPort.summarizeFeatureCatalog(featureSections);
        response.put("featureSections", featureSections);
        response.put("authorGroupCount", filteredAuthorGroups.size());
        response.put("featureCount", selectedFeatureCodes.size());
        response.put("catalogFeatureCount", featureCatalogSummary.getTotalFeatureCount());
        response.put("pageCount", authorityPagePayloadSupport.countSelectedPageCount(featureSections, selectedFeatureCodes));
        response.put("unassignedFeatureCount", featureCatalogSummary.getUnassignedFeatureCount());
        response.put("recommendedRoleSections",
                authorityPagePayloadSupport.filterGrantableRecommendedRoleSections(
                        authorityPagePayloadSupport.buildRecommendedRoleSections(authorGroups, isEn),
                        selectedRoleCategory,
                        currentUserId,
                        currentUserAuthorCode));
        response.put("assignmentAuthorities", authorityPagePayloadSupport.buildAssignmentAuthorities(isEn));
        response.put("roleCategories", authorityPagePayloadSupport.buildRoleCategories(isEn));
        response.put("roleCategoryOptions", authorityPagePayloadSupport.buildRoleCategoryOptions(isEn, canViewGeneralAuthorityGroups));
        response.put("selectedRoleCategory", selectedRoleCategory);
        response.put("selectedAuthorCode", selectedAuthorCode);
        response.put("selectedAuthorName", selectedAuthorName);
        response.put("selectedAuthorProfile", authorityPagePayloadSupport.toAuthorRoleProfileMap(authorRoleProfileService.getProfile(selectedAuthorCode)));
        response.put("referenceAuthorProfilesByCode",
                authorityPagePayloadSupport.toAuthorRoleProfileMapCollection(authorRoleProfileService.getProfiles(
                        filteredAuthorGroups.stream()
                                .map(AuthorInfoVO::getAuthorCode)
                                .collect(Collectors.toCollection(LinkedHashSet::new)))));
        response.put("selectedFeatureCodes", selectedFeatureCodes);
        response.put("focusedMenuCode", authorityPagePayloadSupport.safeValue(menuCode).toUpperCase(Locale.ROOT));
        response.put("focusedFeatureCode", authorityPagePayloadSupport.safeValue(featureCode).toUpperCase(Locale.ROOT));
        response.put("featureCatalogDeferred", featureCatalogDeferred);
        response.put("canViewGeneralAuthorityGroups", canViewGeneralAuthorityGroups);
        response.put("canManageScopedAuthorityGroups", canManageScopedAuthorityGroups);
        response.put("canManageAllCompanies", globalAccess);
        response.put("canManageOwnCompany", !globalAccess && canManageScopedAuthorityGroups);
        response.put("authGroupBasePath", authorityPagePayloadSupport.resolveAuthGroupBasePath(request, locale));
        response.put("authGroupCreatePath", authorityPagePayloadSupport.resolveAuthGroupBasePath(request, locale) + "/create");
        response.put("authGroupSaveFeaturesPath", authorityPagePayloadSupport.resolveAuthGroupBasePath(request, locale) + "/save-features");
        response.put("authGroupCompanyOptions", scopeContext.getCompanyOptions());
        response.put("authGroupSelectedInsttId", scopeContext.getSelectedInsttId());
        response.put("authGroupDepartmentRows", scopeContext.getDepartmentRows());
        response.put("authGroupDepartmentRoleSummaries", scopeContext.getDepartmentRoleSummaries());
        response.put("userAuthorityTargets", scopeContext.getUserAuthorityTargets());
        response.put("userSearchKeyword", scopeContext.getUserSearchKeyword());
        response.put("authGroupError", authGroupError);
        return response;
    }

    public Map<String, Object> buildDeptRolePagePayload(
            String updated,
            String insttId,
            String memberSearchKeyword,
            Integer memberPageIndex,
            String error,
            HttpServletRequest request,
            Locale locale) {
        Map<String, Object> response = new LinkedHashMap<>();
        boolean isEn = authorityPagePayloadSupport.isEnglishRequest(request, locale);
        authorityPagePayloadSupport.primeCsrfToken(request);
        String currentUserId = authorityPagePayloadSupport.extractCurrentUserId(request);
        AdminCompanyScopeService.CompanyScope companyScope = adminCompanyScopeService.resolve(currentUserId);
        String currentUserAuthorCode = companyScope.getAuthorCode();
        boolean globalDeptRoleAccess = companyScope.canManageAllCompanies();
        boolean ownCompanyDeptRoleAccess = companyScope.canManageOwnCompany();
        String deptRoleError = "";

        List<Map<String, String>> departmentRows;
        List<AuthorInfoVO> authorGroups;
        List<AuthorInfoVO> memberAssignableAuthorGroups;
        List<Map<String, String>> companyOptions;
        String selectedInsttId;
        List<UserAuthorityTargetVO> companyMembers;
        int companyMemberCount;
        int companyMemberPageIndex;
        int companyMemberPageSize;
        int companyMemberTotalPages;
        int mappingCount;
        try {
            List<DepartmentRoleMappingVO> mappings = authGroupManageService.selectDepartmentRoleMappings();
            List<AuthorInfoVO> allAuthorGroups = authGroupManageService.selectAuthorList();
            String currentUserInsttId = companyScope.getInsttId();
            String scopedInsttId = adminCompanyScopeService.resolveScopedInsttIdForQuery(companyScope, insttId, false);
            if (!adminCompanyScopeService.canExecuteScopedQuery(companyScope, false)) {
                throw new IllegalStateException(isEn
                        ? "The current administrator is not bound to a company."
                        : "현재 관리자 계정에 소속 회원사가 없습니다.");
            }
            departmentRows = authorityPagePayloadSupport.buildDepartmentRoleRows(mappings, isEn);
            companyOptions = authorityPagePayloadSupport.buildDepartmentCompanyOptions(departmentRows);
            if (!globalDeptRoleAccess) {
                companyOptions = companyOptions.stream()
                        .filter(option -> currentUserInsttId.equals(option.get("insttId")))
                        .collect(Collectors.toList());
            }
            String requestedInsttId = adminCompanyScopeService.resolveScopedInsttIdForQuery(companyScope, insttId, true);
            selectedInsttId = authorityPagePayloadSupport.resolveSelectedInsttId(requestedInsttId, companyOptions);
            if (!selectedInsttId.isEmpty()) {
                final String selectedInsttIdValue = selectedInsttId;
                departmentRows = departmentRows.stream()
                        .filter(row -> selectedInsttIdValue.equals(row.get("insttId")))
                        .collect(Collectors.toList());
            }
            String authorScopeInsttId = !selectedInsttId.isEmpty() ? selectedInsttId : scopedInsttId;
            authorGroups = authorityPagePayloadSupport.filterScopedDepartmentAuthorGroups(
                    authorityPagePayloadSupport.filterAuthorGroupsByScope(
                            allAuthorGroups,
                            "DEPARTMENT",
                            authorScopeInsttId,
                            globalDeptRoleAccess,
                            currentUserId,
                            currentUserAuthorCode),
                    departmentRows);
            List<UserAuthorityTargetVO> allCompanyMembers = selectedInsttId.isEmpty()
                    ? Collections.emptyList()
                    : authGroupManageService.selectUserAuthorityTargets(selectedInsttId, authorityPagePayloadSupport.safeValue(memberSearchKeyword));
            memberAssignableAuthorGroups = authorityPagePayloadSupport.buildDeptMemberAssignableGroups(
                    allAuthorGroups,
                    authorScopeInsttId,
                    globalDeptRoleAccess,
                    currentUserId,
                    currentUserAuthorCode);
            companyMemberCount = allCompanyMembers.size();
            companyMemberPageSize = 10;
            companyMemberTotalPages = Math.max(1, (int) Math.ceil((double) companyMemberCount / (double) companyMemberPageSize));
            companyMemberPageIndex = memberPageIndex == null ? 1 : Math.max(1, memberPageIndex.intValue());
            if (companyMemberPageIndex > companyMemberTotalPages) {
                companyMemberPageIndex = companyMemberTotalPages;
            }
            int memberFromIndex = Math.max(0, (companyMemberPageIndex - 1) * companyMemberPageSize);
            int memberToIndex = Math.min(companyMemberCount, memberFromIndex + companyMemberPageSize);
            companyMembers = memberFromIndex >= memberToIndex
                    ? Collections.emptyList()
                    : allCompanyMembers.subList(memberFromIndex, memberToIndex);
            mappingCount = departmentRows.size();
        } catch (Exception e) {
            log.error("Failed to load department role mapping page api.", e);
            deptRoleError = isEn
                    ? "Failed to load department role mappings."
                    : "부서 권한 맵핑 목록을 불러오지 못했습니다.";
            departmentRows = Collections.emptyList();
            authorGroups = Collections.emptyList();
            memberAssignableAuthorGroups = Collections.emptyList();
            companyOptions = Collections.emptyList();
            selectedInsttId = "";
            companyMembers = Collections.emptyList();
            companyMemberCount = 0;
            companyMemberPageIndex = 1;
            companyMemberPageSize = 10;
            companyMemberTotalPages = 1;
            mappingCount = 0;
        }

        response.put("isEn", isEn);
        response.put("deptRoleUpdated", "true".equalsIgnoreCase(authorityPagePayloadSupport.safeValue(updated)));
        response.put("deptRoleTargetInsttId", authorityPagePayloadSupport.safeValue(insttId));
        response.put("deptRoleMessage", authorityPagePayloadSupport.resolveDeptRoleMessage(error, isEn));
        response.put("deptRoleError", deptRoleError);
        response.put("currentUserId", currentUserId);
        response.put("isWebmaster", "webmaster".equalsIgnoreCase(currentUserId));
        response.put("canManageAllCompanies", globalDeptRoleAccess);
        response.put("canManageOwnCompany", ownCompanyDeptRoleAccess);
        response.put("departmentMappings", departmentRows);
        response.put("departmentAuthorGroups", authorGroups);
        response.put("memberAssignableAuthorGroups", memberAssignableAuthorGroups);
        response.put("roleProfilesByAuthorCode",
                authorityPagePayloadSupport.toAuthorRoleProfileMapCollection(authorRoleProfileService.getProfiles(
                        authorityPagePayloadSupport.collectRoleProfileAuthorCodes(
                                departmentRows, authorGroups, memberAssignableAuthorGroups, companyMembers))));
        response.put("departmentCompanyOptions", companyOptions);
        response.put("selectedInsttId", selectedInsttId);
        response.put("companyMembers", companyMembers);
        response.put("companyMemberCount", companyMemberCount);
        response.put("companyMemberPageIndex", companyMemberPageIndex);
        response.put("companyMemberPageSize", companyMemberPageSize);
        response.put("companyMemberTotalPages", companyMemberTotalPages);
        response.put("companyMemberSearchKeyword", authorityPagePayloadSupport.safeValue(memberSearchKeyword));
        response.put("mappingCount", mappingCount);
        return response;
    }

    public Map<String, Object> buildAuthChangePagePayload(
            String updated,
            String targetUserId,
            String searchKeyword,
            Integer assignmentPageIndex,
            String error,
            HttpServletRequest request,
            Locale locale) {
        Map<String, Object> response = new LinkedHashMap<>();
        boolean isEn = authorityPagePayloadSupport.isEnglishRequest(request, locale);
        authorityPagePayloadSupport.primeCsrfToken(request);
        String currentUserId = authorityPagePayloadSupport.extractCurrentUserId(request);
        boolean isWebmaster = "webmaster".equalsIgnoreCase(currentUserId);
        AdminCompanyScopeService.CompanyScope companyScope = adminCompanyScopeService.resolve(currentUserId);
        String currentUserAuthorCode = companyScope.getAuthorCode();
        boolean masterAccess = companyScope.canManageMemberScopeAllCompanies();
        boolean canEditAuthChange = companyScope.canManageMemberScope();
        String authChangeError = "";
        List<AdminRoleAssignmentVO> assignments;
        List<AuthorInfoVO> authorGroups;
        int assignmentCount;
        int assignmentPageSize;
        int assignmentPageIndexValue;
        int assignmentTotalPages;
        try {
            String scopedOrgnztId = "";
            String scopedInsttId = adminCompanyScopeService.resolveScopedInsttIdForQuery(companyScope, "", false);
            if (!adminCompanyScopeService.canExecuteScopedQuery(companyScope, false)) {
                throw new IllegalStateException(isEn
                        ? "The current administrator is not bound to a company."
                        : "현재 관리자 계정에 소속 회원사가 없습니다.");
            }
            String normalizedSearchKeyword = authorityPagePayloadSupport.safeValue(searchKeyword);
            assignmentCount = authGroupManageService.countAdminRoleAssignments(scopedOrgnztId, scopedInsttId, normalizedSearchKeyword);
            assignmentPageSize = 10;
            assignmentTotalPages = Math.max(1, (int) Math.ceil((double) assignmentCount / (double) assignmentPageSize));
            assignmentPageIndexValue = assignmentPageIndex == null ? 1 : Math.max(1, assignmentPageIndex.intValue());
            if (assignmentPageIndexValue > assignmentTotalPages) {
                assignmentPageIndexValue = assignmentTotalPages;
            }
            assignments = authGroupManageService.selectAdminRoleAssignmentsPage(
                    scopedOrgnztId,
                    scopedInsttId,
                    normalizedSearchKeyword,
                    Math.max(0, (assignmentPageIndexValue - 1) * assignmentPageSize),
                    assignmentPageSize);
            authorGroups = authorityPagePayloadSupport.filterAuthorGroups(
                    authGroupManageService.selectAuthorList(),
                    "GENERAL",
                    currentUserId,
                    currentUserAuthorCode);
        } catch (Exception e) {
            log.error("Failed to load auth change page api.", e);
            assignments = Collections.emptyList();
            authorGroups = Collections.emptyList();
            assignmentCount = 0;
            assignmentPageSize = 10;
            assignmentPageIndexValue = 1;
            assignmentTotalPages = 1;
            authChangeError = isEn
                    ? "Failed to load user role assignments."
                    : "사용자 권한 변경 목록을 불러오지 못했습니다.";
        }

        response.put("isEn", isEn);
        response.put("currentUserId", currentUserId);
        response.put("isWebmaster", isWebmaster);
        response.put("canEditAuthChange", canEditAuthChange);
        response.put("roleAssignments", assignments);
        response.put("authorGroups", authorGroups);
        response.put("authorGroupSections", authorityPagePayloadSupport.buildAdminRoleLayerSections(authorGroups, isEn));
        response.put("assignmentCount", assignmentCount);
        response.put("assignmentPageIndex", assignmentPageIndexValue);
        response.put("assignmentPageSize", assignmentPageSize);
        response.put("assignmentTotalPages", assignmentTotalPages);
        response.put("assignmentSearchKeyword", authorityPagePayloadSupport.safeValue(searchKeyword));
        response.put("authChangeUpdated", "true".equalsIgnoreCase(authorityPagePayloadSupport.safeValue(updated)));
        response.put("authChangeTargetUserId", authorityPagePayloadSupport.safeValue(targetUserId));
        response.put("authChangeMessage", authorityPagePayloadSupport.resolveAuthChangeMessage(error, isEn));
        response.put("authChangeError", authChangeError);
        response.put("recentRoleChangeHistory", Collections.emptyList());
        return response;
    }

    public Map<String, Object> buildAuthChangeHistoryPayload(
            HttpServletRequest request,
            Locale locale) {
        Map<String, Object> response = new LinkedHashMap<>();
        boolean isEn = authorityPagePayloadSupport.isEnglishRequest(request, locale);
        authorityPagePayloadSupport.primeCsrfToken(request);
        response.put("items", authorityPagePayloadSupport.buildRecentAdminRoleChangeHistory(isEn));
        return response;
    }
}
