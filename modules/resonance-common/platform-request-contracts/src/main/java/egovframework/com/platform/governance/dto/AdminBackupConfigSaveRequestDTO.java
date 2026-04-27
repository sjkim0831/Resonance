package egovframework.com.platform.governance.dto;

public class AdminBackupConfigSaveRequestDTO {

    private String backupRootPath;
    private String retentionDays;
    private String cronExpression;
    private String offsiteSyncEnabled;

    private String gitEnabled;
    private String gitRepositoryPath;
    private String gitRemoteName;
    private String gitRemoteUrl;
    private String gitUsername;
    private String gitAuthToken;
    private String gitBranchPattern;
    private String gitBundlePrefix;
    private String gitBackupMode;
    private String gitRestoreBranchPrefix;
    private String gitTagPrefix;

    private String dbEnabled;
    private String dbHost;
    private String dbPort;
    private String dbName;
    private String dbUser;
    private String dbDumpCommand;
    private String dbSchemaScope;
    private String dbPromotionDataPolicy;
    private String dbDiffExecutionPreset;
    private String dbApplyLocalDiffYn;
    private String dbForceDestructiveDiffYn;
    private String dbFailOnUntrackedDestructiveDiffYn;
    private String dbRequirePatchHistoryYn;
    private String versionMemo;

    public String getBackupRootPath() { return backupRootPath; }
    public void setBackupRootPath(String backupRootPath) { this.backupRootPath = backupRootPath; }
    public String getRetentionDays() { return retentionDays; }
    public void setRetentionDays(String retentionDays) { this.retentionDays = retentionDays; }
    public String getCronExpression() { return cronExpression; }
    public void setCronExpression(String cronExpression) { this.cronExpression = cronExpression; }
    public String getOffsiteSyncEnabled() { return offsiteSyncEnabled; }
    public void setOffsiteSyncEnabled(String offsiteSyncEnabled) { this.offsiteSyncEnabled = offsiteSyncEnabled; }
    public String getGitEnabled() { return gitEnabled; }
    public void setGitEnabled(String gitEnabled) { this.gitEnabled = gitEnabled; }
    public String getGitRepositoryPath() { return gitRepositoryPath; }
    public void setGitRepositoryPath(String gitRepositoryPath) { this.gitRepositoryPath = gitRepositoryPath; }
    public String getGitRemoteName() { return gitRemoteName; }
    public void setGitRemoteName(String gitRemoteName) { this.gitRemoteName = gitRemoteName; }
    public String getGitRemoteUrl() { return gitRemoteUrl; }
    public void setGitRemoteUrl(String gitRemoteUrl) { this.gitRemoteUrl = gitRemoteUrl; }
    public String getGitUsername() { return gitUsername; }
    public void setGitUsername(String gitUsername) { this.gitUsername = gitUsername; }
    public String getGitAuthToken() { return gitAuthToken; }
    public void setGitAuthToken(String gitAuthToken) { this.gitAuthToken = gitAuthToken; }
    public String getGitBranchPattern() { return gitBranchPattern; }
    public void setGitBranchPattern(String gitBranchPattern) { this.gitBranchPattern = gitBranchPattern; }
    public String getGitBundlePrefix() { return gitBundlePrefix; }
    public void setGitBundlePrefix(String gitBundlePrefix) { this.gitBundlePrefix = gitBundlePrefix; }
    public String getGitBackupMode() { return gitBackupMode; }
    public void setGitBackupMode(String gitBackupMode) { this.gitBackupMode = gitBackupMode; }
    public String getGitRestoreBranchPrefix() { return gitRestoreBranchPrefix; }
    public void setGitRestoreBranchPrefix(String gitRestoreBranchPrefix) { this.gitRestoreBranchPrefix = gitRestoreBranchPrefix; }
    public String getGitTagPrefix() { return gitTagPrefix; }
    public void setGitTagPrefix(String gitTagPrefix) { this.gitTagPrefix = gitTagPrefix; }
    public String getDbEnabled() { return dbEnabled; }
    public void setDbEnabled(String dbEnabled) { this.dbEnabled = dbEnabled; }
    public String getDbHost() { return dbHost; }
    public void setDbHost(String dbHost) { this.dbHost = dbHost; }
    public String getDbPort() { return dbPort; }
    public void setDbPort(String dbPort) { this.dbPort = dbPort; }
    public String getDbName() { return dbName; }
    public void setDbName(String dbName) { this.dbName = dbName; }
    public String getDbUser() { return dbUser; }
    public void setDbUser(String dbUser) { this.dbUser = dbUser; }
    public String getDbDumpCommand() { return dbDumpCommand; }
    public void setDbDumpCommand(String dbDumpCommand) { this.dbDumpCommand = dbDumpCommand; }
    public String getDbSchemaScope() { return dbSchemaScope; }
    public void setDbSchemaScope(String dbSchemaScope) { this.dbSchemaScope = dbSchemaScope; }
    public String getDbPromotionDataPolicy() { return dbPromotionDataPolicy; }
    public void setDbPromotionDataPolicy(String dbPromotionDataPolicy) { this.dbPromotionDataPolicy = dbPromotionDataPolicy; }
    public String getDbDiffExecutionPreset() { return dbDiffExecutionPreset; }
    public void setDbDiffExecutionPreset(String dbDiffExecutionPreset) { this.dbDiffExecutionPreset = dbDiffExecutionPreset; }
    public String getDbApplyLocalDiffYn() { return dbApplyLocalDiffYn; }
    public void setDbApplyLocalDiffYn(String dbApplyLocalDiffYn) { this.dbApplyLocalDiffYn = dbApplyLocalDiffYn; }
    public String getDbForceDestructiveDiffYn() { return dbForceDestructiveDiffYn; }
    public void setDbForceDestructiveDiffYn(String dbForceDestructiveDiffYn) { this.dbForceDestructiveDiffYn = dbForceDestructiveDiffYn; }
    public String getDbFailOnUntrackedDestructiveDiffYn() { return dbFailOnUntrackedDestructiveDiffYn; }
    public void setDbFailOnUntrackedDestructiveDiffYn(String dbFailOnUntrackedDestructiveDiffYn) { this.dbFailOnUntrackedDestructiveDiffYn = dbFailOnUntrackedDestructiveDiffYn; }
    public String getDbRequirePatchHistoryYn() { return dbRequirePatchHistoryYn; }
    public void setDbRequirePatchHistoryYn(String dbRequirePatchHistoryYn) { this.dbRequirePatchHistoryYn = dbRequirePatchHistoryYn; }
    public String getVersionMemo() { return versionMemo; }
    public void setVersionMemo(String versionMemo) { this.versionMemo = versionMemo; }
}
