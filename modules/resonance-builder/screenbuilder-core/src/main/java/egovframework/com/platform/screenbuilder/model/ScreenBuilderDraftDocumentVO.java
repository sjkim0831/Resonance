package egovframework.com.platform.screenbuilder.model;

import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class ScreenBuilderDraftDocumentVO {

    private String builderId;
    private String versionId;
    private String pageId;
    private String menuCode;
    private String menuTitle;
    private String menuUrl;
    private String templateType;
    private ScreenBuilderAuthorityProfileVO authorityProfile;
    private String versionStatus;
    private List<ScreenBuilderNodeVO> nodes = new ArrayList<>();
    private List<ScreenBuilderEventBindingVO> events = new ArrayList<>();
}
