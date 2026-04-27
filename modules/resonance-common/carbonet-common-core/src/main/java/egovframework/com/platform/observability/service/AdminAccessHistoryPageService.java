package egovframework.com.platform.observability.service;

import egovframework.com.common.logging.RequestExecutionLogPage;
import egovframework.com.common.logging.RequestExecutionLogService;
import egovframework.com.common.logging.RequestExecutionLogVO;
import egovframework.com.feature.admin.dto.response.SystemAccessHistoryRowResponse;
import egovframework.com.platform.codex.model.UserAuthorityTargetVO;
import egovframework.com.platform.codex.service.AuthGroupManageService;
import egovframework.com.feature.auth.domain.repository.EmployeeMemberRepository;
import egovframework.com.feature.auth.domain.repository.EnterpriseMemberRepository;
import egovframework.com.feature.auth.service.CurrentUserContextService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;

@Service
@RequiredArgsConstructor
@Slf4j
public class AdminAccessHistoryPageService {

    private static final String ROLE_SYSTEM_MASTER = "ROLE_SYSTEM_MASTER";
    private static final String ROLE_SYSTEM_ADMIN = "ROLE_SYSTEM_ADMIN";
    private static final String ROLE_ADMIN = "ROLE_ADMIN";
    private static final String ROLE_OPERATION_ADMIN = "ROLE_OPERATION_ADMIN";
    private static final int ACCESS_HISTORY_PAGE_SIZE = 10;
    private static final int ACCESS_HISTORY_RECENT_LIMIT = 500;

    private final RequestExecutionLogService requestExecutionLogService;
    private final AuthGroupManageService authGroupManageService;
    private final EmployeeMemberRepository employeeMemberRepository;
    private final EnterpriseMemberRepository enterpriseMemberRepository;
    private final CurrentUserContextService currentUserContextService;
    private final ConcurrentMap<String, String> companyNameCache = new ConcurrentHashMap<>();

    private Map<String, Object> createPagePayload(boolean isEn) {
        Map<String, Object> model = new LinkedHashMap<>();
        model.put("isEn", isEn);
        return model;
    }

    private Map<String, String> createCompanyOption(String insttId, String companyName) {
        Map<String, String> option = new LinkedHashMap<>();
        option.put("insttId", safeString(insttId));
        option.put("cmpnyNm", safeString(companyName).isEmpty() ? safeString(insttId) : safeString(companyName));
        return option;
    }

    private SystemAccessHistoryRowResponse createAccessHistoryRow(
            RequestExecutionLogVO item,
            String effectiveInsttId,
            String companyName) {
        return new SystemAccessHistoryRowResponse(
                safeString(item.getLogId()),
                safeString(item.getExecutedAt()),
                safeString(item.getRequestUri()),
                safeString(item.getHttpMethod()),
                safeString(item.getFeatureType()),
                safeString(item.getActorUserId()),
                safeString(item.getActorType()),
                safeString(item.getActorAuthorCode()),
                safeString(item.getActorInsttId()),
                effectiveInsttId,
                safeString(item.getCompanyContextId()),
                safeString(item.getTargetCompanyContextId()),
                item.getResponseStatus(),
                item.getDurationMs(),
                safeString(item.getErrorMessage()),
                extractRemoteAddr(item),
                safeString(companyName));
    }

    private void appendPaging(
            Map<String, Object> model,
            int requestedPageIndex,
            int totalCount) {
        int totalPages = Math.max(1, (int) Math.ceil(totalCount / (double) ACCESS_HISTORY_PAGE_SIZE));
        int pageIndex = Math.min(requestedPageIndex, totalPages);
        int startPage = Math.max(1, ((pageIndex - 1) / 10) * 10 + 1);
        int endPage = Math.min(totalPages, startPage + 9);
        model.put("pageIndex", pageIndex);
        model.put("pageSize", ACCESS_HISTORY_PAGE_SIZE);
        model.put("totalCount", totalCount);
        model.put("totalPages", totalPages);
        model.put("startPage", startPage);
        model.put("endPage", endPage);
        model.put("prevPage", startPage > 1 ? startPage - 1 : 1);
        model.put("nextPage", endPage < totalPages ? endPage + 1 : totalPages);
    }

