package egovframework.com.feature.admin.web;

import egovframework.com.platform.codex.service.AdminAuthorityPagePayloadSupport;

import egovframework.com.platform.codex.model.AuthorInfoVO;
import egovframework.com.feature.auth.domain.entity.EmplyrInfo;
import egovframework.com.feature.auth.domain.repository.EmployeeMemberRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

@Service
class AdminAdminPermissionService {

    private static final Logger log = LoggerFactory.getLogger(AdminAdminPermissionService.class);
    private static final String ROLE_SYSTEM_MASTER = "ROLE_SYSTEM_MASTER";

    private final EmployeeMemberRepository employMemberRepository;
    private final AdminPermissionOverrideService adminPermissionOverrideService;
    private final AdminAdminAccountAccessService adminAdminAccountAccessService;
    private final AdminAdminPermissionSupportService adminAdminPermissionSupportService;
    private final AdminAuthorityPagePayloadSupport adminAuthorityPagePayloadSupport;

    AdminAdminPermissionService(
            EmployeeMemberRepository employMemberRepository,
            AdminPermissionOverrideService adminPermissionOverrideService,
            AdminAdminAccountAccessService adminAdminAccountAccessService,
            AdminAdminPermissionSupportService adminAdminPermissionSupportService,
            AdminAuthorityPagePayloadSupport adminAuthorityPagePayloadSupport) {
        this.employMemberRepository = employMemberRepository;
        this.adminPermissionOverrideService = adminPermissionOverrideService;
        this.adminAdminAccountAccessService = adminAdminAccountAccessService;
        this.adminAdminPermissionSupportService = adminAdminPermissionSupportService;
        this.adminAuthorityPagePayloadSupport = adminAuthorityPagePayloadSupport;
    }

    SaveResult saveAdminPermission(
            String emplyrId,
            String authorCode,
            List<String> featureCodes,
            HttpServletRequest request,
            boolean isEn,
            String currentUserId,
            String currentUserAuthorCode,
            boolean hasAccess) {
        SaveResult result = SaveResult.normalize(adminAdminPermissionSupportService, emplyrId, authorCode, featureCodes);
        if (!hasAccess) {
            return result.forbidden(isEn
                    ? "You do not have permission to change administrator permissions."
                    : "관리자 권한을 변경할 권한이 없습니다.");
        }
        if (result.emplyrId.isEmpty()) {
            return result.invalidMessage(isEn
                    ? "Administrator ID was not provided."
                    : "관리자 ID가 전달되지 않았습니다.");
        }

        Optional<EmplyrInfo> adminMemberOpt;
        try {
            adminMemberOpt = employMemberRepository.findById(result.emplyrId);
        } catch (Exception e) {
            log.error("Failed to load admin for permission submit. emplyrId={}", result.emplyrId, e);
            return result.serverError(isEn
                    ? "An error occurred while retrieving administrator information."
                    : "관리자 정보 조회 중 오류가 발생했습니다.");
        }
        if (!adminMemberOpt.isPresent()) {
            return result.invalidMessage(isEn
                    ? "Administrator information was not found."
                    : "관리자 정보를 찾을 수 없습니다.");
        }

        result.adminMember = adminMemberOpt.get();
        if (!adminAdminAccountAccessService.canCurrentAdminAccessAdmin(request, result.adminMember)) {
            return result.forbidden(isEn
                    ? "You can only update administrators in your own company."
                    : "본인 회사에 속한 관리자만 수정할 수 있습니다.");
        }

        List<AuthorInfoVO> authorGroups;
        List<String> baselineFeatureCodes = Collections.emptyList();
        try {
            String currentAssignedAuthorCode = adminAdminPermissionSupportService.loadAssignedAuthorCode(result.emplyrId);
            authorGroups = adminAdminPermissionSupportService.loadGrantableAdminAuthorGroups(result.adminMember, isEn, currentUserId);
            if (result.authorCode.isEmpty()) {
                result.errors.add(isEn ? "Please select an administrator role." : "관리자 권한 롤을 선택해 주세요.");
            } else if (!adminAdminPermissionSupportService.isGrantableOrCurrentAdminAuthorCode(
                    authorGroups,
                    result.authorCode,
                    currentAssignedAuthorCode)) {
                result.errors.add(isEn ? "Please select a valid administrator role." : "유효한 관리자 권한 롤을 선택해 주세요.");
            } else {
                baselineFeatureCodes = adminAdminPermissionSupportService.loadAuthorFeatureCodes(result.authorCode);
            }
            if ("webmaster".equalsIgnoreCase(result.emplyrId)
                    && !ROLE_SYSTEM_MASTER.equalsIgnoreCase(result.authorCode)) {
                result.errors.add(isEn
                        ? "webmaster must keep ROLE_SYSTEM_MASTER."
                        : "webmaster 계정은 ROLE_SYSTEM_MASTER만 유지할 수 있습니다.");
            }
        } catch (Exception e) {
            log.error("Failed to load permission data for admin edit. emplyrId={}", result.emplyrId, e);
            result.errors.add(isEn
                    ? "Failed to load role and feature information."
                    : "권한 롤 및 기능 정보를 불러오지 못했습니다.");
        }
        if (!result.errors.isEmpty()) {
            return result.invalid();
        }

        try {
            adminAdminPermissionSupportService.updateAdminRoleAssignment(result.emplyrId, result.authorCode);
            adminPermissionOverrideService.savePermissionOverrides(
                    adminAuthorityPagePayloadSupport.safeValue(result.adminMember.getEsntlId()),
                    "USR03",
                    baselineFeatureCodes,
                    result.featureCodes,
                    currentUserId,
                    adminAdminPermissionSupportService.resolveGrantableFeatureCodeSet(currentUserId));
            result.success = true;
            return result;
        } catch (Exception e) {
            log.error("Failed to save admin account permissions. emplyrId={}, authorCode={}", result.emplyrId, result.authorCode, e);
            return result.serverError(isEn
                    ? "An error occurred while saving administrator permissions."
                    : "관리자 권한 저장 중 오류가 발생했습니다.");
        }
    }

