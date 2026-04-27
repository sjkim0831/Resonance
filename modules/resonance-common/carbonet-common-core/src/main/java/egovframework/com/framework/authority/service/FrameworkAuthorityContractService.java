package egovframework.com.framework.authority.service;

import egovframework.com.platform.codex.model.AuthorInfoVO;
import egovframework.com.platform.codex.service.AuthGroupManageService;
import egovframework.com.framework.authority.model.FrameworkAuthorityContractVO;
import egovframework.com.framework.authority.model.FrameworkAuthorityOptionVO;
import egovframework.com.framework.authority.model.FrameworkAuthorityRoleContractVO;
import egovframework.com.framework.authority.model.FrameworkAuthorityTextVO;
import egovframework.com.framework.contract.model.FrameworkContractMetadataVO;
import egovframework.com.framework.contract.service.FrameworkContractMetadataService;
import org.springframework.stereotype.Service;

import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.HashSet;

@Service
public class FrameworkAuthorityContractService {

    private static final String ROLE_SYSTEM_MASTER = "ROLE_SYSTEM_MASTER";
    private static final String ROLE_SYSTEM_ADMIN = "ROLE_SYSTEM_ADMIN";
    private static final String ROLE_ADMIN = "ROLE_ADMIN";
    private static final String ROLE_OPERATION_ADMIN = "ROLE_OPERATION_ADMIN";
    private static final String ROLE_USER = "ROLE_USER";
    private static final String ROLE_COMPANY_ADMIN = "ROLE_COMPANY_ADMIN";

    private final AuthGroupManageService authGroupManageService;
    private final FrameworkAuthorityPolicyService frameworkAuthorityPolicyService;
    private final FrameworkContractMetadataService frameworkContractMetadataService;

    public FrameworkAuthorityContractService(
            AuthGroupManageService authGroupManageService,
            FrameworkAuthorityPolicyService frameworkAuthorityPolicyService,
            FrameworkContractMetadataService frameworkContractMetadataService) {
        this.authGroupManageService = authGroupManageService;
        this.frameworkAuthorityPolicyService = frameworkAuthorityPolicyService;
        this.frameworkContractMetadataService = frameworkContractMetadataService;
    }

    public FrameworkAuthorityContractVO getAuthorityContract() throws Exception {
        FrameworkContractMetadataVO metadata = frameworkContractMetadataService.getMetadata();
        FrameworkAuthorityContractVO contract = new FrameworkAuthorityContractVO();
        contract.setPolicyId(metadata.getAuthorityPolicyId());
        contract.setFrameworkId(metadata.getFrameworkId());
        contract.setContractVersion(metadata.getContractVersion());
        contract.setGeneratedAt(OffsetDateTime.now().toString());
        contract.setAuthorityRoles(buildAuthorityRoles());
        contract.setRoleCategoryOptions(buildRoleCategoryOptions());
        contract.setAssignmentAuthorities(buildAssignmentAuthorities());
        contract.setRoleCategories(buildRoleCategories());
        contract.setAllowedScopePolicies(new ArrayList<>(metadata.getAuthorityDefaults().getAllowedScopePolicies()));
        contract.setTierOrder(new ArrayList<>(metadata.getAuthorityDefaults().getTierOrder()));
        validateContract(metadata, contract);
        return contract;
    }

    private List<FrameworkAuthorityOptionVO> buildRoleCategoryOptions() {
        List<FrameworkAuthorityOptionVO> items = new ArrayList<>();
        for (FrameworkAuthorityPolicyService.OptionDescriptor descriptor
                : frameworkAuthorityPolicyService.buildRoleCategoryOptions(false, true)) {
            FrameworkAuthorityOptionVO item = new FrameworkAuthorityOptionVO();
            item.setCode(descriptor.getCode());
            item.setName(descriptor.getName());
            items.add(item);
        }
        return items;
    }

    private List<FrameworkAuthorityTextVO> buildAssignmentAuthorities() {
        List<FrameworkAuthorityTextVO> items = new ArrayList<>();
        for (FrameworkAuthorityPolicyService.TextDescriptor descriptor
                : frameworkAuthorityPolicyService.buildAssignmentAuthorities(false)) {
            FrameworkAuthorityTextVO item = new FrameworkAuthorityTextVO();
            item.setTitle(descriptor.getTitle());
            item.setDescription(descriptor.getDescription());
            items.add(item);
        }
        return items;
    }

