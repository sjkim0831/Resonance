package egovframework.com.common.interceptor;

import egovframework.com.common.util.ReactPageUrlMapper;
import egovframework.com.platform.codex.model.UserFeatureOverrideVO;
import egovframework.com.platform.codex.service.AuthGroupManageService;
import egovframework.com.feature.auth.domain.entity.EmplyrInfo;
import egovframework.com.feature.auth.domain.repository.EmployeeMemberRepository;
import egovframework.com.feature.auth.service.CurrentUserContextService;
import egovframework.com.feature.auth.util.JwtTokenProvider;
import egovframework.com.framework.authority.service.FrameworkAuthorityPolicyService;
import egovframework.com.feature.member.model.vo.EntrprsManageVO;
import egovframework.com.feature.member.model.vo.EntrprsMberFileVO;
import egovframework.com.feature.member.service.EnterpriseMemberService;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.util.ObjectUtils;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.util.HtmlUtils;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

@Component
@RequiredArgsConstructor
public class AdminMainAuthInterceptor implements HandlerInterceptor {

    private final JwtTokenProvider jwtProvider;
    private final AuthGroupManageService authGroupManageService;
    private final EnterpriseMemberService enterpriseMemberService;
    private final EmployeeMemberRepository employeeMemberRepository;
    private final FrameworkAuthorityPolicyService frameworkAuthorityPolicyService;
    private final CurrentUserContextService currentUserContextService;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        String requestUri = request.getRequestURI();
        if (shouldSkipAuthorization(request, requestUri)) {
            return true;
        }

        CurrentUserContextService.CurrentUserContext currentUserContext = currentUserContextService.resolve(request);
        String accessToken = jwtProvider.getCookie(request, "accessToken");
        boolean hasValidToken = !ObjectUtils.isEmpty(accessToken) && jwtProvider.accessValidateToken(accessToken) == 200;
        String userId;
        String authorCode;
        if (hasValidToken) {
            userId = extractCurrentUserId(accessToken);
            if (ObjectUtils.isEmpty(userId)) {
                redirectToLogin(request, response);
                return false;
            }
            authorCode = authGroupManageService.selectAuthorCodeByUserId(userId);
        } else if (currentUserContext.isSimulationActive()) {
            userId = currentUserContext.getUserId();
            authorCode = currentUserContext.getAuthorCode();
        } else {
            redirectToLogin(request, response);
            return false;
        }

        if (ObjectUtils.isEmpty(authorCode)) {
            markCompanyScope(request, "DENY_NO_ROLE", "Administrator role information is missing.", "");
            deny(response);
            return false;
        }
        if (frameworkAuthorityPolicyService.isSystemMaster(authorCode)) {
            markCompanyScope(request, "ALLOW_MASTER", "System master bypassed company scope validation.",
                    resolveTargetInsttId(request, normalizeMenuUrl(requestUri)));
            return true;
        }
        String normalizedMenuUrl = normalizeMenuUrl(request);
        String canonicalMenuUrl = canonicalizeAdminMenuUrl(normalizedMenuUrl);
        if (!checkCompanyScope(request, response, userId, authorCode, canonicalMenuUrl)) {
            return false;
        }
        if (ObjectUtils.isEmpty(normalizedMenuUrl)) {
            return true;
        }

