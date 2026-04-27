package egovframework.com.platform.screenbuilder.model;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ScreenBuilderVersionSummaryVO {

    private String versionId;
    private String versionStatus;
    private String menuCode;
    private String pageId;
    private String templateType;
    private String savedAt;
    private int nodeCount;
    private int eventCount;
}
