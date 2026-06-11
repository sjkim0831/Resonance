package com.resonance.common.auth.entity;
import java.time.LocalDateTime;
import java.util.List;

public class Author {
    private String authorCode;
    private String authorNm;
    private String authorDc;
    private String authorTyCode;
    private Integer sortOrder;
    private String useAt;
    private LocalDateTime creatPnttm;
    private String creatUserId;
    private List<String> menuIds;
    
    public Author() {}
    
    public Author(String authorCode, String authorNm) {
        this.authorCode = authorCode;
        this.authorNm = authorNm;
    }
    
    public String getAuthorCode() { return authorCode; }
    public void setAuthorCode(String authorCode) { this.authorCode = authorCode; }
    
    public String getAuthorNm() { return authorNm; }
    public void setAuthorNm(String authorNm) { this.authorNm = authorNm; }
    
    public String getAuthorDc() { return authorDc; }
    public void setAuthorDc(String authorDc) { this.authorDc = authorDc; }
    
    public String getAuthorTyCode() { return authorTyCode; }
    public void setAuthorTyCode(String authorTyCode) { this.authorTyCode = authorTyCode; }
    
    public Integer getSortOrder() { return sortOrder; }
    public void setSortOrder(Integer sortOrder) { this.sortOrder = sortOrder; }
    
    public String getUseAt() { return useAt; }
    public void setUseAt(String useAt) { this.useAt = useAt; }
    
    public LocalDateTime getCreatPnttm() { return creatPnttm; }
    public void setCreatPnttm(LocalDateTime creatPnttm) { this.creatPnttm = creatPnttm; }
    
    public String getCreatUserId() { return creatUserId; }
    public void setCreatUserId(String creatUserId) { this.creatUserId = creatUserId; }
    
    public List<String> getMenuIds() { return menuIds; }
    public void setMenuIds(List<String> menuIds) { this.menuIds = menuIds; }
}