    private List<FrameworkAuthorityTextVO> buildRoleCategories() {
        List<FrameworkAuthorityTextVO> items = new ArrayList<>();
        for (FrameworkAuthorityPolicyService.TextDescriptor descriptor
                : frameworkAuthorityPolicyService.buildRoleCategories(false)) {
            FrameworkAuthorityTextVO item = new FrameworkAuthorityTextVO();
            item.setTitle(descriptor.getTitle());
            item.setDescription(descriptor.getDescription());
            items.add(item);
        }
        return items;
    }

    private List<FrameworkAuthorityRoleContractVO> buildAuthorityRoles() throws Exception {
        Map<String, FrameworkAuthorityRoleContractVO> roleMap = new LinkedHashMap<>();
        for (RoleSeed seed : baselineSeeds()) {
            roleMap.put(seed.authorCode, buildRole(seed, resolveFeatureCodes(seed.authorCode)));
        }

        List<AuthorInfoVO> authorGroups = authGroupManageService.selectAuthorList();
        if (authorGroups != null) {
            for (AuthorInfoVO group : authorGroups) {
                if (group == null) {
                    continue;
                }
                String authorCode = safe(group.getAuthorCode()).toUpperCase(Locale.ROOT);
                if (authorCode.isEmpty()) {
                    continue;
                }
                RoleSeed seed = describeRole(group);
                roleMap.put(authorCode, buildRole(seed, resolveFeatureCodes(authorCode)));
            }
        }

        List<FrameworkAuthorityRoleContractVO> roles = new ArrayList<>(roleMap.values());
        roles.sort((left, right) -> {
            int levelCompare = Integer.compare(
                    right.getHierarchyLevel() == null ? 0 : right.getHierarchyLevel(),
                    left.getHierarchyLevel() == null ? 0 : left.getHierarchyLevel()
            );
            if (levelCompare != 0) {
                return levelCompare;
            }
            return safe(left.getAuthorCode()).compareTo(safe(right.getAuthorCode()));
        });
        return roles;
    }

    private List<RoleSeed> baselineSeeds() {
        List<RoleSeed> seeds = new ArrayList<>();
        seeds.add(new RoleSeed("MASTER", ROLE_SYSTEM_MASTER, "시스템 마스터", "webmaster 전용 전체 권한", "MASTER", "ADMIN", "global", 100, List.of(), true));
        seeds.add(new RoleSeed("SYSTEM_ADMIN", ROLE_SYSTEM_ADMIN, "시스템 관리자", "코드, 메뉴, 기능, 권한 설정 운영", "SYSTEM", "ADMIN", "global", 80, List.of("GENERAL_ADMIN"), true));
        seeds.add(new RoleSeed("GENERAL_ADMIN", ROLE_ADMIN, "일반 관리자", "기준 관리자 권한", "GENERAL_ADMIN", "ADMIN", "global", 60, List.of(), true));
        seeds.add(new RoleSeed("OPERATION_ADMIN", ROLE_OPERATION_ADMIN, "운영 관리자", "운영 업무와 회사 범위 업무 처리", "OPERATION", "ADMIN", "own-company", 40, List.of("GENERAL_MEMBER"), true));
        seeds.add(new RoleSeed("GENERAL_MEMBER", ROLE_USER, "일반 회원", "일반 사용자 기준 권한", "GENERAL_MEMBER", "MEMBER", "self", 20, List.of(), true));
        seeds.add(new RoleSeed("COMPANY_ADMIN", ROLE_COMPANY_ADMIN, "회원사 관리자", "소속 회사 범위의 회원/권한 운영", "COMPANY", "ADMIN", "own-company", 30, List.of("GENERAL_MEMBER"), true));
        return seeds;
    }

    private FrameworkAuthorityRoleContractVO buildRole(RoleSeed seed, List<String> featureCodes) {
        FrameworkAuthorityRoleContractVO role = new FrameworkAuthorityRoleContractVO();
        role.setRoleKey(seed.roleKey);
        role.setAuthorCode(seed.authorCode);
        role.setLabel(seed.label);
        role.setDescription(seed.description);
        role.setTier(seed.tier);
        role.setActorType(seed.actorType);
        role.setScopePolicy(seed.scopePolicy);
        role.setHierarchyLevel(seed.hierarchyLevel);
        role.setInherits(new ArrayList<>(seed.inherits));
        role.setFeatureCodes(new ArrayList<>(featureCodes));
        role.setBuiltIn(seed.builtIn);
        role.setBuilderReady(Boolean.TRUE);
        return role;
    }