    public Map<String, Object> buildPageData(
            String pageIndexParam,
            String searchKeyword,
            String insttId,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = isEnglishRequest(request, locale);
        int requestedPageIndex = Math.max(1, safeParseInt(pageIndexParam, 1));
        String normalizedKeyword = safeString(searchKeyword).toLowerCase(Locale.ROOT);
        String currentUserId = resolveActorId(request);
        String currentAuthorCode = resolveCurrentAuthorCode(currentUserId, request);
        String currentUserInsttId = resolveCurrentUserInsttId(currentUserId, request);
        boolean canManageAllCompanies = canManageAllCompanies(currentUserId, currentAuthorCode);
        boolean canViewAccessHistory = canViewAccessHistory(currentUserId, currentAuthorCode);

        List<Map<String, String>> companyOptions = canManageAllCompanies
                ? buildAccessHistoryCompanyOptions()
                : buildScopedAccessHistoryCompanyOptions(currentUserInsttId);
        String selectedInsttId = resolveSelectedInsttId(insttId, companyOptions, canManageAllCompanies);
        if (!canManageAllCompanies) {
            selectedInsttId = currentUserInsttId;
        }

        AccessHistoryRowsPage accessHistoryPage = canViewAccessHistory
                ? buildAccessHistoryPage(normalizedKeyword, selectedInsttId, canManageAllCompanies, requestedPageIndex)
                : new AccessHistoryRowsPage(Collections.emptyList(), 0);
        int totalCount = accessHistoryPage.getTotalCount();

        Map<String, Object> model = createPagePayload(isEn);
        model.put("canViewAccessHistory", canViewAccessHistory);
        model.put("canManageAllCompanies", canManageAllCompanies);
        model.put("companyOptions", companyOptions);
        model.put("selectedInsttId", safeString(selectedInsttId));
        model.put("searchKeyword", safeString(searchKeyword));
        appendPaging(model, requestedPageIndex, totalCount);
        model.put("accessHistoryList", accessHistoryPage.getRows());
        return model;
    }

    private AccessHistoryRowsPage buildAccessHistoryPage(
            String normalizedKeyword,
            String selectedInsttId,
            boolean canManageAllCompanies,
            int pageIndex) {
        Map<String, String> companyNameByInsttId = buildAccessHistoryCompanyNameMap();
        RequestExecutionLogPage logPage = requestExecutionLogService.searchRecent(item -> {
            String effectiveInsttId = resolveEffectiveInsttId(item);
            if (!canManageAllCompanies && !selectedInsttId.isEmpty() && !selectedInsttId.equals(effectiveInsttId)) {
                return false;
            }
            if (canManageAllCompanies && !safeString(selectedInsttId).isEmpty() && !selectedInsttId.equals(effectiveInsttId)) {
                return false;
            }
            return matchesAccessHistoryKeyword(item, normalizedKeyword, effectiveInsttId, companyNameByInsttId.get(effectiveInsttId));
        }, pageIndex, ACCESS_HISTORY_PAGE_SIZE);
        if (logPage.getItems().isEmpty()) {
            return new AccessHistoryRowsPage(Collections.emptyList(), logPage.getTotalCount());
        }

        List<SystemAccessHistoryRowResponse> rows = new ArrayList<>();
        for (RequestExecutionLogVO item : logPage.getItems()) {
            String effectiveInsttId = resolveEffectiveInsttId(item);
            rows.add(createAccessHistoryRow(item, effectiveInsttId, companyNameByInsttId.get(effectiveInsttId)));
        }
        return new AccessHistoryRowsPage(rows, logPage.getTotalCount());
    }

    private boolean matchesAccessHistoryKeyword(
            RequestExecutionLogVO item,
            String normalizedKeyword,
            String effectiveInsttId,
            String companyName) {
        if (normalizedKeyword.isEmpty()) {
            return true;
        }
        return safeString(item.getActorUserId()).toLowerCase(Locale.ROOT).contains(normalizedKeyword)
                || safeString(item.getRequestUri()).toLowerCase(Locale.ROOT).contains(normalizedKeyword)
                || safeString(item.getParameterSummary()).toLowerCase(Locale.ROOT).contains(normalizedKeyword)
                || safeString(companyName).toLowerCase(Locale.ROOT).contains(normalizedKeyword)
                || safeString(effectiveInsttId).toLowerCase(Locale.ROOT).contains(normalizedKeyword)
                || extractRemoteAddr(item).toLowerCase(Locale.ROOT).contains(normalizedKeyword);
    }

    private List<Map<String, String>> buildAccessHistoryCompanyOptions() {
        List<RequestExecutionLogVO> logs = requestExecutionLogService.searchRecent(item -> true, 1, ACCESS_HISTORY_RECENT_LIMIT).getItems();
        if (logs == null || logs.isEmpty()) {
            return Collections.emptyList();
        }
        Map<String, String> companyNameByInsttId = buildCompanyNameMap(logs);
        List<Map<String, String>> options = new ArrayList<>();
        for (Map.Entry<String, String> entry : companyNameByInsttId.entrySet()) {
            if (entry.getKey().isEmpty()) {
                continue;
            }
            options.add(createCompanyOption(entry.getKey(), entry.getValue()));
        }
        return options;
    }

