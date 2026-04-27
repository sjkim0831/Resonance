package egovframework.com.platform.codex.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.platform.workbench.model.SrTicketRecordVO;
import egovframework.com.platform.codex.model.SrTicketRunnerExecutionVO;
import egovframework.com.platform.codex.service.SrTicketCodexRunnerService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedWriter;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.Reader;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.nio.file.StandardOpenOption;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.locks.ReentrantLock;

@Service("srTicketCodexRunnerService")
@Slf4j
public class SrTicketCodexRunnerServiceImpl implements SrTicketCodexRunnerService {

    private static final DateTimeFormatter TS_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final String DEFAULT_HISTORY_FILE = "/tmp/carbonet-sr-codex-runner-history.jsonl";
    private static final String DEFAULT_WORKSPACE_ROOT = "/tmp/carbonet-sr-codex-runner";

    private final ObjectMapper objectMapper;

    @Value("${security.codex.runner.enabled:false}")
    private boolean runnerEnabled;

    @Value("${security.codex.runner.repo-root:}")
    private String repositoryRoot;

    @Value("${security.codex.runner.workspace-root:/tmp/carbonet-sr-codex-runner}")
    private String workspaceRoot;

    @Value("${security.codex.runner.history-file:/tmp/carbonet-sr-codex-runner-history.jsonl}")
    private String historyFilePath;

    @Value("${security.codex.runner.allowed-path-prefixes:src/main/java,src/main/resources,frontend/src,docs/ai,ops/scripts}")
    private String allowedPathPrefixes;

    @Value("${security.codex.runner.codex-command:}")
    private String codexCommand;

    @Value("${security.codex.runner.plan-command:}")
    private String planCommand;

    @Value("${security.codex.runner.build-command:}")
    private String buildCommand;

    @Value("${security.codex.runner.backend-verify-command:mvn -q -DskipTests package}")
    private String backendVerifyCommand;

    @Value("${security.codex.runner.frontend-verify-command:npm run build}")
    private String frontendVerifyCommand;

    @Value("${security.codex.runner.frontend-verify-workdir:frontend}")
    private String frontendVerifyWorkdir;

    @Value("${security.codex.runner.deploy-command:}")
    private String deployCommand;

    @Value("${security.codex.runner.health-check-url:}")
    private String healthCheckUrl;

    @Value("${security.codex.runner.health-check-timeout-seconds:60}")
    private long healthCheckTimeoutSeconds;

    @Value("${security.codex.runner.health-check-interval-seconds:5}")
    private long healthCheckIntervalSeconds;

    @Value("${security.codex.runner.rollback-command:}")
    private String rollbackCommand;

    @Value("${security.codex.runner.deploy-strategy:blue-green}")
    private String deployStrategy;

    @Value("${security.codex.runner.command-timeout-seconds:1800}")
    private long commandTimeoutSeconds;

    @Value("${security.codex.runner.verify-timeout-seconds:1800}")
    private long verifyTimeoutSeconds;

    @Value("${security.codex.runner.require-approval-token:false}")
    private boolean requireApprovalToken;

    private static final String DESTRUCTIVE_COMMAND_PATTERN = 
        "^(rm|del|format|mkfs|dd|fdisk|sfdisk|parted|shred|chmod\\s+777|chown\\s+-R|chmod\\s+-R\\s+777|git\\s+push\\s+--force|git\\s+push\\s+-f|git\\s+reset\\s+--hard|git\\s+push\\s+--delete|kill\\s+-9|killall|reboot|shutdown|init\\s+6|init\\s+0|systemctl\\s+restart|sudo|su\\s|eval|exec\\s|bash\\s+-c|sh\\s+-c|powershell\\s+-c|cmd\\s+/c)";
    private static final java.util.regex.Pattern DESTRUCTIVE_REGEX = 
        java.util.regex.Pattern.compile(DESTRUCTIVE_COMMAND_PATTERN, java.util.regex.Pattern.CASE_INSENSITIVE);

    private final ReentrantLock historyLock = new ReentrantLock();

