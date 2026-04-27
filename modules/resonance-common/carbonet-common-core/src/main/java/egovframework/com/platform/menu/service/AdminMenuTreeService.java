package egovframework.com.platform.menu.service;

import egovframework.com.platform.codex.service.AuthGroupManageService;

import egovframework.com.common.util.ReactPageUrlMapper;
import egovframework.com.platform.menu.dto.AdminMenuDomainDTO;
import egovframework.com.platform.menu.dto.AdminMenuGroupDTO;
import egovframework.com.platform.menu.dto.AdminMenuLinkDTO;
import egovframework.com.platform.menu.dto.MenuInfoDTO;
import egovframework.com.platform.menu.service.MenuInfoService;
import egovframework.com.feature.auth.service.CurrentUserContextService;
import egovframework.com.platform.read.AdminMenuTreeReadPort;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
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
public class AdminMenuTreeService implements AdminMenuTreeReadPort {

    private static final String ROLE_SYSTEM_MASTER = "ROLE_SYSTEM_MASTER";
    private static final String ROLE_OPERATION_ADMIN = "ROLE_OPERATION_ADMIN";
    private static final Logger log = LoggerFactory.getLogger(AdminMenuTreeService.class);
    private static final Map<String, String> MENU_LABEL_OVERRIDES_KO = buildMenuLabelOverridesKo();
    private static final Map<String, String> MENU_LABEL_OVERRIDES_EN = buildMenuLabelOverridesEn();

    private final MenuInfoService menuInfoService;
    private final AuthGroupManageService authGroupManageService;
    private final CurrentUserContextService currentUserContextService;

    public Map<String, AdminMenuDomainDTO> buildAdminMenuTree(boolean isEn, HttpServletRequest request) {
        return buildAdminMenuTree(isEn, resolveAuthorCode(request));
    }

