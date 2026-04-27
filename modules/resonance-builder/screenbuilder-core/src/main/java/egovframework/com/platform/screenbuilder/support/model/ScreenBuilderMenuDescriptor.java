package egovframework.com.platform.screenbuilder.support.model;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ScreenBuilderMenuDescriptor {

    private String menuCode;
    private String code;
    private String menuTitle;
    private String menuUrl;
    private String menuScope;
    private String projectId;
    private String runtimeClass;
}
