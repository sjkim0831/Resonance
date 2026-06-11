package egovframework.com.platform.screenbuilder.model;

import java.time.LocalDateTime;
import java.util.Map;

public class ThemeVO {
    private String themeId;
    private String ownerId;
    private String themeName;
    private String description;
    private String status;
    private Boolean isDefault;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private Map<String, ThemeTokenVO> tokens;
    private ThemeComponentVO[] components;

    public String getThemeId() { return themeId; }
    public void setThemeId(String themeId) { this.themeId = themeId; }
    public String getOwnerId() { return ownerId; }
    public void setOwnerId(String ownerId) { this.ownerId = ownerId; }
    public String getThemeName() { return themeName; }
    public void setThemeName(String themeName) { this.themeName = themeName; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public Boolean getIsDefault() { return isDefault; }
    public void setIsDefault(Boolean isDefault) { this.isDefault = isDefault; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public Map<String, ThemeTokenVO> getTokens() { return tokens; }
    public void setTokens(Map<String, ThemeTokenVO> tokens) { this.tokens = tokens; }
    public ThemeComponentVO[] getComponents() { return components; }
    public void setComponents(ThemeComponentVO[] components) { this.components = components; }
}