        String requiredFeatureCode = resolveRequiredFeatureCode(request, normalizedMenuUrl);
        if (ObjectUtils.isEmpty(requiredFeatureCode)) {
            if (!"GET".equalsIgnoreCase(request.getMethod())) {
                denyWithMessage(request, response,
                        "Permission registration is missing for this action.",
                        "권한 등록이 안 되어있습니다.");
                return false;
            }
            return true;
        }
        String essentialId = authGroupManageService.selectAdminEssentialIdByUserId(userId);
        String overrideType = resolveOverrideType(essentialId, requiredFeatureCode);
        if ("D".equalsIgnoreCase(overrideType)) {
            markCompanyScope(request, "DENY_FEATURE_OVERRIDE", "Feature override denied this action.",
                    safeString((String) request.getAttribute("targetCompanyContextId")));
            denyWithMessage(request, response,
                    "You do not have permission for this action.",
                    "해당 작업에 대한 권한이 없습니다.");
            return false;
        }
        if ("A".equalsIgnoreCase(overrideType)) {
            return true;
        }
        if (!authGroupManageService.hasAuthorFeaturePermission(authorCode, requiredFeatureCode)) {
            markCompanyScope(request, "DENY_FEATURE_PERMISSION", "Role feature permission denied this action.",
                    safeString((String) request.getAttribute("targetCompanyContextId")));
            denyWithMessage(request, response,
                    "You do not have permission for this action.",
                    "해당 작업에 대한 권한이 없습니다.");
            return false;
        }
        return true;
    }

    private void redirectToLogin(HttpServletRequest request, HttpServletResponse response) throws Exception {
        String requestUri = request.getRequestURI();
        String language = request.getParameter("language");
        boolean english = (!ObjectUtils.isEmpty(requestUri) && requestUri.startsWith("/en/admin"))
                || "en".equalsIgnoreCase(language);
        if (english) {
            response.sendRedirect("/en/admin/login/loginView");
        } else {
            response.sendRedirect("/admin/login/loginView");
        }
    }

    private boolean shouldSkipAuthorization(HttpServletRequest request, String requestUri) {
        String rawUri = safeString(requestUri);
        if (rawUri.startsWith("/admin/assets/react/") || rawUri.startsWith("/en/admin/assets/react/")) {
            return true;
        }
        String normalizedUri = canonicalizeAdminMenuUrl(normalizeMenuUrl(request));
        return ObjectUtils.isEmpty(normalizedUri)
                || "/admin".equals(normalizedUri)
                || "/admin/".equals(normalizedUri)
                || normalizedUri.startsWith("/admin/assets/react/");
    }

    private String normalizeMenuUrl(String requestUri) {
        if (ObjectUtils.isEmpty(requestUri)) {
            return "";
        }
        if (requestUri.startsWith("/en/admin")) {
            return requestUri.substring(3);
        }
        return requestUri;
    }

    private String normalizeMenuUrl(HttpServletRequest request) {
        if (request == null) {
            return "";
        }
        String normalized = normalizeMenuUrl(request.getRequestURI());
        if ("/admin/app".equals(normalized)) {
            String route = safeString(request.getParameter("route"));
            if (!route.isEmpty()) {
                return normalized + "?route=" + route;
            }
        }
        return normalized;
    }

    private String canonicalizeAdminMenuUrl(String normalizedMenuUrl) {
        return ReactPageUrlMapper.toCanonicalMenuUrl(normalizedMenuUrl);
    }

    private String extractCurrentUserId(String accessToken) {
        try {
            Claims claims = jwtProvider.accessExtractClaims(accessToken);
            Object encryptedUserId = claims.get("userId");
            if (ObjectUtils.isEmpty(encryptedUserId)) {
                return "";
            }
            return jwtProvider.decrypt(encryptedUserId.toString());
        } catch (Exception e) {
            return "";
        }
    }

    private void deny(HttpServletResponse response) throws Exception {
        response.sendError(HttpServletResponse.SC_FORBIDDEN);
    }

    private String resolveRequiredFeatureCode(HttpServletRequest request, String normalizedMenuUrl) throws Exception {
        if ("GET".equalsIgnoreCase(request.getMethod())) {
            return authGroupManageService.selectRequiredViewFeatureCodeByMenuUrl(normalizedMenuUrl);
        }

        String menuCode = resolveActionMenuCode(normalizedMenuUrl);
        if (ObjectUtils.isEmpty(menuCode)) {
            return "";
        }
        List<String> featureCodes = authGroupManageService.selectFeatureCodesByMenuCode(menuCode);
        if (featureCodes == null || featureCodes.isEmpty()) {
            return "";
        }
        for (String suffix : expectedActionSuffixes(request, normalizedMenuUrl)) {
            for (String featureCode : featureCodes) {
                String normalizedFeatureCode = safeString(featureCode).toUpperCase(Locale.ROOT);
                if (normalizedFeatureCode.endsWith(suffix)) {
                    return normalizedFeatureCode;
                }
            }
        }
        return "";
    }

    private String resolveActionMenuCode(String normalizedMenuUrl) throws Exception {
        String candidate = safeString(normalizedMenuUrl);
        while (!candidate.isEmpty() && candidate.startsWith("/admin")) {
            String menuCode = authGroupManageService.selectMenuCodeByMenuUrl(candidate);
            if (!safeString(menuCode).isEmpty()) {
                return safeString(menuCode);
            }
            int lastSlash = candidate.lastIndexOf('/');
            if (lastSlash <= "/admin".length()) {
                break;
            }
            candidate = candidate.substring(0, lastSlash);
        }
        return "";
    }

    private List<String> expectedActionSuffixes(HttpServletRequest request, String normalizedMenuUrl) {
        String value = safeString(normalizedMenuUrl).toLowerCase(Locale.ROOT);
        List<String> suffixes = new ArrayList<>();
        String action = request == null ? "" : safeString(request.getParameter("action")).toLowerCase(Locale.ROOT);
        if (!action.isEmpty()) {
            if ("approve".equals(action)) {
                suffixes.add("_APPROVE");
            } else if ("reject".equals(action)) {
                suffixes.add("_REJECT");
            } else if ("batch_approve".equals(action)) {
                suffixes.add("_BATCH_APPROVE");
            } else if ("batch_reject".equals(action)) {
                suffixes.add("_BATCH_REJECT");
            }
        }
        if (value.contains("/prepare-execution")) {
            suffixes.add("_PREPARE");
        } else if (value.endsWith("/execute")) {
            suffixes.add("_EXECUTE");
        } else if (value.endsWith("/approve")) {
            suffixes.add("_APPROVE");
        } else if (value.endsWith("/tickets")) {
            suffixes.add("_CREATE");
        } else if (value.endsWith("/save")) {
            suffixes.add("_EDIT");
            suffixes.add("_SAVE");
            suffixes.add("_UPDATE");
        }
        if (value.contains("/delete")) {
            suffixes.add("_DELETE");
        } else if (value.contains("/create")) {
            suffixes.add("_CREATE");
            suffixes.add("_SAVE");
        } else if (value.contains("/update")) {
            suffixes.add("_UPDATE");
            suffixes.add("_SAVE");
        } else if (value.endsWith("/edit")) {
            suffixes.add("_UPDATE");
            suffixes.add("_SAVE");
        } else if (value.endsWith("/reset_password")) {
            suffixes.add("_RESET");
            suffixes.add("_SAVE");
        } else if (value.contains("/save") || value.contains("/order")) {
            suffixes.add("_SAVE");
            suffixes.add("_UPDATE");
        } else if (value.contains("/search")) {
            suffixes.add("_SEARCH");
            suffixes.add("_VIEW");
        } else if (value.contains("/excel") || value.contains("/download") || value.contains("/export")) {
            suffixes.add("_EXPORT");
            suffixes.add("_DOWNLOAD");
            suffixes.add("_VIEW");
        }
        return suffixes.isEmpty() ? Collections.singletonList("_SAVE") : suffixes;
    }

    private void denyWithMessage(HttpServletRequest request, HttpServletResponse response, String englishMessage,
                                 String koreanMessage) throws Exception {
        String message = isEnglishRequest(request) ? englishMessage : koreanMessage;
        if (isAjaxRequest(request)) {
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"status\":403,\"message\":\"" + escapeJson(message) + "\"}");
            return;
        }
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        response.setContentType("text/html;charset=UTF-8");
        response.getWriter().write("<script>alert('" + escapeJs(message) + "');history.back();</script>");
    }

    private boolean isAjaxRequest(HttpServletRequest request) {
        String requestedWith = safeString(request.getHeader("X-Requested-With"));
        if ("XMLHttpRequest".equalsIgnoreCase(requestedWith)) {
            return true;
        }
        String accept = safeString(request.getHeader("Accept")).toLowerCase(Locale.ROOT);
        return accept.contains("application/json");
    }

    private boolean isEnglishRequest(HttpServletRequest request) {
        String requestUri = request == null ? "" : safeString(request.getRequestURI());
        String language = request == null ? "" : safeString(request.getParameter("language"));
        return requestUri.startsWith("/en/admin") || "en".equalsIgnoreCase(language);
    }

    private String escapeJs(String value) {
        return HtmlUtils.htmlEscape(safeString(value))
                .replace("\\", "\\\\")
                .replace("'", "\\'");
    }

    private String escapeJson(String value) {
        return safeString(value)
                .replace("\\", "\\\\")
                .replace("\"", "\\\"");
    }

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }

    private String resolveOverrideType(String essentialId, String featureCode) throws Exception {
        if (ObjectUtils.isEmpty(essentialId) || ObjectUtils.isEmpty(featureCode)) {
            return "";
        }
        List<UserFeatureOverrideVO> overrides = authGroupManageService.selectUserFeatureOverrides(essentialId);
        for (UserFeatureOverrideVO override : overrides) {
            if (featureCode.equalsIgnoreCase(override.getFeatureCode())) {
                return override.getOverrideType();
            }
        }
        return "";
    }

    private boolean checkCompanyScope(HttpServletRequest request, HttpServletResponse response,
                                      String userId, String authorCode, String normalizedUri) throws Exception {
        if (isMemberManagementRoute(normalizedUri)) {
            return checkMemberManagementScope(request, response, userId, authorCode, normalizedUri);
        }
        String targetInsttId = resolveTargetInsttId(request, normalizedUri);
        if (hasGlobalCompanyAccess(authorCode)) {
            if (targetInsttId.isEmpty()) {
                markCompanyScope(request, "ALLOW_GLOBAL_NO_CONTEXT",
                        "Global administrator executed the request without an explicit company context.", "");
            } else {
                markCompanyScope(request, "ALLOW_GLOBAL_MATCHED", "", targetInsttId);
            }
            return true;
        }
        if (!requiresOwnCompanyAccess(authorCode)) {
            markCompanyScope(request, "DENY_NO_COMPANY_SCOPE_PERMISSION", "Administrator role is not allowed to access company-scoped data.", targetInsttId);
            denyWithMessage(request, response,
                    "You do not have permission for this action.",
                    "해당 작업에 대한 권한이 없습니다.");
            return false;
        }

        String currentInsttId = resolveCurrentAdminInsttId(userId);
        if (currentInsttId.isEmpty()) {
            markCompanyScope(request, "DENY_NO_ACTOR_COMPANY", "Administrator account is missing company information.", targetInsttId);
            denyWithMessage(request, response,
                    "Your administrator account is missing company information.",
                    "관리자 계정에 회사 정보가 없습니다.");
            return false;
        }
        if (isGlobalOnlyRoute(normalizedUri)) {
            markCompanyScope(request, "DENY_GLOBAL_ONLY_ROUTE", "Company-scoped administrator attempted a global-only route.", targetInsttId);
            denyWithMessage(request, response,
                    "This page is only available to global administrators.",
                    "이 화면은 전체 관리자만 사용할 수 있습니다.");
            return false;
        }
        if (targetInsttId.isEmpty()) {
            if (isImplicitOwnCompanyRoute(normalizedUri)) {
                markCompanyScope(request, "ALLOW_IMPLICIT_SELF",
                        "The request was resolved to the actor company without an explicit company parameter.",
                        currentInsttId);
                return true;
            }
            markCompanyScope(request, "DENY_MISSING_COMPANY_CONTEXT", "The request did not include or resolve a company context.", "");
            denyWithMessage(request, response,
                    "Company context is required for this action.",
                    "이 작업은 회사 컨텍스트가 필요합니다.");
            return false;
        }
        if (!currentInsttId.equals(targetInsttId)) {
            markCompanyScope(request, "DENY_COMPANY_MISMATCH", "The request company does not match the actor company.", targetInsttId);
            denyWithMessage(request, response,
                    "You can only access data in your own company.",
                    "본인 회사 데이터만 접근할 수 있습니다.");
            return false;
        }
        markCompanyScope(request, "ALLOW_MATCHED", "", targetInsttId);
        return true;
    }

    private boolean checkMemberManagementScope(HttpServletRequest request, HttpServletResponse response,
                                               String userId, String authorCode, String normalizedUri) throws Exception {
        String targetInsttId = resolveTargetInsttId(request, normalizedUri);
        if (frameworkAuthorityPolicyService.isSystemMaster(authorCode)) {
            markCompanyScope(request, "ALLOW_MEMBER_MASTER", "", targetInsttId);
            return true;
        }
        if (isMemberMasterOnlyRoute(normalizedUri)) {
            markCompanyScope(request, "DENY_MEMBER_MASTER_ONLY", "Master administrator only route.", targetInsttId);
            denyWithMessage(request, response,
                    "This page is only available to master administrators.",
                    "이 화면은 마스터 관리자만 사용할 수 있습니다.");
            return false;
        }
        if (isMemberAdminRoute(normalizedUri) && !hasMemberManagementCompanyAdminAccess(authorCode)) {
            markCompanyScope(request, "DENY_MEMBER_ADMIN_ONLY", "Company admin route.", targetInsttId);
            denyWithMessage(request, response,
                    "This page is only available to company administrators.",
                    "이 화면은 회원사 시스템 관리자만 사용할 수 있습니다.");
            return false;
        }
        if (isMemberCompanyScopedRoute(normalizedUri) && !hasMemberManagementCompanyOperatorAccess(authorCode)) {
            markCompanyScope(request, "DENY_MEMBER_SCOPE_ROLE", "Member-management scope denied by role.", targetInsttId);
            denyWithMessage(request, response,
                    "You do not have permission for this member-management page.",
                    "회원관리 화면을 사용할 권한이 없습니다.");
            return false;
        }
        String currentInsttId = resolveCurrentAdminInsttId(userId);
        if (currentInsttId.isEmpty()) {
            markCompanyScope(request, "DENY_MEMBER_NO_COMPANY", "Administrator account is missing company information.", targetInsttId);
            denyWithMessage(request, response,
                    "Your administrator account is missing company information.",
                    "관리자 계정에 회사 정보가 없습니다.");
            return false;
        }
        if (targetInsttId.isEmpty()) {
            markCompanyScope(request, "ALLOW_MEMBER_IMPLICIT_SELF", "The request was resolved to the actor company.", currentInsttId);
            return true;
        }
        if (!currentInsttId.equals(targetInsttId)) {
            markCompanyScope(request, "DENY_MEMBER_COMPANY_MISMATCH", "The request company does not match the actor company.", targetInsttId);
            denyWithMessage(request, response,
                    "You can only access data in your own company.",
                    "본인 회사 데이터만 접근할 수 있습니다.");
            return false;
        }
        markCompanyScope(request, "ALLOW_MEMBER_MATCHED", "", targetInsttId);
        return true;
    }

    private void markCompanyScope(HttpServletRequest request, String decision, String reason, String targetInsttId) {
        request.setAttribute("companyScopeDecision", safeString(decision));
        request.setAttribute("companyScopeReason", safeString(reason));
        request.setAttribute("targetCompanyContextId", safeString(targetInsttId));
    }

    private boolean hasGlobalCompanyAccess(String authorCode) {
        return frameworkAuthorityPolicyService.isGlobalCompanyRole(authorCode);
    }

    private boolean requiresOwnCompanyAccess(String authorCode) {
        return frameworkAuthorityPolicyService.isOperationAdmin(authorCode);
    }

    private boolean hasMemberManagementCompanyAdminAccess(String authorCode) {
        return frameworkAuthorityPolicyService.isSystemMaster(authorCode)
                || frameworkAuthorityPolicyService.isSystemAdmin(authorCode)
                || frameworkAuthorityPolicyService.isGeneralAdmin(authorCode);
    }

    private boolean hasMemberManagementCompanyOperatorAccess(String authorCode) {
        return hasMemberManagementCompanyAdminAccess(authorCode)
                || frameworkAuthorityPolicyService.isOperationAdmin(authorCode);
    }

    private String resolveCurrentAdminInsttId(String userId) {
        try {
            return employeeMemberRepository.findById(safeString(userId))
                    .map(EmplyrInfo::getInsttId)
                    .map(this::safeString)
                    .orElse("");
        } catch (Exception e) {
            return "";
        }
    }

    private boolean isGlobalOnlyRoute(String normalizedUri) {
        String value = safeString(normalizedUri);
        if ("/admin/system/access_history".equals(value)
                || "/admin/system/access_history/page-data".equals(value)
                || "/admin/system/error-log".equals(value)
                || "/admin/system/error-log/page-data".equals(value)
                || "/admin/system/security".equals(value)
                || "/admin/system/security/page-data".equals(value)
                || "/admin/system/security-audit".equals(value)
                || "/admin/system/security-audit/page-data".equals(value)
                || "/admin/system/observability".equals(value)
                || "/admin/system/help-management".equals(value)
                || "/admin/system/sr-workbench".equals(value)
                || "/admin/system/wbs-management".equals(value)
                || "/admin/system/new-page".equals(value)
                || "/admin/system/codex-request".equals(value)) {
            return false;
        }
        return "/admin/member/approve".equals(value)
                || "/admin/trade/approve".equals(value)
                || "/admin/certificate/pending_list".equals(value)
                || "/admin/certificate/objection_list".equals(value)
                || "/admin/content/sitemap".equals(value)
                || "/admin/member/company-approve".equals(value)
                || "/admin/member/company_list".equals(value)
                || "/admin/member/company_detail".equals(value)
                || "/admin/member/company_account".equals(value)
                || "/admin/member/company-file".equals(value)
                || "/admin/api/admin/content/sitemap".equals(value)
                || "/admin/member/admin_list".equals(value)
                || "/admin/member/admin-list".equals(value)
                || "/admin/member/admin_account".equals(value)
                || "/admin/member/admin_account/permissions".equals(value)
                || "/admin/api/admin/member/approve/page".equals(value)
                || "/admin/api/admin/member/approve/action".equals(value)
                || "/admin/trade/approve/page-data".equals(value)
                || "/admin/api/admin/trade/approve/action".equals(value)
                || "/admin/certificate/pending_list/page-data".equals(value)
                || "/admin/certificate/objection_list/page-data".equals(value)
                || "/admin/api/admin/member/company-approve/page".equals(value)
                || "/admin/api/admin/member/company-approve/action".equals(value)
                || "/admin/api/admin/member/company-list/page".equals(value)
                || "/admin/api/admin/member/company-detail/page".equals(value)
                || "/admin/api/admin/member/company-account/page".equals(value)
                || "/admin/api/admin/member/company-account".equals(value)
                || "/admin/api/admin/member/admin-list/page".equals(value)
                || "/admin/api/admin/member/admin-account/page".equals(value)
                || "/admin/api/admin/member/admin-account/check-id".equals(value)
                || "/admin/api/admin/member/admin-account".equals(value)
                || "/admin/api/admin/member/admin-account/permissions".equals(value)
                || "/admin/api/admin/companies/search".equals(value)
                || "/admin/api/admin/auth-change/page".equals(value)
                || "/admin/api/admin/auth-change/save".equals(value)
                || value.startsWith("/admin/content/")
                || value.startsWith("/admin/external/")
                || value.startsWith("/admin/system/")
                || value.startsWith("/admin/api/admin/content/")
                || value.startsWith("/admin/api/admin/external/")
                || value.startsWith("/admin/api/admin/system/");
    }

    private boolean isImplicitOwnCompanyRoute(String normalizedUri) {
        String value = safeString(normalizedUri);
        return "/admin".equals(value)
                || "/admin/".equals(value)
                || "/admin/member/list".equals(value)
                || "/admin/member/register".equals(value)
                || "/admin/member/security".equals(value)
                || "/admin/member/security/page-data".equals(value)
                || "/admin/trade/list".equals(value)
                || "/admin/trade/list/page-data".equals(value)
                || "/admin/member/auth-group".equals(value)
                || "/admin/member/auth-group/create".equals(value)
                || "/admin/member/auth-group/save-features".equals(value)
                || "/admin/member/dept-role-mapping".equals(value)
                || "/admin/api/admin/member/list/page".equals(value)
                || "/admin/api/admin/member/edit".equals(value)
                || "/admin/api/admin/member/detail/page".equals(value)
                || "/admin/api/admin/member/reset-password".equals(value)
                || "/admin/api/admin/auth-groups/page".equals(value)
                || "/admin/api/admin/auth-groups".equals(value)
                || "/admin/api/admin/auth-groups/features".equals(value)
                || "/admin/api/admin/dept-role-mapping/page".equals(value)
                || "/admin/api/admin/dept-role-mapping/save".equals(value)
                || "/admin/api/admin/dept-role-mapping/member-save".equals(value);
    }

    private String resolveTargetInsttId(HttpServletRequest request, String normalizedUri) {
        String value = safeString(normalizedUri);
        if ("/admin/member/edit".equals(value)
                || "/admin/member/detail".equals(value)
                || "/admin/member/reset_password".equals(value)
                || "/admin/api/admin/member/edit".equals(value)
                || "/admin/api/admin/member/detail/page".equals(value)
                || "/admin/api/admin/member/reset-password".equals(value)) {
            return resolveMemberInsttId(request.getParameter("memberId"));
        }
        if ("/admin/member/admin_account/permissions".equals(value)
                || "/admin/api/admin/member/admin-account/permissions".equals(value)) {
            return resolveAdminInsttId(request.getParameter("emplyrId"));
        }
        if ("/admin/member/admin_account".equals(value)
                || "/admin/api/admin/member/admin-account".equals(value)) {
            return safeString(request.getParameter("insttId"));
        }
        if ("/admin/member/file".equals(value)) {
            return resolveMemberFileInsttId(request.getParameter("fileId"));
        }
        if ("/admin/member/dept-role-mapping".equals(value)
                || "/admin/member/dept-role-mapping/save".equals(value)
                || "/admin/member/dept-role-mapping/member-save".equals(value)
                || "/admin/api/admin/dept-role-mapping/page".equals(value)
                || "/admin/api/admin/dept-role-mapping/save".equals(value)
                || "/admin/api/admin/dept-role-mapping/member-save".equals(value)
                || "/admin/api/admin/auth-groups/page".equals(value)
                || "/admin/api/admin/auth-groups".equals(value)
                || "/admin/api/admin/auth-groups/features".equals(value)) {
            return safeString(request.getParameter("insttId"));
        }
        return "";
    }

    private String resolveAdminInsttId(String emplyrId) {
        String normalizedEmplyrId = safeString(emplyrId);
        if (normalizedEmplyrId.isEmpty()) {
            return "";
        }
        try {
            return employeeMemberRepository.findById(normalizedEmplyrId)
                    .map(EmplyrInfo::getInsttId)
                    .map(this::safeString)
                    .orElse("");
        } catch (Exception e) {
            return "";
        }
    }

    private boolean isMemberManagementRoute(String normalizedUri) {
        String value = safeString(normalizedUri);
        return value.startsWith("/admin/member/");
    }

    private boolean isMemberMasterOnlyRoute(String normalizedUri) {
        String value = safeString(normalizedUri);
        return "/admin/member/company-approve".equals(value)
                || "/admin/trade/approve".equals(value)
                || "/admin/member/company_list".equals(value)
                || "/admin/member/company_detail".equals(value)
                || "/admin/member/company_account".equals(value)
                || "/admin/member/company-file".equals(value)
                || "/admin/api/admin/member/company-approve/page".equals(value)
                || "/admin/api/admin/member/company-approve/action".equals(value)
                || "/admin/api/admin/member/company-list/page".equals(value)
                || "/admin/api/admin/member/company-detail/page".equals(value)
                || "/admin/api/admin/member/company-account/page".equals(value)
                || "/admin/api/admin/member/company-account".equals(value)
                || "/admin/trade/approve/page-data".equals(value)
                || "/admin/api/admin/trade/approve/action".equals(value)
                || "/admin/api/admin/companies/search".equals(value);
    }

    private boolean isMemberAdminRoute(String normalizedUri) {
        String value = safeString(normalizedUri);
        return "/admin/member/admin_list".equals(value)
                || "/admin/member/admin-list".equals(value)
                || "/admin/member/admin_account".equals(value)
                || "/admin/member/admin_account/permissions".equals(value)
                || "/admin/api/admin/member/admin-list/page".equals(value)
                || "/admin/api/admin/member/admin-account/page".equals(value)
                || "/admin/api/admin/member/admin-account/check-id".equals(value)
                || "/admin/api/admin/member/admin-account".equals(value)
                || "/admin/api/admin/member/admin-account/permissions".equals(value);
    }

    private boolean isMemberCompanyScopedRoute(String normalizedUri) {
        String value = safeString(normalizedUri);
        return "/admin/member/list".equals(value)
                || "/admin/member/register".equals(value)
                || "/admin/member/edit".equals(value)
                || "/admin/member/detail".equals(value)
                || "/admin/member/reset_password".equals(value)
                || "/admin/member/approve".equals(value)
                || "/admin/api/admin/member/list/page".equals(value)
                || "/admin/api/admin/member/edit".equals(value)
                || "/admin/api/admin/member/detail/page".equals(value)
                || "/admin/api/admin/member/reset-password".equals(value)
                || "/admin/api/admin/member/approve/page".equals(value)
                || "/admin/api/admin/member/approve/action".equals(value)
                || isMemberAdminRoute(value);
    }

    private String resolveMemberInsttId(String memberId) {
        String normalizedMemberId = safeString(memberId);
        if (normalizedMemberId.isEmpty()) {
            return "";
        }
        try {
            EntrprsManageVO member = enterpriseMemberService.selectEntrprsmberByMberId(normalizedMemberId);
            return member == null ? "" : safeString(member.getInsttId());
        } catch (Exception e) {
            return "";
        }
    }

    private String resolveMemberFileInsttId(String fileId) {
        String normalizedFileId = safeString(fileId);
        if (normalizedFileId.isEmpty()) {
            return "";
        }
        try {
            EntrprsMberFileVO fileVO = enterpriseMemberService.selectEntrprsMberFileByFileId(normalizedFileId);
            if (fileVO == null) {
                return "";
            }
            return resolveMemberInsttId(fileVO.getEntrprsmberId());
        } catch (Exception e) {
            return "";
        }
    }
}
