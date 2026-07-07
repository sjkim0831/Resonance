package com.resonance.common.auth.entity;
import java.time.LocalDateTime;

public class UserAuthorMapping {
    private String userId;
    private String authorCode;
    private LocalDateTime creatPnttm;
    
    public UserAuthorMapping() {}
    
    public UserAuthorMapping(String userId, String authorCode) {
        this.userId = userId;
        this.authorCode = authorCode;
    }
    
    public String getUserId() { return userId; }
    public void setUserId(String userId) { this.userId = userId; }
    
    public String getAuthorCode() { return authorCode; }
    public void setAuthorCode(String authorCode) { this.authorCode = authorCode; }
    
    public LocalDateTime getCreatPnttm() { return creatPnttm; }
    public void setCreatPnttm(LocalDateTime creatPnttm) { this.creatPnttm = creatPnttm; }
}