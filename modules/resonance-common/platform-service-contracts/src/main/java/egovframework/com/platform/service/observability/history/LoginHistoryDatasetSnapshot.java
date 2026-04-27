package egovframework.com.platform.service.observability.history;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

public class LoginHistoryDatasetSnapshot {

    private List<LoginHistoryRowSnapshot> rows = new ArrayList<>();
    private int totalCount;
    private String keyword = "";
    private String normalizedUserSe = "";
    private String normalizedLoginResult = "";
    private List<Map<String, String>> companyOptions = new ArrayList<>();
    private String selectedInsttId = "";
    private boolean masterAccess;

    public List<LoginHistoryRowSnapshot> getRows() { return rows; }
    public void setRows(List<LoginHistoryRowSnapshot> rows) { this.rows = rows == null ? new ArrayList<>() : new ArrayList<>(rows); }
    public int getTotalCount() { return totalCount; }
    public void setTotalCount(int totalCount) { this.totalCount = totalCount; }
    public String getKeyword() { return keyword; }
    public void setKeyword(String keyword) { this.keyword = keyword == null ? "" : keyword; }
    public String getNormalizedUserSe() { return normalizedUserSe; }
    public void setNormalizedUserSe(String normalizedUserSe) { this.normalizedUserSe = normalizedUserSe == null ? "" : normalizedUserSe; }
    public String getNormalizedLoginResult() { return normalizedLoginResult; }
    public void setNormalizedLoginResult(String normalizedLoginResult) { this.normalizedLoginResult = normalizedLoginResult == null ? "" : normalizedLoginResult; }
    public List<Map<String, String>> getCompanyOptions() { return companyOptions; }
    public void setCompanyOptions(List<Map<String, String>> companyOptions) { this.companyOptions = companyOptions == null ? new ArrayList<>() : new ArrayList<>(companyOptions); }
    public String getSelectedInsttId() { return selectedInsttId; }
    public void setSelectedInsttId(String selectedInsttId) { this.selectedInsttId = selectedInsttId == null ? "" : selectedInsttId; }
    public boolean isMasterAccess() { return masterAccess; }
    public void setMasterAccess(boolean masterAccess) { this.masterAccess = masterAccess; }
}
