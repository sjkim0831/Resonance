package egovframework.com.platform.workbench.model;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SrWorkbenchStackItemVO {

    private String stackItemId;
    private String createdAt;
    private String updatedAt;
    private String createdBy;
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

    public void setStackItemId(String stackItemId) { this.stackItemId = stackItemId; }
    public void setCreatedAt(String createdAt) { this.createdAt = createdAt; }
    public void setUpdatedAt(String updatedAt) { this.updatedAt = updatedAt; }
    public void setCreatedBy(String createdBy) { this.createdBy = createdBy; }
    public void setPageId(String pageId) { this.pageId = pageId; }
    public void setPageLabel(String pageLabel) { this.pageLabel = pageLabel; }
    public void setRoutePath(String routePath) { this.routePath = routePath; }
    public void setMenuCode(String menuCode) { this.menuCode = menuCode; }
    public void setMenuLookupUrl(String menuLookupUrl) { this.menuLookupUrl = menuLookupUrl; }
    public void setSurfaceId(String surfaceId) { this.surfaceId = surfaceId; }
    public void setSurfaceLabel(String surfaceLabel) { this.surfaceLabel = surfaceLabel; }
    public void setSelector(String selector) { this.selector = selector; }
    public void setComponentId(String componentId) { this.componentId = componentId; }
    public void setEventId(String eventId) { this.eventId = eventId; }
    public void setEventLabel(String eventLabel) { this.eventLabel = eventLabel; }
    public void setTargetId(String targetId) { this.targetId = targetId; }
    public void setTargetLabel(String targetLabel) { this.targetLabel = targetLabel; }
    public void setSummary(String summary) { this.summary = summary; }
    public void setInstruction(String instruction) { this.instruction = instruction; }
    public void setTechnicalContext(String technicalContext) { this.technicalContext = technicalContext; }
    public void setTraceId(String traceId) { this.traceId = traceId; }
    public void setRequestId(String requestId) { this.requestId = requestId; }
}
