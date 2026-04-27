package egovframework.com.common.interceptor;

import egovframework.com.common.context.ProjectRuntimeContext;
import egovframework.com.platform.codex.service.AuthGroupManageService;
import egovframework.com.feature.auth.domain.entity.EmplyrInfo;
import egovframework.com.feature.auth.domain.entity.EntrprsMber;
import egovframework.com.feature.auth.domain.repository.EmployeeMemberRepository;
import egovframework.com.feature.auth.domain.repository.EnterpriseMemberRepository;
import egovframework.com.feature.auth.util.JwtTokenProvider;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.util.ObjectUtils;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.util.HtmlUtils;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.nio.charset.StandardCharsets;
import java.util.Locale;

@Component
@RequiredArgsConstructor
public class CompanyScopeInterceptor implements HandlerInterceptor {

    private static final String ROLE_SYSTEM_MASTER = "ROLE_SYSTEM_MASTER";
    private static final String ROLE_SYSTEM_ADMIN = "ROLE_SYSTEM_ADMIN";
    private static final String ROLE_ADMIN = "ROLE_ADMIN";

    private final JwtTokenProvider jwtProvider;
    private final EmployeeMemberRepository employeeMemberRepository;
    private final EnterpriseMemberRepository enterpriseMemberRepository;
    private final AuthGroupManageService authGroupManageService;
    private final ProjectRuntimeContext projectRuntimeContext;

    @Override
    public boolean preHandle(HttpServletRequest request, HttpServletResponse response, Object handler) throws Exception {
        String requestUri = safeString(request.getRequestURI());
        if (shouldSkip(requestUri)) {
            return true;
        }

        String accessToken = jwtProvider.getCookie(request, "accessToken");
        if (ObjectUtils.isEmpty(accessToken) || jwtProvider.accessValidateToken(accessToken) != 200) {
            markScope(request, "ANONYMOUS", "");
            return true;
        }

        String userId = extractCurrentUserId(accessToken);
        if (userId.isEmpty()) {
            markScope(request, "TOKEN_INVALID", "Authenticated user information is missing.");
            return true;
        }

        String actorInsttId = resolveActorInsttId(userId);
        String authorCode = resolveAuthorCode(userId);
        boolean globalAccess = hasGlobalAccess(authorCode);
        String normalizedUri = normalizeUri(requestUri);
        String explicitInsttId = resolveExplicitInsttId(request);
        String targetInsttId = explicitInsttId.isEmpty() ? resolveImplicitTargetInsttId(normalizedUri, actorInsttId) : explicitInsttId;

        request.setAttribute("targetCompanyContextId", targetInsttId);

        if (globalAccess) {
            if (explicitInsttId.isEmpty() && requiresCompanyAwareAudit(normalizedUri)) {
                markScope(request, "ALLOW_GLOBAL_NO_CONTEXT", "Global administrator executed the request without an explicit company context.");
            } else {
                markScope(request, "ALLOW_GLOBAL", "");
            }
            return true;
        }

        if (!requiresCompanyScope(normalizedUri, actorInsttId)) {
            markScope(request, "NOT_REQUIRED", "");
            return true;
        }

        if (actorInsttId.isEmpty()) {
            markScope(request, "DENY_NO_ACTOR_COMPANY", "Authenticated account is missing company information.");
            denyWithMessage(request, response,
                    "Your account is missing company information.",
                    "계정에 회사 정보가 없습니다.");
            return false;
        }

        if (targetInsttId.isEmpty()) {
            markScope(request, "DENY_MISSING_COMPANY_CONTEXT", "The request did not include or resolve a company context.");
            denyWithMessage(request, response,
                    "Company context is required for this request.",
                    "이 요청에는 회사 컨텍스트가 필요합니다.");
            return false;
        }

        if (!actorInsttId.equals(targetInsttId)) {
            markScope(request, "DENY_COMPANY_MISMATCH", "The request company does not match the actor company.");
            denyWithMessage(request, response,
                    "You can only access data in your own company.",
                    "본인 회사 데이터만 접근할 수 있습니다.");
            return false;
        }

        if (explicitInsttId.isEmpty()) {
            markScope(request, "ALLOW_IMPLICIT_SELF", "The request was resolved to the actor company without an explicit company parameter.");
        } else {
            markScope(request, "ALLOW_MATCHED", "");
        }
        return true;
    }

    private boolean shouldSkip(String requestUri) {
        String uri = normalizeUri(requestUri);
        return uri.isEmpty()
                || uri.startsWith("/admin")
                || uri.startsWith("/css/")
                || uri.startsWith("/js/")
                || uri.startsWith("/images/")
                || uri.startsWith("/webjars/")
                || uri.startsWith("/error")
                || uri.startsWith("/actuator")
                || "/".equals(uri)
                || "/home".equals(uri)
                || "/signin".equals(uri)
                || uri.startsWith("/signin/")
                || uri.startsWith("/join/")
                || uri.startsWith("/home/fragments/");
    }

    private boolean requiresCompanyScope(String normalizedUri, String actorInsttId) {
        if (actorInsttId.isEmpty()) {
            return false;
        }
        return normalizedUri.startsWith("/mypage")
                || normalizedUri.startsWith("/emission/")
                || normalizedUri.startsWith("/certificate/")
                || normalizedUri.startsWith("/co2/")
                || normalizedUri.startsWith("/trade/")
                || normalizedUri.startsWith("/monitoring/")
                || normalizedUri.startsWith("/payment/")
                || normalizedUri.startsWith("/edu/")
                || normalizedUri.startsWith("/support/")
                || normalizedUri.startsWith("/mtn/")
                || normalizedUri.startsWith("/api/");
    }

