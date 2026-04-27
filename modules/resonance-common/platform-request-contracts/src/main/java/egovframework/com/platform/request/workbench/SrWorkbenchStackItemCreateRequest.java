package egovframework.com.platform.request.workbench;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SrWorkbenchStackItemCreateRequest {

    private String pageId;
    private String pageLabel;
    private String routePath;
    private String menuCode;
    private String menuLookupUrl;
    private String surfaceId;
    private String surfaceLabel;
    private String selector;
    private String componentId;
    private String eventId;
    private String eventLabel;
    private String targetId;
    private String targetLabel;
    private String summary;
    private String instruction;
    private String technicalContext;
    private String traceId;
    private String requestId;
}
