package egovframework.com.feature.admin.web;

import egovframework.com.platform.codex.service.AdminAuthorityPagePayloadSupport;

import egovframework.com.feature.admin.dto.request.AdminMemberEditSaveRequestDTO;
import egovframework.com.platform.codex.model.AuthorInfoVO;
import egovframework.com.platform.codex.model.UserAuthorityTargetVO;
import egovframework.com.platform.codex.service.AuthGroupManageService;
import egovframework.com.feature.member.model.vo.EntrprsManageVO;
import egovframework.com.feature.member.service.EnterpriseMemberService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.ui.Model;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class AdminMemberEditCommandService {

    private static final Logger log = LoggerFactory.getLogger(AdminMemberEditCommandService.class);

    private final EnterpriseMemberService entrprsManageService;
    private final AuthGroupManageService authGroupManageService;
    private final AdminAuthorityPagePayloadSupport adminAuthorityPagePayloadSupport;
    private final AdminPermissionOverrideService adminPermissionOverrideService;
    private final AdminMemberAccessSupport adminMemberAccessSupport;
    private final AdminMemberEditSupportService adminMemberEditSupportService;
    private final AdminRequestContextSupport adminRequestContextSupport;
    private final AdminMemberPageModelAssembler adminMemberPageModelAssembler;
    private final AdminMemberEditNavigationSupport adminMemberEditNavigationSupport;
    private final AdminMemberEditAuditSupport adminMemberEditAuditSupport;
    private final AdminRoleAssignmentDbChangeCaptureSupport adminRoleAssignmentDbChangeCaptureSupport;

    public ResponseEntity<Map<String, Object>> submitApi(
            AdminMemberEditSaveRequestDTO payload,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminRequestContextSupport.isEnglishRequest(request, locale);
        String currentUserId = adminRequestContextSupport.extractCurrentUserId(request);
        String normalizedMemberId = safeString(payload == null ? null : payload.getMemberId());

        if (normalizedMemberId.isEmpty()) {
            return messageResponse(HttpServletResponse.SC_BAD_REQUEST,
                    isEn ? "Member ID was not provided." : "회원 ID가 전달되지 않았습니다.");
        }

        EntrprsManageVO member;
        try {
            member = entrprsManageService.selectEntrprsmberByMberId(normalizedMemberId);
        } catch (Exception e) {
            log.error("Failed to load member for edit submit api. memberId={}", normalizedMemberId, e);
            return messageResponse(HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                    isEn ? "An error occurred while retrieving member information." : "회원 정보 조회 중 오류가 발생했습니다.");
        }

        if (member == null || safeString(member.getEntrprsmberId()).isEmpty()) {
            return messageResponse(HttpServletResponse.SC_BAD_REQUEST,
                    isEn ? "Member information was not found." : "회원 정보를 찾을 수 없습니다.");
        }
        if (!adminMemberAccessSupport.canCurrentAdminAccessMember(request, member)) {
            return messageResponse(HttpServletResponse.SC_FORBIDDEN,
                    isEn ? "You can only edit members in your own company." : "본인 회사 소속 회원만 수정할 수 있습니다.");
        }

        EditContext context = prepareEditContext(
                member,
                normalizedMemberId,
                payload == null ? null : payload.getApplcntNm(),
                payload == null ? null : payload.getApplcntEmailAdres(),
                payload == null ? null : payload.getPhoneNumber(),
                payload == null ? null : payload.getEntrprsSeCode(),
                payload == null ? null : payload.getEntrprsMberSttus(),
                payload == null ? null : payload.getAuthorCode(),
                payload == null ? null : payload.getFeatureCodes(),
                payload == null ? null : payload.getZip(),
                payload == null ? null : payload.getAdres(),
                payload == null ? null : payload.getDetailAdres(),
                payload == null ? null : payload.getMarketingYn(),
                payload == null ? null : payload.getDeptNm(),
                request,
                currentUserId,
                isEn);
        if (!context.errors.isEmpty()) {
            return errorsResponse(HttpServletResponse.SC_BAD_REQUEST, context.errors);
        }

        try {
            String currentUserAuthorCode = adminAuthorityPagePayloadSupport.resolveCurrentUserAuthorCode(currentUserId);
            entrprsManageService.updateEntrprsmber(member);
            UserAuthorityTargetVO beforeAssignment = authGroupManageService.selectUserAuthorityTarget(
                    safeString(member.getInsttId()),
                    normalizedMemberId);
            authGroupManageService.updateEnterpriseUserRoleAssignment(normalizedMemberId, context.normalizedAuthorCode);
            adminRoleAssignmentDbChangeCaptureSupport.captureEnterpriseUserRoleAssignment(
                    request,
                    currentUserId,
                    currentUserAuthorCode,
                    safeString(member.getInsttId()),
                    safeString(member.getInsttId()),
                    normalizedMemberId,
                    beforeAssignment,
                    authGroupManageService.selectUserAuthorityTarget(safeString(member.getInsttId()), normalizedMemberId),
                    "AMENU_MEMBER_EDIT",
                    "member-edit");
            adminPermissionOverrideService.savePermissionOverrides(
                    safeString(member.getUniqId()),
                    "USR02",
                    context.baselineFeatureCodes,
                    context.normalizedFeatureCodes,
                    currentUserId,
                    adminMemberEditSupportService.resolveGrantableFeatureCodeSet(currentUserId));
        } catch (Exception e) {
            log.error("Failed to save member edit api. memberId={}", normalizedMemberId, e);
            return messageResponse(HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                    isEn ? "An error occurred while saving member information." : "회원 정보 저장 중 오류가 발생했습니다.");
        }

        adminMemberEditAuditSupport.recordMemberEditAudit(request, currentUserId, normalizedMemberId, context.normalizedAuthorCode);
        Map<String, Object> payloadBody = new LinkedHashMap<>();
        payloadBody.put("success", true);
        payloadBody.put("memberId", normalizedMemberId);
        return ResponseEntity.ok(payloadBody);
    }

    public String submitForm(
            String memberId,
            String applcntNm,
            String applcntEmailAdres,
            String phoneNumber,
            String entrprsSeCode,
            String entrprsMberSttus,
            String authorCode,
            List<String> featureCodes,
            String zip,
            String adres,
            String detailAdres,
            String marketingYn,
            String deptNm,
            HttpServletRequest request,
            Locale locale,
            Model model) {
        boolean isEn = adminRequestContextSupport.isEnglishRequest(request, locale);
        String currentUserId = adminRequestContextSupport.extractCurrentUserId(request);
        String viewName = adminMemberEditNavigationSupport.resolveViewName(isEn);
        String normalizedMemberId = safeString(memberId);
        model.addAttribute("memberId", normalizedMemberId);
        adminRequestContextSupport.primeCsrfToken(request);
        adminMemberPageModelAssembler.ensureMemberEditDefaults(model, isEn);

        if (normalizedMemberId.isEmpty()) {
            model.addAttribute("member_editError", isEn ? "Member ID was not provided." : "회원 ID가 전달되지 않았습니다.");
            return viewName;
        }

        EntrprsManageVO member;
        try {
            member = entrprsManageService.selectEntrprsmberByMberId(normalizedMemberId);
        } catch (Exception e) {
            log.error("Failed to load member for edit submit. memberId={}", normalizedMemberId, e);
            model.addAttribute("member_editError", isEn ? "An error occurred while retrieving member information." : "회원 정보 조회 중 오류가 발생했습니다.");
            return viewName;
        }

        if (member == null || safeString(member.getEntrprsmberId()).isEmpty()) {
            model.addAttribute("member_editError", isEn ? "Member information was not found." : "회원 정보를 찾을 수 없습니다.");
            return viewName;
        }
        if (!adminMemberAccessSupport.canCurrentAdminAccessMember(request, member)) {
            model.addAttribute("member_editError", isEn
                    ? "You can only edit members in your own company."
                    : "본인 회사 소속 회원만 수정할 수 있습니다.");
            return viewName;
        }

        EditContext context = prepareEditContext(
                member,
                normalizedMemberId,
                applcntNm,
                applcntEmailAdres,
                phoneNumber,
                entrprsSeCode,
                entrprsMberSttus,
                authorCode,
                featureCodes,
                zip,
                adres,
                detailAdres,
                marketingYn,
                deptNm,
                request,
                currentUserId,
                isEn);

        if (!context.errors.isEmpty()) {
            populateFailureModel(model, member, context, isEn, currentUserId, normalizedMemberId, true);
            model.addAttribute("member_editErrors", context.errors);
            return viewName;
        }

        try {
            String currentUserAuthorCode = adminAuthorityPagePayloadSupport.resolveCurrentUserAuthorCode(currentUserId);
            entrprsManageService.updateEntrprsmber(member);
            UserAuthorityTargetVO beforeAssignment = authGroupManageService.selectUserAuthorityTarget(
                    safeString(member.getInsttId()),
                    normalizedMemberId);
            authGroupManageService.updateEnterpriseUserRoleAssignment(normalizedMemberId, context.normalizedAuthorCode);
            adminRoleAssignmentDbChangeCaptureSupport.captureEnterpriseUserRoleAssignment(
                    request,
                    currentUserId,
                    currentUserAuthorCode,
                    safeString(member.getInsttId()),
                    safeString(member.getInsttId()),
                    normalizedMemberId,
                    beforeAssignment,
                    authGroupManageService.selectUserAuthorityTarget(safeString(member.getInsttId()), normalizedMemberId),
                    "AMENU_MEMBER_EDIT",
                    "member-edit");
            adminPermissionOverrideService.savePermissionOverrides(
                    safeString(member.getUniqId()),
                    "USR02",
                    context.baselineFeatureCodes,
                    context.normalizedFeatureCodes,
                    currentUserId,
                    adminMemberEditSupportService.resolveGrantableFeatureCodeSet(currentUserId));
            return adminMemberEditNavigationSupport.resolveSuccessRedirect(request, locale, normalizedMemberId);
        } catch (Exception e) {
            log.error("Failed to save member edit. memberId={}", normalizedMemberId, e);
            populateFailureModel(model, member, context, isEn, currentUserId, normalizedMemberId, false);
            model.addAttribute("member_editError", isEn ? "An error occurred while saving member information." : "회원 정보 저장 중 오류가 발생했습니다.");
            return viewName;
        }
    }

    private void populateFailureModel(
            Model model,
            EntrprsManageVO member,
            EditContext context,
            boolean isEn,
            String currentUserId,
            String normalizedMemberId,
            boolean validationPhase) {
        adminMemberEditSupportService.populateFailureModel(
                model,
                member,
                isEn,
                currentUserId,
                context.normalizedAuthorCode,
                context.permissionAuthorGroups,
                context.permissionAuthorGroupSections,
                context.normalizedFeatureCodes,
                validationPhase,
                normalizedMemberId);
    }

    private EditContext prepareEditContext(
            EntrprsManageVO member,
            String normalizedMemberId,
            String applcntNm,
            String applcntEmailAdres,
            String phoneNumber,
            String entrprsSeCode,
            String entrprsMberSttus,
            String authorCode,
            List<String> featureCodes,
            String zip,
            String adres,
            String detailAdres,
            String marketingYn,
            String deptNm,
            HttpServletRequest request,
            String currentUserId,
            boolean isEn) {
        EditContext context = new EditContext();
        context.normalizedApplicantName = safeString(applcntNm);
        context.normalizedEmail = safeString(applcntEmailAdres);
        context.normalizedZip = digitsOnly(zip);
        context.normalizedAddress = safeString(adres);
        context.normalizedDetailAddress = safeString(detailAdres);
        context.normalizedType = normalizeMembershipCode(safeString(entrprsSeCode).toUpperCase(Locale.ROOT));
        context.normalizedStatus = normalizeMemberStatusCode(safeString(entrprsMberSttus));
        context.normalizedAuthorCode = safeString(authorCode).toUpperCase(Locale.ROOT);
        context.normalizedFeatureCodes = adminMemberEditSupportService.normalizeFeatureCodes(featureCodes);
        context.normalizedMarketingYn = "Y".equalsIgnoreCase(safeString(marketingYn)) ? "Y" : "N";
        context.normalizedDeptNm = safeString(deptNm);
        context.phoneParts = splitPhoneNumber(phoneNumber);

        if (context.normalizedApplicantName.isEmpty()) {
            context.errors.add(isEn ? "Please enter the member name." : "회원명을 입력해 주세요.");
        }
        if (!isValidEmail(context.normalizedEmail)) {
            context.errors.add(isEn ? "Please enter a valid email address." : "올바른 이메일 주소를 입력해 주세요.");
        }
        if (context.phoneParts == null) {
            context.errors.add(isEn ? "Please enter a valid phone number." : "연락처 형식이 올바르지 않습니다.");
        }
        if (context.normalizedType.isEmpty()) {
            context.errors.add(isEn ? "Please select a valid member type." : "유효한 회원 유형을 선택해 주세요.");
        }
        if (context.normalizedStatus.isEmpty()) {
            context.errors.add(isEn ? "Please select a valid member status." : "유효한 회원 상태를 선택해 주세요.");
        }
        try {
            Set<String> grantableFeatureCodes = adminMemberEditSupportService.resolveGrantableFeatureCodeSet(currentUserId);
            String currentAssignedAuthorCode = adminMemberEditSupportService.loadCurrentAssignedAuthorCode(normalizedMemberId);
            context.permissionAuthorGroupSections = adminMemberEditSupportService.buildMemberEditAuthorGroupSections(
                    member,
                    isEn,
                    currentUserId);
            context.permissionAuthorGroups = adminMemberEditSupportService.flattenPermissionAuthorGroupSections(context.permissionAuthorGroupSections);
            if (context.normalizedAuthorCode.isEmpty()) {
                context.errors.add(isEn ? "Please select a role." : "권한 롤을 선택해 주세요.");
            } else if (!adminAuthorityPagePayloadSupport.isGrantableOrCurrentAuthorCode(
                    context.permissionAuthorGroups,
                    context.normalizedAuthorCode,
                    currentAssignedAuthorCode)) {
                context.errors.add(isEn ? "Please select a valid role." : "유효한 권한 롤을 선택해 주세요.");
            } else {
                context.baselineFeatureCodes = adminMemberEditSupportService.loadAuthorFeatureCodes(context.normalizedAuthorCode);
                context.normalizedFeatureCodes = adminMemberEditSupportService.filterFeatureCodesByGrantable(
                        context.normalizedFeatureCodes,
                        grantableFeatureCodes);
            }
        } catch (Exception e) {
            log.error("Failed to load permission data for member edit. memberId={}", normalizedMemberId, e);
            context.errors.add(isEn ? "Failed to load role and feature information." : "권한 롤 및 기능 정보를 불러오지 못했습니다.");
        }

        member.setApplcntNm(context.normalizedApplicantName);
        member.setApplcntEmailAdres(context.normalizedEmail);
        if (context.phoneParts != null) {
            member.setAreaNo(context.phoneParts[0]);
            member.setEntrprsMiddleTelno(context.phoneParts[1]);
            member.setEntrprsEndTelno(context.phoneParts[2]);
        }
        member.setEntrprsSeCode(context.normalizedType);
        member.setEntrprsMberSttus(context.normalizedStatus);
        member.setZip(context.normalizedZip);
        member.setAdres(context.normalizedAddress);
        member.setDetailAdres(context.normalizedDetailAddress);
        member.setMarketingYn(context.normalizedMarketingYn);
        member.setDeptNm(context.normalizedDeptNm);
        return context;
    }

    private ResponseEntity<Map<String, Object>> messageResponse(int status, String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", false);
        body.put("message", message);
        return ResponseEntity.status(status).body(body);
    }

    private ResponseEntity<Map<String, Object>> errorsResponse(int status, List<String> errors) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", false);
        body.put("errors", errors == null ? Collections.emptyList() : errors);
        return ResponseEntity.status(status).body(body);
    }

    private String normalizeMemberStatusCode(String statusCode) {
        String normalized = safeString(statusCode).toUpperCase(Locale.ROOT);
        switch (normalized) {
            case "A":
            case "P":
            case "R":
            case "D":
            case "X":
                return normalized;
            default:
                return "";
        }
    }

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }

    private String digitsOnly(String value) {
        return safeString(value).replaceAll("[^0-9]", "");
    }

    private String normalizeMembershipCode(String membershipType) {
        String normalized = safeString(membershipType).toUpperCase(Locale.ROOT);
        if ("EMITTER".equals(normalized) || "EMITTER_COMPANY".equals(normalized)) {
            return "E";
        }
        if ("PROJECT".equals(normalized) || "PROJECT_COMPANY".equals(normalized) || "PERFORMER".equals(normalized)) {
            return "P";
        }
        if ("CENTER".equals(normalized) || "PROMOTION_CENTER".equals(normalized)) {
            return "C";
        }
        if ("GOVERNMENT".equals(normalized) || "AGENCY".equals(normalized) || "GOV".equals(normalized)) {
            return "G";
        }
        return normalized;
    }

    private String[] splitPhoneNumber(String phoneNumber) {
        String digits = digitsOnly(phoneNumber);
        if (digits.length() == 9) {
            return new String[]{digits.substring(0, 2), digits.substring(2, 5), digits.substring(5)};
        }
        if (digits.length() == 10) {
            if (digits.startsWith("02")) {
                return new String[]{digits.substring(0, 2), digits.substring(2, 6), digits.substring(6)};
            }
            return new String[]{digits.substring(0, 3), digits.substring(3, 6), digits.substring(6)};
        }
        if (digits.length() == 11) {
            return new String[]{digits.substring(0, 3), digits.substring(3, 7), digits.substring(7)};
        }
        return null;
    }

    private boolean isValidEmail(String email) {
        String value = safeString(email);
        return !value.isEmpty() && value.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    }

    private static final class EditContext {
        private final List<String> errors = new ArrayList<>();
        private String normalizedApplicantName;
        private String normalizedEmail;
        private String normalizedZip;
        private String normalizedAddress;
        private String normalizedDetailAddress;
        private String normalizedType;
        private String normalizedStatus;
        private String normalizedAuthorCode;
        private List<String> normalizedFeatureCodes = Collections.emptyList();
        private String normalizedMarketingYn;
        private String normalizedDeptNm;
        private String[] phoneParts;
        private List<AuthorInfoVO> permissionAuthorGroups = Collections.emptyList();
        private List<Map<String, Object>> permissionAuthorGroupSections = Collections.emptyList();
        private List<String> baselineFeatureCodes = Collections.emptyList();
    }
}
