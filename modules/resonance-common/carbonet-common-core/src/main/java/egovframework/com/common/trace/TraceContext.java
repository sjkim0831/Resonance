package egovframework.com.common.trace;

public class TraceContext {

    private final String traceId;
    private final String requestId;
    private final String pageId;
    private final String actionId;
    private final String apiId;
    private final String requestUri;
    private final String httpMethod;

    private TraceContext(Builder builder) {
        this.traceId = builder.traceId;
        this.requestId = builder.requestId;
        this.pageId = builder.pageId;
        this.actionId = builder.actionId;
        this.apiId = builder.apiId;
        this.requestUri = builder.requestUri;
        this.httpMethod = builder.httpMethod;
    }

    public static Builder builder() {
        return new Builder();
    }

    public String getTraceId() { return traceId; }
    public String getRequestId() { return requestId; }
    public String getPageId() { return pageId; }
    public String getActionId() { return actionId; }
    public String getApiId() { return apiId; }
    public String getRequestUri() { return requestUri; }
    public String getHttpMethod() { return httpMethod; }

    public static final class Builder {
        private String traceId;
        private String requestId;
        private String pageId;
        private String actionId;
        private String apiId;
        private String requestUri;
        private String httpMethod;

        public Builder traceId(String traceId) { this.traceId = traceId; return this; }
        public Builder requestId(String requestId) { this.requestId = requestId; return this; }
        public Builder pageId(String pageId) { this.pageId = pageId; return this; }
        public Builder actionId(String actionId) { this.actionId = actionId; return this; }
        public Builder apiId(String apiId) { this.apiId = apiId; return this; }
        public Builder requestUri(String requestUri) { this.requestUri = requestUri; return this; }
        public Builder httpMethod(String httpMethod) { this.httpMethod = httpMethod; return this; }

        public TraceContext build() {
            return new TraceContext(this);
        }
    }
}
