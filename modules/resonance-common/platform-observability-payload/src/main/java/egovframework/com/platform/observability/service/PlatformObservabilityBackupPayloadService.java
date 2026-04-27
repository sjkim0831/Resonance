package egovframework.com.platform.observability.service;

import egovframework.com.platform.request.observability.BackupConfigSaveRequest;
import egovframework.com.platform.request.observability.BackupRunRequest;
import egovframework.com.platform.request.observability.BackupVersionRestoreRequest;
import egovframework.com.platform.service.observability.BackupConfigManagementPort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
@RequiredArgsConstructor
public class PlatformObservabilityBackupPayloadService {

    private final BackupConfigManagementPort backupConfigManagementPort;

    public Map<String, Object> buildBackupConfigPagePayload(boolean isEn) {
        return backupConfigManagementPort.buildPageData(isEn);
    }

    public Map<String, Object> saveBackupConfigPayload(BackupConfigSaveRequest requestBody, String actorId, boolean isEn) {
        return backupConfigManagementPort.save(requestBody, actorId, isEn);
    }

    public Map<String, Object> restoreBackupConfigVersionPayload(BackupVersionRestoreRequest requestBody, String actorId, boolean isEn) {
        return backupConfigManagementPort.restoreVersion(requestBody, actorId, isEn);
    }

    public Map<String, Object> runBackupPayload(BackupRunRequest requestBody, String actorId, boolean isEn) {
        return backupConfigManagementPort.run(requestBody, actorId, isEn);
    }
}
