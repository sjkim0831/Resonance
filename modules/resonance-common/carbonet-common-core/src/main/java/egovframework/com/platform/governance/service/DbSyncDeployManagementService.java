package egovframework.com.platform.governance.service;

import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.security.MessageDigest;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class DbSyncDeployManagementService {

    private static final DateTimeFormatter TS_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");
    private static final Pattern SQL_FILE_LIST_DEFAULT_PATTERN = Pattern.compile("SQL_FILE_LIST_DEFAULT=\\\"([^\\\"]*)\\\"");
    private static final long COMMAND_TIMEOUT_SECONDS = 1800L;
    private static final String DEFAULT_SERVER_UP_TEST_ROUTE = "/admin/system/version?projectId=carbonet";
    private static final String HISTORY_LEDGER_PATH = "var/run/db-sync-deploy-history.tsv";

    public Map<String, Object> buildPageData(boolean isEn) {
        return buildPayload(isEn, false);
    }

    public Map<String, Object> analyze(boolean isEn) {
        Map<String, Object> payload = buildPayload(isEn, true);
        payload.put("dbSyncDeployAnalyzeMessage", isEn
                ? "Preflight analysis refreshed from current script and local repository state."
                : "현재 스크립트와 로컬 저장소 상태를 기준으로 사전 점검 결과를 다시 계산했습니다.");
        payload.put("success", true);
        return payload;
    }

    public Map<String, Object> validatePolicy(boolean isEn) {
        Map<String, Object> payload = buildPayload(isEn, true);
        payload.put("dbSyncDeployPolicyValidationRows", buildPolicyValidationRows(payload, isEn));
        payload.put("dbSyncDeployValidateMessage", isEn
                ? "Policy validation completed. Blocked rows must be cleared before real DB sync deploy execution."
                : "정책 검증을 완료했습니다. 실제 DB 동기화 배포 실행 전 차단 항목을 해소해야 합니다.");
        payload.put("success", true);
        return payload;
    }

    public Map<String, Object> execute(Map<String, Object> requestBody, String actorId, boolean isEn) {
        String executionMode = safe(value(requestBody, "executionMode")).toUpperCase(Locale.ROOT);
        if (executionMode.isEmpty()) {
            executionMode = "SERVER_UP_TEST";
        }
        if (!"SERVER_UP_TEST".equals(executionMode)) {
            throw new IllegalArgumentException(isEn ? "Unsupported execution mode." : "지원하지 않는 실행 모드입니다.");
        }

        String targetRoute = safe(value(requestBody, "targetRoute"));
        if (targetRoute.isEmpty()) {
            targetRoute = DEFAULT_SERVER_UP_TEST_ROUTE;
        }

        CommandResult restartResult = runCommand(
                List.of("bash", "ops/scripts/build-restart-18000.sh"),
                Collections.emptyMap(),
                COMMAND_TIMEOUT_SECONDS,
                isEn ? "Failed to rebuild and restart :18000." : ":18000 재빌드/재기동에 실패했습니다.");
        CommandResult freshnessResult = runCommand(
                List.of("bash", "-lc", "VERIFY_WAIT_SECONDS=20 bash ops/scripts/codex-verify-18000-freshness.sh"),
                Collections.emptyMap(),
                COMMAND_TIMEOUT_SECONDS,
                isEn ? "Freshness verification failed." : "freshness 검증에 실패했습니다.");
        CommandResult routeResult = runCommand(
                List.of("bash", "-lc", "curl -ksSI " + shellQuote("https://127.0.0.1:18000" + targetRoute)),
                Collections.emptyMap(),
                120L,
                isEn ? "Route verification failed." : "대상 라우트 검증에 실패했습니다.");
        CommandResult shellResult = runCommand(
                List.of("bash", "-lc", "curl -ksSI https://127.0.0.1:18000/react-shell/index.html"),
                Collections.emptyMap(),
                120L,
                isEn ? "React shell verification failed." : "React shell 검증에 실패했습니다.");

        String routeStatus = extractHttpStatus(routeResult.output);
        String shellStatus = extractHttpStatus(shellResult.output);
        if (!"200".equals(shellStatus)) {
            throw new IllegalStateException(isEn
                    ? "React shell did not return HTTP 200."
                    : "React shell 이 HTTP 200으로 응답하지 않았습니다.");
        }
        if (!"200".equals(routeStatus) && !"302".equals(routeStatus)) {
            throw new IllegalStateException((isEn
                    ? "Target route returned unexpected HTTP status: "
                    : "대상 라우트가 예상하지 않은 HTTP 상태를 반환했습니다: ") + routeStatus);
        }

        Map<String, Object> payload = buildPayload(isEn, false);
        payload.put("dbSyncDeployExecuteMessage", isEn
                ? "Server-up test completed through build/restart/freshness/route proof."
                : "build/restart/freshness/route proof 기준 서버 올리기 테스트를 완료했습니다.");
        payload.put("dbSyncDeployExecutionRows", buildExecutionRows(executionMode, targetRoute, actorId, routeStatus, shellStatus, isEn));
        payload.put("dbSyncDeployExecutionLogRows", buildExecutionLogRows(restartResult, freshnessResult, routeResult, shellResult, isEn));
        appendHistory(executionMode, targetRoute, actorId, routeStatus, shellStatus, "PASS");
        payload.put("dbSyncDeployHistoryRows", buildHistoryRows());
        payload.put("success", true);
        return payload;
    }

    private Map<String, Object> buildPayload(boolean isEn, boolean analyzed) {
        Path rootDir = resolveRootDir();
        Path scriptPath = rootDir.resolve("ops/scripts/windows-db-sync-push-and-fresh-deploy-221.sh");
        String scriptText = readFile(scriptPath);
        List<String> sqlFiles = resolveSqlFileDefaults(rootDir, scriptText);

        List<Map<String, String>> guardrails = buildGuardrailRows(scriptText, isEn);
        List<Map<String, String>> sqlRows = buildSqlFileRows(sqlFiles, rootDir);
        List<Map<String, String>> summary = buildSummaryRows(scriptPath, scriptText, sqlRows, guardrails, analyzed, isEn);
        List<Map<String, String>> executionContract = buildExecutionContractRows(isEn);
        List<Map<String, String>> policyValidation = buildInitialPolicyValidationRows(isEn);
        List<Map<String, String>> scriptChain = buildScriptChainRows(isEn);
        List<Map<String, String>> guidance = buildGuidanceRows(isEn);

        Map<String, Object> payload = new LinkedHashMap<String, Object>();
        payload.put("isEn", isEn);
        payload.put("dbSyncDeploySummary", summary);
        payload.put("dbSyncDeployGuardrailRows", guardrails);
        payload.put("dbSyncDeploySqlFileRows", sqlRows);
        payload.put("dbSyncDeployExecutionContractRows", executionContract);
        payload.put("dbSyncDeployPolicyValidationRows", policyValidation);
        payload.put("dbSyncDeployScriptChainRows", scriptChain);
        payload.put("dbSyncDeployGuidance", guidance);
        payload.put("dbSyncDeployScriptPath", relativize(rootDir, scriptPath));
        payload.put("dbSyncDeployGeneratedAt", LocalDateTime.now().format(TS_FORMAT));
        payload.put("dbSyncDeployExecutionRows", new ArrayList<Map<String, String>>());
        payload.put("dbSyncDeployExecutionLogRows", new ArrayList<Map<String, String>>());
        payload.put("dbSyncDeployHistoryRows", buildHistoryRows());
        return payload;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, String>> buildPolicyValidationRows(Map<String, Object> payload, boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<Map<String, String>>();
        List<Map<String, String>> guardrails = (List<Map<String, String>>) payload.getOrDefault("dbSyncDeployGuardrailRows", Collections.emptyList());
        List<Map<String, String>> sqlRows = (List<Map<String, String>>) payload.getOrDefault("dbSyncDeploySqlFileRows", Collections.emptyList());
        boolean guardrailsPass = allStatusPass(guardrails);
        boolean sqlFilesPass = allStatusPresent(sqlRows);
        boolean hasHistory = !buildHistoryRows().isEmpty();
        rows.add(policyValidationRow(
                isEn ? "Guardrail Contract" : "가드레일 계약",
                guardrailsPass ? "PASS" : "BLOCKED",
                guardrailsPass ? (isEn ? "All script-derived guardrails pass." : "스크립트 기반 가드레일이 모두 통과했습니다.")
                        : (isEn ? "One or more script-derived guardrails are warning." : "하나 이상의 스크립트 기반 가드레일이 경고 상태입니다.")));
        rows.add(policyValidationRow(
                isEn ? "Default SQL Set" : "기본 SQL 세트",
                sqlFilesPass ? "PASS" : "BLOCKED",
                sqlFilesPass ? (isEn ? "Every default SQL file exists in the repository." : "모든 기본 SQL 파일이 저장소에 존재합니다.")
                        : (isEn ? "Missing SQL files block real execution." : "누락된 SQL 파일이 있어 실제 실행을 차단합니다.")));
        rows.add(policyValidationRow(
                "EXECUTION_SOURCE",
                "PASS",
                isEn ? "Real execution must still provide page, queue, or breakglass explicitly." : "실제 실행은 page, queue, breakglass 중 하나를 명시해야 합니다."));
        rows.add(policyValidationRow(
                isEn ? "Evidence Ledger" : "증적 원장",
                hasHistory ? "PASS" : "WARN",
                hasHistory ? (isEn ? "At least one governed server-up test run is recorded." : "하나 이상의 중앙 서버 올리기 테스트 실행이 기록되어 있습니다.")
                        : (isEn ? "No governed run has been recorded yet; execute server-up test before real deploy." : "아직 중앙 실행 기록이 없습니다. 실제 배포 전 서버 올리기 테스트를 먼저 실행해야 합니다.")));
        return rows;
    }

    private List<Map<String, String>> buildInitialPolicyValidationRows(boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<Map<String, String>>();
        rows.add(policyValidationRow(
                isEn ? "Validation Not Run" : "검증 미실행",
                "WARN",
                isEn ? "Run Validate Policy before enabling real DB sync deploy execution." : "실제 DB 동기화 배포 실행을 열기 전에 정책 검증을 실행해야 합니다."));
        return rows;
    }

    private List<Map<String, String>> buildExecutionRows(String executionMode,
                                                         String targetRoute,
                                                         String actorId,
                                                         String routeStatus,
                                                         String shellStatus,
                                                         boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<Map<String, String>>();
        rows.add(contractRow(
                isEn ? "Execution Mode" : "실행 모드",
                executionMode,
                isEn ? "Current safe runner path used for this page." : "현재 페이지에서 사용한 안전 실행 경로입니다."));
        rows.add(contractRow(
                isEn ? "Actor" : "실행자",
                safe(actorId).isEmpty() ? "system" : safe(actorId),
                isEn ? "Resolved from the current admin session." : "현재 관리자 세션 기준으로 해석한 실행자입니다."));
        rows.add(contractRow(
                isEn ? "Verified Route" : "검증 라우트",
                targetRoute,
                (isEn ? "HTTP status " : "HTTP 상태 ") + routeStatus));
        rows.add(contractRow(
                isEn ? "React Shell" : "React Shell",
                "/react-shell/index.html",
                (isEn ? "HTTP status " : "HTTP 상태 ") + shellStatus));
        return rows;
    }

    private List<Map<String, String>> buildExecutionLogRows(CommandResult restartResult,
                                                            CommandResult freshnessResult,
                                                            CommandResult routeResult,
                                                            CommandResult shellResult,
                                                            boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<Map<String, String>>();
        rows.add(executionLogRow(
                isEn ? "Build + Restart" : "빌드 + 재기동",
                String.valueOf(restartResult.exitCode),
                tailLines(restartResult.output, 20)));
        rows.add(executionLogRow(
                isEn ? "Freshness Verify" : "Freshness 검증",
                String.valueOf(freshnessResult.exitCode),
                tailLines(freshnessResult.output, 20)));
        rows.add(executionLogRow(
                isEn ? "Target Route HEAD" : "대상 라우트 HEAD",
                String.valueOf(routeResult.exitCode),
                tailLines(routeResult.output, 12)));
        rows.add(executionLogRow(
                isEn ? "React Shell HEAD" : "React Shell HEAD",
                String.valueOf(shellResult.exitCode),
                tailLines(shellResult.output, 12)));
        return rows;
    }

    private List<Map<String, String>> buildSummaryRows(Path scriptPath,
                                                       String scriptText,
                                                       List<Map<String, String>> sqlRows,
                                                       List<Map<String, String>> guardrails,
                                                       boolean analyzed,
                                                       boolean isEn) {
        int existingSqlCount = 0;
        for (Map<String, String> row : sqlRows) {
            if ("PRESENT".equals(row.get("statusCode"))) {
                existingSqlCount++;
            }
        }
        int passCount = 0;
        int warnCount = 0;
        for (Map<String, String> row : guardrails) {
            if ("PASS".equals(row.get("statusCode"))) {
                passCount++;
            } else {
                warnCount++;
            }
        }

        List<Map<String, String>> rows = new ArrayList<Map<String, String>>();
        rows.add(summaryCard(
                isEn ? "Script" : "대상 스크립트",
                scriptPath.getFileName().toString(),
                isEn ? "The governed runner this page is wrapping." : "이 화면이 감싸는 중앙 실행 대상 스크립트입니다."));
        rows.add(summaryCard(
                isEn ? "SQL Defaults" : "기본 SQL 세트",
                String.valueOf(existingSqlCount),
                isEn ? "Resolved from the current script default SQL list." : "현재 스크립트 기본 SQL 파일 목록에서 해석한 결과입니다."));
        rows.add(summaryCard(
                isEn ? "Guardrails" : "가드레일",
                passCount + " PASS / " + warnCount + " WARN",
                isEn ? "Checks derived from the live script content." : "실제 스크립트 내용에서 파생한 점검 결과입니다."));
        rows.add(summaryCard(
                isEn ? "Mode" : "분석 모드",
                analyzed ? (isEn ? "Refreshed Analyze" : "수동 재분석") : (isEn ? "Initial Load" : "초기 로드"),
                scriptText.isEmpty()
                        ? (isEn ? "Script file could not be read." : "스크립트 파일을 읽지 못했습니다.")
                        : (isEn ? "No execution side effects were performed." : "실행 부작용 없이 읽기 전용 분석만 수행했습니다.")));
        return rows;
    }

    private List<Map<String, String>> buildGuardrailRows(String scriptText, boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<Map<String, String>>();
        rows.add(guardrailRow(
                isEn ? "Execution source required" : "실행 소스 필수",
                hasAll(scriptText, "EXECUTION_SOURCE", "page", "queue", "breakglass"),
                isEn ? "Script requires page, queue, or breakglass source declaration."
                        : "스크립트가 page, queue, breakglass 중 하나의 실행 소스를 강제합니다."));
        rows.add(guardrailRow(
                isEn ? "Breakglass metadata required" : "breakglass 메타 필수",
                hasAll(scriptText, "BREAKGLASS_REASON", "BREAKGLASS_APPROVER"),
                isEn ? "Breakglass path requires reason and approver metadata."
                        : "breakglass 경로에 사유와 승인자 메타가 강제됩니다."));
        rows.add(guardrailRow(
                isEn ? "Page or queue request proof required" : "page/queue 요청 증적 필수",
                hasAll(scriptText, "SIGNED_EXECUTION_REQUEST_ID", "POLICY_CHECK_RESULT", "APPROVED_TARGET_HOSTS"),
                isEn ? "Page and queue execution require signed request and policy proof."
                        : "page/queue 실행에 서명된 요청과 정책 검증 증적이 필요합니다."));
        rows.add(guardrailRow(
                isEn ? "DB patch history default-on" : "DB patch history 기본 강제",
                scriptText.contains("REQUIRE_DB_PATCH_HISTORY=\"${REQUIRE_DB_PATCH_HISTORY:-true}\""),
                isEn ? "DB_PATCH_HISTORY recording stays enabled by default."
                        : "DB_PATCH_HISTORY 기록이 기본 활성 상태로 유지됩니다."));
        rows.add(guardrailRow(
                isEn ? "Freshness verification linked" : "freshness 검증 연결",
                scriptText.contains("codex-verify-18000-freshness.sh"),
                isEn ? "Remote deploy flow still runs the freshness verifier."
                        : "원격 배포 흐름이 freshness verifier 를 계속 실행합니다."));
        return rows;
    }

    private List<Map<String, String>> buildSqlFileRows(List<String> sqlFiles, Path rootDir) {
        List<Map<String, String>> rows = new ArrayList<Map<String, String>>();
        for (String file : sqlFiles) {
            Path path = rootDir.resolve(file).normalize();
            boolean exists = Files.exists(path);
            Map<String, String> row = new LinkedHashMap<String, String>();
            row.put("path", file);
            row.put("statusCode", exists ? "PRESENT" : "MISSING");
            row.put("statusLabel", exists ? "PRESENT" : "MISSING");
            row.put("size", exists ? String.valueOf(sizeOf(path)) : "0");
            row.put("checksum", exists ? sha256(path) : "");
            rows.add(row);
        }
        return rows;
    }

    private List<Map<String, String>> buildExecutionContractRows(boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<Map<String, String>>();
        rows.add(contractRow("EXECUTION_SOURCE", "page | queue | breakglass",
                isEn ? "The script now rejects unclassified raw execution."
                        : "분류되지 않은 raw 실행은 이제 스크립트가 거부해야 합니다."));
        rows.add(contractRow("SIGNED_EXECUTION_REQUEST_ID", "required for page/queue",
                isEn ? "Page and queue execution must pass a signed request id."
                        : "page/queue 실행은 서명된 요청 ID를 전달해야 합니다."));
        rows.add(contractRow("POLICY_CHECK_RESULT", "PASS | APPROVED",
                isEn ? "Policy preflight must be completed before execute."
                        : "실행 전에 정책 사전 점검이 완료되어야 합니다."));
        rows.add(contractRow("APPROVED_TARGET_HOSTS", "e.g. 136.117.100.221",
                isEn ? "Target host set must be explicit."
                        : "대상 호스트 집합이 명시되어야 합니다."));
        rows.add(contractRow("BREAKGLASS_REASON / BREAKGLASS_APPROVER", "required for breakglass",
                isEn ? "Exceptional execution must remain auditable."
                        : "예외 실행도 감사 가능해야 합니다."));
        return rows;
    }

    private List<Map<String, String>> buildScriptChainRows(boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<Map<String, String>>();
        rows.add(scriptStep("1", isEn ? "Local snapshot" : "로컬 스냅샷",
                isEn ? "Take the local DB snapshot before any remote apply." : "원격 반영 전 로컬 DB 스냅샷을 먼저 확보합니다."));
        rows.add(scriptStep("2", isEn ? "Remote snapshot" : "원격 스냅샷",
                isEn ? "Capture remote DB state before SQL or diff apply." : "SQL 또는 diff 적용 전 원격 DB 상태를 백업합니다."));
        rows.add(scriptStep("3", isEn ? "Diff and policy verification" : "diff 및 정책 검증",
                isEn ? "Generate schema diff and compare it with promotion policy rules." : "스키마 diff 를 만들고 반영 정책 규칙과 대조합니다."));
        rows.add(scriptStep("4", isEn ? "Apply and record" : "적용 및 기록",
                isEn ? "Apply SQL or diff with DB patch history evidence." : "DB patch history 증적을 남기며 SQL 또는 diff 를 적용합니다."));
        rows.add(scriptStep("5", isEn ? "Push, deploy, freshness" : "push, deploy, freshness",
                isEn ? "Push, restart, and prove runtime freshness after deployment." : "push, 재기동, freshness 검증까지 마친 뒤 런타임 증적을 남깁니다."));
        return rows;
    }

    private List<Map<String, String>> buildGuidanceRows(boolean isEn) {
        List<Map<String, String>> rows = new ArrayList<Map<String, String>>();
        rows.add(guidanceRow(
                isEn ? "This page is analyze-first." : "이 페이지는 analyze-first 입니다.",
                isEn ? "Do not expose execute from the UI before policy, target-host, and rollback evidence are all explicit."
                        : "정책, 대상 호스트, 롤백 증적이 모두 명시되기 전까지는 UI에서 execute 를 열지 않습니다."));
        rows.add(guidanceRow(
                isEn ? "Script drift matters." : "스크립트 드리프트를 봐야 합니다.",
                isEn ? "The page reads the live repository script and default SQL set instead of relying only on documents."
                        : "문서만 보지 않고 실제 저장소의 스크립트와 기본 SQL 세트를 읽어 분석합니다."));
        rows.add(guidanceRow(
                isEn ? "Breakglass stays exceptional." : "breakglass 는 예외 경로입니다.",
                isEn ? "If breakglass becomes common, the control plane is still too weak."
                        : "breakglass 가 흔해지면 중앙 가드레일이 아직 약한 상태입니다."));
        return rows;
    }

    private Map<String, String> summaryCard(String title, String value, String description) {
        Map<String, String> row = new LinkedHashMap<String, String>();
        row.put("title", title);
        row.put("value", value);
        row.put("description", description);
        return row;
    }

    private Map<String, String> guardrailRow(String title, boolean pass, String description) {
        Map<String, String> row = new LinkedHashMap<String, String>();
        row.put("title", title);
        row.put("statusCode", pass ? "PASS" : "WARN");
        row.put("statusLabel", pass ? "PASS" : "WARN");
        row.put("description", description);
        return row;
    }

    private Map<String, String> contractRow(String label, String value, String description) {
        Map<String, String> row = new LinkedHashMap<String, String>();
        row.put("label", label);
        row.put("value", value);
        row.put("description", description);
        return row;
    }

    private Map<String, String> scriptStep(String step, String title, String description) {
        Map<String, String> row = new LinkedHashMap<String, String>();
        row.put("step", step);
        row.put("title", title);
        row.put("description", description);
        return row;
    }

    private Map<String, String> guidanceRow(String title, String body) {
        Map<String, String> row = new LinkedHashMap<String, String>();
        row.put("title", title);
        row.put("body", body);
        return row;
    }

    private Map<String, String> executionLogRow(String step, String exitCode, String preview) {
        Map<String, String> row = new LinkedHashMap<String, String>();
        row.put("step", step);
        row.put("exitCode", exitCode);
        row.put("preview", preview);
        return row;
    }

    private Map<String, String> policyValidationRow(String title, String statusCode, String description) {
        Map<String, String> row = new LinkedHashMap<String, String>();
        row.put("title", title);
        row.put("statusCode", statusCode);
        row.put("statusLabel", statusCode);
        row.put("description", description);
        return row;
    }

    private void appendHistory(String executionMode,
                               String targetRoute,
                               String actorId,
                               String routeStatus,
                               String shellStatus,
                               String result) {
        Path rootDir = resolveRootDir();
        Path ledger = rootDir.resolve(HISTORY_LEDGER_PATH).normalize();
        String runId = "DBSYNC-" + DateTimeFormatter.ofPattern("yyyyMMddHHmmss").format(LocalDateTime.now());
        String line = String.join("\t",
                runId,
                LocalDateTime.now().format(TS_FORMAT),
                safe(actorId).isEmpty() ? "system" : safe(actorId),
                safe(executionMode),
                safe(targetRoute),
                safe(routeStatus),
                safe(shellStatus),
                safe(result)) + "\n";
        try {
            Files.createDirectories(ledger.getParent());
            Files.writeString(ledger, line, StandardCharsets.UTF_8, StandardOpenOption.CREATE, StandardOpenOption.APPEND);
        } catch (IOException ignored) {
            // Runtime evidence remains visible in the current response even if ledger append is unavailable.
        }
    }

    private List<Map<String, String>> buildHistoryRows() {
        Path ledger = resolveRootDir().resolve(HISTORY_LEDGER_PATH).normalize();
        if (!Files.exists(ledger)) {
            return new ArrayList<Map<String, String>>();
        }
        List<String> lines;
        try {
            lines = Files.readAllLines(ledger, StandardCharsets.UTF_8);
        } catch (IOException e) {
            return new ArrayList<Map<String, String>>();
        }
        List<Map<String, String>> rows = new ArrayList<Map<String, String>>();
        int start = Math.max(0, lines.size() - 10);
        for (int index = lines.size() - 1; index >= start; index--) {
            String[] tokens = lines.get(index).split("\\t", -1);
            if (tokens.length < 8) {
                continue;
            }
            Map<String, String> row = new LinkedHashMap<String, String>();
            row.put("runId", tokens[0]);
            row.put("executedAt", tokens[1]);
            row.put("actorId", tokens[2]);
            row.put("executionMode", tokens[3]);
            row.put("targetRoute", tokens[4]);
            row.put("routeStatus", tokens[5]);
            row.put("shellStatus", tokens[6]);
            row.put("result", tokens[7]);
            rows.add(row);
        }
        return rows;
    }

    private boolean allStatusPass(List<Map<String, String>> rows) {
        if (rows == null || rows.isEmpty()) {
            return false;
        }
        for (Map<String, String> row : rows) {
            if (!"PASS".equals(row.get("statusCode"))) {
                return false;
            }
        }
        return true;
    }

    private boolean allStatusPresent(List<Map<String, String>> rows) {
        if (rows == null || rows.isEmpty()) {
            return false;
        }
        for (Map<String, String> row : rows) {
            if (!"PRESENT".equals(row.get("statusCode"))) {
                return false;
            }
        }
        return true;
    }

    private Path resolveRootDir() {
        return Path.of("").toAbsolutePath().normalize();
    }

    private List<String> resolveSqlFileDefaults(Path rootDir, String scriptText) {
        List<String> rows = new ArrayList<String>();
        Matcher matcher = SQL_FILE_LIST_DEFAULT_PATTERN.matcher(scriptText);
        if (!matcher.find()) {
            return rows;
        }
        String raw = matcher.group(1);
        String normalized = raw.replace("$ROOT_DIR/", "");
        rows.addAll(Arrays.asList(normalized.split(":")));
        List<String> cleaned = new ArrayList<String>();
        for (String row : rows) {
            String trimmed = row.trim();
            if (!trimmed.isEmpty()) {
                cleaned.add(trimmed);
            }
        }
        return cleaned;
    }

    private String readFile(Path path) {
        try {
            return Files.exists(path) ? Files.readString(path, StandardCharsets.UTF_8) : "";
        } catch (IOException e) {
            return "";
        }
    }

    private boolean hasAll(String text, String... patterns) {
        if (text == null || text.isEmpty()) {
            return false;
        }
        for (String pattern : patterns) {
            if (!text.contains(pattern)) {
                return false;
            }
        }
        return true;
    }

    private long sizeOf(Path path) {
        try {
            return Files.size(path);
        } catch (IOException e) {
            return 0L;
        }
    }

    private String sha256(Path path) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] bytes = Files.readAllBytes(path);
            byte[] hash = digest.digest(bytes);
            StringBuilder builder = new StringBuilder();
            for (byte b : hash) {
                builder.append(String.format(Locale.ROOT, "%02x", b));
            }
            return builder.toString();
        } catch (Exception e) {
            return "";
        }
    }

    private String relativize(Path rootDir, Path path) {
        try {
            return rootDir.relativize(path).toString().replace('\\', '/');
        } catch (Exception e) {
            return path.toString().replace('\\', '/');
        }
    }

    private CommandResult runCommand(List<String> command,
                                     Map<String, String> extraEnv,
                                     long timeoutSeconds,
                                     String timeoutMessage) {
        try {
            ProcessBuilder builder = new ProcessBuilder(command);
            builder.directory(resolveRootDir().toFile());
            builder.redirectErrorStream(true);
            if (extraEnv != null && !extraEnv.isEmpty()) {
                builder.environment().putAll(extraEnv);
            }
            Process process = builder.start();
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            try (InputStream input = process.getInputStream()) {
                input.transferTo(output);
            }
            boolean finished = process.waitFor(timeoutSeconds, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                throw new IllegalStateException(timeoutMessage);
            }
            String text = output.toString(StandardCharsets.UTF_8);
            int exitCode = process.exitValue();
            if (exitCode != 0) {
                throw new IllegalStateException(text.isBlank() ? timeoutMessage : text);
            }
            return new CommandResult(exitCode, text);
        } catch (Exception e) {
            if (e instanceof IllegalStateException) {
                throw (IllegalStateException) e;
            }
            throw new IllegalStateException(safe(e.getMessage()).isEmpty() ? timeoutMessage : safe(e.getMessage()), e);
        }
    }

    private String extractHttpStatus(String output) {
        if (output == null || output.isBlank()) {
            return "";
        }
        for (String line : output.split("\\R")) {
            String trimmed = safe(line);
            if (trimmed.startsWith("HTTP/")) {
                String[] tokens = trimmed.split("\\s+");
                if (tokens.length >= 2) {
                    return tokens[1];
                }
            }
        }
        return "";
    }

    private String tailLines(String text, int maxLines) {
        if (text == null || text.isBlank()) {
            return "";
        }
        String[] lines = text.split("\\R");
        int start = Math.max(0, lines.length - Math.max(1, maxLines));
        StringBuilder builder = new StringBuilder();
        for (int i = start; i < lines.length; i++) {
            if (builder.length() > 0) {
                builder.append('\n');
            }
            builder.append(lines[i]);
        }
        return builder.toString();
    }

    private String value(Map<String, Object> source, String key) {
        if (source == null || key == null) {
            return "";
        }
        Object value = source.get(key);
        return value == null ? "" : value.toString();
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private String shellQuote(String value) {
        return "'" + safe(value).replace("'", "'\"'\"'") + "'";
    }

    private static final class CommandResult {
        private final int exitCode;
        private final String output;

        private CommandResult(int exitCode, String output) {
            this.exitCode = exitCode;
            this.output = output == null ? "" : output;
        }
    }
}
