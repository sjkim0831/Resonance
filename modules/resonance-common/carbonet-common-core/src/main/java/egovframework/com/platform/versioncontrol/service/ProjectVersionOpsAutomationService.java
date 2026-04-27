package egovframework.com.platform.versioncontrol.service;

import egovframework.com.platform.versioncontrol.mapper.ProjectVersionManagementMapper;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.nio.file.StandardCopyOption;
import java.time.Duration;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ConcurrentMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.stream.Collectors;

@Service
public class ProjectVersionOpsAutomationService {

    private static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final int MAX_LOG_LINES = 200;
    private static final Path REPOSITORY_ROOT = Paths.get("").toAbsolutePath().normalize();
    private static final Path WINDOWS_LAUNCHER = Paths.get("/mnt/c/Users/jwchoo/Desktop/Carbonet-DB동기화+푸시+221재배포.pyw");
    private static final Path DEPLOY_SCRIPT = REPOSITORY_ROOT.resolve("ops/scripts/windows-db-sync-push-and-fresh-deploy-221.sh");
    private static final Path DEPLOY_ENV_FILE = REPOSITORY_ROOT.resolve("ops/config/deploy-automation.env");
    private static final Path JOB_LOG_DIRECTORY = REPOSITORY_ROOT.resolve("data/version-control/ops-jobs");
    private static final String REMOTE_HOST = "136.117.100.221";
    private static final String EXECUTION_TYPE = "REMOTE_SYNC_DEPLOY_221";
    private static final String DEFAULT_REMOTE_DEPLOY_MODE = "pull";
    private static final List<String> FAILURE_SUMMARY_MARKERS = Arrays.asList(
            "ERROR:",
            "No route to host",
            "Connection timed out",
            "Connection refused",
            "remote DB tunnel did not open local port",
            "remote DB tunnel failed",
            "remote DB snapshot failed",
            "Cannot connect to a broker",
            "Permission denied",
            "Host key verification failed",
            "fatal:",
            "Exception in thread");

    private final ProjectVersionManagementMapper projectVersionManagementMapper;
    private final ConcurrentMap<String, RemoteAutomationJob> jobs = new ConcurrentHashMap<String, RemoteAutomationJob>();
    private final ExecutorService executor = Executors.newSingleThreadExecutor(runnable -> {
        Thread thread = new Thread(runnable, "carbonet-version-ops-automation");
        thread.setDaemon(true);
        return thread;
    });

    public ProjectVersionOpsAutomationService(ProjectVersionManagementMapper projectVersionManagementMapper) {
        this.projectVersionManagementMapper = projectVersionManagementMapper;
    }

    public Map<String, Object> buildOperationsPayload(String projectId, boolean isEn) {
        return orderedMap(
                "projectId", safe(projectId),
                "remoteHost", REMOTE_HOST,
                "launcherPath", WINDOWS_LAUNCHER.toString(),
                "scriptPath", DEPLOY_SCRIPT.toString(),
                "defaultRemoteDeployMode", DEFAULT_REMOTE_DEPLOY_MODE,
                "remoteDeployModeOptionSet", buildRemoteDeployModeOptionSet(),
                "launcherPresentYn", Files.exists(WINDOWS_LAUNCHER) ? "Y" : "N",
                "scriptPresentYn", Files.exists(DEPLOY_SCRIPT) ? "Y" : "N",
                "deployAutomationConfiguredYn", Files.exists(DEPLOY_ENV_FILE) ? "Y" : "N",
                "backupCoverageSet", buildBackupCoverageSet(isEn),
                "launcherExclusiveSet", buildLauncherExclusiveSet(isEn),
                "recommendedFlowSet", buildRecommendedFlowSet(isEn),
                "recentDeploymentHistory", safeRecentDeploymentHistory(projectId),
                "currentRemoteJob", buildCurrentJobPayload(),
                "recentRemoteJobs", buildRecentJobPayloads());
    }

