package egovframework.com.platform.request.workbench;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class SrTicketCreateRequest {

    private String ticketId;
    private String pageId;
    private String pageLabel;
    private String routePath;
    private String menuCode;
    private String menuLookupUrl;
    private String surfaceId;
    private String surfaceLabel;
    private String eventId;
    private String eventLabel;
    private String targetId;
    private String targetLabel;
    private String summary;
    private String instruction;
    private String technicalContext;
    private String generatedDirection;
    private String commandPrompt;
    private List<String> stackItemIds;
}
