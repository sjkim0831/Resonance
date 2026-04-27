package egovframework.com.feature.auth.service;

import egovframework.com.common.context.ProjectRuntimeContext;
import egovframework.com.platform.codex.service.AuthGroupManageService;
import egovframework.com.feature.auth.domain.entity.EmplyrInfo;
import egovframework.com.feature.auth.domain.entity.EntrprsMber;
import egovframework.com.feature.auth.domain.repository.EmployeeMemberRepository;
import egovframework.com.feature.auth.domain.repository.EnterpriseMemberRepository;
import egovframework.com.feature.auth.util.JwtTokenProvider;
import io.jsonwebtoken.Claims;
import org.springframework.core.env.Environment;
import org.springframework.core.env.Profiles;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.stereotype.Service;
import org.springframework.util.ObjectUtils;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Service
public class CurrentUserContextService {

    private static final String ROLE_SYSTEM_MASTER = "ROLE_SYSTEM_MASTER";
    private static final String ROLE_SYSTEM_ADMIN = "ROLE_SYSTEM_ADMIN";
    private static final String ROLE_ADMIN = "ROLE_ADMIN";
    private static final String ROLE_OPERATION_ADMIN = "ROLE_OPERATION_ADMIN";
    private static final long CONTEXT_CACHE_TTL_MILLIS = 5_000L;
    private static final String ADMIN_SIMULATION_SESSION_KEY = "CARBONET_ADMIN_DEV_SIMULATION";

    private final JwtTokenProvider jwtProvider;
    private final AuthGroupManageService authGroupManageService;
    private final EmployeeMemberRepository employeeMemberRepository;
    private final EnterpriseMemberRepository enterpriseMemberRepository;
    private final ProjectRuntimeContext projectRuntimeContext;
    private final Environment environment;
    private final ConcurrentMap<String, CachedUserContext> userContextCache = new ConcurrentHashMap<>();

    public CurrentUserContextService(JwtTokenProvider jwtProvider,
                                     AuthGroupManageService authGroupManageService,
                                     EmployeeMemberRepository employeeMemberRepository,
                                     EnterpriseMemberRepository enterpriseMemberRepository,
                                     ProjectRuntimeContext projectRuntimeContext,
                                     Environment environment) {
        this.jwtProvider = jwtProvider;
        this.authGroupManageService = authGroupManageService;
        this.employeeMemberRepository = employeeMemberRepository;
        this.enterpriseMemberRepository = enterpriseMemberRepository;
        this.projectRuntimeContext = projectRuntimeContext;
        this.environment = environment;
    }

    public CurrentUserContext resolve(HttpServletRequest request) {
        CurrentUserContext context = new CurrentUserContext();
        if (request == null) {
            return context;
        }
        Object token = request.getAttribute("_csrf");
        if (token instanceof CsrfToken) {
            CsrfToken csrfToken = (CsrfToken) token;
            context.setCsrfToken(csrfToken.getToken());
            context.setCsrfHeaderName(csrfToken.getHeaderName());
        }
        String actualUserId = extractCurrentUserId(request);
        context.setActualUserId(actualUserId);
        context.setSimulationAvailable(isSimulationAvailable(request, actualUserId));
        SessionSimulationOverride simulationOverride = context.isSimulationAvailable()
                ? readSessionSimulationOverride(request, actualUserId)
                : null;
        if (simulationOverride != null) {
            context.setSimulationActive(true);
        }
        String effectiveUserId = simulationOverride == null ? actualUserId : simulationOverride.getEmplyrId();
        return resolve(effectiveUserId, context, simulationOverride);
    }

    public CurrentUserContext resolve(String userId) {
        CurrentUserContext context = new CurrentUserContext();
        context.setActualUserId(userId);
        return resolve(userId, context, null);
    }

    public boolean canUseSessionSimulation(HttpServletRequest request) {
        return request != null && isSimulationAvailable(request, extractCurrentUserId(request));
    }

    public void saveSessionSimulation(HttpServletRequest request, String ownerUserId, String emplyrId, String authorCode, String insttId) {
        if (request == null || !isSimulationAvailable(request, ownerUserId)) {
            return;
        }
        HttpSession session = request.getSession(true);
        if (session == null) {
            return;
        }
        SessionSimulationOverride override = new SessionSimulationOverride(
                safeString(ownerUserId),
                safeString(emplyrId),
                safeString(authorCode).toUpperCase(Locale.ROOT),
                safeString(insttId));
        session.setAttribute(ADMIN_SIMULATION_SESSION_KEY, override);
        invalidateCache();
    }

