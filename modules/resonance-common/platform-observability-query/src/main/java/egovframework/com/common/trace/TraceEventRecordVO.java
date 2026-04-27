package egovframework.com.common.trace;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class TraceEventRecordVO {

    private String eventId;
    private String projectId;
    private String traceId;
    private String spanId;
    private String parentSpanId;
    private String eventType;
    private String pageId;
    private String componentId;
    private String functionId;
    private String apiId;
    private String resultCode;
    private Integer durationMs;
    private String payloadSummaryJson;
    private String createdAt;

    public String getEventId() {
        return eventId;
    }

    public String getProjectId() {
        return projectId;
    }

    public String getTraceId() {
        return traceId;
    }

    public String getSpanId() {
        return spanId;
    }

    public String getParentSpanId() {
        return parentSpanId;
    }

    public String getEventType() {
        return eventType;
    }

    public String getPageId() {
        return pageId;
    }

    public String getComponentId() {
        return componentId;
    }

    public String getFunctionId() {
        return functionId;
    }

    public String getApiId() {
        return apiId;
    }

    public String getResultCode() {
        return resultCode;
    }

    public Integer getDurationMs() {
        return durationMs;
    }

    public String getPayloadSummaryJson() {
        return payloadSummaryJson;
    }

    public String getCreatedAt() {
        return createdAt;
    }
}
