package egovframework.com.platform.bootstrap.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class VerificationCenterBootstrapReadService {

    private static final DateTimeFormatter ISO_OFFSET = DateTimeFormatter.ISO_OFFSET_DATE_TIME;
    private static final int MAX_RUN_HISTORY = 20;
    private static final int MAX_ACTION_QUEUE = 20;
    private final ObjectMapper objectMapper;
    private final Path statePath = Paths.get("data", "verification-center", "state.json");

    public synchronized Map<String, Object> buildPageData(boolean isEn) {
        VerificationCenterStateDocument state = loadState();
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("isEn", isEn);
        payload.put("serverGeneratedAt", ISO_OFFSET.format(OffsetDateTime.now()));
        payload.put("quickActions", buildQuickActions(isEn));
        payload.put("baselineRegistry", state.baselineRegistry);
        payload.put("verificationRuns", state.verificationRuns);
        Map<String, Object> managedVault = new LinkedHashMap<>();
        managedVault.put("accounts", state.vaultAccounts);
        managedVault.put("datasets", state.vaultDatasets);
        payload.put("managedVault", managedVault);
        payload.put("actionQueue", state.actionQueue);
        payload.put("summary", buildSummary(state));
        return payload;
    }

    public synchronized Map<String, Object> runCheck(String actionType, String actorId, boolean isEn) {
        String normalized = safe(actionType).toUpperCase(Locale.ROOT);
        if (normalized.isEmpty()) {
            throw new IllegalArgumentException(isEn ? "Action type is required." : "실행 유형이 필요합니다.");
        }
        if (!Arrays.asList("DAILY_SWEEP", "POST_DEPLOY_SMOKE", "PROFILE_AUDIT", "BASELINE_CAPTURE").contains(normalized)) {
            throw new IllegalArgumentException(isEn ? "Unsupported verification action." : "지원하지 않는 검증 실행 유형입니다.");
        }
        String runId = "VR-" + OffsetDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss")) + "-" + UUID.randomUUID().toString().substring(0, 4).toUpperCase(Locale.ROOT);
        String traceId = "trace-verification-" + normalized.toLowerCase(Locale.ROOT).replace('_', '-') + "-" + UUID.randomUUID().toString().substring(0, 8);
        String actor = safe(actorId).isEmpty() ? "system" : safe(actorId);
        VerificationCenterStateDocument state = loadState();
        state.serverGeneratedAt = ISO_OFFSET.format(OffsetDateTime.now());
        state.verificationRuns.add(0, runRow(
                runId,
                normalized,
                resolveTargetScope(normalized),
                resolveBaselineId(normalized),
                resolveResult(normalized),
                state.serverGeneratedAt,
                state.serverGeneratedAt,
                traceId,
                resolveProfileId(normalized),
                resolveDatasetId(normalized),
                resolveFailureCount(normalized),
                resolveDriftCount(normalized),
                resolveFollowupPath(normalized)
        ));
        trim(state.verificationRuns, MAX_RUN_HISTORY);
        state.actionQueue.add(0, actionRow(
                "QA-" + UUID.randomUUID().toString().substring(0, 4).toUpperCase(Locale.ROOT),
                "LOW",
                "RECENT_RUN",
                isEn ? String.format("Recent %s recorded", normalized) : String.format("%s 실행 이력 기록", normalized),
                actor,
                runId,
                isEn ? "Review the new run and decide whether follow-up evidence is required." : "새 실행 이력을 확인하고 후속 증적이 필요한지 판단합니다."
        ));
        trim(state.actionQueue, MAX_ACTION_QUEUE);
        writeState(state);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("message", resolveRunMessage(normalized, isEn));
        response.put("runId", runId);
        response.put("traceId", traceId);
        response.put("actionType", normalized);
        response.put("actorId", actor);
        response.put("result", resolveResult(normalized));
        response.put("followupPath", resolveFollowupPath(normalized));
        response.put("startedAt", state.serverGeneratedAt);
        return response;
    }

    public synchronized Map<String, Object> buildManagementPageData(boolean isEn) {
        VerificationCenterStateDocument state = loadState();
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("isEn", isEn);
        payload.put("serverGeneratedAt", ISO_OFFSET.format(OffsetDateTime.now()));
        payload.put("baselineRegistry", state.baselineRegistry);
        payload.put("managedVault", Map.of(
                "accounts", state.vaultAccounts,
                "datasets", state.vaultDatasets
        ));
        payload.put("actionQueue", state.actionQueue);
        payload.put("summary", buildSummary(state));
        return payload;
    }

    public synchronized Map<String, Object> upsertBaseline(Map<String, Object> payload, String actorId, boolean isEn) {
        VerificationCenterStateDocument state = loadState();
        Map<String, Object> row = baseline(
                required(payload, "pageId", isEn),
                required(payload, "routePath", isEn),
                defaulted(payload, "baselineId", "BL-" + OffsetDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd-HHmm"))),
                required(payload, "snapshotPath", isEn),
                defaulted(payload, "owner", safe(actorId).isEmpty() ? "system" : actorId),
                defaulted(payload, "lastVerifiedAt", ISO_OFFSET.format(OffsetDateTime.now())),
                Boolean.parseBoolean(String.valueOf(payload.getOrDefault("stale", "false"))),
                csvList(String.valueOf(payload.getOrDefault("requiredScenarioIds", ""))),
                safe(String.valueOf(payload.getOrDefault("profileId", ""))),
                safe(String.valueOf(payload.getOrDefault("datasetId", "")))
        );
        upsertByKey(state.baselineRegistry, "baselineId", row);
        writeState(state);
        return mutationResponse(true, isEn ? "Baseline saved." : "baseline을 저장했습니다.", row, "baseline");
    }

    public synchronized Map<String, Object> upsertAccount(Map<String, Object> payload, String actorId, boolean isEn) {
        VerificationCenterStateDocument state = loadState();
        Map<String, Object> row = account(
                required(payload, "profileId", isEn),
                required(payload, "role", isEn),
                defaulted(payload, "status", "READY"),
                required(payload, "expiresAt", isEn),
                defaulted(payload, "resetOwner", safe(actorId).isEmpty() ? "system" : actorId),
                csvList(String.valueOf(payload.getOrDefault("allowedRoutes", "")))
        );
        upsertByKey(state.vaultAccounts, "profileId", row);
        writeState(state);
        return mutationResponse(true, isEn ? "Test account saved." : "테스트 계정을 저장했습니다.", row, "account");
    }

    public synchronized Map<String, Object> upsertDataset(Map<String, Object> payload, boolean isEn) {
        VerificationCenterStateDocument state = loadState();
        Map<String, Object> row = dataset(
                required(payload, "datasetId", isEn),
                required(payload, "type", isEn),
                defaulted(payload, "status", "READY"),
                required(payload, "lastRefreshedAt", isEn),
                defaulted(payload, "retentionPolicy", "30d"),
                defaulted(payload, "maskingPolicy", "FULL_MASK")
        );
        upsertByKey(state.vaultDatasets, "datasetId", row);
        writeState(state);
        return mutationResponse(true, isEn ? "Dataset saved." : "데이터셋을 저장했습니다.", row, "dataset");
    }

    public synchronized Map<String, Object> resolveAction(String actionId, boolean isEn) {
        String normalizedActionId = safe(actionId);
        if (normalizedActionId.isEmpty()) {
            throw new IllegalArgumentException(isEn ? "Action id is required." : "조치 ID가 필요합니다.");
        }
        VerificationCenterStateDocument state = loadState();
        boolean removed = state.actionQueue.removeIf(item -> normalizedActionId.equals(String.valueOf(item.get("actionId"))));
        writeState(state);
        return mutationResponse(
                removed,
                removed ? (isEn ? "Action resolved." : "조치를 해제했습니다.") : (isEn ? "Action was not found." : "조치 대상을 찾지 못했습니다."),
                Map.of("actionId", normalizedActionId),
                "action");
    }

    private Map<String, Object> buildSummary(VerificationCenterStateDocument state) {
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("baselineRegistryCount", state.baselineRegistry.size());
        summary.put("staleBaselineCount", state.baselineRegistry.stream().filter(item -> Boolean.TRUE.equals(item.get("stale"))).count());
        summary.put("verificationRunCount", state.verificationRuns.size());
        summary.put("failingRunCount", state.verificationRuns.stream().filter(item -> !"PASS".equals(String.valueOf(item.get("result")))).count());
        summary.put("expiringProfileCount", state.vaultAccounts.stream().filter(item -> !"READY".equals(String.valueOf(item.get("status")))).count());
        summary.put("staleDatasetCount", state.vaultDatasets.stream().filter(item -> !"READY".equals(String.valueOf(item.get("status")))).count());
        summary.put("actionQueueCount", state.actionQueue.size());
        return summary;
    }

    private List<Map<String, Object>> buildQuickActions(boolean isEn) {
        return List.of(
                quickAction("DAILY_SWEEP", isEn ? "Run Daily Sweep" : "일간 sweep 실행", isEn ? "Check stale baselines, route health, and last smoke age." : "stale baseline, route health, 마지막 smoke 경과시간을 점검합니다."),
                quickAction("POST_DEPLOY_SMOKE", isEn ? "Run Post-deploy Smoke" : "배포 직후 smoke 실행", isEn ? "Rerun changed routes and follow rollback anchors." : "변경 경로를 다시 점검하고 rollback anchor를 확인합니다."),
                quickAction("PROFILE_AUDIT", isEn ? "Run Profile Audit" : "프로필 만료 점검", isEn ? "Check expiring sandbox credentials and stale datasets." : "만료 예정 샌드박스 자격과 stale 데이터셋을 점검합니다."),
                quickAction("BASELINE_CAPTURE", isEn ? "Capture Baseline" : "baseline 캡처", isEn ? "Record the current route and smoke baseline before change." : "변경 전에 현재 route와 smoke 기준선을 기록합니다.")
        );
    }

    private List<Map<String, Object>> buildBaselineRegistry() {
        return List.of(
                baseline("environment-management", "/admin/system/environment-management", "BL-ENV-2026-04-14", "var/baselines/environment-management/2026-04-14", "PLATFORM_ADMIN", "2026-04-14T09:10:00+09:00", false, List.of("ROUTE_HEAD", "SCREEN_COMMAND_METADATA", "PRIMARY_ACTION_BAR"), "PLATFORM_ADMIN_SANDBOX", "SYSTEM_ASSET_SEED_PACK"),
                baseline("asset-inventory", "/admin/system/asset-inventory", "BL-AINV-2026-04-14", "var/baselines/asset-inventory/2026-04-14", "PLATFORM_ADMIN", "2026-04-14T09:18:00+09:00", false, List.of("ROUTE_HEAD", "SUMMARY_COUNT", "DETAIL_LINKS"), "PLATFORM_ADMIN_SANDBOX", "SYSTEM_ASSET_SEED_PACK"),
                baseline("asset-impact", "/admin/system/asset-impact", "BL-AIMP-2026-04-13", "var/baselines/asset-impact/2026-04-13", "PLATFORM_ADMIN", "2026-04-13T19:05:00+09:00", true, List.of("ROUTE_HEAD", "MODE_SWITCH", "LINKED_CONSOLES"), "PLATFORM_ADMIN_SANDBOX", "SYSTEM_ASSET_SEED_PACK"),
                baseline("verification-center", "/admin/system/verification-center", "BL-VC-2026-04-14", "var/baselines/verification-center/2026-04-14", "OPS_AUDIT", "2026-04-14T09:25:00+09:00", false, List.of("ROUTE_HEAD", "FULL_LISTS", "RISK_SCOPE"), "TOKEN_ROTATION_SANDBOX", "MASKED_IDENTITY_FIXTURE")
        );
    }

    private List<Map<String, Object>> buildVerificationRuns() {
        return List.of(
                runRow("VR-2026-04-15-001", "DAILY_SWEEP", "system-governed-pages", "BL-ENV-2026-04-14", "WARN", "2026-04-15T06:00:00+09:00", "2026-04-15T06:12:00+09:00", "trace-verification-daily-001", "EXPIRY_MONITORING_RULE", "MASKED_PAYMENT_FIXTURE", 2, 1, "/admin/system/current-runtime-compare"),
                runRow("VR-2026-04-14-POST-DEPLOY", "POST_DEPLOY_SMOKE", "asset-inventory,asset-detail,asset-impact", "BL-AINV-2026-04-14", "PASS", "2026-04-14T22:11:00+09:00", "2026-04-14T22:16:00+09:00", "trace-verification-postdeploy-014", "PLATFORM_ADMIN_SANDBOX", "SYSTEM_ASSET_SEED_PACK", 0, 0, "/admin/system/verification-center"),
                runRow("VR-2026-04-14-EXPIRY", "WEEKLY_PROFILE_AUDIT", "sandbox-accounts-and-datasets", "BL-VC-2026-04-14", "TODO", "2026-04-14T07:30:00+09:00", "2026-04-14T07:37:00+09:00", "trace-verification-expiry-002", "TOKEN_ROTATION_SANDBOX", "MASKED_IDENTITY_FIXTURE", 0, 3, "/admin/system/security-policy")
        );
    }

    private Map<String, Object> buildManagedVault() {
        Map<String, Object> vault = new LinkedHashMap<>();
        vault.put("accounts", List.of(
                account("PLATFORM_ADMIN_SANDBOX", "SYSTEM_ADMIN", "READY", "2026-05-15T00:00:00+09:00", "ops-admin", List.of("/admin/system/environment-management", "/admin/system/asset-inventory")),
                account("TOKEN_ROTATION_SANDBOX", "INTEGRATION_SANDBOX", "EXPIRING_SOON", "2026-04-20T00:00:00+09:00", "external-auth-ops", List.of("/admin/external/keys", "/admin/system/verification-center")),
                account("PAYMENT_SANDBOX_OPERATOR", "PAYMENT_QA", "READY", "2026-05-01T00:00:00+09:00", "payment-ops", List.of("/payment/pay", "/payment/refund"))
        ));
        vault.put("datasets", List.of(
                dataset("SYSTEM_ASSET_SEED_PACK", "WORKFLOW", "READY", "2026-04-14T18:00:00+09:00", "30d", "FULL_MASK"),
                dataset("MASKED_IDENTITY_FIXTURE", "IDENTITY", "STALE", "2026-03-20T12:00:00+09:00", "60d", "PARTIAL_MASK"),
                dataset("MASKED_PAYMENT_FIXTURE", "PAYMENT", "READY", "2026-04-10T10:30:00+09:00", "30d", "FULL_MASK")
        ));
        return vault;
    }

    private List<Map<String, Object>> buildActionQueue(boolean isEn) {
        return List.of(
                actionRow("QA-001", "HIGH", "STALE_BASELINE", isEn ? "Refresh asset-impact baseline snapshot" : "asset-impact baseline snapshot 갱신", "platform-admin", "asset-impact", isEn ? "Recapture baseline and rerun mode-switch smoke" : "baseline을 다시 캡처하고 mode-switch smoke를 재실행합니다."),
                actionRow("QA-002", "HIGH", "PROFILE_EXPIRY", isEn ? "Token rotation sandbox expires within 5 days" : "token rotation sandbox 5일 내 만료", "external-auth-ops", "TOKEN_ROTATION_SANDBOX", isEn ? "Reissue credential and record reset evidence" : "자격을 재발급하고 reset 증적을 남깁니다."),
                actionRow("QA-003", "MEDIUM", "DATASET_DRIFT", isEn ? "Masked identity fixture refresh overdue" : "masked identity fixture 갱신 지연", "ops-audit", "MASKED_IDENTITY_FIXTURE", isEn ? "Refresh dataset and rerun external-auth smoke" : "데이터셋을 갱신하고 external-auth smoke를 재실행합니다.")
        );
    }

    private Map<String, Object> quickAction(String actionType, String label, String description) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("actionType", actionType);
        item.put("label", label);
        item.put("description", description);
        return item;
    }

    private Map<String, Object> baseline(String pageId, String routePath, String baselineId, String snapshotPath, String owner, String lastVerifiedAt, boolean stale, List<String> requiredScenarioIds, String profileId, String datasetId) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("pageId", pageId);
        item.put("routePath", routePath);
        item.put("baselineId", baselineId);
        item.put("snapshotPath", snapshotPath);
        item.put("owner", owner);
        item.put("lastVerifiedAt", lastVerifiedAt);
        item.put("stale", stale);
        item.put("requiredScenarioIds", requiredScenarioIds);
        item.put("profileId", profileId);
        item.put("datasetId", datasetId);
        return item;
    }

    private Map<String, Object> runRow(String runId, String runType, String targetScope, String baselineId, String result, String startedAt, String finishedAt, String traceId, String profileId, String datasetId, int failureCount, int driftCount, String followupPath) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("runId", runId);
        item.put("runType", runType);
        item.put("targetScope", targetScope);
        item.put("baselineId", baselineId);
        item.put("result", result);
        item.put("startedAt", startedAt);
        item.put("finishedAt", finishedAt);
        item.put("traceId", traceId);
        item.put("profileId", profileId);
        item.put("datasetId", datasetId);
        item.put("failureCount", failureCount);
        item.put("driftCount", driftCount);
        item.put("followupPath", followupPath);
        return item;
    }

    private Map<String, Object> account(String profileId, String role, String status, String expiresAt, String resetOwner, List<String> allowedRoutes) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("profileId", profileId);
        item.put("role", role);
        item.put("status", status);
        item.put("expiresAt", expiresAt);
        item.put("resetOwner", resetOwner);
        item.put("allowedRoutes", allowedRoutes);
        return item;
    }

    private Map<String, Object> dataset(String datasetId, String type, String status, String lastRefreshedAt, String retentionPolicy, String maskingPolicy) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("datasetId", datasetId);
        item.put("type", type);
        item.put("status", status);
        item.put("lastRefreshedAt", lastRefreshedAt);
        item.put("retentionPolicy", retentionPolicy);
        item.put("maskingPolicy", maskingPolicy);
        return item;
    }

    private Map<String, Object> actionRow(String actionId, String severity, String category, String title, String owner, String targetId, String recommendedAction) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("actionId", actionId);
        item.put("severity", severity);
        item.put("category", category);
        item.put("title", title);
        item.put("owner", owner);
        item.put("targetId", targetId);
        item.put("recommendedAction", recommendedAction);
        return item;
    }

    private String resolveRunMessage(String actionType, boolean isEn) {
        if ("DAILY_SWEEP".equals(actionType)) {
            return isEn ? "Daily sweep has been queued." : "일간 sweep 실행을 등록했습니다.";
        }
        if ("POST_DEPLOY_SMOKE".equals(actionType)) {
            return isEn ? "Post-deploy smoke has been queued." : "배포 직후 smoke 실행을 등록했습니다.";
        }
        if ("PROFILE_AUDIT".equals(actionType)) {
            return isEn ? "Profile audit has been queued." : "프로필 만료 점검을 등록했습니다.";
        }
        return isEn ? "Baseline capture has been queued." : "baseline 캡처를 등록했습니다.";
    }

    private String resolveFollowupPath(String actionType) {
        if ("DAILY_SWEEP".equals(actionType) || "BASELINE_CAPTURE".equals(actionType)) {
            return "/admin/system/verification-center";
        }
        if ("PROFILE_AUDIT".equals(actionType)) {
            return "/admin/system/security-policy";
        }
        return "/admin/system/current-runtime-compare";
    }

    private String resolveTargetScope(String actionType) {
        if ("DAILY_SWEEP".equals(actionType)) {
            return "system-governed-pages";
        }
        if ("PROFILE_AUDIT".equals(actionType)) {
            return "sandbox-accounts-and-datasets";
        }
        if ("BASELINE_CAPTURE".equals(actionType)) {
            return "baseline-capture";
        }
        return "changed-routes";
    }

    private String resolveBaselineId(String actionType) {
        if ("BASELINE_CAPTURE".equals(actionType)) {
            return "BL-VC-" + OffsetDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd-HHmm"));
        }
        if ("POST_DEPLOY_SMOKE".equals(actionType)) {
            return "BL-AINV-2026-04-14";
        }
        return "BL-VC-2026-04-14";
    }

    private String resolveResult(String actionType) {
        if ("PROFILE_AUDIT".equals(actionType)) {
            return "WARN";
        }
        return "PASS";
    }

    private String resolveProfileId(String actionType) {
        if ("PROFILE_AUDIT".equals(actionType)) {
            return "TOKEN_ROTATION_SANDBOX";
        }
        if ("POST_DEPLOY_SMOKE".equals(actionType)) {
            return "PLATFORM_ADMIN_SANDBOX";
        }
        return "EXPIRY_MONITORING_RULE";
    }

    private String resolveDatasetId(String actionType) {
        if ("PROFILE_AUDIT".equals(actionType)) {
            return "MASKED_IDENTITY_FIXTURE";
        }
        if ("POST_DEPLOY_SMOKE".equals(actionType)) {
            return "SYSTEM_ASSET_SEED_PACK";
        }
        return "MASKED_PAYMENT_FIXTURE";
    }

    private int resolveFailureCount(String actionType) {
        return "PROFILE_AUDIT".equals(actionType) ? 1 : 0;
    }

    private int resolveDriftCount(String actionType) {
        return "DAILY_SWEEP".equals(actionType) ? 1 : ("PROFILE_AUDIT".equals(actionType) ? 2 : 0);
    }

    private Map<String, Object> mutationResponse(boolean success, String message, Map<String, Object> item, String itemType) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", success);
        response.put("message", message);
        response.put("item", item);
        response.put("itemType", itemType);
        return response;
    }

    private void upsertByKey(List<Map<String, Object>> rows, String key, Map<String, Object> row) {
        String keyValue = String.valueOf(row.getOrDefault(key, ""));
        for (int index = 0; index < rows.size(); index++) {
            if (keyValue.equals(String.valueOf(rows.get(index).get(key)))) {
                rows.set(index, row);
                return;
            }
        }
        rows.add(0, row);
    }

    private String required(Map<String, Object> payload, String key, boolean isEn) {
        String value = safe(String.valueOf(payload.getOrDefault(key, "")));
        if (value.isEmpty()) {
            throw new IllegalArgumentException(isEn ? key + " is required." : key + " 값이 필요합니다.");
        }
        return value;
    }

    private String defaulted(Map<String, Object> payload, String key, String fallback) {
        String value = safe(String.valueOf(payload.getOrDefault(key, "")));
        return value.isEmpty() ? fallback : value;
    }

    private List<String> csvList(String rawValue) {
        List<String> items = new ArrayList<>();
        for (String token : safe(rawValue).split(",")) {
            String item = safe(token);
            if (!item.isEmpty()) {
                items.add(item);
            }
        }
        return items;
    }

    private VerificationCenterStateDocument loadState() {
        if (!Files.exists(statePath)) {
            VerificationCenterStateDocument document = defaultState();
            writeState(document);
            return document;
        }
        try (InputStream inputStream = Files.newInputStream(statePath)) {
            VerificationCenterStateDocument document = objectMapper.readValue(inputStream, VerificationCenterStateDocument.class);
            if (document == null) {
                return defaultState();
            }
            normalizeDocument(document);
            return document;
        } catch (Exception ignored) {
            VerificationCenterStateDocument document = defaultState();
            writeState(document);
            return document;
        }
    }

    private void writeState(VerificationCenterStateDocument document) {
        try {
            Files.createDirectories(statePath.getParent());
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(statePath.toFile(), document);
        } catch (Exception ignored) {
            // Keep page usable even if state persistence fails.
        }
    }

    private VerificationCenterStateDocument defaultState() {
        VerificationCenterStateDocument document = new VerificationCenterStateDocument();
        document.serverGeneratedAt = ISO_OFFSET.format(OffsetDateTime.now());
        document.baselineRegistry = new ArrayList<>(buildBaselineRegistry());
        document.verificationRuns = new ArrayList<>(buildVerificationRuns());
        document.vaultAccounts = new ArrayList<>(castList(buildManagedVault().get("accounts")));
        document.vaultDatasets = new ArrayList<>(castList(buildManagedVault().get("datasets")));
        document.actionQueue = new ArrayList<>(buildActionQueue(false));
        return document;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> castList(Object value) {
        return value instanceof List ? (List<Map<String, Object>>) value : new ArrayList<>();
    }

    private void normalizeDocument(VerificationCenterStateDocument document) {
        if (document.serverGeneratedAt == null) {
            document.serverGeneratedAt = ISO_OFFSET.format(OffsetDateTime.now());
        }
        if (document.baselineRegistry == null || document.baselineRegistry.isEmpty()) {
            document.baselineRegistry = new ArrayList<>(buildBaselineRegistry());
        }
        if (document.verificationRuns == null) {
            document.verificationRuns = new ArrayList<>();
        }
        if (document.vaultAccounts == null || document.vaultAccounts.isEmpty()) {
            document.vaultAccounts = new ArrayList<>(castList(buildManagedVault().get("accounts")));
        }
        if (document.vaultDatasets == null || document.vaultDatasets.isEmpty()) {
            document.vaultDatasets = new ArrayList<>(castList(buildManagedVault().get("datasets")));
        }
        if (document.actionQueue == null) {
            document.actionQueue = new ArrayList<>();
        }
        trim(document.verificationRuns, MAX_RUN_HISTORY);
        trim(document.actionQueue, MAX_ACTION_QUEUE);
    }

    private void trim(List<?> items, int limit) {
        if (items == null) {
            return;
        }
        while (items.size() > limit) {
            items.remove(items.size() - 1);
        }
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    public static class VerificationCenterStateDocument {
        public String serverGeneratedAt;
        public List<Map<String, Object>> baselineRegistry = new ArrayList<>();
        public List<Map<String, Object>> verificationRuns = new ArrayList<>();
        public List<Map<String, Object>> vaultAccounts = new ArrayList<>();
        public List<Map<String, Object>> vaultDatasets = new ArrayList<>();
        public List<Map<String, Object>> actionQueue = new ArrayList<>();
    }
}
