package egovframework.com.platform.service.observability;

public class CurrentUserContextSnapshot {

    private String userId = "";
    private String authorCode = "";
    private String insttId = "";

    public String getUserId() {
        return userId;
    }

    public void setUserId(String userId) {
        this.userId = userId == null ? "" : userId;
    }

    public String getAuthorCode() {
        return authorCode;
    }

    public void setAuthorCode(String authorCode) {
        this.authorCode = authorCode == null ? "" : authorCode;
    }

    public String getInsttId() {
        return insttId;
    }

    public void setInsttId(String insttId) {
        this.insttId = insttId == null ? "" : insttId;
    }
}