    private RoleSeed describeRole(AuthorInfoVO group) {
        String authorCode = safe(group.getAuthorCode()).toUpperCase(Locale.ROOT);
        String label = firstNonBlank(group.getAuthorNm(), authorCode);
        String description = firstNonBlank(group.getAuthorDc(), inferDescription(authorCode));

        if (ROLE_SYSTEM_MASTER.equals(authorCode)) {
            return new RoleSeed("MASTER", authorCode, label, description, "MASTER", "ADMIN", "global", 100, List.of(), true);
        }
        if (ROLE_SYSTEM_ADMIN.equals(authorCode)) {
            return new RoleSeed("SYSTEM_ADMIN", authorCode, label, description, "SYSTEM", "ADMIN", "global", 80, List.of("GENERAL_ADMIN"), true);
        }
        if (ROLE_ADMIN.equals(authorCode)) {
            return new RoleSeed("GENERAL_ADMIN", authorCode, label, description, "GENERAL_ADMIN", "ADMIN", "global", 60, List.of(), true);
        }
        if (ROLE_OPERATION_ADMIN.equals(authorCode)) {
            return new RoleSeed("OPERATION_ADMIN", authorCode, label, description, "OPERATION", "ADMIN", "own-company", 40, List.of("GENERAL_MEMBER"), true);
        }
        if (ROLE_USER.equals(authorCode) || authorCode.startsWith("ROLE_MEMBER_") || authorCode.startsWith("ROLE_USER_") || authorCode.startsWith("ROLE_ACCOUNT_")) {
            return new RoleSeed(normalizeRoleKey(authorCode), authorCode, label, description, "GENERAL_MEMBER", "MEMBER", inferScopePolicy(authorCode), 20, List.of(), ROLE_USER.equals(authorCode));
        }
        if (ROLE_COMPANY_ADMIN.equals(authorCode)) {
            return new RoleSeed("COMPANY_ADMIN", authorCode, label, description, "COMPANY", "ADMIN", "own-company", 30, List.of("GENERAL_MEMBER"), true);
        }
        if (authorCode.startsWith("ROLE_DEPT_")) {
            return new RoleSeed(normalizeRoleKey(authorCode), authorCode, label, description, "DEPARTMENT", "MEMBER", "department", 25, List.of("GENERAL_MEMBER"), false);
        }
        return new RoleSeed(normalizeRoleKey(authorCode), authorCode, label, description, "CUSTOM", inferActorType(authorCode), inferScopePolicy(authorCode), 10, List.of(), false);
    }

    private List<String> resolveFeatureCodes(String authorCode) throws Exception {
        if (ROLE_SYSTEM_MASTER.equals(authorCode)) {
            return List.of("*");
        }
        List<String> codes = authGroupManageService.selectAuthorFeatureCodes(authorCode);
        if (codes == null || codes.isEmpty()) {
            return Collections.emptyList();
        }
        Set<String> normalized = new LinkedHashSet<>();
        for (String code : codes) {
            String value = safe(code).toUpperCase(Locale.ROOT);
            if (!value.isEmpty()) {
                normalized.add(value);
            }
        }
        return new ArrayList<>(normalized);
    }

    private String inferActorType(String authorCode) {
        String normalized = safe(authorCode).toUpperCase(Locale.ROOT);
        if (normalized.startsWith("ROLE_MEMBER_")
                || normalized.startsWith("ROLE_USER_")
                || normalized.startsWith("ROLE_ACCOUNT_")
                || ROLE_USER.equals(normalized)) {
            return "MEMBER";
        }
        return "ADMIN";
    }

    private String inferScopePolicy(String authorCode) {
        String normalized = safe(authorCode).toUpperCase(Locale.ROOT);
        if (ROLE_SYSTEM_MASTER.equals(normalized)
                || ROLE_SYSTEM_ADMIN.equals(normalized)
                || ROLE_ADMIN.equals(normalized)) {
            return "global";
        }
        if (ROLE_OPERATION_ADMIN.equals(normalized) || ROLE_COMPANY_ADMIN.equals(normalized)) {
            return "own-company";
        }
        if (normalized.startsWith("ROLE_DEPT_")) {
            return "department";
        }
        if (normalized.startsWith("ROLE_MEMBER_")
                || normalized.startsWith("ROLE_USER_")
                || normalized.startsWith("ROLE_ACCOUNT_")
                || ROLE_USER.equals(normalized)) {
            return "self";
        }
        return "role-scoped";
    }

