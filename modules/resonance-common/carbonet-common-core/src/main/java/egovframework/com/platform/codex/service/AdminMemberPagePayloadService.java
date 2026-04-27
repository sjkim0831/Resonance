package egovframework.com.platform.codex.service;

import egovframework.com.feature.admin.web.*;

import egovframework.com.platform.governance.service.AuthorRoleProfileService;
import egovframework.com.platform.bootstrap.service.AdminShellBootstrapPageService;
import egovframework.com.platform.codex.service.AuthGroupManageService;
import egovframework.com.platform.codex.model.AuthorInfoVO;
import egovframework.com.platform.codex.model.DepartmentRoleMappingVO;
import egovframework.com.feature.auth.domain.entity.EmplyrInfo;
import egovframework.com.feature.auth.domain.repository.EmployeeMemberRepository;
import egovframework.com.feature.member.model.vo.EntrprsManageVO;
import egovframework.com.feature.member.service.EnterpriseMemberService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.ui.ExtendedModelMap;
import org.springframework.util.ObjectUtils;

import jakarta.servlet.http.HttpServletRequest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class AdminMemberPagePayloadService {

    private static final Logger log = LoggerFactory.getLogger(AdminMemberPagePayloadService.class);
    private static final String MEMBER_REGISTER_VIEW_FEATURE_CODE = "MEMBER_REGISTER_VIEW";
    private static final String MEMBER_REGISTER_ID_CHECK_FEATURE_CODE = "MEMBER_REGISTER_ID_CHECK";
    private static final String MEMBER_REGISTER_ORG_SEARCH_FEATURE_CODE = "MEMBER_REGISTER_ORG_SEARCH";
    private static final String MEMBER_REGISTER_SAVE_FEATURE_CODE = "MEMBER_REGISTER_SAVE";

    private final EnterpriseMemberService entrprsManageService;
    private final EmployeeMemberRepository employMemberRepository;
    private final AuthGroupManageService authGroupManageService;
    private final AuthorRoleProfileService authorRoleProfileService;
    private final AdminAuthorityPagePayloadSupport authorityPagePayloadSupport;
    private final AdminCompanyScopeService adminCompanyScopeService;
    private final AdminRequestContextSupport adminRequestContextSupport;
    private final AdminMemberAccessSupport adminMemberAccessSupport;
    private final AdminListPageModelAssembler adminListPageModelAssembler;
    private final AdminMemberPageModelAssembler adminMemberPageModelAssembler;
    private final AdminShellBootstrapPageService adminShellBootstrapPageService;
    private final AdminMemberRegisterSupportService adminMemberRegisterSupportService;
    private final AdminAdminAccountAccessService adminAdminAccountAccessService;

    public Map<String, Object> buildMemberEditPagePayload(
            String memberId,
            String updated,
            HttpServletRequest request,
            Locale locale) {
        Map<String, Object> response = new LinkedHashMap<>();
        boolean isEn = adminRequestContextSupport.isEnglishRequest(request, locale);
        String normalizedMemberId = authorityPagePayloadSupport.safeValue(memberId);
        ExtendedModelMap model = new ExtendedModelMap();
        model.addAttribute("memberId", normalizedMemberId);
        model.addAttribute("member_editUpdated", "true".equalsIgnoreCase(authorityPagePayloadSupport.safeValue(updated)));
        adminRequestContextSupport.primeCsrfToken(request);
        adminMemberPageModelAssembler.ensureMemberEditDefaults(model, isEn);

        if (normalizedMemberId.isEmpty()) {
            model.addAttribute("member_editError", isEn ? "Member ID was not provided." : "회원 ID가 전달되지 않았습니다.");
        } else {
            try {
                EntrprsManageVO member = entrprsManageService.selectEntrprsmberByMberId(normalizedMemberId);
                if (member == null || authorityPagePayloadSupport.safeValue(member.getEntrprsmberId()).isEmpty()) {
                    model.addAttribute("member_editError", isEn ? "Member information was not found." : "회원 정보를 찾을 수 없습니다.");
                } else if (!adminMemberAccessSupport.canCurrentAdminAccessMember(request, member)) {
                    model.addAttribute("member_editError", isEn
                            ? "You can only edit members in your own company."
                            : "본인 회사 소속 회원만 수정할 수 있습니다.");
                } else {
                    adminMemberPageModelAssembler.populateMemberEditModel(
                            model,
                            member,
                            isEn,
                            adminRequestContextSupport.extractCurrentUserId(request));
                }
            } catch (Exception e) {
                log.error("Failed to load member edit page api. memberId={}", normalizedMemberId, e);
                model.addAttribute("member_editError", isEn
                        ? "An error occurred while retrieving member information."
                        : "회원 정보 조회 중 오류가 발생했습니다.");
            }
        }

        response.putAll(model);
        response.put("assignedRoleProfile",
                authorityPagePayloadSupport.toAuthorRoleProfileMap(
                        authorRoleProfileService.getProfile(String.valueOf(model.get("permissionSelectedAuthorCode")))));
        response.put("canViewMemberEdit", model.get("member") != null && model.get("member_editError") == null);
        response.put("canUseMemberSave", ObjectUtils.isEmpty(model.get("member_editError")));
        appendMemberManagementScope(response, request, isEn, model.get("member"));
        return response;
    }

    public Map<String, Object> buildMemberListPagePayload(
            String pageIndexParam,
            String searchKeyword,
            String membershipType,
            String sbscrbSttus,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminRequestContextSupport.isEnglishRequest(request, locale);
        ExtendedModelMap model = new ExtendedModelMap();
        adminRequestContextSupport.primeCsrfToken(request);
        adminListPageModelAssembler.populateMemberList(
                pageIndexParam,
                searchKeyword,
                membershipType,
                sbscrbSttus,
                model,
                request);
        Map<String, Object> response = new LinkedHashMap<>();
        response.putAll(model);
        String currentUserId = adminRequestContextSupport.extractCurrentUserId(request);
        String currentUserAuthorCode = authorityPagePayloadSupport.resolveCurrentUserAuthorCode(currentUserId);
        AdminCompanyScopeService.CompanyScope scope = adminCompanyScopeService.resolve(currentUserId);
        boolean canView = authorityPagePayloadSupport.hasMemberManagementCompanyOperatorAccess(currentUserId, currentUserAuthorCode)
                && adminCompanyScopeService.canExecuteScopedQuery(scope, false);
        response.put("canViewMemberList", canView);
        response.put("canUseMemberListActions", canView);
        appendMemberManagementScope(response, request, isEn, null);
        return response;
    }

    public Map<String, Object> buildCompanyListPagePayload(
            String pageIndexParam,
            String searchKeyword,
            String sbscrbSttus,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminRequestContextSupport.isEnglishRequest(request, locale);
        ExtendedModelMap model = new ExtendedModelMap();
        adminRequestContextSupport.primeCsrfToken(request);
        String currentUserId = adminRequestContextSupport.extractCurrentUserId(request);
        String currentUserAuthorCode = authorityPagePayloadSupport.resolveCurrentUserAuthorCode(currentUserId);
        boolean canView = authorityPagePayloadSupport.hasMemberManagementMasterAccess(currentUserId, currentUserAuthorCode);
        if (canView) {
            adminListPageModelAssembler.populateCompanyList(
                    pageIndexParam,
                    searchKeyword,
                    sbscrbSttus,
                    model,
                    request);
        } else {
            model.addAttribute("company_listError", isEn ? "Only global administrators can view the company list." : "회원사 목록은 전체 관리자만 조회할 수 있습니다.");
            model.addAttribute("company_list", Collections.emptyList());
            model.addAttribute("totalCount", 0);
        }
        Map<String, Object> response = new LinkedHashMap<>();
        response.putAll(model);
        response.put("canViewCompanyList", canView);
        response.put("canUseCompanyListActions", canView);
        return response;
    }

    public Map<String, Object> buildCompanyDetailPagePayload(
            String insttId,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminRequestContextSupport.isEnglishRequest(request, locale);
        String currentUserId = adminRequestContextSupport.extractCurrentUserId(request);
        String currentUserAuthorCode = authorityPagePayloadSupport.resolveCurrentUserAuthorCode(currentUserId);
        ExtendedModelMap model = new ExtendedModelMap();
        adminRequestContextSupport.primeCsrfToken(request);
        if (!authorityPagePayloadSupport.hasMemberManagementMasterAccess(currentUserId, currentUserAuthorCode)) {
            model.addAttribute("companyDetailError", isEn ? "Only global administrators can view company details." : "회원사 상세는 전체 관리자만 조회할 수 있습니다.");
            Map<String, Object> forbiddenResponse = new LinkedHashMap<>();
            forbiddenResponse.putAll(model);
            forbiddenResponse.put("canViewCompanyDetail", false);
            forbiddenResponse.put("canUseCompanyEditLink", false);
            forbiddenResponse.put("companyDetailStatus", "FORBIDDEN");
            return forbiddenResponse;
        }
        adminMemberPageModelAssembler.populateCompanyDetailModel(
                authorityPagePayloadSupport.safeValue(insttId),
                isEn,
                request,
                locale,
                model);
        Map<String, Object> response = new LinkedHashMap<>();
        response.putAll(model);
        boolean canView = model.getAttribute("company") != null && model.getAttribute("companyDetailError") == null;
        response.put("canViewCompanyDetail", canView);
        response.put("canUseCompanyEditLink", canView);
        response.put("companyDetailStatus", canView ? "OK" : "NOT_FOUND");
        return response;
    }

    public Map<String, Object> buildCompanyAccountPagePayload(
            String insttId,
            String saved,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminRequestContextSupport.isEnglishRequest(request, locale);
        String currentUserId = adminRequestContextSupport.extractCurrentUserId(request);
        String currentUserAuthorCode = authorityPagePayloadSupport.resolveCurrentUserAuthorCode(currentUserId);
        Map<String, Object> response = new LinkedHashMap<>();
        if (!authorityPagePayloadSupport.hasMemberManagementMasterAccess(currentUserId, currentUserAuthorCode)) {
            response.put("companyAccountErrors", Collections.singletonList(
                    isEn ? "Only global administrators can manage company accounts." : "회원사 관리는 전체 관리자만 처리할 수 있습니다."));
            response.put("canViewCompanyAccount", false);
            response.put("canUseCompanyAccountSave", false);
            return response;
        }
        ExtendedModelMap model = new ExtendedModelMap();
        adminMemberPageModelAssembler.populateCompanyAccountModel(authorityPagePayloadSupport.safeValue(insttId), isEn, model);
        model.addAttribute("companyAccountSaved", "Y".equalsIgnoreCase(authorityPagePayloadSupport.safeValue(saved)));
        response.putAll(model);
        response.put("canViewCompanyAccount", true);
        response.put("canUseCompanyAccountSave", true);
        response.put("isEditMode", !authorityPagePayloadSupport.safeValue(insttId).isEmpty());
        return response;
    }

    public Map<String, Object> buildAdminListPagePayload(
            String pageIndexParam,
            String searchKeyword,
            String sbscrbSttus,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminRequestContextSupport.isEnglishRequest(request, locale);
        ExtendedModelMap model = new ExtendedModelMap();
        adminRequestContextSupport.primeCsrfToken(request);
        adminListPageModelAssembler.populateAdminMemberList(
                pageIndexParam,
                searchKeyword,
                sbscrbSttus,
                model,
                request);
        Map<String, Object> response = new LinkedHashMap<>();
        response.putAll(model);
        boolean canViewAdminList = authorityPagePayloadSupport.hasMemberManagementCompanyAdminAccess(
                adminRequestContextSupport.extractCurrentUserId(request),
                authorityPagePayloadSupport.resolveCurrentUserAuthorCode(adminRequestContextSupport.extractCurrentUserId(request)));
        response.put("canViewAdminList", canViewAdminList);
        response.put("canUseAdminListActions", Boolean.TRUE.equals(model.getAttribute("canUseAdminListActions")));
        return response;
    }

    public Map<String, Object> buildMemberDetailPagePayload(
            String memberId,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminRequestContextSupport.isEnglishRequest(request, locale);
        ExtendedModelMap model = new ExtendedModelMap();
        adminRequestContextSupport.primeCsrfToken(request);
        adminMemberPageModelAssembler.populateMemberDetailModel(memberId, request, model, isEn);
        Map<String, Object> response = new LinkedHashMap<>();
        response.putAll(model);
        boolean canView = model.getAttribute("member") != null && model.getAttribute("member_detailError") == null;
        response.put("canViewMemberDetail", canView);
        response.put("canUseMemberEditLink", canView);
        response.put("memberDetailStatus", canView ? "OK" : (model.getAttribute("member") == null ? "NOT_FOUND" : "FORBIDDEN"));
        appendMemberManagementScope(response, request, isEn, model.getAttribute("member"));
        return response;
    }

    private void appendMemberManagementScope(
            Map<String, Object> response,
            HttpServletRequest request,
            boolean isEn,
            Object memberObject) {
        String currentUserId = adminRequestContextSupport.extractCurrentUserId(request);
        AdminCompanyScopeService.CompanyScope scope = adminCompanyScopeService.resolve(currentUserId);
        String actorInsttId = authorityPagePayloadSupport.safeValue(scope.getInsttId());
        boolean canManageAllCompanies = scope.isMasterLike();
        boolean canManageOwnCompany = !canManageAllCompanies && scope.canManageMemberScope();
        response.put("currentUserInsttId", actorInsttId);
        response.put("canManageAllCompanies", canManageAllCompanies);
        response.put("canManageOwnCompany", canManageOwnCompany);
        response.put("memberManagementScopeMode", canManageAllCompanies ? "ALL" : "OWN_COMPANY");
        response.put("memberManagementRequiresInsttId", !canManageAllCompanies);
        response.put("memberTypeOptions", buildMemberTypeOptions(isEn));
        response.put("memberStatusOptions", buildMemberStatusOptions(isEn));
        response.put("allowedMembershipTypes", List.of("E", "P", "C", "G"));
        if (memberObject instanceof EntrprsManageVO) {
            EntrprsManageVO member = (EntrprsManageVO) memberObject;
            response.put("targetMemberInsttId", authorityPagePayloadSupport.safeValue(member.getInsttId()));
            response.put("targetMemberType", normalizeMembershipCode(
                    authorityPagePayloadSupport.safeValue(member.getEntrprsSeCode()).toUpperCase(Locale.ROOT)));
        }
    }

    private List<Map<String, String>> buildMemberTypeOptions(boolean isEn) {
        List<Map<String, String>> options = new ArrayList<>();
        options.add(buildOption("", isEn ? "All" : "전체"));
        options.add(buildOption("E", isEn ? "CO2 Emitter/Capture Company" : "CO2 배출 및 포집 기업"));
        options.add(buildOption("P", isEn ? "CCUS Project Company" : "CCUS 사업 수행 기업"));
        options.add(buildOption("C", isEn ? "CCUS Promotion Center" : "CCUS 진흥센터"));
        options.add(buildOption("G", isEn ? "Government / Agency" : "주무관청 / 행정기관"));
        return options;
    }

    private List<Map<String, String>> buildMemberStatusOptions(boolean isEn) {
        List<Map<String, String>> options = new ArrayList<>();
        options.add(buildOption("", isEn ? "All" : "전체"));
        options.add(buildOption("P", isEn ? "Active" : "활성"));
        options.add(buildOption("A", isEn ? "Pending Approval" : "승인 대기"));
        options.add(buildOption("R", isEn ? "Rejected" : "반려"));
        options.add(buildOption("D", isEn ? "Deleted" : "삭제"));
        options.add(buildOption("X", isEn ? "Blocked" : "차단"));
        return options;
    }

    private Map<String, String> buildOption(String code, String label) {
        Map<String, String> option = new LinkedHashMap<>();
        option.put("code", code);
        option.put("label", label);
        return option;
    }

    public Map<String, Object> buildMemberStatsPagePayload(
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminRequestContextSupport.isEnglishRequest(request, locale);
        adminRequestContextSupport.primeCsrfToken(request);
        return adminShellBootstrapPageService.buildMemberStatsPageData(isEn);
    }

    public Map<String, Object> buildMemberRegisterPagePayload(
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminRequestContextSupport.isEnglishRequest(request, locale);
        adminRequestContextSupport.primeCsrfToken(request);
        Map<String, Object> response = new LinkedHashMap<>(adminMemberRegisterSupportService.buildMemberRegisterPageData(isEn));
        String currentUserId = adminRequestContextSupport.extractCurrentUserId(request);
        boolean webmaster = "webmaster".equalsIgnoreCase(authorityPagePayloadSupport.safeValue(currentUserId));
        java.util.Set<String> grantableFeatureCodes;
        try {
            grantableFeatureCodes = authorityPagePayloadSupport.resolveGrantableFeatureCodeSet(currentUserId, webmaster);
        } catch (Exception e) {
            log.error("Failed to resolve member-register feature grants. userId={}", authorityPagePayloadSupport.safeValue(currentUserId), e);
            grantableFeatureCodes = Collections.emptySet();
        }
        response.put("canViewMemberRegister", webmaster || hasFeature(grantableFeatureCodes, MEMBER_REGISTER_VIEW_FEATURE_CODE));
        response.put("canUseMemberRegisterIdCheck", webmaster || hasFeature(grantableFeatureCodes, MEMBER_REGISTER_ID_CHECK_FEATURE_CODE));
        response.put("canUseMemberRegisterOrgSearch", webmaster || hasFeature(grantableFeatureCodes, MEMBER_REGISTER_ORG_SEARCH_FEATURE_CODE));
        response.put("canUseMemberRegisterSave", webmaster || hasFeature(grantableFeatureCodes, MEMBER_REGISTER_SAVE_FEATURE_CODE));
        String currentUserAuthorCode = authorityPagePayloadSupport.resolveCurrentUserAuthorCode(currentUserId);
        String currentUserInsttId = authorityPagePayloadSupport.resolveCurrentUserInsttId(currentUserId);
        boolean canManageAllCompanies = authorityPagePayloadSupport.hasMemberManagementMasterAccess(currentUserId, currentUserAuthorCode);
        boolean canManageOwnCompany = authorityPagePayloadSupport.requiresMemberManagementCompanyScope(currentUserId, currentUserAuthorCode);
        List<Map<String, String>> departmentRows = Collections.emptyList();
        List<AuthorInfoVO> memberAssignableAuthorGroups = Collections.emptyList();
        try {
            List<DepartmentRoleMappingVO> mappings = authGroupManageService.selectDepartmentRoleMappings();
            departmentRows = new ArrayList<>(authorityPagePayloadSupport.buildDepartmentRoleRows(mappings, isEn));
            if (!canManageAllCompanies) {
                departmentRows.removeIf(row -> !currentUserInsttId.equals(authorityPagePayloadSupport.safeValue(row.get("insttId"))));
            }
            memberAssignableAuthorGroups = adminMemberRegisterSupportService.loadGrantableMemberAuthorGroups(currentUserId, currentUserAuthorCode);
        } catch (Exception e) {
            log.error("Failed to resolve member-register role mapping payload. userId={}", authorityPagePayloadSupport.safeValue(currentUserId), e);
        }
        response.put("currentUserInsttId", currentUserInsttId);
        response.put("canManageAllCompanies", canManageAllCompanies);
        response.put("canManageOwnCompany", canManageOwnCompany);
        response.put("departmentMappings", departmentRows);
        response.put("memberAssignableAuthorGroups", memberAssignableAuthorGroups);
        response.put("roleProfilesByAuthorCode",
                authorityPagePayloadSupport.toAuthorRoleProfileMapCollection(authorRoleProfileService.getProfiles(
                        authorityPagePayloadSupport.collectRoleProfileAuthorCodes(
                                departmentRows,
                                Collections.emptyList(),
                                memberAssignableAuthorGroups,
                                Collections.emptyList()))));
        response.put("memberRegisterFeatureCodes", java.util.List.of(
                MEMBER_REGISTER_VIEW_FEATURE_CODE,
                MEMBER_REGISTER_ID_CHECK_FEATURE_CODE,
                MEMBER_REGISTER_ORG_SEARCH_FEATURE_CODE,
                MEMBER_REGISTER_SAVE_FEATURE_CODE));
        return response;
    }

    private boolean hasFeature(java.util.Set<String> featureCodes, String featureCode) {
        if (featureCodes == null) {
            return true;
        }
        return featureCodes.contains(featureCode);
    }

    public Map<String, Object> buildPasswordResetPagePayload(
            String pageIndexParam,
            String searchKeyword,
            String resetSource,
            String insttId,
            String memberId,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminRequestContextSupport.isEnglishRequest(request, locale);
        ExtendedModelMap model = new ExtendedModelMap();
        adminRequestContextSupport.primeCsrfToken(request);
        String currentUserId = adminRequestContextSupport.extractCurrentUserId(request);
        String currentUserAuthorCode = authorityPagePayloadSupport.resolveCurrentUserAuthorCode(currentUserId);
        boolean requiresOwnCompanyAccess = authorityPagePayloadSupport.requiresOwnCompanyAccess(currentUserId, currentUserAuthorCode);
        if (requiresOwnCompanyAccess && authorityPagePayloadSupport.safeValue(memberId).isEmpty()) {
            model.addAttribute("passwordResetError", isEn
                    ? "Member ID is required for company-scoped administrators."
                    : "회사 범위 관리자에게는 회원 ID가 필요합니다.");
        } else {
            adminMemberPageModelAssembler.populatePasswordResetHistory(
                    pageIndexParam,
                    preferredResetHistoryKeyword(memberId, searchKeyword),
                    resetSource,
                    insttId,
                    request,
                    model,
                    isEn);
        }
        Map<String, Object> response = new LinkedHashMap<>();
        response.putAll(model);
        response.put("canViewResetHistory", true);
        response.put("canUseResetPassword", !requiresOwnCompanyAccess || !authorityPagePayloadSupport.safeValue(memberId).isEmpty());
        return response;
    }

    private String normalizeMembershipCode(String membershipType) {
        String normalized = authorityPagePayloadSupport.safeValue(membershipType).toUpperCase(Locale.ROOT);
        if ("EMITTER".equals(normalized) || "EMITTER_COMPANY".equals(normalized)) {
            return "E";
        }
        if ("PROJECT".equals(normalized) || "PROJECT_COMPANY".equals(normalized)) {
            return "P";
        }
        if ("CENTER".equals(normalized) || "PROMOTION_CENTER".equals(normalized)) {
            return "C";
        }
        if ("GOVERNMENT".equals(normalized) || "AGENCY".equals(normalized)) {
            return "G";
        }
        return normalized;
    }

    private String preferredResetHistoryKeyword(String memberId, String searchKeyword) {
        String keyword = authorityPagePayloadSupport.safeValue(searchKeyword).trim();
        if (!keyword.isEmpty()) {
            return keyword;
        }
        return authorityPagePayloadSupport.safeValue(memberId).trim();
    }

    public Map<String, Object> buildAdminAccountCreatePagePayload(
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminRequestContextSupport.isEnglishRequest(request, locale);
        String currentUserId = adminRequestContextSupport.extractCurrentUserId(request);
        String currentUserAuthorCode = authorityPagePayloadSupport.resolveCurrentUserAuthorCode(currentUserId);
        ExtendedModelMap model = new ExtendedModelMap();
        adminRequestContextSupport.primeCsrfToken(request);
        adminMemberPageModelAssembler.populateAdminAccountCreatePageModel(model, isEn);
        java.util.List<String> allowedPresets = new java.util.ArrayList<>();
        if (adminAdminAccountAccessService.canCreateAdminRolePreset(currentUserId, currentUserAuthorCode, "MASTER")) {
            allowedPresets.add("MASTER");
        }
        if (adminAdminAccountAccessService.canCreateAdminRolePreset(currentUserId, currentUserAuthorCode, "SYSTEM")) {
            allowedPresets.add("SYSTEM");
        }
        if (adminAdminAccountAccessService.canCreateAdminRolePreset(currentUserId, currentUserAuthorCode, "OPERATION")) {
            allowedPresets.add("OPERATION");
        }
        String currentUserInsttId = authorityPagePayloadSupport.resolveCurrentUserInsttId(currentUserId);
        egovframework.com.feature.member.model.vo.InstitutionStatusVO actorInstitution =
                adminAdminAccountAccessService.loadInstitutionInfoByInsttId(currentUserInsttId);
        model.addAttribute("adminAccountCreateAllowedPresets", allowedPresets);
        model.addAttribute("adminAccountCreateCanSearchCompanies",
                authorityPagePayloadSupport.hasMemberManagementMasterAccess(currentUserId, currentUserAuthorCode));
        model.addAttribute("adminAccountCreateCurrentInsttId", currentUserInsttId);
        model.addAttribute("adminAccountCreateCurrentCompanyName", actorInstitution == null ? "" : authorityPagePayloadSupport.safeValue(actorInstitution.getInsttNm()));
        model.addAttribute("adminAccountCreateCurrentBizrno", actorInstitution == null ? "" : authorityPagePayloadSupport.safeValue(actorInstitution.getBizrno()));
        model.addAttribute("adminAccountCreateCurrentRepresentativeName", actorInstitution == null ? "" : authorityPagePayloadSupport.safeValue(actorInstitution.getReprsntNm()));
        model.addAttribute("canUseAdminAccountCreate",
                adminAdminAccountAccessService.canCreateAdminAccounts(currentUserId, currentUserAuthorCode));
        Map<String, Object> response = new LinkedHashMap<>();
        response.putAll(model);
        response.put("currentUserId", currentUserId);
        response.put("canViewAdminAccountCreate",
                authorityPagePayloadSupport.hasMemberManagementCompanyAdminAccess(currentUserId, currentUserAuthorCode));
        response.put("canUseAdminAccountCreate", Boolean.TRUE.equals(model.getAttribute("canUseAdminAccountCreate")));
        return response;
    }

    public Map<String, Object> buildAdminAccountPermissionPagePayload(
            String emplyrId,
            String updated,
            String mode,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminRequestContextSupport.isEnglishRequest(request, locale);
        ExtendedModelMap model = new ExtendedModelMap();
        adminRequestContextSupport.primeCsrfToken(request);
        model.addAttribute("adminPermissionUpdated", "true".equalsIgnoreCase(authorityPagePayloadSupport.safeValue(updated)));
        model.addAttribute("adminAccountMode", authorityPagePayloadSupport.safeValue(mode));
        String normalizedEmplyrId = authorityPagePayloadSupport.safeValue(emplyrId);
        boolean canView = false;
        boolean canSave = false;
        if (!normalizedEmplyrId.isEmpty()) {
            try {
                Optional<EmplyrInfo> adminMemberOpt = employMemberRepository.findById(normalizedEmplyrId);
                if (!adminMemberOpt.isPresent()) {
                    model.addAttribute("adminPermissionError", isEn
                            ? "Administrator information was not found."
                            : "관리자 정보를 찾을 수 없습니다.");
                } else if (!adminAdminAccountAccessService.canCurrentAdminAccessAdmin(request, adminMemberOpt.get())) {
                    model.addAttribute("adminPermissionError", isEn
                            ? "You can only view administrators in your own company."
                            : "본인 회사에 속한 관리자만 조회할 수 있습니다.");
                } else {
                    adminMemberPageModelAssembler.populateAdminAccountEditModel(
                            model,
                            adminMemberOpt.get(),
                            isEn,
                            null,
                            adminRequestContextSupport.extractCurrentUserId(request));
                    canView = true;
                    String currentUserId = adminRequestContextSupport.extractCurrentUserId(request);
                    String currentUserAuthorCode = authorityPagePayloadSupport.resolveCurrentUserAuthorCode(currentUserId);
                    canSave = !Boolean.TRUE.equals(model.getAttribute("adminAccountReadOnly"))
                            && authorityPagePayloadSupport.hasMemberManagementCompanyAdminAccess(currentUserId, currentUserAuthorCode);
                }
            } catch (Exception e) {
                log.error("Failed to load admin account edit page api. emplyrId={}", normalizedEmplyrId, e);
                model.addAttribute("adminPermissionError", isEn
                        ? "An error occurred while retrieving administrator information."
                        : "관리자 정보 조회 중 오류가 발생했습니다.");
            }
        }
        Map<String, Object> response = new LinkedHashMap<>();
        response.putAll(model);
        response.put("canViewAdminPermissionEdit", canView);
        response.put("canUseAdminPermissionSave", canSave);
        return response;
    }
}
