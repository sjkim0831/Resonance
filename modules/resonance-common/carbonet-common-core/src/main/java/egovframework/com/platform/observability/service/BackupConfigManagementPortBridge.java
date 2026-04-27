package egovframework.com.platform.observability.service;

import egovframework.com.platform.governance.dto.AdminBackupConfigSaveRequestDTO;
import egovframework.com.platform.governance.dto.AdminBackupRunRequestDTO;
import egovframework.com.feature.admin.dto.request.AdminBackupVersionRestoreRequestDTO;
import egovframework.com.platform.governance.service.BackupConfigManagementService;
import egovframework.com.platform.request.observability.BackupConfigSaveRequest;
import egovframework.com.platform.request.observability.BackupRunRequest;
import egovframework.com.platform.request.observability.BackupVersionRestoreRequest;
import egovframework.com.platform.service.observability.BackupConfigManagementPort;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class BackupConfigManagementPortBridge implements BackupConfigManagementPort {

    private final BackupConfigManagementService delegate;

    public BackupConfigManagementPortBridge(BackupConfigManagementService delegate) {
        this.delegate = delegate;
    }

    @Override
    public Map<String, Object> buildPageData(boolean isEn) {
        return delegate.buildPageData(isEn);
    }

    @Override
    public Map<String, Object> save(BackupConfigSaveRequest requestBody, String actorId, boolean isEn) {
        return delegate.save(toLegacy(requestBody), actorId, isEn);
    }

    @Override
    public Map<String, Object> restoreVersion(BackupVersionRestoreRequest requestBody, String actorId, boolean isEn) {
        return delegate.restoreVersion(requestBody == null ? null : requestBody.getVersionId(), actorId, isEn);
    }

    @Override
    public Map<String, Object> run(BackupRunRequest requestBody, String actorId, boolean isEn) {
        return delegate.run(toLegacy(requestBody), actorId, isEn);
    }

    private AdminBackupConfigSaveRequestDTO toLegacy(BackupConfigSaveRequest requestBody) {
        AdminBackupConfigSaveRequestDTO legacy = new AdminBackupConfigSaveRequestDTO();
        if (requestBody == null) {
            return legacy;
        }
        legacy.setBackupRootPath(requestBody.getBackupRootPath());
        legacy.setRetentionDays(requestBody.getRetentionDays());
        legacy.setCronExpression(requestBody.getCronExpression());
        legacy.setOffsiteSyncEnabled(requestBody.getOffsiteSyncEnabled());
        legacy.setGitEnabled(requestBody.getGitEnabled());
        legacy.setGitRepositoryPath(requestBody.getGitRepositoryPath());
        legacy.setGitRemoteName(requestBody.getGitRemoteName());
        legacy.setGitRemoteUrl(requestBody.getGitRemoteUrl());
        legacy.setGitUsername(requestBody.getGitUsername());
        legacy.setGitAuthToken(requestBody.getGitAuthToken());
        legacy.setGitBranchPattern(requestBody.getGitBranchPattern());
        legacy.setGitBundlePrefix(requestBody.getGitBundlePrefix());
        legacy.setGitBackupMode(requestBody.getGitBackupMode());
        legacy.setGitRestoreBranchPrefix(requestBody.getGitRestoreBranchPrefix());
        legacy.setGitTagPrefix(requestBody.getGitTagPrefix());
        legacy.setDbEnabled(requestBody.getDbEnabled());
        legacy.setDbHost(requestBody.getDbHost());
        legacy.setDbPort(requestBody.getDbPort());
        legacy.setDbName(requestBody.getDbName());
        legacy.setDbUser(requestBody.getDbUser());
        legacy.setDbDumpCommand(requestBody.getDbDumpCommand());
        legacy.setDbSchemaScope(requestBody.getDbSchemaScope());
        legacy.setDbPromotionDataPolicy(requestBody.getDbPromotionDataPolicy());
        legacy.setDbDiffExecutionPreset(requestBody.getDbDiffExecutionPreset());
        legacy.setDbApplyLocalDiffYn(requestBody.getDbApplyLocalDiffYn());
        legacy.setDbForceDestructiveDiffYn(requestBody.getDbForceDestructiveDiffYn());
        legacy.setDbFailOnUntrackedDestructiveDiffYn(requestBody.getDbFailOnUntrackedDestructiveDiffYn());
        legacy.setDbRequirePatchHistoryYn(requestBody.getDbRequirePatchHistoryYn());
        legacy.setVersionMemo(requestBody.getVersionMemo());
        return legacy;
    }

    private AdminBackupRunRequestDTO toLegacy(BackupRunRequest requestBody) {
        AdminBackupRunRequestDTO legacy = new AdminBackupRunRequestDTO();
        if (requestBody == null) {
            return legacy;
        }
        legacy.setExecutionType(requestBody.getExecutionType());
        legacy.setGitRestoreCommit(requestBody.getGitRestoreCommit());
        legacy.setDbRestoreType(requestBody.getDbRestoreType());
        legacy.setDbRestoreTarget(requestBody.getDbRestoreTarget());
        legacy.setDbRestorePointInTime(requestBody.getDbRestorePointInTime());
        legacy.setSudoPassword(requestBody.getSudoPassword());
        return legacy;
    }
}
