package egovframework.com.feature.admin.dto.request;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AdminUnifiedLogSearchRequestDTO {

    private Integer pageIndex;
    private Integer pageSize;
    private String tab;
    private String logType;
    private String detailType;
    private String projectId;
    private String resultCode;
    private String actorId;
    private String actorRole;
    private String insttId;
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
    private String fromDate;
    private String toDate;
    private String searchKeyword;
}
