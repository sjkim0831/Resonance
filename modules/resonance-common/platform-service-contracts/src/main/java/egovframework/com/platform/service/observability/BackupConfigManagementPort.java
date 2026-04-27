package egovframework.com.platform.service.observability;

import egovframework.com.platform.request.observability.BackupConfigSaveRequest;
import egovframework.com.platform.request.observability.BackupRunRequest;
import egovframework.com.platform.request.observability.BackupVersionRestoreRequest;

import java.util.Map;

public interface BackupConfigManagementPort {

    Map<String, Object> buildPageData(boolean isEn);

    Map<String, Object> save(BackupConfigSaveRequest requestBody, String actorId, boolean isEn);

    Map<String, Object> restoreVersion(BackupVersionRestoreRequest requestBody, String actorId, boolean isEn);

    Map<String, Object> run(BackupRunRequest requestBody, String actorId, boolean isEn);
}
