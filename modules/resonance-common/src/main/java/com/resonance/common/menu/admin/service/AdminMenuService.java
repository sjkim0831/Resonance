package com.resonance.common.menu.admin.service;

import com.resonance.common.menu.admin.dto.CreatePageMenuResult;
import com.resonance.common.menu.admin.dto.MenuManagementPagePayload;
import com.resonance.common.menu.entity.MenuInfo;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

@Service
public class AdminMenuService {

    private final Map<String, ExtendedMenuInfo> menuStore = new HashMap<>();
    private final Map<String, CommonCodeInfo> codeStore = new HashMap<>();

    public AdminMenuService() {
        initDefaultData();
    }

    private void initDefaultData() {
        addMenuInfo(new ExtendedMenuInfo("GOV001", null, "Dashboard", "대시보드", "/admin/dashboard", "/admin/dashboard", "dashboard", 1, "ADMIN", "Y", "Y"));
        addMenuInfo(new ExtendedMenuInfo("GOV002", null, "Governance", "거버넌스", "/admin/governance", null, "admin_panel_settings", 1, "ADMIN", "Y", "Y"));
        addMenuInfo(new ExtendedMenuInfo("GOV0021", "GOV002", "Emission Management", "배출 관리", "/admin/emission", "/admin/emission", "factory", 2, "ADMIN", "Y", "Y"));
        addMenuInfo(new ExtendedMenuInfo("GOV002101", "GOV0021", "Emission Data Input", "배출량 입력", "/admin/emission/data-input", "/admin/emission/data-input", "edit_note", 1, "ADMIN", "Y", "Y"));
        addMenuInfo(new ExtendedMenuInfo("GOV002102", "GOV0021", "Emission Report", "배출 보고서", "/admin/emission/report", "/admin/emission/report", "description", 2, "ADMIN", "Y", "Y"));
        addMenuInfo(new ExtendedMenuInfo("GOV0022", "GOV002", "System Management", "시스템 관리", "/admin/system", null, "settings", 2, "ADMIN", "Y", "Y"));
        addMenuInfo(new ExtendedMenuInfo("GOV002201", "GOV0022", "Menu Registry", "메뉴 레지스트리", "/admin/system/menu-management", "/admin/system/menu-management", "menu", 1, "ADMIN", "Y", "Y"));
        addMenuInfo(new ExtendedMenuInfo("GOV002203", "GOV0022", "Layout Management", "레이아웃 관리", "/admin/system/layout-management", "/admin/system/layout-management", "dashboard_customize", 3, "ADMIN", "Y", "Y"));
        addMenuInfo(new ExtendedMenuInfo("GOV002202", "GOV0022", "Test Pages", "테스트 페이지", "/admin/system/test-pages", "/admin/system/test-pages", "bug_report", 4, "ADMIN", "Y", "N"));
        addMenuInfo(new ExtendedMenuInfo("GOV002204", "GOV0022", "Environment", "환경", "/admin/system/environment", null, "eco", 5, "ADMIN", "Y", "Y"));
        addMenuInfo(new ExtendedMenuInfo("GOV002205", "GOV002204", "Monitoring Dashboard", "모니터링 대시보드", "/admin/system/monitoring-dashboard", "/admin/system/monitoring-dashboard", "dashboard", 1, "ADMIN", "Y", "Y"));
        addMenuInfo(new ExtendedMenuInfo("GOV0023", "GOV002", "Security", "보안", "/admin/security", null, "security", 3, "ADMIN", "Y", "Y"));
        addMenuInfo(new ExtendedMenuInfo("GOV002301", "GOV0023", "Security Policy", "보안 정책", "/admin/security/policy", "/admin/security/policy", "policy", 1, "ADMIN", "Y", "Y"));

        addCodeInfo(new CommonCodeInfo("GOV001", "Dashboard", "대시보드", "Dashboard", "GOV"));
        addCodeInfo(new CommonCodeInfo("GOV002", "Governance", "거버넌스", "Governance", "GOV"));
        addCodeInfo(new CommonCodeInfo("GOV0021", "Emission Management", "배출 관리", "Emission Management", "GOV"));
        addCodeInfo(new CommonCodeInfo("GOV002101", "Emission Data Input", "배출량 입력", "Emission Data Input", "GOV"));
        addCodeInfo(new CommonCodeInfo("GOV002102", "Emission Report", "배출 보고서", "Emission Report", "GOV"));
        addCodeInfo(new CommonCodeInfo("GOV0022", "System Management", "시스템 관리", "System Management", "GOV"));
        addCodeInfo(new CommonCodeInfo("GOV002201", "Menu Registry", "메뉴 레지스트리", "Menu Registry", "GOV"));
        addCodeInfo(new CommonCodeInfo("GOV002203", "Layout Management", "레이아웃 관리", "Layout Management", "GOV"));
        addCodeInfo(new CommonCodeInfo("GOV002202", "Test Pages", "테스트 페이지", "Test Pages", "GOV"));
        addCodeInfo(new CommonCodeInfo("GOV002204", "Environment", "환경", "Environment", "GOV"));
        addCodeInfo(new CommonCodeInfo("GOV002205", "Monitoring Dashboard", "모니터링 대시보드", "Monitoring Dashboard", "GOV"));
        addCodeInfo(new CommonCodeInfo("GOV0023", "Security", "보안", "Security", "GOV"));
        addCodeInfo(new CommonCodeInfo("GOV002301", "Security Policy", "보안 정책", "Security Policy", "GOV"));
    }