    public void clearSessionSimulation(HttpServletRequest request) {
        if (request == null) {
            return;
        }
        HttpSession session = request.getSession(false);
        if (session != null) {
            session.removeAttribute(ADMIN_SIMULATION_SESSION_KEY);
        }
        invalidateCache();
    }

    public void invalidateCache() {
        userContextCache.clear();
    }

    private CurrentUserContext resolve(String userId, CurrentUserContext context, SessionSimulationOverride simulationOverride) {
        String normalizedUserId = safeString(userId);
        context.setUserId(normalizedUserId);
        context.setAuthenticated(!normalizedUserId.isEmpty());
        context.setWebmaster(isWebmaster(normalizedUserId));
        if (normalizedUserId.isEmpty()) {
            context.setCompanyScope("anonymous");
            return context;
        }

        applyCachedUserContext(normalizedUserId, context, simulationOverride);
        return context;
    }

    private void applyCachedUserContext(String userId, CurrentUserContext context, SessionSimulationOverride simulationOverride) {
        String cacheKey = buildCacheKey(userId, simulationOverride);
        CachedUserContext cached = userContextCache.get(cacheKey);
        long now = System.currentTimeMillis();
        if (cached != null && cached.expiresAt > now) {
            cached.applyTo(context);
            return;
        }

        CurrentUserContext resolved = new CurrentUserContext();
        resolved.setUserId(userId);
        resolved.setAuthenticated(true);
        resolved.setWebmaster(isWebmaster(userId));

        String authorCode = simulationOverride == null
                ? resolveAuthorCode(userId)
                : safeString(simulationOverride.getAuthorCode()).toUpperCase(Locale.ROOT);
        if (authorCode.isEmpty()) {
            authorCode = resolveAuthorCode(userId);
        }
        List<String> featureCodes = resolveFeatureCodes(authorCode);
        resolved.setAuthorCode(authorCode);
        String insttId = simulationOverride == null ? "" : safeString(simulationOverride.getInsttId());
        resolved.setInsttId(insttId.isEmpty() ? resolveInsttId(userId) : insttId);
        resolved.setCompanyScope(resolveCompanyScope(userId, authorCode));
        resolved.setFeatureCodes(featureCodes);
        resolved.setCapabilityCodes(toCapabilityCodes(featureCodes));

        userContextCache.put(cacheKey, CachedUserContext.from(resolved, now + CONTEXT_CACHE_TTL_MILLIS));
        resolved.copyResolvedFieldsTo(context);
    }

    private String buildCacheKey(String userId, SessionSimulationOverride simulationOverride) {
        if (simulationOverride == null) {
            return userId;
        }
        return String.join("|",
                safeString(userId),
                safeString(simulationOverride.getAuthorCode()).toUpperCase(Locale.ROOT),
                safeString(simulationOverride.getInsttId()));
    }

    private SessionSimulationOverride readSessionSimulationOverride(HttpServletRequest request, String actualUserId) {
        if (request == null || !isSimulationAvailable(request, actualUserId)) {
            return null;
        }
        HttpSession session = request.getSession(false);
        if (session == null) {
            return null;
        }
        Object value = session.getAttribute(ADMIN_SIMULATION_SESSION_KEY);
        if (!(value instanceof SessionSimulationOverride)) {
            return null;
        }
        SessionSimulationOverride override = (SessionSimulationOverride) value;
        if (!safeString(actualUserId).equalsIgnoreCase(safeString(override.getOwnerUserId()))) {
            session.removeAttribute(ADMIN_SIMULATION_SESSION_KEY);
            return null;
        }
        if (safeString(override.getEmplyrId()).isEmpty()) {
            session.removeAttribute(ADMIN_SIMULATION_SESSION_KEY);
            return null;
        }
        return override;
    }

    private boolean isSimulationAvailable(HttpServletRequest request, String actualUserId) {
        if (!environment.acceptsProfiles(Profiles.of("local"))) {
            return false;
        }
        return isWebmaster(actualUserId) || (safeString(actualUserId).isEmpty() && isLoopbackRequest(request));
    }

    private boolean isLoopbackRequest(HttpServletRequest request) {
        if (request == null) {
            return false;
        }
        String remoteAddr = safeString(request.getRemoteAddr());
        return "127.0.0.1".equals(remoteAddr)
                || "0:0:0:0:0:0:0:1".equals(remoteAddr)
                || "::1".equals(remoteAddr)
                || "localhost".equalsIgnoreCase(remoteAddr);
    }

