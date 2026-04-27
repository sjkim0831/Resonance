package egovframework.com.feature.admin.dto.response;

import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class CodexExecutionHistoryResponse {

    private int totalCount;
    private List<CodexExecutionHistoryRow> items = new ArrayList<>();

    @Getter
    @Setter
    public static class CodexExecutionHistoryRow {
        private String logId;
        private String executedAt;
        private String requestId;
        private String actorUserId;
        private String actorAuthorCode;
        private String actorInsttId;
        private String companyId;
        private String targetApiPath;
        private String pageCode;
        private String pageMenuUrl;
        private String executionStatus;
        private Integer httpStatus;
        private int createdCount;
        private int existingCount;
        private int skippedCount;
        private int issueCount;
        private String issueSummary;
        private boolean companyContextOk;
        private boolean pageMapped;
        private boolean menuMapped;
        private boolean featuresMapped;
        private boolean commonCodesMapped;
        private boolean authorMappingsOk;
        private boolean targetApiMapped;
        private List<String> issues = new ArrayList<>();
        private String requestJson;
    }
}
