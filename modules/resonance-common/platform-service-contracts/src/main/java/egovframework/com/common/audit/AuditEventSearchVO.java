package egovframework.com.common.audit;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AuditEventSearchVO {

    private int firstIndex;
    private int recordCountPerPage;
    private String projectId;
    private String traceId;
    private String actorId;
    private String actionCode;
    private String menuCode;
    private String pageId;
    private String resultStatus;
    private String searchKeyword;

    public void setFirstIndex(int firstIndex) {
        this.firstIndex = firstIndex;
    }

    public void setRecordCountPerPage(int recordCountPerPage) {
        this.recordCountPerPage = recordCountPerPage;
    }

    public String getProjectId() {
        return projectId;
    }

    public void setProjectId(String projectId) {
        this.projectId = projectId;
    }

    public void setActionCode(String actionCode) {
        this.actionCode = actionCode;
    }

    public void setMenuCode(String menuCode) {
        this.menuCode = menuCode;
    }

    public void setPageId(String pageId) {
        this.pageId = pageId;
    }

    public void setResultStatus(String resultStatus) {
        this.resultStatus = resultStatus;
    }
}
