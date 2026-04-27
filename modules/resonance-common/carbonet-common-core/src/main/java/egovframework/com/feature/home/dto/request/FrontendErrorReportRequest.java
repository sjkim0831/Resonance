package egovframework.com.feature.home.dto.request;

import lombok.Data;

@Data
public class FrontendErrorReportRequest {
    private String errorType;
    private String fingerprint;
    private String message;
    private String stack;
    private String componentStack;
    private String pageId;
    private String timestamp;
    private String userAgent;
    private String url;
    private Integer line;
    private Integer col;
}
