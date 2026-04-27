package egovframework.com.feature.admin.web;

import egovframework.com.platform.codex.service.AdminAuthorityPagePayloadSupport;

import egovframework.com.feature.auth.domain.entity.PasswordResetHistory;
import egovframework.com.feature.auth.service.AuthService;
import egovframework.com.platform.codex.service.AuthGroupManageService;
import egovframework.com.feature.auth.domain.entity.EmplyrInfo;
import egovframework.com.platform.codex.model.AuthorInfoVO;
import egovframework.com.platform.governance.model.vo.FeatureCatalogSectionVO;
import egovframework.com.feature.member.model.vo.EntrprsManageVO;
import egovframework.com.feature.member.model.vo.InsttFileVO;
import egovframework.com.feature.member.model.vo.InsttInfoVO;
import egovframework.com.feature.member.model.vo.InstitutionStatusVO;
import egovframework.com.feature.member.service.EnterpriseMemberService;
import egovframework.com.platform.service.observability.PlatformObservabilityCompanyScopePort;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.ui.Model;

import jakarta.servlet.http.HttpServletRequest;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminMemberPageModelAssembler {

    private static final Logger log = LoggerFactory.getLogger(AdminMemberPageModelAssembler.class);

    private final EnterpriseMemberService entrprsManageService;
    private final AuthService authService;
    private final AuthGroupManageService authGroupManageService;
    private final AdminAuthorityPagePayloadSupport authorityPagePayloadSupport;
    private final AdminRequestContextSupport adminRequestContextSupport;
    private final PlatformObservabilityCompanyScopePort platformObservabilityCompanyScopePort;
    private final AdminPermissionEditorService adminPermissionEditorService;
    private final AdminMemberEvidenceSupport adminMemberEvidenceSupport;
    private final AdminMemberAccessSupport adminMemberAccessSupport;

    public void populateCompanyAccountModel(String insttId, boolean isEn, Model model) {
        InstitutionStatusVO form = loadInstitutionInfoByInsttId(insttId);
        if (form == null || form.isEmpty()) {
            form = new InstitutionStatusVO();
            form.setEntrprsSeCode("E");
        }
        model.addAttribute("companyAccountForm", form);
        model.addAttribute("companyAccountFiles", loadInsttFilesByInsttId(insttId));
        model.addAttribute("companyAccountAction", isEn ? "/en/admin/member/company_account" : "/admin/member/company_account");
        model.addAttribute("companyAccountFileBaseUrl", isEn ? "/en/admin/member/company-file" : "/admin/member/company-file");
        model.addAttribute("companyAccountSaved", false);
        model.addAttribute("companyAccountErrors", Collections.emptyList());
    }

    public void populateCompanyDetailModel(String insttId, boolean isEn, HttpServletRequest request, Locale locale, Model model) {
        String normalizedInsttId = authorityPagePayloadSupport.safeValue(insttId);
        model.addAttribute("companyFiles", Collections.emptyList());
        model.addAttribute("companyTypeLabel", "-");
        model.addAttribute("companyStatusLabel", "-");
        model.addAttribute("companyStatusBadgeClass", resolveInstitutionStatusBadgeClass(""));
        if (normalizedInsttId.isEmpty()) {
            model.addAttribute("companyDetailError", isEn ? "Company ID is required." : "기관 ID가 필요합니다.");
            return;
        }
        InstitutionStatusVO company = loadInstitutionInfoByInsttId(normalizedInsttId);
        if (company == null || authorityPagePayloadSupport.safeValue(company.getInsttId()).isEmpty()) {
            model.addAttribute("companyDetailError", isEn ? "The company could not be found." : "대상 회원사를 찾을 수 없습니다.");
            return;
        }
        List<InsttFileVO> companyFiles = loadInsttFilesByInsttId(normalizedInsttId);
        model.addAttribute("company", company);
        model.addAttribute("companyFiles", companyFiles);
        model.addAttribute("companyTypeLabel", isEn
                ? resolveMembershipTypeLabelEn(company.getEntrprsSeCode())
                : resolveMembershipTypeLabel(company.getEntrprsSeCode()));
        model.addAttribute("companyStatusLabel", isEn
                ? resolveInstitutionStatusLabelEn(company.getInsttSttus())
                : resolveInstitutionStatusLabel(company.getInsttSttus()));
        model.addAttribute("companyStatusBadgeClass", resolveInstitutionStatusBadgeClass(company.getInsttSttus()));
        model.addAttribute("companyEditUrl",
                adminPrefix(request, locale) + "/member/company_account?insttId=" + urlEncode(normalizedInsttId));
        model.addAttribute("companyListUrl", adminPrefix(request, locale) + "/member/company_list");
    }

    public void populatePasswordResetHistory(
            String pageIndexParam,
            String searchKeyword,
            String resetSource,
            String requestedInsttId,
            HttpServletRequest request,
            Model model,
            boolean isEn) {
        int pageIndex = 1;
        if (pageIndexParam != null && !pageIndexParam.trim().isEmpty()) {
            try {
                pageIndex = Integer.parseInt(pageIndexParam.trim());
            } catch (NumberFormatException ignored) {
                pageIndex = 1;
            }
        }

        int currentPage = Math.max(pageIndex, 1);
        int pageSize = 10;
        String keyword = authorityPagePayloadSupport.safeValue(searchKeyword);
        String normalizedSource = authorityPagePayloadSupport.safeValue(resetSource).toUpperCase(Locale.ROOT);
        String currentUserId = adminRequestContextSupport.extractCurrentUserId(request);
        String currentUserAuthorCode = authorityPagePayloadSupport.resolveCurrentUserAuthorCode(currentUserId);
        boolean masterAccess = authorityPagePayloadSupport.hasMemberManagementMasterAccess(currentUserId, currentUserAuthorCode);
        String currentUserInsttId = authorityPagePayloadSupport.resolveCurrentUserInsttId(currentUserId);
        java.util.List<java.util.Map<String, String>> companyOptions = masterAccess
                ? platformObservabilityCompanyScopePort.loadAccessHistoryCompanyOptions()
                : platformObservabilityCompanyScopePort.buildScopedAccessHistoryCompanyOptions(currentUserInsttId);
        String selectedInsttId = masterAccess
                ? authorityPagePayloadSupport.resolveSelectedInsttId(requestedInsttId, companyOptions, true)
                : currentUserInsttId;
        model.addAttribute("companyOptions", companyOptions);
        model.addAttribute("selectedInsttId", selectedInsttId);
        model.addAttribute("canManageAllCompanies", masterAccess);

        Page<PasswordResetHistory> historyPage;
        try {
            historyPage = authService.searchPasswordResetHistories(
                    keyword,
                    normalizedSource,
                    selectedInsttId,
                    PageRequest.of(Math.max(currentPage - 1, 0), pageSize, Sort.by(Sort.Direction.DESC, "resetPnttm")));
        } catch (Exception e) {
            log.error("Failed to load credential reset history.", e);
            historyPage = Page.empty(PageRequest.of(0, pageSize));
            model.addAttribute("member_resetPasswordError",
                    isEn ? "Failed to load password reset history." : "비밀번호 초기화 이력을 불러오지 못했습니다.");
        }

        int totalCount = Math.toIntExact(historyPage.getTotalElements());
        int totalPages = Math.max(historyPage.getTotalPages(), 1);
        if (currentPage > totalPages) {
            currentPage = totalPages;
        }
        int startPage = Math.max(1, currentPage - 4);
        int endPage = Math.min(totalPages, startPage + 9);
        if (endPage - startPage < 9) {
            startPage = Math.max(1, endPage - 9);
        }
        int prevPage = Math.max(1, currentPage - 1);
        int nextPage = Math.min(totalPages, currentPage + 1);

        model.addAttribute("passwordResetHistoryList", buildPasswordResetHistoryListRows(historyPage.getContent()));
        model.addAttribute("totalCount", totalCount);
        model.addAttribute("pageIndex", currentPage);
        model.addAttribute("pageSize", pageSize);
        model.addAttribute("totalPages", totalPages);
        model.addAttribute("startPage", startPage);
        model.addAttribute("endPage", endPage);
        model.addAttribute("prevPage", prevPage);
        model.addAttribute("nextPage", nextPage);
        model.addAttribute("searchKeyword", keyword);
        model.addAttribute("resetSource", normalizedSource);
    }

    public void populateMemberEditModel(Model model, EntrprsManageVO member, boolean isEn, String currentUserId) throws Exception {
        ensureMemberEditDefaults(model, isEn);
        InstitutionStatusVO institutionInfo = adminMemberEvidenceSupport.loadInstitutionInfo(member);
        EntrprsManageVO displayMember = adminMemberEvidenceSupport.mergeMemberWithInstitutionInfo(member, institutionInfo);
        model.addAttribute("member", displayMember);
        model.addAttribute("memberEvidenceFiles", adminMemberEvidenceSupport.loadEvidenceFiles(displayMember));
        model.addAttribute("memberId", authorityPagePayloadSupport.safeValue(displayMember.getEntrprsmberId()));
        model.addAttribute("phoneNumber",
                formatPhoneNumber(displayMember.getAreaNo(), displayMember.getEntrprsMiddleTelno(), displayMember.getEntrprsEndTelno()));
        model.addAttribute("membershipTypeLabel", isEn
                ? resolveMembershipTypeLabelEn(displayMember.getEntrprsSeCode())
                : resolveMembershipTypeLabel(displayMember.getEntrprsSeCode()));
        model.addAttribute("businessRoleLabel", isEn
                ? resolveBusinessRoleLabelEn(displayMember.getEntrprsSeCode())
                : resolveBusinessRoleLabel(displayMember.getEntrprsSeCode()));
        model.addAttribute("accessScopes", isEn
                ? resolveAccessScopesEn(displayMember.getEntrprsSeCode())
                : resolveAccessScopes(displayMember.getEntrprsSeCode()));
        model.addAttribute("statusLabel", isEn
                ? resolveStatusLabelEn(displayMember.getEntrprsMberSttus())
                : resolveStatusLabel(displayMember.getEntrprsMberSttus()));
        model.addAttribute("memberStatusCode", authorityPagePayloadSupport.safeValue(displayMember.getEntrprsMberSttus()).toUpperCase(Locale.ROOT));
        model.addAttribute("memberTypeCode", authorityPagePayloadSupport.safeValue(displayMember.getEntrprsSeCode()).toUpperCase(Locale.ROOT));
        model.addAttribute("memberDocumentStatusLabel", isEn
                ? resolveDocumentStatusLabelEn(displayMember.getBizRegFilePath())
                : resolveDocumentStatusLabel(displayMember.getBizRegFilePath()));
        if (institutionInfo != null && !institutionInfo.isEmpty()) {
            model.addAttribute("institutionInfo", institutionInfo);
            model.addAttribute("institutionStatusLabel", isEn
                    ? resolveInstitutionStatusLabelEn(stringValue(institutionInfo.getInsttSttus()))
                    : resolveInstitutionStatusLabel(stringValue(institutionInfo.getInsttSttus())));
            model.addAttribute("institutionInsttId", stringValue(institutionInfo.getInsttId()));
            model.addAttribute("documentStatusLabel", isEn
                    ? resolveDocumentStatusLabelEn(stringValue(institutionInfo.getBizRegFilePath()))
                    : resolveDocumentStatusLabel(stringValue(institutionInfo.getBizRegFilePath())));
        } else {
            model.addAttribute("institutionStatusLabel", "-");
            model.addAttribute("institutionInsttId", "");
            model.addAttribute("documentStatusLabel", isEn ? "No document registered" : "등록 문서 없음");
        }
        List<Map<String, Object>> permissionAuthorGroupSections = buildMemberEditAuthorGroupSections(
                displayMember,
                isEn,
                currentUserId);
        adminPermissionEditorService.populatePermissionEditorModel(
                model,
                flattenPermissionAuthorGroupSections(permissionAuthorGroupSections),
                authorityPagePayloadSupport.safeValue(authGroupManageService.selectEnterpriseAuthorCodeByUserId(displayMember.getEntrprsmberId())),
                authorityPagePayloadSupport.safeValue(displayMember.getUniqId()),
                null,
                isEn,
                currentUserId);
        model.addAttribute("permissionAuthorGroupSections", permissionAuthorGroupSections);
    }

    public void populateMemberDetailModel(String memberId, HttpServletRequest request, Model model, boolean isEn) {
        ensureMemberDetailDefaults(model, isEn);
        String normalizedMemberId = authorityPagePayloadSupport.safeValue(memberId);
        model.addAttribute("memberId", normalizedMemberId);

        if (normalizedMemberId.isEmpty()) {
            model.addAttribute("member_detailError", isEn ? "Member ID was not provided." : "회원 ID가 전달되지 않았습니다.");
            return;
        }

        try {
            EntrprsManageVO member = entrprsManageService.selectEntrprsmberByMberId(normalizedMemberId);
            if (member == null || authorityPagePayloadSupport.safeValue(member.getEntrprsmberId()).isEmpty()) {
                model.addAttribute("member_detailError", isEn ? "Member information was not found." : "회원 정보를 찾을 수 없습니다.");
                return;
            }
            if (!adminMemberAccessSupport.canCurrentAdminAccessMember(request, member)) {
                model.addAttribute("member_detailError", isEn
                        ? "You can only view members in your own company."
                        : "본인 회사 소속 회원만 조회할 수 있습니다.");
                return;
            }

            InstitutionStatusVO institutionInfo = adminMemberEvidenceSupport.loadInstitutionInfo(member);
            EntrprsManageVO displayMember = adminMemberEvidenceSupport.mergeMemberWithInstitutionInfo(member, institutionInfo);
            model.addAttribute("member", displayMember);
            model.addAttribute("memberEvidenceFiles", adminMemberEvidenceSupport.loadEvidenceFiles(displayMember));
            model.addAttribute("phoneNumber",
                    formatPhoneNumber(displayMember.getAreaNo(), displayMember.getEntrprsMiddleTelno(), displayMember.getEntrprsEndTelno()));
            model.addAttribute("membershipTypeLabel", isEn
                    ? resolveMembershipTypeLabelEn(displayMember.getEntrprsSeCode())
                    : resolveMembershipTypeLabel(displayMember.getEntrprsSeCode()));
            model.addAttribute("statusLabel", isEn
                    ? resolveStatusLabelEn(displayMember.getEntrprsMberSttus())
                    : resolveStatusLabel(displayMember.getEntrprsMberSttus()));
            model.addAttribute("statusBadgeClass", resolveStatusBadgeClass(displayMember.getEntrprsMberSttus()));

            String selectedAuthorCode = authorityPagePayloadSupport.safeValue(authGroupManageService.selectEnterpriseAuthorCodeByUserId(displayMember.getEntrprsmberId()));
            adminPermissionEditorService.populatePermissionEditorModel(
                    model,
                    Collections.emptyList(),
                    selectedAuthorCode,
                    authorityPagePayloadSupport.safeValue(displayMember.getUniqId()),
                    null,
                    isEn,
                    adminRequestContextSupport.extractCurrentUserId(request));

            List<PasswordResetHistory> histories = authService.findRecentPasswordResetHistories(normalizedMemberId);
            model.addAttribute("passwordResetHistoryRows", buildPasswordResetHistoryListRows(histories));
        } catch (Exception e) {
            log.error("Failed to load member detail page api. memberId={}", normalizedMemberId, e);
            model.addAttribute("member_detailError",
                    isEn ? "An error occurred while retrieving member information." : "회원 정보 조회 중 오류가 발생했습니다.");
        }
    }

    public void populateAdminAccountEditModel(
            Model model,
            EmplyrInfo adminMember,
            boolean isEn,
            List<String> effectiveFeatureCodes,
            String currentUserId) throws Exception {
        ensureAdminAccountDefaults(model, isEn);
        model.addAttribute("adminPermissionTarget", adminMember);
        model.addAttribute("adminPermissionStatusLabel", isEn
                ? resolveStatusLabelEn(adminMember.getEmplyrStusCode())
                : resolveStatusLabel(adminMember.getEmplyrStusCode()));
        model.addAttribute("adminPermissionJoinedAt",
                adminMember.getSbscrbDe() == null ? "-"
                        : adminMember.getSbscrbDe().format(java.time.format.DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm")));
        Object adminAccountMode = model.getAttribute("adminAccountMode");
        model.addAttribute("adminAccountReadOnly", "detail".equalsIgnoreCase(adminAccountMode == null ? "" : adminAccountMode.toString()));
        List<Map<String, Object>> permissionAuthorGroupSections = buildAdminPermissionAuthorGroupSections(
                adminMember,
                isEn,
                currentUserId);
        adminPermissionEditorService.populatePermissionEditorModel(
                model,
                flattenPermissionAuthorGroupSections(permissionAuthorGroupSections),
                authorityPagePayloadSupport.safeValue(authGroupManageService.selectAuthorCodeByUserId(adminMember.getEmplyrId())),
                authorityPagePayloadSupport.safeValue(adminMember.getEsntlId()),
                effectiveFeatureCodes,
                isEn,
                currentUserId);
        model.addAttribute("permissionAuthorGroupSections", permissionAuthorGroupSections);
    }

    public void populateAdminAccountCreatePageModel(Model model, boolean isEn) {
        ensureAdminAccountCreateDefaults(model, isEn);
        try {
            List<FeatureCatalogSectionVO> featureSections =
                    authorityPagePayloadSupport.buildFeatureCatalogSections(authGroupManageService.selectFeatureCatalog(), isEn);
            java.util.Map<String, String> presetAuthorCodes = defaultAdminPresetAuthorCodes();
            java.util.Map<String, java.util.List<String>> presetFeatureCodes = new java.util.LinkedHashMap<>();
            for (java.util.Map.Entry<String, String> entry : presetAuthorCodes.entrySet()) {
                presetFeatureCodes.put(entry.getKey(), normalizeFeatureCodes(authGroupManageService.selectAuthorFeatureCodes(entry.getValue())));
            }
            model.addAttribute("permissionFeatureSections", featureSections);
            model.addAttribute("adminAccountCreatePresetAuthorCodes", presetAuthorCodes);
            model.addAttribute("adminAccountCreatePresetFeatureCodes", presetFeatureCodes);
            model.addAttribute("permissionFeatureCount", presetFeatureCodes.get("MASTER") == null ? 0 : presetFeatureCodes.get("MASTER").size());
            model.addAttribute("permissionPageCount",
                    authorityPagePayloadSupport.countSelectedPageCount(featureSections, presetFeatureCodes.get("MASTER")));
        } catch (Exception e) {
            log.error("Failed to populate admin account create page model.", e);
            model.addAttribute("adminAccountCreateError", isEn
                    ? "Failed to load role feature information."
                    : "권한 롤 기능 정보를 불러오지 못했습니다.");
            model.addAttribute("permissionFeatureSections", Collections.emptyList());
            model.addAttribute("adminAccountCreatePresetFeatureCodes", Collections.emptyMap());
            model.addAttribute("permissionFeatureCount", 0);
            model.addAttribute("permissionPageCount", 0);
        }
    }

    private InstitutionStatusVO loadInstitutionInfoByInsttId(String insttId) {
        String normalizedInsttId = authorityPagePayloadSupport.safeValue(insttId);
        if (normalizedInsttId.isEmpty()) {
            return null;
        }
        try {
            InsttInfoVO searchVO = new InsttInfoVO();
            searchVO.setInsttId(normalizedInsttId);
            return entrprsManageService.selectInsttInfoForStatus(searchVO);
        } catch (Exception e) {
            log.warn("Failed to load institution info. insttId={}", normalizedInsttId, e);
            return null;
        }
    }

    private List<InsttFileVO> loadInsttFilesByInsttId(String insttId) {
        String normalizedInsttId = authorityPagePayloadSupport.safeValue(insttId);
        if (normalizedInsttId.isEmpty()) {
            return Collections.emptyList();
        }
        try {
            List<InsttFileVO> fileList = entrprsManageService.selectInsttFiles(normalizedInsttId);
            return fileList == null ? Collections.emptyList() : fileList;
        } catch (Exception e) {
            log.warn("Failed to load institution file list. insttId={}", normalizedInsttId, e);
            return Collections.emptyList();
        }
    }

    private String stringValue(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private List<Map<String, String>> buildPasswordResetHistoryListRows(List<PasswordResetHistory> histories) {
        if (histories == null || histories.isEmpty()) {
            return Collections.emptyList();
        }
        List<Map<String, String>> rows = new ArrayList<>();
        for (PasswordResetHistory history : histories) {
            Map<String, String> row = new LinkedHashMap<>();
            row.put("resetAt", formatDateTime(history.getResetPnttm()));
            row.put("resetBy", authorityPagePayloadSupport.safeValue(history.getResetByUserId()));
            row.put("resetIp", authorityPagePayloadSupport.safeValue(history.getResetIp()));
            row.put("resetSource", authorityPagePayloadSupport.safeValue(history.getResetSource()));
            rows.add(row);
        }
        return rows;
    }

    private String formatDateTime(LocalDateTime value) {
        if (value == null) {
            return "-";
        }
        return value.format(DateTimeFormatter.ofPattern("yyyy.MM.dd HH:mm:ss"));
    }

    public List<Map<String, Object>> buildMemberEditAuthorGroupSections(
            EntrprsManageVO member,
            boolean isEn,
            String currentUserId) throws Exception {
        String insttId = authorityPagePayloadSupport.safeValue(member == null ? null : member.getInsttId());
        String membershipType = normalizeMembershipCode(authorityPagePayloadSupport.safeValue(member == null ? null : member.getEntrprsSeCode()).toUpperCase(Locale.ROOT));
        String currentUserAuthorCode = authorityPagePayloadSupport.resolveCurrentUserAuthorCode(currentUserId);
        boolean webmaster = "webmaster".equalsIgnoreCase(authorityPagePayloadSupport.safeValue(currentUserId));
        List<AuthorInfoVO> allAuthorGroups = authGroupManageService.selectAuthorList();

        List<AuthorInfoVO> memberTypeGroups = authorityPagePayloadSupport.filterMemberRegisterGeneralAuthorGroups(
                authorityPagePayloadSupport.filterAuthorGroups(
                        allAuthorGroups,
                        "USER",
                        currentUserId,
                        currentUserAuthorCode),
                membershipType);
        List<AuthorInfoVO> generalGroups = filterMemberEditGeneralAuthorGroups(
                authorityPagePayloadSupport.filterAuthorGroups(
                        allAuthorGroups,
                        "USER",
                        currentUserId,
                        currentUserAuthorCode));

        List<Map<String, String>> departmentRows = authorityPagePayloadSupport.buildDepartmentRoleRows(
                authGroupManageService.selectDepartmentRoleMappings(),
                isEn).stream()
                .filter(row -> insttId.equals(authorityPagePayloadSupport.safeValue(row.get("insttId"))))
                .collect(Collectors.toList());
        List<AuthorInfoVO> companyDepartmentGroups = authorityPagePayloadSupport.filterScopedDepartmentAuthorGroups(
                authorityPagePayloadSupport.filterAuthorGroupsByScope(
                        allAuthorGroups,
                        "DEPARTMENT",
                        insttId,
                        webmaster,
                        currentUserId,
                        currentUserAuthorCode),
                departmentRows);

        List<Map<String, Object>> sections = new ArrayList<>();
        addPermissionAuthorGroupSection(
                sections,
                isEn ? "Type-based Member Roles" : "회원 유형 기준 권한 롤",
                memberTypeGroups);
        addPermissionAuthorGroupSection(
                sections,
                isEn ? "Company Department Roles" : "소속 회원사 부서 권한",
                companyDepartmentGroups);
        addPermissionAuthorGroupSection(
                sections,
                isEn ? "General Roles" : "일반 권한 롤",
                generalGroups);
        return deduplicatePermissionAuthorGroupSections(sections);
    }

    public List<Map<String, Object>> buildAdminPermissionAuthorGroupSections(
            EmplyrInfo adminMember,
            boolean isEn,
            String currentUserId) throws Exception {
        String insttId = authorityPagePayloadSupport.safeValue(adminMember == null ? null : adminMember.getInsttId());
        String currentUserAuthorCode = authorityPagePayloadSupport.resolveCurrentUserAuthorCode(currentUserId);
        List<AuthorInfoVO> grantableAuthorGroups = authorityPagePayloadSupport.filterAuthorGroups(
                authGroupManageService.selectAuthorList(),
                "GENERAL",
                currentUserId,
                currentUserAuthorCode);
        String currentAssignedAuthorCode = adminMember == null
                ? ""
                : authorityPagePayloadSupport.safeValue(authGroupManageService.selectAuthorCodeByUserId(adminMember.getEmplyrId())).toUpperCase(Locale.ROOT);

        if ("ROLE_SYSTEM_MASTER".equals(currentAssignedAuthorCode)) {
            return authorityPagePayloadSupport.buildAdminRoleLayerSections(grantableAuthorGroups, isEn);
        }

        InstitutionStatusVO institutionInfo = loadInstitutionInfoByInsttId(insttId);
        String membershipType = normalizeMembershipCode(authorityPagePayloadSupport.safeValue(institutionInfo == null ? null : institutionInfo.getEntrprsSeCode()).toUpperCase(Locale.ROOT));
        if (membershipType.isEmpty()) {
            return authorityPagePayloadSupport.buildAdminRoleLayerSections(grantableAuthorGroups, isEn);
        }

        List<Map<String, Object>> sections = new ArrayList<>();
        addPermissionAuthorGroupSection(
                sections,
                isEn ? "Company Type Based Admin Roles" : "회원사 타입 기준 관리자 권한 롤",
                authorityPagePayloadSupport.filterAdminTypeScopedAuthorGroups(grantableAuthorGroups, membershipType));
        addPermissionAuthorGroupSection(
                sections,
                isEn ? "General Admin Roles" : "일반 관리자 권한 롤",
                authorityPagePayloadSupport.filterAdminGeneralAuthorGroups(grantableAuthorGroups));
        return deduplicatePermissionAuthorGroupSections(sections);
    }

    private List<AuthorInfoVO> filterMemberEditGeneralAuthorGroups(List<AuthorInfoVO> authorGroups) {
        if (authorGroups == null || authorGroups.isEmpty()) {
            return Collections.emptyList();
        }
        return authorGroups.stream()
                .filter(group -> !authorityPagePayloadSupport.isMembershipSpecificMemberAuthorCode(group == null ? null : group.getAuthorCode()))
                .collect(Collectors.toList());
    }

    public List<AuthorInfoVO> flattenPermissionAuthorGroupSections(List<Map<String, Object>> sections) {
        if (sections == null || sections.isEmpty()) {
            return Collections.emptyList();
        }
        LinkedHashMap<String, AuthorInfoVO> dedup = new LinkedHashMap<>();
        for (Map<String, Object> section : sections) {
            Object groups = section.get("groups");
            if (!(groups instanceof List<?>)) {
                continue;
            }
            for (Object item : (List<?>) groups) {
                if (!(item instanceof AuthorInfoVO)) {
                    continue;
                }
                AuthorInfoVO group = (AuthorInfoVO) item;
                String authorCode = authorityPagePayloadSupport.safeValue(group.getAuthorCode()).toUpperCase(Locale.ROOT);
                if (!authorCode.isEmpty() && !dedup.containsKey(authorCode)) {
                    dedup.put(authorCode, group);
                }
            }
        }
        return new ArrayList<>(dedup.values());
    }

    private void addPermissionAuthorGroupSection(
            List<Map<String, Object>> sections,
            String sectionLabel,
            List<AuthorInfoVO> groups) {
        if (groups == null || groups.isEmpty()) {
            return;
        }
        Map<String, Object> section = new LinkedHashMap<>();
        section.put("sectionLabel", sectionLabel);
        section.put("groups", groups);
        sections.add(section);
    }

    private List<Map<String, Object>> deduplicatePermissionAuthorGroupSections(List<Map<String, Object>> sections) {
        if (sections == null || sections.isEmpty()) {
            return Collections.emptyList();
        }
        java.util.Set<String> seenAuthorCodes = new java.util.LinkedHashSet<>();
        List<Map<String, Object>> sanitizedSections = new ArrayList<>();
        for (Map<String, Object> section : sections) {
            if (section == null) {
                continue;
            }
            Object groupsValue = section.get("groups");
            if (!(groupsValue instanceof List<?>)) {
                continue;
            }
            List<AuthorInfoVO> uniqueGroups = new ArrayList<>();
            for (Object candidate : (List<?>) groupsValue) {
                if (!(candidate instanceof AuthorInfoVO)) {
                    continue;
                }
                AuthorInfoVO group = (AuthorInfoVO) candidate;
                String authorCode = authorityPagePayloadSupport.safeValue(group.getAuthorCode()).toUpperCase(Locale.ROOT);
                if (authorCode.isEmpty() || seenAuthorCodes.contains(authorCode)) {
                    continue;
                }
                seenAuthorCodes.add(authorCode);
                uniqueGroups.add(group);
            }
            if (uniqueGroups.isEmpty()) {
                continue;
            }
            Map<String, Object> sanitizedSection = new LinkedHashMap<>(section);
            sanitizedSection.put("groups", uniqueGroups);
            sanitizedSections.add(sanitizedSection);
        }
        return sanitizedSections;
    }

    private String normalizeMembershipCode(String membershipType) {
        if ("EMITTER".equals(membershipType)) return "E";
        if ("PERFORMER".equals(membershipType)) return "P";
        if ("CENTER".equals(membershipType)) return "C";
        if ("GOV".equals(membershipType)) return "G";
        if ("E".equals(membershipType) || "P".equals(membershipType) || "C".equals(membershipType) || "G".equals(membershipType)) {
            return membershipType;
        }
        return "";
    }

    public void ensureMemberEditDefaults(Model model, boolean isEn) {
        model.addAttribute("member", null);
        model.addAttribute("memberEvidenceFiles", Collections.emptyList());
        model.addAttribute("phoneNumber", "-");
        model.addAttribute("membershipTypeLabel", isEn ? "Other" : "기타");
        model.addAttribute("businessRoleLabel", "-");
        model.addAttribute("accessScopes", Collections.emptyList());
        model.addAttribute("statusLabel", "-");
        model.addAttribute("memberStatusCode", "");
        model.addAttribute("memberTypeCode", "");
        model.addAttribute("memberTypeOptions", buildMemberTypeOptions(isEn));
        model.addAttribute("memberStatusOptions", buildMemberStatusOptions(isEn));
        model.addAttribute("memberDocumentStatusLabel", isEn ? "No document registered" : "등록 문서 없음");
        model.addAttribute("institutionInfo", Collections.emptyMap());
        model.addAttribute("institutionStatusLabel", "-");
        model.addAttribute("institutionInsttId", "");
        model.addAttribute("documentStatusLabel", isEn ? "No document registered" : "등록 문서 없음");
        ensurePermissionEditorDefaults(model);
    }

    private void ensureMemberDetailDefaults(Model model, boolean isEn) {
        model.addAttribute("member", null);
        model.addAttribute("memberId", "");
        model.addAttribute("member_detailError", null);
        model.addAttribute("memberEvidenceFiles", Collections.emptyList());
        model.addAttribute("phoneNumber", "-");
        model.addAttribute("membershipTypeLabel", isEn ? "Other" : "기타");
        model.addAttribute("statusLabel", "-");
        model.addAttribute("statusBadgeClass", resolveStatusBadgeClass(""));
        model.addAttribute("passwordResetHistoryRows", Collections.emptyList());
        ensurePermissionEditorDefaults(model);
    }

    public void ensureAdminAccountDefaults(Model model, boolean isEn) {
        model.addAttribute("adminPermissionTarget", null);
        model.addAttribute("adminPermissionUpdated", false);
        model.addAttribute("adminAccountMode", "");
        model.addAttribute("adminAccountReadOnly", false);
        model.addAttribute("adminPermissionStatusLabel", "-");
        model.addAttribute("adminPermissionJoinedAt", "-");
        ensurePermissionEditorDefaults(model);
    }

    private void ensureAdminAccountCreateDefaults(Model model, boolean isEn) {
        model.addAttribute("adminAccountCreateError", "");
        model.addAttribute("adminAccountCreatePreset", "MASTER");
        model.addAttribute("adminAccountCreatePresetAuthorCodes", defaultAdminPresetAuthorCodes());
        model.addAttribute("adminAccountCreatePresetFeatureCodes", Collections.emptyMap());
        model.addAttribute("adminAccountCreateCompanyName", "");
        ensurePermissionEditorDefaults(model);
    }

    private void ensurePermissionEditorDefaults(Model model) {
        model.addAttribute("permissionAuthorGroups", Collections.emptyList());
        model.addAttribute("permissionAuthorGroupSections", Collections.emptyList());
        model.addAttribute("permissionSelectedAuthorCode", "");
        model.addAttribute("permissionSelectedAuthorName", "");
        model.addAttribute("permissionSelectedAuthorProfile", Collections.emptyMap());
        model.addAttribute("permissionSelectedFeatureCodes", Collections.emptyList());
        model.addAttribute("permissionRequestedFeatureCodes", Collections.emptyList());
        model.addAttribute("permissionEffectiveFeatureCodes", Collections.emptyList());
        model.addAttribute("permissionEffectiveFeatureLabels", Collections.emptyList());
        model.addAttribute("permissionFeatureSections", Collections.emptyList());
        model.addAttribute("permissionFeatureCount", 0);
        model.addAttribute("permissionPageCount", 0);
        model.addAttribute("permissionFeatureEditorEnabled", false);
        model.addAttribute("permissionEditorError", "");
    }

    private String adminPrefix(HttpServletRequest request, Locale locale) {
        return adminRequestContextSupport.isEnglishRequest(request, locale) ? "/en/admin" : "/admin";
    }

    private String urlEncode(String value) {
        return java.net.URLEncoder.encode(authorityPagePayloadSupport.safeValue(value), java.nio.charset.StandardCharsets.UTF_8);
    }

    private String resolveMembershipTypeLabel(String code) {
        String v = authorityPagePayloadSupport.safeValue(code).toUpperCase(Locale.ROOT);
        if ("E".equals(v) || "EMITTER".equals(v)) return "CO2 배출 및 포집 기업";
        if ("P".equals(v) || "PERFORMER".equals(v)) return "CCUS 사업 수행 기업";
        if ("C".equals(v) || "CENTER".equals(v)) return "CCUS 진흥센터";
        if ("G".equals(v) || "GOV".equals(v)) return "주무관청 / 행정기관";
        return v.isEmpty() ? "기타" : v;
    }

    private String resolveMembershipTypeLabelEn(String code) {
        String v = authorityPagePayloadSupport.safeValue(code).toUpperCase(Locale.ROOT);
        if ("E".equals(v) || "EMITTER".equals(v)) return "CO2 Emitter/Capture Company";
        if ("P".equals(v) || "PERFORMER".equals(v)) return "CCUS Project Company";
        if ("C".equals(v) || "CENTER".equals(v)) return "CCUS Promotion Center";
        if ("G".equals(v) || "GOV".equals(v)) return "Government / Agency";
        return v.isEmpty() ? "Other" : v;
    }

    private String resolveInstitutionStatusLabel(String statusCode) {
        String v = authorityPagePayloadSupport.safeValue(statusCode).toUpperCase(Locale.ROOT);
        if ("A".equals(v)) return "검토 중";
        if ("P".equals(v)) return "가입 승인 완료";
        if ("R".equals(v)) return "반려";
        if ("X".equals(v)) return "차단";
        if ("D".equals(v)) return "삭제";
        return v.isEmpty() ? "-" : v;
    }

    private String resolveInstitutionStatusLabelEn(String statusCode) {
        String v = authorityPagePayloadSupport.safeValue(statusCode).toUpperCase(Locale.ROOT);
        if ("A".equals(v)) return "Under Review";
        if ("P".equals(v)) return "Approved";
        if ("R".equals(v)) return "Rejected";
        if ("X".equals(v)) return "Blocked";
        if ("D".equals(v)) return "Deleted";
        return v.isEmpty() ? "-" : v;
    }

    private String resolveInstitutionStatusBadgeClass(String statusCode) {
        String normalized = authorityPagePayloadSupport.safeValue(statusCode).toUpperCase(Locale.ROOT);
        if ("P".equals(normalized)) {
            return "bg-emerald-100 text-emerald-700 border border-emerald-200";
        }
        if ("A".equals(normalized)) {
            return "bg-blue-100 text-blue-700 border border-blue-200";
        }
        if ("R".equals(normalized)) {
            return "bg-amber-100 text-amber-700 border border-amber-200";
        }
        if ("D".equals(normalized)) {
            return "bg-slate-200 text-slate-700 border border-slate-300";
        }
        if ("X".equals(normalized)) {
            return "bg-red-100 text-red-700 border border-red-200";
        }
        return "bg-gray-100 text-gray-700 border border-gray-200";
    }

    private String resolveStatusLabel(String statusCode) {
        String v = authorityPagePayloadSupport.safeValue(statusCode).toUpperCase(Locale.ROOT);
        if ("P".equals(v)) return "활성";
        if ("A".equals(v)) return "승인 대기";
        if ("R".equals(v)) return "반려";
        if ("D".equals(v)) return "삭제";
        if ("X".equals(v)) return "차단";
        return v.isEmpty() ? "기타" : v;
    }

    private String resolveStatusLabelEn(String statusCode) {
        String v = authorityPagePayloadSupport.safeValue(statusCode).toUpperCase(Locale.ROOT);
        if ("P".equals(v)) return "Active";
        if ("A".equals(v)) return "Pending Approval";
        if ("R".equals(v)) return "Rejected";
        if ("D".equals(v)) return "Deleted";
        if ("X".equals(v)) return "Blocked";
        return v.isEmpty() ? "Other" : v;
    }

    private String resolveStatusBadgeClass(String statusCode) {
        String v = authorityPagePayloadSupport.safeValue(statusCode).toUpperCase(Locale.ROOT);
        if ("P".equals(v)) return "bg-emerald-100 text-emerald-700";
        if ("A".equals(v)) return "bg-blue-100 text-blue-700";
        if ("R".equals(v)) return "bg-amber-100 text-amber-700";
        if ("D".equals(v)) return "bg-slate-200 text-slate-700";
        if ("X".equals(v)) return "bg-red-100 text-red-700";
        return "bg-gray-100 text-gray-700";
    }

    private String resolveBusinessRoleLabel(String code) {
        String v = authorityPagePayloadSupport.safeValue(code).toUpperCase(Locale.ROOT);
        if ("E".equals(v)) return "배출량 산정 및 감축 실적 제출 담당";
        if ("P".equals(v)) return "CCUS 사업 수행 및 거래 연계 담당";
        if ("C".equals(v)) return "진흥센터 인증 및 통합 관제 담당";
        if ("G".equals(v)) return "정책 검토 및 행정 승인 담당";
        return "플랫폼 일반 사용자";
    }

    private String resolveBusinessRoleLabelEn(String code) {
        String v = authorityPagePayloadSupport.safeValue(code).toUpperCase(Locale.ROOT);
        if ("E".equals(v)) return "Emission calculation and reduction submission owner";
        if ("P".equals(v)) return "CCUS execution and trading liaison";
        if ("C".equals(v)) return "Certification and integrated monitoring operator";
        if ("G".equals(v)) return "Policy review and administrative approver";
        return "General platform user";
    }

    private List<String> resolveAccessScopes(String code) {
        String v = authorityPagePayloadSupport.safeValue(code).toUpperCase(Locale.ROOT);
        List<String> scopes = new ArrayList<>();
        if ("E".equals(v)) {
            scopes.add("배출량 자가산정");
            scopes.add("탄소발자국 모니터링");
            scopes.add("감축 보고서 제출");
            scopes.add("탄소 크레딧 조회");
        } else if ("P".equals(v)) {
            scopes.add("포집·수송·저장 데이터 입력");
            scopes.add("거래 매칭 및 요청 관리");
            scopes.add("실적 보고서 제출");
            scopes.add("거래 현황 모니터링");
        } else if ("C".equals(v)) {
            scopes.add("인증 보고서 검토");
            scopes.add("인증서 승인·발급");
            scopes.add("통합 관제 및 센서 모니터링");
            scopes.add("통계 시각화 관리");
        } else if ("G".equals(v)) {
            scopes.add("행정기관 검토");
            scopes.add("승인 상태 관리");
            scopes.add("정책 통계 조회");
            scopes.add("대외 제출 결과 확인");
        } else {
            scopes.add("기본 조회");
        }
        return scopes;
    }

    private List<String> resolveAccessScopesEn(String code) {
        String v = authorityPagePayloadSupport.safeValue(code).toUpperCase(Locale.ROOT);
        List<String> scopes = new ArrayList<>();
        if ("E".equals(v)) {
            scopes.add("Self-service emissions calculation");
            scopes.add("Carbon footprint monitoring");
            scopes.add("Reduction report submission");
            scopes.add("Carbon credit lookup");
        } else if ("P".equals(v)) {
            scopes.add("Capture/transport/storage data entry");
            scopes.add("Trade matching and request management");
            scopes.add("Performance report submission");
            scopes.add("Trade status monitoring");
        } else if ("C".equals(v)) {
            scopes.add("Certification report review");
            scopes.add("Certificate approval and issuance");
            scopes.add("Integrated monitoring and sensor oversight");
            scopes.add("Statistics visualization management");
        } else if ("G".equals(v)) {
            scopes.add("Administrative review");
            scopes.add("Approval state control");
            scopes.add("Policy statistics lookup");
            scopes.add("External submission verification");
        } else {
            scopes.add("Basic access");
        }
        return scopes;
    }

    private String resolveDocumentStatusLabel(String filePath) {
        return authorityPagePayloadSupport.safeValue(filePath).isEmpty() ? "등록 문서 없음" : "사업자등록증 등록됨";
    }

    private String resolveDocumentStatusLabelEn(String filePath) {
        return authorityPagePayloadSupport.safeValue(filePath).isEmpty() ? "No document registered" : "Business registration file attached";
    }

    private String formatPhoneNumber(String areaNo, String middleNo, String endNo) {
        List<String> parts = new ArrayList<>();
        if (!authorityPagePayloadSupport.safeValue(areaNo).isEmpty()) {
            parts.add(authorityPagePayloadSupport.safeValue(areaNo));
        }
        if (!authorityPagePayloadSupport.safeValue(middleNo).isEmpty()) {
            parts.add(authorityPagePayloadSupport.safeValue(middleNo));
        }
        if (!authorityPagePayloadSupport.safeValue(endNo).isEmpty()) {
            parts.add(authorityPagePayloadSupport.safeValue(endNo));
        }
        return parts.isEmpty() ? "-" : String.join("-", parts);
    }

    private Map<String, String> defaultAdminPresetAuthorCodes() {
        Map<String, String> presetAuthorCodes = new LinkedHashMap<>();
        presetAuthorCodes.put("MASTER", "ROLE_SYSTEM_MASTER");
        presetAuthorCodes.put("SYSTEM", "ROLE_SYSTEM_ADMIN");
        presetAuthorCodes.put("OPERATION", "ROLE_OPERATION_ADMIN");
        presetAuthorCodes.put("GENERAL", "ROLE_ADMIN");
        return presetAuthorCodes;
    }

    private List<String> normalizeFeatureCodes(List<String> featureCodes) {
        if (featureCodes == null || featureCodes.isEmpty()) {
            return Collections.emptyList();
        }
        java.util.Set<String> normalized = new java.util.LinkedHashSet<>();
        for (String featureCode : featureCodes) {
            String value = authorityPagePayloadSupport.safeValue(featureCode).toUpperCase(Locale.ROOT);
            if (!value.isEmpty()) {
                normalized.add(value);
            }
        }
        return new ArrayList<>(normalized);
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
}
