package egovframework.com.feature.admin.web;

import egovframework.com.feature.admin.dto.request.AdminAuthChangeSaveRequestDTO;
import egovframework.com.feature.admin.dto.request.AdminAuthGroupCreateRequestDTO;
import egovframework.com.feature.admin.dto.request.AdminAuthGroupFeatureSaveRequestDTO;
import egovframework.com.feature.admin.dto.request.AdminDeptRoleMappingSaveRequestDTO;
import egovframework.com.feature.admin.dto.request.AdminDeptRoleMemberSaveRequestDTO;
import org.springframework.stereotype.Service;
import org.springframework.ui.Model;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class AdminAuthorityFormCommandService {

    private final AdminAuthorityCommandService adminAuthorityCommandService;
    private final AdminReactRouteSupport adminReactRouteSupport;
    private final AdminAuthorityCommandSupportService adminAuthorityCommandSupportService;

    public AdminAuthorityFormCommandService(
            AdminAuthorityCommandService adminAuthorityCommandService,
            AdminReactRouteSupport adminReactRouteSupport,
            AdminAuthorityCommandSupportService adminAuthorityCommandSupportService) {
        this.adminAuthorityCommandService = adminAuthorityCommandService;
        this.adminReactRouteSupport = adminReactRouteSupport;
        this.adminAuthorityCommandSupportService = adminAuthorityCommandSupportService;
    }

    public String saveAuthChange(
            String emplyrId,
            String authorCode,
            HttpServletRequest request,
            Locale locale,
            Model model) {
        AdminAuthChangeSaveRequestDTO payload = new AdminAuthChangeSaveRequestDTO();
        payload.setEmplyrId(emplyrId);
        payload.setAuthorCode(authorCode);
        AdminAuthorityCommandService.CommandResult result = adminAuthorityCommandService.saveAuthChange(payload, request, locale);
        if (!result.isSuccess()) {
            model.addAttribute("authChangeError", result.getBody().get("message"));
            return adminReactRouteSupport.forwardAdminRoute(request, locale, "auth-change");
        }
        String currentUserId = adminAuthorityCommandSupportService.extractCurrentUserId(request);
        String normalizedEmplyrId = adminAuthorityCommandSupportService.safeString(emplyrId);
        String normalizedAuthorCode = adminAuthorityCommandSupportService.safeString(authorCode).toUpperCase(Locale.ROOT);
        @SuppressWarnings("unchecked")
        Map<String, String> beforeRole = (Map<String, String>) result.getBody().getOrDefault("beforeRole", Collections.emptyMap());
        adminAuthorityCommandSupportService.recordAdminRoleAssignmentAudit(
                request,
                currentUserId,
                adminAuthorityCommandSupportService.resolveCurrentUserAuthorCode(currentUserId),
                normalizedEmplyrId,
                beforeRole,
                adminAuthorityCommandSupportService.buildAuthorSummary(normalizedAuthorCode));
        return "redirect:" + adminAuthorityCommandSupportService.buildAuthChangeRedirectUrl(request, locale, normalizedEmplyrId, null);
    }

    public String saveDeptRoleMapping(
            String insttId,
            String cmpnyNm,
            String deptNm,
            String authorCode,
            HttpServletRequest request,
            Locale locale,
            Model model) {
        AdminDeptRoleMappingSaveRequestDTO payload = new AdminDeptRoleMappingSaveRequestDTO();
        payload.setInsttId(insttId);
        payload.setCmpnyNm(cmpnyNm);
        payload.setDeptNm(deptNm);
        payload.setAuthorCode(authorCode);
        AdminAuthorityCommandService.CommandResult result = adminAuthorityCommandService.saveDeptRoleMapping(payload, request, locale);
        if (!result.isSuccess()) {
            model.addAttribute("deptRoleError", result.getBody().get("message"));
            return adminReactRouteSupport.forwardAdminRoute(request, locale, "dept-role");
        }
        return "redirect:" + adminAuthorityCommandSupportService.buildDeptRoleRedirectUrl(
                request,
                locale,
                adminAuthorityCommandSupportService.safeString(insttId),
                null);
    }

    public String saveDeptRoleMember(
            String insttId,
            String entrprsMberId,
            String authorCode,
            HttpServletRequest request,
            Locale locale,
            Model model) {
        AdminDeptRoleMemberSaveRequestDTO payload = new AdminDeptRoleMemberSaveRequestDTO();
        payload.setInsttId(insttId);
        payload.setEntrprsMberId(entrprsMberId);
        payload.setAuthorCode(authorCode);
        AdminAuthorityCommandService.CommandResult result = adminAuthorityCommandService.saveDeptRoleMember(payload, request, locale);
        if (!result.isSuccess()) {
            model.addAttribute("deptRoleError", result.getBody().get("message"));
            return adminReactRouteSupport.forwardAdminRoute(request, locale, "dept-role");
        }
        return "redirect:" + adminAuthorityCommandSupportService.buildDeptRoleRedirectUrl(
                request,
                locale,
                adminAuthorityCommandSupportService.safeString(insttId),
                null);
    }

    public String createAuthGroup(
            String authorCode,
            String authorNm,
            String authorDc,
            String roleCategory,
            String insttId,
            HttpServletRequest request,
            Locale locale,
            Model model) {
        AdminAuthGroupCreateRequestDTO payload = new AdminAuthGroupCreateRequestDTO();
        payload.setAuthorCode(authorCode);
        payload.setAuthorNm(authorNm);
        payload.setAuthorDc(authorDc);
        payload.setRoleCategory(roleCategory);
        payload.setInsttId(insttId);
        AdminAuthorityCommandService.CommandResult result = adminAuthorityCommandService.createAuthGroup(payload, request, locale);
        if (!result.isSuccess()) {
            model.addAttribute("authGroupError", result.getBody().get("message"));
            return adminReactRouteSupport.forwardAdminRoute(request, locale, "auth-group");
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
        return "redirect:" + adminAuthorityCommandSupportService.buildAuthGroupRedirectUrl(
                request,
                locale,
                normalizedCode,
                selectedRoleCategory,
                scopedInsttId);
    }

    public String saveAuthGroupFeatures(
            String authorCode,
            List<String> featureCodes,
            String roleCategory,
            HttpServletRequest request,
            Locale locale,
            Model model) {
        AdminAuthGroupFeatureSaveRequestDTO payload = new AdminAuthGroupFeatureSaveRequestDTO();
        payload.setAuthorCode(authorCode);
        payload.setFeatureCodes(featureCodes);
        payload.setRoleCategory(roleCategory);
        AdminAuthorityCommandService.CommandResult result = adminAuthorityCommandService.saveAuthGroupFeatures(payload, request, locale);
        if (!result.isSuccess()) {
            model.addAttribute("authGroupError", result.getBody().get("message"));
            return adminReactRouteSupport.forwardAdminRoute(request, locale, "auth-group");
        }
        String currentUserId = adminAuthorityCommandSupportService.extractCurrentUserId(request);
        String currentUserAuthorCode = adminAuthorityCommandSupportService.resolveCurrentUserAuthorCode(currentUserId);
        String normalizedAuthorCode = adminAuthorityCommandSupportService.safeString(authorCode).toUpperCase(Locale.ROOT);
        @SuppressWarnings("unchecked")
        List<String> savedFeatureCodes = (List<String>) result.getBody().getOrDefault("savedFeatureCodes", Collections.emptyList());
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
        String selectedRoleCategory = adminAuthorityCommandSupportService.safeString(roleCategory);
        return "redirect:" + adminAuthorityCommandSupportService.buildAuthGroupRedirectUrl(
                request,
                locale,
                normalizedAuthorCode,
                selectedRoleCategory);
    }
}