    private String extractCurrentUserId(HttpServletRequest request) {
        try {
            String accessToken = jwtProvider.getCookie(request, "accessToken");
            if (ObjectUtils.isEmpty(accessToken)) {
                return "";
            }
            Claims claims = jwtProvider.accessExtractClaims(accessToken);
            Object encryptedUserId = claims.get("userId");
            return encryptedUserId == null ? "" : safeString(jwtProvider.decrypt(encryptedUserId.toString()));
        } catch (Exception e) {
            return "";
        }
    }

    private String resolveAuthorCode(String userId) {
        if (isWebmaster(userId)) {
            return ROLE_SYSTEM_MASTER;
        }
        try {
            return safeString(authGroupManageService.selectAuthorCodeByUserId(userId)).toUpperCase(Locale.ROOT);
        } catch (Exception e) {
            return "";
        }
    }

    private List<String> resolveFeatureCodes(String authorCode) {
        try {
            return normalizeFeatureCodes(authGroupManageService.selectAuthorFeatureCodes(authorCode));
        } catch (Exception e) {
            return new ArrayList<>();
        }
    }

    private String resolveInsttId(String userId) {
        if (userId.isEmpty() || isWebmaster(userId)) {
            return "";
        }

        String employeeInsttId = employeeMemberRepository.findById(userId)
                .map(EmplyrInfo::getInsttId)
                .map(this::safeString)
                .orElse("");
        if (!employeeInsttId.isEmpty()) {
            return employeeInsttId;
        }

        String projectId = currentProjectId();
        if (!projectId.isEmpty()) {
            String projectScopedInsttId = enterpriseMemberRepository.findByEntrprsMberIdAndProjectId(userId, projectId)
                    .map(EntrprsMber::getInsttId)
                    .map(this::safeString)
                    .orElse("");
            if (!projectScopedInsttId.isEmpty()) {
                return projectScopedInsttId;
            }
        }

        String fallbackInsttId = enterpriseMemberRepository.findById(userId)
                .map(EntrprsMber::getInsttId)
                .map(this::safeString)
                .orElse("");
        if (!fallbackInsttId.isEmpty()) {
            return fallbackInsttId;
        }

        try {
            return safeString(authGroupManageService.selectEnterpriseInsttIdByUserId(userId));
        } catch (Exception e) {
            return "";
        }
    }

    private String resolveCompanyScope(String userId, String authorCode) {
        if (isWebmaster(userId)) {
            return "global";
        }
        String normalizedAuthorCode = safeString(authorCode).toUpperCase(Locale.ROOT);
        if (ROLE_SYSTEM_MASTER.equals(normalizedAuthorCode)
                || ROLE_SYSTEM_ADMIN.equals(normalizedAuthorCode)
                || ROLE_ADMIN.equals(normalizedAuthorCode)) {
            return "global";
        }
        if (ROLE_OPERATION_ADMIN.equals(normalizedAuthorCode)) {
            return "own-company";
        }
        return "role-scoped";
    }

    private List<String> normalizeFeatureCodes(List<String> featureCodes) {
        if (featureCodes == null) {
            return new ArrayList<>();
        }
        Set<String> dedup = new LinkedHashSet<>();
        for (String featureCode : featureCodes) {
            String normalized = safeString(featureCode).toUpperCase(Locale.ROOT);
            if (!normalized.isEmpty()) {
                dedup.add(normalized);
            }
        }
        return new ArrayList<>(dedup);
    }

    private List<String> toCapabilityCodes(List<String> featureCodes) {
        List<String> capabilityCodes = new ArrayList<>();
        for (String featureCode : featureCodes) {
            capabilityCodes.add(featureCode.toLowerCase(Locale.ROOT).replace('_', '.'));
        }
        return capabilityCodes;
    }