    public Map<String, AdminMenuDomainDTO> buildAdminMenuTree(boolean isEn, String authorCode) {
        List<MenuInfoDTO> rows;
        try {
            rows = menuInfoService.selectMenuTreeList("AMENU1");
        } catch (Exception e) {
            log.error("Failed to load admin menu detail codes.", e);
            rows = Collections.emptyList();
        }
        Map<String, AdminMenuDomainDTO> domains = new LinkedHashMap<>();
        Map<String, AdminMenuDomainDTO> domainByCode = new LinkedHashMap<>();
        Map<String, AdminMenuGroupDTO> groupByCode = new LinkedHashMap<>();
        Map<String, Integer> sortOrderMap = new LinkedHashMap<>();
        Set<String> exposedMenuKeys = new LinkedHashSet<>();

        for (MenuInfoDTO row : rows) {
            String code = safeString(row.getCode());
            if (code.isEmpty() || !"Y".equalsIgnoreCase(safeString(row.getUseAt()))) {
                continue;
            }
            sortOrderMap.put(code, row.getSortOrdr());
            String labelKo = resolveMenuLabelKo(row);
            String labelEn = resolveMenuLabelEn(row);
            if (labelEn.isEmpty()) {
                labelEn = labelKo;
            }
            String menuIcon = safeString(row.getMenuIcon());
            if (code.length() == 4) {
                String domainKey = labelKo.isEmpty() ? code : labelKo;
                AdminMenuDomainDTO domain = domainByCode.get(code);
                if (domain == null) {
                    domain = new AdminMenuDomainDTO();
                    domain.setSummary("");
                    domainByCode.put(code, domain);
                }
                domain.setLabel(labelKo);
                domain.setLabelEn(labelEn);
                domains.put(domainKey, domain);
            } else if (code.length() == 6) {
                String domainCode = code.substring(0, 4);
                AdminMenuDomainDTO domain = domainByCode.get(domainCode);
                if (domain == null) {
                    domain = new AdminMenuDomainDTO();
                    domain.setLabel(domainCode);
                    domain.setLabelEn(domainCode);
                    domain.setSummary("");
                    domainByCode.put(domainCode, domain);
                    domains.put(domainCode, domain);
                }
                List<AdminMenuGroupDTO> groups = domain.getGroups();
                AdminMenuGroupDTO group = groupByCode.get(code);
                if (group == null) {
                    group = new AdminMenuGroupDTO();
                    groupByCode.put(code, group);
                    groups.add(group);
                }
                group.setTitle(labelKo);
                group.setTitleEn(labelEn);
                if (!menuIcon.isEmpty()) {
                    group.setIcon(menuIcon);
                }
            } else if (code.length() == 8) {
                String menuUrl = normalizeMenuUrl(resolveMenuUrlOverride(code, row.getMenuUrl()));
                if (shouldHideMenu(code, menuUrl)) {
                    continue;
                }
                if (!shouldExposeMenu(authorCode, menuUrl)) {
                    continue;
                }
                String exposedMenuUrl = mapReactAdminMenuUrl(menuUrl, isEn);
                String exposedMenuKey = normalizeMenuUrl(exposedMenuUrl);
                if (exposedMenuKey.isEmpty()
                        || !shouldKeepPreferredMenu(code, menuUrl)
                        || !exposedMenuKeys.add(exposedMenuKey)) {
                    continue;
                }
                String groupCode = code.substring(0, 6);
                AdminMenuGroupDTO group = groupByCode.get(groupCode);
                if (group == null) {
                    String domainCode = code.substring(0, 4);
                    AdminMenuDomainDTO domain = domainByCode.get(domainCode);
                    if (domain == null) {
                        domain = new AdminMenuDomainDTO();
                        domain.setLabel(domainCode);
                        domain.setLabelEn(domainCode);
                        domain.setSummary("");
                        domainByCode.put(domainCode, domain);
                        domains.put(domainCode, domain);
                    }
                    List<AdminMenuGroupDTO> groups = domain.getGroups();
                    group = new AdminMenuGroupDTO();
                    group.setTitle(groupCode);
                    group.setTitleEn(groupCode);
                    groupByCode.put(groupCode, group);
                    groups.add(group);
                }
                List<AdminMenuLinkDTO> links = group.getLinks();
                AdminMenuLinkDTO link = new AdminMenuLinkDTO();
                link.setText(labelKo);
                link.setTEn(labelEn);
                link.setU(exposedMenuUrl.isEmpty() ? "#" : exposedMenuUrl);
                if (!menuIcon.isEmpty()) {
                    link.setIcon(menuIcon);
                }
                links.add(link);
            }
        }
        final List<MenuInfoDTO> menuRows = rows;
        Comparator<AdminMenuGroupDTO> groupComparator = Comparator
                .comparingInt((AdminMenuGroupDTO group) -> effectiveSort(resolveCodeByTitle(groupByCode, group), sortOrderMap))
                .thenComparing(group -> safeString(group.getTitle()));
        Comparator<AdminMenuLinkDTO> linkComparator = Comparator
                .comparingInt((AdminMenuLinkDTO link) -> effectiveSort(resolveCodeByUrl(menuRows, link.getU()), sortOrderMap))
                .thenComparing(link -> safeString(link.getText()));

        List<Map.Entry<String, AdminMenuDomainDTO>> orderedDomainEntries = new java.util.ArrayList<>(domainByCode.entrySet());
        orderedDomainEntries.sort(Comparator
                .comparingInt((Map.Entry<String, AdminMenuDomainDTO> entry) -> effectiveSort(entry.getKey(), sortOrderMap))
                .thenComparing(Map.Entry::getKey));

        for (Map.Entry<String, AdminMenuDomainDTO> entry : orderedDomainEntries) {
            AdminMenuDomainDTO domain = entry.getValue();
            domain.getGroups().sort(groupComparator);
            domain.getGroups().removeIf(group -> group.getLinks() == null || group.getLinks().isEmpty());
            for (AdminMenuGroupDTO group : domain.getGroups()) {
                group.getLinks().sort(linkComparator);
                normalizeGroupLabelFromLinks(group);
            }
        }
        Map<String, AdminMenuDomainDTO> orderedDomains = new LinkedHashMap<>();
        for (Map.Entry<String, AdminMenuDomainDTO> entry : orderedDomainEntries) {
            String domainCode = entry.getKey();
            AdminMenuDomainDTO domain = entry.getValue();
            if (domain.getGroups() == null || domain.getGroups().isEmpty()) {
                continue;
            }
            String domainKey = safeString(domain.getLabel()).isEmpty() ? domainCode : safeString(domain.getLabel());
            orderedDomains.put(domainKey, domain);
        }
        return orderedDomains;
    }

    private String resolveAuthorCode(HttpServletRequest request) {
        return currentUserContextService.resolve(request).getAuthorCode();
    }

