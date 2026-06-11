package com.resonance.common.menu.service;

import com.resonance.common.menu.entity.MenuGroup;
import com.resonance.common.menu.entity.MenuInfo;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.*;
import java.util.stream.Collectors;

/**
 * Menu Management Service
 * 
 * 주요 기능:
 * - 메뉴 트리 조회 (계층 구조)
 * - 메뉴 CRUD
 * - 메뉴 권한 매핑
 * - 접근 권한 체크
 */
@Service
public class MenuService {
    
    // In-memory storage (실제로는 DB 연동)
    private final Map<String, MenuGroup> menuGroups = new HashMap<>();
    private final Map<String, MenuInfo> menuInfos = new HashMap<>();
    
    public MenuService() {
        initDefaultData();
    }
    
    private void initDefaultData() {
        // 기본 메뉴 그룹
        MenuGroup system = new MenuGroup("SYSTM", "시스템관리");
        system.setMenuGroupDs("시스템 관리 메뉴 그룹");
        system.setSortOrder(1);
        menuGroups.put(system.getMenuGroupId(), system);

        MenuGroup general = new MenuGroup("GNRL", "일반메뉴");
        general.setMenuGroupDs("일반 메뉴 그룹");
        general.setSortOrder(2);
        menuGroups.put(general.getMenuGroupId(), general);

        // 기본 메뉴
        addMenu(new MenuInfo("MENU001", null, "Dashboard", "대시보드", "/dashboard", "/api/dashboard", null, 1, "GNRL"));
        addMenu(new MenuInfo("MENU002", null, "시스템관리", "시스템 관리", "/admin", null, null, 1, "SYSTM"));
        addMenu(new MenuInfo("MENU0021", "MENU002", "사용자관리", "사용자 관리", "/admin/user", "/api/users", null, 2, "SYSTM"));
        addMenu(new MenuInfo("MENU0022", "MENU002", "메뉴관리", "메뉴 관리", "/admin/menu", "/api/menu", null, 2, "SYSTM"));
        addMenu(new MenuInfo("MENU0023", "MENU002", "권한관리", "권한 관리", "/admin/role", "/api/roles", null, 2, "SYSTM"));
        addMenu(new MenuInfo("MENU0024", "MENU002", "시스템监控", "시스템监控", "/admin/monitor", "/api/monitor", null, 2, "SYSTM"));
        addMenu(new MenuInfo("MENU003", null, "업무관리", "업무 관리", "/business", null, null, 1, "GNRL"));

        // 화면 관리 메뉴 (Screen Builder 연동)
        MenuInfo screenMgmt = new MenuInfo("SMG001", "화면 관리");
        screenMgmt.setMenuNm("화면 관리");
        screenMgmt.setMenuDc("Screen Management");
        screenMgmt.setMenuPath("/admin/system/screen-management");
        screenMgmt.setMenuUrl("/admin/system/screen-management");
        screenMgmt.setMenuGroupId("SYSTM");
        screenMgmt.setSortOrder(50);
        screenMgmt.setMenuLevel(2);
        screenMgmt.setUpperMenuId("MENU002");
        screenMgmt.setUseAt("Y");
        screenMgmt.setCreatPnttm(LocalDateTime.now());
        menuInfos.put(screenMgmt.getMenuId(), screenMgmt);
    }
    
    private void addMenu(MenuInfo menu) {
        menu.setUseAt("Y");
        menu.setCreatPnttm(LocalDateTime.now());
        menuInfos.put(menu.getMenuId(), menu);
    }

    // Screen Builder screen storage (in-memory for now)
    private final Map<String, ScreenInfo> screenInfos = new HashMap<>();

    /**
     * Inner class for screen info
     */
    public static class ScreenInfo {
        private String pageId;
        private String menuCode;
        private String menuTitle;
        private String menuUrl;
        private String templateType;
        private List<Object> nodes;
        private List<Object> events;
        private String createdAt;

        public ScreenInfo() {
            this.createdAt = LocalDateTime.now().toString();
        }

        // Getters and setters
        public String getPageId() { return pageId; }
        public void setPageId(String pageId) { this.pageId = pageId; }
        public String getMenuCode() { return menuCode; }
        public void setMenuCode(String menuCode) { this.menuCode = menuCode; }
        public String getMenuTitle() { return menuTitle; }
        public void setMenuTitle(String menuTitle) { this.menuTitle = menuTitle; }
        public String getMenuUrl() { return menuUrl; }
        public void setMenuUrl(String menuUrl) { this.menuUrl = menuUrl; }
        public String getTemplateType() { return templateType; }
        public void setTemplateType(String templateType) { this.templateType = templateType; }
        public List<Object> getNodes() { return nodes; }
        public void setNodes(List<Object> nodes) { this.nodes = nodes; }
        public List<Object> getEvents() { return events; }
        public void setEvents(List<Object> events) { this.events = events; }
        public String getCreatedAt() { return createdAt; }
    }

    public ScreenInfo getScreenByMenuCode(String menuCode) {
        return screenInfos.get(menuCode);
    }

    public List<ScreenInfo> getAllScreens() {
        return new ArrayList<>(screenInfos.values());
    }

