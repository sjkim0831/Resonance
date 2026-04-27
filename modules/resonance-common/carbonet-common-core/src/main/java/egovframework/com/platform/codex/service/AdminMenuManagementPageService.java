package egovframework.com.platform.codex.service;

import egovframework.com.feature.admin.web.*;

import egovframework.com.common.util.ReactPageUrlMapper;
import egovframework.com.platform.menu.dto.MenuInfoDTO;
import egovframework.com.platform.codex.service.AuthGroupManageService;
import egovframework.com.platform.codex.service.ScreenCommandCenterService;
import egovframework.com.common.trace.UiManifestRegistryPort;
import egovframework.com.platform.read.MenuInfoReadPort;
import egovframework.com.platform.read.FullStackGovernanceRegistryReadPort;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class AdminMenuManagementPageService {

    private static final Logger log = LoggerFactory.getLogger(AdminMenuManagementPageService.class);
    private static final String FAQ_BRANCH_CODE = "A00403";

    private final MenuInfoReadPort menuInfoReadPort;
    private final AdminReactRouteSupport adminReactRouteSupport;
    private final AuthGroupManageService authGroupManageService;
    private final UiManifestRegistryPort uiManifestRegistryPort;
    private final FullStackGovernanceRegistryReadPort fullStackGovernanceRegistryReadPort;
    private final ScreenCommandCenterService screenCommandCenterService;

    public Map<String, Object> buildMenuManagementPageData(
            String menuType,
            String saved,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminReactRouteSupport.isEnglishRequest(request, locale);
        String normalizedMenuType = normalizeMenuType(menuType);
        String codeId = resolveMenuCodeId(normalizedMenuType);
        Map<String, Object> payload = new LinkedHashMap<>();
        populateMenuManagementPayload(payload, isEn, normalizedMenuType, codeId);
        applyMenuManagementMessage(payload, isEn, saved);
        applyQueryError(payload, "menuMgmtError", request);
        return payload;
    }

    public Map<String, Object> buildContentMenuManagementPageData(
            String saved,
            HttpServletRequest request,
            Locale locale) {
        Map<String, Object> payload = new LinkedHashMap<>(buildMenuManagementPageData("ADMIN", saved, request, locale));
        payload.put("menuRows", filterContentMenuRows(payload.get("menuRows")));
        payload.put("groupMenuOptions", filterContentGroupMenuOptions(payload.get("groupMenuOptions")));
        payload.put("menuType", "CONTENT");
        return payload;
    }

    public Map<String, Object> buildFullStackManagementPageData(
            String menuType,
            String saved,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = adminReactRouteSupport.isEnglishRequest(request, locale);
        String normalizedMenuType = normalizeMenuType(menuType);
        String codeId = resolveMenuCodeId(normalizedMenuType);
        Map<String, Object> payload = new LinkedHashMap<>();
        populateMenuManagementPayload(payload, isEn, normalizedMenuType, codeId);
        payload.put("fullStackSummaryRows", buildFullStackSummaryRows(codeId));
        applyFullStackManagementMessage(payload, isEn, saved);
        applyQueryError(payload, "menuMgmtError", request);
        return payload;
    }

    public List<MenuInfoDTO> loadMenuTreeRowsByMenuType(String menuType) {
        return loadMenuTreeRows(resolveMenuCodeId(normalizeMenuType(menuType)));
    }

    private void populateMenuManagementPayload(Map<String, Object> target, boolean isEn, String menuType, String codeId) {
        List<MenuInfoDTO> menuRows = loadMenuTreeRows(codeId);
        target.put("menuType", menuType);
        target.put("menuRows", menuRows);
        target.put("menuTypes", List.of(
                menuTypeOption("USER", isEn ? "Home" : "홈"),
                menuTypeOption("ADMIN", isEn ? "Admin" : "관리자")
        ));
        target.put("groupMenuOptions", buildGroupMenuOptions(menuRows));
        target.put("iconOptions", buildPageIconOptions());
        target.put("useAtOptions", List.of("Y", "N"));
        target.put("menuMgmtGuide", isEn
                ? "Create page menus here first. Existing legacy screens can stay registered and be hidden later with useAt."
                : "새 페이지 메뉴는 여기서 먼저 등록하고, 기존 동작 중인 화면은 그대로 두고 나중에 useAt으로 숨김 처리합니다.");
        target.put("siteMapMgmtGuide", isEn
                ? "Site map exposure should be managed separately through a dedicated site-map management menu."
                : "사이트맵 노출은 별도 사이트맵 관리 메뉴에서 분리해서 운영하는 것을 기본 원칙으로 둡니다.");
    }

    private void applyMenuManagementMessage(Map<String, Object> target, boolean isEn, String saved) {
        if (!"Y".equalsIgnoreCase(safeString(saved))) {
            return;
        }
        target.put("menuMgmtMessage", isEn ? "Menu order has been saved." : "메뉴 순서를 저장했습니다.");
    }

    private void applyFullStackManagementMessage(Map<String, Object> target, boolean isEn, String saved) {
        if (!"Y".equalsIgnoreCase(safeString(saved))) {
            return;
        }
        target.put("menuMgmtMessage", isEn ? "Full-stack management data has been refreshed." : "풀스택 관리 데이터를 새로 불러왔습니다.");
    }

    private void applyQueryError(Map<String, Object> target, String attributeName, HttpServletRequest request) {
        String errorMessage = safeString(request == null ? null : request.getParameter("errorMessage"));
        if (!errorMessage.isEmpty()) {
            target.put(attributeName, errorMessage);
        }
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> filterContentMenuRows(Object menuRows) {
        List<Map<String, Object>> filtered = new ArrayList<>();
        if (!(menuRows instanceof List<?>)) {
            return filtered;
        }
        for (Object row : (List<?>) menuRows) {
            if (!(row instanceof Map<?, ?>)) {
                continue;
            }
            Map<?, ?> rawRow = (Map<?, ?>) row;
            String normalizedCode = safeString(rawRow.get("code")).toUpperCase(Locale.ROOT);
            if (normalizedCode.startsWith(FAQ_BRANCH_CODE)) {
                filtered.add((Map<String, Object>) rawRow);
            }
        }
        return filtered;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> filterContentGroupMenuOptions(Object options) {
        List<Map<String, Object>> filtered = new ArrayList<>();
        if (!(options instanceof List<?>)) {
            return filtered;
        }
        for (Object option : (List<?>) options) {
            if (!(option instanceof Map<?, ?>)) {
                continue;
            }
            Map<?, ?> rawOption = (Map<?, ?>) option;
            String normalizedValue = safeString(rawOption.get("value")).toUpperCase(Locale.ROOT);
            if (normalizedValue.startsWith(FAQ_BRANCH_CODE)) {
                filtered.add((Map<String, Object>) rawOption);
            }
        }
        return filtered;
    }

    private String resolveMenuCodeId(String menuType) {
        return "USER".equals(menuType) ? "HMENU1" : "AMENU1";
    }

    private String normalizeMenuType(String menuType) {
        return "USER".equalsIgnoreCase(safeString(menuType)) ? "USER" : "ADMIN";
    }

    private List<String> buildPageIconOptions() {
        return List.of(
                "web", "category", "settings", "dashboard", "admin_panel_settings",
                "monitoring", "api", "list_alt", "article", "folder",
                "manage_accounts", "groups", "person_search", "how_to_reg", "history",
                "bar_chart", "search", "badge", "co2", "verified",
                "fact_check", "receipt_long", "payments", "currency_exchange", "ad",
                "open_in_new", "hub", "dns", "security", "backup",
                "sensors", "apartment", "support_agent", "dataset", "description",
                "inventory", "menu", "menu_open", "home", "settings_applications",
                "tune", "display_settings", "terminal", "storage", "database",
                "view_list", "table_rows", "edit_note", "edit_square", "note_add",
                "delete", "delete_forever", "check_circle", "cancel", "warning",
                "error", "info", "notifications", "mail", "call",
                "public", "language", "travel_explore", "account_tree", "schema",
                "lan", "link", "integration_instructions", "sync", "sync_alt",
                "cloud", "cloud_sync", "cloud_done", "download", "upload",
                "download_for_offline", "upload_file", "attach_file", "image",
                "photo", "smart_display", "campaign", "flag", "help",
                "help_center", "extension", "widgets", "apps", "grid_view",
                "filter_alt", "sort", "calendar_month", "schedule", "today",
                "assignment", "assignment_ind", "assignment_turned_in", "task",
                "rule", "policy", "gavel", "shield", "shield_lock",
                "lock", "lock_open", "key", "vpn_key", "fingerprint",
                "bolt", "construction", "build", "build_circle", "engineering",
                "science", "psychology", "precision_manufacturing", "settings_ethernet", "router",
                "wifi", "memory", "developer_board", "devices", "desktop_windows",
                "laptop", "phone_iphone", "print", "qr_code", "sell",
                "shopping_cart", "request_quote", "account_balance", "insights", "timeline"
        );
    }

    private List<Map<String, String>> buildGroupMenuOptions(List<MenuInfoDTO> menuRows) {
        List<Map<String, String>> options = new ArrayList<>();
        for (MenuInfoDTO row : menuRows) {
            String code = safeString(row.getCode()).toUpperCase(Locale.ROOT);
            if (code.length() != 6) {
                continue;
            }
            Map<String, String> option = new LinkedHashMap<>();
            option.put("value", code);
            option.put("label", code + " · " + safeString(row.getCodeNm()));
            option.put("urlPrefix", safeString(row.getMenuUrl()));
            options.add(option);
        }
        return options;
    }

    private List<Map<String, Object>> buildFullStackSummaryRows(String codeId) {
        List<MenuInfoDTO> menuRows = loadMenuTreeRows(codeId);
        if (menuRows.isEmpty()) {
            return Collections.emptyList();
        }
        Map<String, Map<String, Object>> registryByMenuCode = new HashMap<>();
        Map<String, Map<String, Object>> registryByRoutePath = new HashMap<>();
        Map<String, Map<String, Object>> governanceRegistryByMenuCode = fullStackGovernanceRegistryReadPort.getAllEntries();
        for (Map<String, Object> option : uiManifestRegistryPort.selectActivePageOptions()) {
            String menuCode = safeString(asString(option.get("menuCode"))).toUpperCase(Locale.ROOT);
            String routePath = safeString(asString(option.get("routePath")));
            if (!menuCode.isEmpty()) {
                registryByMenuCode.put(menuCode, option);
            }
            if (!routePath.isEmpty()) {
                registryByRoutePath.put(routePath, option);
            }
        }

        List<Map<String, Object>> rows = new ArrayList<>();
        for (MenuInfoDTO menuRow : menuRows) {
            String menuCode = safeString(menuRow.getCode()).toUpperCase(Locale.ROOT);
            if (menuCode.length() != 8) {
                continue;
            }
            Map<String, Object> summary = new LinkedHashMap<>();
            String menuUrl = safeString(menuRow.getMenuUrl());
            List<String> featureCodes;
            String requiredViewFeatureCode;
            try {
                featureCodes = authGroupManageService.selectFeatureCodesByMenuCode(menuCode);
                requiredViewFeatureCode = safeString(authGroupManageService.selectRequiredViewFeatureCodeByMenuUrl(menuUrl));
            } catch (Exception e) {
                log.error("Failed to resolve feature metadata for managed menu {}.", menuCode, e);
                featureCodes = Collections.emptyList();
                requiredViewFeatureCode = "";
            }
            if (featureCodes == null) {
                featureCodes = Collections.emptyList();
            }

            Map<String, Object> registryOption = registryByMenuCode.get(menuCode);
            if (registryOption == null && !menuUrl.isEmpty()) {
                registryOption = registryByRoutePath.get(menuUrl);
            }
            Map<String, Object> governanceRegistry = governanceRegistryByMenuCode.get(menuCode);
            String pageId = registryOption == null ? "" : safeString(asString(registryOption.get("pageId")));
            if (pageId.isEmpty()) {
                pageId = safeString(asString(safeMap(governanceRegistry).get("pageId")));
            }

            int eventCount = 0;
            int componentCount = 0;
            int functionCount = 0;
            int parameterCount = 0;
            int resultCount = 0;
            int apiCount = 0;
            int controllerCount = 0;
            int serviceCount = 0;
            int mapperCount = 0;
            int schemaCount = 0;
            int tableCount = 0;
            int columnCount = 0;
            int commonCodeGroupCount = 0;
            int relationTableCount = 0;
            int resolverNoteCount = 0;
            int tagCount = 0;
            boolean hasManifestRegistry = false;
            boolean hasScreenCommand = false;
            boolean hasGovernanceRegistry = governanceRegistry != null
                    && !"DEFAULT".equalsIgnoreCase(safeString(asString(governanceRegistry.get("source"))));
            List<String> gaps = new ArrayList<>();

            if (pageId.isEmpty()) {
                gaps.add("screen-command");
            } else {
                try {
                    Map<String, Object> payload = screenCommandCenterService.getScreenCommandPage(pageId);
                    Map<String, Object> page = safeMap(payload.get("page"));
                    hasScreenCommand = !page.isEmpty();
                    Map<String, Object> manifestRegistry = safeMap(page.get("manifestRegistry"));
                    hasManifestRegistry = !safeString(asString(manifestRegistry.get("pageId"))).isEmpty();
                    componentCount = safeMapList(page.get("surfaces")).size() + safeMapList(manifestRegistry.get("components")).size();
                    eventCount = safeMapList(page.get("events")).size();
                    functionCount = countDistinctValues(safeMapList(page.get("events")), "frontendFunction");
                    apiCount = safeMapList(page.get("apis")).size();
                    List<Map<String, Object>> schemas = safeMapList(page.get("schemas"));
                    schemaCount = schemas.size();
                    commonCodeGroupCount = safeMapList(page.get("commonCodeGroups")).size();
                    parameterCount = countFieldSpecRows(safeMapList(page.get("events")), safeMapList(page.get("apis")), true);
                    resultCount = countFieldSpecRows(safeMapList(page.get("events")), safeMapList(page.get("apis")), false);
                    controllerCount = countChainValues(safeMapList(page.get("apis")), "controllerActions", "controllerAction");
                    serviceCount = countChainValues(safeMapList(page.get("apis")), "serviceMethods", "serviceMethod");
                    mapperCount = countChainValues(safeMapList(page.get("apis")), "mapperQueries", "mapperQuery");
                    relationTableCount = safeStringList(safeMap(page.get("menuPermission")).get("relationTables")).size();
                    resolverNoteCount = safeStringList(safeMap(page.get("menuPermission")).get("resolverNotes")).size();
                    LinkedHashSet<String> tables = new LinkedHashSet<>();
                    int columns = 0;
                    for (Map<String, Object> schema : schemas) {
                        String tableName = safeString(asString(schema.get("tableName")));
                        if (!tableName.isEmpty()) {
                            tables.add(tableName);
                        }
                        columns += safeStringList(schema.get("columns")).size();
                    }
                    for (Map<String, Object> api : safeMapList(page.get("apis"))) {
                        tables.addAll(safeStringList(api.get("relatedTables")));
                    }
                    tables.addAll(safeStringList(safeMap(page.get("menuPermission")).get("relationTables")));
                    tableCount = tables.size();
                    columnCount = columns;
                    if (!hasManifestRegistry) {
                        gaps.add("manifest");
                    }
                    if (componentCount == 0) {
                        gaps.add("component");
                    }
                    if (functionCount == 0 && eventCount > 0) {
                        gaps.add("function");
                    }
                    if (controllerCount == 0 && apiCount > 0) {
                        gaps.add("controller");
                    }
                    if (serviceCount == 0 && apiCount > 0) {
                        gaps.add("service");
                    }
                    if (mapperCount == 0 && apiCount > 0) {
                        gaps.add("mapper");
                    }
                    if (schemaCount == 0) {
                        gaps.add("schema");
                    }
                    if (tableCount == 0) {
                        gaps.add("table");
                    }
                    if (columnCount == 0) {
                        gaps.add("column");
                    }
                } catch (Exception e) {
                    log.warn("Failed to build full-stack summary for pageId={}", pageId, e);
                    gaps.add("screen-command-error");
                }
            }
            if (governanceRegistry != null) {
                componentCount = Math.max(componentCount, safeStringList(governanceRegistry.get("componentIds")).size());
                eventCount = Math.max(eventCount, safeStringList(governanceRegistry.get("eventIds")).size());
                functionCount = Math.max(functionCount, safeStringList(governanceRegistry.get("functionIds")).size());
                parameterCount = Math.max(parameterCount, safeStringList(governanceRegistry.get("parameterSpecs")).size());
                resultCount = Math.max(resultCount, safeStringList(governanceRegistry.get("resultSpecs")).size());
                apiCount = Math.max(apiCount, safeStringList(governanceRegistry.get("apiIds")).size());
                controllerCount = Math.max(controllerCount, safeStringList(governanceRegistry.get("controllerActions")).size());
                serviceCount = Math.max(serviceCount, safeStringList(governanceRegistry.get("serviceMethods")).size());
                mapperCount = Math.max(mapperCount, safeStringList(governanceRegistry.get("mapperQueries")).size());
                schemaCount = Math.max(schemaCount, safeStringList(governanceRegistry.get("schemaIds")).size());
                tableCount = Math.max(tableCount, safeStringList(governanceRegistry.get("tableNames")).size());
                columnCount = Math.max(columnCount, safeStringList(governanceRegistry.get("columnNames")).size());
                commonCodeGroupCount = Math.max(commonCodeGroupCount, safeStringList(governanceRegistry.get("commonCodeGroups")).size());
                tagCount = Math.max(tagCount, safeStringList(governanceRegistry.get("tags")).size());
            }

            if (menuUrl.isEmpty()) {
                gaps.add("menu-url");
            }
            if (requiredViewFeatureCode.isEmpty()) {
                gaps.add("view-feature");
            }
            if (!hasGovernanceRegistry) {
                gaps.add("governance-registry");
            }

            summary.put("menuCode", menuCode);
            summary.put("menuNm", safeString(menuRow.getCodeNm()));
            summary.put("menuUrl", menuUrl);
            summary.put("pageId", pageId);
            summary.put("hasManifestRegistry", hasManifestRegistry);
            summary.put("hasScreenCommand", hasScreenCommand);
            summary.put("hasGovernanceRegistry", hasGovernanceRegistry);
            summary.put("requiredViewFeatureCode", requiredViewFeatureCode);
            summary.put("featureCount", featureCodes.size());
            summary.put("componentCount", componentCount);
            summary.put("eventCount", eventCount);
            summary.put("functionCount", functionCount);
            summary.put("parameterCount", parameterCount);
            summary.put("resultCount", resultCount);
            summary.put("apiCount", apiCount);
            summary.put("controllerCount", controllerCount);
            summary.put("serviceCount", serviceCount);
            summary.put("mapperCount", mapperCount);
            summary.put("schemaCount", schemaCount);
            summary.put("tableCount", tableCount);
            summary.put("columnCount", columnCount);
            summary.put("commonCodeGroupCount", commonCodeGroupCount);
            summary.put("relationTableCount", relationTableCount);
            summary.put("resolverNoteCount", resolverNoteCount);
            summary.put("tagCount", tagCount);
            summary.put("gaps", gaps);
            summary.put("coverageScore", computeCoverageScore(summary));
            rows.add(summary);
        }

        rows.sort(Comparator
                .comparingInt((Map<String, Object> row) -> safeParseInt(asString(row.get("coverageScore"))))
                .thenComparing(row -> safeString(asString(row.get("menuCode")))));
        return rows;
    }

    private int computeCoverageScore(Map<String, Object> summary) {
        int score = 0;
        if (!safeString(asString(summary.get("menuUrl"))).isEmpty()) score += 10;
        if (!safeString(asString(summary.get("requiredViewFeatureCode"))).isEmpty()) score += 15;
        if (Boolean.TRUE.equals(summary.get("hasManifestRegistry"))) score += 15;
        if (Boolean.TRUE.equals(summary.get("hasScreenCommand"))) score += 15;
        if (Boolean.TRUE.equals(summary.get("hasGovernanceRegistry"))) score += 10;
        if (safeParseInt(asString(summary.get("featureCount"))) > 0) score += 10;
        if (safeParseInt(asString(summary.get("componentCount"))) > 0) score += 5;
        if (safeParseInt(asString(summary.get("eventCount"))) > 0) score += 10;
        if (safeParseInt(asString(summary.get("functionCount"))) > 0) score += 5;
        if (safeParseInt(asString(summary.get("apiCount"))) > 0) score += 10;
        if (safeParseInt(asString(summary.get("controllerCount"))) > 0) score += 5;
        if (safeParseInt(asString(summary.get("serviceCount"))) > 0) score += 5;
        if (safeParseInt(asString(summary.get("mapperCount"))) > 0) score += 5;
        if (safeParseInt(asString(summary.get("schemaCount"))) > 0) score += 5;
        if (safeParseInt(asString(summary.get("tableCount"))) > 0) score += 5;
        if (safeParseInt(asString(summary.get("columnCount"))) > 0) score += 5;
        return Math.min(score, 100);
    }

    private int countDistinctValues(List<Map<String, Object>> rows, String key) {
        Set<String> values = new LinkedHashSet<>();
        for (Map<String, Object> row : rows) {
            String value = safeString(asString(row.get(key)));
            if (!value.isEmpty()) {
                values.add(value);
            }
        }
        return values.size();
    }

    private int countChainValues(List<Map<String, Object>> rows, String arrayKey, String singleKey) {
        Set<String> values = new LinkedHashSet<>();
        for (Map<String, Object> row : rows) {
            values.addAll(safeStringList(row.get(arrayKey)));
            String single = safeString(asString(row.get(singleKey)));
            if (!single.isEmpty()) {
                values.add(single);
            }
        }
        return values.size();
    }

    private int countFieldSpecRows(List<Map<String, Object>> events, List<Map<String, Object>> apis, boolean input) {
        int count = 0;
        for (Map<String, Object> event : events) {
            count += safeMapList(event.get(input ? "functionInputs" : "functionOutputs")).size();
        }
        for (Map<String, Object> api : apis) {
            count += safeMapList(api.get(input ? "requestFields" : "responseFields")).size();
        }
        return count;
    }

    private Map<String, Object> safeMap(Object value) {
        if (value instanceof Map) {
            @SuppressWarnings("unchecked")
            Map<String, Object> casted = (Map<String, Object>) value;
            return casted;
        }
        return Collections.emptyMap();
    }

    private List<Map<String, Object>> safeMapList(Object value) {
        if (!(value instanceof List)) {
            return Collections.emptyList();
        }
        List<?> source = (List<?>) value;
        List<Map<String, Object>> result = new ArrayList<>();
        for (Object item : source) {
            if (item instanceof Map) {
                @SuppressWarnings("unchecked")
                Map<String, Object> casted = (Map<String, Object>) item;
                result.add(casted);
            }
        }
        return result;
    }

    private List<String> safeStringList(Object value) {
        if (!(value instanceof List)) {
            return Collections.emptyList();
        }
        List<?> source = (List<?>) value;
        List<String> result = new ArrayList<>();
        for (Object item : source) {
            if (item != null) {
                result.add(safeString(item.toString()));
            }
        }
        return result;
    }

    private String asString(Object value) {
        return value == null ? "" : value.toString();
    }

    private int safeParseInt(String value) {
        try {
            return Integer.parseInt(safeString(value));
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private Map<String, String> menuTypeOption(String value, String label) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("value", value);
        row.put("label", label);
        return row;
    }

    private List<MenuInfoDTO> loadMenuTreeRows(String codeId) {
        try {
            List<MenuInfoDTO> rows = new ArrayList<>(menuInfoReadPort.selectMenuTreeList(codeId));
            for (MenuInfoDTO row : rows) {
                row.setMenuUrl(canonicalMenuUrl(row.getMenuUrl()));
                normalizeManagedAdminMenuRow(row);
            }
            Map<String, Integer> sortOrderMap = new LinkedHashMap<>();
            for (MenuInfoDTO row : rows) {
                sortOrderMap.put(safeString(row.getCode()).toUpperCase(Locale.ROOT), row.getSortOrdr());
            }
            rows.sort(Comparator
                    .comparingInt((MenuInfoDTO row) -> codeDepth(row.getCode()))
                    .thenComparing(row -> safeString(row.getCode()).substring(0, Math.min(4, safeString(row.getCode()).length())))
                    .thenComparingInt(row -> parentDepthSort(row, sortOrderMap))
                    .thenComparingInt(row -> effectiveSort(row.getCode(), row.getSortOrdr()))
                    .thenComparing(row -> safeString(row.getCode())));
            return rows;
        } catch (Exception e) {
            log.error("Failed to load menu tree rows. codeId={}", codeId, e);
            return Collections.emptyList();
        }
    }

    private void normalizeManagedAdminMenuRow(MenuInfoDTO row) {
        String code = safeString(row.getCode()).toUpperCase(Locale.ROOT);
        String menuUrl = safeString(row.getMenuUrl());
        if ("A006".equals(code)) {
            row.setCodeNm("시스템");
            row.setCodeDc("System");
            return;
        }
        if ("A00601".equals(code)) {
            row.setCodeNm("환경");
            row.setCodeDc("Environment");
            return;
        }
        if ("A008".equals(code)) {
            row.setCodeNm("배출/인증");
            row.setCodeDc("Emission / Certification");
            return;
        }
        if ("A00801".equals(code)) {
            row.setCodeNm("배출지 운영");
            row.setCodeDc("Emission Site Operations");
            return;
        }
        if (!menuUrl.startsWith("/admin/system/")) {
            return;
        }
        if ("/admin/system/page-management".equals(menuUrl)) {
            row.setCodeNm("화면 관리");
            row.setCodeDc("Screen Management");
        }
    }

    private int codeDepth(String code) {
        return safeString(code).length();
    }

    private int parentDepthSort(MenuInfoDTO row, Map<String, Integer> sortOrderMap) {
        String code = safeString(row.getCode()).toUpperCase(Locale.ROOT);
        if (code.length() == 6) {
            return normalizeSort(sortOrderMap.get(code.substring(0, 4)));
        }
        if (code.length() == 8) {
            return normalizeSort(sortOrderMap.get(code.substring(0, 6)));
        }
        return 0;
    }

    private int normalizeSort(Integer sortOrdr) {
        return sortOrdr == null ? Integer.MAX_VALUE : sortOrdr;
    }

    private int effectiveSort(String code, Integer sortOrdr) {
        if (sortOrdr != null) {
            return sortOrdr;
        }
        return fallbackCodeSort(code);
    }

    private int fallbackCodeSort(String code) {
        String normalized = safeString(code);
        if (normalized.length() < 2) {
            return Integer.MAX_VALUE;
        }
        try {
            return Integer.parseInt(normalized.substring(Math.max(0, normalized.length() - 2)));
        } catch (NumberFormatException ignored) {
            return Integer.MAX_VALUE;
        }
    }

    private String canonicalMenuUrl(String menuUrl) {
        String normalized = safeString(menuUrl);
        if (normalized.isEmpty()) {
            return "";
        }
        String canonical = ReactPageUrlMapper.toCanonicalMenuUrl(normalized);
        return canonical.isEmpty() ? normalized : canonical;
    }

    private String safeString(Object value) {
        return value == null ? "" : value.toString().trim();
    }
}
