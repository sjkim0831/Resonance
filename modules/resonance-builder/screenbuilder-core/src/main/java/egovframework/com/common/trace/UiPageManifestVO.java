package egovframework.com.common.trace;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class UiPageManifestVO {

    private String pageId;
    private String pageName;
    private String routePath;
    private String domainCode;
    private String menuCode;
    private String layoutVersion;
    private String designTokenVersion;
    private String activeYn;
}
