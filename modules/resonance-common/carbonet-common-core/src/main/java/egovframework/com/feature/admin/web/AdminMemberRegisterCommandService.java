package egovframework.com.feature.admin.web;

import egovframework.com.platform.codex.service.AdminAuthorityPagePayloadSupport;

import egovframework.com.feature.admin.dto.request.AdminMemberRegisterSaveRequestDTO;
import egovframework.com.platform.codex.model.AuthorInfoVO;
import egovframework.com.platform.codex.model.UserAuthorityTargetVO;
import egovframework.com.platform.codex.service.AuthGroupManageService;
import egovframework.com.feature.member.model.vo.EntrprsManageVO;
import egovframework.com.feature.member.model.vo.InstitutionStatusVO;
import egovframework.com.feature.member.service.EnterpriseMemberService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AdminMemberRegisterCommandService {

    private static final Logger log = LoggerFactory.getLogger(AdminMemberRegisterCommandService.class);

    private final EnterpriseMemberService entrprsManageService;
    private final AuthGroupManageService authGroupManageService;
    private final AdminAuthorityPagePayloadSupport adminAuthorityPagePayloadSupport;
    private final AdminPermissionOverrideService adminPermissionOverrideService;
    private final AdminMemberRegisterSupportService adminMemberRegisterSupportService;
    private final AdminMemberRegisterCommandSupportService adminMemberRegisterCommandSupportService;
    private final AdminRoleAssignmentDbChangeCaptureSupport adminRoleAssignmentDbChangeCaptureSupport;

    public ResponseEntity<Map<String, Object>> submit(
            AdminMemberRegisterSaveRequestDTO payload,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminMemberRegisterCommandSupportService.isEnglishRequest(request, locale);
        String currentUserId = adminMemberRegisterCommandSupportService.extractCurrentUserId(request);
        String currentUserAuthorCode = adminAuthorityPagePayloadSupport.resolveCurrentUserAuthorCode(currentUserId);
        boolean masterAccess = adminAuthorityPagePayloadSupport.hasMemberManagementMasterAccess(currentUserId, currentUserAuthorCode);
        boolean companyScopedAccess = adminAuthorityPagePayloadSupport.requiresMemberManagementCompanyScope(currentUserId, currentUserAuthorCode);
        if (!masterAccess && !companyScopedAccess) {
            return messageResponse(HttpServletResponse.SC_FORBIDDEN, isEn
                    ? "You do not have permission to register members."
                    : "회원을 등록할 권한이 없습니다.");
        }

        String normalizedMemberId = adminMemberRegisterCommandSupportService.trimToLen(
                adminMemberRegisterCommandSupportService.safeString(payload == null ? null : payload.getMemberId()), 20);
        String normalizedApplicantName = adminMemberRegisterCommandSupportService.trimToLen(
                adminMemberRegisterCommandSupportService.safeString(payload == null ? null : payload.getApplcntNm()), 60);
        String password = adminMemberRegisterCommandSupportService.safeString(payload == null ? null : payload.getPassword());
        String passwordConfirm = adminMemberRegisterCommandSupportService.safeString(payload == null ? null : payload.getPasswordConfirm());
        String normalizedEmail = adminMemberRegisterCommandSupportService.trimToLen(
                adminMemberRegisterCommandSupportService.safeString(payload == null ? null : payload.getApplcntEmailAdres()), 100);
        String requestedInsttId = adminMemberRegisterCommandSupportService.trimToLen(
                adminMemberRegisterCommandSupportService.safeString(payload == null ? null : payload.getInsttId()), 20);
        String scopedInsttId = masterAccess
                ? requestedInsttId
                : adminAuthorityPagePayloadSupport.resolveCurrentUserInsttId(currentUserId);
        String normalizedDeptNm = adminMemberRegisterCommandSupportService.trimToLen(
                adminMemberRegisterCommandSupportService.safeString(payload == null ? null : payload.getDeptNm()), 100);
        String normalizedAuthorCode = adminMemberRegisterCommandSupportService.safeString(payload == null ? null : payload.getAuthorCode()).toUpperCase(Locale.ROOT);
        String normalizedZip = adminMemberRegisterCommandSupportService.trimToLen(
                adminMemberRegisterCommandSupportService.digitsOnly(
                        adminMemberRegisterCommandSupportService.safeString(payload == null ? null : payload.getZip())), 6);
        String normalizedAddress = adminMemberRegisterCommandSupportService.trimToLen(
                adminMemberRegisterCommandSupportService.safeString(payload == null ? null : payload.getAdres()), 100);
        String normalizedDetailAddress = adminMemberRegisterCommandSupportService.trimToLen(
                adminMemberRegisterCommandSupportService.safeString(payload == null ? null : payload.getDetailAdres()), 100);
        String[] phoneParts = adminMemberRegisterCommandSupportService.splitPhoneNumber(payload == null ? null : payload.getPhoneNumber());

        List<String> errors = new ArrayList<>();
        if (!normalizedMemberId.matches("^[A-Za-z0-9]{6,12}$")) {
            errors.add(isEn ? "Use 6 to 12 letters or numbers for the member ID." : "회원 ID는 영문/숫자 6~12자로 입력해 주세요.");
        }
        if (normalizedApplicantName.isEmpty()) {
            errors.add(isEn ? "Please enter the member name." : "회원명을 입력해 주세요.");
        }
        if (!adminMemberRegisterCommandSupportService.isStrongAdminPassword(password)) {
            errors.add(isEn ? "Use at least 8 characters with letters, numbers, and symbols." : "비밀번호는 영문, 숫자, 특수문자를 포함해 8자 이상이어야 합니다.");
        }
        if (!password.equals(passwordConfirm)) {
            errors.add(isEn ? "The password confirmation does not match." : "비밀번호 확인이 일치하지 않습니다.");
        }
        if (!adminMemberRegisterCommandSupportService.isValidEmail(normalizedEmail)) {
            errors.add(isEn ? "Please enter a valid email address." : "올바른 이메일 주소를 입력해 주세요.");
        }
        if (phoneParts == null) {
            errors.add(isEn ? "Please enter a valid phone number." : "연락처 형식이 올바르지 않습니다.");
        }
        if (scopedInsttId.isEmpty()) {
            errors.add(isEn ? "Please select an institution." : "소속 기관을 선택해 주세요.");
        }
        if (normalizedDeptNm.isEmpty()) {
            errors.add(isEn ? "Please select or enter a department." : "부서를 선택하거나 입력해 주세요.");
        }
        if (normalizedZip.isEmpty()) {
            errors.add(isEn ? "Please enter the postal code." : "우편번호를 입력해 주세요.");
        }
        if (normalizedAddress.isEmpty()) {
            errors.add(isEn ? "Please enter the address." : "주소를 입력해 주세요.");
        }

        InstitutionStatusVO institutionInfo = null;
        if (errors.isEmpty()) {
            institutionInfo = adminMemberRegisterCommandSupportService.loadInstitutionInfoByInsttId(scopedInsttId);
            if (institutionInfo == null || institutionInfo.isEmpty()) {
                errors.add(isEn ? "The selected institution was not found." : "선택한 기관 정보를 찾을 수 없습니다.");
            }
        }

        String normalizedType = adminMemberRegisterCommandSupportService.normalizeMembershipCode(
                adminMemberRegisterCommandSupportService.safeString(payload == null ? null : payload.getEntrprsSeCode()).toUpperCase(Locale.ROOT));
        if (institutionInfo != null) {
            String institutionType = adminMemberRegisterCommandSupportService.normalizeMembershipCode(
                    adminMemberRegisterCommandSupportService.safeString(institutionInfo.getEntrprsSeCode()).toUpperCase(Locale.ROOT));
            if (!institutionType.isEmpty()) {
                normalizedType = institutionType;
            }
        }
        String canonicalInsttId = institutionInfo == null ? "" : institutionInfo.getRawInsttId();
        if (canonicalInsttId == null || canonicalInsttId.trim().isEmpty()) {
            canonicalInsttId = scopedInsttId;
        }
        if (normalizedType.isEmpty()) {
            errors.add(isEn ? "The institution membership type could not be resolved." : "기관 회원 유형을 확인할 수 없습니다.");
        }

        try {
            if (!normalizedMemberId.isEmpty() && entrprsManageService.checkIdDplct(normalizedMemberId) > 0) {
                errors.add(isEn ? "This member ID is already in use." : "이미 사용 중인 회원 ID입니다.");
            }
        } catch (Exception e) {
            log.error("Failed to check duplication while registering member. memberId={}", normalizedMemberId, e);
            errors.add(isEn ? "Failed to verify the member ID." : "회원 ID 중복 확인에 실패했습니다.");
        }

        List<AuthorInfoVO> memberAssignableAuthorGroups = Collections.emptyList();
        List<String> baselineFeatureCodes = Collections.emptyList();
        if (errors.isEmpty()) {
            try {
                memberAssignableAuthorGroups = adminAuthorityPagePayloadSupport.filterMemberRegisterGeneralAuthorGroups(
                        adminMemberRegisterSupportService.loadGrantableMemberAuthorGroups(currentUserId, currentUserAuthorCode),
                        normalizedType);
                if (normalizedAuthorCode.isEmpty()) {
                    errors.add(isEn ? "Please select a role." : "권한 롤을 선택해 주세요.");
                } else if (!adminAuthorityPagePayloadSupport.isGrantableOrCurrentAuthorCode(
                        memberAssignableAuthorGroups,
                        normalizedAuthorCode,
                        "")) {
                    errors.add(isEn ? "Please select a valid role within your assignable scope." : "부여 가능한 범위 내의 유효한 권한 롤을 선택해 주세요.");
                } else {
                    baselineFeatureCodes = adminMemberRegisterCommandSupportService.normalizeFeatureCodes(
                            authGroupManageService.selectAuthorFeatureCodes(normalizedAuthorCode));
                }
            } catch (Exception e) {
                log.error("Failed to load member register role scope. memberId={}", normalizedMemberId, e);
                errors.add(isEn ? "Failed to load assignable role information." : "부여 가능한 권한 롤 정보를 불러오지 못했습니다.");
            }
        }

        if (!errors.isEmpty()) {
            return errorsResponse(HttpServletResponse.SC_BAD_REQUEST, errors);
        }

        EntrprsManageVO member = new EntrprsManageVO();
        member.setUserTy("USR02");
        member.setEntrprsmberId(normalizedMemberId);
        member.setEntrprsMberPassword(password);
        member.setEntrprsMberPasswordHint("AUTO");
        member.setEntrprsMberPasswordCnsr("AUTO");
        member.setApplcntNm(normalizedApplicantName);
        member.setApplcntEmailAdres(normalizedEmail);
        member.setEntrprsSeCode(normalizedType);
        member.setEntrprsMberSttus("P");
        member.setInsttId(canonicalInsttId);
        member.setCmpnyNm(adminMemberRegisterCommandSupportService.trimToLen(
                adminMemberRegisterCommandSupportService.safeString(institutionInfo == null ? null : institutionInfo.getInsttNm()), 60));
        member.setBizrno(adminMemberRegisterCommandSupportService.trimToLen(
                adminMemberRegisterCommandSupportService.digitsOnly(
                        adminMemberRegisterCommandSupportService.safeString(institutionInfo == null ? null : institutionInfo.getBizrno())), 10));
        member.setCxfc(adminMemberRegisterCommandSupportService.trimToLen(
                adminMemberRegisterCommandSupportService.safeString(institutionInfo == null ? null : institutionInfo.getReprsntNm()), 60));
        String institutionZip = adminMemberRegisterCommandSupportService.trimToLen(
                adminMemberRegisterCommandSupportService.digitsOnly(
                        adminMemberRegisterCommandSupportService.safeString(institutionInfo == null ? null : institutionInfo.getZip())), 6);
        String institutionAddress = adminMemberRegisterCommandSupportService.trimToLen(
                adminMemberRegisterCommandSupportService.safeString(institutionInfo == null ? null : institutionInfo.getAdres()), 100);
        String institutionDetailAddress = adminMemberRegisterCommandSupportService.trimToLen(
                adminMemberRegisterCommandSupportService.safeString(institutionInfo == null ? null : institutionInfo.getDetailAdres()), 100);
        member.setZip(normalizedZip.isEmpty() ? (institutionZip.isEmpty() ? "000000" : institutionZip) : normalizedZip);
        member.setAdres(normalizedAddress.isEmpty() ? (institutionAddress.isEmpty() ? "주소미입력" : institutionAddress) : normalizedAddress);
        member.setDetailAdres(normalizedDetailAddress.isEmpty() ? institutionDetailAddress : normalizedDetailAddress);
        member.setDeptNm(normalizedDeptNm);
        member.setAreaNo(phoneParts[0]);
        member.setEntrprsMiddleTelno(phoneParts[1]);
        member.setEntrprsEndTelno(phoneParts[2]);
        member.setGroupId(null);
        member.setMarketingYn("N");
        member.setLockAt("N");

        try {
            entrprsManageService.insertEntrprsmber(member);
            entrprsManageService.ensureEnterpriseSecurityMapping(member.getUniqId());
            UserAuthorityTargetVO beforeAssignment = authGroupManageService.selectUserAuthorityTarget(canonicalInsttId, normalizedMemberId);
            authGroupManageService.updateEnterpriseUserRoleAssignment(normalizedMemberId, normalizedAuthorCode);
            adminRoleAssignmentDbChangeCaptureSupport.captureEnterpriseUserRoleAssignment(
                    request,
                    currentUserId,
                    currentUserAuthorCode,
                    canonicalInsttId,
                    canonicalInsttId,
                    normalizedMemberId,
                    beforeAssignment,
                    authGroupManageService.selectUserAuthorityTarget(canonicalInsttId, normalizedMemberId),
                    "AMENU_MEMBER_REGISTER",
                    "member-register");
            adminPermissionOverrideService.savePermissionOverrides(
                    adminMemberRegisterCommandSupportService.safeString(member.getUniqId()),
                    "USR02",
                    baselineFeatureCodes,
                    baselineFeatureCodes,
                    currentUserId,
                    adminMemberRegisterCommandSupportService.resolveGrantableFeatureCodeSet(currentUserId));
            adminMemberRegisterCommandSupportService.recordMemberRegisterAudit(
                    request,
                    currentUserId,
                    currentUserAuthorCode,
                    normalizedMemberId,
                    canonicalInsttId,
                    normalizedAuthorCode);
            Map<String, Object> payloadBody = new LinkedHashMap<>();
            payloadBody.put("success", true);
            payloadBody.put("memberId", normalizedMemberId);
            payloadBody.put("authorCode", normalizedAuthorCode);
            payloadBody.put("insttId", canonicalInsttId);
            return ResponseEntity.ok(payloadBody);
        } catch (Exception e) {
            log.error("Failed to register member. memberId={}, insttId={}", normalizedMemberId, canonicalInsttId, e);
            return messageResponse(HttpServletResponse.SC_INTERNAL_SERVER_ERROR,
                    isEn ? "An error occurred while saving the member registration." : "회원 등록 저장 중 오류가 발생했습니다.");
        }
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
}
