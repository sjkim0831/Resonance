package egovframework.com.platform.screenbuilder.model;

public class ThemeComponentVO {
    private String componentId;
    private String componentName;
    private String componentType;
    private String className;
    private String styleJson;
    private String defaultProps;
    private String description;

    public String getComponentId() { return componentId; }
    public void setComponentId(String componentId) { this.componentId = componentId; }
    public String getComponentName() { return componentName; }
    public void setComponentName(String componentName) { this.componentName = componentName; }
    public String getComponentType() { return componentType; }
    public void setComponentType(String componentType) { this.componentType = componentType; }
    public String getClassName() { return className; }
    public void setClassName(String className) { this.className = className; }
    public String getStyleJson() { return styleJson; }
    public void setStyleJson(String styleJson) { this.styleJson = styleJson; }
    public String getDefaultProps() { return defaultProps; }
    public void setDefaultProps(String defaultProps) { this.defaultProps = defaultProps; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}