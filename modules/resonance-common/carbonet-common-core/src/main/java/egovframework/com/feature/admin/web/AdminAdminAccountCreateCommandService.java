package egovframework.com.feature.admin.web;

import egovframework.com.platform.codex.service.AdminAuthorityPagePayloadSupport;

import egovframework.com.feature.admin.dto.request.AdminAdminAccountCreateRequestDTO;
import egovframework.com.platform.codex.service.AuthGroupManageService;
import egovframework.com.feature.auth.domain.entity.EmplyrInfo;
import egovframework.com.feature.auth.domain.repository.EmployeeMemberRepository;
import egovframework.com.feature.member.model.vo.InstitutionStatusVO;
import egovframework.com.feature.member.model.vo.UserManageVO;
import egovframework.com.feature.member.service.EmployeeMemberService;
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
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class AdminAdminAccountCreateCommandService {

    private static final Logger log = LoggerFactory.getLogger(AdminAdminAccountCreateCommandService.class);

    private final EmployeeMemberService userManageService;
    private final EmployeeMemberRepository employMemberRepository;
    private final AuthGroupManageService authGroupManageService;
    private final AdminAuthorityPagePayloadSupport adminAuthorityPagePayloadSupport;
    private final AdminPermissionOverrideService adminPermissionOverrideService;
    private final AdminAdminAccountAccessService adminAdminAccountAccessService;
    private final AdminAdminAccountCreateSupportService adminAdminAccountCreateSupportService;
    private final AdminRequestContextSupport adminRequestContextSupport;
    private final AdminRoleAssignmentDbChangeCaptureSupport adminRoleAssignmentDbChangeCaptureSupport;

    public ResponseEntity<Map<String, Object>> submitApi(
            AdminAdminAccountCreateRequestDTO payload,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminRequestContextSupport.isEnglishRequest(request, locale);
        String currentUserId = adminRequestContextSupport.extractCurrentUserId(request);
        String currentUserAuthorCode = adminAuthorityPagePayloadSupport.resolveCurrentUserAuthorCode(currentUserId);
        if (!adminAdminAccountAccessService.canCreateAdminAccounts(currentUserId, currentUserAuthorCode)) {
            return messageResponse(HttpServletResponse.SC_FORBIDDEN, isEn
                    ? "You do not have permission to create administrator accounts."
                    : "관리자 계정을 생성할 권한이 없습니다.");
        }

        String adminId = trimToLen(adminAdminAccountCreateSupportService.safeString(payload == null ? null : payload.getAdminId()), 20);
        String adminName = trimToLen(adminAdminAccountCreateSupportService.safeString(payload == null ? null : payload.getAdminName()), 60);
        String password = adminAdminAccountCreateSupportService.safeString(payload == null ? null : payload.getPassword());
        String passwordConfirm = adminAdminAccountCreateSupportService.safeString(payload == null ? null : payload.getPasswordConfirm());
        String adminEmail = trimToLen(adminAdminAccountCreateSupportService.safeString(payload == null ? null : payload.getAdminEmail()), 100);
        String deptNm = trimToLen(adminAdminAccountCreateSupportService.safeString(payload == null ? null : payload.getDeptNm()), 100);
        String insttId = trimToLen(adminAdminAccountCreateSupportService.safeString(payload == null ? null : payload.getInsttId()), 20);
        String phone1 = trimToLen(digitsOnly(payload == null ? null : payload.getPhone1()), 4);
        String phone2 = trimToLen(digitsOnly(payload == null ? null : payload.getPhone2()), 4);
        String phone3 = trimToLen(digitsOnly(payload == null ? null : payload.getPhone3()), 4);
        String rolePreset = adminAdminAccountCreateSupportService.safeString(payload == null ? null : payload.getRolePreset()).toUpperCase(Locale.ROOT);
        String normalizedZip = trimToLen(digitsOnly(adminAdminAccountCreateSupportService.safeString(payload == null ? null : payload.getZip())), 6);
        String normalizedAddress = trimToLen(adminAdminAccountCreateSupportService.safeString(payload == null ? null : payload.getAdres()), 100);
        String normalizedDetailAddress = trimToLen(adminAdminAccountCreateSupportService.safeString(payload == null ? null : payload.getDetailAdres()), 100);
        String authorCode = adminAdminAccountCreateSupportService.resolveAdminPresetAuthorCode(rolePreset);
        List<String> featureCodes = adminAdminAccountCreateSupportService.normalizeFeatureCodes(payload == null ? null : payload.getFeatureCodes());
        if (!adminAdminAccountAccessService.canCreateAdminRolePreset(currentUserId, currentUserAuthorCode, rolePreset)) {
            return messageResponse(HttpServletResponse.SC_FORBIDDEN, isEn
                    ? "You cannot create the selected administrator type."
                    : "선택한 관리자 유형을 생성할 수 없습니다.");
        }
        String scopedInsttId = adminAuthorityPagePayloadSupport.hasMemberManagementMasterAccess(currentUserId, currentUserAuthorCode)
                ? insttId
                : adminAuthorityPagePayloadSupport.resolveCurrentUserInsttId(currentUserId);

        List<String> errors = new ArrayList<>();
        if (!adminId.matches("^[A-Za-z0-9]{6,16}$")) {
            errors.add(isEn ? "Use 6 to 16 letters or numbers for the administrator ID." : "관리자 ID는 영문/숫자 6~16자로 입력해 주세요.");
        }
        if (adminName.isEmpty()) {
            errors.add(isEn ? "Please enter the administrator name." : "관리자 이름을 입력해 주세요.");
        }
        if (!isStrongAdminPassword(password)) {
            errors.add(isEn ? "Use at least 8 characters with letters, numbers, and symbols." : "비밀번호는 영문, 숫자, 특수문자를 포함해 8자 이상이어야 합니다.");
        }
        if (!password.equals(passwordConfirm)) {
            errors.add(isEn ? "The password confirmation does not match." : "비밀번호 확인이 일치하지 않습니다.");
        }
        if (!isValidEmail(adminEmail)) {
            errors.add(isEn ? "Please enter a valid email address." : "올바른 이메일 주소를 입력해 주세요.");
        }
        if (phone1.isEmpty() || phone2.length() < 3 || phone3.length() != 4) {
            errors.add(isEn ? "Please enter a valid contact number." : "올바른 연락처를 입력해 주세요.");
        }
        if (authorCode.isEmpty()) {
            errors.add(isEn ? "Please select a valid administrator role preset." : "유효한 관리자 권한 프리셋을 선택해 주세요.");
        }
        if (normalizedZip.isEmpty()) {
            errors.add(isEn ? "Please enter the postal code." : "우편번호를 입력해 주세요.");
        }
        if (normalizedAddress.isEmpty()) {
            errors.add(isEn ? "Please enter the address." : "주소를 입력해 주세요.");
        }
        if (!"MASTER".equals(rolePreset) && scopedInsttId.isEmpty()) {
            errors.add(isEn ? "Please select an affiliated company or institution." : "소속 기관 또는 기업을 선택해 주세요.");
        }

        try {
            if (!adminId.isEmpty() && userManageService.checkIdDplct(adminId) > 0) {
                errors.add(isEn ? "This administrator ID is already in use." : "이미 사용 중인 관리자 ID입니다.");
            }
        } catch (Exception e) {
            log.error("Failed to check duplication while creating admin account. adminId={}", adminId, e);
            errors.add(isEn ? "Failed to verify the administrator ID." : "관리자 ID 중복 확인에 실패했습니다.");
        }

        InstitutionStatusVO institutionInfo = null;
        if (!scopedInsttId.isEmpty()) {
            institutionInfo = adminAdminAccountAccessService.loadInstitutionInfoByInsttId(scopedInsttId);
            if (institutionInfo == null || institutionInfo.isEmpty()) {
                errors.add(isEn ? "The selected company or institution was not found." : "선택한 기관 또는 기업 정보를 찾을 수 없습니다.");
            }
        }

        List<String> baselineFeatureCodes = Collections.emptyList();
        if (errors.isEmpty()) {
            try {
                baselineFeatureCodes = adminAdminAccountCreateSupportService.loadAuthorFeatureCodes(authorCode);
            } catch (Exception e) {
                log.error("Failed to load baseline feature codes for admin account creation. authorCode={}", authorCode, e);
                errors.add(isEn ? "Failed to load role feature information." : "권한 롤 기능 정보를 불러오지 못했습니다.");
            }
        }

        if (!errors.isEmpty()) {
            return errorsResponse(HttpServletResponse.SC_BAD_REQUEST, errors);
        }

        String fullPhone = buildPhoneNumber(phone1, phone2, phone3);
        try {
            String institutionZip = trimToLen(digitsOnly(adminAdminAccountCreateSupportService.safeString(institutionInfo == null ? null : institutionInfo.getZip())), 6);
            String institutionAddress = trimToLen(adminAdminAccountCreateSupportService.safeString(institutionInfo == null ? null : institutionInfo.getAdres()), 100);
            String institutionDetailAddress = trimToLen(adminAdminAccountCreateSupportService.safeString(institutionInfo == null ? null : institutionInfo.getDetailAdres()), 100);
            UserManageVO userManageVO = new UserManageVO();
            userManageVO.setEmplyrId(adminId);
            userManageVO.setEmplyrNm(adminName);
            userManageVO.setPassword(password);
            userManageVO.setEmailAdres(adminEmail);
            userManageVO.setAreaNo(phone1);
            userManageVO.setHomemiddleTelno(phone2);
            userManageVO.setHomeendTelno(phone3);
            userManageVO.setMoblphonNo(fullPhone);
            userManageVO.setOffmTelno(fullPhone);
            userManageVO.setEmplyrSttusCode("P");
            userManageVO.setOrgnztId(scopedInsttId);
            userManageVO.setOfcpsNm(deptNm);
            userManageVO.setGroupId(scopedInsttId);
            userManageVO.setLockAt("N");
            userManageVO.setPasswordHint("AUTO");
            userManageVO.setPasswordCnsr("AUTO");
            userManageVO.setIhidnum("");
            userManageVO.setSexdstnCode("");
            userManageVO.setZip(normalizedZip.isEmpty() ? (institutionZip.isEmpty() ? "000000" : institutionZip) : normalizedZip);
            userManageVO.setHomeadres(normalizedAddress.isEmpty() ? (institutionAddress.isEmpty() ? "주소미입력" : institutionAddress) : normalizedAddress);
            userManageVO.setDetailAdres(normalizedDetailAddress.isEmpty() ? institutionDetailAddress : normalizedDetailAddress);
            userManageVO.setFxnum("");
            userManageVO.setEmplNo("");
            userManageService.insertUser(userManageVO);

            Optional<EmplyrInfo> savedAdminOpt = employMemberRepository.findById(adminId);
            if (!savedAdminOpt.isPresent()) {
                throw new IllegalStateException("Administrator account insert verification failed.");
            }
            EmplyrInfo savedAdmin = savedAdminOpt.get();
            savedAdmin.setInsttId(scopedInsttId);
            savedAdmin.setOrgnztId(scopedInsttId);
            savedAdmin.setGroupId(scopedInsttId);
            savedAdmin.setUserNm(adminName);
            savedAdmin.setEmailAdres(adminEmail);
            savedAdmin.setAreaNo(phone1);
            savedAdmin.setHouseMiddleTelno(phone2);
            savedAdmin.setHouseEndTelno(phone3);
            savedAdmin.setMbtlNum(fullPhone);
            savedAdmin.setOffmTelno(fullPhone);
            savedAdmin.setOfcpsNm(deptNm);
            employMemberRepository.save(savedAdmin);

            authGroupManageService.updateAdminRoleAssignment(adminId, authorCode);
            adminRoleAssignmentDbChangeCaptureSupport.captureAdminRoleAssignment(
                    request,
                    currentUserId,
                    currentUserAuthorCode,
                    scopedInsttId,
                    adminId,
                    null,
                    adminAuthorityPagePayloadSupport.buildAuthorSummary(authorCode),
                    "AMENU_ADMIN_ACCOUNT_CREATE",
                    "admin-account-create");
            adminPermissionOverrideService.savePermissionOverrides(
                    adminAdminAccountCreateSupportService.safeString(savedAdmin.getEsntlId()),
                    "USR03",
                    baselineFeatureCodes,
                    featureCodes.isEmpty() ? baselineFeatureCodes : featureCodes,
                    currentUserId,
                    adminAdminAccountCreateSupportService.resolveGrantableFeatureCodeSet(currentUserId));
            adminAdminAccountCreateSupportService.recordAdminAccountCreateAudit(request, currentUserId, adminId, authorCode, scopedInsttId);

            Map<String, Object> payloadBody = new LinkedHashMap<>();
            payloadBody.put("success", true);
            payloadBody.put("emplyrId", adminId);
            payloadBody.put("authorCode", authorCode);
            payloadBody.put("insttId", scopedInsttId);
            payloadBody.put("companyName", institutionInfo == null ? "" : adminAdminAccountCreateSupportService.safeString(institutionInfo.getInsttNm()));
            return ResponseEntity.ok(payloadBody);
        } catch (Exception e) {
            log.error("Failed to create admin account. adminId={}, authorCode={}", adminId, authorCode, e);
            return messageResponse(HttpServletResponse.SC_INTERNAL_SERVER_ERROR, isEn
                    ? "An error occurred while creating the administrator account."
                    : "관리자 계정 생성 중 오류가 발생했습니다.");
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

    private String buildPhoneNumber(String phone1, String phone2, String phone3) {
        List<String> parts = new ArrayList<>();
        if (phone1 != null && !phone1.trim().isEmpty()) {
            parts.add(phone1.trim());
        }
        if (phone2 != null && !phone2.trim().isEmpty()) {
            parts.add(phone2.trim());
        }
        if (phone3 != null && !phone3.trim().isEmpty()) {
            parts.add(phone3.trim());
        }
        return String.join("-", parts);
    }

    private String digitsOnly(String value) {
        return adminAdminAccountCreateSupportService.safeString(value).replaceAll("[^0-9]", "");
    }

    private String trimToLen(String value, int maxLength) {
        String normalized = adminAdminAccountCreateSupportService.safeString(value);
        return normalized.length() <= maxLength ? normalized : normalized.substring(0, maxLength);
    }

    private boolean isStrongAdminPassword(String password) {
        String value = adminAdminAccountCreateSupportService.safeString(password);
        return value.matches("^(?=.*[A-Za-z])(?=.*\\d)(?=.*[^A-Za-z0-9]).{8,}$");
    }

    private boolean isValidEmail(String email) {
        String value = adminAdminAccountCreateSupportService.safeString(email);
        return !value.isEmpty() && value.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$");
    }
}
