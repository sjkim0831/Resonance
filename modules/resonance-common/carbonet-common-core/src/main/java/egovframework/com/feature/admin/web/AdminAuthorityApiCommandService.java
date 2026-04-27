package egovframework.com.feature.admin.web;

import egovframework.com.feature.admin.dto.request.AdminAuthChangeSaveRequestDTO;
import egovframework.com.feature.admin.dto.request.AdminAuthGroupCreateRequestDTO;
import egovframework.com.feature.admin.dto.request.AdminAuthGroupFeatureSaveRequestDTO;
import egovframework.com.feature.admin.dto.request.AdminAuthorRoleProfileSaveRequestDTO;
import egovframework.com.feature.admin.dto.request.AdminDeptRoleMappingSaveRequestDTO;
import egovframework.com.feature.admin.dto.request.AdminDeptRoleMemberSaveRequestDTO;
import egovframework.com.platform.governance.model.vo.AuthorRoleProfileVO;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class AdminAuthorityApiCommandService {

    private final AdminAuthorityCommandService adminAuthorityCommandService;
    private final AdminAuthorityCommandSupportService adminAuthorityCommandSupportService;

    public AdminAuthorityApiCommandService(
            AdminAuthorityCommandService adminAuthorityCommandService,
            AdminAuthorityCommandSupportService adminAuthorityCommandSupportService) {
        this.adminAuthorityCommandService = adminAuthorityCommandService;
        this.adminAuthorityCommandSupportService = adminAuthorityCommandSupportService;
    }

    public ResponseEntity<Map<String, Object>> saveAuthGroupProfile(
            AdminAuthorRoleProfileSaveRequestDTO payload,
            HttpServletRequest request,
            Locale locale) {
        AdminAuthorityCommandService.CommandResult result = adminAuthorityCommandService.saveAuthGroupProfile(payload, request, locale);
        if (!result.isSuccess()) {
            return ResponseEntity.status(result.getStatus()).body(result.getBody());
        }
        String currentUserId = adminAuthorityCommandSupportService.extractCurrentUserId(request);
        String currentUserAuthorCode = adminAuthorityCommandSupportService.resolveCurrentUserAuthorCode(currentUserId);
        String normalizedAuthorCode = adminAuthorityCommandSupportService.safeString(payload == null ? null : payload.getAuthorCode()).toUpperCase(Locale.ROOT);
        AuthorRoleProfileVO saved = (AuthorRoleProfileVO) result.getBody().get("savedProfile");
        result.getBody().put("profile", adminAuthorityCommandSupportService.toAuthorRoleProfileMap(saved));
        result.getBody().remove("savedProfile");
        adminAuthorityCommandSupportService.recordAdminActionAudit(
                request,
                currentUserId,
                currentUserAuthorCode,
                "AMENU_AUTH_GROUP",
                "auth-group",
                "AUTH_GROUP_PROFILE_SAVE",
                "AUTHOR_ROLE_PROFILE",
                normalizedAuthorCode,
                "{\"authorCode\":\"" + adminAuthorityCommandSupportService.safeJson(normalizedAuthorCode) + "\"}",
                "{\"displayTitle\":\"" + adminAuthorityCommandSupportService.safeJson(saved == null ? null : saved.getDisplayTitle()) + "\"}");
        return ResponseEntity.ok(result.getBody());
    }

    public ResponseEntity<Map<String, Object>> createAuthGroup(
            AdminAuthGroupCreateRequestDTO payload,
            HttpServletRequest request,
            Locale locale) {
        AdminAuthorityCommandService.CommandResult result = adminAuthorityCommandService.createAuthGroup(payload, request, locale);
        if (!result.isSuccess()) {
            return ResponseEntity.status(result.getStatus()).body(result.getBody());
        }
        String currentUserId = adminAuthorityCommandSupportService.extractCurrentUserId(request);
        String currentUserAuthorCode = adminAuthorityCommandSupportService.resolveCurrentUserAuthorCode(currentUserId);
        String normalizedCode = adminAuthorityCommandSupportService.safeString(result.getBody().get("authorCode") == null ? null : result.getBody().get("authorCode").toString());
        String selectedRoleCategory = adminAuthorityCommandSupportService.safeString(result.getBody().get("roleCategory") == null ? null : result.getBody().get("roleCategory").toString());
        String scopedInsttId = adminAuthorityCommandSupportService.safeString(result.getBody().get("insttId") == null ? null : result.getBody().get("insttId").toString());
        adminAuthorityCommandSupportService.recordAdminActionAudit(
                request,
                currentUserId,
                currentUserAuthorCode,
                "AMENU_AUTH_GROUP",
                "auth-group",
                "AUTH_GROUP_CREATE",
                "AUTHOR_GROUP",
                normalizedCode,
                "{\"authorCode\":\"" + adminAuthorityCommandSupportService.safeJson(normalizedCode) + "\",\"roleCategory\":\"" + adminAuthorityCommandSupportService.safeJson(selectedRoleCategory)
                        + "\",\"insttId\":\"" + adminAuthorityCommandSupportService.safeJson(scopedInsttId) + "\"}",
                "{\"status\":\"SUCCESS\"}");
        return ResponseEntity.ok(result.getBody());
    }

    public ResponseEntity<Map<String, Object>> saveAuthGroupFeatures(
            AdminAuthGroupFeatureSaveRequestDTO payload,
            HttpServletRequest request,
            Locale locale) {
        AdminAuthorityCommandService.CommandResult result = adminAuthorityCommandService.saveAuthGroupFeatures(payload, request, locale);
        if (!result.isSuccess()) {
            return ResponseEntity.status(result.getStatus()).body(result.getBody());
        }
        String currentUserId = adminAuthorityCommandSupportService.extractCurrentUserId(request);
        String currentUserAuthorCode = adminAuthorityCommandSupportService.resolveCurrentUserAuthorCode(currentUserId);
        String normalizedAuthorCode = adminAuthorityCommandSupportService.safeString(payload == null ? null : payload.getAuthorCode()).toUpperCase(Locale.ROOT);
        @SuppressWarnings("unchecked")
        List<String> savedFeatureCodes = (List<String>) result.getBody().getOrDefault("savedFeatureCodes", Collections.emptyList());
        result.getBody().remove("savedFeatureCodes");
        adminAuthorityCommandSupportService.recordAdminActionAudit(
                request,
                currentUserId,
                currentUserAuthorCode,
                "AMENU_AUTH_GROUP",
                "auth-group",
                "AUTH_GROUP_FEATURE_SAVE",
                "AUTHOR_GROUP",
                normalizedAuthorCode,
                "{\"authorCode\":\"" + adminAuthorityCommandSupportService.safeJson(normalizedAuthorCode) + "\",\"featureCodes\":\""
                        + adminAuthorityCommandSupportService.safeJson(savedFeatureCodes.toString()) + "\"}",
                "{\"status\":\"SUCCESS\"}");
        return ResponseEntity.ok(result.getBody());
    }

    public ResponseEntity<Map<String, Object>> saveAuthChange(
            AdminAuthChangeSaveRequestDTO payload,
            HttpServletRequest request,
            Locale locale) {
        AdminAuthorityCommandService.CommandResult result = adminAuthorityCommandService.saveAuthChange(payload, request, locale);
        if (!result.isSuccess()) {
            return ResponseEntity.status(result.getStatus()).body(result.getBody());
        }
        String currentUserId = adminAuthorityCommandSupportService.extractCurrentUserId(request);
        String normalizedEmplyrId = adminAuthorityCommandSupportService.safeString(payload == null ? null : payload.getEmplyrId());
        String normalizedAuthorCode = adminAuthorityCommandSupportService.safeString(payload == null ? null : payload.getAuthorCode()).toUpperCase(Locale.ROOT);
        @SuppressWarnings("unchecked")
        Map<String, String> beforeRole = (Map<String, String>) result.getBody().getOrDefault("beforeRole", Collections.emptyMap());
        adminAuthorityCommandSupportService.recordAdminRoleAssignmentAudit(
                request,
                currentUserId,
                adminAuthorityCommandSupportService.resolveCurrentUserAuthorCode(currentUserId),
                normalizedEmplyrId,
                beforeRole,
                adminAuthorityCommandSupportService.buildAuthorSummary(normalizedAuthorCode));
        return ResponseEntity.ok(result.getBody());
    }

    public ResponseEntity<Map<String, Object>> saveDeptRoleMapping(
            AdminDeptRoleMappingSaveRequestDTO payload,
            HttpServletRequest request,
            Locale locale) {
        AdminAuthorityCommandService.CommandResult result = adminAuthorityCommandService.saveDeptRoleMapping(payload, request, locale);
        if (!result.isSuccess()) {
            return ResponseEntity.status(result.getStatus()).body(result.getBody());
        }
        String currentUserId = adminAuthorityCommandSupportService.extractCurrentUserId(request);
        String currentUserAuthorCode = adminAuthorityCommandSupportService.resolveCurrentUserAuthorCode(currentUserId);
        String normalizedInsttId = adminAuthorityCommandSupportService.safeString(payload == null ? null : payload.getInsttId());
        String normalizedDeptNm = adminAuthorityCommandSupportService.safeString(payload == null ? null : payload.getDeptNm());
        String normalizedAuthorCode = adminAuthorityCommandSupportService.safeString(payload == null ? null : payload.getAuthorCode()).toUpperCase(Locale.ROOT);
        adminAuthorityCommandSupportService.recordAdminActionAudit(
                request,
                currentUserId,
                currentUserAuthorCode,
                "AMENU_DEPT_ROLE",
                "dept-role",
                "DEPARTMENT_ROLE_MAPPING_SAVE",
                "DEPARTMENT_ROLE",
                normalizedInsttId + ":" + normalizedDeptNm,
                "{\"insttId\":\"" + adminAuthorityCommandSupportService.safeJson(normalizedInsttId) + "\",\"deptNm\":\"" + adminAuthorityCommandSupportService.safeJson(normalizedDeptNm) + "\",\"authorCode\":\"" + adminAuthorityCommandSupportService.safeJson(normalizedAuthorCode) + "\"}",
                "{\"status\":\"SUCCESS\"}");
        return ResponseEntity.ok(result.getBody());
    }

    public ResponseEntity<Map<String, Object>> saveDeptRoleMember(
            AdminDeptRoleMemberSaveRequestDTO payload,
            HttpServletRequest request,
            Locale locale) {
        AdminAuthorityCommandService.CommandResult result = adminAuthorityCommandService.saveDeptRoleMember(payload, request, locale);
        if (!result.isSuccess()) {
            return ResponseEntity.status(result.getStatus()).body(result.getBody());
        }
        String currentUserId = adminAuthorityCommandSupportService.extractCurrentUserId(request);
        String currentUserAuthorCode = adminAuthorityCommandSupportService.resolveCurrentUserAuthorCode(currentUserId);
        String normalizedInsttId = adminAuthorityCommandSupportService.safeString(payload == null ? null : payload.getInsttId());
        String normalizedEntrprsMberId = adminAuthorityCommandSupportService.safeString(payload == null ? null : payload.getEntrprsMberId());
        String normalizedAuthorCode = adminAuthorityCommandSupportService.safeString(payload == null ? null : payload.getAuthorCode()).toUpperCase(Locale.ROOT);
        adminAuthorityCommandSupportService.recordAdminActionAudit(
                request,
                currentUserId,
                currentUserAuthorCode,
                "AMENU_DEPT_ROLE",
                "dept-role",
                "COMPANY_MEMBER_ROLE_SAVE",
                "MEMBER",
                normalizedEntrprsMberId,
                "{\"insttId\":\"" + adminAuthorityCommandSupportService.safeJson(normalizedInsttId) + "\",\"memberId\":\"" + adminAuthorityCommandSupportService.safeJson(normalizedEntrprsMberId) + "\",\"authorCode\":\"" + adminAuthorityCommandSupportService.safeJson(normalizedAuthorCode) + "\"}",
                "{\"status\":\"SUCCESS\"}");
        return ResponseEntity.ok(result.getBody());
    }
}
