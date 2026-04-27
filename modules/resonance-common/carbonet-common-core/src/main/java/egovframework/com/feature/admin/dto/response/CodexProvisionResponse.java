package egovframework.com.feature.admin.dto.response;

import java.util.ArrayList;
import java.util.List;

public class CodexProvisionResponse {

    private String status;
    private String requestId;
    private String actorId;
    private String logId;
    private String inspectionStatus;
    private boolean securityMetadataReloaded;
    private int createdCount;
    private int existingCount;
    private int skippedCount;
    private List<String> issues = new ArrayList<>();
    private List<ResultItem> results = new ArrayList<>();

    public void addResult(String category, String key, String status, String message) {
        ResultItem item = new ResultItem();
        item.setCategory(category);
        item.setKey(key);
        item.setStatus(status);
        item.setMessage(message);
        results.add(item);
        if ("CREATED".equals(status)) {
            createdCount++;
        } else if ("EXISTING".equals(status)) {
            existingCount++;
        } else {
            skippedCount++;
        }
    }

    public static class ResultItem {
        private String category;
        private String key;
        private String status;
        private String message;

        public String getCategory() { return category; }
        public void setCategory(String category) { this.category = category; }
        public String getKey() { return key; }
        public void setKey(String key) { this.key = key; }
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }
    }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getRequestId() { return requestId; }
    public void setRequestId(String requestId) { this.requestId = requestId; }
    public String getActorId() { return actorId; }
    public void setActorId(String actorId) { this.actorId = actorId; }
    public String getLogId() { return logId; }
    public void setLogId(String logId) { this.logId = logId; }
    public String getInspectionStatus() { return inspectionStatus; }
    public void setInspectionStatus(String inspectionStatus) { this.inspectionStatus = inspectionStatus; }
    public boolean isSecurityMetadataReloaded() { return securityMetadataReloaded; }
    public void setSecurityMetadataReloaded(boolean securityMetadataReloaded) { this.securityMetadataReloaded = securityMetadataReloaded; }
    public int getCreatedCount() { return createdCount; }
    public void setCreatedCount(int createdCount) { this.createdCount = createdCount; }
    public int getExistingCount() { return existingCount; }
    public void setExistingCount(int existingCount) { this.existingCount = existingCount; }
    public int getSkippedCount() { return skippedCount; }
    public void setSkippedCount(int skippedCount) { this.skippedCount = skippedCount; }
    public List<String> getIssues() { return issues; }
    public void setIssues(List<String> issues) { this.issues = issues == null ? new ArrayList<>() : issues; }
    public List<ResultItem> getResults() { return results; }
    public void setResults(List<ResultItem> results) { this.results = results == null ? new ArrayList<>() : results; }
}
