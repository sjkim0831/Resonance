package egovframework.com.platform.codex.model;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class CodexExecutionLog {

    private String logId;
    private String executedAt;
    private String requestId;
    private String actorUserId;
    private String actorAuthorCode;
    private String actorInsttId;
    private String companyId;
    private String targetApiPath;
    private String menuType;
    private String pageCode;
    private String pageMenuUrl;
    private Integer httpStatus;
    private String executionStatus;
    private String errorMessage;
    private int createdCount;
    private int existingCount;
    private int skippedCount;
    private String requestJson;
    private String responseJson;
}
