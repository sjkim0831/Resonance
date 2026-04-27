package egovframework.com.platform.governance.dto;

public class AdminBackupRunRequestDTO {

    private String executionType;
    private String gitRestoreCommit;
    private String dbRestoreType;
    private String dbRestoreTarget;
    private String dbRestorePointInTime;
    private String sudoPassword;

    public String getExecutionType() { return executionType; }
    public void setExecutionType(String executionType) { this.executionType = executionType; }
    public String getGitRestoreCommit() { return gitRestoreCommit; }
    public void setGitRestoreCommit(String gitRestoreCommit) { this.gitRestoreCommit = gitRestoreCommit; }
    public String getDbRestoreType() { return dbRestoreType; }
    public void setDbRestoreType(String dbRestoreType) { this.dbRestoreType = dbRestoreType; }
    public String getDbRestoreTarget() { return dbRestoreTarget; }
    public void setDbRestoreTarget(String dbRestoreTarget) { this.dbRestoreTarget = dbRestoreTarget; }
    public String getDbRestorePointInTime() { return dbRestorePointInTime; }
    public void setDbRestorePointInTime(String dbRestorePointInTime) { this.dbRestorePointInTime = dbRestorePointInTime; }
    public String getSudoPassword() { return sudoPassword; }
    public void setSudoPassword(String sudoPassword) { this.sudoPassword = sudoPassword; }
}