    private ScreenInfo createDefaultScreen(String menuCode, String menuTitle, String menuUrl, String templateType) {
        ScreenInfo screen = new ScreenInfo();
        screen.setPageId("PAGE-" + System.currentTimeMillis());
        screen.setMenuCode(menuCode);
        screen.setMenuTitle(menuTitle);
        screen.setMenuUrl(menuUrl);
        screen.setTemplateType(templateType != null ? templateType : "admin");

        // Create default page structure
        List<Object> defaultNodes = new ArrayList<>();
        Map<String, Object> pageNode = new HashMap<>();
        pageNode.put("nodeId", "page-root");
        pageNode.put("componentType", "page");
        pageNode.put("sortOrder", 0);
        pageNode.put("props", Map.of("title", menuTitle));
        defaultNodes.add(pageNode);

        Map<String, Object> headerNode = new HashMap<>();
        headerNode.put("nodeId", "header-1");
        headerNode.put("componentType", "section");
        headerNode.put("parentNodeId", "page-root");
        headerNode.put("slotName", "header");
        headerNode.put("sortOrder", 1);
        headerNode.put("props", Map.of("title", menuTitle));
        defaultNodes.add(headerNode);

        Map<String, Object> contentNode = new HashMap<>();
        contentNode.put("nodeId", "content-1");
        contentNode.put("componentType", "section");
        contentNode.put("parentNodeId", "page-root");
        contentNode.put("slotName", "content");
        contentNode.put("sortOrder", 2);
        contentNode.put("props", Map.of("title", "Content"));
        defaultNodes.add(contentNode);

        screen.setNodes(defaultNodes);
        screen.setEvents(new ArrayList<>());

        return screen;
    }
    
    // === Menu Group Operations ===
    
    public List<MenuGroup> getAllMenuGroups() {
        return menuGroups.values().stream()
            .filter(g -> "Y".equals(g.getUseAt()))
            .sorted(Comparator.comparing(MenuGroup::getSortOrder))
            .collect(Collectors.toList());
    }
    
    public MenuGroup getMenuGroup(String menuGroupId) {
        return menuGroups.get(menuGroupId);
    }
    
    public MenuGroup createMenuGroup(MenuGroup group) {
        group.setCreatPnttm(LocalDateTime.now());
        menuGroups.put(group.getMenuGroupId(), group);
        return group;
    }
    
    public MenuGroup updateMenuGroup(String menuGroupId, MenuGroup group) {
        group.setMenuGroupId(menuGroupId);
        menuGroups.put(menuGroupId, group);
        return group;
    }
    
    public void deleteMenuGroup(String menuGroupId) {
        MenuGroup group = menuGroups.get(menuGroupId);
        if (group != null) {
            group.setUseAt("N");
        }
    }
    
    // === Menu Operations ===
    
    public List<MenuInfo> getAllMenus() {
        return menuInfos.values().stream()
            .filter(m -> "Y".equals(m.getUseAt()))
            .sorted(Comparator.comparing(MenuInfo::getSortOrder))
            .collect(Collectors.toList());
    }
    
    public MenuInfo getMenu(String menuId) {
        return menuInfos.get(menuId);
    }
    
    public List<MenuInfo> getMenusByGroup(String menuGroupId) {
        return menuInfos.values().stream()
            .filter(m -> "Y".equals(m.getUseAt()))
            .filter(m -> menuGroupId.equals(m.getMenuGroupId()))
            .sorted(Comparator.comparing(MenuInfo::getSortOrder))
            .collect(Collectors.toList());
    }
    
    /**
     * Get menu tree structure
     */
    public List<MenuInfo> getMenuTree() {
        List<MenuInfo> allMenus = getAllMenus();
        
        // Root menus (no parent)
        List<MenuInfo> rootMenus = allMenus.stream()
            .filter(m -> m.getUpperMenuId() == null)
            .sorted(Comparator.comparing(MenuInfo::getSortOrder))
            .collect(Collectors.toList());
        
        // Build tree
        for (MenuInfo menu : rootMenus) {
            buildMenuTree(menu, allMenus);
        }
        
        return rootMenus;
    }
    
    private void buildMenuTree(MenuInfo parent, List<MenuInfo> allMenus) {
        List<MenuInfo> children = allMenus.stream()
            .filter(m -> parent.getMenuId().equals(m.getUpperMenuId()))
            .sorted(Comparator.comparing(MenuInfo::getSortOrder))
            .collect(Collectors.toList());
        
        parent.setChildren(children);
        parent.setHasChildren(!children.isEmpty());
        
        for (MenuInfo child : children) {
            buildMenuTree(child, allMenus);
        }
    }
    
    public MenuInfo createMenu(MenuInfo menu) {
        menu.setCreatPnttm(LocalDateTime.now());

        // Auto-generate menuId if not provided
        if (menu.getMenuId() == null || menu.getMenuId().isEmpty()) {
            menu.setMenuId("MENU" + System.currentTimeMillis());
        }

        // Auto-generate pageId if screen creation is requested
        if (menu.isCreateScreen()) {
            ScreenInfo screen = createDefaultScreen(
                menu.getMenuId(),
                menu.getMenuNm(),
                menu.getMenuUrl(),
                menu.getScreenTemplateType()
            );
            menu.setPageId(screen.getPageId());
            screenInfos.put(menu.getMenuId(), screen);
        }

        menuInfos.put(menu.getMenuId(), menu);
        return menu;
    }
    
    public MenuInfo updateMenu(String menuId, MenuInfo menu) {
        menu.setMenuId(menuId);
        menuInfos.put(menuId, menu);
        return menu;
    }
    
    public void deleteMenu(String menuId) {
        MenuInfo menu = menuInfos.get(menuId);
        if (menu != null) {
            menu.setUseAt("N");
        }
    }
    
    // === Authority Check ===
    
    public boolean hasMenuAccess(String menuId, String roleCode) {
        // TODO: 실제 권한 체크 로직
        return true;
    }
    
    public boolean hasFunctionAccess(String menuId, String functionCode, String roleCode) {
        // TODO: 함수별 권한 체크 로직
        return true;
    }
    
    /**
     * Get authorized menus for role
     */
    public List<MenuInfo> getAuthorizedMenus(String roleCode) {
        // TODO: 실제 권한 기반 필터링
        return getAllMenus();
    }
}
