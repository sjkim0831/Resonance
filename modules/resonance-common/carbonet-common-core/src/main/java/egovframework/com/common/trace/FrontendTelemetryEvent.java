package egovframework.com.common.trace;

import java.util.Map;

public class FrontendTelemetryEvent {

    private String traceId;
    private String requestId;
    private String pageId;
    private String locale;
    private String type;
    private String actionId;
    private String functionId;
    private String apiId;
    private String componentId;
    private String result;
    private Integer durationMs;
    private String occurredAt;
    private Map<String, Object> payloadSummary;

    public String getTraceId() { return traceId; }
    public void setTraceId(String traceId) { this.traceId = traceId; }
    public String getRequestId() { return requestId; }
    public void setRequestId(String requestId) { this.requestId = requestId; }
    public String getPageId() { return pageId; }
    public void setPageId(String pageId) { this.pageId = pageId; }
    public String getLocale() { return locale; }
    public void setLocale(String locale) { this.locale = locale; }
    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
    public String getActionId() { return actionId; }
    public void setActionId(String actionId) { this.actionId = actionId; }
    public String getFunctionId() { return functionId; }
    public void setFunctionId(String functionId) { this.functionId = functionId; }
    public String getApiId() { return apiId; }
    public void setApiId(String apiId) { this.apiId = apiId; }
    public String getComponentId() { return componentId; }
    public void setComponentId(String componentId) { this.componentId = componentId; }
    public String getResult() { return result; }
    public void setResult(String result) { this.result = result; }
    public Integer getDurationMs() { return durationMs; }
    public void setDurationMs(Integer durationMs) { this.durationMs = durationMs; }
    public String getOccurredAt() { return occurredAt; }
    public void setOccurredAt(String occurredAt) { this.occurredAt = occurredAt; }
    public Map<String, Object> getPayloadSummary() { return payloadSummary; }
    public void setPayloadSummary(Map<String, Object> payloadSummary) { this.payloadSummary = payloadSummary; }
}
