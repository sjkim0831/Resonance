package com.resonance.common.menu.entity;

import java.time.LocalDateTime;
import java.util.List;

public class MenuInfo {
    private String menuId;
    private String upperMenuId;
    private String menuNm;
    private String menuDc;
    private String menuPath;
    private String menuUrl;
    private String iconPath;
    private Integer sortOrder;
    private Integer menuLevel;
    private String menuGroupId;
    private String useAt;
    private LocalDateTime creatPnttm;
    private String creatUserId;

    // Screen Builder integration
    private String pageId;
    private boolean createScreen;
    private String screenTemplateType;

    // For tree structure
    private List<MenuInfo> children;
    private boolean hasChildren;
    
    public MenuInfo() {}
    
    public MenuInfo(String menuId, String menuNm) {
        this.menuId = menuId;
        this.menuNm = menuNm;
    }
    
    // Getters and Setters
    public String getMenuId() { return menuId; }
    public void setMenuId(String menuId) { this.menuId = menuId; }
    
    public String getUpperMenuId() { return upperMenuId; }
    public void setUpperMenuId(String upperMenuId) { this.upperMenuId = upperMenuId; }
    
    public String getMenuNm() { return menuNm; }
    public void setMenuNm(String menuNm) { this.menuNm = menuNm; }
    
    public String getMenuDc() { return menuDc; }
    public void setMenuDc(String menuDc) { this.menuDc = menuDc; }
    
    public String getMenuPath() { return menuPath; }
    public void setMenuPath(String menuPath) { this.menuPath = menuPath; }
    
    public String getMenuUrl() { return menuUrl; }
    public void setMenuUrl(String menuUrl) { this.menuUrl = menuUrl; }
    
    public String getIconPath() { return iconPath; }
    public void setIconPath(String iconPath) { this.iconPath = iconPath; }
    
    public Integer getSortOrder() { return sortOrder; }
    public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }
    
    public Integer getMenuLevel() { return menuLevel; }
    public void setMenuLevel(Integer menuLevel) { this.menuLevel = menuLevel; }
    
    public String getMenuGroupId() { return menuGroupId; }
    public void setMenuGroupId(String menuGroupId) { this.menuGroupId = menuGroupId; }
    
    public String getUseAt() { return useAt; }
    public void setUseAt(String useAt) { this.useAt = useAt; }
    
    public LocalDateTime getCreatPnttm() { return creatPnttm; }
    public void setCreatPnttm(LocalDateTime creatPnttm) { this.creatPnttm = creatPnttm; }
    
    public String getCreatUserId() { return creatUserId; }
    public void setCreatUserId(String creatUserId) { this.creatUserId = creatUserId; }

    public String getPageId() { return pageId; }
    public void setPageId(String pageId) { this.pageId = pageId; }

    public boolean isCreateScreen() { return createScreen; }
    public void setCreateScreen(boolean createScreen) { this.createScreen = createScreen; }

    public String getScreenTemplateType() { return screenTemplateType; }
    public void setScreenTemplateType(String screenTemplateType) { this.screenTemplateType = screenTemplateType; }

    public List<MenuInfo> getChildren() { return children; }
    public void setChildren(List<MenuInfo> children) { this.children = children; }
    
    public boolean isHasChildren() { return hasChildren; }
    public void setHasChildren(boolean hasChildren) { this.hasChildren = hasChildren; }
}