    public Map<String, Object> startRemoteSyncAndDeploy(String projectId,
                                                        String actorId,
                                                        String releaseVersion,
                                                        String releaseTitle,
                                                        String releaseContent,
                                                        String remoteDeployMode,
                                                        boolean isEn) {
        String normalizedProjectId = safe(projectId);
        if (normalizedProjectId.isEmpty()) {
            throw new IllegalArgumentException(isEn ? "Project ID is required." : "프로젝트 ID가 필요합니다.");
        }
        String normalizedReleaseVersion = safe(releaseVersion);
        if (normalizedReleaseVersion.isEmpty()) {
            throw new IllegalArgumentException(isEn ? "Release version is required." : "배포 버전이 필요합니다.");
        }
        String normalizedReleaseContent = safe(releaseContent);
        if (normalizedReleaseContent.isEmpty()) {
            throw new IllegalArgumentException(isEn ? "Release content is required." : "배포 내용을 입력해야 합니다.");
        }
        String normalizedRemoteDeployMode = normalizeRemoteDeployMode(remoteDeployMode);
        if (!Files.exists(DEPLOY_SCRIPT)) {
            throw new IllegalArgumentException((isEn ? "Deploy script not found: " : "배포 스크립트를 찾을 수 없습니다: ") + DEPLOY_SCRIPT);
        }
        RemoteAutomationJob activeJob = findActiveJob();
        if (activeJob != null) {
            throw new IllegalArgumentException(isEn
                    ? "Another remote sync/deploy job is already running."
                    : "다른 원격 동기화/배포 작업이 이미 실행 중입니다.");
        }
        RemoteAutomationJob job = createJob(normalizedProjectId, actorId, normalizedReleaseVersion, releaseTitle, normalizedReleaseContent, normalizedRemoteDeployMode, isEn);
        insertDeploymentHistory(job);
        jobs.put(job.jobId, job);
        executor.submit(() -> executeJob(job.jobId, isEn));

        Map<String, Object> payload = buildOperationsPayload(normalizedProjectId, isEn);
        payload.put("remoteJobStarted", true);
        payload.put("remoteJobId", job.jobId);
        payload.put("message", isEn
                ? "Remote DB sync, Git push, and 221 deploy have been queued."
                : "원격 DB 동기화, Git push, 221 배포 작업을 시작했습니다.");
        return payload;
    }

    private List<Map<String, Object>> buildRemoteDeployModeOptionSet() {
        List<Map<String, Object>> values = new ArrayList<Map<String, Object>>();
        values.add(orderedMap("value", "pull", "label", "Pull + 재기동", "labelEn", "Pull + Restart"));
        values.add(orderedMap("value", "fresh-clone", "label", "Fresh Clone + 재기동", "labelEn", "Fresh Clone + Restart"));
        values.add(orderedMap("value", "jar-mosh", "label", "Jar 전송 + 재기동", "labelEn", "Jar Transfer + Restart"));
        return values;
    }

    private List<Map<String, Object>> safeRecentDeploymentHistory(String projectId) {
        String normalizedProjectId = safe(projectId);
        if (normalizedProjectId.isEmpty()) {
            return new ArrayList<Map<String, Object>>();
        }
        try {
            return projectVersionManagementMapper.selectRecentDeploymentHistory(normalizedProjectId);
        } catch (Exception ignored) {
            return new ArrayList<Map<String, Object>>();
        }
    }

    private List<String> buildBackupCoverageSet(boolean isEn) {
        List<String> values = new ArrayList<String>();
        values.add(isEn ? "DB backup and restore (SQL / physical / point-in-time)" : "DB 백업 및 복구(SQL / 물리 / 시점 복구)");
        values.add(isEn ? "Git precheck, safe cleanup, bundle, commit/push, tag push" : "Git 사전점검, 안전 정리, bundle, commit/push, 태그 push");
        values.add(isEn ? "Git rollback commit and restore branch push" : "Git 롤백 커밋 생성 및 복구 브랜치 push");
        values.add(isEn ? "Maintenance-mode wrapped DB restore flow" : "점검 모드 포함 DB 복구 흐름");
        return values;
    }

    private List<String> buildLauncherExclusiveSet(boolean isEn) {
        List<String> values = new ArrayList<String>();
        values.add(isEn ? "Apply version-governance SQL files to the remote DB over SSH" : "SSH 경유 원격 DB에 버전 거버넌스 SQL 반영");
        values.add(isEn ? "Choose pull, fresh-clone, or jar-transfer mode before 221 restart" : "221 재기동 전에 pull, fresh-clone, jar 전송 모드를 선택");
        values.add(isEn ? "Run remote build/restart plus freshness verification in one batch" : "원격 build/restart와 freshness 검증을 한 번에 실행");
        return values;
    }

