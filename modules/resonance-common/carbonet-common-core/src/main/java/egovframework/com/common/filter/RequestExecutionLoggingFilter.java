package egovframework.com.common.filter;

import egovframework.com.common.audit.AuditTrailService;
import egovframework.com.common.context.ProjectRuntimeContext;
import egovframework.com.common.logging.AccessEventService;
import egovframework.com.common.logging.RequestExecutionLogService;
import egovframework.com.common.logging.RequestExecutionLogVO;
import egovframework.com.common.trace.TraceContext;
import egovframework.com.common.trace.TraceContextHolder;
import egovframework.com.platform.codex.service.AuthGroupManageService;
import egovframework.com.feature.auth.domain.entity.EmplyrInfo;
import egovframework.com.feature.auth.domain.entity.EntrprsMber;
import egovframework.com.feature.auth.domain.repository.EmployeeMemberRepository;
import egovframework.com.feature.auth.domain.repository.EnterpriseMemberRepository;
import egovframework.com.feature.auth.util.JwtTokenProvider;
import io.jsonwebtoken.Claims;
import lombok.extern.slf4j.Slf4j;
import org.springframework.util.ObjectUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Slf4j
public class RequestExecutionLoggingFilter extends OncePerRequestFilter {

    private static final String MASTER_ROLE = "ROLE_SYSTEM_MASTER";
    private static final DateTimeFormatter TS_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final RequestExecutionLogService requestExecutionLogService;
    private final AccessEventService accessEventService;
    private final AuditTrailService auditTrailService;
    private final JwtTokenProvider jwtTokenProvider;
    private final AuthGroupManageService authGroupManageService;
    private final EmployeeMemberRepository employeeMemberRepository;
    private final EnterpriseMemberRepository enterpriseMemberRepository;
    private final ProjectRuntimeContext projectRuntimeContext;

    public RequestExecutionLoggingFilter(RequestExecutionLogService requestExecutionLogService,
                                         AccessEventService accessEventService,
                                         AuditTrailService auditTrailService,
                                         JwtTokenProvider jwtTokenProvider,
                                         AuthGroupManageService authGroupManageService,
                                         EmployeeMemberRepository employeeMemberRepository,
                                         EnterpriseMemberRepository enterpriseMemberRepository,
                                         ProjectRuntimeContext projectRuntimeContext) {
        this.requestExecutionLogService = requestExecutionLogService;
        this.accessEventService = accessEventService;
        this.auditTrailService = auditTrailService;
        this.jwtTokenProvider = jwtTokenProvider;
        this.authGroupManageService = authGroupManageService;
        this.employeeMemberRepository = employeeMemberRepository;
        this.enterpriseMemberRepository = enterpriseMemberRepository;
        this.projectRuntimeContext = projectRuntimeContext;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        long startedAt = System.currentTimeMillis();
        Exception failure = null;
        try {
            filterChain.doFilter(request, response);
        } catch (Exception e) {
            failure = e;
            throw e;
        } finally {
            try {
                RequestExecutionLogVO item = buildLog(request, response, startedAt, failure);
                TraceContext traceContext = TraceContextHolder.get();
                requestExecutionLogService.append(item);
                accessEventService.recordRequestLog(item, traceContext);
                recordApiAuditIfNeeded(item, request, traceContext);
            } catch (Exception e) {
                log.warn("Failed to append request execution log. uri={}", request.getRequestURI(), e);
            }
        }
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = safeString(request.getRequestURI()).toLowerCase(Locale.ROOT);
        return path.isEmpty()
                || path.startsWith("/css/")
                || path.startsWith("/js/")
                || path.startsWith("/images/")
                || path.startsWith("/webjars/")
                || path.startsWith("/error")
                || path.startsWith("/actuator")
                || path.matches(".*\\.(css|js|png|jpg|jpeg|gif|svg|woff|woff2|ttf|otf|eot|ico|html)$");
    }

