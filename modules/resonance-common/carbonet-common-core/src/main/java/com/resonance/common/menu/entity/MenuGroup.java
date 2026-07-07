package com.resonance.common.menu.entity;

import java.time.LocalDateTime;

public class MenuGroup {
    private String menuGroupId;
    private String menuGroupNm;
    private String menuGroupDs;
    private Integer sortOrder;
    private String useAt;
    private LocalDateTime creatPnttm;
    private String creatUserId;
    
    public MenuGroup() {}
    
    public MenuGroup(String menuGroupId, String menuGroupNm) {
        this.menuGroupId = menuGroupId;
        this.menuGroupNm = menuGroupNm;
    }
    
    // Getters and Setters
    public String getMenuGroupId() { return menuGroupId; }
    public void setMenuGroupId(String menuGroupId) { this.menuGroupId = menuGroupId; }
    
    public String getMenuGroupNm() { return menuGroupNm; }
    public void setMenuGroupNm(String menuGroupNm) { this.menuGroupNm = menuGroupNm; }
    
    public String getMenuGroupDs() { return menuGroupDs; }
    public void setMenuGroupDs(String menuGroupDs) { this.menuGroupDs = menuGroupDs; }
    
    public Integer getSortOrder() { return sortOrder; }
    public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }
    
    public String getUseAt() { return useAt; }
    public void setUseAt(String useAt) { this.useAt = useAt; }
    
    public LocalDateTime getCreatPnttm() { return creatPnttm; }
    public void setCreatPnttm(LocalDateTime creatPnttm) { this.creatPnttm = creatPnttm; }
    
    public String getCreatUserId() { return creatUserId; }
    public void setCreatUserId(String creatUserId) { this.creatUserId = creatUserId; }
}
