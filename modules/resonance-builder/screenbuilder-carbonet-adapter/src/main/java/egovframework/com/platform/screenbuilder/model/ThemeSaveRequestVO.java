package egovframework.com.platform.screenbuilder.model;

public class ThemeSaveRequestVO {
    private String themeId;
    private String ownerId;
    private String themeName;
    private String description;
    private String status;
    private String tokensJson;
    private String componentsJson;
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
    public String getTokensJson() { return tokensJson; }
    public void setTokensJson(String tokensJson) { this.tokensJson = tokensJson; }
    public String getComponentsJson() { return componentsJson; }
    public void setComponentsJson(String componentsJson) { this.componentsJson = componentsJson; }
    public String getCssVariables() { return cssVariables; }
    public void setCssVariables(String cssVariables) { this.cssVariables = cssVariables; }
    public String getCustomCss() { return customCss; }
    public void setCustomCss(String customCss) { this.customCss = customCss; }
}