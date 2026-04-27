package egovframework.com.feature.admin.dto.response;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AdminUnifiedLogRowResponse {

    private String logId;
    private String logType;
    private String detailType;
    private String projectId;
    private String occurredAt;
    private String resultCode;
    private String actorId;
    private String actorRole;
    private String insttId;
    private String companyName;
    private String memberType;
    private String menuCode;
    private String pageId;
    private String componentId;
    private String functionId;
    private String apiId;
    private String actionCode;
    private String targetType;
    private String targetId;
    private String traceId;
    private String requestUri;
    private String remoteAddr;
    private Integer durationMs;
    private String summary;
    private String message;
    private String rawSourceType;
}