    public SrTicketCodexRunnerServiceImpl(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public SrTicketRunnerExecutionVO prepareExecution(SrTicketRecordVO ticket, String actorId, String executionMode) throws Exception {
        String mode = normalizeExecutionMode(executionMode);
        validateRunnerConfiguration(ticket, mode);
        SrTicketRunnerExecutionVO execution = new SrTicketRunnerExecutionVO();
        execution.setRunId(buildRunId());
        execution.setTicketId(safe(ticket.getTicketId()));
        execution.setActorId(defaultActor(actorId));
        execution.setStartedAt(now());
        execution.setStatus("RUNNING");
        execution.setExecutionMode(mode);
        execution.setRepositoryRoot(resolveRepositoryRoot().toString());

        Path runRoot = resolveWorkspaceRoot().resolve(safe(ticket.getTicketId())).resolve(execution.getRunId());
        Path artifactsRoot = runRoot.resolve("artifacts");
        Path worktreePath = runRoot.resolve("worktree");
        Path promptFile = artifactsRoot.resolve("PLAN".equals(mode) ? "codex-plan-prompt.txt" : "codex-build-prompt.txt");
        Path resultFile = artifactsRoot.resolve("PLAN".equals(mode) ? "codex-plan-result.txt" : "codex-build-result.txt");
        Path stdoutFile = artifactsRoot.resolve("PLAN".equals(mode) ? "codex-plan.stdout.log" : "codex-build.stdout.log");
        Path stderrFile = artifactsRoot.resolve("PLAN".equals(mode) ? "codex-plan.stderr.log" : "codex-build.stderr.log");
        Path diffFile = artifactsRoot.resolve("git.diff");
        Path changedFilesFile = artifactsRoot.resolve("changed-files.txt");

        Files.createDirectories(artifactsRoot);
        execution.setWorkspacePath(runRoot.toString());
        execution.setWorktreePath(worktreePath.toString());
        execution.setPromptFilePath(promptFile.toString());
        execution.setResultFilePath(resultFile.toString());
        execution.setStdoutLogPath(stdoutFile.toString());
        execution.setStderrLogPath(stderrFile.toString());
        execution.setDiffFilePath(diffFile.toString());
        return execution;
    }

    @Override
    public SrTicketRunnerExecutionVO execute(SrTicketRecordVO ticket, String actorId, String approvalToken, String executionMode) throws Exception {
        SrTicketRunnerExecutionVO execution = prepareExecution(ticket, actorId, executionMode);
        return executePrepared(ticket, actorId, approvalToken, execution);
    }

    @Override
    public SrTicketRunnerExecutionVO executePrepared(SrTicketRecordVO ticket, String actorId, String approvalToken, SrTicketRunnerExecutionVO execution) throws Exception {
        String mode = normalizeExecutionMode(execution == null ? null : execution.getExecutionMode());
        validateRunnerConfiguration(ticket, mode);
        if ("BUILD".equals(mode)) {
            validateApprovalToken(approvalToken);
        }

        if (execution == null) {
            execution = prepareExecution(ticket, actorId, mode);
        }

        Path runRoot = Paths.get(safe(execution.getWorkspacePath())).normalize();
        Path artifactsRoot = runRoot.resolve("artifacts");
        Path worktreePath = Paths.get(safe(execution.getWorktreePath())).normalize();
        Path promptFile = Paths.get(safe(execution.getPromptFilePath())).normalize();
        Path stdoutFile = Paths.get(safe(execution.getStdoutLogPath())).normalize();
        Path stderrFile = Paths.get(safe(execution.getStderrLogPath())).normalize();
        Path diffFile = Paths.get(safe(execution.getDiffFilePath())).normalize();
        Path changedFilesFile = artifactsRoot.resolve("changed-files.txt");

        writePromptFile(promptFile, ticket, mode);
        appendHistory(execution);

        try {
            prepareWorktree(worktreePath);

            String resolvedCodexCommand = resolveCodexCommand(mode);
            if (!safe(resolvedCodexCommand).isEmpty()) {
                execution.setCodexCommand(safe(resolvedCodexCommand));
                CommandResult codexResult = runConfiguredCommand(resolvedCodexCommand, worktreePath, commandTimeoutSeconds, stdoutFile, stderrFile, execution);
                execution.setCodexExitCode(codexResult.getExitCode());
                if (codexResult.getExitCode() != 0) {
                    execution.setStatus(classifyCodexFailureStatus(stderrFile, mode));
                    execution.setErrorMessage(buildCodexFailureMessage(stderrFile, codexResult.getExitCode()));
                    return finalizeExecution(execution, worktreePath, diffFile, changedFilesFile);
                }
            } else {
                execution.setStatus("RUNNER_BLOCKED");
                execution.setErrorMessage("security.codex.runner." + ("PLAN".equals(mode) ? "plan-command" : "build-command") + " is not configured.");
                return finalizeExecution(execution, worktreePath, diffFile, changedFilesFile);
            }

            collectGitArtifacts(worktreePath, diffFile, changedFilesFile, execution);
            if (!execution.isChangedFilesAllowed()) {
                execution.setStatus("CHANGED_FILE_BLOCKED");
                execution.setErrorMessage("Changed files exceeded the configured allowlist.");
                return finalizeExecution(execution, worktreePath, diffFile, changedFilesFile);
            }

            if ("BUILD".equals(mode) && !safe(frontendVerifyCommand).isEmpty()) {
                Path frontendDir = resolveFrontendVerifyDirectory();
                Path repositoryRootPath = resolveRepositoryRoot();
                if (!frontendDir.startsWith(repositoryRootPath)) {
                    throw new IllegalArgumentException("Frontend verify workdir escaped the repository root.");
                }
                Path frontendStdout = artifactsRoot.resolve("frontend-verify.stdout.log");
                Path frontendStderr = artifactsRoot.resolve("frontend-verify.stderr.log");
                execution.setFrontendVerifyCommand(safe(frontendVerifyCommand));
                execution.setFrontendVerifyStdoutLogPath(frontendStdout.toString());
                execution.setFrontendVerifyStderrLogPath(frontendStderr.toString());
                CommandResult frontendResult = runConfiguredCommand(frontendVerifyCommand, frontendDir, verifyTimeoutSeconds,
                        frontendStdout, frontendStderr, execution);
                execution.setFrontendVerifyExitCode(frontendResult.getExitCode());
                if (frontendResult.getExitCode() != 0) {
                    execution.setStatus("FRONTEND_VERIFY_FAILED");
                    execution.setErrorMessage("Frontend verification failed with exit code " + frontendResult.getExitCode());
                    return finalizeExecution(execution, worktreePath, diffFile, changedFilesFile);
                }
            }

            if ("BUILD".equals(mode) && !safe(backendVerifyCommand).isEmpty()) {
                Path backendStdout = artifactsRoot.resolve("backend-verify.stdout.log");
                Path backendStderr = artifactsRoot.resolve("backend-verify.stderr.log");
                execution.setBackendVerifyCommand(safe(backendVerifyCommand));
                execution.setBackendVerifyStdoutLogPath(backendStdout.toString());
                execution.setBackendVerifyStderrLogPath(backendStderr.toString());
                CommandResult backendResult = runConfiguredCommand(backendVerifyCommand, worktreePath, verifyTimeoutSeconds,
                        backendStdout, backendStderr, execution);
                execution.setBackendVerifyExitCode(backendResult.getExitCode());
                if (backendResult.getExitCode() != 0) {
                    execution.setStatus("BACKEND_VERIFY_FAILED");
                    execution.setErrorMessage("Backend verification failed with exit code " + backendResult.getExitCode());
                    return finalizeExecution(execution, worktreePath, diffFile, changedFilesFile);
                }
            }

            if ("BUILD".equals(mode) && !safe(deployCommand).isEmpty()) {
                execution.setDeployCommand(safe(deployCommand));
                Path deployStdout = artifactsRoot.resolve("deploy.stdout.log");
                Path deployStderr = artifactsRoot.resolve("deploy.stderr.log");
                execution.setDeployStdoutLogPath(deployStdout.toString());
                execution.setDeployStderrLogPath(deployStderr.toString());
                CommandResult deployResult = runConfiguredCommand(deployCommand, worktreePath, verifyTimeoutSeconds,
                        deployStdout, deployStderr, execution);
                execution.setDeployExitCode(deployResult.getExitCode());
                if (deployResult.getExitCode() != 0) {
                    execution.setStatus("DEPLOY_HOOK_FAILED");
                    execution.setErrorMessage("Deploy hook failed with exit code " + deployResult.getExitCode());
                    return finalizeExecution(execution, worktreePath, diffFile, changedFilesFile);
                }

                if (!safe(healthCheckUrl).isEmpty()) {
                    boolean healthCheckPassed = performHealthCheck(execution);
                    if (!healthCheckPassed) {
                        log.warn("Health check failed after deployment, initiating rollback");
                        boolean rollbackSuccess = performRollback(execution);
                        if (!rollbackSuccess) {
                            execution.setStatus("DEPLOY_FAILED_WITH_ROLLBACK_FAILED");
                            execution.setErrorMessage("Deployment failed and rollback also failed. Manual intervention required.");
                        } else {
                            execution.setStatus("DEPLOY_FAILED_ROLLED_BACK");
                            execution.setErrorMessage("Deployment failed, rolled back successfully.");
                        }
                        return finalizeExecution(execution, worktreePath, diffFile, changedFilesFile);
                    }
                    execution.setHealthCheckStatus("PASSED");
                }
            }

            execution.setStatus("PLAN".equals(mode) ? "PLAN_COMPLETED" : "COMPLETED");
            return finalizeExecution(execution, worktreePath, diffFile, changedFilesFile);
        } catch (Exception e) {
            execution.setStatus("PLAN".equals(mode) ? "PLAN_FAILED" : "RUNNER_ERROR");
            execution.setErrorMessage(safe(e.getMessage()).isEmpty() ? e.getClass().getSimpleName() : safe(e.getMessage()));
            return finalizeExecution(execution, worktreePath, diffFile, changedFilesFile);
        }
    }

    private Path resolveFrontendVerifyDirectory() {
        String configured = safe(frontendVerifyWorkdir).isEmpty() ? "frontend" : safe(frontendVerifyWorkdir);
        Path configuredPath = Paths.get(configured);
        if (configuredPath.isAbsolute()) {
            return configuredPath.normalize();
        }
        return resolveRepositoryRoot().resolve(configuredPath).normalize();
    }

    private void validateRunnerConfiguration(SrTicketRecordVO ticket, String executionMode) {
        if (!runnerEnabled) {
            throw new IllegalArgumentException("Codex runner is disabled.");
        }
        if (ticket == null || safe(ticket.getTicketId()).isEmpty()) {
            throw new IllegalArgumentException("SR ticket is required.");
        }
        String executionStatus = safe(ticket.getExecutionStatus()).toUpperCase(Locale.ROOT);
        if ("PLAN".equals(executionMode)) {
            if (!"READY_FOR_CODEX".equals(executionStatus)
                    && !"PLAN_RUNNING".equals(executionStatus)
                    && !"PLAN_FAILED".equals(executionStatus)
                    && !"PLAN_COMPLETED".equals(executionStatus)) {
                throw new IllegalArgumentException("READY_FOR_CODEX, PLAN_RUNNING 또는 PLAN_* 상태의 티켓만 계획을 실행할 수 있습니다.");
            }
        } else if (!"PLAN_COMPLETED".equals(executionStatus)) {
            throw new IllegalArgumentException("PLAN_COMPLETED 상태의 티켓만 실제 실행할 수 있습니다.");
        }
        if (!"APPROVED".equalsIgnoreCase(safe(ticket.getStatus()))) {
            throw new IllegalArgumentException("승인된 티켓만 실행할 수 있습니다.");
        }
        resolveRepositoryRoot();
        resolveWorkspaceRoot();
    }

    private String normalizeExecutionMode(String executionMode) {
        String normalized = safe(executionMode).toUpperCase(Locale.ROOT);
        return "PLAN".equals(normalized) ? "PLAN" : "BUILD";
    }

    private String resolveCodexCommand(String executionMode) {
        if ("PLAN".equals(executionMode)) {
            return firstNonBlank(safe(planCommand), safe(codexCommand));
        }
        return firstNonBlank(safe(buildCommand), safe(codexCommand));
    }

    private void validateApprovalToken(String approvalToken) {
        if (requireApprovalToken) {
            if (approvalToken == null || approvalToken.isEmpty()) {
                throw new IllegalArgumentException("Approval token is required for execution.");
            }
            if (!isValidApprovalToken(approvalToken)) {
                throw new IllegalArgumentException("Invalid or expired approval token.");
            }
        }
    }

    private boolean isValidApprovalToken(String token) {
        return token != null && token.length() >= 32 && token.matches("^[A-Za-z0-9_-]+$");
    }

    private boolean containsDestructiveCommand(String command) {
        if (command == null || command.isEmpty()) {
            return false;
        }
        return DESTRUCTIVE_REGEX.matcher(command).find();
    }

    private boolean performHealthCheck(SrTicketRunnerExecutionVO execution) {
        if (safe(healthCheckUrl).isEmpty()) {
            return true;
        }
        log.info("Starting health check for URL: {}", healthCheckUrl);
        execution.setHealthCheckStatus("CHECKING");
        
        int maxAttempts = (int) (healthCheckTimeoutSeconds / healthCheckIntervalSeconds);
        for (int attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                java.net.URL url = new java.net.URL(healthCheckUrl);
                java.net.HttpURLConnection conn = (java.net.HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setConnectTimeout(5000);
                conn.setReadTimeout(5000);
                int responseCode = conn.getResponseCode();
                conn.disconnect();
                
                if (responseCode >= 200 && responseCode < 300) {
                    log.info("Health check passed on attempt {}", attempt);
                    return true;
                }
                log.debug("Health check attempt {} returned status {}", attempt, responseCode);
            } catch (Exception e) {
                log.debug("Health check attempt {} failed: {}", attempt, e.getMessage());
            }
            
            if (attempt < maxAttempts) {
                try {
                    Thread.sleep(healthCheckIntervalSeconds * 1000);
                } catch (InterruptedException ignored) {
                    Thread.currentThread().interrupt();
                    break;
                }
            }
        }
        
        log.warn("Health check failed after {} attempts", maxAttempts);
        execution.setHealthCheckStatus("FAILED");
        return false;
    }

    private boolean performRollback(SrTicketRunnerExecutionVO execution) {
        if (safe(rollbackCommand).isEmpty()) {
            log.warn("Rollback command not configured, cannot rollback");
            execution.setRollbackStatus("NO_ROLLBACK_CONFIGURED");
            return false;
        }
        
        log.info("Executing rollback command: {}", rollbackCommand);
        execution.setRollbackStatus("EXECUTING");
        
        try {
            Path worktreePath = Paths.get(execution.getWorktreePath());
            List<String> tokens = tokenize(rollbackCommand);
            List<String> resolved = new ArrayList<String>();
            for (String token : tokens) {
                resolved.add(applyPlaceholders(token, execution));
            }
            CommandResult result = runCommand(resolved, worktreePath.getParent(), verifyTimeoutSeconds, null, null);
            
            if (result.getExitCode() == 0) {
                execution.setRollbackStatus("COMPLETED");
                log.info("Rollback completed successfully");
                return true;
            } else {
                execution.setRollbackStatus("FAILED");
                execution.setErrorMessage("Rollback command failed with exit code " + result.getExitCode());
                log.error("Rollback failed with exit code {}", result.getExitCode());
                return false;
            }
        } catch (Exception e) {
            execution.setRollbackStatus("FAILED");
            execution.setErrorMessage("Rollback execution failed: " + e.getMessage());
            log.error("Rollback execution failed", e);
            return false;
        }
    }

    private SrTicketRunnerExecutionVO finalizeExecution(SrTicketRunnerExecutionVO execution, Path worktreePath, Path diffFile,
                                                        Path changedFilesFile) throws Exception {
        try {
            if (Files.exists(worktreePath)) {
                collectGitArtifacts(worktreePath, diffFile, changedFilesFile, execution);
            }
        } catch (Exception e) {
            log.warn("Failed to refresh git artifacts for SR runner execution {}", execution.getRunId(), e);
        }
        execution.setCompletedAt(now());
        appendHistory(execution);
        return execution;
    }

    private void prepareWorktree(Path worktreePath) throws Exception {
        deleteDirectory(worktreePath);
        Files.createDirectories(worktreePath.getParent());
        List<String> command = new ArrayList<String>();
        command.add("git");
        command.add("worktree");
        command.add("add");
        command.add("--detach");
        command.add(worktreePath.toString());
        runCommand(command, resolveRepositoryRoot(), commandTimeoutSeconds, null, null);
        linkFrontendNodeModules(worktreePath);
    }

    private void linkFrontendNodeModules(Path worktreePath) {
        Path repositoryFrontendNodeModules = resolveRepositoryRoot().resolve("frontend/node_modules").normalize();
        Path worktreeFrontendDir = worktreePath.resolve("frontend").normalize();
        Path worktreeFrontendNodeModules = worktreeFrontendDir.resolve("node_modules").normalize();
        if (!Files.isDirectory(worktreeFrontendDir) || !Files.exists(repositoryFrontendNodeModules)) {
            return;
        }
        try {
            Files.deleteIfExists(worktreeFrontendNodeModules);
            Files.createSymbolicLink(worktreeFrontendNodeModules, repositoryFrontendNodeModules);
        } catch (Exception e) {
            log.warn("Failed to link frontend/node_modules into worktree {}", worktreePath, e);
        }
    }

    private void collectGitArtifacts(Path worktreePath, Path diffFile, Path changedFilesFile, SrTicketRunnerExecutionVO execution) throws Exception {
        if (!Files.exists(worktreePath)) {
            execution.setChangedFiles(Collections.<String>emptyList());
            execution.setChangedFilesAllowed(true);
            execution.setChangedFilesSummary("");
            return;
        }
        writeCommandOutput(listCommand("git", "diff", "--binary"), worktreePath, diffFile);
        List<String> changedFiles = readCommandOutput(listCommand("git", "diff", "--name-only"), worktreePath);
        execution.setChangedFiles(changedFiles);
        execution.setChangedFilesSummary(joinLines(changedFiles));
        writeLines(changedFilesFile, changedFiles);
        execution.setChangedFilesAllowed(allChangedFilesAllowed(changedFiles));
    }

    private boolean allChangedFilesAllowed(List<String> changedFiles) {
        List<String> prefixes = parseAllowedPrefixes();
        for (String file : changedFiles == null ? Collections.<String>emptyList() : changedFiles) {
            String normalized = normalizeRelativePath(file);
            boolean allowed = false;
            for (String prefix : prefixes) {
                if (normalized.equals(prefix) || normalized.startsWith(prefix + "/")) {
                    allowed = true;
                    break;
                }
            }
            if (!allowed) {
                return false;
            }
        }
        return true;
    }

    private List<String> parseAllowedPrefixes() {
        List<String> results = new ArrayList<String>();
        for (String token : safe(allowedPathPrefixes).split(",")) {
            String trimmed = normalizeRelativePath(token);
            if (!trimmed.isEmpty()) {
                results.add(trimmed);
            }
        }
        return results;
    }

    private CommandResult runConfiguredCommand(String template, Path workingDirectory, long timeoutSeconds,
                                               Path stdoutPath, Path stderrPath, SrTicketRunnerExecutionVO execution) throws Exception {
        List<String> tokens = tokenize(template);
        if (tokens.isEmpty()) {
            throw new IllegalArgumentException("Runner command template is empty.");
        }
        List<String> resolved = new ArrayList<String>();
        for (int i = 0; i < tokens.size(); i++) {
            String resolvedToken = applyPlaceholders(tokens.get(i), execution);
            if (i == 0) {
                resolvedToken = resolveExecutableToken(resolvedToken);
            }
            resolved.add(resolvedToken);
        }
        return runCommand(resolved, workingDirectory, timeoutSeconds, stdoutPath, stderrPath);
    }

    private String resolveExecutableToken(String token) {
        String normalized = safe(token);
        if (normalized.isEmpty()) {
            return normalized;
        }
        if (normalized.startsWith("/") || !normalized.contains("/")) {
            return normalized;
        }
        Path candidate = resolveRepositoryRoot().resolve(normalized).normalize();
        return candidate.toString();
    }

    private String classifyCodexFailureStatus(Path stderrFile, String executionMode) {
        String stderr = readFailureSnippet(stderrFile).toLowerCase(Locale.ROOT);
        if (stderr.contains("usage limit")
                || stderr.contains("upgrade to plus")
                || stderr.contains("not logged in")
                || stderr.contains("login")
                || stderr.contains("api key")
                || stderr.contains("authentication")
                || stderr.contains("rate limit")) {
            return "RUNNER_BLOCKED";
        }
        return "PLAN".equals(executionMode) ? "PLAN_FAILED" : "CODEX_FAILED";
    }

    private String buildCodexFailureMessage(Path stderrFile, int exitCode) {
        String stderrSummary = firstMeaningfulFailureLine(readFailureSnippet(stderrFile));
        if (!stderrSummary.isEmpty()) {
            return stderrSummary;
        }
        return "Codex command exited with code " + exitCode;
    }

    private String readFailureSnippet(Path stderrFile) {
        if (stderrFile == null || !Files.exists(stderrFile)) {
            return "";
        }
        StringBuilder builder = new StringBuilder();
        try (BufferedReader reader = Files.newBufferedReader(stderrFile, StandardCharsets.UTF_8)) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (builder.length() > 0) {
                    builder.append('\n');
                }
                builder.append(line);
                if (builder.length() >= 4000) {
                    break;
                }
            }
        } catch (IOException e) {
            log.debug("Failed to read Codex stderr snippet from {}", stderrFile, e);
            return "";
        }
        return builder.toString();
    }

    private String firstMeaningfulFailureLine(String stderrContent) {
        for (String line : safe(stderrContent).split("\\R")) {
            String trimmed = safe(line);
            if (trimmed.isEmpty()
                    || trimmed.startsWith("OpenAI Codex v")
                    || trimmed.startsWith("--------")
                    || trimmed.startsWith("workdir:")
                    || trimmed.startsWith("model:")
                    || trimmed.startsWith("provider:")
                    || trimmed.startsWith("approval:")
                    || trimmed.startsWith("sandbox:")
                    || trimmed.startsWith("reasoning ")
                    || trimmed.startsWith("session id:")
                    || "user".equalsIgnoreCase(trimmed)
                    || trimmed.startsWith("mcp startup:")) {
                continue;
            }
            return trimmed;
        }
        return "";
    }

    private CommandResult runCommand(List<String> command, Path workingDirectory, long timeoutSeconds,
                                     Path stdoutPath, Path stderrPath) throws Exception {
        ProcessBuilder builder = new ProcessBuilder(command);
        builder.directory(workingDirectory.toFile());
        builder.redirectErrorStream(false);
        Process process = builder.start();

        StreamCollector stdout = new StreamCollector(process.getInputStream(), stdoutPath);
        StreamCollector stderr = new StreamCollector(process.getErrorStream(), stderrPath);
        Thread stdoutThread = new Thread(stdout, "sr-runner-stdout");
        Thread stderrThread = new Thread(stderr, "sr-runner-stderr");
        stdoutThread.start();
        stderrThread.start();

        boolean finished = process.waitFor(Math.max(1L, timeoutSeconds), TimeUnit.SECONDS);
        if (!finished) {
            process.destroyForcibly();
            stdoutThread.join(TimeUnit.SECONDS.toMillis(5));
            stderrThread.join(TimeUnit.SECONDS.toMillis(5));
            throw new IllegalStateException("Command timed out: " + joinLines(command));
        }
        stdoutThread.join(TimeUnit.SECONDS.toMillis(5));
        stderrThread.join(TimeUnit.SECONDS.toMillis(5));
        return new CommandResult(process.exitValue());
    }

    private List<String> readCommandOutput(List<String> command, Path workingDirectory) throws Exception {
        ProcessBuilder builder = new ProcessBuilder(command);
        builder.directory(workingDirectory.toFile());
        builder.redirectErrorStream(true);
        Process process = builder.start();
        List<String> lines = new ArrayList<String>();
        Reader reader = new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8);
        StringBuilder current = new StringBuilder();
        int value;
        while ((value = reader.read()) != -1) {
            if (value == '\n') {
                String line = safe(current.toString());
                if (!line.isEmpty()) {
                    lines.add(line);
                }
                current.setLength(0);
            } else if (value != '\r') {
                current.append((char) value);
            }
        }
        String last = safe(current.toString());
        if (!last.isEmpty()) {
            lines.add(last);
        }
        if (!process.waitFor(Math.max(1L, commandTimeoutSeconds), TimeUnit.SECONDS)) {
            process.destroyForcibly();
            throw new IllegalStateException("Command timed out: " + joinLines(command));
        }
        if (process.exitValue() != 0) {
            throw new IllegalStateException("Command failed with exit code " + process.exitValue() + ": " + joinLines(command));
        }
        return lines;
    }

    private void writeCommandOutput(List<String> command, Path workingDirectory, Path outputFile) throws Exception {
        List<String> lines = readCommandOutput(command, workingDirectory);
        writeLines(outputFile, lines);
    }

    private void writePromptFile(Path promptFile, SrTicketRecordVO ticket, String executionMode) throws IOException {
        List<String> lines = new ArrayList<String>();
        lines.add("Carbonet SR Ticket Runner");
        lines.add("mode=" + executionMode);
        lines.add("ticketId=" + safe(ticket.getTicketId()));
        lines.add("pageId=" + safe(ticket.getPageId()));
        lines.add("page=" + safe(ticket.getPageLabel()));
        lines.add("route=" + safe(ticket.getRoutePath()));
        lines.add("summary=" + safe(ticket.getSummary()));
        lines.add("");
        lines.add("instructionMode=");
        if ("PLAN".equals(executionMode)) {
            lines.add("Review the request and return an implementation plan only.");
            lines.add("Do not modify any files in the repository.");
            lines.add("Include target files, risks, and verification steps.");
        } else {
            lines.add("Implement the approved SR ticket in this isolated worktree.");
            lines.add("Keep changes inside the allowed repository paths.");
            lines.add("Leave a concise implementation summary and verification notes.");
        }
        lines.add("instruction=");
        lines.add(safe(ticket.getInstruction()));
        lines.add("");
        lines.add("technicalContext=");
        lines.add(safe(ticket.getTechnicalContext()));
        lines.add("");
        lines.add("generatedDirection=");
        lines.add(safe(ticket.getGeneratedDirection()));
        lines.add("");
        lines.add("commandPrompt=");
        lines.add(safe(ticket.getCommandPrompt()));
        writeLines(promptFile, lines);
    }

    private void writeLines(Path file, List<String> lines) throws IOException {
        Files.createDirectories(file.getParent());
        try (BufferedWriter writer = Files.newBufferedWriter(file, StandardCharsets.UTF_8,
                StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING, StandardOpenOption.WRITE)) {
            for (String line : lines == null ? Collections.<String>emptyList() : lines) {
                writer.write(line == null ? "" : line);
                writer.newLine();
            }
        }
    }

    private void appendHistory(SrTicketRunnerExecutionVO execution) {
        historyLock.lock();
        try {
            Path historyFile = resolveHistoryFile();
            Files.createDirectories(historyFile.getParent());
            try (Writer writer = Files.newBufferedWriter(historyFile, StandardCharsets.UTF_8,
                    StandardOpenOption.CREATE, StandardOpenOption.APPEND, StandardOpenOption.WRITE)) {
                writer.write(objectMapper.writeValueAsString(execution));
                writer.write(System.lineSeparator());
            }
        } catch (Exception e) {
            log.warn("Failed to append SR runner history.", e);
        } finally {
            historyLock.unlock();
        }
    }

    private Path resolveRepositoryRoot() {
        String path = safe(repositoryRoot);
        if (path.isEmpty()) {
            throw new IllegalArgumentException("security.codex.runner.repo-root is not configured.");
        }
        Path root = Paths.get(path).normalize();
        if (!Files.isDirectory(root)) {
            throw new IllegalArgumentException("Configured repository root does not exist: " + root);
        }
        return root;
    }

    private Path resolveWorkspaceRoot() {
        String path = safe(workspaceRoot);
        if (path.isEmpty()) {
            path = DEFAULT_WORKSPACE_ROOT;
        }
        Path root = Paths.get(path).normalize();
        try {
            Files.createDirectories(root);
        } catch (IOException e) {
            throw new IllegalArgumentException("Failed to create runner workspace root: " + root, e);
        }
        return root;
    }

    private Path resolveHistoryFile() {
        String path = safe(historyFilePath);
        if (path.isEmpty()) {
            path = DEFAULT_HISTORY_FILE;
        }
        return Paths.get(path).normalize();
    }

    private List<String> tokenize(String command) {
        List<String> tokens = new ArrayList<String>();
        StringBuilder current = new StringBuilder();
        boolean singleQuoted = false;
        boolean doubleQuoted = false;
        for (int i = 0; i < safe(command).length(); i++) {
            char ch = command.charAt(i);
            if (ch == '\'' && !doubleQuoted) {
                singleQuoted = !singleQuoted;
                continue;
            }
            if (ch == '"' && !singleQuoted) {
                doubleQuoted = !doubleQuoted;
                continue;
            }
            if (Character.isWhitespace(ch) && !singleQuoted && !doubleQuoted) {
                if (current.length() > 0) {
                    tokens.add(current.toString());
                    current.setLength(0);
                }
                continue;
            }
            current.append(ch);
        }
        if (current.length() > 0) {
            tokens.add(current.toString());
        }
        return tokens;
    }

    private String applyPlaceholders(String token, SrTicketRunnerExecutionVO execution) {
        return token
                .replace("{ticketId}", safe(execution.getTicketId()))
                .replace("{runId}", safe(execution.getRunId()))
                .replace("{repoRoot}", safe(execution.getRepositoryRoot()))
                .replace("{workspace}", safe(execution.getWorkspacePath()))
                .replace("{worktree}", safe(execution.getWorktreePath()))
                .replace("{promptFile}", safe(execution.getPromptFilePath()))
                .replace("{resultFile}", safe(execution.getResultFilePath()))
                .replace("{stdoutLog}", safe(execution.getStdoutLogPath()))
                .replace("{stderrLog}", safe(execution.getStderrLogPath()))
                .replace("{diffFile}", safe(execution.getDiffFilePath()));
    }

    private void deleteDirectory(Path path) throws IOException {
        if (path == null || !Files.exists(path)) {
            return;
        }
        if (Files.isDirectory(path)) {
            try (DirectoryStream<Path> stream = Files.newDirectoryStream(path)) {
                for (Path child : stream) {
                    deleteDirectory(child);
                }
            }
        }
        Files.deleteIfExists(path);
    }

    private String buildRunId() {
        return "RUN-" + UUID.randomUUID().toString().replace("-", "").substring(0, 12).toUpperCase(Locale.ROOT);
    }

    private String joinLines(List<String> values) {
        StringBuilder builder = new StringBuilder();
        for (String value : values == null ? Collections.<String>emptyList() : values) {
            if (builder.length() > 0) {
                builder.append('\n');
            }
            builder.append(value == null ? "" : value);
        }
        return builder.toString();
    }

    private List<String> listCommand(String... values) {
        List<String> result = new ArrayList<String>();
        if (values != null) {
            Collections.addAll(result, values);
        }
        return result;
    }

    private String normalizeRelativePath(String value) {
        String normalized = safe(value).replace('\\', '/');
        while (normalized.startsWith("./")) {
            normalized = normalized.substring(2);
        }
        while (normalized.startsWith("/")) {
            normalized = normalized.substring(1);
        }
        return normalized;
    }

    private String defaultActor(String actorId) {
        return safe(actorId).isEmpty() ? "SYSTEM" : safe(actorId);
    }

    private String now() {
        return LocalDateTime.now().format(TS_FORMAT);
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private String firstNonBlank(String... values) {
        if (values == null) {
            return "";
        }
        for (String value : values) {
            if (!safe(value).isEmpty()) {
                return safe(value);
            }
        }
        return "";
    }

    private static final class CommandResult {
        private final int exitCode;

        private CommandResult(int exitCode) {
            this.exitCode = exitCode;
        }

        private int getExitCode() {
            return exitCode;
        }
    }

    private static final class StreamCollector implements Runnable {
        private final InputStream inputStream;
        private final Path outputFile;

        private StreamCollector(InputStream inputStream, Path outputFile) {
            this.inputStream = inputStream;
            this.outputFile = outputFile;
        }

        @Override
        public void run() {
            try {
                if (outputFile != null) {
                    Files.createDirectories(outputFile.getParent());
                    try (BufferedWriter writer = Files.newBufferedWriter(outputFile, StandardCharsets.UTF_8,
                            StandardOpenOption.CREATE, StandardOpenOption.TRUNCATE_EXISTING, StandardOpenOption.WRITE);
                         Reader reader = new InputStreamReader(inputStream, StandardCharsets.UTF_8)) {
                        char[] buffer = new char[2048];
                        int read;
                        while ((read = reader.read(buffer)) != -1) {
                            writer.write(buffer, 0, read);
                        }
                    }
                } else {
                    Reader reader = new InputStreamReader(inputStream, StandardCharsets.UTF_8);
                    char[] buffer = new char[2048];
                    while (reader.read(buffer) != -1) {
                        // drain stream
                    }
                }
            } catch (IOException ignored) {
                // best effort logging
            }
        }
    }
}
// agent note: updated by FreeAgent Ultra