    private boolean requiresCompanyAwareAudit(String normalizedUri) {
        return normalizedUri.startsWith("/mypage")
                || normalizedUri.startsWith("/emission/")
                || normalizedUri.startsWith("/certificate/")
                || normalizedUri.startsWith("/co2/")
                || normalizedUri.startsWith("/trade/")
                || normalizedUri.startsWith("/monitoring/")
                || normalizedUri.startsWith("/payment/")
                || normalizedUri.startsWith("/edu/")
                || normalizedUri.startsWith("/support/")
                || normalizedUri.startsWith("/mtn/")
                || normalizedUri.startsWith("/api/")
                || normalizedUri.startsWith("/admin/");
    }

    private String resolveImplicitTargetInsttId(String normalizedUri, String actorInsttId) {
        if (normalizedUri.startsWith("/mypage")
                || normalizedUri.startsWith("/emission/")
                || normalizedUri.startsWith("/certificate/")
                || normalizedUri.startsWith("/co2/")
                || normalizedUri.startsWith("/trade/")
                || normalizedUri.startsWith("/monitoring/")
                || normalizedUri.startsWith("/payment/")
                || normalizedUri.startsWith("/edu/")
                || normalizedUri.startsWith("/support/")
                || normalizedUri.startsWith("/mtn/")
                || normalizedUri.startsWith("/api/")) {
            return actorInsttId;
        }
        return "";
    }

    private String resolveExplicitInsttId(HttpServletRequest request) {
        String[] candidates = {
                request.getParameter("insttId"),
                request.getParameter("companyId"),
                request.getParameter("cmpnyId"),
                request.getHeader("X-Instt-Id"),
                request.getHeader("X-Company-Id")
        };
        for (String candidate : candidates) {
            String value = safeString(candidate);
            if (!value.isEmpty()) {
                return value;
            }
        }
        return "";
    }

    private String resolveActorInsttId(String userId) {
        try {
            EmplyrInfo admin = employeeMemberRepository.findById(userId).orElse(null);
            if (admin != null) {
                return safeString(admin.getInsttId());
            }
            EntrprsMber member = findEnterpriseMember(userId);
            if (member != null) {
                return safeString(member.getInsttId());
            }
        } catch (Exception ignored) {
        }
        return "";
    }

    private EntrprsMber findEnterpriseMember(String userId) {
        String normalizedUserId = safeString(userId);
        if (normalizedUserId.isEmpty()) {
            return null;
        }
        String projectId = currentProjectId();
        if (!projectId.isEmpty()) {
            return enterpriseMemberRepository.findByEntrprsMberIdAndProjectId(normalizedUserId, projectId).orElse(null);
        }
        return enterpriseMemberRepository.findById(normalizedUserId).orElse(null);
    }

    private String resolveAuthorCode(String userId) {
        try {
            String authorCode = safeString(authGroupManageService.selectAuthorCodeByUserId(userId)).toUpperCase(Locale.ROOT);
            if (!authorCode.isEmpty()) {
                return authorCode;
            }
            return safeString(authGroupManageService.selectEnterpriseAuthorCodeByUserId(userId)).toUpperCase(Locale.ROOT);
        } catch (Exception e) {
            return "";
        }
    }

    private boolean hasGlobalAccess(String authorCode) {
        String normalized = safeString(authorCode).toUpperCase(Locale.ROOT);
        return ROLE_SYSTEM_MASTER.equals(normalized)
                || ROLE_SYSTEM_ADMIN.equals(normalized)
                || ROLE_ADMIN.equals(normalized);
    }

    private String extractCurrentUserId(String accessToken) {
        try {
            Claims claims = jwtProvider.accessExtractClaims(accessToken);
            Object encryptedUserId = claims.get("userId");
            if (ObjectUtils.isEmpty(encryptedUserId)) {
                return "";
            }
            return safeString(jwtProvider.decrypt(encryptedUserId.toString()));
        } catch (Exception e) {
            return "";
        }
    }

    private void markScope(HttpServletRequest request, String decision, String reason) {
        request.setAttribute("companyScopeDecision", safeString(decision));
        request.setAttribute("companyScopeReason", safeString(reason));
    }

    private void denyWithMessage(HttpServletRequest request, HttpServletResponse response,
                                 String englishMessage, String koreanMessage) throws Exception {
        String message = isEnglishRequest(request) ? englishMessage : koreanMessage;
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setCharacterEncoding(StandardCharsets.UTF_8.name());
        if (isAjaxRequest(request)) {
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"status\":403,\"message\":\"" + escapeJson(message) + "\"}");
            return;
        }
        response.setContentType("text/html;charset=UTF-8");
        response.getWriter().write("<script>alert('" + escapeJs(message) + "');history.back();</script>");
    }

    private boolean isAjaxRequest(HttpServletRequest request) {
        String requestedWith = safeString(request.getHeader("X-Requested-With"));
        return "XMLHttpRequest".equalsIgnoreCase(requestedWith)
                || safeString(request.getHeader("Accept")).toLowerCase(Locale.ROOT).contains("application/json");
    }

    private boolean isEnglishRequest(HttpServletRequest request) {
        String uri = safeString(request.getRequestURI());
        return uri.startsWith("/en/") || "en".equalsIgnoreCase(safeString(request.getParameter("language")));
    }

    private String normalizeUri(String requestUri) {
        String value = safeString(requestUri);
        return value.startsWith("/en/") ? value.substring(3) : value;
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

    private String currentProjectId() {
        return safeString(projectRuntimeContext == null ? null : projectRuntimeContext.getProjectId());
    }
}
