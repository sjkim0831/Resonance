package egovframework.com.platform.screenbuilder.model;

import java.time.LocalDateTime;

public class ThemeDetailVO {
    private String themeId;
    private String ownerId;
    private String themeName;
    private String description;
    private String status;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private ThemeTokenVO[] tokens;
    private ThemeComponentVO[] components;
    private String cssVariables;
    private String customCss;

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
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public ThemeTokenVO[] getTokens() { return tokens; }
    public void setTokens(ThemeTokenVO[] tokens) { this.tokens = tokens; }
    public ThemeComponentVO[] getComponents() { return components; }
    public void setComponents(ThemeComponentVO[] components) { this.components = components; }
    public String getCssVariables() { return cssVariables; }
    public void setCssVariables(String cssVariables) { this.cssVariables = cssVariables; }
    public String getCustomCss() { return customCss; }
    public void setCustomCss(String customCss) { this.customCss = customCss; }
}