    private List<String> buildRecommendedFlowSet(boolean isEn) {
        List<String> values = new ArrayList<String>();
        values.add(isEn ? "Use DB/Git backup actions here before remote deploy when you need a restore point." : "복구 지점이 필요하면 먼저 이 화면의 DB/Git 백업 작업을 실행합니다.");
        values.add(isEn ? "Default to pull mode when you need latest code/scripts plus restart. Switch only when a clean clone or jar-only transfer is required." : "최신 코드/스크립트 반영과 재기동만 필요하면 pull 모드를 기본으로 사용하고, 깨끗한 clone이나 jar-only 전송이 필요할 때만 전환합니다.");
        values.add(isEn ? "Use the restore page for SQL/physical/PITR rollback drills." : "SQL/물리/PITR 롤백은 복구 실행 화면을 사용합니다.");
        return values;
    }

    private RemoteAutomationJob createJob(String projectId,
                                          String actorId,
                                          String releaseVersion,
                                          String releaseTitle,
                                          String releaseContent,
                                          String remoteDeployMode,
                                          boolean isEn) {
        RemoteAutomationJob job = new RemoteAutomationJob();
        job.jobId = "VD-" + UUID.randomUUID().toString().substring(0, 8).toUpperCase(Locale.ROOT);
        job.projectId = projectId;
        job.deploymentHistoryId = "pdh-" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        job.executionType = EXECUTION_TYPE;
        job.profileName = isEn ? "221 Remote Sync And Deploy" : "221 원격 동기화 및 배포";
        job.actorId = safe(actorId).isEmpty() ? "system" : safe(actorId);
        job.releaseVersion = releaseVersion;
        job.releaseTitle = safe(releaseTitle);
        job.releaseContent = releaseContent;
        job.remoteDeployMode = normalizeRemoteDeployMode(remoteDeployMode);
        job.serverTarget = REMOTE_HOST;
        job.deployTraceId = "deploy-" + job.jobId.toLowerCase(Locale.ROOT);
        job.gitCommitSha = resolveCurrentGitCommitSha();
        job.status = "QUEUED";
        job.startedAt = LocalDateTime.now();
        job.updatedAt = job.startedAt;
        job.logPath = JOB_LOG_DIRECTORY.resolve(job.jobId + ".log");
        return job;
    }

    private void insertDeploymentHistory(RemoteAutomationJob job) {
        projectVersionManagementMapper.insertProjectDeploymentHistory(orderedMap(
                "deploymentHistoryId", job.deploymentHistoryId,
                "projectId", job.projectId,
                "releaseVersion", job.releaseVersion,
                "releaseTitle", job.releaseTitle,
                "releaseContent", job.releaseContent,
                "status", job.status,
                "serverTarget", job.serverTarget,
                "releaseUnitId", job.releaseUnitId,
                "deployTraceId", job.deployTraceId,
                "gitCommitSha", job.gitCommitSha,
                "resultMessage", job.resultMessage,
                "createdBy", job.actorId));
    }