    private void addMenuInfo(ExtendedMenuInfo menu) {
        menu.setCreatPnttm(LocalDateTime.now());
        menuStore.put(menu.getMenuCode(), menu);
    }

    private void addCodeInfo(CommonCodeInfo code) {
        codeStore.put(code.getCode(), code);
    }

    public MenuManagementPagePayload getMenuManagementPage(String menuType) {
        MenuManagementPagePayload payload = new MenuManagementPagePayload();

        List<ExtendedMenuInfo> menus = menuStore.values().stream()
                .filter(m -> menuType.equals(m.getMenuType()))
                .sorted(Comparator.comparing(ExtendedMenuInfo::getSortOrdr))
                .collect(Collectors.toList());

        payload.setMenuRows(menus.stream().map(this::menuToRow).collect(Collectors.toList()));

        List<Map<String, String>> menuTypes = new ArrayList<>();
        menuTypes.add(Map.of("value", "ADMIN", "label", "관리자"));
        menuTypes.add(Map.of("value", "USER", "label", "사용자"));
        payload.setMenuTypes(menuTypes);

        List<Map<String, String>> groupOptions = menus.stream()
                .filter(m -> m.getMenuCode().length() == 4 || m.getMenuCode().length() == 6)
                .map(m -> Map.of("value", m.getMenuCode(), "label", m.getCodeNm() + " (" + m.getMenuCode() + ")"))
                .collect(Collectors.toList());
        payload.setGroupMenuOptions(groupOptions);

        payload.setIconOptions(List.of("web", "dashboard", "menu", "settings", "admin_panel_settings", "factory", "security", "edit_note", "description", "bug_report", "policy"));

        payload.setUseAtOptions(List.of("Y", "N"));

        return payload;
    }

    private Map<String, Object> menuToRow(ExtendedMenuInfo menu) {
        Map<String, Object> row = new HashMap<>();
        row.put("code", menu.getMenuCode());
        row.put("label", menu.getCodeNm());
        row.put("url", menu.getMenuUrl());
        row.put("icon", menu.getMenuIcon());
        row.put("sortOrdr", menu.getSortOrdr());
        row.put("useAt", menu.getUseAt());
        row.put("expsrAt", menu.getExpsrAt());
        return row;
    }