    private boolean shouldExposeMenu(String authorCode, String menuUrl) {
        String normalizedAuthorCode = safeString(authorCode).toUpperCase(Locale.ROOT);
        String normalizedMenuUrl = normalizeRuntimeMenuUrl(menuUrl);
        if (normalizedMenuUrl.isEmpty() || "#".equals(normalizedMenuUrl)) {
            return false;
        }
        if (ROLE_SYSTEM_MASTER.equals(normalizedAuthorCode)) {
            return true;
        }
        if (isMasterOnlyRoute(normalizedMenuUrl)) {
            return false;
        }
        if (ROLE_OPERATION_ADMIN.equals(normalizedAuthorCode) && isCompanyAdminOnlyRoute(normalizedMenuUrl)) {
            return false;
        }
        try {
            List<String> featureCodes = authGroupManageService.selectRequiredViewFeatureCodesByMenuUrl(normalizedMenuUrl);
            if (featureCodes == null || featureCodes.isEmpty()) {
                return !normalizedAuthorCode.isEmpty();
            }
            for (String featureCode : featureCodes) {
                String normalizedFeatureCode = safeString(featureCode).toUpperCase(Locale.ROOT);
                if (!normalizedFeatureCode.isEmpty()
                        && authGroupManageService.hasAuthorFeaturePermission(normalizedAuthorCode, normalizedFeatureCode)) {
                    return true;
                }
            }
            return false;
        } catch (Exception e) {
            log.warn("Failed to evaluate admin menu permission. authorCode={}, menuUrl={}",
                    normalizedAuthorCode, normalizedMenuUrl, e);
            return false;
        }
    }

    private String normalizeRuntimeMenuUrl(String value) {
        String normalized = normalizeMenuUrl(value);
        if (normalized.startsWith("/admin/system/unified_log/")
                || normalized.startsWith("/en/admin/system/unified_log/")) {
            return normalized;
        }
        return ReactPageUrlMapper.toCanonicalMenuUrl(normalizeMenuUrl(value));
    }

    private String resolveMenuLabelKo(MenuInfoDTO row) {
        String label = safeString(row.getCodeNm());
        if (!isLikelyCodeLabel(label)) {
            return label;
        }
        String code = safeString(row.getCode()).toUpperCase(Locale.ROOT);
        String override = MENU_LABEL_OVERRIDES_KO.get(code);
        if (!override.isEmpty()) {
            return override;
        }
        return label;
    }

    private String resolveMenuLabelEn(MenuInfoDTO row) {
        String label = safeString(row.getCodeDc());
        if (!isLikelyCodeLabel(label)) {
            return label;
        }
        String code = safeString(row.getCode()).toUpperCase(Locale.ROOT);
        String override = MENU_LABEL_OVERRIDES_EN.get(code);
        if (!override.isEmpty()) {
            return override;
        }
        return label;
    }

    private boolean isMasterOnlyRoute(String normalizedUri) {
        String value = safeString(normalizedUri);
        if ("/admin/system/access_history".equals(value)
                || "/admin/system/error-log".equals(value)
                || "/admin/system/security".equals(value)
                || "/admin/system/security-audit".equals(value)
                || "/admin/system/unified_log".equals(value)
                || "/admin/system/unified_log/trace".equals(value)
                || "/admin/system/unified_log/page-events".equals(value)
                || "/admin/system/unified_log/ui-actions".equals(value)
                || "/admin/system/unified_log/api-trace".equals(value)
                || "/admin/system/unified_log/ui-errors".equals(value)
                || "/admin/system/unified_log/layout-render".equals(value)
                || "/admin/system/observability".equals(value)
                || "/admin/system/help-management".equals(value)
                || "/admin/system/page-management".equals(value)
                || "/admin/system/function-management".equals(value)
                || "/admin/system/menu".equals(value)
                || "/admin/system/menu-management".equals(value)
                || "/admin/content/menu".equals(value)
                || "/admin/system/screen-flow-management".equals(value)
                || "/admin/system/screen-menu-assignment-management".equals(value)
                || "/admin/system/verification-center".equals(value)
                || "/admin/system/verification-assets".equals(value)
                || "/admin/system/sr-workbench".equals(value)
                || "/admin/system/wbs-management".equals(value)
                || "/admin/system/new-page".equals(value)
                || "/admin/system/codex-request".equals(value)) {
            return false;
        }
        return "/admin/member/company-approve".equals(value)
                || "/admin/member/company_list".equals(value)
                || "/admin/member/company_detail".equals(value)
                || "/admin/member/company_account".equals(value)
                || "/admin/member/company-file".equals(value)
                || value.startsWith("/admin/content/")
                || value.startsWith("/admin/external/")
                || value.startsWith("/admin/system/");
    }