    private void executeJob(String jobId, boolean isEn) {
        RemoteAutomationJob job = jobs.get(jobId);
        if (job == null) {
            return;
        }
        job.status = "RUNNING";
        job.updatedAt = LocalDateTime.now();
        appendJobLog(job, isEn ? "Remote sync/deploy job started." : "원격 동기화/배포 작업을 시작합니다.");
        safeUpdateDeploymentHistory(job, false, isEn);
        Process process = null;
        Path executionScript = null;
        try {
            executionScript = Files.createTempFile("carbonet-deploy-221-", ".sh");
            Files.copy(DEPLOY_SCRIPT, executionScript, StandardCopyOption.REPLACE_EXISTING);
            executionScript.toFile().setExecutable(true, true);

            ProcessBuilder builder = new ProcessBuilder(
                    "bash",
                    "-lc",
                    "cd " + shellQuote(REPOSITORY_ROOT.toString()) + " && bash " + shellQuote(executionScript.toString()));
            builder.directory(REPOSITORY_ROOT.toFile());
            builder.environment().put("PROJECT_ROOT", REPOSITORY_ROOT.toString());
            builder.environment().put("REMOTE_DEPLOY_MODE", defaultIfBlank(job.remoteDeployMode, DEFAULT_REMOTE_DEPLOY_MODE));
            builder.environment().put("REMOTE_BATCH_TRANSPORT", "ssh");
            builder.environment().put("EXECUTION_SOURCE", "page");
            builder.environment().put("SIGNED_EXECUTION_REQUEST_ID", job.deploymentHistoryId);
            builder.environment().put("POLICY_CHECK_RESULT", "APPROVED");
            builder.environment().put("APPROVED_TARGET_HOSTS", job.serverTarget);
            builder.environment().put("DB_PATCH_ID", "version-sync-" + job.jobId.toLowerCase(Locale.ROOT));
            builder.environment().put("DB_PATCH_NAME", defaultIfBlank(job.releaseTitle, job.releaseVersion));
            builder.environment().put("DB_PATCH_SOURCE_ENV", "local");
            builder.environment().put("DB_PATCH_TARGET_ENV", "remote-main");
            builder.environment().put("DB_PATCH_DIRECTION", "LOCAL_TO_REMOTE");
            builder.environment().put("DB_PATCH_RISK_LEVEL", "HIGH");
            builder.environment().put("COMMIT_MESSAGE", buildCommitMessage(job));
            appendJobLog(job, (isEn ? "Launching deploy script copy: " : "배포 스크립트 복사본 실행: ") + executionScript);
            appendJobLog(job, (isEn ? "Remote deploy mode: " : "원격 배포 모드: ") + defaultIfBlank(job.remoteDeployMode, DEFAULT_REMOTE_DEPLOY_MODE));
            appendJobLog(job, (isEn ? "Remote batch transport: " : "원격 배치 전송 방식: ") + "ssh");
            appendJobLog(job, (isEn ? "Execution source contract: " : "실행 소스 계약: ")
                    + "EXECUTION_SOURCE=page, SIGNED_EXECUTION_REQUEST_ID=" + job.deploymentHistoryId
                    + ", APPROVED_TARGET_HOSTS=" + job.serverTarget);
            process = builder.start();
            ByteArrayOutputStream stdout = new ByteArrayOutputStream();
            ByteArrayOutputStream stderr = new ByteArrayOutputStream();
            Thread stdoutThread = streamToLog(process.getInputStream(), stdout, line -> appendJobLog(job, line));
            Thread stderrThread = streamToLog(process.getErrorStream(), stderr, line -> appendJobLog(job, line));
            int exitCode = process.waitFor();
            stdoutThread.join();
            stderrThread.join();
            if (exitCode != 0) {
                String failureMessage = summarizeFailure(stderr.toString(StandardCharsets.UTF_8),
                        stdout.toString(StandardCharsets.UTF_8),
                        isEn);
                throw new IllegalStateException(failureMessage.isEmpty()
                        ? (isEn ? "Remote sync/deploy command failed." : "원격 동기화/배포 명령 실행에 실패했습니다.")
                        : failureMessage);
            }
            job.status = "SUCCESS";
            job.resultMessage = isEn
                    ? "Remote DB sync, Git push, and 221 deploy completed."
                    : "원격 DB 동기화, Git push, 221 배포가 완료되었습니다.";
            safeUpdateDeploymentHistory(job, false, isEn);
            appendJobLog(job, job.resultMessage);
        } catch (Exception ex) {
            job.status = "FAILED";
            job.resultMessage = safe(ex.getMessage()).isEmpty()
                    ? (isEn ? "Remote sync/deploy command failed." : "원격 동기화/배포 명령 실행에 실패했습니다.")
                    : safe(ex.getMessage());
            safeUpdateDeploymentHistory(job, false, isEn);
            appendJobLog(job, job.resultMessage);
        } finally {
            if (process != null && process.isAlive()) {
                process.destroyForcibly();
            }
            if (executionScript != null) {
                try {
                    Files.deleteIfExists(executionScript);
                } catch (Exception ignored) {
                }
            }
            job.finishedAt = LocalDateTime.now();
            job.updatedAt = job.finishedAt;
            safeUpdateDeploymentHistory(job, true, isEn);
            appendJobLog(job, (isEn ? "Remote sync/deploy job finished: " : "원격 동기화/배포 작업이 종료되었습니다: ") + job.status);
        }
    }

    private void updateDeploymentHistory(RemoteAutomationJob job, boolean finished) {
        if (job == null || safe(job.deploymentHistoryId).isEmpty()) {
            return;
        }
        projectVersionManagementMapper.updateProjectDeploymentHistory(orderedMap(
                "deploymentHistoryId", job.deploymentHistoryId,
                "status", job.status,
                "serverTarget", job.serverTarget,
                "releaseUnitId", job.releaseUnitId,
                "deployTraceId", job.deployTraceId,
                "gitCommitSha", job.gitCommitSha,
                "resultMessage", safe(job.resultMessage),
                "finishedYn", finished ? "Y" : "N"));
    }