    public boolean saveMenuOrder(String menuType, String orderPayload) {
        try {
            String[] items = orderPayload.split(",");
            for (int i = 0; i < items.length; i++) {
                String code = items[i].trim();
                if (!code.isEmpty()) {
                    ExtendedMenuInfo menu = menuStore.get(code);
                    if (menu != null) {
                        menu.setSortOrdr(i + 1);
                    }
                }
            }
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    public boolean toggleMenuExposure(String menuType, String menuCode, String expsrAt) {
        ExtendedMenuInfo menu = menuStore.get(menuCode);
        if (menu != null) {
            menu.setExpsrAt(expsrAt);
            return true;
        }
        return false;
    }

    public CreatePageMenuResult createPageMenu(String menuType, String parentCode, String codeNm,
                                                String codeDc, String menuUrl, String menuIcon, String useAt) {
        try {
            String newCode = generateMenuCode(parentCode);
            LocalDateTime now = LocalDateTime.now();

            ExtendedMenuInfo menu = new ExtendedMenuInfo();
            menu.setMenuCode(newCode);
            menu.setUpperMenuCode(parentCode);
            menu.setCodeNm(codeNm);
            menu.setCodeDc(codeDc != null ? codeDc : codeNm);
            menu.setMenuUrl(menuUrl);
            menu.setMenuIcon(menuIcon);
            menu.setSortOrdr(99);
            menu.setMenuType(menuType);
            menu.setUseAt(useAt);
            menu.setExpsrAt("Y");
            menu.setCreatPnttm(now);
            menuStore.put(newCode, menu);

            CommonCodeInfo code = new CommonCodeInfo();
            code.setCode(newCode);
            code.setCodeNm(codeNm);
            code.setCodeDc(codeDc != null ? codeDc : codeNm);
            code.setCodeGroup("GOV");
            code.setCreatPnttm(now);
            codeStore.put(newCode, code);

            return CreatePageMenuResult.success(newCode);
        } catch (Exception e) {
            return CreatePageMenuResult.failure("Failed to create menu: " + e.getMessage());
        }
    }

    private String generateMenuCode(String parentCode) {
        if (parentCode == null || parentCode.isEmpty()) {
            return "GOV" + String.format("%03d", new Random().nextInt(999) + 1);
        }
        int length = parentCode.length();
        String prefix = length <= 6 ? parentCode.substring(0, length - 2) : parentCode;
        return prefix + String.format("%02d", new Random().nextInt(99) + 1);
    }

    public boolean updatePageMenu(String menuCode, String codeNm, String codeDc,
                                  String menuUrl, String menuIcon, String useAt) {
        try {
            ExtendedMenuInfo menu = menuStore.get(menuCode);
            CommonCodeInfo code = codeStore.get(menuCode);

            if (menu != null) {
                menu.setCodeNm(codeNm);
                menu.setMenuUrl(menuUrl);
                menu.setMenuIcon(menuIcon);
                menu.setUseAt(useAt);
            }

            if (code != null) {
                code.setCodeNm(codeNm);
                if (codeDc != null) {
                    code.setCodeDc(codeDc);
                }
            } else {
                CommonCodeInfo newCode = new CommonCodeInfo();
                newCode.setCode(menuCode);
                newCode.setCodeNm(codeNm);
                newCode.setCodeDc(codeDc != null ? codeDc : codeNm);
                newCode.setCodeGroup("GOV");
                newCode.setCreatPnttm(LocalDateTime.now());
                codeStore.put(menuCode, newCode);
            }

            return true;
        } catch (Exception e) {
            return false;
        }
    }

    public boolean deleteMenu(String menuCode) {
        ExtendedMenuInfo menu = menuStore.get(menuCode);
        if (menu != null) {
            menu.setUseAt("N");
            return true;
        }
        return false;
    }

    public static class ExtendedMenuInfo {
        private String menuCode;
        private String upperMenuCode;
        private String codeNm;
        private String codeDc;
        private String menuUrl;
        private String menuIcon;
        private int sortOrdr;
        private String menuType;
        private String useAt;
        private String expsrAt;
        private LocalDateTime creatPnttm;

        public ExtendedMenuInfo() {}

        public ExtendedMenuInfo(String menuCode, String upperMenuCode, String codeNm, String codeDc,
                               String menuUrl, String menuIcon, String iconPath, int sortOrdr,
                               String menuType, String useAt, String expsrAt) {
            this.menuCode = menuCode;
            this.upperMenuCode = upperMenuCode;
            this.codeNm = codeNm;
            this.codeDc = codeDc;
            this.menuUrl = menuUrl;
            this.menuIcon = menuIcon;
            this.sortOrdr = sortOrdr;
            this.menuType = menuType;
            this.useAt = useAt;
            this.expsrAt = expsrAt;
        }

        public String getMenuCode() { return menuCode; }
        public void setMenuCode(String menuCode) { this.menuCode = menuCode; }
        public String getUpperMenuCode() { return upperMenuCode; }
        public void setUpperMenuCode(String upperMenuCode) { this.upperMenuCode = upperMenuCode; }
        public String getCodeNm() { return codeNm; }
        public void setCodeNm(String codeNm) { this.codeNm = codeNm; }
        public String getCodeDc() { return codeDc; }
        public void setCodeDc(String codeDc) { this.codeDc = codeDc; }
        public String getMenuUrl() { return menuUrl; }
        public void setMenuUrl(String menuUrl) { this.menuUrl = menuUrl; }
        public String getMenuIcon() { return menuIcon; }
        public void setMenuIcon(String menuIcon) { this.menuIcon = menuIcon; }
        public int getSortOrdr() { return sortOrdr; }
        public void setSortOrdr(int sortOrdr) { this.sortOrdr = sortOrdr; }
        public String getMenuType() { return menuType; }
        public void setMenuType(String menuType) { this.menuType = menuType; }
        public String getUseAt() { return useAt; }
        public void setUseAt(String useAt) { this.useAt = useAt; }
        public String getExpsrAt() { return expsrAt; }
        public void setExpsrAt(String expsrAt) { this.expsrAt = expsrAt; }
        public LocalDateTime getCreatPnttm() { return creatPnttm; }
        public void setCreatPnttm(LocalDateTime creatPnttm) { this.creatPnttm = creatPnttm; }
    }

    public static class CommonCodeInfo {
        private String code;
        private String codeNm;
        private String codeDc;
        private String codeGroup;
        private LocalDateTime creatPnttm;

        public String getCode() { return code; }
        public void setCode(String code) { this.code = code; }
        public String getCodeNm() { return codeNm; }
        public void setCodeNm(String codeNm) { this.codeNm = codeNm; }
        public String getCodeDc() { return codeDc; }
        public void setCodeDc(String codeDc) { this.codeDc = codeDc; }
        public String getCodeGroup() { return codeGroup; }
        public void setCodeGroup(String codeGroup) { this.codeGroup = codeGroup; }
        public LocalDateTime getCreatPnttm() { return creatPnttm; }
        public void setCreatPnttm(LocalDateTime creatPnttm) { this.creatPnttm = creatPnttm; }
    }
}