    private Map<String, String> buildAccessHistoryCompanyNameMap() {
        return buildCompanyNameMap(requestExecutionLogService.searchRecent(item -> true, 1, ACCESS_HISTORY_RECENT_LIMIT).getItems());
    }

    private List<Map<String, String>> buildScopedAccessHistoryCompanyOptions(String currentUserInsttId) {
        if (safeString(currentUserInsttId).isEmpty()) {
            return Collections.emptyList();
        }
        return Collections.singletonList(createCompanyOption(currentUserInsttId, resolveCompanyName(currentUserInsttId)));
    }

    private Map<String, String> buildCompanyNameMap(List<RequestExecutionLogVO> logs) {
        Map<String, String> companyNameByInsttId = new LinkedHashMap<>();
        for (RequestExecutionLogVO item : logs) {
            String insttId = resolveEffectiveInsttId(item);
            if (insttId.isEmpty() || companyNameByInsttId.containsKey(insttId)) {
                continue;
            }
            companyNameByInsttId.put(insttId, resolveCompanyName(insttId));
        }
        return companyNameByInsttId;
    }

    private String resolveCompanyName(String insttId) {
        String normalizedInsttId = safeString(insttId);
        if (normalizedInsttId.isEmpty()) {
            return "";
        }
        return companyNameCache.computeIfAbsent(normalizedInsttId, this::lookupCompanyName);
    }

    private String lookupCompanyName(String normalizedInsttId) {
        try {
            List<UserAuthorityTargetVO> targets = authGroupManageService.selectUserAuthorityTargets(normalizedInsttId, "");
            if (targets != null) {
                for (UserAuthorityTargetVO target : targets) {
                    String companyName = safeString(target.getCmpnyNm());
                    if (!companyName.isEmpty()) {
                        return companyName;
                    }
                }
            }
        } catch (Exception e) {
            log.debug("Failed to resolve company name from authority targets. insttId={}", normalizedInsttId, e);
        }
        return normalizedInsttId;
    }

    private String resolveEffectiveInsttId(RequestExecutionLogVO item) {
        String insttId = safeString(item.getCompanyContextId());
        if (insttId.isEmpty()) {
            insttId = safeString(item.getTargetCompanyContextId());
        }
        if (insttId.isEmpty()) {
            insttId = safeString(item.getActorInsttId());
        }
        return insttId;
    }

    private String extractRemoteAddr(RequestExecutionLogVO item) {
        String remoteAddr = safeString(item.getRemoteAddr());
        if (!remoteAddr.isEmpty()) {
            return remoteAddr;
        }
        String parameterSummary = safeString(item.getParameterSummary());
        if (parameterSummary.isEmpty()) {
            return "";
        }
        for (String token : parameterSummary.split(",")) {
            String normalized = safeString(token);
            if (normalized.toLowerCase(Locale.ROOT).startsWith("remoteaddr=")) {
                return normalized.substring("remoteAddr=".length());
            }
        }
        return "";
    }

    private String resolveCurrentAuthorCode(String currentUserId, HttpServletRequest request) {
        String authorCode = safeString(resolveActorRole(request)).toUpperCase(Locale.ROOT);
        if (!authorCode.isEmpty()) {
            return authorCode;
        }
        if (safeString(currentUserId).isEmpty()) {
            return "";
        }
        if ("webmaster".equalsIgnoreCase(currentUserId)) {
            return ROLE_SYSTEM_MASTER;
        }
        try {
            authorCode = safeString(authGroupManageService.selectAuthorCodeByUserId(currentUserId)).toUpperCase(Locale.ROOT);
            if (authorCode.isEmpty()) {
                authorCode = safeString(authGroupManageService.selectEnterpriseAuthorCodeByUserId(currentUserId)).toUpperCase(Locale.ROOT);
            }
            return authorCode;
        } catch (Exception e) {
            log.warn("Failed to resolve current author code for access history. userId={}", currentUserId, e);
            return "";
        }
    }

