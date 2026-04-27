package egovframework.com.framework.authority.service;

import egovframework.com.platform.codex.service.AuthGroupManageService;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class FrameworkAuthorityPolicyService {

    public static final String ROLE_SYSTEM_MASTER = "ROLE_SYSTEM_MASTER";
    public static final String ROLE_SYSTEM_ADMIN = "ROLE_SYSTEM_ADMIN";
    public static final String ROLE_ADMIN = "ROLE_ADMIN";
    public static final String ROLE_OPERATION_ADMIN = "ROLE_OPERATION_ADMIN";
    public static final String ROLE_USER = "ROLE_USER";
    public static final String ROLE_COMPANY_ADMIN = "ROLE_COMPANY_ADMIN";
    public static final String ROLE_CS_ADMIN = "ROLE_CS_ADMIN";
    public static final String ROLE_CATEGORY_GENERAL = "GENERAL";
    public static final String ROLE_CATEGORY_DEPARTMENT = "DEPARTMENT";
    public static final String ROLE_CATEGORY_USER = "USER";

    private final AuthGroupManageService authGroupManageService;

    public FrameworkAuthorityPolicyService(AuthGroupManageService authGroupManageService) {
        this.authGroupManageService = authGroupManageService;
    }

    public AuthorityPolicyContext buildContext(String authorCode) throws Exception {
        String normalizedAuthorCode = normalizeAuthorCode(authorCode);
        if (normalizedAuthorCode.isEmpty()) {
            return new AuthorityPolicyContext("", Collections.emptySet(), false, false, false);
        }
        if (isSystemMaster(normalizedAuthorCode)) {
            return new AuthorityPolicyContext(normalizedAuthorCode, Collections.emptySet(), true, false, true);
        }
        Set<String> featureCodes = resolveAuthorFeatureCodeSet(normalizedAuthorCode);
        boolean operationAdmin = isOperationAdmin(normalizedAuthorCode);
        return new AuthorityPolicyContext(
                normalizedAuthorCode,
                featureCodes,
                false,
                operationAdmin,
                hasGlobalCompanyScope("", normalizedAuthorCode)
        );
    }

    public Set<String> resolveAuthorFeatureCodeSet(String authorCode) throws Exception {
        String normalizedAuthorCode = normalizeAuthorCode(authorCode);
        if (normalizedAuthorCode.isEmpty() || isSystemMaster(normalizedAuthorCode)) {
            return Collections.emptySet();
        }
        List<String> source = authGroupManageService.selectAuthorFeatureCodes(normalizedAuthorCode);
        if (source == null || source.isEmpty()) {
            return Collections.emptySet();
        }
        Set<String> dedup = new LinkedHashSet<>();
        for (String featureCode : source) {
            String normalizedFeatureCode = normalizeFeatureCode(featureCode);
            if (!normalizedFeatureCode.isEmpty()) {
                dedup.add(normalizedFeatureCode);
            }
        }
        return Collections.unmodifiableSet(dedup);
    }

    public String resolveCompanyScope(String userId, String authorCode) {
        if (isWebmaster(userId)) {
            return "global";
        }
        String normalizedAuthorCode = normalizeAuthorCode(authorCode);
        if (isGlobalCompanyRole(normalizedAuthorCode)) {
            return "global";
        }
        if (isOperationAdmin(normalizedAuthorCode)) {
            return "own-company";
        }
        return "role-scoped";
    }

    public boolean hasGlobalCompanyScope(String userId, String authorCode) {
        return "global".equals(resolveCompanyScope(userId, authorCode));
    }

    public boolean isSystemMaster(String authorCode) {
        return ROLE_SYSTEM_MASTER.equals(normalizeAuthorCode(authorCode));
    }

    public boolean isSystemAdmin(String authorCode) {
        return ROLE_SYSTEM_ADMIN.equals(normalizeAuthorCode(authorCode));
    }

    public boolean isGeneralAdmin(String authorCode) {
        return ROLE_ADMIN.equals(normalizeAuthorCode(authorCode));
    }

    public boolean isOperationAdmin(String authorCode) {
        return ROLE_OPERATION_ADMIN.equals(normalizeAuthorCode(authorCode));
    }

    public boolean isGlobalCompanyRole(String authorCode) {
        String normalizedAuthorCode = normalizeAuthorCode(authorCode);
        return ROLE_SYSTEM_MASTER.equals(normalizedAuthorCode)
                || ROLE_SYSTEM_ADMIN.equals(normalizedAuthorCode)
                || ROLE_ADMIN.equals(normalizedAuthorCode);
    }

    public String resolveEffectiveAuthorCode(String userId, String authorCode) {
        if (isWebmaster(userId)) {
            return ROLE_SYSTEM_MASTER;
        }
        return normalizeAuthorCode(authorCode);
    }

    public int resolveAuthorRank(String authorCode) {
        String normalizedAuthorCode = normalizeAuthorCode(authorCode);
        if (normalizedAuthorCode.isEmpty()) {
            return 0;
        }
        if (isSystemMaster(normalizedAuthorCode)) {
            return 1000;
        }
        if (isSystemAdmin(normalizedAuthorCode)) {
            return 900;
        }
        if (isGeneralAdmin(normalizedAuthorCode)) {
            return 800;
        }
        if (isOperationAdmin(normalizedAuthorCode)) {
            return 700;
        }
        if (ROLE_COMPANY_ADMIN.equals(normalizedAuthorCode)) {
            return 600;
        }
        if (ROLE_CS_ADMIN.equals(normalizedAuthorCode)) {
            return 550;
        }
        if (ROLE_USER.equals(normalizedAuthorCode)) {
            return 500;
        }
        if (normalizedAuthorCode.startsWith("ROLE_DEPT_")) {
            return 300;
        }
        if (normalizedAuthorCode.startsWith("ROLE_USER_")
                || normalizedAuthorCode.startsWith("ROLE_MEMBER_")
                || normalizedAuthorCode.startsWith("ROLE_ACCOUNT_")) {
            return 200;
        }
        if (normalizedAuthorCode.startsWith("ROLE_")) {
            return 400;
        }
        return 0;
    }

    public List<RecommendedRoleSection> buildRecommendedRoleSections(boolean isEn) {
        List<RecommendedRoleSection> sections = new ArrayList<>();

        List<RecommendedRoleTemplate> generalRoles = new ArrayList<>();
        generalRoles.add(recommendedRole(ROLE_ADMIN,
                isEn ? "Administrator" : "관리자",
                isEn ? "Baseline administrator role assigned to privileged user accounts." : "운영 관리자 계정에 기본 부여하는 기준 관리자 Role입니다."));
        generalRoles.add(recommendedRole(ROLE_USER,
                isEn ? "General User" : "일반 사용자",
                isEn ? "Baseline end-user role assigned to standard accounts." : "일반 사용자 계정에 기본 부여하는 기준 사용자 Role입니다."));
        generalRoles.add(recommendedRole(ROLE_SYSTEM_MASTER,
                isEn ? "System Master" : "시스템 마스터",
                isEn ? "Full access for webmaster only" : "webmaster 전용 전체 권한"));
        generalRoles.add(recommendedRole(ROLE_SYSTEM_ADMIN,
                isEn ? "System Admin" : "시스템 관리자",
                isEn ? "Code, page, feature and role administration" : "코드/페이지/기능/권한 운영 관리"));
        generalRoles.add(recommendedRole(ROLE_OPERATION_ADMIN,
                isEn ? "Operation Admin" : "운영 관리자",
                isEn ? "Operational processing across service domains" : "서비스 운영 전반 처리 권한"));
        generalRoles.add(recommendedRole(ROLE_COMPANY_ADMIN,
                isEn ? "Company Admin" : "회원사 관리자",
                isEn ? "Company-scoped authority management for one institution" : "단일 회원사 범위의 권한/회원 운영 기준 롤"));
        generalRoles.add(recommendedRole(ROLE_CS_ADMIN,
                isEn ? "CS Admin" : "CS 관리자",
                isEn ? "Customer support and member response authority" : "고객 지원 및 회원 응대 권한"));
        sections.add(new RecommendedRoleSection(
                "GENERAL",
                isEn ? "General authority groups" : "일반 권한 그룹",
                isEn ? "Baseline authority groups used as common execution roles across the system." : "시스템 전반에서 기준 권한으로 사용하는 공통 실행 Role입니다.",
                generalRoles
        ));

        List<RecommendedRoleTemplate> departmentRoles = new ArrayList<>();
        departmentRoles.add(recommendedRole("ROLE_DEPT_OPERATION",
                isEn ? "Department Operation" : "부서 운영 기본권한",
                isEn ? "Default department-level operational baseline" : "운영부서 기본 권한 베이스라인"));
        departmentRoles.add(recommendedRole("ROLE_DEPT_CS",
                isEn ? "Department CS" : "부서 CS 기본권한",
                isEn ? "Default department-level customer support baseline" : "CS부서 기본 권한 베이스라인"));
        departmentRoles.add(recommendedRole("ROLE_DEPT_SUSTAINABILITY",
                isEn ? "Department Sustainability" : "부서 탄소/ESG 기본권한",
                isEn ? "Baseline role for carbon, ESG, and sustainability departments" : "탄소/ESG/지속가능경영 부서 기준 권한"));
        departmentRoles.add(recommendedRole("ROLE_DEPT_PRODUCTION",
                isEn ? "Department Production" : "부서 생산 기본권한",
                isEn ? "Baseline role for production and manufacturing departments" : "생산/공정 부서 기준 권한"));
        departmentRoles.add(recommendedRole("ROLE_DEPT_PROCUREMENT",
                isEn ? "Department Procurement" : "부서 구매 기본권한",
                isEn ? "Baseline role for procurement and SCM departments" : "구매/SCM 부서 기준 권한"));
        departmentRoles.add(recommendedRole("ROLE_DEPT_QUALITY",
                isEn ? "Department Quality" : "부서 품질 기본권한",
                isEn ? "Baseline role for quality, certification, and audit departments" : "품질/인증/심사 부서 기준 권한"));
        departmentRoles.add(recommendedRole("ROLE_DEPT_SALES",
                isEn ? "Department Sales" : "부서 영업 기본권한",
                isEn ? "Baseline role for sales and account management departments" : "영업/고객사 관리 부서 기준 권한"));
        sections.add(new RecommendedRoleSection(
                "DEPARTMENT",
                isEn ? "Department authority groups" : "부서 권한 그룹",
                isEn ? "Baseline roles assigned automatically by department." : "부서 기준으로 기본 부여하는 베이스라인 Role입니다.",
                departmentRoles
        ));

        sections.add(new RecommendedRoleSection(
                "USER",
                isEn ? "User authority groups" : "사용자 권한 그룹",
                isEn ? "No user-specific role groups have been prepared yet. Add these later for direct assignment exceptions." : "아직 별도로 준비된 사용자 전용 Role은 없습니다. 직접 부여 예외가 필요할 때 추가합니다.",
                Collections.emptyList()
        ));
        return sections;
    }

    public List<OptionDescriptor> buildRoleCategoryOptions(boolean isEn, boolean canViewGeneralAuthorityGroups) {
        List<OptionDescriptor> items = new ArrayList<>();
        if (canViewGeneralAuthorityGroups) {
            items.add(new OptionDescriptor(ROLE_CATEGORY_GENERAL, isEn ? "General groups" : "일반 권한 그룹"));
        }
        items.add(new OptionDescriptor(ROLE_CATEGORY_DEPARTMENT, isEn ? "Department groups" : "부서 권한 그룹"));
        items.add(new OptionDescriptor(ROLE_CATEGORY_USER, isEn ? "User groups" : "사용자 권한 그룹"));
        return items;
    }

    public List<TextDescriptor> buildAssignmentAuthorities(boolean isEn) {
        List<TextDescriptor> items = new ArrayList<>();
        items.add(new TextDescriptor(
                isEn ? "Role assignment authority" : "권한 할당 권한",
                isEn ? "Controls which role groups the current administrator can assign on the member edit page." : "회원 수정 화면에서 현재 관리자가 어떤 Role을 부여할 수 있는지 제어합니다."
        ));
        items.add(new TextDescriptor(
                isEn ? "Grant authority" : "권한 부여 권한",
                isEn ? "Separates execution authority from authority to delegate that execution authority to others." : "실행 권한과 타인에게 그 권한을 위임할 수 있는 권한을 분리합니다."
        ));
        items.add(new TextDescriptor(
                isEn ? "Department baseline authority" : "부서 기본 권한",
                isEn ? "Provides default roles by department, then merges them with user-specific roles." : "부서별 기본 Role을 부여하고 사용자별 직접 권한과 합산합니다."
        ));
        return items;
    }

    public List<TextDescriptor> buildRoleCategories(boolean isEn) {
        List<TextDescriptor> items = new ArrayList<>();
        items.add(new TextDescriptor(
                isEn ? "General authority list" : "일반 권한 목록",
                isEn ? "Master feature catalog. All VIEW and action permissions are defined here." : "기능 마스터 카탈로그입니다. 모든 VIEW 및 액션 권한의 원본입니다."
        ));
        items.add(new TextDescriptor(
                isEn ? "Department authority list" : "부서 권한 목록",
                isEn ? "Department-level baseline roles for operation, CS, audit and similar teams." : "운영, CS, 감사 등 부서 단위 기본 Role 목록입니다."
        ));
        items.add(new TextDescriptor(
                isEn ? "User authority list" : "사용자 권한 목록",
                isEn ? "Direct user-specific role assignments and exceptions managed from member edit." : "회원 수정 화면에서 관리하는 사용자 직접 Role 및 예외 권한입니다."
        ));
        return items;
    }

    public String resolveRoleCategory(String roleCategory) {
        String normalized = roleCategory == null ? "" : roleCategory.trim().toUpperCase(Locale.ROOT);
        if (ROLE_CATEGORY_GENERAL.equals(normalized)
                || ROLE_CATEGORY_DEPARTMENT.equals(normalized)
                || ROLE_CATEGORY_USER.equals(normalized)) {
            return normalized;
        }
        return ROLE_CATEGORY_GENERAL;
    }

    public boolean matchesRoleCategory(String authorCode, String roleCategory) {
        String normalizedCode = normalizeAuthorCode(authorCode);
        String normalizedCategory = resolveRoleCategory(roleCategory);
        if (ROLE_CATEGORY_DEPARTMENT.equals(normalizedCategory)) {
            return normalizedCode.startsWith("ROLE_DEPT_");
        }
        if (ROLE_CATEGORY_USER.equals(normalizedCategory)) {
            return normalizedCode.startsWith("ROLE_USER_")
                    || normalizedCode.startsWith("ROLE_MEMBER_")
                    || normalizedCode.startsWith("ROLE_ACCOUNT_");
        }
        return !normalizedCode.startsWith("ROLE_DEPT_")
                && !normalizedCode.startsWith("ROLE_USER_")
                && !normalizedCode.startsWith("ROLE_MEMBER_")
                && !normalizedCode.startsWith("ROLE_ACCOUNT_");
    }

    public boolean isCompanyScopedAuthorCode(String authorCode, String roleCategory) {
        String normalizedCode = normalizeAuthorCode(authorCode);
        String normalizedCategory = resolveRoleCategory(roleCategory);
        if (ROLE_CATEGORY_DEPARTMENT.equals(normalizedCategory)) {
            return normalizedCode.startsWith("ROLE_DEPT_I");
        }
        if (ROLE_CATEGORY_USER.equals(normalizedCategory)) {
            return normalizedCode.startsWith("ROLE_USER_I");
        }
        return false;
    }

    public boolean isCompanyScopedAuthorCodeForInstt(String authorCode, String roleCategory, String insttId) {
        String scopedPrefix = buildScopedAuthorPrefix(roleCategory, insttId);
        return !scopedPrefix.isEmpty() && normalizeAuthorCode(authorCode).startsWith(scopedPrefix);
    }

    public boolean isVisibleScopedAuthorCode(String authorCode, String roleCategory, String insttId) {
        String normalizedCode = normalizeAuthorCode(authorCode);
        if (normalizedCode.isEmpty()) {
            return false;
        }
        String scopedPrefix = buildScopedAuthorPrefix(roleCategory, insttId);
        if (scopedPrefix.isEmpty()) {
            return !isCompanyScopedAuthorCode(normalizedCode, roleCategory);
        }
        return !isCompanyScopedAuthorCode(normalizedCode, roleCategory) || normalizedCode.startsWith(scopedPrefix);
    }

    public String normalizeScopedAuthorCode(String authorCode, String roleCategory, String insttId, boolean forceScoped) {
        String normalizedCode = normalizeAuthorCode(authorCode).replaceAll("[^A-Z0-9_]", "_");
        String normalizedCategory = resolveRoleCategory(roleCategory);
        if (!forceScoped || (!ROLE_CATEGORY_DEPARTMENT.equals(normalizedCategory) && !ROLE_CATEGORY_USER.equals(normalizedCategory))) {
            return normalizedCode;
        }
        String prefix = buildScopedAuthorPrefix(normalizedCategory, insttId);
        if (prefix.isEmpty()) {
            return normalizedCode;
        }
        String suffix = normalizedCode;
        if (suffix.startsWith(prefix)) {
            return suffix;
        }
        suffix = suffix.replaceFirst("^ROLE_[A-Z0-9]+_", "");
        suffix = suffix.replaceFirst("^COMPANY_[A-Z0-9]+_", "");
        suffix = suffix.replaceAll("^_+", "");
        if (suffix.isEmpty()) {
            suffix = "CUSTOM";
        }
        return prefix + suffix;
    }

    public String buildScopedAuthorPrefix(String roleCategory, String insttId) {
        String token = normalizeInsttScopeToken(insttId);
        String normalizedCategory = resolveRoleCategory(roleCategory);
        if (token.isEmpty()) {
            return "";
        }
        if (ROLE_CATEGORY_DEPARTMENT.equals(normalizedCategory)) {
            return "ROLE_DEPT_I" + shortenInsttScopeToken(token) + "_";
        }
        if (ROLE_CATEGORY_USER.equals(normalizedCategory)) {
            return "ROLE_USER_I" + shortenInsttScopeToken(token) + "_";
        }
        return "";
    }

    public String normalizeInsttScopeToken(String insttId) {
        return insttId == null ? "" : insttId.trim().toUpperCase(Locale.ROOT).replaceAll("[^A-Z0-9]", "");
    }

    public String shortenInsttScopeToken(String normalizedToken) {
        String token = normalizedToken == null ? "" : normalizedToken.trim();
        if (token.length() <= 8) {
            return token;
        }
        return token.substring(token.length() - 8);
    }

    public DepartmentRoleDescriptor resolveDepartmentRole(String insttId, String companyName, String deptName, boolean isEn) {
        String roleType = resolveDepartmentRoleTypeFromDeptName(companyName, deptName);
        String roleCode = buildDepartmentRoleCode(insttId, roleType);
        return describeDepartmentRole(roleCode, isEn);
    }

    public DepartmentRoleDescriptor describeDepartmentRole(String roleCode, boolean isEn) {
        String normalizedRoleCode = normalizeAuthorCode(roleCode);
        String roleType = resolveDepartmentRoleType(normalizedRoleCode);
        boolean unknown = "UNKNOWN".equals(roleType);
        return new DepartmentRoleDescriptor(
                normalizedRoleCode,
                resolveDepartmentRoleName(roleType, isEn),
                resolveDepartmentRoleDescription(roleType, isEn),
                unknown ? "missing" : "existing",
                unknown
        );
    }

    public String buildDepartmentRoleCode(String insttId, String departmentRoleType) {
        String normalizedRoleType = departmentRoleType == null ? "" : departmentRoleType.trim().toUpperCase(Locale.ROOT);
        if (normalizedRoleType.isEmpty() || "UNKNOWN".equals(normalizedRoleType)) {
            return "ROLE_DEPT_UNKNOWN";
        }
        String scopedPrefix = buildScopedAuthorPrefix(ROLE_CATEGORY_DEPARTMENT, insttId);
        if (!scopedPrefix.isEmpty()) {
            return scopedPrefix + normalizedRoleType;
        }
        return "ROLE_DEPT_" + normalizedRoleType;
    }

    public String resolveDepartmentRoleType(String roleCode) {
        String normalizedRoleCode = normalizeAuthorCode(roleCode);
        if (normalizedRoleCode.startsWith("ROLE_DEPT_I")) {
            int lastUnderscore = normalizedRoleCode.lastIndexOf('_');
            if (lastUnderscore > "ROLE_DEPT_I".length()) {
                return normalizedRoleCode.substring(lastUnderscore + 1);
            }
        }
        if (normalizedRoleCode.startsWith("ROLE_DEPT_")) {
            return normalizedRoleCode.substring("ROLE_DEPT_".length());
        }
        return "UNKNOWN";
    }

    public String resolveDepartmentRoleTypeFromDeptName(String companyName, String deptName) {
        String searchText = ((companyName == null ? "" : companyName.trim()) + " " + (deptName == null ? "" : deptName.trim()))
                .toUpperCase(Locale.ROOT);
        if (containsAny(searchText, "탄소", "ESG", "환경", "지속가능", "NETZERO", "SUSTAIN")) return "ESG";
        if (containsAny(searchText, "생산", "제조", "공정", "설비", "PLANT", "PRODUCTION", "MANUFACTUR", "FACTORY")) return "PROD";
        if (containsAny(searchText, "구매", "자재", "조달", "SCM", "PROCUREMENT", "PURCHASE", "MATERIAL")) return "PROC";
        if (containsAny(searchText, "품질", "QA", "QC", "인증", "심사", "QUALITY", "AUDIT", "CERT")) return "QUAL";
        if (containsAny(searchText, "영업", "마케팅", "사업", "SALES", "ACCOUNT", "BIZDEV", "BUSINESS")) return "SALE";
        if (containsAny(searchText, "고객", "문의", "CS", "VOC", "SUPPORT", "HELPDESK")) return "CS";
        if (containsAny(searchText, "운영", "기술", "개발", "IT", "시스템", "플랫폼", "INFRA", "DEVOPS", "ENGINEER")) return "OPS";
        if (containsAny(searchText, "경영", "지원", "재무", "회계", "인사", "총무", "HR", "FINANCE", "ACCOUNTING", "MANAGEMENT")) return "MGMT";
        return "UNKNOWN";
    }

    public String normalizeAuthorCode(String authorCode) {
        return authorCode == null ? "" : authorCode.trim().toUpperCase(Locale.ROOT);
    }

    public String normalizeFeatureCode(String featureCode) {
        return featureCode == null ? "" : featureCode.trim().toUpperCase(Locale.ROOT);
    }

    public List<String> normalizeFeatureCodes(List<String> featureCodes) {
        if (featureCodes == null || featureCodes.isEmpty()) {
            return new ArrayList<>();
        }
        Set<String> dedup = new LinkedHashSet<>();
        for (String featureCode : featureCodes) {
            String normalized = normalizeFeatureCode(featureCode);
            if (!normalized.isEmpty()) {
                dedup.add(normalized);
            }
        }
        return new ArrayList<>(dedup);
    }

    public boolean isWebmaster(String userId) {
        return "webmaster".equalsIgnoreCase(userId == null ? "" : userId.trim());
    }

    private RecommendedRoleTemplate recommendedRole(String code, String name, String description) {
        return new RecommendedRoleTemplate(code, name, description);
    }

    private String resolveDepartmentRoleName(String roleType, boolean isEn) {
        if ("CS".equals(roleType)) return isEn ? "Department CS baseline" : "부서 CS 기본권한";
        if ("OPS".equals(roleType) || "OPERATION".equals(roleType)) return isEn ? "Department operation baseline" : "부서 운영 기본권한";
        if ("ESG".equals(roleType) || "SUSTAINABILITY".equals(roleType)) return isEn ? "Department sustainability baseline" : "부서 탄소/ESG 기본권한";
        if ("PROD".equals(roleType) || "PRODUCTION".equals(roleType)) return isEn ? "Department production baseline" : "부서 생산 기본권한";
        if ("PROC".equals(roleType) || "PROCUREMENT".equals(roleType)) return isEn ? "Department procurement baseline" : "부서 구매 기본권한";
        if ("QUAL".equals(roleType) || "QUALITY".equals(roleType)) return isEn ? "Department quality baseline" : "부서 품질 기본권한";
        if ("SALE".equals(roleType) || "SALES".equals(roleType)) return isEn ? "Department sales baseline" : "부서 영업 기본권한";
        if ("MGMT".equals(roleType) || "MANAGEMENT".equals(roleType)) return isEn ? "Department management baseline" : "부서 경영지원 기본권한";
        return isEn ? "Needs review" : "검토 필요";
    }

    private String resolveDepartmentRoleDescription(String roleType, boolean isEn) {
        if ("CS".equals(roleType)) return isEn ? "Baseline authority for customer support departments." : "CS부서 기본 권한 베이스라인";
        if ("OPS".equals(roleType) || "OPERATION".equals(roleType)) return isEn ? "Baseline authority for operations and technical departments." : "운영/기술 부서 기본 권한 베이스라인";
        if ("ESG".equals(roleType) || "SUSTAINABILITY".equals(roleType)) return isEn ? "Baseline authority for carbon, ESG, and sustainability departments." : "탄소/ESG/지속가능경영 부서 기본 권한 베이스라인";
        if ("PROD".equals(roleType) || "PRODUCTION".equals(roleType)) return isEn ? "Baseline authority for production and manufacturing departments." : "생산/공정 부서 기본 권한 베이스라인";
        if ("PROC".equals(roleType) || "PROCUREMENT".equals(roleType)) return isEn ? "Baseline authority for procurement and SCM departments." : "구매/SCM 부서 기본 권한 베이스라인";
        if ("QUAL".equals(roleType) || "QUALITY".equals(roleType)) return isEn ? "Baseline authority for quality, certification, and audit departments." : "품질/인증/심사 부서 기본 권한 베이스라인";
        if ("SALE".equals(roleType) || "SALES".equals(roleType)) return isEn ? "Baseline authority for sales and account management departments." : "영업/고객사 관리 부서 기본 권한 베이스라인";
        if ("MGMT".equals(roleType) || "MANAGEMENT".equals(roleType)) return isEn ? "Baseline authority for management support, finance, and HR departments." : "경영지원/재무/인사 부서 기본 권한 베이스라인";
        return isEn ? "Department role needs review." : "회사/부서 기준 검토가 필요한 권한입니다.";
    }

    private boolean containsAny(String source, String... keywords) {
        if (source == null || source.isEmpty() || keywords == null) {
            return false;
        }
        for (String keyword : keywords) {
            String normalizedKeyword = keyword == null ? "" : keyword.trim().toUpperCase(Locale.ROOT);
            if (!normalizedKeyword.isEmpty() && source.contains(normalizedKeyword)) {
                return true;
            }
        }
        return false;
    }

    public static final class AuthorityPolicyContext {
        private final String authorCode;
        private final Set<String> featureCodes;
        private final boolean systemMaster;
        private final boolean operationAdmin;
        private final boolean globalCompanyScope;

        public AuthorityPolicyContext(String authorCode,
                                      Set<String> featureCodes,
                                      boolean systemMaster,
                                      boolean operationAdmin,
                                      boolean globalCompanyScope) {
            this.authorCode = authorCode;
            this.featureCodes = featureCodes == null ? Collections.emptySet() : featureCodes;
            this.systemMaster = systemMaster;
            this.operationAdmin = operationAdmin;
            this.globalCompanyScope = globalCompanyScope;
        }

        public String getAuthorCode() {
            return authorCode;
        }

        public Set<String> getFeatureCodes() {
            return featureCodes;
        }

        public boolean isSystemMaster() {
            return systemMaster;
        }

        public boolean isOperationAdmin() {
            return operationAdmin;
        }

        public boolean isGlobalCompanyScope() {
            return globalCompanyScope;
        }
    }

    public static final class RecommendedRoleTemplate {
        private final String code;
        private final String name;
        private final String description;

        public RecommendedRoleTemplate(String code, String name, String description) {
            this.code = code;
            this.name = name;
            this.description = description;
        }

        public String getCode() {
            return code;
        }

        public String getName() {
            return name;
        }

        public String getDescription() {
            return description;
        }
    }

    public static final class RecommendedRoleSection {
        private final String category;
        private final String title;
        private final String description;
        private final List<RecommendedRoleTemplate> roles;

        public RecommendedRoleSection(String category, String title, String description, List<RecommendedRoleTemplate> roles) {
            this.category = category;
            this.title = title;
            this.description = description;
            this.roles = roles == null ? Collections.emptyList() : Collections.unmodifiableList(new ArrayList<>(roles));
        }

        public String getCategory() {
            return category;
        }

        public String getTitle() {
            return title;
        }

        public String getDescription() {
            return description;
        }

        public List<RecommendedRoleTemplate> getRoles() {
            return roles;
        }
    }

    public static final class DepartmentRoleDescriptor {
        private final String code;
        private final String name;
        private final String description;
        private final String status;
        private final boolean unknown;

        public DepartmentRoleDescriptor(String code, String name, String description, String status, boolean unknown) {
            this.code = code;
            this.name = name;
            this.description = description;
            this.status = status;
            this.unknown = unknown;
        }

        public String getCode() {
            return code;
        }

        public String getName() {
            return name;
        }

        public String getDescription() {
            return description;
        }

        public String getStatus() {
            return status;
        }

        public boolean isUnknown() {
            return unknown;
        }
    }

    public static final class OptionDescriptor {
        private final String code;
        private final String name;

        public OptionDescriptor(String code, String name) {
            this.code = code;
            this.name = name;
        }

        public String getCode() {
            return code;
        }

        public String getName() {
            return name;
        }
    }

    public static final class TextDescriptor {
        private final String title;
        private final String description;

        public TextDescriptor(String title, String description) {
            this.title = title;
            this.description = description;
        }

        public String getTitle() {
            return title;
        }

        public String getDescription() {
            return description;
        }
    }
}