    static class SaveResult {
        private boolean success;
        private boolean forbidden;
        private boolean invalid;
        private boolean serverError;
        private int statusCode;
        private String message;
        private final List<String> errors = new ArrayList<>();
        private String emplyrId;
        private String authorCode;
        private List<String> featureCodes;
        private EmplyrInfo adminMember;

        static SaveResult normalize(AdminAdminPermissionSupportService support, String emplyrId, String authorCode, List<String> featureCodes) {
            SaveResult result = new SaveResult();
            result.statusCode = HttpStatus.OK.value();
            result.emplyrId = support.normalizeEmplyrId(emplyrId);
            result.authorCode = support.normalizeAuthorCode(authorCode);
            result.featureCodes = support.normalizeFeatureCodes(featureCodes);
            return result;
        }

        SaveResult forbidden(String message) {
            this.forbidden = true;
            this.statusCode = HttpStatus.FORBIDDEN.value();
            this.message = message;
            return this;
        }

        SaveResult invalidMessage(String message) {
            this.invalid = true;
            this.statusCode = HttpStatus.BAD_REQUEST.value();
            this.message = message;
            return this;
        }

        SaveResult invalid() {
            this.invalid = true;
            this.statusCode = HttpStatus.BAD_REQUEST.value();
            return this;
        }

        SaveResult serverError(String message) {
            this.serverError = true;
            this.statusCode = HttpStatus.INTERNAL_SERVER_ERROR.value();
            this.message = message;
            return this;
        }

        ResponseEntity<Map<String, Object>> toResponseEntity() {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("success", success);
            if (!emplyrId.isEmpty()) {
                response.put("emplyrId", emplyrId);
            }
            if (!authorCode.isEmpty()) {
                response.put("authorCode", authorCode);
            }
            if (!errors.isEmpty()) {
                response.put("errors", errors);
            }
            if (message != null && !message.isEmpty()) {
                response.put("message", message);
            }
            return ResponseEntity.status(statusCode).body(response);
        }

        boolean isSuccess() {
            return success;
        }

        boolean isForbidden() {
            return forbidden;
        }

        boolean isInvalid() {
            return invalid;
        }

        boolean isServerError() {
            return serverError;
        }

        String getMessage() {
            return message;
        }

        List<String> getErrors() {
            return errors;
        }

        String getEmplyrId() {
            return emplyrId;
        }

        String getAuthorCode() {
            return authorCode;
        }

        List<String> getFeatureCodes() {
            return featureCodes;
        }

        EmplyrInfo getAdminMember() {
            return adminMember;
        }
    }
}
