package egovframework.com.feature.admin.service.impl;

import egovframework.com.platform.codex.model.UserFeatureOverrideVO;
import egovframework.com.platform.screenbuilder.support.CarbonetScreenBuilderAuthoritySource;
import egovframework.com.platform.screenbuilder.support.model.ScreenBuilderAuthorityDecision;
import egovframework.com.platform.codex.service.AuthGroupManageService;
import egovframework.com.feature.auth.service.CurrentUserContextService;
import egovframework.com.framework.authority.model.FrameworkAuthorityRoleContractVO;
import egovframework.com.framework.authority.service.FrameworkAuthorityContractService;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class CarbonetScreenBuilderAuthoritySourceBridge implements CarbonetScreenBuilderAuthoritySource {

    private static final String FAMILY_MENU_URL = "/admin/system/screen-builder";
    private static final String ROLE_ANONYMOUS = "ROLE_ANONYMOUS";
    private static final String ROLE_SYSTEM_MASTER = "ROLE_SYSTEM_MASTER";

    private final CurrentUserContextService currentUserContextService;
    private final AuthGroupManageService authGroupManageService;
    private final FrameworkAuthorityContractService frameworkAuthorityContractService;

    public CarbonetScreenBuilderAuthoritySourceBridge(CurrentUserContextService currentUserContextService,
                                                      AuthGroupManageService authGroupManageService,
                                                      FrameworkAuthorityContractService frameworkAuthorityContractService) {
        this.currentUserContextService = currentUserContextService;
        this.authGroupManageService = authGroupManageService;
        this.frameworkAuthorityContractService = frameworkAuthorityContractService;
    }

    @Override
    public List<FrameworkAuthorityRoleContractVO> getAuthorityRoles() throws Exception {
        if (frameworkAuthorityContractService.getAuthorityContract() == null
                || frameworkAuthorityContractService.getAuthorityContract().getAuthorityRoles() == null) {
            return new ArrayList<>();
        }
        return frameworkAuthorityContractService.getAuthorityContract().getAuthorityRoles();
    }

    @Override
    public ScreenBuilderAuthorityDecision authorizeMenuAccess(String menuCode,
                                                              String menuUrl,
                                                              String actionScope,
                                                              HttpServletRequest request) {
        CurrentUserContextService.CurrentUserContext context = currentUserContextService.resolve(request);
        String actorId = resolveActorId(context);
        String actorRole = resolveActorRole(context);
        String normalizedActionScope = safe(actionScope).toUpperCase(Locale.ROOT);
        String normalizedMenuUrl = normalizeMenuUrl(menuUrl);
        String normalizedMenuCode = safe(menuCode).toUpperCase(Locale.ROOT);

        if (!context.isAuthenticated()) {
            return deny(normalizedActionScope, normalizedMenuCode, normalizedMenuUrl, actorId, actorRole,
                    "", "DENY_UNAUTHENTICATED",
                    "You must be logged in to access screen builder governance.");
        }
        if (actorRole.isEmpty() || ROLE_ANONYMOUS.equalsIgnoreCase(actorRole)) {
            return deny(normalizedActionScope, normalizedMenuCode, normalizedMenuUrl, actorId, actorRole,
                    "", "DENY_ROLE_MISSING",
                    "Administrator role information is missing.");
        }
        if (context.isWebmaster() || ROLE_SYSTEM_MASTER.equalsIgnoreCase(actorRole)) {
            return ScreenBuilderAuthorityDecision.allow(
                    normalizedActionScope,
                    "",
                    normalizedMenuCode,
                    normalizedMenuUrl,
                    actorId,
                    actorRole);
        }

        String requiredFeatureCode = resolveRequiredFeatureCode(normalizedMenuCode, normalizedMenuUrl, normalizedActionScope);
        if (requiredFeatureCode.isEmpty()) {
            if (isReadScope(normalizedActionScope)) {
                return ScreenBuilderAuthorityDecision.allow(
                        normalizedActionScope,
                        "",
                        normalizedMenuCode,
                        normalizedMenuUrl,
                        actorId,
                        actorRole);
            }
            return deny(normalizedActionScope, normalizedMenuCode, normalizedMenuUrl, actorId, actorRole,
                    "", "DENY_PERMISSION_REGISTRATION_MISSING",
                    "Permission registration is missing for this screen-builder action.");
        }

        String overrideType = resolveOverrideType(actorId, requiredFeatureCode);
        if ("D".equalsIgnoreCase(overrideType)) {
            return deny(normalizedActionScope, normalizedMenuCode, normalizedMenuUrl, actorId, actorRole,
                    requiredFeatureCode, "DENY_FEATURE_OVERRIDE",
                    "You do not have permission for this screen-builder action.");
        }
        if ("A".equalsIgnoreCase(overrideType)) {
            return ScreenBuilderAuthorityDecision.allow(
                    normalizedActionScope,
                    requiredFeatureCode,
                    normalizedMenuCode,
                    normalizedMenuUrl,
                    actorId,
                    actorRole);
        }

        try {
            if (authGroupManageService.hasAuthorFeaturePermission(actorRole, requiredFeatureCode)) {
                return ScreenBuilderAuthorityDecision.allow(
                        normalizedActionScope,
                        requiredFeatureCode,
                        normalizedMenuCode,
                        normalizedMenuUrl,
                        actorId,
                        actorRole);
            }
        } catch (Exception ignore) {
            return deny(normalizedActionScope, normalizedMenuCode, normalizedMenuUrl, actorId, actorRole,
                    requiredFeatureCode, "DENY_AUTHORITY_LOOKUP_FAILED",
                    "Failed to resolve screen-builder authority scope.");
        }
        return deny(normalizedActionScope, normalizedMenuCode, normalizedMenuUrl, actorId, actorRole,
                requiredFeatureCode, "DENY_FEATURE_PERMISSION",
                "You do not have permission for this screen-builder action.");
    }

    @Override
    public ScreenBuilderAuthorityDecision authorizeMenuBatch(List<String> menuCodes,
                                                             String menuUrl,
                                                             String actionScope,
                                                             HttpServletRequest request) {
        List<String> normalizedMenuCodes = normalizeMenuCodes(menuCodes);
        if (normalizedMenuCodes.isEmpty()) {
            return authorizeMenuAccess("", menuUrl, actionScope, request);
        }
        ScreenBuilderAuthorityDecision lastAllowed = null;
        for (String menuCode : normalizedMenuCodes) {
            ScreenBuilderAuthorityDecision decision = authorizeMenuAccess(menuCode, menuUrl, actionScope, request);
            if (!decision.isAllowed()) {
                return decision;
            }
            lastAllowed = decision;
        }
        return lastAllowed == null
                ? authorizeMenuAccess("", menuUrl, actionScope, request)
                : lastAllowed;
    }

    @Override
    public String resolveActorId(HttpServletRequest request) {
        return resolveActorId(currentUserContextService.resolve(request));
    }

    @Override
    public String resolveActorRole(HttpServletRequest request) {
        return resolveActorRole(currentUserContextService.resolve(request));
    }

    @Override
    public String resolveRequestIp(HttpServletRequest request) {
        if (request == null) {
            return "";
        }
        String forwarded = safe(request.getHeader("X-Forwarded-For"));
        if (!forwarded.isEmpty()) {
            int commaIndex = forwarded.indexOf(',');
            return commaIndex >= 0 ? forwarded.substring(0, commaIndex).trim() : forwarded;
        }
        return safe(request.getRemoteAddr());
    }

    private String resolveRequiredFeatureCode(String menuCode, String menuUrl, String actionScope) {
        String normalizedMenuUrl = normalizeMenuUrl(menuUrl);
        String normalizedMenuCode = safe(menuCode).toUpperCase(Locale.ROOT);
        if (normalizedMenuCode.isEmpty() && !normalizedMenuUrl.isEmpty()) {
            normalizedMenuCode = resolveMenuCodeByMenuUrl(normalizedMenuUrl);
        }
        if (normalizedMenuUrl.isEmpty() && normalizedMenuCode.isEmpty()) {
            normalizedMenuUrl = FAMILY_MENU_URL;
            normalizedMenuCode = resolveMenuCodeByMenuUrl(normalizedMenuUrl);
        }
        if (isReadScope(actionScope) && !normalizedMenuUrl.isEmpty()) {
            try {
                String requiredViewFeatureCode = safe(authGroupManageService.selectRequiredViewFeatureCodeByMenuUrl(normalizedMenuUrl)).toUpperCase(Locale.ROOT);
                if (!requiredViewFeatureCode.isEmpty()) {
                    return requiredViewFeatureCode;
                }
            } catch (Exception ignore) {
                return "";
            }
        }
        List<String> featureCodes = loadFeatureCodes(normalizedMenuCode);
        if (featureCodes.isEmpty()) {
            return "";
        }
        for (String suffix : expectedSuffixes(actionScope)) {
            for (String featureCode : featureCodes) {
                String normalizedFeatureCode = safe(featureCode).toUpperCase(Locale.ROOT);
                if (normalizedFeatureCode.endsWith(suffix)) {
                    return normalizedFeatureCode;
                }
            }
        }
        if (isReadScope(actionScope)) {
            for (String featureCode : featureCodes) {
                String normalizedFeatureCode = safe(featureCode).toUpperCase(Locale.ROOT);
                if (normalizedFeatureCode.endsWith("_VIEW")) {
                    return normalizedFeatureCode;
                }
            }
        }
        return "";
    }

    private List<String> loadFeatureCodes(String menuCode) {
        if (safe(menuCode).isEmpty()) {
            return new ArrayList<>();
        }
        try {
            List<String> featureCodes = authGroupManageService.selectFeatureCodesByMenuCode(menuCode);
            List<String> normalized = new ArrayList<>();
            if (featureCodes == null) {
                return normalized;
            }
            for (String featureCode : featureCodes) {
                String normalizedFeatureCode = safe(featureCode).toUpperCase(Locale.ROOT);
                if (!normalizedFeatureCode.isEmpty()) {
                    normalized.add(normalizedFeatureCode);
                }
            }
            return normalized;
        } catch (Exception ignore) {
            return new ArrayList<>();
        }
    }

    private String resolveMenuCodeByMenuUrl(String menuUrl) {
        try {
            return safe(authGroupManageService.selectMenuCodeByMenuUrl(menuUrl)).toUpperCase(Locale.ROOT);
        } catch (Exception ignore) {
            return "";
        }
    }

    private String resolveOverrideType(String actorId, String requiredFeatureCode) {
        if (safe(actorId).isEmpty() || safe(requiredFeatureCode).isEmpty()) {
            return "";
        }
        try {
            String essentialId = safe(authGroupManageService.selectAdminEssentialIdByUserId(actorId));
            if (essentialId.isEmpty()) {
                return "";
            }
            List<UserFeatureOverrideVO> overrides = authGroupManageService.selectUserFeatureOverrides(essentialId);
            if (overrides == null || overrides.isEmpty()) {
                return "";
            }
            for (UserFeatureOverrideVO override : overrides) {
                if (override == null) {
                    continue;
                }
                if ("N".equalsIgnoreCase(safe(override.getUseAt()))) {
                    continue;
                }
                if (requiredFeatureCode.equalsIgnoreCase(safe(override.getFeatureCode()))) {
                    return safe(override.getOverrideType()).toUpperCase(Locale.ROOT);
                }
            }
        } catch (Exception ignore) {
            return "";
        }
        return "";
    }

    private String resolveActorId(CurrentUserContextService.CurrentUserContext context) {
        if (context == null) {
            return "anonymous";
        }
        String actorId = safe(context.getUserId());
        if (actorId.isEmpty()) {
            actorId = safe(context.getActualUserId());
        }
        return actorId.isEmpty() ? "anonymous" : actorId;
    }

    private String resolveActorRole(CurrentUserContextService.CurrentUserContext context) {
        if (context == null) {
            return ROLE_ANONYMOUS;
        }
        String actorRole = safe(context.getAuthorCode()).toUpperCase(Locale.ROOT);
        return actorRole.isEmpty() ? ROLE_ANONYMOUS : actorRole;
    }

    private ScreenBuilderAuthorityDecision deny(String actionScope,
                                                String menuCode,
                                                String menuUrl,
                                                String actorId,
                                                String actorRole,
                                                String requiredFeatureCode,
                                                String reasonCode,
                                                String message) {
        return ScreenBuilderAuthorityDecision.deny(
                actionScope,
                message,
                reasonCode,
                requiredFeatureCode,
                menuCode,
                normalizeMenuUrl(menuUrl),
                actorId,
                actorRole);
    }

    private boolean isReadScope(String actionScope) {
        String normalized = safe(actionScope).toUpperCase(Locale.ROOT);
        return "ENTRY".equals(normalized) || "VIEW".equals(normalized) || "QUERY".equals(normalized);
    }

    private List<String> expectedSuffixes(String actionScope) {
        String normalized = safe(actionScope).toUpperCase(Locale.ROOT);
        List<String> suffixes = new ArrayList<>();
        if ("CREATE".equals(normalized)) {
            suffixes.add("_CREATE");
            suffixes.add("_SAVE");
            suffixes.add("_UPDATE");
        } else if ("UPDATE".equals(normalized)) {
            suffixes.add("_UPDATE");
            suffixes.add("_SAVE");
            suffixes.add("_EDIT");
        } else if ("DELETE".equals(normalized)) {
            suffixes.add("_DELETE");
        } else if ("EXECUTE".equals(normalized)) {
            suffixes.add("_EXECUTE");
            suffixes.add("_UPDATE");
            suffixes.add("_SAVE");
        } else if ("APPROVE".equals(normalized)) {
            suffixes.add("_APPROVE");
            suffixes.add("_PUBLISH");
            suffixes.add("_EXECUTE");
            suffixes.add("_UPDATE");
            suffixes.add("_SAVE");
        } else {
            suffixes.add("_VIEW");
            suffixes.add("_SEARCH");
            suffixes.add("_QUERY");
        }
        return suffixes;
    }

    private List<String> normalizeMenuCodes(List<String> menuCodes) {
        if (menuCodes == null || menuCodes.isEmpty()) {
            return new ArrayList<>();
        }
        Set<String> values = new LinkedHashSet<>();
        for (String menuCode : menuCodes) {
            String normalized = safe(menuCode).toUpperCase(Locale.ROOT);
            if (!normalized.isEmpty()) {
                values.add(normalized);
            }
        }
        return new ArrayList<>(values);
    }

    private String normalizeMenuUrl(String menuUrl) {
        String normalized = safe(menuUrl);
        if (normalized.isEmpty()) {
            return "";
        }
        if (normalized.startsWith("/en/admin")) {
            return normalized.substring(3);
        }
        return normalized;
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
