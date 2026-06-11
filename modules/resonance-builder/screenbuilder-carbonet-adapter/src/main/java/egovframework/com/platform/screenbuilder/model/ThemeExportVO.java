package egovframework.com.platform.screenbuilder.model;

public class ThemeExportVO {
    private String themeId;
    private String themeName;
    private String description;
    private String cssVariables;
    private String customCss;
    private ThemeComponentVO[] components;
    private String exportedAt;
    private String exportedBy;

    public String getThemeId() { return themeId; }
    public void setThemeId(String themeId) { this.themeId = themeId; }
    public String getThemeName() { return themeName; }
    public void setThemeName(String themeName) { this.themeName = themeName; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getCssVariables() { return cssVariables; }
    public void setCssVariables(String cssVariables) { this.cssVariables = cssVariables; }
    public String getCustomCss() { return customCss; }
    public void setCustomCss(String customCss) { this.customCss = customCss; }
    public ThemeComponentVO[] getComponents() { return components; }
    public void setComponents(ThemeComponentVO[] components) { this.components = components; }
    public String getExportedAt() { return exportedAt; }
    public void setExportedAt(String exportedAt) { this.exportedAt = exportedAt; }
    public String getExportedBy() { return exportedBy; }
    public void setExportedBy(String exportedBy) { this.exportedBy = exportedBy; }
}