    private boolean isCompanyAdminOnlyRoute(String normalizedUri) {
        String value = safeString(normalizedUri);
        return "/admin/member/admin_list".equals(value)
                || "/admin/member/admin-list".equals(value)
                || "/admin/member/admin_account".equals(value)
                || "/admin/member/admin_account/permissions".equals(value)
                || isMasterOnlyRoute(value);
    }

    private String normalizeMenuUrl(String value) {
        String url = safeString(value);
        if (url.isEmpty()) {
            return "";
        }
        if ("/admin/member/admin-list".equals(url)) {
            return "/admin/member/admin_list";
        }
        if ("/en/admin/member/admin-list".equals(url)) {
            return "/en/admin/member/admin_list";
        }
        if (!url.startsWith("/")) {
            return "/" + url;
        }
        return url;
    }

    private String mapReactAdminMenuUrl(String value, boolean isEn) {
        String url = normalizeMenuUrl(value);
        if (url.isEmpty() || "#".equals(url)) {
            return url;
        }
        if (!(url.startsWith("/admin/system/unified_log/") || url.startsWith("/en/admin/system/unified_log/"))) {
            String canonical = ReactPageUrlMapper.toCanonicalMenuUrl(url);
            if (!canonical.isEmpty()) {
                url = canonical;
            }
        }
        return isEn ? localizeAdminUrl(url) : url;
    }

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }

    private boolean isLikelyCodeLabel(String value) {
        String normalized = safeString(value);
        if (normalized.isEmpty()) {
            return true;
        }
        return normalized.matches("^[A-Z]\\d{3,}$")
                || normalized.matches("^[A-Z][A-Z0-9_]{3,}$");
    }

    private void normalizeGroupLabelFromLinks(AdminMenuGroupDTO group) {
        if (group == null || group.getLinks() == null || group.getLinks().isEmpty()) {
            return;
        }
        if (isLikelyCodeLabel(group.getTitle())) {
            String fallbackKo = safeString(group.getLinks().get(0).getText());
            if (!fallbackKo.isEmpty()) {
                group.setTitle(fallbackKo);
            }
        }
        if (isLikelyCodeLabel(group.getTitleEn())) {
            String fallbackEn = safeString(group.getLinks().get(0).getTEn());
            if (fallbackEn.isEmpty()) {
                fallbackEn = safeString(group.getLinks().get(0).getText());
            }
            if (!fallbackEn.isEmpty()) {
                group.setTitleEn(fallbackEn);
            }
        }
    }

    private static Map<String, String> buildMenuLabelOverridesKo() {
        Map<String, String> labels = new HashMap<>();
        labels.put("A001", "회원");
        labels.put("A00101", "회원");
        labels.put("A00105", "이력");
        labels.put("A002", "배출/인증");
        labels.put("A00201", "배출");
        labels.put("A003", "거래");
        labels.put("A004", "콘텐츠");
        labels.put("A005", "외부 연계");
        labels.put("A006", "시스템");
        labels.put("A00601", "환경");
        labels.put("A00602", "보안");
        labels.put("A00603", "로그");
        labels.put("A00604", "백업");
        labels.put("A007", "대시보드");
        labels.put("A00701", "대시보드");
        labels.put("A190", "AI 운영");
        labels.put("A19001", "AI 작업센터");
        labels.put("AMENU_AUTH", "권한");
        labels.put("AMENU_MEMBER", "회원");
        labels.put("AMENU_COMPANY", "회원사");
        labels.put("AMENU_ADMIN", "관리자");
        labels.put("AMENU_SYSTEM", "시스템");
        return labels;
    }

    private static Map<String, String> buildMenuLabelOverridesEn() {
        Map<String, String> labels = new HashMap<>();
        labels.put("A001", "Members");
        labels.put("A00101", "Members");
        labels.put("A00105", "History");
        labels.put("A002", "Emissions & Certification");
        labels.put("A00201", "Emissions");
        labels.put("A003", "Trading");
        labels.put("A004", "Content");
        labels.put("A005", "External Integration");
        labels.put("A006", "System");
        labels.put("A00601", "Environment");
        labels.put("A00602", "Security");
        labels.put("A00603", "Logs");
        labels.put("A00604", "Backup");
        labels.put("A007", "Dashboard");
        labels.put("A00701", "Dashboard");
        labels.put("A190", "AI Operations");
        labels.put("A19001", "AI Workbench");
        labels.put("AMENU_AUTH", "Authority");
        labels.put("AMENU_MEMBER", "Members");
        labels.put("AMENU_COMPANY", "Companies");
        labels.put("AMENU_ADMIN", "Administrators");
        labels.put("AMENU_SYSTEM", "System");
        return labels;
    }

    private int effectiveSort(String code, Map<String, Integer> sortOrderMap) {
        Integer saved = sortOrderMap.get(code);
        if (saved != null) {
            return saved;
        }
        return fallbackCodeSort(code);
    }

    private int fallbackCodeSort(String code) {
        String normalized = safeString(code);
        if (normalized.length() == 4) {
            return parseSort(normalized.substring(1));
        }
        if (normalized.length() >= 6) {
            return parseSort(normalized.substring(normalized.length() - 2));
        }
        return Integer.MAX_VALUE;
    }

    private int parseSort(String value) {
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException e) {
            return Integer.MAX_VALUE;
        }
    }

    private String resolveCodeByTitle(Map<String, AdminMenuGroupDTO> groupByCode, AdminMenuGroupDTO target) {
        for (Map.Entry<String, AdminMenuGroupDTO> entry : groupByCode.entrySet()) {
            if (entry.getValue() == target) {
                return entry.getKey();
            }
        }
        return "";
    }

    private String resolveCodeByUrl(List<MenuInfoDTO> rows, String menuUrl) {
        String normalizedUrl = normalizeMenuUrl(menuUrl);
        for (MenuInfoDTO row : rows) {
            String rowUrl = normalizeMenuUrl(mapReactAdminMenuUrl(row.getMenuUrl(), false));
            if (rowUrl.equals(normalizedUrl)) {
                return safeString(row.getCode());
            }
        }
        return "";
    }
    private boolean shouldHideMenu(String code, String menuUrl) {
        String normalizedCode = safeString(code);
        String normalizedMenuUrl = normalizeMenuUrl(menuUrl);
        return "/admin/member/edit".equals(normalizedMenuUrl)
                || "/admin/member/detail".equals(normalizedMenuUrl)
                || "/admin/member/company_detail".equals(normalizedMenuUrl)
                || "/admin/member/admin_account/permissions".equals(normalizedMenuUrl);
    }

    private boolean shouldKeepPreferredMenu(String code, String menuUrl) {
        String normalizedCode = safeString(code);
        String normalizedMenuUrl = normalizeMenuUrl(menuUrl);
        if ("/admin/".equals(normalizedMenuUrl) || "/admin".equals(normalizedMenuUrl)) {
            return "A0070101".equals(normalizedCode) || normalizedCode.isEmpty();
        }
        if ("/admin/system/menu".equals(normalizedMenuUrl)
                || "/admin/system/menu-management".equals(normalizedMenuUrl)) {
            return "A0060107".equals(normalizedCode) || normalizedCode.isEmpty();
        }
        if ("/admin/content/menu".equals(normalizedMenuUrl)) {
            return "A0040304".equals(normalizedCode) || normalizedCode.isEmpty();
        }
        if ("/admin/system/security".equals(normalizedMenuUrl)) {
            return "A0060205".equals(normalizedCode) || normalizedCode.isEmpty();
        }
        if ("/admin/member/security".equals(normalizedMenuUrl)) {
            return "A0010502".equals(normalizedCode) || normalizedCode.isEmpty();
        }
        if ("/admin/system/observability".equals(normalizedMenuUrl)) {
            return "A0060303".equals(normalizedCode) || normalizedCode.isEmpty();
        }
        return true;
    }

    private String resolveMenuUrlOverride(String code, String menuUrl) {
        return normalizeMenuUrl(menuUrl);
    }

    private String localizeAdminUrl(String url) {
        String normalizedUrl = normalizeMenuUrl(url);
        if (normalizedUrl.isEmpty() || normalizedUrl.startsWith("/en/")) {
            return normalizedUrl;
        }
        int queryIndex = normalizedUrl.indexOf('?');
        if (queryIndex < 0) {
            return "/en" + normalizedUrl;
        }
        return "/en" + normalizedUrl.substring(0, queryIndex) + normalizedUrl.substring(queryIndex);
    }

}