    private String inferDescription(String authorCode) {
        String normalized = safe(authorCode).toUpperCase(Locale.ROOT);
        if (ROLE_SYSTEM_MASTER.equals(normalized)) {
            return "webmaster 전용 전체 권한";
        }
        if (ROLE_SYSTEM_ADMIN.equals(normalized)) {
            return "코드/페이지/기능/권한 운영 관리";
        }
        if (ROLE_ADMIN.equals(normalized)) {
            return "운영 관리자 계정에 기본 부여하는 기준 관리자 Role";
        }
        if (ROLE_OPERATION_ADMIN.equals(normalized)) {
            return "서비스 운영 전반 처리 권한";
        }
        if (ROLE_USER.equals(normalized)) {
            return "일반 사용자 계정에 기본 부여하는 기준 사용자 Role";
        }
        if (ROLE_COMPANY_ADMIN.equals(normalized)) {
            return "단일 회원사 범위의 권한/회원 운영 기준 롤";
        }
        if (normalized.startsWith("ROLE_DEPT_")) {
            return "부서 범위 권한";
        }
        if (normalized.startsWith("ROLE_MEMBER_") || normalized.startsWith("ROLE_USER_")) {
            return "회원/사용자 파생 권한";
        }
        return "커스텀 권한 그룹";
    }

    private String normalizeRoleKey(String authorCode) {
        return safe(authorCode)
                .toUpperCase(Locale.ROOT)
                .replaceFirst("^ROLE_", "")
                .replaceAll("[^A-Z0-9]+", "_");
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return "";
        }
        for (String value : values) {
            if (value != null && !value.trim().isEmpty()) {
                return value.trim();
            }
        }
        return "";
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private void validateContract(FrameworkContractMetadataVO metadata, FrameworkAuthorityContractVO contract) {
        if (!safe(metadata.getAuthorityPolicyId()).equals(safe(contract.getPolicyId()))) {
            throw new IllegalStateException("Framework authority contract policyId mismatch.");
        }
        if (!safe(metadata.getFrameworkId()).equals(safe(contract.getFrameworkId()))) {
            throw new IllegalStateException("Framework authority contract frameworkId mismatch.");
        }
        if (!safe(metadata.getContractVersion()).equals(safe(contract.getContractVersion()))) {
            throw new IllegalStateException("Framework authority contract version mismatch.");
        }

        Set<String> allowedScopePolicies = new HashSet<>();
        for (String value : metadata.getAuthorityDefaults().getAllowedScopePolicies()) {
            if (!safe(value).isEmpty()) {
                allowedScopePolicies.add(safe(value));
            }
        }
        Set<String> allowedTiers = new HashSet<>();
        for (String value : metadata.getAuthorityDefaults().getTierOrder()) {
            if (!safe(value).isEmpty()) {
                allowedTiers.add(safe(value));
            }
        }

        for (FrameworkAuthorityRoleContractVO role : contract.getAuthorityRoles()) {
            if (role == null) {
                continue;
            }
            String scopePolicy = safe(role.getScopePolicy());
            if (!scopePolicy.isEmpty() && !allowedScopePolicies.contains(scopePolicy)) {
                throw new IllegalStateException("Unsupported authority scopePolicy: " + scopePolicy
                        + " authorCode=" + safe(role.getAuthorCode()));
            }
            String tier = safe(role.getTier());
            if (!tier.isEmpty() && !allowedTiers.contains(tier)) {
                throw new IllegalStateException("Unsupported authority tier: " + tier
                        + " authorCode=" + safe(role.getAuthorCode()));
            }
        }
    }

    private static final class RoleSeed {
        private final String roleKey;
        private final String authorCode;
        private final String label;
        private final String description;
        private final String tier;
        private final String actorType;
        private final String scopePolicy;
        private final int hierarchyLevel;
        private final List<String> inherits;
        private final boolean builtIn;

        private RoleSeed(String roleKey,
                         String authorCode,
                         String label,
                         String description,
                         String tier,
                         String actorType,
                         String scopePolicy,
                         int hierarchyLevel,
                         List<String> inherits,
                         boolean builtIn) {
            this.roleKey = roleKey;
            this.authorCode = authorCode;
            this.label = label;
            this.description = description;
            this.tier = tier;
            this.actorType = actorType;
            this.scopePolicy = scopePolicy;
            this.hierarchyLevel = hierarchyLevel;
            this.inherits = inherits == null ? Collections.emptyList() : inherits;
            this.builtIn = builtIn;
        }
    }
}
