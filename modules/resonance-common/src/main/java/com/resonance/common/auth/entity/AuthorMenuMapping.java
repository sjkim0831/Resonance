package com.resonance.common.auth.entity;
import java.time.LocalDateTime;

public class AuthorMenuMapping {
    private String authorCode;
    private String menuId;
    private String searchAt;
    private String regitrAt;
    private String updtAt;
    private String deleteAt;
    private LocalDateTime creatPnttm;
    
    public AuthorMenuMapping() {}
    
    public AuthorMenuMapping(String authorCode, String menuId) {
        this.authorCode = authorCode;
        this.menuId = menuId;
        this.searchAt = "Y";
        this.regitrAt = "Y";
        this.updtAt = "Y";
        this.deleteAt = "Y";
    }
    
    public String getAuthorCode() { return authorCode; }
    public void setAuthorCode(String authorCode) { this.authorCode = authorCode; }
    
    public String getMenuId() { return menuId; }
    public void setMenuId(String menuId) { this.menuId = menuId; }
    
    public String getSearchAt() { return searchAt; }
    public void setSearchAt(String searchAt) { this.searchAt = searchAt; }
    
    public String getRegitrAt() { return regitrAt; }
    public void setRegitrAt(String regitrAt) { this.regitrAt = regitrAt; }
    
    public String getUpdtAt() { return updtAt; }
    public void setUpdtAt(String updtAt) { this.updtAt = updtAt; }
    
    public String getDeleteAt() { return deleteAt; }
    public void setDeleteAt(String deleteAt) { this.deleteAt = deleteAt; }
    
    public LocalDateTime getCreatPnttm() { return creatPnttm; }
    public void setCreatPnttm(LocalDateTime creatPnttm) { this.creatPnttm = creatPnttm; }
}