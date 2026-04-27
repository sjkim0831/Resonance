package egovframework.com.feature.admin.web;

import egovframework.com.platform.codex.service.AdminAuthorityPagePayloadSupport;

import egovframework.com.feature.admin.dto.request.AdminPermissionSaveRequestDTO;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.ui.Model;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AdminAdminPermissionCommandService {

    private static final Logger log = LoggerFactory.getLogger(AdminAdminPermissionCommandService.class);

    private final AdminAdminPermissionService adminAdminPermissionService;
    private final AdminAdminPermissionCommandSupportService adminAdminPermissionCommandSupportService;
    private final AdminRequestContextSupport adminRequestContextSupport;
    private final AdminAuthorityPagePayloadSupport adminAuthorityPagePayloadSupport;
    private final AdminMemberPageModelAssembler adminMemberPageModelAssembler;

    public ResponseEntity<Map<String, Object>> submitApi(
            AdminPermissionSaveRequestDTO payload,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminRequestContextSupport.isEnglishRequest(request, locale);
        String currentUserId = adminRequestContextSupport.extractCurrentUserId(request);
        String currentUserAuthorCode = adminAuthorityPagePayloadSupport.resolveCurrentUserAuthorCode(currentUserId);
        AdminAdminPermissionService.SaveResult result = adminAdminPermissionService.saveAdminPermission(
                payload == null ? null : payload.getEmplyrId(),
                payload == null ? null : payload.getAuthorCode(),
                payload == null ? null : payload.getFeatureCodes(),
                request,
                isEn,
                currentUserId,
                currentUserAuthorCode,
                adminAuthorityPagePayloadSupport.hasMemberManagementCompanyAdminAccess(currentUserId, currentUserAuthorCode));
        if (result.isSuccess()) {
            adminAdminPermissionCommandSupportService.recordAdminPermissionAudit(
                    request,
                    currentUserId,
                    result.getEmplyrId(),
                    result.getAuthorCode());
        }
        return result.toResponseEntity();
    }

    public String submitForm(
            String emplyrId,
            String authorCode,
            List<String> featureCodes,
            String language,
            HttpServletRequest request,
            Locale locale,
            Model model) {
        boolean isEn = adminAdminPermissionCommandSupportService.isEnglishRequest(request, locale, language);
        String viewName = adminAdminPermissionCommandSupportService.resolveViewName(isEn);
        adminRequestContextSupport.primeCsrfToken(request);
        adminMemberPageModelAssembler.ensureAdminAccountDefaults(model, isEn);

        String currentUserId = adminRequestContextSupport.extractCurrentUserId(request);
        String currentUserAuthorCode = adminAuthorityPagePayloadSupport.resolveCurrentUserAuthorCode(currentUserId);
        AdminAdminPermissionService.SaveResult result = adminAdminPermissionService.saveAdminPermission(
                emplyrId,
                authorCode,
                featureCodes,
                request,
                isEn,
                currentUserId,
                currentUserAuthorCode,
                adminAuthorityPagePayloadSupport.hasMemberManagementCompanyAdminAccess(currentUserId, currentUserAuthorCode));
        if (result.isForbidden() || result.isInvalid() || result.isServerError()) {
            if (result.getAdminMember() != null) {
                try {
                    adminMemberPageModelAssembler.populateAdminAccountEditModel(
                            model,
                            result.getAdminMember(),
                            isEn,
                            result.getFeatureCodes(),
                            currentUserId);
                } catch (Exception e) {
                    log.error("Failed to populate admin account edit model after permission submit. emplyrId={}", result.getEmplyrId(), e);
                    adminMemberPageModelAssembler.ensureAdminAccountDefaults(model, isEn);
                }
            }
            if (!result.getErrors().isEmpty()) {
                model.addAttribute("adminPermissionErrors", result.getErrors());
            }
            if (!adminAdminPermissionCommandSupportService.safeString(result.getMessage()).isEmpty()) {
                model.addAttribute("adminPermissionError", result.getMessage());
            }
            return viewName;
        }
        adminAdminPermissionCommandSupportService.recordAdminPermissionAudit(
                request,
                currentUserId,
                result.getEmplyrId(),
                result.getAuthorCode());
        return adminAdminPermissionCommandSupportService.resolveSuccessRedirect(request, locale, result.getEmplyrId());
    }
}
