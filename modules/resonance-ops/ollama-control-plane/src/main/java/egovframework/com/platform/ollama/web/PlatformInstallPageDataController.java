package egovframework.com.platform.ollama.web;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Controller
@RequestMapping({
        "/admin/system/platform-install",
        "/en/admin/system/platform-install",
        "/api/platform/ollama",
        "/admin/api/platform/ollama",
        "/en/admin/api/platform/ollama"
})
@RequiredArgsConstructor
@Slf4j
public class PlatformInstallPageDataController {

    private static final String CONFIG_PATH = "data/ai-runtime/ollama-control-plane.json";
    private static final String PATTERN_REFERENCE_PATH = "data/ai-runtime/pattern-reference-manifest.json";
    private static final String DETERMINISTIC_ROUTE_MAP_PATH = "data/ai-runtime/deterministic-route-map.json";
    private static final String AGENT_STAGE_MODEL_MATRIX_PATH = "data/ai-runtime/agent-stage-model-matrix.json";

    private final ObjectMapper objectMapper;

    @GetMapping("/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getPageData() {
        Map<String, Object> config = readConfig();
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("summary", buildSummary(config));
        response.put("installedModels", discoverInstalledModels(config));
        response.put("runtimeProfiles", buildRuntimeProfiles(config));
        response.put("runnerProfiles", listOfMaps(config.get("runnerProfiles")));
        response.put("bundleChecklist", listOfStrings(config.get("bundleChecklist"), defaultBundleChecklist()));
        response.put("recommendedActions", buildRecommendedActions(config));
        response.put("routerProfiles", listOfMaps(config.get("routerProfiles")));
        response.put("agentProfiles", listOfMaps(config.get("agentProfiles")));
        response.put("toolchainProfiles", listOfMaps(config.get("toolchainProfiles")));
        response.put("commonJarSet", listOfMaps(config.get("commonJarSet")));
        response.put("projectPackageSet", listOfMaps(config.get("projectPackageSet")));
        response.put("k8sReleaseProfiles", listOfMaps(config.get("k8sReleaseProfiles")));
        response.put("builderStructure", mapOf(config.get("builderStructure")));
        response.put("promotionWaveStatus", listOfMaps(config.get("promotionWaveStatus")));
        response.put("operationReadiness", buildOperationReadiness(config));
        response.put("patternReferenceManifestPath", PATTERN_REFERENCE_PATH);
        response.put("message", "Platform install page is backed by Ollama runtime config and live command inspection.");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/status")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getStatus() {
        Map<String, Object> config = readConfig();
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("summary", buildSummary(config));
        response.put("installedModels", discoverInstalledModels(config));
        response.put("runnerProfiles", listOfMaps(config.get("runnerProfiles")));
        response.put("routerProfiles", listOfMaps(config.get("routerProfiles")));
        response.put("agentProfiles", listOfMaps(config.get("agentProfiles")));
        response.put("toolchainProfiles", listOfMaps(config.get("toolchainProfiles")));
        response.put("commonJarSet", listOfMaps(config.get("commonJarSet")));
        response.put("projectPackageSet", listOfMaps(config.get("projectPackageSet")));
        response.put("k8sReleaseProfiles", listOfMaps(config.get("k8sReleaseProfiles")));
        response.put("builderStructure", mapOf(config.get("builderStructure")));
        response.put("promotionWaveStatus", listOfMaps(config.get("promotionWaveStatus")));
        response.put("operationReadiness", buildOperationReadiness(config));
        return ResponseEntity.ok(response);
    }