    private void safeUpdateDeploymentHistory(RemoteAutomationJob job, boolean finished, boolean isEn) {
        try {
            updateDeploymentHistory(job, finished);
        } catch (Exception ex) {
            appendJobLog(job, defaultIfBlank(safe(ex.getMessage()),
                    isEn ? "Deployment history update failed." : "배포 이력 갱신에 실패했습니다."));
        }
    }

    private Thread streamToLog(InputStream inputStream,
                               ByteArrayOutputStream buffer,
                               java.util.function.Consumer<String> logger) {
        Thread thread = new Thread(() -> {
            try (InputStream source = inputStream) {
                byte[] bytes = new byte[2048];
                int read;
                while ((read = source.read(bytes)) >= 0) {
                    if (read <= 0) {
                        continue;
                    }
                    synchronized (buffer) {
                        buffer.write(bytes, 0, read);
                    }
                    String chunk = new String(bytes, 0, read, StandardCharsets.UTF_8);
                    for (String line : chunk.split("\\R")) {
                        String trimmed = safe(line);
                        if (!trimmed.isEmpty()) {
                            logger.accept(trimmed);
                        }
                    }
                }
            } catch (Exception ignored) {
            }
        }, "version-ops-log-copy");
        thread.setDaemon(true);
        thread.start();
        return thread;
    }

    private void appendJobLog(RemoteAutomationJob job, String line) {
        if (job == null || safe(line).isEmpty()) {
            return;
        }
        String message = "[" + LocalDateTime.now().format(TIME_FORMAT) + "] " + line;
        synchronized (job) {
            job.updatedAt = LocalDateTime.now();
            job.logLines.add(message);
            while (job.logLines.size() > MAX_LOG_LINES) {
                job.logLines.remove(0);
            }
            try {
                Files.createDirectories(JOB_LOG_DIRECTORY);
                Files.writeString(job.logPath, message + System.lineSeparator(), StandardCharsets.UTF_8,
                        StandardOpenOption.CREATE, StandardOpenOption.APPEND);
            } catch (Exception ignored) {
            }
        }
    }

    private RemoteAutomationJob findActiveJob() {
        return jobs.values().stream()
                .filter(job -> "QUEUED".equals(job.status) || "RUNNING".equals(job.status))
                .sorted(Comparator.comparing(job -> job.startedAt))
                .findFirst()
                .orElse(null);
    }

    private Map<String, Object> buildCurrentJobPayload() {
        RemoteAutomationJob activeJob = findActiveJob();
        if (activeJob != null) {
            return toJobPayload(activeJob);
        }
        return jobs.values().stream()
                .sorted((left, right) -> right.startedAt.compareTo(left.startedAt))
                .findFirst()
                .map(this::toJobPayload)
                .orElse(null);
    }

    private List<Map<String, Object>> buildRecentJobPayloads() {
        return jobs.values().stream()
                .sorted((left, right) -> right.startedAt.compareTo(left.startedAt))
                .limit(10)
                .map(this::toJobPayload)
                .collect(Collectors.toList());
    }

    private Map<String, Object> toJobPayload(RemoteAutomationJob job) {
        return orderedMap(
                "jobId", job.jobId,
                "projectId", job.projectId,
                "executionType", job.executionType,
                "profileName", job.profileName,
                "remoteDeployMode", job.remoteDeployMode,
                "actorId", job.actorId,
                "status", job.status,
                "startedAt", formatTime(job.startedAt),
                "finishedAt", formatTime(job.finishedAt),
                "updatedAt", formatTime(job.updatedAt),
                "duration", formatDuration(job.startedAt, job.finishedAt),
                "resultMessage", safe(job.resultMessage),
                "logLines", new ArrayList<String>(job.logLines));
    }

    private String formatTime(LocalDateTime value) {
        return value == null ? "" : value.format(TIME_FORMAT);
    }

    private String formatDuration(LocalDateTime startedAt, LocalDateTime finishedAt) {
        if (startedAt == null) {
            return "";
        }
        Duration duration = Duration.between(startedAt, finishedAt == null ? LocalDateTime.now() : finishedAt);
        long seconds = Math.max(0L, duration.getSeconds());
        long hours = seconds / 3600L;
        long minutes = (seconds % 3600L) / 60L;
        long remainSeconds = seconds % 60L;
        if (hours > 0L) {
            return hours + "h " + minutes + "m " + remainSeconds + "s";
        }
        if (minutes > 0L) {
            return minutes + "m " + remainSeconds + "s";
        }
        return remainSeconds + "s";
    }