    private String resolveCurrentUserInsttId(String currentUserId, HttpServletRequest request) {
        if (request != null) {
            HttpSession session = request.getSession(false);
            if (session != null) {
                Object loginVO = session.getAttribute("LoginVO");
                if (loginVO != null) {
                    try {
                        Object value = loginVO.getClass().getMethod("getInsttId").invoke(loginVO);
                        String sessionInsttId = value == null ? "" : safeString(String.valueOf(value));
                        if (!sessionInsttId.isEmpty()) {
                            return sessionInsttId;
                        }
                    } catch (Exception ignored) {
                    }
                }
            }
        }
        String normalizedUserId = safeString(currentUserId);
        if (normalizedUserId.isEmpty() || "webmaster".equalsIgnoreCase(normalizedUserId)) {
            return "";
        }
        return employeeMemberRepository.findById(normalizedUserId)
                .map(item -> safeString(item.getInsttId()))
                .filter(value -> !value.isEmpty())
                .orElseGet(() -> {
                    try {
                        return safeString(currentUserContextService.resolve(normalizedUserId).getInsttId());
                    } catch (Exception e) {
                        log.warn("Failed to resolve current institution for access history. userId={}", normalizedUserId, e);
                        return "";
                    }
                });
    }

    private boolean canManageAllCompanies(String currentUserId, String authorCode) {
        if ("webmaster".equalsIgnoreCase(safeString(currentUserId))) {
            return true;
        }
        return ROLE_SYSTEM_MASTER.equals(safeString(authorCode).toUpperCase(Locale.ROOT));
    }

    private boolean canViewAccessHistory(String currentUserId, String authorCode) {
        if ("webmaster".equalsIgnoreCase(safeString(currentUserId))) {
            return true;
        }
        String normalized = safeString(authorCode).toUpperCase(Locale.ROOT);
        return ROLE_SYSTEM_MASTER.equals(normalized)
                || ROLE_SYSTEM_ADMIN.equals(normalized)
                || ROLE_ADMIN.equals(normalized)
                || ROLE_OPERATION_ADMIN.equals(normalized);
    }

    private String resolveSelectedInsttId(String insttId, List<Map<String, String>> companyOptions, boolean allowEmptySelection) {
        String normalized = safeString(insttId);
        if (allowEmptySelection && normalized.isEmpty()) {
            return "";
        }
        if (normalized.isEmpty()) {
            return companyOptions.isEmpty() ? "" : safeString(companyOptions.get(0).get("insttId"));
        }
        for (Map<String, String> option : companyOptions) {
            if (normalized.equals(safeString(option.get("insttId")))) {
                return normalized;
            }
        }
        return companyOptions.isEmpty() ? "" : safeString(companyOptions.get(0).get("insttId"));
    }

    private boolean isEnglishRequest(HttpServletRequest request, Locale locale) {
        if (request != null) {
            String path = request.getRequestURI();
            if (path != null && path.startsWith("/en/")) {
                return true;
            }
            String param = request.getParameter("language");
            if ("en".equalsIgnoreCase(param)) {
                return true;
            }
        }
        return locale != null && locale.getLanguage().toLowerCase(Locale.ROOT).startsWith("en");
    }

    private String resolveActorId(HttpServletRequest request) {
        if (request == null) {
            return "";
        }
        HttpSession session = request.getSession(false);
        if (session != null) {
            Object loginVO = session.getAttribute("LoginVO");
            if (loginVO != null) {
                try {
                    Object value = loginVO.getClass().getMethod("getId").invoke(loginVO);
                    String actorId = value == null ? "" : value.toString();
                    if (!actorId.isEmpty()) {
                        return actorId;
                    }
                } catch (Exception ignored) {
                }
            }
        }
        return safeString(currentUserContextService.resolve(request).getUserId());
    }

    private String resolveActorRole(HttpServletRequest request) {
        if (request == null) {
            return "";
        }
        HttpSession session = request.getSession(false);
        if (session != null) {
            Object loginVO = session.getAttribute("LoginVO");
            if (loginVO != null) {
                try {
                    Object value = loginVO.getClass().getMethod("getAuthorCode").invoke(loginVO);
                    String actorRole = value == null ? "" : value.toString();
                    if (!actorRole.isEmpty()) {
                        return actorRole;
                    }
                } catch (Exception ignored) {
                }
            }
        }
        return safeString(currentUserContextService.resolve(request).getAuthorCode());
    }

    private int safeParseInt(String value, int defaultValue) {
        try {
            return Integer.parseInt(safeString(value));
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    private String safeString(Object value) {
        return value == null ? "" : value.toString().trim();
    }

    private static final class AccessHistoryRowsPage {

        private final List<SystemAccessHistoryRowResponse> rows;
        private final int totalCount;

        private AccessHistoryRowsPage(List<SystemAccessHistoryRowResponse> rows, int totalCount) {
            this.rows = rows == null ? Collections.emptyList() : rows;
            this.totalCount = Math.max(totalCount, 0);
        }

        private List<SystemAccessHistoryRowResponse> getRows() {
            return rows;
        }

        private int getTotalCount() {
            return totalCount;
        }
    }
}