    private boolean isWebmaster(String userId) {
        return "webmaster".equalsIgnoreCase(safeString(userId));
    }

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }

    private String currentProjectId() {
        return projectRuntimeContext == null ? "" : safeString(projectRuntimeContext.getProjectId());
    }

    public static class CurrentUserContext {
        private String actualUserId = "";
        private String userId = "";
        private String authorCode = "";
        private String insttId = "";
        private String companyScope = "anonymous";
        private boolean authenticated;
        private boolean webmaster;
        private boolean simulationAvailable;
        private boolean simulationActive;
        private String csrfToken = "";
        private String csrfHeaderName = "";
        private List<String> featureCodes = new ArrayList<>();
        private List<String> capabilityCodes = new ArrayList<>();

        public String getActualUserId() {
            return actualUserId;
        }

        public void setActualUserId(String actualUserId) {
            this.actualUserId = actualUserId == null ? "" : actualUserId;
        }

        public String getUserId() {
            return userId;
        }

        public void setUserId(String userId) {
            this.userId = userId == null ? "" : userId;
        }

        public String getAuthorCode() {
            return authorCode;
        }

        public void setAuthorCode(String authorCode) {
            this.authorCode = authorCode == null ? "" : authorCode;
        }

        public String getInsttId() {
            return insttId;
        }

        public void setInsttId(String insttId) {
            this.insttId = insttId == null ? "" : insttId;
        }

        public String getCompanyScope() {
            return companyScope;
        }

        public void setCompanyScope(String companyScope) {
            this.companyScope = companyScope == null ? "" : companyScope;
        }

        public boolean isAuthenticated() {
            return authenticated;
        }

        public void setAuthenticated(boolean authenticated) {
            this.authenticated = authenticated;
        }

        public boolean isWebmaster() {
            return webmaster;
        }

        public void setWebmaster(boolean webmaster) {
            this.webmaster = webmaster;
        }

        public boolean isSimulationAvailable() {
            return simulationAvailable;
        }

        public void setSimulationAvailable(boolean simulationAvailable) {
            this.simulationAvailable = simulationAvailable;
        }

        public boolean isSimulationActive() {
            return simulationActive;
        }

        public void setSimulationActive(boolean simulationActive) {
            this.simulationActive = simulationActive;
        }

        public String getCsrfToken() {
            return csrfToken;
        }

        public void setCsrfToken(String csrfToken) {
            this.csrfToken = csrfToken == null ? "" : csrfToken;
        }

        public String getCsrfHeaderName() {
            return csrfHeaderName;
        }

        public void setCsrfHeaderName(String csrfHeaderName) {
            this.csrfHeaderName = csrfHeaderName == null ? "" : csrfHeaderName;
        }

        public List<String> getFeatureCodes() {
            return featureCodes;
        }

        public void setFeatureCodes(List<String> featureCodes) {
            this.featureCodes = featureCodes == null ? new ArrayList<>() : new ArrayList<>(featureCodes);
        }

        public List<String> getCapabilityCodes() {
            return capabilityCodes;
        }

        public void setCapabilityCodes(List<String> capabilityCodes) {
            this.capabilityCodes = capabilityCodes == null ? new ArrayList<>() : new ArrayList<>(capabilityCodes);
        }

        private void copyResolvedFieldsTo(CurrentUserContext target) {
            target.setAuthorCode(authorCode);
            target.setInsttId(insttId);
            target.setCompanyScope(companyScope);
            target.setFeatureCodes(featureCodes);
            target.setCapabilityCodes(capabilityCodes);
        }
    }

    private static final class CachedUserContext {
        private final long expiresAt;
        private final String authorCode;
        private final String insttId;
        private final String companyScope;
        private final List<String> featureCodes;
        private final List<String> capabilityCodes;

        private CachedUserContext(long expiresAt,
                                  String authorCode,
                                  String insttId,
                                  String companyScope,
                                  List<String> featureCodes,
                                  List<String> capabilityCodes) {
            this.expiresAt = expiresAt;
            this.authorCode = authorCode;
            this.insttId = insttId;
            this.companyScope = companyScope;
            this.featureCodes = featureCodes;
            this.capabilityCodes = capabilityCodes;
        }

        private static CachedUserContext from(CurrentUserContext context, long expiresAt) {
            return new CachedUserContext(
                    expiresAt,
                    context.getAuthorCode(),
                    context.getInsttId(),
                    context.getCompanyScope(),
                    new ArrayList<>(context.getFeatureCodes()),
                    new ArrayList<>(context.getCapabilityCodes())
            );
        }

        private void applyTo(CurrentUserContext context) {
            context.setAuthorCode(authorCode);
            context.setInsttId(insttId);
            context.setCompanyScope(companyScope);
            context.setFeatureCodes(featureCodes);
            context.setCapabilityCodes(capabilityCodes);
        }
    }

    public static final class SessionSimulationOverride {
        private final String ownerUserId;
        private final String emplyrId;
        private final String authorCode;
        private final String insttId;

        public SessionSimulationOverride(String ownerUserId, String emplyrId, String authorCode, String insttId) {
            this.ownerUserId = ownerUserId == null ? "" : ownerUserId;
            this.emplyrId = emplyrId == null ? "" : emplyrId;
            this.authorCode = authorCode == null ? "" : authorCode;
            this.insttId = insttId == null ? "" : insttId;
        }

        public String getOwnerUserId() {
            return ownerUserId;
        }

        public String getEmplyrId() {
            return emplyrId;
        }

        public String getAuthorCode() {
            return authorCode;
        }

        public String getInsttId() {
            return insttId;
        }
    }
}
// agent note: updated by FreeAgent Ultra