    private String lastNonBlank(String... values) {
        if (values == null) {
            return "";
        }
        for (String value : values) {
            String[] lines = safe(value).split("\\R");
            for (int index = lines.length - 1; index >= 0; index--) {
                String trimmed = safe(lines[index]);
                if (!trimmed.isEmpty()) {
                    return trimmed;
                }
            }
        }
        return "";
    }

    private String summarizeFailure(String stderr, String stdout, boolean isEn) {
        String prioritized = findFailureSummary(stderr, stdout);
        if (!prioritized.isEmpty()) {
            return prioritized;
        }
        String lastLine = lastNonBlank(stderr, stdout);
        if (!lastLine.isEmpty()) {
            return lastLine;
        }
        return isEn ? "Remote sync/deploy command failed." : "원격 동기화/배포 명령 실행에 실패했습니다.";
    }

    private String findFailureSummary(String... values) {
        if (values == null) {
            return "";
        }
        for (String marker : FAILURE_SUMMARY_MARKERS) {
            for (String value : values) {
                String matched = findLastMatchingLine(value, marker);
                if (!matched.isEmpty()) {
                    return matched;
                }
            }
        }
        return "";
    }

    private String findLastMatchingLine(String value, String marker) {
        String[] lines = safe(value).split("\\R");
        for (int index = lines.length - 1; index >= 0; index--) {
            String trimmed = safe(lines[index]);
            if (!trimmed.isEmpty() && trimmed.contains(marker)) {
                return trimmed;
            }
        }
        return "";
    }

    private String shellQuote(String value) {
        return "'" + safe(value).replace("'", "'\"'\"'") + "'";
    }

    private String defaultIfBlank(String value, String fallback) {
        String normalized = safe(value);
        return normalized.isEmpty() ? fallback : normalized;
    }

    private String resolveCurrentGitCommitSha() {
        try {
            Process process = new ProcessBuilder("git", "-C", REPOSITORY_ROOT.toString(), "rev-parse", "HEAD").start();
            int exitCode = process.waitFor();
            if (exitCode != 0) {
                return "";
            }
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            try (InputStream inputStream = process.getInputStream()) {
                byte[] bytes = new byte[256];
                int read;
                while ((read = inputStream.read(bytes)) >= 0) {
                    if (read > 0) {
                        buffer.write(bytes, 0, read);
                    }
                }
            }
            return safe(new String(buffer.toByteArray(), StandardCharsets.UTF_8));
        } catch (Exception ignored) {
            return "";
        }
    }

    private String normalizeRemoteDeployMode(String value) {
        String normalized = safe(value).toLowerCase(Locale.ROOT);
        if ("fresh-clone".equals(normalized) || "jar-mosh".equals(normalized) || "pull".equals(normalized)) {
            return normalized;
        }
        return DEFAULT_REMOTE_DEPLOY_MODE;
    }

    private String buildCommitMessage(RemoteAutomationJob job) {
        String releaseVersion = defaultIfBlank(job.releaseVersion, "unspecified-release");
        String actorId = defaultIfBlank(job.actorId, "system");
        return "chore: project version sync deploy "
                + releaseVersion
                + " by "
                + actorId
                + " ["
                + job.jobId
                + "]";
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private Map<String, Object> orderedMap(Object... fields) {
        Map<String, Object> payload = new LinkedHashMap<String, Object>();
        if (fields == null) {
            return payload;
        }
        for (int index = 0; index + 1 < fields.length; index += 2) {
            payload.put(String.valueOf(fields[index]), fields[index + 1]);
        }
        return payload;
    }

    private static final class RemoteAutomationJob {
        private String jobId;
        private String deploymentHistoryId;
        private String projectId;
        private String releaseVersion;
        private String releaseTitle;
        private String releaseContent;
        private String executionType;
        private String profileName;
        private String remoteDeployMode;
        private String actorId;
        private String serverTarget;
        private String releaseUnitId;
        private String deployTraceId;
        private String gitCommitSha;
        private String status;
        private String resultMessage;
        private LocalDateTime startedAt;
        private LocalDateTime finishedAt;
        private LocalDateTime updatedAt;
        private Path logPath;
        private final List<String> logLines = new ArrayList<String>();
    }
}