    @GetMapping("/deterministic-route-map")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getDeterministicRouteMap() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("path", DETERMINISTIC_ROUTE_MAP_PATH);
        response.put("routeMap", readJsonMap(DETERMINISTIC_ROUTE_MAP_PATH));
        response.put("message", "Deterministic route map loaded. Use this before model-based source search.");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/agent-stage-model-matrix")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getAgentStageModelMatrix() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("path", AGENT_STAGE_MODEL_MATRIX_PATH);
        response.put("stageModelMatrix", readJsonMap(AGENT_STAGE_MODEL_MATRIX_PATH));
        response.put("message", "Agent stage model matrix loaded. Use this to keep small models on bounded tasks.");
        return ResponseEntity.ok(response);
    }

    @GetMapping("/router-config")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getRouterConfig() {
        Map<String, Object> config = readConfig();
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("routerProfiles", listOfMaps(config.get("routerProfiles")));
        response.put("activeRouterId", stringValue(config.get("activeRouterId"), "default-router"));
        response.put("routingPolicy", stringValue(config.get("routingPolicy"), "resolver-first"));
        return ResponseEntity.ok(response);
    }

    @PostMapping("/router-config")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> saveRouterConfig(@RequestBody Map<String, Object> payload) {
        Map<String, Object> config = readConfig();
        if (payload.containsKey("routerProfiles")) {
            config.put("routerProfiles", listOfMaps(payload.get("routerProfiles")));
        }
        if (payload.containsKey("activeRouterId")) {
            config.put("activeRouterId", stringValue(payload.get("activeRouterId"), "default-router"));
        }
        if (payload.containsKey("routingPolicy")) {
            config.put("routingPolicy", stringValue(payload.get("routingPolicy"), "resolver-first"));
        }
        writeConfig(config);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("message", "Ollama router configuration updated.");
        response.put("routerProfiles", listOfMaps(config.get("routerProfiles")));
        return ResponseEntity.ok(response);
    }

    @GetMapping("/agent-profiles")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getAgentProfiles() {
        Map<String, Object> config = readConfig();
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("agentProfiles", listOfMaps(config.get("agentProfiles")));
        response.put("defaultAgentProfileId", stringValue(config.get("defaultAgentProfileId"), "bounded-dev"));
        return ResponseEntity.ok(response);
    }

    @PostMapping("/agent-profiles")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> saveAgentProfiles(@RequestBody Map<String, Object> payload) {
        Map<String, Object> config = readConfig();
        if (payload.containsKey("agentProfiles")) {
            config.put("agentProfiles", listOfMaps(payload.get("agentProfiles")));
        }
        if (payload.containsKey("defaultAgentProfileId")) {
            config.put("defaultAgentProfileId", stringValue(payload.get("defaultAgentProfileId"), "bounded-dev"));
        }
        writeConfig(config);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("message", "Ollama agent profiles updated.");
        response.put("agentProfiles", listOfMaps(config.get("agentProfiles")));
        return ResponseEntity.ok(response);
    }

    @GetMapping("/runner-profiles")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getRunnerProfiles() {
        Map<String, Object> config = readConfig();
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("runnerProfiles", listOfMaps(config.get("runnerProfiles")));
        response.put("preferredRunnerId", stringValue(config.get("preferredRunnerId"), "ollama-local"));
        return ResponseEntity.ok(response);
    }

    @PostMapping("/runner-profiles")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> saveRunnerProfiles(@RequestBody Map<String, Object> payload) {
        Map<String, Object> config = readConfig();
        if (payload.containsKey("runnerProfiles")) {
            config.put("runnerProfiles", listOfMaps(payload.get("runnerProfiles")));
        }
        if (payload.containsKey("preferredRunnerId")) {
            config.put("preferredRunnerId", stringValue(payload.get("preferredRunnerId"), "ollama-local"));
        }
        writeConfig(config);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("message", "AI runner profiles updated.");
        response.put("runnerProfiles", listOfMaps(config.get("runnerProfiles")));
        return ResponseEntity.ok(response);
    }

    @GetMapping("/toolchain-profiles")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getToolchainProfiles() {
        Map<String, Object> config = readConfig();
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("toolchainProfiles", listOfMaps(config.get("toolchainProfiles")));
        response.put("preferredToolchainId", stringValue(config.get("preferredToolchainId"), "ollama-runtime"));
        return ResponseEntity.ok(response);
    }

    @PostMapping("/toolchain-profiles")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> saveToolchainProfiles(@RequestBody Map<String, Object> payload) {
        Map<String, Object> config = readConfig();
        if (payload.containsKey("toolchainProfiles")) {
            config.put("toolchainProfiles", listOfMaps(payload.get("toolchainProfiles")));
        }
        if (payload.containsKey("preferredToolchainId")) {
            config.put("preferredToolchainId", stringValue(payload.get("preferredToolchainId"), "ollama-runtime"));
        }
        writeConfig(config);
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("message", "AI toolchain profiles updated.");
        response.put("toolchainProfiles", listOfMaps(config.get("toolchainProfiles")));
        return ResponseEntity.ok(response);
    }

    @GetMapping("/operation-readiness")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getOperationReadiness() {
        Map<String, Object> config = readConfig();
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("operationReadiness", buildOperationReadiness(config));
        return ResponseEntity.ok(response);
    }

    @PostMapping("/operation-preview")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> previewOperation(@RequestBody Map<String, Object> payload) {
        Map<String, Object> config = readConfig();
        String operationId = stringValue(payload.get("operationId"), "");
        Map<String, Object> response = new LinkedHashMap<>();
        for (Map<String, Object> item : buildOperationReadiness(config)) {
            if (!operationId.equals(stringValue(item.get("operationId"), ""))) {
                continue;
            }
            response.putAll(item);
            response.put("previewLines", readPreviewLines(stringValue(item.get("scriptPath"), "")));
            return ResponseEntity.ok(response);
        }
        response.put("operationId", operationId);
        response.put("status", "missing");
        response.put("previewLines", List.of("Operation not found in readiness catalog."));
        return ResponseEntity.ok(response);
    }

    @PostMapping("/operation-verify")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> verifyOperation(@RequestBody Map<String, Object> payload) {
        Map<String, Object> config = readConfig();
        String operationId = stringValue(payload.get("operationId"), "");
        Map<String, Object> response = new LinkedHashMap<>();
        for (Map<String, Object> item : buildOperationReadiness(config)) {
            if (!operationId.equals(stringValue(item.get("operationId"), ""))) {
                continue;
            }
            List<Map<String, Object>> checks = buildOperationChecks(item);
            boolean allPassed = checks.stream().allMatch(check -> "PASS".equals(stringValue(check.get("result"), "")));
            response.put("operationId", operationId);
            response.put("status", allPassed ? "verified" : "blocked");
            response.put("checks", checks);
            response.put("summaryMessage", allPassed
                    ? "Operation is ready for the next execution wave."
                    : "Operation is not ready yet. Fix the blocked checks before execution.");
            return ResponseEntity.ok(response);
        }
        response.put("operationId", operationId);
        response.put("status", "missing");
        response.put("checks", List.of());
        response.put("summaryMessage", "Operation not found in readiness catalog.");
        return ResponseEntity.ok(response);
    }

    @PostMapping("/operation-dry-run")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> dryRunOperation(@RequestBody Map<String, Object> payload) {
        Map<String, Object> config = readConfig();
        String operationId = stringValue(payload.get("operationId"), "");
        Map<String, Object> response = new LinkedHashMap<>();
        for (Map<String, Object> item : buildOperationReadiness(config)) {
            if (!operationId.equals(stringValue(item.get("operationId"), ""))) {
                continue;
            }
            response.put("operationId", operationId);
            response.put("status", "dry-run-ready");
            response.put("summaryMessage", buildDryRunSummary(operationId));
            response.put("commandPreview", buildCommandPreview(operationId, stringValue(item.get("scriptPath"), "")));
            response.put("resolvedInputs", buildResolvedInputs(operationId, stringValue(item.get("scriptPath"), "")));
            response.put("plannedSteps", buildPlannedSteps(operationId));
            return ResponseEntity.ok(response);
        }
        response.put("operationId", operationId);
        response.put("status", "missing");
        response.put("summaryMessage", "Operation not found in readiness catalog.");
        response.put("commandPreview", List.of());
        response.put("resolvedInputs", List.of());
        response.put("plannedSteps", List.of());
        return ResponseEntity.ok(response);
    }

    private Map<String, Object> buildSummary(Map<String, Object> config) {
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("platformName", stringValue(config.get("platformName"), "Resonance AI Runtime"));
        summary.put("projectName", stringValue(config.get("projectName"), "carbonet"));
        summary.put("runtimeMode", stringValue(config.get("runtimeMode"), "shared-control-plane / isolated-project-runtime"));
        summary.put("installStatus", commandExists("ollama") ? "installed" : "missing");
        summary.put("bundleMode", stringValue(config.get("bundleMode"), "air-gapped-bundle-ready"));
        summary.put("ollamaStatus", readOllamaVersion().isEmpty() ? "unverified" : "running-capable");
        summary.put("ollamaVersion", readOllamaVersion());
        summary.put("activeRouterId", stringValue(config.get("activeRouterId"), "default-router"));
        summary.put("preferredRunnerId", stringValue(config.get("preferredRunnerId"), "ollama-local"));
        summary.put("preferredToolchainId", stringValue(config.get("preferredToolchainId"), "ollama-runtime"));
        summary.put("defaultAgentProfileId", stringValue(config.get("defaultAgentProfileId"), "bounded-dev"));
        return summary;
    }

    private List<Map<String, Object>> discoverInstalledModels(Map<String, Object> config) {
        List<Map<String, Object>> configured = listOfMaps(config.get("installedModels"));
        String output = runCommand("bash", "-lc", "ollama list 2>/dev/null");
        if (output.isEmpty()) {
            return configured.isEmpty() ? defaultInstalledModels() : configured;
        }

        Map<String, Map<String, Object>> merged = new LinkedHashMap<>();
        for (Map<String, Object> item : configured) {
            merged.put(stringValue(item.get("modelName"), ""), new LinkedHashMap<>(item));
        }

        String[] lines = output.split("\\R");
        for (int i = 1; i < lines.length; i++) {
            String line = lines[i].trim();
            if (line.isEmpty()) {
                continue;
            }
            String[] parts = line.split("\\s+");
            String modelName = parts.length > 0 ? parts[0].trim() : "";
            if (modelName.isEmpty()) {
                continue;
            }
            Map<String, Object> row = merged.getOrDefault(modelName, new LinkedHashMap<String, Object>());
            row.put("modelName", modelName);
            row.putIfAbsent("role", "unassigned");
            row.put("status", "installed");
            merged.put(modelName, row);
        }
        return new ArrayList<>(merged.values());
    }

    private List<Map<String, Object>> buildRuntimeProfiles(Map<String, Object> config) {
        List<Map<String, Object>> configured = listOfMaps(config.get("runtimeProfiles"));
        return configured.isEmpty() ? defaultRuntimeProfiles() : configured;
    }

    private List<String> buildRecommendedActions(Map<String, Object> config) {
        List<String> actions = listOfStrings(config.get("recommendedActions"), new ArrayList<String>());
        if (actions.isEmpty()) {
            actions.add("Verify Ollama installation and runtime status.");
            actions.add("Review installed models and assign router roles.");
            actions.add("Review Codex / Hermes-Codex-Cerebras runner availability and fallback order.");
            actions.add("Maintain toolchain sync plans for Git, Harness, Unsloth, and Axolotl where applicable.");
            actions.add("Connect platform-install page to live backup, bundle, and runtime endpoints.");
            actions.add("Align agent profiles with resolver / planner / implementer / verifier boundaries.");
        }
        return actions;
    }

    private List<Map<String, Object>> buildOperationReadiness(Map<String, Object> config) {
        List<Map<String, Object>> configured = listOfMaps(config.get("operationReadiness"));
        if (configured.isEmpty()) {
            configured = defaultOperationReadiness();
        }
        List<Map<String, Object>> rows = new ArrayList<>();
        for (Map<String, Object> item : configured) {
            LinkedHashMap<String, Object> row = new LinkedHashMap<>(item);
            String scriptPath = stringValue(item.get("scriptPath"), "");
            boolean fileReady = !scriptPath.isEmpty() && fileExists(scriptPath);
            boolean commandReady = switch (stringValue(item.get("operationId"), "")) {
                case "docker-package-build" -> commandExists("docker");
                case "k8s-release" -> commandExists("kubectl");
                default -> true;
            };
            row.put("fileReadyYn", fileReady ? "Y" : "N");
            row.put("commandReadyYn", commandReady ? "Y" : "N");
            row.put("status", fileReady && commandReady ? "ready" : "missing-dependency");
            rows.add(row);
        }
        return rows;
    }

    private List<Map<String, Object>> buildOperationChecks(Map<String, Object> item) {
        List<Map<String, Object>> checks = new ArrayList<>();
        String operationId = stringValue(item.get("operationId"), "");
        String scriptPath = stringValue(item.get("scriptPath"), "");
        checks.add(checkRow("file-exists", scriptPath, fileExists(scriptPath)));
        checks.add(checkRow("command-ready", expectedCommandLabel(operationId), isCommandReady(operationId)));

        if ("backup-create".equals(operationId)) {
            checks.add(checkRow("release-assembler", "ops/scripts/assemble-project-release.sh", fileExists("ops/scripts/assemble-project-release.sh")));
            checks.add(checkRow("release-root", "var/releases", fileExists("var/releases")));
            checks.add(checkRow("rollback-script", "ops/scripts/rollback-project-release.sh", fileExists("ops/scripts/rollback-project-release.sh")));
            checks.add(checkRow("resonance-workspace", "/opt/Resonance", fileExists("/opt/Resonance")));
        } else if ("bundle-export".equals(operationId)) {
            checks.add(checkRow("release-assembler", "ops/scripts/assemble-project-release.sh", fileExists("ops/scripts/assemble-project-release.sh")));
            checks.add(checkRow("release-root", "var/releases", fileExists("var/releases")));
            checks.add(checkRow("common-package-set", "/opt/Resonance/package-sets/common", fileExists("/opt/Resonance/package-sets/common")));
            checks.add(checkRow("project-package-set", "/opt/Resonance/package-sets/projects", fileExists("/opt/Resonance/package-sets/projects")));
            checks.add(checkRow("workspace-reactor", "/opt/Resonance/pom.xml", fileExists("/opt/Resonance/pom.xml")));
        } else if ("docker-package-build".equals(operationId)) {
            checks.add(checkRow("release-dir", "var/releases/<projectId>", fileExists("var/releases")));
            checks.add(checkRow("dockerfile", "ops/docker/Dockerfile.project-runtime", fileExists("ops/docker/Dockerfile.project-runtime")));
        } else if ("project-release-deploy".equals(operationId) || "project-bluegreen-deploy".equals(operationId)) {
            checks.add(checkRow("release-assembler", "ops/scripts/assemble-project-release.sh", fileExists("ops/scripts/assemble-project-release.sh")));
            checks.add(checkRow("ops-config", "ops/config", fileExists("ops/config")));
        } else if ("db-migration-apply".equals(operationId)) {
            checks.add(checkRow("db-migration-script", "ops/scripts/apply-project-db-migration.sh", fileExists("ops/scripts/apply-project-db-migration.sh")));
        } else if ("release-rollback".equals(operationId)) {
            checks.add(checkRow("rollback-script", "ops/scripts/rollback-project-release.sh", fileExists("ops/scripts/rollback-project-release.sh")));
        } else if ("k8s-release".equals(operationId)) {
            checks.add(checkRow("k8s-manifest", scriptPath, fileExists(scriptPath)));
            checks.add(checkRow("k8s-release-root", "/opt/Resonance/deploy/k8s/projects", fileExists("/opt/Resonance/deploy/k8s/projects")));
            checks.add(checkRow("workspace-reactor", "/opt/Resonance/pom.xml", fileExists("/opt/Resonance/pom.xml")));
        }

        return checks;
    }

    private String buildDryRunSummary(String operationId) {
        return switch (operationId) {
            case "backup-create" -> "Validate release assembly and backup snapshot inputs without creating a new snapshot.";
            case "bundle-export" -> "Validate project/common package inputs and show the export bundle composition without creating an archive.";
            case "docker-package-build" -> "Validate release packaging inputs and show the Docker build command shape without building.";
            case "project-release-deploy" -> "Show release deploy sequence, required inputs, and remote target assumptions without deploying.";
            case "project-bluegreen-deploy" -> "Show blue/green rollout sequence, target ports, and switching steps without traffic movement.";
            case "db-migration-apply" -> "Show migration script path and expected release directory inputs without applying DB changes.";
            case "release-rollback" -> "Show rollback script, expected release root, and recovery checkpoints without changing runtime state.";
            case "k8s-release" -> "Show Kubernetes manifest target and expected kubectl apply sequence without applying resources.";
            default -> "Show resolved inputs and planned worker steps without executing the operation.";
        };
    }

    private List<String> buildCommandPreview(String operationId, String scriptPath) {
        return switch (operationId) {
            case "backup-create" -> List.of(
                    "bash " + scriptPath + " <PROJECT_ID>",
                    "copy assembled release -> backup snapshot location"
            );
            case "bundle-export" -> List.of(
                    "bash " + scriptPath + " <PROJECT_ID>",
                    "package common jar set + project runtime set + manifests into air-gapped export bundle"
            );
            case "docker-package-build" -> List.of(
                    "bash " + scriptPath + " <PROJECT_ID> <REGISTRY_PREFIX>",
                    "docker build -f ops/docker/Dockerfile.project-runtime <release-dir>"
            );
            case "project-release-deploy" -> List.of(
                    "bash " + scriptPath + " <PROJECT_ID> <PORT> <REMOTE_TARGET> <REMOTE_ROOT>",
                    "rsync <local_release_dir>/ -> <remote_release_dir>/",
                    "remote apply-project-db-migration.sh",
                    "remote systemctl restart carbonet@<PROJECT_ID>"
            );
            case "project-bluegreen-deploy" -> List.of(
                    "bash " + scriptPath + " <PROJECT_ID> <BASE_PORT> <REMOTE_TARGET> <REMOTE_ROOT>",
                    "resolve active_color -> target_color",
                    "sync release -> target color",
                    "health check -> switch traffic -> stop old color"
            );
            case "db-migration-apply" -> List.of(
                    "bash " + scriptPath + " <PROJECT_ID> <REMOTE_VERSION_DIR>"
            );
            case "release-rollback" -> List.of(
                    "bash " + scriptPath + " <PROJECT_ID> <REMOTE_TARGET> <REMOTE_ROOT>"
            );
            case "k8s-release" -> List.of(
                    "kubectl apply -f " + scriptPath,
                    "kubectl rollout status deployment/<project-runtime>"
            );
            default -> List.of("No command preview available.");
        };
    }

    private List<Map<String, Object>> buildResolvedInputs(String operationId, String scriptPath) {
        List<Map<String, Object>> rows = new ArrayList<>();
        if ("backup-create".equals(operationId)) {
            rows.add(inputRow("scriptPath", scriptPath));
            rows.add(inputRow("projectId", "<projectId>"));
            rows.add(inputRow("releaseRoot", "var/releases/<projectId>"));
            rows.add(inputRow("backupTarget", "var/releases/<projectId>/backups/<timestamp>"));
        } else if ("bundle-export".equals(operationId)) {
            rows.add(inputRow("scriptPath", scriptPath));
            rows.add(inputRow("projectId", "<projectId>"));
            rows.add(inputRow("projectPackageSet", "/opt/Resonance/package-sets/projects/<project>.yaml"));
            rows.add(inputRow("commonPackageSet", "/opt/Resonance/package-sets/common/resonance-common-jar-set.example.yaml"));
            rows.add(inputRow("exportTarget", "<bundle-output-dir>"));
        } else if ("docker-package-build".equals(operationId)) {
            rows.add(inputRow("scriptPath", scriptPath));
            rows.add(inputRow("dockerfile", "ops/docker/Dockerfile.project-runtime"));
            rows.add(inputRow("releaseRoot", "var/releases/<projectId>"));
        } else if ("project-release-deploy".equals(operationId) || "project-bluegreen-deploy".equals(operationId)) {
            rows.add(inputRow("scriptPath", scriptPath));
            rows.add(inputRow("remoteRoot", "/opt/Resonance"));
            rows.add(inputRow("releaseRoot", "var/releases/<projectId>"));
            rows.add(inputRow("configRoot", "ops/config"));
        } else if ("db-migration-apply".equals(operationId)) {
            rows.add(inputRow("scriptPath", scriptPath));
            rows.add(inputRow("releaseVersionDir", "<remote release version dir>"));
        } else if ("release-rollback".equals(operationId)) {
            rows.add(inputRow("scriptPath", scriptPath));
            rows.add(inputRow("remoteReleaseRoot", "/opt/Resonance/var/releases/<projectId>"));
        } else if ("k8s-release".equals(operationId)) {
            rows.add(inputRow("manifestPath", scriptPath));
            rows.add(inputRow("namespace", "project-carbonet"));
            rows.add(inputRow("workspace", "/opt/Resonance/deploy/k8s/projects/carbonet"));
        } else {
            rows.add(inputRow("scriptPath", scriptPath));
        }
        return rows;
    }

    private List<String> buildPlannedSteps(String operationId) {
        return switch (operationId) {
            case "backup-create" -> List.of(
                    "Resolve project release root",
                    "Validate assemble-project-release script and backup target path",
                    "Preview snapshot naming and retention assumptions",
                    "Stop before file mutation"
            );
            case "bundle-export" -> List.of(
                    "Resolve project package set and common package set",
                    "Validate release root and export target assumptions",
                    "Preview bundle composition for air-gapped delivery",
                    "Stop before archive creation"
            );
            case "docker-package-build" -> List.of(
                    "Resolve project release directory",
                    "Validate Dockerfile and Docker command availability",
                    "Build image tags for latest and timestamp",
                    "Stop before actual docker build execution"
            );
            case "project-release-deploy" -> List.of(
                    "Resolve local release and remote target directories",
                    "Validate deploy script, release root, and config root",
                    "Preview rsync, migration, restart, and health-check flow",
                    "Stop before remote deployment"
            );
            case "project-bluegreen-deploy" -> List.of(
                    "Resolve active/target color",
                    "Validate blue/green script and release root",
                    "Preview traffic switch sequence",
                    "Stop before remote rollout"
            );
            case "db-migration-apply" -> List.of(
                    "Resolve migration script and release version directory",
                    "Preview migration invocation shape",
                    "Stop before DB change"
            );
            case "release-rollback" -> List.of(
                    "Resolve rollback script and release root",
                    "Preview rollback checkpoints and command shape",
                    "Stop before runtime state change"
            );
            case "k8s-release" -> List.of(
                    "Resolve Kubernetes manifest path and namespace",
                    "Validate kubectl availability",
                    "Preview apply and rollout status commands",
                    "Stop before cluster mutation"
            );
            default -> List.of("No planned steps available.");
        };
    }

    private Map<String, Object> inputRow(String name, String value) {
        LinkedHashMap<String, Object> row = new LinkedHashMap<>();
        row.put("name", name);
        row.put("value", value);
        return row;
    }

    private boolean isCommandReady(String operationId) {
        return switch (operationId) {
            case "docker-package-build" -> commandExists("docker");
            case "k8s-release" -> commandExists("kubectl");
            default -> true;
        };
    }

    private String expectedCommandLabel(String operationId) {
        return switch (operationId) {
            case "docker-package-build" -> "docker";
            case "k8s-release" -> "kubectl";
            default -> "shell";
        };
    }

    private Map<String, Object> checkRow(String checkId, String target, boolean passed) {
        LinkedHashMap<String, Object> row = new LinkedHashMap<>();
        row.put("checkId", checkId);
        row.put("target", target);
        row.put("result", passed ? "PASS" : "BLOCK");
        return row;
    }

    private List<String> readPreviewLines(String path) {
        if (path == null || path.isBlank()) {
            return List.of("No script or manifest path configured.");
        }
        try {
            Path candidate = Path.of(path);
            if (!candidate.isAbsolute()) {
                candidate = Path.of("").toAbsolutePath().resolve(path);
            }
            if (!Files.exists(candidate)) {
                return List.of("File not found: " + candidate);
            }
            List<String> lines = Files.readAllLines(candidate, StandardCharsets.UTF_8);
            if (lines.isEmpty()) {
                return List.of("(file is empty)");
            }
            return lines.subList(0, Math.min(lines.size(), 80));
        } catch (Exception e) {
            return List.of("Failed to read preview: " + e.getMessage());
        }
    }

    private Map<String, Object> mapOf(Object value) {
        if (!(value instanceof Map<?, ?> map)) {
            return new LinkedHashMap<>();
        }
        LinkedHashMap<String, Object> row = new LinkedHashMap<>();
        for (Map.Entry<?, ?> entry : map.entrySet()) {
            row.put(String.valueOf(entry.getKey()), entry.getValue());
        }
        return row;
    }

    private boolean fileExists(String path) {
        if (path == null || path.isBlank()) {
            return false;
        }
        return new File(path).exists();
    }

    private Map<String, Object> readJsonMap(String path) {
        File file = new File(path);
        if (!file.exists()) {
            Map<String, Object> missing = new LinkedHashMap<>();
            missing.put("status", "missing");
            missing.put("path", path);
            return missing;
        }
        try {
            return objectMapper.readValue(file, new TypeReference<LinkedHashMap<String, Object>>() {
            });
        } catch (IOException exception) {
            log.warn("Failed to read JSON map from {}", path, exception);
            Map<String, Object> error = new LinkedHashMap<>();
            error.put("status", "error");
            error.put("path", path);
            error.put("message", exception.getMessage());
            return error;
        }
    }

    private Map<String, Object> readConfig() {
        File file = new File(CONFIG_PATH);
        if (!file.exists()) {
            Map<String, Object> defaults = defaultConfig();
            writeConfig(defaults);
            return defaults;
        }
        try {
            return objectMapper.readValue(file, new TypeReference<LinkedHashMap<String, Object>>() {});
        } catch (IOException e) {
            log.warn("Failed to read Ollama control plane config, using defaults.", e);
            return defaultConfig();
        }
    }

    private void writeConfig(Map<String, Object> config) {
        try {
            File file = new File(CONFIG_PATH);
            File parent = file.getParentFile();
            if (parent != null && !parent.exists()) {
                parent.mkdirs();
            }
            objectMapper.writerWithDefaultPrettyPrinter().writeValue(file, config);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to save Ollama control plane config.", e);
        }
    }

    private boolean commandExists(String command) {
        return !runCommand("bash", "-lc", "command -v " + command + " 2>/dev/null").isEmpty();
    }

    private String readOllamaVersion() {
        return runCommand("bash", "-lc", "ollama --version 2>/dev/null");
    }

    private String runCommand(String... command) {
        try {
            ProcessBuilder builder = new ProcessBuilder(command);
            builder.redirectErrorStream(true);
            Process process = builder.start();
            byte[] data = process.getInputStream().readAllBytes();
            process.waitFor();
            return new String(data, StandardCharsets.UTF_8).trim();
        } catch (Exception e) {
            return "";
        }
    }

    private List<Map<String, Object>> listOfMaps(Object value) {
        List<Map<String, Object>> rows = new ArrayList<>();
        if (!(value instanceof List<?> list)) {
            return rows;
        }
        for (Object item : list) {
            if (item instanceof Map<?, ?> map) {
                LinkedHashMap<String, Object> row = new LinkedHashMap<>();
                for (Map.Entry<?, ?> entry : map.entrySet()) {
                    row.put(String.valueOf(entry.getKey()), entry.getValue());
                }
                rows.add(row);
            }
        }
        return rows;
    }

    private List<String> listOfStrings(Object value, List<String> fallback) {
        if (!(value instanceof List<?> list)) {
            return fallback;
        }
        List<String> rows = new ArrayList<>();
        for (Object item : list) {
            String text = String.valueOf(item == null ? "" : item).trim();
            if (!text.isEmpty()) {
                rows.add(text);
            }
        }
        return rows.isEmpty() ? fallback : rows;
    }

    private String stringValue(Object value, String fallback) {
        String text = String.valueOf(value == null ? "" : value).trim();
        return text.isEmpty() ? fallback : text;
    }

    private Map<String, Object> defaultConfig() {
        Map<String, Object> config = new LinkedHashMap<>();
        config.put("platformName", "Resonance AI Runtime");
        config.put("projectName", "carbonet");
        config.put("runtimeMode", "shared-control-plane / isolated-project-runtime");
        config.put("bundleMode", "air-gapped-bundle-ready");
        config.put("activeRouterId", "default-router");
        config.put("preferredRunnerId", "ollama-local");
        config.put("preferredToolchainId", "ollama-runtime");
        config.put("defaultAgentProfileId", "bounded-dev");
        config.put("installedModels", defaultInstalledModels());
        config.put("runtimeProfiles", defaultRuntimeProfiles());
        config.put("runnerProfiles", defaultRunnerProfiles());
        config.put("routerProfiles", defaultRouterProfiles());
        config.put("agentProfiles", defaultAgentProfiles());
        config.put("toolchainProfiles", defaultToolchainProfiles());
        config.put("commonJarSet", defaultCommonJarSet());
        config.put("projectPackageSet", defaultProjectPackageSet());
        config.put("k8sReleaseProfiles", defaultK8sReleaseProfiles());
        config.put("builderStructure", defaultBuilderStructure());
        config.put("promotionWaveStatus", defaultPromotionWaveStatus());
        config.put("operationReadiness", defaultOperationReadiness());
        config.put("bundleChecklist", defaultBundleChecklist());
        config.put("recommendedActions", buildRecommendedActions(new LinkedHashMap<>()));
        return config;
    }

    private List<Map<String, Object>> defaultInstalledModels() {
        List<Map<String, Object>> rows = new ArrayList<>();
        rows.add(modelRow("qwen2.5-coder:3b", "classifier / verifier / tiny bounded edits", "recommended"));
        rows.add(modelRow("gemma3:4b", "resolver / classifier fallback / Korean summary", "optional"));
        rows.add(modelRow("qwen2.5-coder:14b-instruct", "planner / implementer", "recommended"));
        rows.add(modelRow("devstral", "agentic coding planner / bounded patch candidate", "candidate"));
        rows.add(modelRow("qwen3.5-coder", "bounded planner / implementer candidate after tag verification", "candidate-unverified-tag"));
        rows.add(modelRow("gemma4", "large-context planner candidate after tag verification", "candidate-unverified-tag"));
        return rows;
    }

    private List<Map<String, Object>> defaultRuntimeProfiles() {
        List<Map<String, Object>> rows = new ArrayList<>();
        rows.add(profileRow("control-plane", "required", "Ollama + worker + registry orchestration"));
        rows.add(profileRow("project-runtime", "required", "project-specific isolated runtime"));
        rows.add(profileRow("bundle-export", "required", "air-gapped export / import support"));
        return rows;
    }

    private List<Map<String, Object>> defaultRunnerProfiles() {
        List<Map<String, Object>> rows = new ArrayList<>();
        rows.add(runnerRow("ollama-local", "ollama", "primary", "qwen2.5-coder:14b-instruct", "Local bounded implementation and runtime operations"));
        Map<String, Object> vllm = runnerRow("vllm-local", "vllm-openai-compatible", "optional-accelerated", "gemma-4-e2b-it", "Verified OpenAI-compatible local GPU server. Gemma4 E2B passed route and safety gates.");
        vllm.put("endpoint", "http://172.18.0.1:8000/v1");
        vllm.put("localEndpoint", "http://127.0.0.1:8000/v1");
        vllm.put("currentServedModel", "gemma-4-e2b-it");
        vllm.put("status", "running-verified");
        vllm.put("healthCommand", "curl -fsS http://172.18.0.1:8000/v1/models");
        rows.add(vllm);
        rows.add(runnerRow("codex-cloud", "codex", "fallback", "codex", "Complex patch fallback and difficult refactor support"));
        rows.add(runnerRow("hermes-codex-cerebras", "hermes", "development", "cerebras-235b + codex", "Development agent orchestration and comparative workflow experiments"));
        return rows;
    }

    private List<Map<String, Object>> defaultToolchainProfiles() {
        List<Map<String, Object>> rows = new ArrayList<>();
        rows.add(toolchainRow("ollama-runtime", "runtime", "active", "Production runtime with local Ollama model gateway and deterministic workers"));
        rows.add(toolchainRow("vllm-runtime", "model-server", "optional", "OpenAI-compatible GPU inference server for Qwen/Gemma/Devstral candidates with deterministic context caps"));
        rows.add(toolchainRow("codex-sync", "cloud-dev", "optional", "Codex-assisted patch fallback, review support, and controlled implementation experiments"));
        rows.add(toolchainRow("hermes-codex-cerebras", "agent-lab", "optional", "Hermes development agent stack for routing, comparative evaluation, and Cerebras-backed experimentation"));
        rows.add(toolchainRow("git-governance", "source-control", "required", "Git history, rollback checkpoints, and update traceability for all AI runtime changes"));
        rows.add(toolchainRow("harness-eval", "evaluation", "optional", "Harness-style evaluation or internal benchmark runners for regression scoring"));
        rows.add(toolchainRow("unsloth-axolotl", "fine-tune", "optional", "Offline finetune preparation path for small-model specialization, not runtime-critical"));
        return rows;
    }

    private List<Map<String, Object>> defaultRouterProfiles() {
        List<Map<String, Object>> rows = new ArrayList<>();
        rows.add(routerRow("default-router", "resolver-first", "qwen2.5-coder:3b", "qwen2.5-coder:14b-instruct", "general Carbonet operations"));
        rows.add(routerRow("vllm-coding-router", "deterministic-context-then-vllm", "qwen2.5-coder:3b", "devstral", "GPU-backed code planning/patch generation after file selection"));
        rows.add(routerRow("strict-runtime-router", "bounded-runtime", "gemma3:4b", "qwen2.5-coder:14b-instruct", "runtime/install/bundle tasks"));
        return rows;
    }

    private List<Map<String, Object>> defaultAgentProfiles() {
        List<Map<String, Object>> rows = new ArrayList<>();
        rows.add(agentRow("bounded-dev", "resolver/planner/implementer/verifier", "20", "2500"));
        rows.add(agentRow("runtime-ops", "install/bundle/runtime-control", "12", "1800"));
        rows.add(agentRow("pattern-guided-3b", "similar page generation / bounded api&type draft / bounded db draft", "10", "1400"));
        return rows;
    }

    private List<String> defaultBundleChecklist() {
        List<String> rows = new ArrayList<>();
        rows.add("Ollama install script");
        rows.add("model manifest");
        rows.add("project/common version set");
        rows.add("bundle export/import verification");
        return rows;
    }

    private List<Map<String, Object>> defaultCommonJarSet() {
        List<Map<String, Object>> rows = new ArrayList<>();
        rows.add(namedRow("artifactId", "resonance-common-core", "artifactVersion", "1.0.0-seed", "role", "canonical common capability layer", "updatePolicy", "adapter-compatible wave promotion"));
        rows.add(namedRow("artifactId", "screenbuilder-core", "artifactVersion", "1.0.0-seed", "role", "screen builder engine", "updatePolicy", "structure version gated"));
        rows.add(namedRow("artifactId", "platform-runtime-control", "artifactVersion", "1.0.0-seed", "role", "runtime lifecycle and worker coordination", "updatePolicy", "ops compatibility review"));
        rows.add(namedRow("artifactId", "mapper-infra", "artifactVersion", "1.0.0-seed", "role", "shared mapper / persistence support candidate", "updatePolicy", "wave-5 mirrored candidate"));
        rows.add(namedRow("artifactId", "web-support", "artifactVersion", "1.0.0-seed", "role", "shared web support candidate", "updatePolicy", "wave-5 mirrored candidate"));
        return rows;
    }

    private List<Map<String, Object>> defaultProjectPackageSet() {
        List<Map<String, Object>> rows = new ArrayList<>();
        rows.add(namedRow("packageId", "carbonet-runtime", "runtimeTarget", "isolated-project-runtime", "includes", "project-runtime.jar + project-adapter.jar + common jar set + theme bundle + migration bundle"));
        rows.add(namedRow("packageId", "carbonet-airgap-bundle", "runtimeTarget", "air-gapped-delivery", "includes", "runtime package set + install scripts + model manifest + k8s release manifest"));
        return rows;
    }

    private List<Map<String, Object>> defaultK8sReleaseProfiles() {
        List<Map<String, Object>> rows = new ArrayList<>();
        rows.add(namedRow("releaseId", "operations-console", "namespace", "resonance-system", "workloadType", "deployment", "deployMode", "shared-control-plane"));
        rows.add(namedRow("releaseId", "carbonet-runtime", "namespace", "project-carbonet", "workloadType", "deployment", "deployMode", "isolated-project-runtime"));
        return rows;
    }

    private Map<String, Object> defaultBuilderStructure() {
        LinkedHashMap<String, Object> row = new LinkedHashMap<>();
        row.put("structureVersion", "screen-first-v1");
        row.put("currentScope", "screen / route / manifest / package composition");
        row.put("nextScope", "backend / db-aware scaffold");
        row.put("packageComposerEnabled", "true");
        return row;
    }

    private List<Map<String, Object>> defaultPromotionWaveStatus() {
        List<Map<String, Object>> rows = new ArrayList<>();
        rows.add(promotionWaveRow("wave-2", "screenbuilder-core", "Resonance", "mirrored", "Source mirrored into Resonance builder workspace"));
        rows.add(promotionWaveRow("wave-2", "screenbuilder-runtime-common-adapter", "Resonance", "mirrored", "Builder runtime adapter mirrored into Resonance"));
        rows.add(promotionWaveRow("wave-2", "platform-version-control", "Resonance", "mirrored", "Ops/version control module mirrored into Resonance"));
        rows.add(promotionWaveRow("wave-3", "resonance-modules-reactor", "Resonance", "seeded", "Transitional parent and workspace reactor established"));
        rows.add(promotionWaveRow("wave-4", "screenbuilder-runtime-common-adapter", "Resonance", "child-pom-seeded", "Wave 4 child pom draft prepared with screenbuilder-core bridge target"));
        rows.add(promotionWaveRow("wave-6-active", "screenbuilder-core", "Resonance", "active-pom-replaced", "Active pom.xml replaced after rename-only diff review"));
        rows.add(promotionWaveRow("wave-4", "platform-version-control", "Resonance", "child-pom-seeded", "Wave 4 child pom draft prepared with dependency bridge notes"));
        rows.add(promotionWaveRow("blocked", "common-auth", "Resonance", "source-gap", "Source ownership unresolved; keep out of active promotion wave"));
        rows.add(promotionWaveRow("wave-6-active", "mapper-infra", "Resonance", "active-pom-replaced", "Active pom.xml replaced after Wave 5 seed comparison"));
        rows.add(promotionWaveRow("wave-6-active", "web-support", "Resonance", "active-pom-replaced", "Active pom.xml replaced after Wave 5 seed comparison"));
        rows.add(promotionWaveRow("wave-5-bridge", "platform-version-control", "Resonance", "bridge-seeded", "pom.wave5.bridge.seed.xml prepared with resonance-mapper-infra and resonance-web-support"));
        return rows;
    }

    private List<Map<String, Object>> defaultOperationReadiness() {
        List<Map<String, Object>> rows = new ArrayList<>();
        rows.add(namedRow("operationId", "backup-create", "scriptPath", "ops/scripts/assemble-project-release.sh", "status", "planned-live-check", "note", "Assemble project release and prepare rollback-safe backup snapshot"));
        rows.add(namedRow("operationId", "bundle-export", "scriptPath", "ops/scripts/assemble-project-release.sh", "status", "planned-live-check", "note", "Prepare air-gapped export bundle from project release and common package set"));
        rows.add(namedRow("operationId", "docker-package-build", "scriptPath", "ops/scripts/build-project-docker.sh", "status", "planned-live-check", "note", "Build project runtime Docker image from assembled release"));
        rows.add(namedRow("operationId", "project-release-deploy", "scriptPath", "ops/scripts/deploy-project-release.sh", "status", "planned-live-check", "note", "Remote release deployment with rollback fallback"));
        rows.add(namedRow("operationId", "project-bluegreen-deploy", "scriptPath", "ops/scripts/deploy-project-bg.sh", "status", "planned-live-check", "note", "Blue/green zero-downtime deployment"));
        rows.add(namedRow("operationId", "db-migration-apply", "scriptPath", "ops/scripts/apply-project-db-migration.sh", "status", "planned-live-check", "note", "Project-specific DB migration application"));
        rows.add(namedRow("operationId", "release-rollback", "scriptPath", "ops/scripts/rollback-project-release.sh", "status", "planned-live-check", "note", "Rollback to previous stable project release"));
        rows.add(namedRow("operationId", "k8s-release", "scriptPath", "/opt/Resonance/deploy/k8s/projects/carbonet/carbonet-runtime.deployment.yaml", "status", "planned-live-check", "note", "Project runtime Kubernetes deployment manifest"));
        return rows;
    }

    private Map<String, Object> namedRow(String key1, String value1, String key2, String value2, String key3, String value3, String key4, String value4) {
        LinkedHashMap<String, Object> row = new LinkedHashMap<>();
        row.put(key1, value1);
        row.put(key2, value2);
        row.put(key3, value3);
        row.put(key4, value4);
        return row;
    }

    private Map<String, Object> namedRow(String key1, String value1, String key2, String value2, String key3, String value3) {
        LinkedHashMap<String, Object> row = new LinkedHashMap<>();
        row.put(key1, value1);
        row.put(key2, value2);
        row.put(key3, value3);
        return row;
    }

    private Map<String, Object> promotionWaveRow(String waveId, String moduleId, String workspace, String status, String note) {
        LinkedHashMap<String, Object> row = new LinkedHashMap<>();
        row.put("waveId", waveId);
        row.put("moduleId", moduleId);
        row.put("workspace", workspace);
        row.put("status", status);
        row.put("note", note);
        return row;
    }

    private Map<String, Object> modelRow(String modelName, String role, String status) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("modelName", modelName);
        row.put("role", role);
        row.put("status", status);
        return row;
    }

    private Map<String, Object> profileRow(String profileName, String status, String description) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("profileName", profileName);
        row.put("status", status);
        row.put("description", description);
        return row;
    }

    private Map<String, Object> runnerRow(String runnerId, String runnerType, String mode, String defaultModel, String note) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("runnerId", runnerId);
        row.put("runnerType", runnerType);
        row.put("mode", mode);
        row.put("defaultModel", defaultModel);
        row.put("note", note);
        return row;
    }

    private Map<String, Object> routerRow(String routerId, String routingPolicy, String smallModel, String mediumModel, String note) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("routerId", routerId);
        row.put("routingPolicy", routingPolicy);
        row.put("smallModel", smallModel);
        row.put("mediumModel", mediumModel);
        row.put("note", note);
        return row;
    }

    private Map<String, Object> toolchainRow(String toolchainId, String toolchainType, String status, String note) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("toolchainId", toolchainId);
        row.put("toolchainType", toolchainType);
        row.put("status", status);
        row.put("note", note);
        return row;
    }

    private Map<String, Object> agentRow(String profileId, String responsibilities, String maxFiles, String maxTotalLines) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("profileId", profileId);
        row.put("responsibilities", responsibilities);
        row.put("maxFiles", maxFiles);
        row.put("maxTotalLines", maxTotalLines);
        return row;
    }
}