    private RequestExecutionLogVO buildLog(HttpServletRequest request, HttpServletResponse response,
                                           long startedAt, Exception failure) {
        RequestExecutionLogVO item = new RequestExecutionLogVO();
        item.setLogId("REQ-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase(Locale.ROOT));
        item.setExecutedAt(LocalDateTime.now().format(TS_FORMAT));
        item.setRequestUri(safeString(request.getRequestURI()));
        TraceContext traceContext = TraceContextHolder.get();
        item.setTraceId(traceContext == null ? "" : safeString(traceContext.getTraceId()));
        item.setRequestId(traceContext == null ? "" : safeString(traceContext.getRequestId()));
        item.setHttpMethod(safeString(request.getMethod()).toUpperCase(Locale.ROOT));
        item.setFeatureType(resolveFeatureType(request));
        item.setRequestContentType(safeString(request.getContentType()));
        item.setResponseStatus(response == null ? 0 : response.getStatus());
        item.setDurationMs(Math.max(System.currentTimeMillis() - startedAt, 0));
        item.setRemoteAddr(safeString(request.getRemoteAddr()));
        item.setQueryString(safeString(request.getQueryString()));
        item.setParameterSummary(buildParameterSummary(request));
        item.setErrorMessage(failure == null ? "" : safeString(failure.getMessage()));

        populateActor(item, request);
        populateMenuContext(item, request);

        String explicitCompanyContextId = resolveExplicitCompanyContextId(request);
        String targetCompanyContextId = resolveTargetCompanyContextId(request, item.getActorInsttId());
        String companyContextId = explicitCompanyContextId.isEmpty() ? targetCompanyContextId : explicitCompanyContextId;
        boolean companyRequired = !MASTER_ROLE.equalsIgnoreCase(safeString(item.getActorAuthorCode()));
        item.setCompanyContextId(companyContextId);
        item.setTargetCompanyContextId(targetCompanyContextId);
        item.setCompanyContextRequired(companyRequired);
        item.setCompanyContextIncluded(!companyRequired || !safeString(companyContextId).isEmpty());
        item.setCompanyContextExplicit(!explicitCompanyContextId.isEmpty());
        item.setCompanyScopeDecision(safeString((String) request.getAttribute("companyScopeDecision")));
        item.setCompanyScopeReason(safeString((String) request.getAttribute("companyScopeReason")));

        return item;
    }

    private void populateMenuContext(RequestExecutionLogVO item, HttpServletRequest request) {
        String normalizedUri = normalizeMenuUrl(request == null ? "" : request.getRequestURI());
        if (normalizedUri.isEmpty()) {
            return;
        }
        try {
            String menuCode = safeString(authGroupManageService.selectMenuCodeByMenuUrl(normalizedUri));
            if (menuCode.isEmpty()) {
                menuCode = resolveActionMenuCode(normalizedUri);
            }
            item.setMenuCode(menuCode);
            if ("GET".equalsIgnoreCase(item.getHttpMethod())) {
                item.setFeatureCode(safeString(authGroupManageService.selectRequiredViewFeatureCodeByMenuUrl(normalizedUri)));
            } else if (!menuCode.isEmpty()) {
                item.setFeatureCode(resolveFeatureCodeByMenuCode(menuCode, normalizedUri, item.getHttpMethod()));
            }
        } catch (Exception e) {
            log.debug("Failed to resolve menu/feature context. uri={}", normalizedUri, e);
        }
    }

    private void populateActor(RequestExecutionLogVO item, HttpServletRequest request) {
        String accessToken = jwtTokenProvider.getCookie(request, "accessToken");
        String userId = extractCurrentUserId(accessToken);
        item.setActorUserId(userId);
        if (userId.isEmpty()) {
            item.setActorType("ANONYMOUS");
            return;
        }
        try {
            if (employeeMemberRepository.findById(userId).isPresent()) {
                item.setActorType("ADMIN");
            } else if (findEnterpriseMember(userId) != null) {
                item.setActorType("ENTERPRISE_MEMBER");
            } else {
                item.setActorType("AUTHENTICATED");
            }
            String authorCode = safeString(authGroupManageService.selectAuthorCodeByUserId(userId)).toUpperCase(Locale.ROOT);
            if (authorCode.isEmpty()) {
                authorCode = safeString(authGroupManageService.selectEnterpriseAuthorCodeByUserId(userId)).toUpperCase(Locale.ROOT);
            }
            item.setActorAuthorCode(authorCode);
        } catch (Exception e) {
            log.debug("Failed to resolve actor role. userId={}", userId, e);
        }
        try {
            String insttId = employeeMemberRepository.findById(userId)
                    .map(EmplyrInfo::getInsttId)
                    .map(this::safeString)
                    .orElse("");
            if (insttId.isEmpty()) {
                EntrprsMber member = findEnterpriseMember(userId);
                insttId = member == null ? "" : safeString(member.getInsttId());
            }
            if (insttId.isEmpty()) {
                insttId = safeString(authGroupManageService.selectEnterpriseInsttIdByUserId(userId));
            }
            item.setActorInsttId(insttId);
        } catch (Exception e) {
            log.debug("Failed to resolve actor company. userId={}", userId, e);
        }
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

    private String extractCurrentUserId(String accessToken) {
        if (ObjectUtils.isEmpty(accessToken)) {
            return "";
        }
        try {
            Claims claims = jwtTokenProvider.accessExtractClaims(accessToken);
            Object encryptedUserId = claims.get("userId");
            if (ObjectUtils.isEmpty(encryptedUserId)) {
                return "";
            }
            return safeString(jwtTokenProvider.decrypt(encryptedUserId.toString()));
        } catch (Exception e) {
            return "";
        }
    }

    private String resolveFeatureType(HttpServletRequest request) {
        String method = safeString(request.getMethod()).toUpperCase(Locale.ROOT);
        String uri = safeString(request.getRequestURI()).toLowerCase(Locale.ROOT);
        String contentType = safeString(request.getContentType()).toLowerCase(Locale.ROOT);

        if (contentType.contains("multipart/") || request.getParameter("fileUploads") != null || uri.contains("upload")) {
            return "FILE_UPLOAD";
        }
        if (uri.contains("address") || uri.contains("juso") || uri.contains("postcode") || uri.contains("roadaddr") || uri.contains("zip")) {
            return "ADDRESS_SEARCH";
        }
        if (uri.contains("download") || uri.contains("excel") || uri.contains("export")) {
            return "FILE_DOWNLOAD";
        }
        if (uri.contains("codex")) {
            return "CODEX";
        }
        if (uri.contains("login") || uri.contains("logout") || uri.contains("token")) {
            return "AUTH";
        }
        if ("GET".equals(method)) {
            if (uri.contains("search") || uri.contains("list") || uri.contains("detail")) {
                return "QUERY";
            }
            return "VIEW";
        }
        if (uri.contains("delete") || "DELETE".equals(method)) {
            return "DELETE";
        }
        if (uri.contains("create") || uri.contains("register")) {
            return "CREATE";
        }
        if (uri.contains("update") || uri.contains("save") || "PUT".equals(method) || "PATCH".equals(method)) {
            return "UPDATE";
        }
        return "ACTION";
    }

    private String resolveFeatureCodeByMenuCode(String menuCode, String normalizedMenuUrl, String method) throws Exception {
        List<String> featureCodes = authGroupManageService.selectFeatureCodesByMenuCode(menuCode);
        if (featureCodes == null || featureCodes.isEmpty()) {
            return "";
        }
        for (String suffix : expectedActionSuffixes(method, normalizedMenuUrl)) {
            for (String featureCode : featureCodes) {
                String normalizedFeatureCode = safeString(featureCode).toUpperCase(Locale.ROOT);
                if (normalizedFeatureCode.endsWith(suffix)) {
                    return normalizedFeatureCode;
                }
            }
        }
        return "";
    }

    private List<String> expectedActionSuffixes(String method, String normalizedMenuUrl) {
        List<String> suffixes = new ArrayList<>();
        String normalizedMethod = safeString(method).toUpperCase(Locale.ROOT);
        String loweredMenuUrl = safeString(normalizedMenuUrl).toLowerCase(Locale.ROOT);
        if ("DELETE".equals(normalizedMethod) || loweredMenuUrl.contains("delete")) {
            suffixes.add("_DELETE");
        }
        if ("POST".equals(normalizedMethod) || loweredMenuUrl.contains("create") || loweredMenuUrl.contains("register")) {
            suffixes.add("_CREATE");
            suffixes.add("_REGISTER");
        }
        if ("PUT".equals(normalizedMethod) || "PATCH".equals(normalizedMethod)
                || loweredMenuUrl.contains("update") || loweredMenuUrl.contains("save")) {
            suffixes.add("_UPDATE");
            suffixes.add("_SAVE");
        }
        suffixes.add("_EXECUTE");
        suffixes.add("_ACTION");
        return suffixes;
    }

    private String resolveActionMenuCode(String normalizedMenuUrl) throws Exception {
        String candidate = safeString(normalizedMenuUrl);
        while (!candidate.isEmpty() && candidate.startsWith("/admin")) {
            String menuCode = safeString(authGroupManageService.selectMenuCodeByMenuUrl(candidate));
            if (!menuCode.isEmpty()) {
                return menuCode;
            }
            int lastSlash = candidate.lastIndexOf('/');
            if (lastSlash <= "/admin".length()) {
                break;
            }
            candidate = candidate.substring(0, lastSlash);
        }
        return "";
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

    private String resolveExplicitCompanyContextId(HttpServletRequest request) {
        List<String> candidates = new ArrayList<>();
        candidates.add(safeString(request.getParameter("companyId")));
        candidates.add(safeString(request.getParameter("insttId")));
        candidates.add(safeString(request.getParameter("cmpnyId")));
        candidates.add(safeString(request.getHeader("X-Company-Id")));
        candidates.add(safeString(request.getHeader("X-Instt-Id")));
        for (String candidate : candidates) {
            if (!candidate.isEmpty()) {
                return candidate;
            }
        }
        return "";
    }

    private String resolveTargetCompanyContextId(HttpServletRequest request, String actorInsttId) {
        String explicitCompanyContextId = resolveExplicitCompanyContextId(request);
        if (!explicitCompanyContextId.isEmpty()) {
            return explicitCompanyContextId;
        }
        return safeString(actorInsttId);
    }

    private String buildParameterSummary(HttpServletRequest request) {
        Enumeration<String> names = request.getParameterNames();
        List<String> pairs = new ArrayList<>();
        while (names != null && names.hasMoreElements()) {
            String name = names.nextElement();
            if (isSensitive(name)) {
                pairs.add(name + "=***");
                continue;
            }
            String[] values = request.getParameterValues(name);
            if (values == null || values.length == 0) {
                pairs.add(name + "=");
                continue;
            }
            String value = safeString(values[0]);
            if (value.length() > 60) {
                value = value.substring(0, 60) + "...";
            }
            pairs.add(name + "=" + value);
        }
        return String.join("&", pairs);
    }

    private boolean isSensitive(String name) {
        String normalized = safeString(name).toLowerCase(Locale.ROOT);
        return normalized.contains("password")
                || normalized.contains("passwd")
                || normalized.contains("token")
                || normalized.contains("secret");
    }

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }

    private String currentProjectId() {
        return safeString(projectRuntimeContext == null ? null : projectRuntimeContext.getProjectId());
    }

    private void recordApiAuditIfNeeded(RequestExecutionLogVO item, HttpServletRequest request, TraceContext traceContext) {
        if (!isAuditableApiRequest(item, request)) {
            return;
        }
        String apiId = traceContext == null ? "" : safeString(traceContext.getApiId());
        String actionCode = apiId.isEmpty() ? "AUTO_API_USAGE" : apiId;
        String reasonSummary = "uri=" + safeString(item.getRequestUri())
                + ", method=" + safeString(item.getHttpMethod())
                + ", status=" + item.getResponseStatus()
                + ", featureType=" + safeString(item.getFeatureType())
                + ", durationMs=" + item.getDurationMs();
        auditTrailService.record(
                safeString(item.getActorUserId()),
                safeString(item.getActorAuthorCode()),
                "",
                traceContext == null ? "" : safeString(traceContext.getPageId()),
                truncate(actionCode, 120),
                "API",
                truncate(safeString(item.getRequestUri()), 120),
                item.getResponseStatus() >= 200 && item.getResponseStatus() < 400 ? "SUCCESS" : "ERROR",
                truncate(reasonSummary, 1000),
                "",
                truncate(safeString(item.getParameterSummary()), 4000),
                safeString(item.getRemoteAddr()),
                truncate(request == null ? "" : request.getHeader("User-Agent"), 500)
        );
    }

    private boolean isAuditableApiRequest(RequestExecutionLogVO item, HttpServletRequest request) {
        String uri = safeString(item.getRequestUri()).toLowerCase(Locale.ROOT);
        if (uri.isEmpty()) {
            return false;
        }
        if (uri.startsWith("/api/") || uri.contains("/api/")) {
            return !uri.startsWith("/api/telemetry/")
                    && !uri.contains("/observability/")
                    && !uri.contains("/access_history/page-data")
                    && !uri.contains("/error/report");
        }
        if (!"GET".equalsIgnoreCase(safeString(item.getHttpMethod()))
                && !"VIEW".equalsIgnoreCase(safeString(item.getFeatureType()))
                && !"QUERY".equalsIgnoreCase(safeString(item.getFeatureType()))) {
            return uri.startsWith("/admin/") || uri.startsWith("/en/admin/");
        }
        return false;
    }

    private String truncate(String value, int maxLength) {
        String safeValue = safeString(value);
        if (safeValue.length() <= maxLength) {
            return safeValue;
        }
        return safeValue.substring(0, maxLength);
    }
}
