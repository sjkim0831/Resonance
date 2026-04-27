package egovframework.com.platform.governance.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.common.service.MaintenanceModeService;
import egovframework.com.platform.governance.dto.AdminBackupRunRequestDTO;
import egovframework.com.platform.governance.dto.AdminBackupConfigSaveRequestDTO;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.nio.file.attribute.PosixFilePermissions;
import java.time.LocalDateTime;
import java.time.Duration;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Base64;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class BackupConfigManagementService {

    private static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final long COMMAND_TIMEOUT_SECONDS = 300L;
    private static final long GIT_PUSH_TIMEOUT_SECONDS = 900L;
    private static final String SAFE_BACKUP_ROOT_PATH = "/tmp/carbonet-backup";
    private static final String ALLOWED_INTERNAL_BACKUP_ROOT = "var/backup-bundle";
    private static final String SQL_BACKUP_ROOT = "/opt/util/cubrid/11.2/backup/sql";
    private static final String PHYSICAL_BACKUP_ROOT = "/opt/util/cubrid/11.2/backup/physical";
    private static final String PITR_ARCHIVE_ROOT = "/opt/util/cubrid/11.2/data/com";
    private static final String CUBRID_STACK_DIR = "/opt/util/cubrid";
    private static final String CUBRID_COMPOSE_FILE = "/opt/util/cubrid/docker-compose.yml";
    private static final String CUBRID_DOCKER_SERVICE = "cubrid";
    private static final String HOST_BACKUP_MOUNT_ROOT = "/opt/util/cubrid/11.2/backup";
    private static final String CONTAINER_BACKUP_MOUNT_ROOT = "/opt/util/cubrid/backup";
    private static final String PHYSICAL_RESTORE_STAGING_ROOT = "/opt/util/cubrid/11.2/backup/.restore-staging";
    private static final int VERSION_HISTORY_LIMIT = 20;
    private static final int MAX_JOB_LOG_LINES = 200;
    private static final List<String> GIT_CLEANUP_PATHS = Arrays.asList(
            "var/backup",
            "var/backups",
            "BOOT-INF",
            "target",
            "frontend/test-results",
            "frontend/.codex-state"
    );
    private static final List<String> GIT_COMMIT_BLOCKED_PREFIXES = Arrays.asList(
            "data/backup-config/",
            "var/",
            "target/",
            "BOOT-INF/",
            "frontend/node_modules/",
            "frontend/dist/",
            "frontend/test-results/",
            "frontend/.codex-state/"
    );
    private static final long GITHUB_FILE_SIZE_LIMIT_BYTES = 100L * 1024L * 1024L;
    private static final List<Pattern> SECRET_PATTERNS = Arrays.asList(
            Pattern.compile("ghp_[A-Za-z0-9]{20,}"),
            Pattern.compile("github_pat_[A-Za-z0-9_]{20,}"),
            Pattern.compile("gho_[A-Za-z0-9]{20,}"),
            Pattern.compile("ghu_[A-Za-z0-9]{20,}"),
            Pattern.compile("ghs_[A-Za-z0-9]{20,}"),
            Pattern.compile("-----BEGIN (?:RSA|OPENSSH|EC|DSA) PRIVATE KEY-----")
    );
    private final ObjectMapper objectMapper;
    private final egovframework.com.common.context.ProjectRuntimeContext projectRuntimeContext;
    private final MaintenanceModeService maintenanceModeService;
    private final Path documentPath = Paths.get("data", "backup-config", "settings.json");
    private final Path jobLogDirectory = Paths.get("data", "backup-config", "jobs");
    private final Path deployAutomationEnvPath = Paths.get("ops", "config", "deploy-automation.env");
    private final ConcurrentMap<String, BackupExecutionJob> jobs = new ConcurrentHashMap<>();
    private final ExecutorService backupExecutionExecutor = Executors.newSingleThreadExecutor(runnable -> {
        Thread thread = new Thread(runnable, "carbonet-backup-execution");
        thread.setDaemon(true);
        return thread;
    });

    public synchronized Map<String, Object> buildPageData(boolean isEn) {
        BackupConfigDocument document = loadDocument();
        BackupSettings settings = document.settings == null ? defaultSettings() : document.settings;
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("isEn", isEn);
        payload.put("canUseBackupConfigSave", true);
        payload.put("canUseBackupExecution", "Y".equalsIgnoreCase(safe(settings.dbEnabled)) || "Y".equalsIgnoreCase(safe(settings.gitEnabled)));
        payload.put("canUseDbBackupExecution", "Y".equalsIgnoreCase(safe(settings.dbEnabled)));
        payload.put("canUseGitBackupExecution", "Y".equalsIgnoreCase(safe(settings.gitEnabled)));
        payload.put("backupConfigSummary", buildSummary(settings, document, isEn));
        payload.put("backupConfigForm", buildForm(settings));
        payload.put("backupStorageRows", buildStorageRows(settings, isEn));
        payload.put("backupExecutionRows", buildExecutionRows(document, isEn));
        payload.put("backupVersionRows", buildVersionRows(document, isEn));
        payload.put("backupGitPrecheckRows", buildGitPrecheckRows(settings, isEn));
        payload.put("backupRestoreGitRows", buildRestoreGitRows(settings, isEn));
        payload.put("backupRestoreSqlRows", buildRestoreSqlRows(isEn));
        payload.put("backupRestorePhysicalRows", buildRestorePhysicalRows(isEn));
        payload.put("backupRestorePitrInfo", buildRestorePitrInfo(settings, isEn));
        payload.put("backupRecoveryPlaybooks", buildPlaybooks(isEn));
        payload.put("backupCurrentJob", buildCurrentJobPayload(isEn));
        payload.put("backupRecentJobs", buildRecentJobPayloads(isEn));
        return payload;
    }

    public synchronized Map<String, Object> save(AdminBackupConfigSaveRequestDTO request, String actorId, boolean isEn) {
        BackupConfigDocument document = loadDocument();
        BackupSettings settings = normalizeSettings(request, document.settings == null ? defaultSettings() : document.settings);
        document.settings = settings;
        document.updatedAt = now();
        document.updatedBy = safe(actorId).isEmpty() ? "system" : safe(actorId);
        if (document.executionRows == null) {
            document.executionRows = new ArrayList<>();
        }
        document.executionRows.add(0, executionRow(
                document.updatedAt,
                isEn ? "Configuration Save" : "설정 저장",
                isEn ? "Success" : "성공",
                "instant",
                isEn ? "Git/DB backup settings updated" : "Git/DB 백업 설정 갱신"));
        if (document.versionRows == null) {
            document.versionRows = new ArrayList<>();
        }
        document.versionRows.add(0, versionRow(
                "cfg-" + UUID.randomUUID().toString().substring(0, 8),
                document.updatedAt,
                document.updatedBy,
                settings,
                safe(request == null ? null : request.getVersionMemo())));
        trim(document.executionRows, 20);
        trim(document.versionRows, VERSION_HISTORY_LIMIT);
        writeDocument(document);
        syncDeployAutomationEnv(settings);

        Map<String, Object> payload = buildPageData(isEn);
        payload.put("backupConfigUpdated", true);
        payload.put("backupConfigMessage", isEn ? "Backup settings have been saved." : "백업 설정이 저장되었습니다.");
        return payload;
    }

    public synchronized Map<String, Object> restoreVersion(String versionId, String actorId, boolean isEn) {
        String normalizedVersionId = safe(versionId);
        if (normalizedVersionId.isEmpty()) {
            throw new IllegalArgumentException(isEn ? "Version ID is required." : "복원할 버전 ID가 필요합니다.");
        }
        BackupConfigDocument document = loadDocument();
        Map<String, String> targetVersion = (document.versionRows == null ? List.<Map<String, String>>of() : document.versionRows).stream()
                .filter(row -> normalizedVersionId.equals(safe(row.get("versionId"))))
                .findFirst()
                .orElse(null);
        if (targetVersion == null) {
            throw new IllegalArgumentException(isEn ? "The selected version was not found." : "선택한 버전을 찾을 수 없습니다.");
        }

        BackupSettings restoredSettings = restoreSettingsFromVersionRow(targetVersion, document.settings == null ? defaultSettings() : document.settings);
        document.settings = restoredSettings;
        document.updatedAt = now();
        document.updatedBy = safe(actorId).isEmpty() ? "system" : safe(actorId);
        if (document.executionRows == null) {
            document.executionRows = new ArrayList<>();
        }
        document.executionRows.add(0, executionRow(
                document.updatedAt,
                isEn ? "Version Restore" : "버전 복원",
                isEn ? "Success" : "성공",
                "instant",
                (isEn ? "Restored from version " : "버전 복원: ") + normalizedVersionId));
        if (document.versionRows == null) {
            document.versionRows = new ArrayList<>();
        }
        document.versionRows.add(0, versionRow(
                "cfg-" + UUID.randomUUID().toString().substring(0, 8),
                document.updatedAt,
                document.updatedBy,
                restoredSettings,
                (isEn ? "Restored from " : "복원본: ") + normalizedVersionId));
        trim(document.executionRows, 20);
        trim(document.versionRows, VERSION_HISTORY_LIMIT);
        writeDocument(document);
        syncDeployAutomationEnv(restoredSettings);

        Map<String, Object> payload = buildPageData(isEn);
        payload.put("backupConfigUpdated", true);
        payload.put("backupConfigMessage", isEn
                ? "Backup settings were restored from the selected version."
                : "선택한 버전 기준으로 백업 설정을 복원했습니다.");
        payload.put("restoredVersionId", normalizedVersionId);
        return payload;
    }

    public synchronized Map<String, Object> run(AdminBackupRunRequestDTO request, String actorId, boolean isEn) {
        BackupConfigDocument document = loadDocument();
        BackupSettings settings = document.settings == null ? defaultSettings() : document.settings;
        String executionType = safe(request == null ? null : request.getExecutionType()).toUpperCase(Locale.ROOT);
        if (!"DB".equals(executionType)
                && !"GIT".equals(executionType)
                && !"GIT_PRECHECK".equals(executionType)
                && !"GIT_CLEANUP_SAFE".equals(executionType)
                && !"GIT_BUNDLE".equals(executionType)
                && !"GIT_COMMIT_AND_PUSH_BASE".equals(executionType)
                && !"GIT_PUSH_BASE".equals(executionType)
                && !"GIT_PUSH_RESTORE".equals(executionType)
                && !"GIT_TAG_PUSH".equals(executionType)
                && !"GIT_RESTORE_COMMIT".equals(executionType)
                && !"DB_RESTORE_SQL".equals(executionType)
                && !"DB_RESTORE_PHYSICAL".equals(executionType)
                && !"DB_RESTORE_PITR".equals(executionType)) {
            throw new IllegalArgumentException(isEn ? "Unsupported backup execution type." : "지원하지 않는 백업 실행 유형입니다.");
        }

        BackupExecutionJob activeJob = findActiveJob();
        if (activeJob != null) {
            Map<String, Object> payload = buildPageData(isEn);
            payload.put("backupConfigUpdated", false);
            payload.put("backupConfigMessage", isEn
                    ? "Another backup job is already running. Check the live log below."
                    : "이미 실행 중인 백업 작업이 있습니다. 아래 실시간 로그를 확인하세요.");
            return payload;
        }

        BackupExecutionJob job = createJob(executionType, actorId, request, isEn);
        jobs.put(job.jobId, job);
        appendJobLog(job, isEn ? "Queued backup job." : "백업 작업을 대기열에 등록했습니다.");
        backupExecutionExecutor.submit(() -> executeJob(job.jobId, actorId, isEn));

        Map<String, Object> payload = buildPageData(isEn);
        payload.put("backupConfigUpdated", true);
        payload.put("backupConfigMessage", isEn
                ? "Backup job started. Live status will refresh automatically."
                : "백업 작업을 시작했습니다. 상태와 로그가 자동으로 갱신됩니다.");
        payload.put("backupJobStarted", true);
        payload.put("backupJobId", job.jobId);
        return payload;
    }

    private BackupConfigDocument loadDocument() {
        if (!Files.exists(documentPath)) {
            BackupConfigDocument document = defaultDocument();
            writeDocument(document);
            return document;
        }
        try (InputStream inputStream = Files.newInputStream(documentPath)) {
            BackupConfigDocument document = objectMapper.readValue(inputStream, BackupConfigDocument.class);
            if (document == null) {
                return defaultDocument();
            }
            String originalBackupRootPath = document.settings == null ? "" : safe(document.settings.backupRootPath);
            String originalGitBackupMode = document.settings == null ? "" : safe(document.settings.gitBackupMode);
            if (document.settings == null) {
                document.settings = defaultSettings();
            } else {
                document.settings = mergeWithDefaults(document.settings);
            }
            if (document.executionRows == null) {
                document.executionRows = new ArrayList<>();
            }
            if (document.versionRows == null) {
                document.versionRows = new ArrayList<>();
            }
            if (!safe(document.settings.backupRootPath).equals(originalBackupRootPath)
                    || !safe(document.settings.gitBackupMode).equals(originalGitBackupMode)) {
                writeDocument(document);
            }
            return document;
        } catch (Exception ignored) {
            return defaultDocument();
        }
    }

    private void writeDocument(BackupConfigDocument document) {
        try {
            Files.createDirectories(documentPath.getParent());
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(documentPath.toFile(), document);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to write backup settings.", e);
        }
    }

    private void syncDeployAutomationEnv(BackupSettings settings) {
        try {
            Map<String, String> env = loadShellEnvFile(deployAutomationEnvPath);
            putIfNotBlank(env, "BACKUP_GIT_USERNAME", resolveConfiguredGitUsername(settings));
            putIfNotBlank(env, "BACKUP_GIT_AUTH_TOKEN", resolveConfiguredGitAuthToken(settings));
            putIfNotBlank(env, "GITHUB_TOKEN", resolveConfiguredGitAuthToken(settings));
            putIfNotBlank(env, "GIT_REMOTE_NAME", safe(settings == null ? null : settings.gitRemoteName));
            putIfNotBlank(env, "GIT_BRANCH", safe(settings == null ? null : settings.gitBranchPattern));
            putIfNotBlank(env, "REPO_URL", resolveConfiguredGitRemoteUrl(settings));
            putIfNotBlank(env, "DB_PROMOTION_DATA_POLICY", safe(settings == null ? null : settings.dbPromotionDataPolicy));
            putIfNotBlank(env, "DB_DIFF_EXECUTION_PRESET", safe(settings == null ? null : settings.dbDiffExecutionPreset));
            putIfNotBlank(env, "DB_APPLY_LOCAL_DIFF_YN", yn(settings == null ? null : settings.dbApplyLocalDiffYn));
            putIfNotBlank(env, "DB_FORCE_DESTRUCTIVE_DIFF_YN", yn(settings == null ? null : settings.dbForceDestructiveDiffYn));
            putIfNotBlank(env, "DB_FAIL_ON_UNTRACKED_DESTRUCTIVE_DIFF_YN", yn(settings == null ? null : settings.dbFailOnUntrackedDestructiveDiffYn));
            putIfNotBlank(env, "DB_REQUIRE_PATCH_HISTORY_YN", yn(settings == null ? null : settings.dbRequirePatchHistoryYn));
            writeShellEnvFile(deployAutomationEnvPath, env);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to sync deploy automation settings.", e);
        }
    }

    private Map<String, String> loadShellEnvFile(Path envPath) throws Exception {
        Map<String, String> env = new LinkedHashMap<String, String>();
        if (!Files.exists(envPath)) {
            return env;
        }
        List<String> lines = Files.readAllLines(envPath, StandardCharsets.UTF_8);
        for (String line : lines) {
            String trimmed = safe(line);
            if (trimmed.isEmpty() || trimmed.startsWith("#")) {
                continue;
            }
            int separator = trimmed.indexOf('=');
            if (separator <= 0) {
                continue;
            }
            String key = safe(trimmed.substring(0, separator));
            String rawValue = trimmed.substring(separator + 1).trim();
            env.put(key, unquoteShellValue(rawValue));
        }
        return env;
    }

    private void writeShellEnvFile(Path envPath, Map<String, String> env) throws Exception {
        Files.createDirectories(envPath.getParent());
        List<String> lines = new ArrayList<String>();
        lines.add("# Managed by BackupConfigManagementService");
        for (Map.Entry<String, String> entry : env.entrySet()) {
            lines.add(entry.getKey() + "=" + shellQuoteEnvValue(entry.getValue()));
        }
        Files.write(envPath, lines, StandardCharsets.UTF_8);
    }

    private void putIfNotBlank(Map<String, String> env, String key, String value) {
        String normalized = safe(value);
        if (normalized.isEmpty()) {
            return;
        }
        env.put(key, normalized);
    }

    private String shellQuoteEnvValue(String value) {
        return "'" + safe(value).replace("'", "'\"'\"'") + "'";
    }

    private String unquoteShellValue(String value) {
        String normalized = value == null ? "" : value.trim();
        if (normalized.length() >= 2 && normalized.startsWith("'") && normalized.endsWith("'")) {
            return normalized.substring(1, normalized.length() - 1).replace("'\"'\"'", "'");
        }
        if (normalized.length() >= 2 && normalized.startsWith("\"") && normalized.endsWith("\"")) {
            return normalized.substring(1, normalized.length() - 1);
        }
        return normalized;
    }

    private BackupConfigDocument defaultDocument() {
        BackupConfigDocument document = new BackupConfigDocument();
        document.settings = defaultSettings();
        document.updatedAt = now();
        document.updatedBy = "system";
        document.executionRows = new ArrayList<>();
        document.executionRows.add(executionRow("2026-03-25 02:00", "초기 시드", "성공", "instant", "초기 백업 설정 문서 생성"));
        document.versionRows = new ArrayList<>();
        document.versionRows.add(versionRow("cfg-seed", document.updatedAt, document.updatedBy, document.settings, "Initial seed"));
        return document;
    }

    private BackupSettings defaultSettings() {
        BackupSettings settings = new BackupSettings();
        settings.backupRootPath = SAFE_BACKUP_ROOT_PATH;
        settings.retentionDays = "35";
        settings.cronExpression = "0 0 2 * * *";
        settings.offsiteSyncEnabled = "Y";
        settings.gitEnabled = "Y";
        settings.gitRepositoryPath = "/opt/Resonance";
        settings.gitRemoteName = "origin";
        settings.gitRemoteUrl = "";
        settings.gitUsername = "";
        settings.gitAuthToken = "";
        settings.gitBranchPattern = "main";
        settings.gitBundlePrefix = "carbonet-src";
        settings.gitBackupMode = "PUSH_BASE_BRANCH";
        settings.gitRestoreBranchPrefix = "backup/restore";
        settings.gitTagPrefix = "backup";
        settings.dbEnabled = "Y";
        settings.dbHost = "127.0.0.1";
        settings.dbPort = "33000";
        settings.dbName = projectRuntimeContext.getProjectId();
        settings.dbUser = "dba";
        settings.dbDumpCommand = "/opt/util/cubrid/11.2/scripts/backup_sql.sh";
        settings.dbSchemaScope = "FULL";
        settings.dbPromotionDataPolicy = "CONTROLLED_REFERENCE_ONLY";
        settings.dbDiffExecutionPreset = "PATCH_WITH_DIFF";
        settings.dbApplyLocalDiffYn = "N";
        settings.dbForceDestructiveDiffYn = "N";
        settings.dbFailOnUntrackedDestructiveDiffYn = "Y";
        settings.dbRequirePatchHistoryYn = "Y";
        return settings;
    }

    private BackupSettings mergeWithDefaults(BackupSettings current) {
        BackupSettings defaults = defaultSettings();
        if (safe(current.backupRootPath).isEmpty()) current.backupRootPath = defaults.backupRootPath;
        if (safe(current.retentionDays).isEmpty()) current.retentionDays = defaults.retentionDays;
        if (safe(current.cronExpression).isEmpty()) current.cronExpression = defaults.cronExpression;
        if (safe(current.offsiteSyncEnabled).isEmpty()) current.offsiteSyncEnabled = defaults.offsiteSyncEnabled;
        if (safe(current.gitEnabled).isEmpty()) current.gitEnabled = defaults.gitEnabled;
        if (safe(current.gitRepositoryPath).isEmpty()) current.gitRepositoryPath = defaults.gitRepositoryPath;
        if (safe(current.gitRemoteName).isEmpty()) current.gitRemoteName = defaults.gitRemoteName;
        if (safe(current.gitRemoteUrl).isEmpty()) current.gitRemoteUrl = defaults.gitRemoteUrl;
        if (safe(current.gitUsername).isEmpty()) current.gitUsername = defaults.gitUsername;
        if (safe(current.gitAuthToken).isEmpty()) current.gitAuthToken = defaults.gitAuthToken;
        if (safe(current.gitBranchPattern).isEmpty()) current.gitBranchPattern = defaults.gitBranchPattern;
        if (safe(current.gitBundlePrefix).isEmpty()) current.gitBundlePrefix = defaults.gitBundlePrefix;
        if (safe(current.gitBackupMode).isEmpty()) current.gitBackupMode = defaults.gitBackupMode;
        if (safe(current.gitRestoreBranchPrefix).isEmpty()) current.gitRestoreBranchPrefix = defaults.gitRestoreBranchPrefix;
        if (safe(current.gitTagPrefix).isEmpty()) current.gitTagPrefix = defaults.gitTagPrefix;
        if (safe(current.dbEnabled).isEmpty()) current.dbEnabled = defaults.dbEnabled;
        if (safe(current.dbHost).isEmpty()) current.dbHost = defaults.dbHost;
        if (safe(current.dbPort).isEmpty()) current.dbPort = defaults.dbPort;
        if (safe(current.dbName).isEmpty()) current.dbName = defaults.dbName;
        if (safe(current.dbUser).isEmpty()) current.dbUser = defaults.dbUser;
        if (safe(current.dbDumpCommand).isEmpty()) current.dbDumpCommand = defaults.dbDumpCommand;
        if (safe(current.dbSchemaScope).isEmpty()) current.dbSchemaScope = defaults.dbSchemaScope;
        if (safe(current.dbPromotionDataPolicy).isEmpty()) current.dbPromotionDataPolicy = defaults.dbPromotionDataPolicy;
        if (safe(current.dbDiffExecutionPreset).isEmpty()) current.dbDiffExecutionPreset = defaults.dbDiffExecutionPreset;
        if (safe(current.dbApplyLocalDiffYn).isEmpty()) current.dbApplyLocalDiffYn = defaults.dbApplyLocalDiffYn;
        if (safe(current.dbForceDestructiveDiffYn).isEmpty()) current.dbForceDestructiveDiffYn = defaults.dbForceDestructiveDiffYn;
        if (safe(current.dbFailOnUntrackedDestructiveDiffYn).isEmpty()) current.dbFailOnUntrackedDestructiveDiffYn = defaults.dbFailOnUntrackedDestructiveDiffYn;
        if (safe(current.dbRequirePatchHistoryYn).isEmpty()) current.dbRequirePatchHistoryYn = defaults.dbRequirePatchHistoryYn;
        current.backupRootPath = sanitizeBackupRootPath(current.backupRootPath, current.gitRepositoryPath);
        current.gitBackupMode = sanitizeGitBackupMode(current.gitBackupMode);
        current.dbPromotionDataPolicy = sanitizeDbPromotionDataPolicy(current.dbPromotionDataPolicy);
        current.dbDiffExecutionPreset = sanitizeDbDiffExecutionPreset(current.dbDiffExecutionPreset);
        return current;
    }

    private BackupSettings normalizeSettings(AdminBackupConfigSaveRequestDTO request, BackupSettings currentSettings) {
        BackupSettings settings = new BackupSettings();
        settings.backupRootPath = safe(request == null ? null : request.getBackupRootPath());
        settings.retentionDays = safe(request == null ? null : request.getRetentionDays());
        settings.cronExpression = safe(request == null ? null : request.getCronExpression());
        settings.offsiteSyncEnabled = yn(request == null ? null : request.getOffsiteSyncEnabled());
        settings.gitEnabled = yn(request == null ? null : request.getGitEnabled());
        settings.gitRepositoryPath = safe(request == null ? null : request.getGitRepositoryPath());
        settings.gitRemoteName = safe(request == null ? null : request.getGitRemoteName());
        settings.gitRemoteUrl = safe(request == null ? null : request.getGitRemoteUrl());
        settings.gitUsername = safe(request == null ? null : request.getGitUsername());
        settings.gitAuthToken = safe(request == null ? null : request.getGitAuthToken());
        settings.gitBranchPattern = safe(request == null ? null : request.getGitBranchPattern());
        settings.gitBundlePrefix = safe(request == null ? null : request.getGitBundlePrefix());
        settings.gitBackupMode = safe(request == null ? null : request.getGitBackupMode()).toUpperCase(Locale.ROOT);
        settings.gitRestoreBranchPrefix = safe(request == null ? null : request.getGitRestoreBranchPrefix());
        settings.gitTagPrefix = safe(request == null ? null : request.getGitTagPrefix());
        settings.dbEnabled = yn(request == null ? null : request.getDbEnabled());
        settings.dbHost = safe(request == null ? null : request.getDbHost());
        settings.dbPort = safe(request == null ? null : request.getDbPort());
        settings.dbName = safe(request == null ? null : request.getDbName());
        settings.dbUser = safe(request == null ? null : request.getDbUser());
        settings.dbDumpCommand = sanitizeDbDumpCommand(safe(request == null ? null : request.getDbDumpCommand()));
        settings.dbSchemaScope = safe(request == null ? null : request.getDbSchemaScope()).toUpperCase(Locale.ROOT);
        settings.dbPromotionDataPolicy = safe(request == null ? null : request.getDbPromotionDataPolicy()).toUpperCase(Locale.ROOT);
        settings.dbDiffExecutionPreset = safe(request == null ? null : request.getDbDiffExecutionPreset()).toUpperCase(Locale.ROOT);
        settings.dbApplyLocalDiffYn = yn(request == null ? null : request.getDbApplyLocalDiffYn());
        settings.dbForceDestructiveDiffYn = yn(request == null ? null : request.getDbForceDestructiveDiffYn());
        settings.dbFailOnUntrackedDestructiveDiffYn = yn(request == null ? null : request.getDbFailOnUntrackedDestructiveDiffYn());
        settings.dbRequirePatchHistoryYn = yn(request == null ? null : request.getDbRequirePatchHistoryYn());
        if (safe(settings.gitUsername).isEmpty()) {
            settings.gitUsername = safe(currentSettings == null ? null : currentSettings.gitUsername);
        }
        if (safe(settings.gitAuthToken).isEmpty()) {
            settings.gitAuthToken = safe(currentSettings == null ? null : currentSettings.gitAuthToken);
        }
        settings.backupRootPath = sanitizeBackupRootPath(settings.backupRootPath, settings.gitRepositoryPath);
        settings.gitBackupMode = sanitizeGitBackupMode(settings.gitBackupMode);
        settings.dbPromotionDataPolicy = sanitizeDbPromotionDataPolicy(settings.dbPromotionDataPolicy);
        settings.dbDiffExecutionPreset = sanitizeDbDiffExecutionPreset(settings.dbDiffExecutionPreset);
        return settings;
    }

    private String sanitizeDbDumpCommand(String command) {
        String normalized = safe(command);
        if (normalized.isEmpty()) {
            return "/opt/util/cubrid/11.2/scripts/backup_sql.sh";
        }
        return "/opt/util/cubrid/11.2/scripts/backup_sql.sh".equals(normalized)
                ? normalized
                : "/opt/util/cubrid/11.2/scripts/backup_sql.sh";
    }

    private List<Map<String, String>> buildSummary(BackupSettings settings, BackupConfigDocument document, boolean isEn) {
        return List.of(
                summaryCard(isEn ? "Backup Root" : "백업 루트", settings.backupRootPath,
                        isEn ? "All generated backup bundles are organized under the configured root path." : "생성되는 백업 번들은 설정된 루트 경로 아래에 정리됩니다.",
                        "text-[var(--kr-gov-blue)]"),
                summaryCard(isEn ? "Retention" : "보관 주기", safe(settings.retentionDays) + (isEn ? " days" : "일"),
                        isEn ? "Retention controls how long snapshot sets stay on local storage." : "로컬 저장소에 스냅샷 세트를 얼마나 보관할지 제어합니다.",
                        "text-emerald-600"),
                summaryCard(isEn ? "Schedule" : "크론 스케줄", settings.cronExpression,
                        isEn ? "Cron expression used by backup execution jobs." : "백업 실행 작업이 참조하는 크론 표현식입니다.",
                        "text-amber-600"),
                summaryCard(isEn ? "Last Updated" : "최근 저장", safe(document.updatedAt),
                        isEn ? "Latest administrator change applied to backup settings." : "최근 관리자에 의해 적용된 백업 설정 변경입니다.",
                        "text-violet-600")
        );
    }

    private Map<String, String> buildForm(BackupSettings settings) {
        Map<String, String> form = new LinkedHashMap<>();
        form.put("backupRootPath", safe(settings.backupRootPath));
        form.put("retentionDays", safe(settings.retentionDays));
        form.put("cronExpression", safe(settings.cronExpression));
        form.put("offsiteSyncEnabled", yn(settings.offsiteSyncEnabled));
        form.put("gitEnabled", yn(settings.gitEnabled));
        form.put("gitRepositoryPath", safe(settings.gitRepositoryPath));
        form.put("gitRemoteName", safe(settings.gitRemoteName));
        form.put("gitRemoteUrl", safe(settings.gitRemoteUrl));
        form.put("gitUsername", resolveConfiguredGitUsername(settings));
        form.put("gitAuthToken", "");
        form.put("gitAuthTokenMasked", maskSecret(resolveConfiguredGitAuthToken(settings)));
        form.put("gitAuthTokenConfigured", resolveConfiguredGitAuthToken(settings).isEmpty() ? "N" : "Y");
        form.put("gitBranchPattern", safe(settings.gitBranchPattern));
        form.put("gitBundlePrefix", safe(settings.gitBundlePrefix));
        form.put("gitBackupMode", safe(settings.gitBackupMode));
        form.put("gitRestoreBranchPrefix", safe(settings.gitRestoreBranchPrefix));
        form.put("gitTagPrefix", safe(settings.gitTagPrefix));
        form.put("dbEnabled", yn(settings.dbEnabled));
        form.put("dbHost", safe(settings.dbHost));
        form.put("dbPort", safe(settings.dbPort));
        form.put("dbName", safe(settings.dbName));
        form.put("dbUser", safe(settings.dbUser));
        form.put("dbDumpCommand", safe(settings.dbDumpCommand));
        form.put("dbSchemaScope", safe(settings.dbSchemaScope));
        form.put("dbPromotionDataPolicy", safe(settings.dbPromotionDataPolicy));
        form.put("dbDiffExecutionPreset", safe(settings.dbDiffExecutionPreset));
        form.put("dbApplyLocalDiffYn", yn(settings.dbApplyLocalDiffYn));
        form.put("dbForceDestructiveDiffYn", yn(settings.dbForceDestructiveDiffYn));
        form.put("dbFailOnUntrackedDestructiveDiffYn", yn(settings.dbFailOnUntrackedDestructiveDiffYn));
        form.put("dbRequirePatchHistoryYn", yn(settings.dbRequirePatchHistoryYn));
        form.put("versionMemo", "");
        return form;
    }

    private List<Map<String, String>> buildStorageRows(BackupSettings settings, boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<>();
        rows.add(storageRow(isEn ? "Backup Root" : "백업 루트", safe(settings.backupRootPath), isEn ? "Operator configured path" : "운영자 설정 경로", isEn ? "Primary backup bundle output" : "주 백업 번들 저장 위치"));
        rows.add(storageRow(isEn ? "Git Source" : "Git 소스", safe(settings.gitRepositoryPath), isEn ? "Git snapshot target" : "Git 스냅샷 대상", safe(settings.gitEnabled).equals("Y") ? (safe(settings.gitBackupMode).isEmpty() ? (isEn ? "Enabled" : "사용") : safe(settings.gitBackupMode)) : (isEn ? "Disabled" : "미사용")));
        rows.add(storageRow(isEn ? "Git Push Target" : "Git Push 대상", safe(settings.gitRemoteUrl).isEmpty() ? safe(settings.gitRemoteName) : safe(settings.gitRemoteUrl), isEn ? "Git remote target" : "Git 원격 대상", resolveConfiguredGitAuthToken(settings).isEmpty() ? (isEn ? "No token" : "토큰 없음") : (isEn ? "Token configured" : "토큰 설정됨")));
        rows.add(storageRow(isEn ? "Database Dump" : "DB 덤프", safe(settings.dbDumpCommand), isEn ? "DB export command" : "DB export 명령", safe(settings.dbEnabled).equals("Y") ? (isEn ? "Enabled" : "사용") : (isEn ? "Disabled" : "미사용")));
        return rows;
    }

    private List<Map<String, String>> buildExecutionRows(BackupConfigDocument document, boolean isEn) {
        if (document.executionRows == null || document.executionRows.isEmpty()) {
            return List.of(executionRow(now(), isEn ? "No execution" : "실행 이력 없음", isEn ? "Pending" : "대기", "-", isEn ? "Run a backup after saving settings." : "설정 저장 후 백업을 실행하세요."));
        }
        return document.executionRows;
    }

    private List<Map<String, String>> buildVersionRows(BackupConfigDocument document, boolean isEn) {
        List<Map<String, String>> rows = document.versionRows == null ? new ArrayList<>() : document.versionRows;
        if (rows.isEmpty()) {
            rows.add(versionRow("cfg-empty", now(), "system", defaultSettings(), ""));
        }
        return rows;
    }

    private List<Map<String, String>> buildGitPrecheckRows(BackupSettings settings, boolean isEn) {
        Path repoPath = Paths.get(safe(settings.gitRepositoryPath));
        if (!Files.exists(repoPath)) {
            return List.of(gitPrecheckRow("-", "-", "-", isEn ? "Repository path not found" : "저장소 경로를 찾을 수 없음"));
        }
        try {
            List<Map<String, String>> rows = new ArrayList<>();
            if (isBackupRootInsideRepository(settings)) {
                rows.add(gitPrecheckRow(
                        safe(settings.backupRootPath),
                        "-",
                        "-",
                        isEn
                                ? "Backup root is inside the Git repository. Move it outside the repo before bundle or push operations."
                                : "백업 루트가 Git 저장소 내부에 있습니다. 번들/Push 실행 전 저장소 외부 경로로 이동하세요."));
            }
            String output = runCommand(Arrays.asList("git", "-C", repoPath.toString(), "ls-tree", "-r", "--long", "HEAD"), isEn);
            rows.addAll(Arrays.stream(output.split("\n"))
                    .map(String::trim)
                    .filter(line -> !line.isEmpty())
                    .map(this::parseGitLsTreeRow)
                    .filter(row -> row != null && isCleanupCandidatePath(safe(row.get("path"))))
                    .sorted((left, right) -> Long.compare(parseLongSafe(safe(right.get("sizeBytes"))), parseLongSafe(safe(left.get("sizeBytes")))))
                    .limit(20)
                    .map(row -> gitPrecheckRow(
                            safe(row.get("path")),
                            formatBytes(parseLongSafe(safe(row.get("sizeBytes")))),
                            safe(row.get("objectId")),
                            isEn ? "Tracked artifact in cleanup scope" : "자동 정리 범위에 포함된 추적 산출물"))
                    .collect(Collectors.toList()));
            if (rows.isEmpty()) {
                rows.add(gitPrecheckRow("-", "-", "-", isEn ? "No tracked backup/build artifacts detected." : "추적 중인 백업/빌드 산출물이 없습니다."));
            }
            return rows;
        } catch (Exception e) {
            return List.of(gitPrecheckRow("-", "-", "-", safe(e.getMessage()).isEmpty() ? (isEn ? "Git precheck failed." : "Git 사전 점검에 실패했습니다.") : safe(e.getMessage())));
        }
    }

    private List<Map<String, String>> buildRestoreGitRows(BackupSettings settings, boolean isEn) {
        Path repoPath = Paths.get(safe(settings.gitRepositoryPath));
        if (!Files.exists(repoPath)) {
            return List.of(restoreOptionRow("-", "-", "-", "-", isEn ? "Repository path not found." : "저장소 경로를 찾을 수 없습니다."));
        }
        try {
            String output = runCommand(Arrays.asList(
                    "git", "-C", repoPath.toString(), "log",
                    "--date=format:%Y-%m-%d %H:%M:%S",
                    "--pretty=format:%H|%h|%ad|%an|%s",
                    "-n", "20"), isEn);
            if (output.isEmpty()) {
                return List.of(restoreOptionRow("-", "-", "-", "-", isEn ? "No commit history found." : "커밋 이력이 없습니다."));
            }
            return Arrays.stream(output.split("\n"))
                    .map(String::trim)
                    .filter(line -> !line.isEmpty())
                    .map(line -> {
                        String[] parts = line.split("\\|", 5);
                        Map<String, String> row = new LinkedHashMap<>();
                        row.put("id", parts.length > 0 ? safe(parts[0]) : "");
                        row.put("shortId", parts.length > 1 ? safe(parts[1]) : "");
                        row.put("recordedAt", parts.length > 2 ? safe(parts[2]) : "");
                        row.put("owner", parts.length > 3 ? safe(parts[3]) : "");
                        row.put("note", parts.length > 4 ? safe(parts[4]) : "");
                        return row;
                    })
                    .collect(Collectors.toList());
        } catch (Exception e) {
            return List.of(restoreOptionRow("-", "-", "-", "-", safe(e.getMessage()).isEmpty() ? (isEn ? "Failed to load Git restore options." : "Git 복구 옵션을 불러오지 못했습니다.") : safe(e.getMessage())));
        }
    }

    private List<Map<String, String>> buildRestoreSqlRows(boolean isEn) {
        return buildBackupDirectoryRows(Paths.get(SQL_BACKUP_ROOT), 30, isEn,
                isEn ? "SQL backup snapshot" : "SQL 백업 스냅샷");
    }

    private List<Map<String, String>> buildRestorePhysicalRows(boolean isEn) {
        return buildBackupDirectoryRows(Paths.get(PHYSICAL_BACKUP_ROOT), 15, isEn,
                isEn ? "Physical backup snapshot" : "물리 백업 스냅샷");
    }

    private Map<String, String> buildRestorePitrInfo(BackupSettings settings, boolean isEn) {
        Map<String, String> row = new LinkedHashMap<>();
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime min = now.minusDays(2);
        row.put("windowStart", min.format(DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm")));
        row.put("windowEnd", now.format(DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm")));
        row.put("windowStartLabel", min.format(TIME_FORMAT));
        row.put("windowEndLabel", now.format(TIME_FORMAT));
        row.put("retentionLabel", isEn ? "Within last 2 days" : "최근 2일 이내");
        row.put("archiveRoot", PITR_ARCHIVE_ROOT);
        row.put("dbName", safe(settings.dbName));
        row.put("note", isEn
                ? "Point-in-time restore uses the latest eligible physical backup plus archived logs."
                : "시점 복구는 가장 최근의 물리 백업과 보관된 로그 아카이브를 함께 사용합니다.");
        return row;
    }

    private List<Map<String, String>> buildBackupDirectoryRows(Path rootPath, int retentionDays, boolean isEn, String noteLabel) {
        if (!Files.exists(rootPath)) {
            return List.of(restoreOptionRow("-", "-", "-", "-", isEn ? "Backup directory not found." : "백업 디렉터리를 찾을 수 없습니다."));
        }
        try {
            LocalDateTime cutoff = LocalDateTime.now().minusDays(retentionDays);
            List<Map<String, String>> rows = Files.list(rootPath)
                    .filter(Files::isDirectory)
                    .map(path -> toBackupDirectoryRow(path, noteLabel))
                    .filter(row -> !safe(row.get("id")).isEmpty())
                    .filter(row -> {
                        LocalDateTime recordedAt = parseBackupStamp(row.get("id"));
                        return recordedAt != null && !recordedAt.isBefore(cutoff);
                    })
                    .sorted((left, right) -> safe(right.get("id")).compareTo(safe(left.get("id"))))
                    .collect(Collectors.toList());
            if (rows.isEmpty()) {
                return List.of(restoreOptionRow("-", "-", "-", "-", isEn ? "No restore points available in retention window." : "보관 기간 내 복구 지점이 없습니다."));
            }
            return rows;
        } catch (Exception e) {
            return List.of(restoreOptionRow("-", "-", "-", "-", safe(e.getMessage()).isEmpty() ? (isEn ? "Failed to load restore points." : "복구 지점을 불러오지 못했습니다.") : safe(e.getMessage())));
        }
    }

    private Map<String, String> toBackupDirectoryRow(Path path, String noteLabel) {
        String id = path.getFileName() == null ? "" : safe(path.getFileName().toString());
        LocalDateTime recordedAt = parseBackupStamp(id);
        return restoreOptionRow(
                id,
                recordedAt == null ? id : recordedAt.format(TIME_FORMAT),
                path.toAbsolutePath().toString(),
                noteLabel,
                noteLabel);
    }

    private LocalDateTime parseBackupStamp(String value) {
        try {
            return LocalDateTime.parse(safe(value), DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
        } catch (Exception ignored) {
            return null;
        }
    }

    private List<Map<String, String>> buildPlaybooks(boolean isEn) {
        return List.of(
                playbookRow(isEn ? "Git Backup Flow" : "Git 백업 흐름",
                        isEn ? "Archive repository sources using the configured repository path, remote, and branch pattern." : "설정된 저장소 경로, remote, branch 패턴으로 소스 아카이브를 생성합니다."),
                playbookRow(isEn ? "Database Backup Flow" : "DB 백업 흐름",
                        isEn ? "Execute the configured dump command against the target host, port, and database." : "설정된 host, port, database를 대상으로 dump 명령을 실행합니다."),
                playbookRow(isEn ? "Restore Execution" : "복구 실행",
                        isEn ? "Git rollback creates a new rollback commit, while DB restore can target SQL, physical, or point-in-time recovery windows." : "Git 롤백은 새 롤백 커밋을 만들고, DB 복구는 SQL/물리/시점 복구 창을 기준으로 실행합니다."),
                playbookRow(isEn ? "Version Rollback" : "버전 롤백",
                        isEn ? "Use the latest saved configuration version before performing restore drills." : "복구 리허설 전 최신 저장 버전 설정을 기준으로 확인합니다.")
        );
    }

    private Map<String, String> summaryCard(String title, String value, String description, String toneClass) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("title", title);
        row.put("value", value);
        row.put("description", description);
        row.put("toneClass", toneClass);
        return row;
    }

    private Map<String, String> storageRow(String storageType, String location, String owner, String note) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("storageType", storageType);
        row.put("location", location);
        row.put("owner", owner);
        row.put("note", note);
        return row;
    }

    private Map<String, String> executionRow(String executedAt, String profileName, String result, String duration, String note) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("executedAt", executedAt);
        row.put("profileName", profileName);
        row.put("result", result);
        row.put("duration", duration);
        row.put("note", note);
        return row;
    }

    private Map<String, String> versionRow(String versionId, String savedAt, String savedBy, BackupSettings settings, String versionMemo) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("versionId", versionId);
        row.put("savedAt", savedAt);
        row.put("savedBy", savedBy);
        row.put("versionMemo", safe(versionMemo));
        row.put("backupRootPath", safe(settings == null ? null : settings.backupRootPath));
        row.put("cronExpression", safe(settings == null ? null : settings.cronExpression));
        row.put("retentionDays", safe(settings == null ? null : settings.retentionDays));
        row.put("offsiteSyncEnabled", yn(settings == null ? null : settings.offsiteSyncEnabled));
        row.put("gitEnabled", yn(settings == null ? null : settings.gitEnabled));
        row.put("gitRepositoryPath", safe(settings == null ? null : settings.gitRepositoryPath));
        row.put("gitRemoteName", safe(settings == null ? null : settings.gitRemoteName));
        row.put("gitRemoteUrl", safe(settings == null ? null : settings.gitRemoteUrl));
        row.put("gitUsername", safe(settings == null ? null : settings.gitUsername));
        row.put("gitBranchPattern", safe(settings == null ? null : settings.gitBranchPattern));
        row.put("gitBackupMode", safe(settings == null ? null : settings.gitBackupMode));
        row.put("gitBundlePrefix", safe(settings == null ? null : settings.gitBundlePrefix));
        row.put("gitRestoreBranchPrefix", safe(settings == null ? null : settings.gitRestoreBranchPrefix));
        row.put("gitTagPrefix", safe(settings == null ? null : settings.gitTagPrefix));
        row.put("gitSummary", buildGitVersionSummary(settings));
        row.put("dbEnabled", yn(settings == null ? null : settings.dbEnabled));
        row.put("dbHost", safe(settings == null ? null : settings.dbHost));
        row.put("dbPort", safe(settings == null ? null : settings.dbPort));
        row.put("dbName", safe(settings == null ? null : settings.dbName));
        row.put("dbUser", safe(settings == null ? null : settings.dbUser));
        row.put("dbDumpCommand", safe(settings == null ? null : settings.dbDumpCommand));
        row.put("dbSchemaScope", safe(settings == null ? null : settings.dbSchemaScope));
        row.put("dbPromotionDataPolicy", safe(settings == null ? null : settings.dbPromotionDataPolicy));
        row.put("dbDiffExecutionPreset", safe(settings == null ? null : settings.dbDiffExecutionPreset));
        row.put("dbApplyLocalDiffYn", yn(settings == null ? null : settings.dbApplyLocalDiffYn));
        row.put("dbForceDestructiveDiffYn", yn(settings == null ? null : settings.dbForceDestructiveDiffYn));
        row.put("dbFailOnUntrackedDestructiveDiffYn", yn(settings == null ? null : settings.dbFailOnUntrackedDestructiveDiffYn));
        row.put("dbRequirePatchHistoryYn", yn(settings == null ? null : settings.dbRequirePatchHistoryYn));
        row.put("dbSummary", buildDbVersionSummary(settings));
        return row;
    }

    private BackupSettings restoreSettingsFromVersionRow(Map<String, String> row, BackupSettings currentSettings) {
        BackupSettings settings = new BackupSettings();
        settings.backupRootPath = safe(row.get("backupRootPath"));
        settings.retentionDays = safe(row.get("retentionDays"));
        settings.cronExpression = safe(row.get("cronExpression"));
        settings.offsiteSyncEnabled = yn(row.get("offsiteSyncEnabled"));
        settings.gitEnabled = yn(row.get("gitEnabled"));
        settings.gitRepositoryPath = safe(row.get("gitRepositoryPath"));
        settings.gitRemoteName = safe(row.get("gitRemoteName"));
        settings.gitRemoteUrl = safe(row.get("gitRemoteUrl"));
        settings.gitUsername = safe(row.get("gitUsername"));
        settings.gitAuthToken = safe(currentSettings == null ? null : currentSettings.gitAuthToken);
        settings.gitBranchPattern = safe(row.get("gitBranchPattern"));
        settings.gitBundlePrefix = safe(row.get("gitBundlePrefix"));
        settings.gitBackupMode = safe(row.get("gitBackupMode"));
        settings.gitRestoreBranchPrefix = safe(row.get("gitRestoreBranchPrefix"));
        settings.gitTagPrefix = safe(row.get("gitTagPrefix"));
        settings.dbEnabled = yn(row.get("dbEnabled"));
        settings.dbHost = safe(row.get("dbHost"));
        settings.dbPort = safe(row.get("dbPort"));
        settings.dbName = safe(row.get("dbName"));
        settings.dbUser = safe(row.get("dbUser"));
        settings.dbDumpCommand = safe(row.get("dbDumpCommand"));
        settings.dbSchemaScope = safe(row.get("dbSchemaScope"));
        settings.dbPromotionDataPolicy = safe(row.get("dbPromotionDataPolicy"));
        settings.dbDiffExecutionPreset = safe(row.get("dbDiffExecutionPreset"));
        settings.dbApplyLocalDiffYn = yn(row.get("dbApplyLocalDiffYn"));
        settings.dbForceDestructiveDiffYn = yn(row.get("dbForceDestructiveDiffYn"));
        settings.dbFailOnUntrackedDestructiveDiffYn = yn(row.get("dbFailOnUntrackedDestructiveDiffYn"));
        settings.dbRequirePatchHistoryYn = yn(row.get("dbRequirePatchHistoryYn"));
        return mergeWithDefaults(settings);
    }

    private String buildGitVersionSummary(BackupSettings settings) {
        if (!"Y".equalsIgnoreCase(safe(settings == null ? null : settings.gitEnabled))) {
            return "미사용";
        }
        String remote = safe(settings == null ? null : settings.gitRemoteUrl);
        if (remote.isEmpty()) {
            remote = safe(settings == null ? null : settings.gitRemoteName);
        }
        return String.join(" | ",
                Arrays.asList(
                        safe(settings == null ? null : settings.gitBackupMode),
                        safe(settings == null ? null : settings.gitBranchPattern),
                        remote)
                        .stream()
                        .filter(value -> !safe(value).isEmpty())
                        .collect(Collectors.toList()));
    }

    private String buildDbVersionSummary(BackupSettings settings) {
        if (!"Y".equalsIgnoreCase(safe(settings == null ? null : settings.dbEnabled))) {
            return "미사용";
        }
        return String.join(" | ",
                Arrays.asList(
                        safe(settings == null ? null : settings.dbName),
                        safe(settings == null ? null : settings.dbHost) + ":" + safe(settings == null ? null : settings.dbPort),
                        safe(settings == null ? null : settings.dbSchemaScope),
                        safe(settings == null ? null : settings.dbPromotionDataPolicy),
                        safe(settings == null ? null : settings.dbDiffExecutionPreset))
                        .stream()
                        .map(this::safe)
                        .filter(value -> !value.isEmpty() && !":".equals(value))
                        .collect(Collectors.toList()));
    }

    private String sanitizeDbPromotionDataPolicy(String value) {
        String normalized = safe(value).toUpperCase(Locale.ROOT);
        if ("BUSINESS_WITH_OVERRIDE".equals(normalized) || "BUSINESS_ALLOWED".equals(normalized)) {
            return normalized;
        }
        return "CONTROLLED_REFERENCE_ONLY";
    }

    private String sanitizeDbDiffExecutionPreset(String value) {
        String normalized = safe(value).toUpperCase(Locale.ROOT);
        if ("PATCH_ONLY".equals(normalized) || "FULL_REMOTE_DEPLOY".equals(normalized)) {
            return normalized;
        }
        return "PATCH_WITH_DIFF";
    }

    private Map<String, String> playbookRow(String title, String body) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("title", title);
        row.put("body", body);
        return row;
    }

    private Map<String, String> restoreOptionRow(String id, String recordedAt, String path, String owner, String note) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("id", id);
        row.put("recordedAt", recordedAt);
        row.put("path", path);
        row.put("owner", owner);
        row.put("note", note);
        return row;
    }

    private String executeDatabaseBackup(BackupSettings settings, boolean isEn, Consumer<String> logger) throws Exception {
        logger.accept(isEn ? "Starting database backup command." : "DB 백업 명령을 시작합니다.");
        sanitizeDbDumpCommand(safe(settings.dbDumpCommand));
        ProcessBuilder builder = new ProcessBuilder("/opt/util/cubrid/11.2/scripts/backup_sql.sh");
        builder.directory(Paths.get(".").toAbsolutePath().normalize().toFile());
        builder.redirectErrorStream(true);
        Map<String, String> environment = builder.environment();
        environment.put("DB_NAME", safe(settings.dbName));
        environment.put("DB_USER", safe(settings.dbUser));
        environment.put("RETENTION_DAYS", safe(settings.retentionDays).isEmpty() ? "35" : safe(settings.retentionDays));
        CommandResult result = executeProcess(builder, COMMAND_TIMEOUT_SECONDS,
                isEn ? "Database backup command timed out." : "DB 백업 명령이 제한 시간 내에 완료되지 않았습니다.",
                logger);
        String output = result.output;
        if (result.exitCode != 0) {
            throw new IllegalStateException(output.isEmpty()
                    ? (isEn ? "Database backup command returned a non-zero exit code." : "DB 백업 명령이 비정상 종료되었습니다.")
                    : output);
        }
        if (output.isEmpty()) {
            return isEn ? "Database backup finished successfully." : "DB 백업이 정상적으로 완료되었습니다.";
        }
        return output;
    }

    private String executeGitRestore(BackupSettings settings, BackupExecutionJob job, boolean isEn, Consumer<String> logger) throws Exception {
        Path repoPath = Paths.get(safe(settings.gitRepositoryPath));
        if (!Files.exists(repoPath)) {
            throw new IllegalStateException(isEn ? "Git repository path does not exist." : "Git 저장소 경로가 존재하지 않습니다.");
        }
        String targetCommit = safe(job.parameters.get("gitRestoreCommit"));
        if (targetCommit.isEmpty()) {
            throw new IllegalStateException(isEn ? "Select a Git commit to restore." : "복구할 Git 커밋을 선택하세요.");
        }
        String remoteName = safe(settings.gitRemoteName).isEmpty() ? "origin" : safe(settings.gitRemoteName);
        String targetBranch = safe(settings.gitBranchPattern).isEmpty() ? "main" : safe(settings.gitBranchPattern);
        runCommand(Arrays.asList("git", "-C", repoPath.toString(), "cat-file", "-e", targetCommit + "^{commit}"), isEn, logger);
        Path worktreePath = Files.createTempDirectory("carbonet-git-restore-");
        try {
            logger.accept((isEn ? "Preparing temporary restore worktree: " : "임시 복구 작업트리를 준비합니다: ") + worktreePath);
            runCommand(Arrays.asList("git", "-C", repoPath.toString(), "worktree", "add", "--detach", worktreePath.toString(), "HEAD"), isEn, logger);
            String conflictBranch = syncLocalBranchForPush(settings, worktreePath, remoteName, targetBranch, isEn, logger);
            if (!conflictBranch.isEmpty()) {
                return "conflict-branch=" + conflictBranch;
            }
            logger.accept((isEn ? "Restoring repository state from commit: " : "선택한 커밋 상태로 복원합니다: ") + targetCommit);
            runCommand(Arrays.asList("git", "-C", worktreePath.toString(), "restore", "--source=" + targetCommit, "--staged", "--worktree", "--", "."), isEn, logger);
            String addedFiles = runCommand(Arrays.asList("git", "-C", worktreePath.toString(), "diff", "--name-only", "--diff-filter=A", targetCommit, "HEAD"), isEn);
            List<String> addedPaths = Arrays.stream(addedFiles.split("\n"))
                    .map(String::trim)
                    .filter(line -> !line.isEmpty())
                    .collect(Collectors.toList());
            if (!addedPaths.isEmpty()) {
                List<String> removeCommand = new ArrayList<>(Arrays.asList("git", "-C", worktreePath.toString(), "rm", "-f", "--ignore-unmatch", "--"));
                removeCommand.addAll(addedPaths);
                runCommand(removeCommand, isEn, logger);
            }
            if (resolveGitStatus(worktreePath, isEn).isEmpty()) {
                return isEn ? "Repository already matches selected commit." : "저장소가 이미 선택한 커밋과 동일합니다.";
            }
            String commitMessage = "restore: rollback source to " + targetCommit.substring(0, Math.min(7, targetCommit.length()));
            runCommand(Arrays.asList("git", "-C", worktreePath.toString(), "commit", "-m", commitMessage), isEn, logger);
            runGitPushCommand(Arrays.asList("git", "-C", worktreePath.toString(), "push", resolveGitPushTarget(settings, remoteName), "HEAD:refs/heads/" + targetBranch), settings, worktreePath, remoteName, isEn, logger);
            return "git-restore-commit=" + targetCommit + ", base-branch=" + targetBranch;
        } finally {
            try {
                runCommand(Arrays.asList("git", "-C", repoPath.toString(), "worktree", "remove", "--force", worktreePath.toString()), isEn, logger);
            } catch (Exception ignored) {
            }
            try {
                Files.deleteIfExists(worktreePath);
            } catch (Exception ignored) {
            }
        }
    }

    private String executeDatabaseRestore(BackupSettings settings, BackupExecutionJob job, boolean isEn, Consumer<String> logger) throws Exception {
        String sudoPassword = job.parameters.get("sudoPassword");
        RestorePrivilegeAccess restoreAccess = ensureRestorePrivilegeAvailable(sudoPassword, isEn, logger);
        String executionType = safe(job.executionType);
        if ("DB_RESTORE_SQL".equals(executionType)) {
            String targetDir = validateRestoreDirectory(job.parameters.get("dbRestoreTarget"), SQL_BACKUP_ROOT, 30, isEn,
                    isEn ? "Select a SQL backup snapshot within 30 days." : "30일 이내 SQL 백업 스냅샷을 선택하세요.");
            throw new IllegalStateException(buildManualSqlRestoreMessage(targetDir, isEn));
        }
        if ("DB_RESTORE_PHYSICAL".equals(executionType)) {
            String targetDir = validateRestoreDirectory(job.parameters.get("dbRestoreTarget"), PHYSICAL_BACKUP_ROOT, 15, isEn,
                    isEn ? "Select a physical backup snapshot within 15 days." : "15일 이내 물리 백업 스냅샷을 선택하세요.");
            logger.accept((isEn ? "Starting physical restore from: " : "물리 백업으로 복구를 시작합니다: ") + targetDir);
            return executePhysicalRestore(settings, job, isEn, logger, targetDir, null, sudoPassword, restoreAccess.useSudoForDocker, false);
        }
        if ("DB_RESTORE_PITR".equals(executionType)) {
            LocalDateTime restorePoint = parseRequestedRestorePoint(job.parameters.get("dbRestorePointInTime"), isEn);
            String backupDir = resolveNearestPhysicalBackupForPitr(restorePoint, isEn);
            logger.accept((isEn ? "Starting point-in-time restore to: " : "시점 복구를 시작합니다: ") + restorePoint.format(TIME_FORMAT));
            logger.accept((isEn ? "Base physical backup: " : "기준 물리 백업: ") + backupDir);
            return executePhysicalRestore(settings, job, isEn, logger, backupDir, restorePoint, sudoPassword, restoreAccess.useSudoForDocker, true);
        }
        throw new IllegalStateException(isEn ? "Unsupported database restore type." : "지원하지 않는 DB 복구 유형입니다.");
    }

    private String executePhysicalRestore(BackupSettings settings,
                                          BackupExecutionJob job,
                                          boolean isEn,
                                          Consumer<String> logger,
                                          String backupDir,
                                          LocalDateTime restorePoint,
                                          String sudoPassword,
                                          boolean useSudoForDocker,
                                          boolean runSqlBackupAfterRestore) throws Exception {
        Path stagedBackupDir = stagePhysicalRestoreBackup(backupDir, isEn, logger);
        try {
            return executeDatabaseRestoreWithMaintenance(job, isEn, logger, () -> {
                String restoreResult = runCommandWithInput(
                        Arrays.asList("bash", "-lc", buildPhysicalRestoreShell(settings, stagedBackupDir.toString(), restorePoint, sudoPassword, useSudoForDocker)),
                        sudoInput(sudoPassword),
                        isEn,
                        logger);
                if (runSqlBackupAfterRestore) {
                    logger.accept(isEn
                            ? "PITR finished. Running SQL backup to preserve the restored state."
                            : "PITR이 완료되어 복구 시점 상태 보존용 SQL 백업을 이어서 실행합니다.");
                    String backupResult = executeDatabaseBackup(settings, isEn, logger);
                    return restoreResult + "\n" + backupResult;
                }
                return restoreResult;
            });
        } finally {
            cleanupStagedPhysicalRestore(stagedBackupDir, logger);
        }
    }

    private String executeDatabaseRestoreWithMaintenance(BackupExecutionJob job, boolean isEn, Consumer<String> logger,
                                                         CheckedSupplier<String> restoreAction) throws Exception {
        String reason = isEn ? "Database restore in progress" : "데이터베이스 복구 진행 중";
        logger.accept(isEn ? "Switching the site to maintenance mode." : "사이트를 점검 모드로 전환합니다.");
        maintenanceModeService.activate(reason, safe(job.actorId));
        try {
            return restoreAction.get();
        } finally {
            maintenanceModeService.deactivate();
            logger.accept(isEn ? "Maintenance mode has been cleared." : "점검 모드를 해제했습니다.");
        }
    }

    private Path stagePhysicalRestoreBackup(String backupDir, boolean isEn, Consumer<String> logger) throws Exception {
        Path sourcePath = Paths.get(backupDir).toAbsolutePath().normalize();
        Path stagingRoot = Paths.get(PHYSICAL_RESTORE_STAGING_ROOT).toAbsolutePath().normalize();
        Files.createDirectories(stagingRoot);
        String stamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
        Path stagedPath = stagingRoot.resolve(stamp + "_" + sourcePath.getFileName());
        logger.accept((isEn ? "Copying physical backup to restore staging: " : "원본 물리 백업 보호를 위해 staging 복사본을 준비합니다: ") + stagedPath);
        runCommand(Arrays.asList("cp", "-a", sourcePath.toString(), stagedPath.toString()), isEn, logger);
        Path stagedVolume = stagedPath.resolve("carbonet_bk0v000");
        if (!Files.exists(stagedVolume)) {
            throw new IllegalStateException(isEn
                    ? "Staged physical backup is incomplete. Missing carbonet_bk0v000."
                    : "staging 물리 백업이 불완전합니다. carbonet_bk0v000 파일이 없습니다.");
        }
        return stagedPath;
    }

    private void cleanupStagedPhysicalRestore(Path stagedPath, Consumer<String> logger) {
        if (stagedPath == null) {
            return;
        }
        try {
            runCommand(Arrays.asList("rm", "-rf", stagedPath.toString()), true, logger);
        } catch (Exception ignored) {
        }
    }

    private String buildManualSqlRestoreMessage(String targetDir, boolean isEn) {
        if (isEn) {
            return "SQL restore is manual-only because large snapshots can exceed the web execution window. "
                    + "Use snapshot: " + targetDir
                    + ". Run the restore from the server shell and verify before reopening the site.";
        }
        return "SQL 복구는 대용량 스냅샷에서 웹 실행 시간 한계를 넘기기 쉬워 수동 복구 전용으로 전환되었습니다. "
                + "대상 스냅샷: " + targetDir
                + ". 서버 쉘에서 수동 복구 후 검증을 마친 뒤 사이트를 다시 열어 주세요.";
    }

    private String validateRestoreDirectory(String value, String rootPath, int retentionDays, boolean isEn, String emptyMessage) {
        String normalized = safe(value);
        if (normalized.isEmpty()) {
            throw new IllegalStateException(emptyMessage);
        }
        Path targetPath = Paths.get(normalized).toAbsolutePath().normalize();
        Path root = Paths.get(rootPath).toAbsolutePath().normalize();
        if (!targetPath.startsWith(root) || !Files.isDirectory(targetPath)) {
            throw new IllegalStateException(isEn ? "Selected restore snapshot is invalid." : "선택한 복구 스냅샷이 유효하지 않습니다.");
        }
        LocalDateTime stamp = parseBackupStamp(targetPath.getFileName() == null ? "" : targetPath.getFileName().toString());
        if (stamp == null || stamp.isBefore(LocalDateTime.now().minusDays(retentionDays))) {
            throw new IllegalStateException(isEn ? "Selected restore snapshot is outside the retention window." : "선택한 복구 스냅샷이 보관 기간을 벗어났습니다.");
        }
        return targetPath.toString();
    }

    private LocalDateTime parseRequestedRestorePoint(String value, boolean isEn) {
        try {
            LocalDateTime target = LocalDateTime.parse(safe(value), DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm"));
            LocalDateTime min = LocalDateTime.now().minusDays(2);
            LocalDateTime max = LocalDateTime.now();
            if (target.isBefore(min) || target.isAfter(max)) {
                throw new IllegalStateException(isEn ? "PITR target time must be within the last 2 days." : "PITR 대상 시각은 최근 2일 이내여야 합니다.");
            }
            return target;
        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalStateException(isEn ? "Enter a valid PITR target time." : "유효한 PITR 대상 시각을 입력하세요.");
        }
    }

    private String resolveNearestPhysicalBackupForPitr(LocalDateTime restorePoint, boolean isEn) throws Exception {
        Path root = Paths.get(PHYSICAL_BACKUP_ROOT);
        if (!Files.exists(root)) {
            throw new IllegalStateException(isEn ? "Physical backup root not found." : "물리 백업 루트를 찾을 수 없습니다.");
        }
        return Files.list(root)
                .filter(Files::isDirectory)
                .map(path -> new Object[]{path, parseBackupStamp(path.getFileName() == null ? "" : path.getFileName().toString())})
                .filter(entry -> entry[1] != null && !((LocalDateTime) entry[1]).isAfter(restorePoint))
                .sorted((left, right) -> ((LocalDateTime) right[1]).compareTo((LocalDateTime) left[1]))
                .map(entry -> ((Path) entry[0]).toAbsolutePath().toString())
                .findFirst()
                .orElseThrow(() -> new IllegalStateException(isEn ? "No physical backup is available before the requested PITR time." : "요청한 PITR 시각 이전의 물리 백업이 없습니다."));
    }

    private String buildPhysicalRestoreShell(BackupSettings settings, String backupDir, LocalDateTime restorePoint, String sudoPassword, boolean useSudoForDocker) {
        String timestampArg = restorePoint == null
                ? ""
                : " -d " + shellQuote(restorePoint.format(DateTimeFormatter.ofPattern("dd-MM-yyyy:HH:mm:ss")));
        String containerBackupDir = toContainerBackupPath(backupDir);
        String dbName = safe(settings.dbName).isEmpty() ? projectRuntimeContext.getProjectId() : safe(settings.dbName);
        return ""
                + "set -euo pipefail\n"
                + "BACKUP_DIR=" + shellQuote(backupDir) + "\n"
                + "CONTAINER_BACKUP_DIR=" + shellQuote(containerBackupDir) + "\n"
                + "DB_NAME=" + shellQuote(dbName) + "\n"
                + "SUDO_STDIN=\"\"\n"
                + "IFS= read -r SUDO_STDIN || true\n"
                + "echo \"backup dir: $BACKUP_DIR\"\n"
                + "echo \"db name: $DB_NAME\"\n"
                + (restorePoint == null ? "" : "echo \"restore point: " + restorePoint.format(TIME_FORMAT) + "\"\n")
                + buildDockerComposeExecCommand("cubrid server stop " + shellQuote(dbName) + " || true", sudoPassword, useSudoForDocker)
                + buildDockerComposeExecCommand("cubrid restoredb -u -B " + shellQuote(containerBackupDir) + timestampArg + " " + shellQuote(dbName), sudoPassword, useSudoForDocker)
                + buildDockerComposeExecCommand("cubrid server start " + shellQuote(dbName), sudoPassword, useSudoForDocker)
                + "sleep 2\n"
                + buildDockerComposeExecCommand("csql -u dba " + shellQuote(dbName) + " -c \"select count(*) from db_class;\"", sudoPassword, useSudoForDocker);
    }

    private String shellQuote(String value) {
        return "'" + safe(value).replace("'", "'\"'\"'") + "'";
    }

    private RestorePrivilegeAccess ensureRestorePrivilegeAvailable(String sudoPassword, boolean isEn, Consumer<String> logger) throws Exception {
        logger.accept(safe(sudoPassword).isEmpty()
                ? (isEn ? "Checking restore runtime access." : "복구 작업용 실행 권한을 확인합니다.")
                : (isEn ? "Checking sudo password for restore operations." : "복구 작업용 sudo 비밀번호를 확인합니다."));
        List<String> directDockerCommand = Arrays.asList("docker", "compose", "-f", CUBRID_COMPOSE_FILE, "ps", CUBRID_DOCKER_SERVICE);
        CommandResult directDockerResult = runRestoreAccessCommand(directDockerCommand, "", isEn, logger);
        if (directDockerResult.exitCode == 0) {
            return new RestorePrivilegeAccess(false);
        }
        ProcessBuilder builder = safe(sudoPassword).isEmpty()
                ? new ProcessBuilder("sudo", "-n", "docker", "compose", "-f", CUBRID_COMPOSE_FILE, "ps", CUBRID_DOCKER_SERVICE)
                : new ProcessBuilder("sudo", "-S", "-k", "-p", "", "docker", "compose", "-f", CUBRID_COMPOSE_FILE, "ps", CUBRID_DOCKER_SERVICE);
        builder.directory(Paths.get(".").toAbsolutePath().normalize().toFile());
        builder.redirectErrorStream(true);
        CommandResult result = executeProcess(builder, sudoInput(sudoPassword), COMMAND_TIMEOUT_SECONDS,
                isEn ? "restore runtime privilege check timed out." : "복구 실행 권한 확인이 제한 시간 내에 완료되지 않았습니다.",
                logger);
        if (result.exitCode != 0) {
            throw new IllegalStateException(safe(sudoPassword).isEmpty()
                    ? (isEn
                        ? "Restore requires Docker access or a sudo password. Add this account to the docker group or enter a sudo password and retry."
                        : "복구 실행에는 Docker 실행 권한 또는 sudo 비밀번호가 필요합니다. 현재 계정에 docker 권한을 부여하거나 sudo 비밀번호를 입력한 뒤 다시 시도하세요.")
                    : (isEn
                        ? "The provided sudo password is invalid."
                        : "입력한 sudo 비밀번호가 올바르지 않습니다."));
        }
        return new RestorePrivilegeAccess(true);
    }

    private CommandResult runRestoreAccessCommand(List<String> command, String stdin, boolean isEn, Consumer<String> logger) throws Exception {
        ProcessBuilder builder = new ProcessBuilder(command);
        builder.directory(Paths.get(".").toAbsolutePath().normalize().toFile());
        builder.redirectErrorStream(true);
        return executeProcess(builder, stdin, COMMAND_TIMEOUT_SECONDS,
                isEn ? "restore runtime access check timed out." : "복구 실행 권한 확인이 제한 시간 내에 완료되지 않았습니다.",
                message -> {
                });
    }

    private List<String> buildSqlRestoreCommand(String targetDir, String sudoPassword, boolean useSudoForDocker) {
        String containerBackupDir = toContainerBackupPath(targetDir);
        String dbName = projectRuntimeContext.getProjectId();
        String dbLocale = "ko_KR.utf8";
        return Arrays.asList("bash", "-lc",
                "set -euo pipefail\n"
                        + "BACKUP_DIR=" + shellQuote(targetDir) + "\n"
                        + "CONTAINER_BACKUP_DIR=" + shellQuote(containerBackupDir) + "\n"
                        + "DB_NAME=" + shellQuote(dbName) + "\n"
                        + "DB_LOCALE=" + shellQuote(dbLocale) + "\n"
                        + "SUDO_STDIN=\"\"\n"
                        + "IFS= read -r SUDO_STDIN || true\n"
                        + "SCHEMA_FILE=\"$(find \"$BACKUP_DIR\" -maxdepth 1 -type f -name '*_schema' | head -n 1)\"\n"
                        + "OBJECT_FILE=\"$(find \"$BACKUP_DIR\" -maxdepth 1 -type f -name '*_objects' | head -n 1)\"\n"
                        + "INDEX_FILE=\"$(find \"$BACKUP_DIR\" -maxdepth 1 -type f -name '*_indexes' | head -n 1)\"\n"
                        + "TRIGGER_FILE=\"$(find \"$BACKUP_DIR\" -maxdepth 1 -type f -name '*_trigger' | head -n 1)\"\n"
                        + "[[ -n \"$SCHEMA_FILE\" ]]\n"
                        + "SCHEMA_FILE_CONT=\"$CONTAINER_BACKUP_DIR/$(basename \"$SCHEMA_FILE\")\"\n"
                        + "OBJECT_FILE_CONT=\"\"\n"
                        + "INDEX_FILE_CONT=\"\"\n"
                        + "TRIGGER_FILE_CONT=\"\"\n"
                        + "if [[ -n \"$OBJECT_FILE\" ]]; then OBJECT_FILE_CONT=\"$CONTAINER_BACKUP_DIR/$(basename \"$OBJECT_FILE\")\"; fi\n"
                        + "if [[ -n \"$INDEX_FILE\" ]]; then INDEX_FILE_CONT=\"$CONTAINER_BACKUP_DIR/$(basename \"$INDEX_FILE\")\"; fi\n"
                        + "if [[ -n \"$TRIGGER_FILE\" ]]; then TRIGGER_FILE_CONT=\"$CONTAINER_BACKUP_DIR/$(basename \"$TRIGGER_FILE\")\"; fi\n"
                        + "echo \"backup dir: $BACKUP_DIR\"\n"
                        + "echo \"db name: $DB_NAME\"\n"
                        + buildDockerComposeExecCommand("cubrid server stop " + shellQuote(dbName) + " || true", sudoPassword, useSudoForDocker)
                        + buildDockerComposeExecCommand("cubrid deletedb -d " + shellQuote(dbName) + " || true", sudoPassword, useSudoForDocker)
                        + buildDockerComposeExecCommand("cubrid createdb --replace --server-name localhost -F \"$CUBRID_DATABASES/com\" -L \"$CUBRID_DATABASES/com\" -B \"$CUBRID_DATABASES/com/lob\" " + shellQuote(dbName) + " " + shellQuote(dbLocale), sudoPassword, useSudoForDocker)
                        + buildDockerComposeExecCommand("cubrid server start " + shellQuote(dbName), sudoPassword, useSudoForDocker)
                        + "sleep 2\n"
                        + "LOAD_CMD='cubrid loaddb -C -u dba --no-statistics -s \"$SCHEMA_FILE_CONT\"'\n"
                        + "if [[ -n \"$OBJECT_FILE_CONT\" ]]; then LOAD_CMD=\"$LOAD_CMD -d \\\"$OBJECT_FILE_CONT\\\"\"; fi\n"
                        + "if [[ -n \"$INDEX_FILE_CONT\" ]]; then LOAD_CMD=\"$LOAD_CMD -i \\\"$INDEX_FILE_CONT\\\"\"; fi\n"
                        + "if [[ -n \"$TRIGGER_FILE_CONT\" ]]; then LOAD_CMD=\"$LOAD_CMD --trigger-file \\\"$TRIGGER_FILE_CONT\\\"\"; fi\n"
                        + "LOAD_CMD=\"$LOAD_CMD " + dbName + "\"\n"
                        + buildDockerComposeExecCommand("eval \"$LOAD_CMD\"", sudoPassword, useSudoForDocker)
                        + buildDockerComposeExecCommand("cubrid broker restart", sudoPassword, useSudoForDocker)
                        + buildDockerComposeExecCommand("cubrid server restart " + shellQuote(dbName) + " || { cubrid server stop " + shellQuote(dbName) + " || true; cubrid server start " + shellQuote(dbName) + "; }", sudoPassword, useSudoForDocker)
                        + "sleep 2\n"
                        + buildDockerComposeExecCommand("csql -u dba " + shellQuote(dbName) + " -c \"select count(*) from db_class;\"", sudoPassword, useSudoForDocker));
    }

    private String sudoInput(String sudoPassword) {
        return safe(sudoPassword).isEmpty() ? "" : safe(sudoPassword) + "\n";
    }

    private String buildDockerComposeExecCommand(String innerCommand, String sudoPassword, boolean useSudoForDocker) {
        String dockerCommand = "docker compose -f " + shellQuote(CUBRID_COMPOSE_FILE)
                + " exec -T " + CUBRID_DOCKER_SERVICE + " sh -lc " + shellQuote(innerCommand);
        if (!useSudoForDocker) {
            return dockerCommand + "\n";
        }
        return ""
                + "if [[ -n \"$SUDO_STDIN\" ]]; then\n"
                + "printf '%s\\n' \"$SUDO_STDIN\" | sudo -S -k -p '' " + dockerCommand + "\n"
                + "else\n"
                + "sudo -n " + dockerCommand + "\n"
                + "fi\n";
    }

    private String toContainerBackupPath(String hostPath) {
        Path hostRoot = Paths.get(HOST_BACKUP_MOUNT_ROOT).toAbsolutePath().normalize();
        Path target = Paths.get(safe(hostPath)).toAbsolutePath().normalize();
        if (!target.startsWith(hostRoot)) {
            throw new IllegalStateException("Unsupported backup path: " + hostPath);
        }
        return CONTAINER_BACKUP_MOUNT_ROOT + "/" + hostRoot.relativize(target).toString().replace('\\', '/');
    }

    private String executeGitOperation(BackupSettings settings, String executionType, boolean isEn, Consumer<String> logger) throws Exception {
        if ("GIT_PRECHECK".equals(executionType)) {
            return executeGitPrecheck(settings, isEn);
        }
        if ("GIT_CLEANUP_SAFE".equals(executionType)) {
            return executeGitSafeCleanup(settings, isEn, logger);
        }
        return executeGitBackup(settings, executionType, isEn, logger);
    }

    private String executeGitPrecheck(BackupSettings settings, boolean isEn) {
        List<Map<String, String>> rows = buildGitPrecheckRows(settings, isEn);
        long riskyCount = rows.stream().filter(row -> !"-".equals(safe(row.get("path")))).count();
        return riskyCount == 0
                ? (isEn ? "No tracked backup/build artifacts detected." : "추적 중인 백업/빌드 산출물이 없습니다.")
                : (isEn ? "Tracked backup/build artifacts detected: " : "추적 중인 백업/빌드 산출물 감지: ") + riskyCount;
    }

    private String executeGitSafeCleanup(BackupSettings settings, boolean isEn, Consumer<String> logger) throws Exception {
        Path repoPath = Paths.get(safe(settings.gitRepositoryPath));
        if (!Files.exists(repoPath)) {
            throw new IllegalStateException(isEn ? "Git repository path does not exist." : "Git 저장소 경로가 존재하지 않습니다.");
        }
        logger.accept(isEn ? "Refreshing Git cleanup scope in index." : "Git 자동 정리 범위를 index에서 갱신합니다.");
        ensureGitignoreEntries(repoPath);
        List<String> removed = new ArrayList<>();
        for (String path : GIT_CLEANUP_PATHS) {
            try {
                runCommand(Arrays.asList("git", "-C", repoPath.toString(), "rm", "-r", "--cached", "--ignore-unmatch", path), isEn, logger);
                removed.add(path);
            } catch (Exception ignored) {
                removed.add(path);
            }
        }
        return (isEn ? "Cleanup scopes refreshed in index: " : "자동 정리 범위를 index에서 갱신했습니다: ") + String.join(", ", removed);
    }

    private String executeGitBackup(BackupSettings settings, String executionType, boolean isEn, Consumer<String> logger) throws Exception {
        String mode = resolveGitExecutionMode(settings, executionType);
        Path repoPath = Paths.get(safe(settings.gitRepositoryPath));
        if (!Files.exists(repoPath)) {
            throw new IllegalStateException(isEn ? "Git repository path does not exist." : "Git 저장소 경로가 존재하지 않습니다.");
        }
        validateGitExecutionSettings(settings, mode, isEn);
        GitPreflightReport preflight = buildGitPreflightReport(settings, repoPath, mode, isEn, logger);
        List<String> notes = new ArrayList<>();
        String stamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
        if ("BUNDLE".equals(mode) || "BUNDLE_AND_PUSH".equals(mode)) {
            logger.accept(isEn ? "Creating Git bundle snapshot." : "Git 번들 스냅샷을 생성합니다.");
            Files.createDirectories(Paths.get(safe(settings.backupRootPath)));
            String bundleName = (safe(settings.gitBundlePrefix).isEmpty() ? "carbonet-src" : safe(settings.gitBundlePrefix)) + "_" + stamp + ".bundle";
            Path bundlePath = Paths.get(safe(settings.backupRootPath), bundleName);
            runCommand(Arrays.asList("git", "-C", repoPath.toString(), "bundle", "create", bundlePath.toString(), "--all"), isEn, logger);
            notes.add("bundle=" + bundlePath);
        }
        if ("PUSH_RESTORE_BRANCH".equals(mode) || "BUNDLE_AND_PUSH".equals(mode)) {
            String remoteName = safe(settings.gitRemoteName).isEmpty() ? "origin" : safe(settings.gitRemoteName);
            String branchPrefix = safe(settings.gitRestoreBranchPrefix).isEmpty() ? "backup/restore" : safe(settings.gitRestoreBranchPrefix);
            String targetBranch = branchPrefix + "/" + stamp;
            String localHead = resolveLocalHeadSha(repoPath, isEn);
            logger.accept((isEn ? "Pushing restore branch: " : "복구 브랜치를 Push 합니다: ") + targetBranch);
            runGitPushCommand(Arrays.asList("git", "-C", repoPath.toString(), "push", resolveGitPushTarget(settings, remoteName), "HEAD:refs/heads/" + targetBranch), settings, repoPath, remoteName, isEn, logger);
            notes.add("restore-branch=" + targetBranch + ", head=" + localHead);
        }
        if ("PUSH_BASE_BRANCH".equals(mode)) {
            String remoteName = safe(settings.gitRemoteName).isEmpty() ? "origin" : safe(settings.gitRemoteName);
            String targetBranch = safe(settings.gitBranchPattern).isEmpty() ? "main" : safe(settings.gitBranchPattern);
            String conflictBranch = syncLocalBranchForPush(settings, repoPath, remoteName, targetBranch, isEn, logger);
            if (!conflictBranch.isEmpty()) {
                notes.add("conflict-branch=" + conflictBranch);
                return String.join(", ", notes);
            }
            String localHead = resolveLocalHeadSha(repoPath, isEn);
            String remoteHeadBefore = resolveRemoteBranchSha(repoPath, remoteName, targetBranch, isEn);
            logger.accept((isEn ? "Pushing base branch: " : "기준 브랜치를 Push 합니다: ") + targetBranch);
            runGitPushCommand(Arrays.asList("git", "-C", repoPath.toString(), "push", resolveGitPushTarget(settings, remoteName), "HEAD:refs/heads/" + targetBranch), settings, repoPath, remoteName, isEn, logger);
            String status = localHead.equals(remoteHeadBefore) ? "already-up-to-date" : "pushed";
            notes.add("base-branch=" + targetBranch + ", status=" + status + ", head=" + localHead);
        }
        if ("COMMIT_AND_PUSH_BASE_BRANCH".equals(mode)) {
            String remoteName = safe(settings.gitRemoteName).isEmpty() ? "origin" : safe(settings.gitRemoteName);
            String targetBranch = safe(settings.gitBranchPattern).isEmpty() ? "main" : safe(settings.gitBranchPattern);
            if (!preflight.allowedCommitPaths.isEmpty()) {
                executeGitSafeCleanup(settings, isEn, logger);
                logger.accept((isEn ? "Running git add for allowed paths: " : "허용된 경로만 git add 합니다: ") + String.join(", ", preflight.allowedCommitPaths));
                List<String> addCommand = new ArrayList<>(Arrays.asList("git", "-C", repoPath.toString(), "add", "--"));
                addCommand.addAll(preflight.allowedCommitPaths);
                runCommand(addCommand, isEn, logger);
                String commitMessage = "backup: snapshot " + LocalDateTime.now().format(TIME_FORMAT);
                logger.accept((isEn ? "Creating commit: " : "커밋을 생성합니다: ") + commitMessage);
                runCommand(Arrays.asList("git", "-C", repoPath.toString(), "commit", "-m", commitMessage), isEn, logger);
                notes.add("commit-created=true");
            } else {
                logger.accept(isEn ? "No allowed local changes detected. Skipping commit." : "허용된 로컬 변경사항이 없어 커밋을 생략합니다.");
                notes.add("commit-created=false");
            }
            String conflictBranch = syncLocalBranchForPush(settings, repoPath, remoteName, targetBranch, isEn, logger);
            if (!conflictBranch.isEmpty()) {
                notes.add("conflict-branch=" + conflictBranch);
                return String.join(", ", notes);
            }
            String localHead = resolveLocalHeadSha(repoPath, isEn);
            String remoteHeadBefore = resolveRemoteBranchSha(repoPath, remoteName, targetBranch, isEn);
            logger.accept((isEn ? "Pushing committed base branch: " : "커밋된 기준 브랜치를 Push 합니다: ") + targetBranch);
            runGitPushCommand(Arrays.asList("git", "-C", repoPath.toString(), "push", resolveGitPushTarget(settings, remoteName), "HEAD:refs/heads/" + targetBranch), settings, repoPath, remoteName, isEn, logger);
            String status = localHead.equals(remoteHeadBefore) ? "already-up-to-date" : "pushed";
            notes.add("base-branch=" + targetBranch + ", status=" + status + ", head=" + localHead);
        }
        if ("TAG_PUSH".equals(mode)) {
            String remoteName = safe(settings.gitRemoteName).isEmpty() ? "origin" : safe(settings.gitRemoteName);
            String tagPrefix = safe(settings.gitTagPrefix).isEmpty() ? "backup" : safe(settings.gitTagPrefix);
            String tagName = tagPrefix + "-" + stamp;
            logger.accept((isEn ? "Creating tag: " : "태그를 생성합니다: ") + tagName);
            runCommand(Arrays.asList("git", "-C", repoPath.toString(), "tag", tagName), isEn, logger);
            logger.accept((isEn ? "Pushing tag: " : "태그를 Push 합니다: ") + tagName);
            runGitPushCommand(Arrays.asList("git", "-C", repoPath.toString(), "push", resolveGitPushTarget(settings, remoteName), tagName), settings, repoPath, remoteName, isEn, logger);
            notes.add("tag=" + tagName + ", head=" + resolveLocalHeadSha(repoPath, isEn));
        }
        if (notes.isEmpty()) {
            throw new IllegalStateException(isEn ? "Git backup mode is not configured." : "Git 백업 모드가 설정되어 있지 않습니다.");
        }
        return String.join(", ", notes);
    }

    private String resolveGitExecutionMode(BackupSettings settings, String executionType) {
        if ("GIT_BUNDLE".equals(executionType)) {
            return "BUNDLE";
        }
        if ("GIT_PRECHECK".equals(executionType)) {
            return "PRECHECK";
        }
        if ("GIT_CLEANUP_SAFE".equals(executionType)) {
            return "CLEANUP_SAFE";
        }
        if ("GIT_COMMIT_AND_PUSH_BASE".equals(executionType)) {
            return "COMMIT_AND_PUSH_BASE_BRANCH";
        }
        if ("GIT_PUSH_BASE".equals(executionType)) {
            return "PUSH_BASE_BRANCH";
        }
        if ("GIT_PUSH_RESTORE".equals(executionType)) {
            return "PUSH_RESTORE_BRANCH";
        }
        if ("GIT_TAG_PUSH".equals(executionType)) {
            return "TAG_PUSH";
        }
        return safe(settings.gitBackupMode).isEmpty() ? "PUSH_BASE_BRANCH" : safe(settings.gitBackupMode).toUpperCase(Locale.ROOT);
    }

    private void validateGitExecutionSettings(BackupSettings settings, String mode, boolean isEn) {
        if (("BUNDLE".equals(mode) || "BUNDLE_AND_PUSH".equals(mode)) && isBackupRootInsideRepository(settings)) {
            throw new IllegalStateException(isEn
                    ? "Backup root must be outside the Git repository for bundle generation. Update the backup root path and retry."
                    : "번들 생성 시 백업 루트는 Git 저장소 외부 경로여야 합니다. 백업 루트 경로를 수정한 뒤 다시 시도하세요.");
        }
        if ("PUSH_RESTORE_BRANCH".equals(mode)
                || "BUNDLE_AND_PUSH".equals(mode)
                || "PUSH_BASE_BRANCH".equals(mode)
                || "COMMIT_AND_PUSH_BASE_BRANCH".equals(mode)
                || "TAG_PUSH".equals(mode)) {
            String remoteTarget = resolveGitPushTarget(settings, safe(settings.gitRemoteName).isEmpty() ? "origin" : safe(settings.gitRemoteName));
            boolean httpPush = remoteTarget.startsWith("http://") || remoteTarget.startsWith("https://");
            if (httpPush) {
                String username = resolveConfiguredGitUsername(settings);
                String token = resolveConfiguredGitAuthToken(settings);
                if (username.isEmpty()) {
                    username = inferUsernameFromRemoteUrl(remoteTarget);
                }
                if (token.isEmpty()) {
                    throw new IllegalStateException(isEn
                            ? "Git auth token is not configured. Save a Git token in Backup Settings before push."
                            : "Git 인증 토큰이 설정되지 않았습니다. 백업 설정에서 Git 토큰을 저장한 뒤 다시 Push 하세요.");
                }
                if (username.isEmpty()) {
                    throw new IllegalStateException(isEn
                            ? "Git username is not configured. Save a Git username in Backup Settings before push."
                            : "Git 사용자명이 설정되지 않았습니다. 백업 설정에서 Git 사용자명을 저장한 뒤 다시 Push 하세요.");
                }
            }
        }
    }

    private GitPreflightReport buildGitPreflightReport(BackupSettings settings, Path repoPath, String mode, boolean isEn, Consumer<String> logger) throws Exception {
        GitPreflightReport report = new GitPreflightReport();
        if (!"COMMIT_AND_PUSH_BASE_BRANCH".equals(mode)) {
            return report;
        }
        logger.accept(isEn ? "Running git preflight checks." : "Git 사전 점검을 실행합니다.");
        report.statusEntries = readGitStatusEntries(repoPath, isEn);
        report.disallowedPaths = report.statusEntries.stream()
                .map(entry -> entry.path)
                .filter(this::isCommitBlockedPath)
                .collect(Collectors.toList());
        if (!report.disallowedPaths.isEmpty()) {
            throw new IllegalStateException((isEn ? "Excluded local changes detected: " : "자동 커밋 제외 경로 변경이 감지되었습니다: ")
                    + String.join(", ", report.disallowedPaths));
        }
        report.allowedCommitPaths = report.statusEntries.stream()
                .map(entry -> entry.path)
                .filter(path -> !isCommitBlockedPath(path))
                .distinct()
                .collect(Collectors.toList());
        if (!report.allowedCommitPaths.isEmpty()) {
            report.secretPaths = scanSecretCandidatePaths(repoPath, report.allowedCommitPaths, isEn);
            if (!report.secretPaths.isEmpty()) {
                throw new IllegalStateException((isEn ? "Secret-like content detected in commit candidates: " : "커밋 후보 파일에서 secret 유사 문자열이 감지되었습니다: ")
                        + String.join(", ", report.secretPaths));
            }
            report.largePaths = scanLargeCommitCandidatePaths(repoPath, report.allowedCommitPaths);
            if (!report.largePaths.isEmpty()) {
                throw new IllegalStateException((isEn ? "Large tracked files exceed GitHub limit: " : "GitHub 제한을 초과하는 대용량 파일이 감지되었습니다: ")
                        + String.join(", ", report.largePaths));
            }
        }
        String remoteName = safe(settings.gitRemoteName).isEmpty() ? "origin" : safe(settings.gitRemoteName);
        String targetBranch = safe(settings.gitBranchPattern).isEmpty() ? "main" : safe(settings.gitBranchPattern);
        return report;
    }

    private String sanitizeBackupRootPath(String backupRootPath, String gitRepositoryPath) {
        String normalized = safe(backupRootPath);
        if (normalized.isEmpty()) {
            normalized = SAFE_BACKUP_ROOT_PATH;
        }
        try {
            Path backupPath = Paths.get(normalized).toAbsolutePath().normalize();
            Path repoPath = resolveGitRepositoryRoot(gitRepositoryPath);
            if (backupPath.startsWith(repoPath) && !isAllowedInternalBackupRoot(backupPath, repoPath)) {
                return SAFE_BACKUP_ROOT_PATH;
            }
            return backupPath.toString();
        } catch (Exception ignored) {
            return SAFE_BACKUP_ROOT_PATH;
        }
    }

    private String sanitizeGitBackupMode(String mode) {
        String normalized = safe(mode).toUpperCase(Locale.ROOT);
        if ("BUNDLE_AND_PUSH".equals(normalized)) {
            return "PUSH_BASE_BRANCH";
        }
        return normalized.isEmpty() ? "PUSH_BASE_BRANCH" : normalized;
    }

    private boolean isBackupRootInsideRepository(BackupSettings settings) {
        try {
            Path backupPath = Paths.get(safe(settings.backupRootPath)).toAbsolutePath().normalize();
            Path repoPath = resolveGitRepositoryRoot(settings.gitRepositoryPath);
            return backupPath.startsWith(repoPath) && !isAllowedInternalBackupRoot(backupPath, repoPath);
        } catch (Exception ignored) {
            return false;
        }
    }

    private Path resolveGitRepositoryRoot(String gitRepositoryPath) {
        return safe(gitRepositoryPath).isEmpty()
                ? Paths.get("/opt/Resonance").toAbsolutePath().normalize()
                : Paths.get(safe(gitRepositoryPath)).toAbsolutePath().normalize();
    }

    private boolean isAllowedInternalBackupRoot(Path backupPath, Path repoPath) {
        return backupPath.equals(repoPath.resolve(ALLOWED_INTERNAL_BACKUP_ROOT).normalize());
    }

    private String resolveGitExecutionProfileName(String executionType, boolean isEn) {
        if ("GIT_BUNDLE".equals(executionType)) {
            return isEn ? "Git Bundle Backup" : "Git 번들 백업 실행";
        }
        if ("GIT_PRECHECK".equals(executionType)) {
            return isEn ? "Git Push Precheck" : "Git Push 사전 점검";
        }
        if ("GIT_CLEANUP_SAFE".equals(executionType)) {
            return isEn ? "Git Safe Artifact Cleanup" : "산출물 자동 정리";
        }
        if ("GIT_COMMIT_AND_PUSH_BASE".equals(executionType)) {
            return isEn ? "Git Commit And Base Branch Push" : "Git 전체 커밋 후 기준 브랜치 Push 실행";
        }
        if ("GIT_PUSH_BASE".equals(executionType)) {
            return isEn ? "Git Base Branch Push" : "Git 기준 브랜치 Push 실행";
        }
        if ("GIT_PUSH_RESTORE".equals(executionType)) {
            return isEn ? "Git Restore Branch Push" : "Git 복구 브랜치 Push 실행";
        }
        if ("GIT_TAG_PUSH".equals(executionType)) {
            return isEn ? "Git Tag Push" : "Git 태그 Push 실행";
        }
        return isEn ? "Git Backup" : "Git 백업 실행";
    }

    private String resolveGitPushTarget(BackupSettings settings, String fallbackRemoteName) {
        return safe(settings.gitRemoteUrl).isEmpty() ? fallbackRemoteName : safe(settings.gitRemoteUrl);
    }

    private String runCommand(List<String> command, boolean isEn) throws Exception {
        return runCommand(command, isEn, null);
    }

    private String runCommand(List<String> command, boolean isEn, Consumer<String> logger) throws Exception {
        return runCommand(command, isEn, logger, true);
    }

    private String runCommand(List<String> command, boolean isEn, Consumer<String> logger, boolean trimOutput) throws Exception {
        ProcessBuilder builder = new ProcessBuilder(command);
        builder.directory(Paths.get(".").toAbsolutePath().normalize().toFile());
        builder.redirectErrorStream(true);
        if (logger != null) {
            logger.accept("$ " + String.join(" ", command));
        }
        CommandResult result = executeProcess(builder, COMMAND_TIMEOUT_SECONDS,
                isEn ? "Backup command timed out." : "백업 명령이 제한 시간 내에 완료되지 않았습니다.",
                logger);
        String output = result.output;
        if (result.exitCode != 0) {
            throw new IllegalStateException(output.isEmpty()
                    ? (isEn ? "Backup command failed." : "백업 명령 실행에 실패했습니다.")
                    : output);
        }
        return trimOutput ? output.trim() : output;
    }

    private String runCommandWithInput(List<String> command, String stdin, boolean isEn, Consumer<String> logger) throws Exception {
        ProcessBuilder builder = new ProcessBuilder(command);
        builder.directory(Paths.get(".").toAbsolutePath().normalize().toFile());
        builder.redirectErrorStream(true);
        if (logger != null) {
            logger.accept("$ " + String.join(" ", command));
        }
        CommandResult result = executeProcess(builder, stdin, COMMAND_TIMEOUT_SECONDS,
                isEn ? "Backup command timed out." : "백업 명령이 제한 시간 내에 완료되지 않았습니다.",
                logger);
        String output = result.output;
        if (result.exitCode != 0) {
            throw new IllegalStateException(output.isEmpty()
                    ? (isEn ? "Backup command failed." : "백업 명령 실행에 실패했습니다.")
                    : output);
        }
        return output.trim();
    }

    private String resolveLocalHeadSha(Path repoPath, boolean isEn) {
        try {
            return runCommand(Arrays.asList("git", "-C", repoPath.toString(), "rev-parse", "HEAD"), isEn);
        } catch (Exception ignored) {
            return "";
        }
    }

    private String resolveGitStatus(Path repoPath, boolean isEn) {
        try {
            return runCommand(Arrays.asList("git", "-C", repoPath.toString(), "status", "--porcelain"), isEn, null, false);
        } catch (Exception ignored) {
            return "";
        }
    }

    private String resolveRemoteBranchSha(Path repoPath, String remoteName, String branchName, boolean isEn) {
        try {
            String output = runCommand(Arrays.asList("git", "-C", repoPath.toString(), "ls-remote", remoteName, "refs/heads/" + branchName), isEn);
            if (output.isEmpty()) {
                return "";
            }
            String[] parts = output.split("\\s+");
            return parts.length > 0 ? parts[0] : "";
        } catch (Exception ignored) {
            return "";
        }
    }

    private String syncLocalBranchForPush(BackupSettings settings, Path repoPath, String remoteName, String targetBranch, boolean isEn, Consumer<String> logger) throws Exception {
        logger.accept((isEn ? "Fetching remote branch before push: " : "Push 전 원격 브랜치를 조회합니다: ") + remoteName + "/" + targetBranch);
        runCommand(Arrays.asList("git", "-C", repoPath.toString(), "fetch", remoteName, targetBranch), isEn, logger);
        String localHead = resolveLocalHeadSha(repoPath, isEn);
        String remoteHead = resolveRemoteTrackingHeadSha(repoPath, remoteName, targetBranch, isEn);
        if (remoteHead.isEmpty() || localHead.isEmpty()) {
            return "";
        }
        if (localHead.equals(remoteHead)) {
            logger.accept(isEn ? "Local branch already matches remote head." : "로컬 브랜치가 이미 원격 HEAD와 같습니다.");
            return "";
        }
        String mergeBase = resolveMergeBaseSha(repoPath, "HEAD", remoteHead, isEn);
        if (mergeBase.isEmpty()) {
            return "";
        }
        if (mergeBase.equals(remoteHead)) {
            logger.accept(isEn ? "Local branch is already ahead of remote head." : "로컬 브랜치가 이미 원격 HEAD보다 앞서 있습니다.");
            return "";
        }
        logger.accept(isEn
                ? "Remote branch moved. Rebasing local commits onto latest remote head."
                : "원격 브랜치가 이동해 최신 원격 HEAD 기준으로 로컬 커밋을 rebase 합니다.");
        try {
            runCommand(Arrays.asList("git", "-C", repoPath.toString(), "rebase", "FETCH_HEAD"), isEn, logger);
            return "";
        } catch (Exception rebaseError) {
            try {
                runCommand(Arrays.asList("git", "-C", repoPath.toString(), "rebase", "--abort"), isEn, logger);
            } catch (Exception ignored) {
            }
            String conflictBranch = pushConflictPreservationBranch(settings, repoPath, remoteName, targetBranch, isEn, logger);
            if (!conflictBranch.isEmpty()) {
                logger.accept((isEn
                        ? "Auto rebase conflict preserved on branch: "
                        : "자동 rebase 충돌 내용을 보존 브랜치로 Push 했습니다: ") + conflictBranch);
                return conflictBranch;
            }
            throw new IllegalStateException(safe(rebaseError.getMessage()).isEmpty()
                    ? (isEn ? "Auto rebase failed. Resolve conflicts and retry backup push." : "자동 rebase에 실패했습니다. 충돌을 정리한 뒤 backup push를 다시 실행하세요.")
                    : rebaseError.getMessage());
        }
    }

    private String pushConflictPreservationBranch(BackupSettings settings, Path repoPath, String remoteName, String targetBranch, boolean isEn, Consumer<String> logger) {
        String stamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss"));
        String sanitizedBranch = targetBranch.replaceAll("[^a-zA-Z0-9/_-]", "-");
        String conflictBranch = "backup/conflict/" + sanitizedBranch + "/" + stamp;
        try {
            logger.accept((isEn ? "Pushing conflict preservation branch: " : "충돌 보존 브랜치를 Push 합니다: ") + conflictBranch);
            runGitPushCommand(
                    Arrays.asList("git", "-C", repoPath.toString(), "push", resolveGitPushTarget(settings, remoteName), "HEAD:refs/heads/" + conflictBranch),
                    settings,
                    repoPath,
                    remoteName,
                    isEn,
                    logger);
            return conflictBranch;
        } catch (Exception pushError) {
            logger.accept(safe(pushError.getMessage()).isEmpty()
                    ? (isEn ? "Failed to push conflict preservation branch." : "충돌 보존 브랜치 Push에 실패했습니다.")
                    : safe(pushError.getMessage()));
            return "";
        }
    }

    private String resolveRemoteTrackingHeadSha(Path repoPath, String remoteName, String branchName, boolean isEn) {
        try {
            return runCommand(Arrays.asList("git", "-C", repoPath.toString(), "rev-parse", remoteName + "/" + branchName), isEn);
        } catch (Exception ignored) {
            return "";
        }
    }

    private String resolveMergeBaseSha(Path repoPath, String leftRef, String rightRef, boolean isEn) {
        try {
            return runCommand(Arrays.asList("git", "-C", repoPath.toString(), "merge-base", leftRef, rightRef), isEn);
        } catch (Exception ignored) {
            return "";
        }
    }

    private List<GitStatusEntry> readGitStatusEntries(Path repoPath, boolean isEn) {
        String output = resolveGitStatus(repoPath, isEn);
        if (output.isEmpty()) {
            return List.of();
        }
        List<GitStatusEntry> entries = new ArrayList<>();
        for (String rawLine : output.split("\\R")) {
            String line = rawLine == null ? "" : rawLine;
            if (line.trim().isEmpty() || line.length() < 4) {
                continue;
            }
            String path = line.substring(3).trim();
            int renameSeparator = path.indexOf(" -> ");
            if (renameSeparator >= 0) {
                path = path.substring(renameSeparator + 4).trim();
            }
            if (path.isEmpty()) {
                continue;
            }
            entries.add(new GitStatusEntry(line.substring(0, 2), path));
        }
        return entries;
    }

    private boolean isCommitBlockedPath(String path) {
        String normalized = safe(path);
        if (normalized.isEmpty()) {
            return true;
        }
        for (String blockedPrefix : GIT_COMMIT_BLOCKED_PREFIXES) {
            if (normalized.equals(blockedPrefix) || normalized.startsWith(blockedPrefix)) {
                return true;
            }
        }
        return false;
    }

    private List<String> scanSecretCandidatePaths(Path repoPath, List<String> paths, boolean isEn) throws Exception {
        List<String> matches = new ArrayList<>();
        for (String path : paths) {
            Path filePath = repoPath.resolve(path).normalize();
            if (!Files.exists(filePath) || Files.isDirectory(filePath)) {
                continue;
            }
            String content = Files.readString(filePath, StandardCharsets.UTF_8);
            for (Pattern pattern : SECRET_PATTERNS) {
                if (pattern.matcher(content).find()) {
                    matches.add(path);
                    break;
                }
            }
        }
        return matches;
    }

    private List<String> scanLargeCommitCandidatePaths(Path repoPath, List<String> paths) throws Exception {
        List<String> matches = new ArrayList<>();
        for (String path : paths) {
            Path filePath = repoPath.resolve(path).normalize();
            if (!Files.exists(filePath) || Files.isDirectory(filePath)) {
                continue;
            }
            if (Files.size(filePath) > GITHUB_FILE_SIZE_LIMIT_BYTES) {
                matches.add(path + " (" + formatBytes(Files.size(filePath)) + ")");
            }
        }
        return matches;
    }

    private boolean isCleanupCandidatePath(String path) {
        for (String prefix : GIT_CLEANUP_PATHS) {
            if (path.equals(prefix) || path.startsWith(prefix + "/")) {
                return true;
            }
        }
        return false;
    }

    private Map<String, String> parseGitLsTreeRow(String line) {
        int tabIndex = line.indexOf('\t');
        if (tabIndex < 0) {
            return null;
        }
        String meta = line.substring(0, tabIndex).trim();
        String path = line.substring(tabIndex + 1).trim();
        String[] tokens = meta.split("\\s+");
        if (tokens.length < 4) {
            return null;
        }
        Map<String, String> row = new LinkedHashMap<>();
        row.put("objectId", tokens[2]);
        row.put("sizeBytes", tokens[3]);
        row.put("path", path);
        return row;
    }

    private Map<String, String> gitPrecheckRow(String path, String size, String objectId, String note) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("path", path);
        row.put("size", size);
        row.put("objectId", objectId);
        row.put("note", note);
        return row;
    }

    private long parseLongSafe(String value) {
        try {
            return Long.parseLong(safe(value));
        } catch (Exception ignored) {
            return 0L;
        }
    }

    private String formatBytes(long size) {
        if (size <= 0L) {
            return "0 B";
        }
        if (size >= 1024L * 1024L) {
            return String.format(Locale.ROOT, "%.1f MB", size / 1024d / 1024d);
        }
        if (size >= 1024L) {
            return String.format(Locale.ROOT, "%.1f KB", size / 1024d);
        }
        return size + " B";
    }

    private void ensureGitignoreEntries(Path repoPath) {
        try {
            Path gitignorePath = repoPath.resolve(".gitignore");
            List<String> lines = Files.exists(gitignorePath) ? Files.readAllLines(gitignorePath) : new ArrayList<String>();
            Set<String> appendLines = new LinkedHashSet<>();
            for (String path : GIT_CLEANUP_PATHS) {
                String pattern = "/" + path + "/";
                if (!lines.contains(pattern)) {
                    appendLines.add(pattern);
                }
            }
            String settingsPattern = "/data/backup-config/settings.json";
            if (!lines.contains(settingsPattern)) {
                appendLines.add(settingsPattern);
            }
            if (!appendLines.isEmpty()) {
                List<String> next = new ArrayList<>(lines);
                if (!next.isEmpty() && !next.get(next.size() - 1).isEmpty()) {
                    next.add("");
                }
                next.add("# Git backup cleanup scopes");
                next.addAll(appendLines);
                Files.write(gitignorePath, next);
            }
        } catch (Exception ignored) {
        }
    }

    private String runGitPushCommand(List<String> command, BackupSettings settings, Path repoPath, String remoteName, boolean isEn, Consumer<String> logger) throws Exception {
        List<String> gitCommand = new ArrayList<>();
        gitCommand.add("git");
        gitCommand.add("-C");
        gitCommand.add(repoPath.toString());
        gitCommand.add("-c");
        gitCommand.add("http.version=HTTP/1.1");
        gitCommand.add("-c");
        gitCommand.add("http.postBuffer=524288000");
        gitCommand.add("-c");
        gitCommand.add("core.compression=0");
        String effectiveUsername = resolveGitUsername(settings, command, repoPath, remoteName, isEn);
        String effectiveToken = resolveConfiguredGitAuthToken(settings);
        if (!effectiveUsername.isEmpty() && !effectiveToken.isEmpty()) {
            gitCommand.add("-c");
            gitCommand.add("credential.helper=");
            gitCommand.add("-c");
            gitCommand.add("http.extraheader=" + buildBasicAuthHeader(effectiveUsername, effectiveToken));
        }
        gitCommand.addAll(command.subList(3, command.size()));
        ProcessBuilder builder = new ProcessBuilder(gitCommand);
        builder.directory(Paths.get(".").toAbsolutePath().normalize().toFile());
        builder.redirectErrorStream(true);
        Map<String, String> environment = builder.environment();
        environment.put("GIT_TERMINAL_PROMPT", "0");
        Path askPassPath = null;
        if (!effectiveUsername.isEmpty() && !effectiveToken.isEmpty()) {
            askPassPath = Files.createTempFile("carbonet-git-askpass", ".sh");
            Files.writeString(askPassPath,
                    "#!/usr/bin/env bash\n" +
                    "case \"$1\" in\n" +
                    "  *Username*) printf '%s' \"$GIT_BACKUP_USERNAME\" ;;\n" +
                    "  *) printf '%s' \"$GIT_BACKUP_TOKEN\" ;;\n" +
                    "esac\n");
            try {
                Files.setPosixFilePermissions(askPassPath, PosixFilePermissions.fromString("rwx------"));
            } catch (Exception ignored) {
            }
            environment.put("GIT_ASKPASS", askPassPath.toAbsolutePath().toString());
            environment.put("GIT_BACKUP_USERNAME", effectiveUsername);
            environment.put("GIT_BACKUP_TOKEN", effectiveToken);
        }
        try {
            logger.accept("$ " + redactGitPushCommandForLog(gitCommand));
            CommandResult result = executeProcess(builder, GIT_PUSH_TIMEOUT_SECONDS,
                    isEn
                            ? "Git push timed out after " + GIT_PUSH_TIMEOUT_SECONDS + " seconds. Check remote connectivity and retry."
                            : "Git push가 " + GIT_PUSH_TIMEOUT_SECONDS + "초 동안 완료되지 않아 중단되었습니다. 원격 연결 상태를 확인한 뒤 다시 시도하세요.",
                    logger);
            String output = result.output;
            if (result.exitCode != 0) {
                String targetBranch = resolveTargetBranchName(command);
                String localHead = resolveLocalHeadSha(repoPath, isEn);
                String remoteHead = targetBranch.isEmpty() ? "" : resolveRemoteBranchSha(repoPath, remoteName, targetBranch, isEn);
                if (!localHead.isEmpty() && localHead.equals(remoteHead)) {
                    return output.isEmpty() ? "already-up-to-date-after-recheck" : output + "\nstatus=already-up-to-date-after-recheck";
                }
                throw new IllegalStateException(output.isEmpty()
                        ? (isEn ? "Git push failed." : "Git push 실행에 실패했습니다.")
                        : output);
            }
            return output;
        } finally {
            if (askPassPath != null) {
                Files.deleteIfExists(askPassPath);
            }
        }
    }

    private String buildBasicAuthHeader(String username, String token) {
        String credentials = username + ":" + token;
        return "AUTHORIZATION: basic " + Base64.getEncoder().encodeToString(credentials.getBytes(StandardCharsets.UTF_8));
    }

    private String resolveGitPushTargetFromCommand(List<String> command) {
        if (command == null || command.size() < 5) {
            return "";
        }
        return safe(command.get(4));
    }

    private String redactGitPushCommandForLog(List<String> gitCommand) {
        List<String> redacted = new ArrayList<>(gitCommand);
        for (int i = 0; i < redacted.size(); i++) {
            if (redacted.get(i).startsWith("http.extraheader=AUTHORIZATION: basic ")) {
                redacted.set(i, "http.extraheader=AUTHORIZATION: basic ********");
            }
        }
        return String.join(" ", redacted);
    }

    private CommandResult executeProcess(ProcessBuilder builder, long timeoutSeconds, String timeoutMessage, Consumer<String> logger) throws Exception {
        return executeProcess(builder, "", timeoutSeconds, timeoutMessage, logger);
    }

    private CommandResult executeProcess(ProcessBuilder builder, String stdin, long timeoutSeconds, String timeoutMessage, Consumer<String> logger) throws Exception {
        Process process = builder.start();
        if (!safe(stdin).isEmpty()) {
            process.getOutputStream().write(stdin.getBytes(StandardCharsets.UTF_8));
            process.getOutputStream().flush();
        }
        process.getOutputStream().close();
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        Thread outputReader = new Thread(() -> copyProcessOutput(process.getInputStream(), outputStream, logger),
                "backup-command-output-reader");
        outputReader.setDaemon(true);
        outputReader.start();
        boolean finished = process.waitFor(timeoutSeconds, TimeUnit.SECONDS);
        if (!finished) {
            process.destroyForcibly();
            outputReader.join(1000L);
            throw new IllegalStateException(timeoutMessage);
        }
        outputReader.join(1000L);
        return new CommandResult(process.exitValue(), outputStream.toString(StandardCharsets.UTF_8));
    }

    private void copyProcessOutput(InputStream inputStream, ByteArrayOutputStream outputStream, Consumer<String> logger) {
        try (InputStream source = inputStream) {
            byte[] buffer = new byte[2048];
            int read;
            while ((read = source.read(buffer)) >= 0) {
                synchronized (outputStream) {
                    outputStream.write(buffer, 0, read);
                }
                if (logger != null && read > 0) {
                    String chunk = new String(buffer, 0, read, StandardCharsets.UTF_8);
                    for (String line : chunk.split("\\R")) {
                        String trimmed = line.trim();
                        if (!trimmed.isEmpty()) {
                            logger.accept(trimmed);
                        }
                    }
                }
            }
        } catch (Exception ignored) {
        }
    }

    private BackupExecutionJob createJob(String executionType, String actorId, AdminBackupRunRequestDTO request, boolean isEn) {
        BackupExecutionJob job = new BackupExecutionJob();
        job.jobId = "BK-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
        job.executionType = executionType;
        job.profileName = resolveExecutionProfileName(executionType, isEn);
        job.actorId = safe(actorId).isEmpty() ? "system" : safe(actorId);
        job.status = "QUEUED";
        job.startedAt = LocalDateTime.now();
        job.updatedAt = job.startedAt;
        job.logPath = jobLogDirectory.resolve(job.jobId + ".log");
        job.parameters.put("gitRestoreCommit", safe(request == null ? null : request.getGitRestoreCommit()));
        job.parameters.put("dbRestoreType", safe(request == null ? null : request.getDbRestoreType()));
        job.parameters.put("dbRestoreTarget", safe(request == null ? null : request.getDbRestoreTarget()));
        job.parameters.put("dbRestorePointInTime", safe(request == null ? null : request.getDbRestorePointInTime()));
        job.parameters.put("sudoPassword", request == null ? "" : (request.getSudoPassword() == null ? "" : request.getSudoPassword()));
        return job;
    }

    private String resolveExecutionProfileName(String executionType, boolean isEn) {
        if (executionType == null) {
            return isEn ? "Backup" : "백업 실행";
        }
        switch (executionType) {
            case "GIT_RESTORE_COMMIT":
                return isEn ? "Git Rollback Restore" : "Git 롤백 복구";
            case "DB_RESTORE_SQL":
                return isEn ? "DB SQL Restore" : "DB SQL 복구";
            case "DB_RESTORE_PHYSICAL":
                return isEn ? "DB Physical Restore" : "DB 물리 복구";
            case "DB_RESTORE_PITR":
                return isEn ? "DB Point-In-Time Restore" : "DB 시점 복구";
            case "DB":
                return isEn ? "Database Backup" : "DB 백업 실행";
            default:
                return executionType.startsWith("GIT")
                        ? resolveGitExecutionProfileName(executionType, isEn)
                        : (isEn ? "Backup" : "백업 실행");
        }
    }

    private void executeJob(String jobId, String actorId, boolean isEn) {
        BackupExecutionJob job = jobs.get(jobId);
        if (job == null) {
            return;
        }
        job.status = "RUNNING";
        job.updatedAt = LocalDateTime.now();
        appendJobLog(job, isEn ? "Backup job started." : "백업 작업을 시작합니다.");
        BackupConfigDocument document = loadDocument();
        BackupSettings settings = document.settings == null ? defaultSettings() : document.settings;
        String result = isEn ? "Success" : "성공";
        String note;
        try {
            if ("GIT_RESTORE_COMMIT".equals(job.executionType)) {
                if (!"Y".equalsIgnoreCase(safe(settings.gitEnabled))) {
                    throw new IllegalStateException(isEn ? "Git backup is disabled in backup settings." : "백업 설정에서 Git 백업이 비활성화되어 있습니다.");
                }
                note = executeGitRestore(settings, job, isEn, line -> appendJobLog(job, line));
            } else if ("DB_RESTORE_SQL".equals(job.executionType)
                    || "DB_RESTORE_PHYSICAL".equals(job.executionType)
                    || "DB_RESTORE_PITR".equals(job.executionType)) {
                if (!"Y".equalsIgnoreCase(safe(settings.dbEnabled))) {
                    throw new IllegalStateException(isEn ? "Database backup is disabled in backup settings." : "백업 설정에서 DB 백업이 비활성화되어 있습니다.");
                }
                note = executeDatabaseRestore(settings, job, isEn, line -> appendJobLog(job, line));
            } else if (job.executionType.startsWith("GIT") || "GIT".equals(job.executionType)) {
                if (!"Y".equalsIgnoreCase(safe(settings.gitEnabled))) {
                    throw new IllegalStateException(isEn ? "Git backup is disabled in backup settings." : "백업 설정에서 Git 백업이 비활성화되어 있습니다.");
                }
                note = executeGitOperation(settings, job.executionType, isEn, line -> appendJobLog(job, line));
            } else {
                if (!"Y".equalsIgnoreCase(safe(settings.dbEnabled))) {
                    throw new IllegalStateException(isEn ? "Database backup is disabled in backup settings." : "백업 설정에서 DB 백업이 비활성화되어 있습니다.");
                }
                if (safe(settings.dbDumpCommand).isEmpty()) {
                    throw new IllegalStateException(isEn ? "Database dump command is not configured." : "DB dump 명령이 등록되어 있지 않습니다.");
                }
                note = executeDatabaseBackup(settings, isEn, line -> appendJobLog(job, line));
            }
            job.status = "SUCCESS";
        } catch (Exception e) {
            result = isEn ? "Failed" : "실패";
            job.status = "FAILED";
            note = safe(e.getMessage());
            if (note.isEmpty()) {
                note = job.executionType.startsWith("GIT")
                        ? (isEn ? "Git backup command failed." : "Git 백업 명령 실행에 실패했습니다.")
                        : (isEn ? "Database backup command failed." : "DB 백업 명령 실행에 실패했습니다.");
            }
            appendJobLog(job, note);
        }
        job.finishedAt = LocalDateTime.now();
        job.updatedAt = job.finishedAt;
        job.resultMessage = note;
        appendJobLog(job, (isEn ? "Backup job finished: " : "백업 작업이 종료되었습니다: ") + job.status);
        recordExecutionHistory(document, job, result, note);
    }

    private synchronized void recordExecutionHistory(BackupConfigDocument document, BackupExecutionJob job, String result, String note) {
        BackupConfigDocument currentDocument = loadDocument();
        if (currentDocument.executionRows == null) {
            currentDocument.executionRows = new ArrayList<>();
        }
        currentDocument.executionRows.add(0, executionRow(
                job.startedAt.format(TIME_FORMAT),
                job.profileName,
                result,
                formatDuration(Duration.between(job.startedAt, job.finishedAt == null ? LocalDateTime.now() : job.finishedAt)),
                note));
        trim(currentDocument.executionRows, 20);
        writeDocument(currentDocument);
    }

    private void appendJobLog(BackupExecutionJob job, String line) {
        if (job == null || safe(line).isEmpty()) {
            return;
        }
        String message = "[" + LocalDateTime.now().format(TIME_FORMAT) + "] " + line;
        synchronized (job) {
            job.updatedAt = LocalDateTime.now();
            job.logLines.add(message);
            while (job.logLines.size() > MAX_JOB_LOG_LINES) {
                job.logLines.remove(0);
            }
            try {
                Files.createDirectories(jobLogDirectory);
                Files.writeString(job.logPath, message + System.lineSeparator(), StandardCharsets.UTF_8,
                        StandardOpenOption.CREATE, StandardOpenOption.APPEND);
            } catch (Exception ignored) {
            }
        }
    }

    private BackupExecutionJob findActiveJob() {
        return jobs.values().stream()
                .filter(job -> "QUEUED".equals(job.status) || "RUNNING".equals(job.status))
                .sorted(Comparator.comparing(job -> job.startedAt))
                .findFirst()
                .orElse(null);
    }

    private Map<String, Object> buildCurrentJobPayload(boolean isEn) {
        BackupExecutionJob activeJob = findActiveJob();
        if (activeJob == null) {
            return buildLatestFinishedJobPayload();
        }
        return toJobPayload(activeJob);
    }

    private List<Map<String, Object>> buildRecentJobPayloads(boolean isEn) {
        return jobs.values().stream()
                .sorted((left, right) -> right.startedAt.compareTo(left.startedAt))
                .limit(10)
                .map(this::toJobPayload)
                .collect(Collectors.toList());
    }

    private Map<String, Object> buildLatestFinishedJobPayload() {
        return jobs.values().stream()
                .sorted((left, right) -> right.startedAt.compareTo(left.startedAt))
                .findFirst()
                .map(this::toJobPayload)
                .orElse(null);
    }

    private Map<String, Object> toJobPayload(BackupExecutionJob job) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("jobId", job.jobId);
        payload.put("executionType", job.executionType);
        payload.put("profileName", job.profileName);
        payload.put("actorId", job.actorId);
        payload.put("status", job.status);
        payload.put("startedAt", job.startedAt == null ? "" : job.startedAt.format(TIME_FORMAT));
        payload.put("finishedAt", job.finishedAt == null ? "" : job.finishedAt.format(TIME_FORMAT));
        payload.put("updatedAt", job.updatedAt == null ? "" : job.updatedAt.format(TIME_FORMAT));
        payload.put("duration", formatDuration(Duration.between(job.startedAt, job.finishedAt == null ? LocalDateTime.now() : job.finishedAt)));
        payload.put("resultMessage", safe(job.resultMessage));
        payload.put("logLines", new ArrayList<>(job.logLines));
        payload.put("logPath", job.logPath == null ? "" : job.logPath.toString());
        Map<String, String> safeParameters = new LinkedHashMap<>(job.parameters);
        safeParameters.remove("sudoPassword");
        payload.put("parameters", safeParameters);
        return payload;
    }

    private static final class CommandResult {
        private final int exitCode;
        private final String output;

        private CommandResult(int exitCode, String output) {
            this.exitCode = exitCode;
            this.output = output;
        }
    }

    private static final class GitStatusEntry {
        private final String status;
        private final String path;

        private GitStatusEntry(String status, String path) {
            this.status = status;
            this.path = path;
        }
    }

    private static final class GitPreflightReport {
        private List<GitStatusEntry> statusEntries = List.of();
        private List<String> allowedCommitPaths = List.of();
        private List<String> disallowedPaths = List.of();
        private List<String> secretPaths = List.of();
        private List<String> largePaths = List.of();
    }

    private String resolveTargetBranchName(List<String> command) {
        for (String part : command) {
            if (part.startsWith("HEAD:refs/heads/")) {
                return part.substring("HEAD:refs/heads/".length());
            }
        }
        return "";
    }

    private String resolveGitUsername(BackupSettings settings, List<String> command, Path repoPath, String remoteName, boolean isEn) {
        String configured = resolveConfiguredGitUsername(settings);
        if (!configured.isEmpty()) {
            return configured;
        }
        String remoteUrl = safe(settings.gitRemoteUrl);
        if (remoteUrl.isEmpty()) {
            remoteUrl = resolveGitRemoteUrlFromRepository(repoPath, remoteName, isEn);
        }
        if (remoteUrl.isEmpty()) {
            remoteUrl = resolveGitRemoteUrlFromCommand(command);
        }
        return inferUsernameFromRemoteUrl(remoteUrl);
    }

    private String resolveGitRemoteUrlFromRepository(Path repoPath, String remoteName, boolean isEn) {
        try {
            return runCommand(Arrays.asList("git", "-C", repoPath.toString(), "remote", "get-url", remoteName), isEn);
        } catch (Exception ignored) {
            return "";
        }
    }

    private String resolveGitRemoteUrlFromCommand(List<String> command) {
        for (String part : command) {
            if (part.startsWith("http://") || part.startsWith("https://") || part.contains("@")) {
                return part;
            }
        }
        return "";
    }

    private String inferUsernameFromRemoteUrl(String remoteUrl) {
        String value = safe(remoteUrl);
        if (value.isEmpty()) {
            return "";
        }
        try {
            if (value.startsWith("http://") || value.startsWith("https://")) {
                String path = URI.create(value).getPath();
                if (path != null) {
                    String[] segments = path.replaceFirst("^/", "").split("/");
                    if (segments.length >= 2 && !segments[0].isBlank()) {
                        return segments[0];
                    }
                }
            }
            if (value.contains(":") && value.contains("@")) {
                String suffix = value.substring(value.indexOf(':') + 1);
                String[] segments = suffix.split("/");
                if (segments.length >= 2 && !segments[0].isBlank()) {
                    return segments[0];
                }
            }
        } catch (Exception ignored) {
        }
        return "";
    }

    private String maskSecret(String value) {
        if (safe(value).isEmpty()) {
            return "";
        }
        return "********";
    }

    private String resolveConfiguredGitUsername(BackupSettings settings) {
        String configured = safe(settings == null ? null : settings.gitUsername);
        if (!configured.isEmpty()) {
            return configured;
        }
        return safe(System.getenv("BACKUP_GIT_USERNAME"));
    }

    private String resolveConfiguredGitRemoteUrl(BackupSettings settings) {
        String configured = safe(settings == null ? null : settings.gitRemoteUrl);
        if (!configured.isEmpty()) {
            return configured;
        }
        return safe(System.getenv("REPO_URL"));
    }

    private String resolveConfiguredGitAuthToken(BackupSettings settings) {
        String configured = safe(settings == null ? null : settings.gitAuthToken);
        if (!configured.isEmpty()) {
            return configured;
        }
        return safe(System.getenv("BACKUP_GIT_AUTH_TOKEN"));
    }

    private void trim(List<Map<String, String>> rows, int maxSize) {
        while (rows.size() > maxSize) {
            rows.remove(rows.size() - 1);
        }
    }

    private String yn(String value) {
        return "Y".equalsIgnoreCase(safe(value)) ? "Y" : "N";
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private String now() {
        return LocalDateTime.now().format(TIME_FORMAT);
    }

    private String formatDuration(Duration duration) {
        long seconds = Math.max(0, duration.getSeconds());
        long minutes = seconds / 60;
        long remainSeconds = seconds % 60;
        if (minutes <= 0) {
            return remainSeconds + "s";
        }
        return minutes + "m " + remainSeconds + "s";
    }

    public static class BackupConfigDocument {
        public BackupSettings settings;
        public String updatedAt;
        public String updatedBy;
        public List<Map<String, String>> executionRows;
        public List<Map<String, String>> versionRows;
    }

    public static class BackupSettings {
        public String backupRootPath;
        public String retentionDays;
        public String cronExpression;
        public String offsiteSyncEnabled;
        public String gitEnabled;
        public String gitRepositoryPath;
        public String gitRemoteName;
        public String gitRemoteUrl;
        public String gitUsername;
        public String gitAuthToken;
        public String gitBranchPattern;
        public String gitBundlePrefix;
        public String gitBackupMode;
        public String gitRestoreBranchPrefix;
        public String gitTagPrefix;
        public String dbEnabled;
        public String dbHost;
        public String dbPort;
        public String dbName;
        public String dbUser;
        public String dbDumpCommand;
        public String dbSchemaScope;
        public String dbPromotionDataPolicy;
        public String dbDiffExecutionPreset;
        public String dbApplyLocalDiffYn;
        public String dbForceDestructiveDiffYn;
        public String dbFailOnUntrackedDestructiveDiffYn;
        public String dbRequirePatchHistoryYn;
    }

    private static final class RestorePrivilegeAccess {
        private final boolean useSudoForDocker;

        private RestorePrivilegeAccess(boolean useSudoForDocker) {
            this.useSudoForDocker = useSudoForDocker;
        }
    }

    @FunctionalInterface
    private interface CheckedSupplier<T> {
        T get() throws Exception;
    }

    private static final class BackupExecutionJob {
        private String jobId;
        private String executionType;
        private String profileName;
        private String actorId;
        private String status;
        private String resultMessage;
        private LocalDateTime startedAt;
        private LocalDateTime finishedAt;
        private LocalDateTime updatedAt;
        private Path logPath;
        private final Map<String, String> parameters = new LinkedHashMap<>();
        private final List<String> logLines = new ArrayList<>();
    }
}
// agent note: updated by FreeAgent Ultra
