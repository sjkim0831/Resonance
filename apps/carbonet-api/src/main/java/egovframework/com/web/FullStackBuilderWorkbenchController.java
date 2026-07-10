package egovframework.com.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/api/runtime/full-stack-builder")
public class FullStackBuilderWorkbenchController {

    private final ObjectMapper objectMapper;
    private final Path workspaceRoot;
    private final Path backendMetadataRoot;

    public FullStackBuilderWorkbenchController(
            ObjectMapper objectMapper,
            @Value("${CARBONET_WORKSPACE_ROOT:/opt/Resonance}") String workspaceRoot,
            @Value("${CARBONET_BACKEND_METADATA_FS_OVERRIDE_PATH:/app/backend-metadata}") String backendMetadataRoot) {
        this.objectMapper = objectMapper;
        this.workspaceRoot = Path.of(workspaceRoot).normalize();
        this.backendMetadataRoot = Path.of(backendMetadataRoot).normalize();
    }

    @GetMapping("/status")
    public ResponseEntity<?> status() {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", "READY");
        response.put("workspaceRoot", workspaceRoot.toString());
        response.put("backendMetadataRoot", backendMetadataRoot.toString());
        response.put("gitHead", runGit("rev-parse", "--short", "HEAD").get("stdout"));
        response.put("gitBranch", runGit("rev-parse", "--abbrev-ref", "HEAD").get("stdout"));
        response.put("changedFiles", changedFiles());
        response.put("capabilities", List.of(
                "frontend-overlay-plan",
                "metadata-api-plan",
                "java-project-core-incremental-plan",
                "db-migration-dry-run-plan",
                "rollback-snapshot"));
        return ResponseEntity.ok(response);
    }

    @PostMapping("/plan")
    public ResponseEntity<?> plan(@RequestBody Map<String, Object> request) {
        String mode = safe(request.get("mode"), "frontend-only");
        List<String> changedFiles = stringList(request.get("changedFiles"));
        if (changedFiles.isEmpty()) {
            changedFiles = changedFiles();
        }

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", "PLANNED");
        response.put("mode", mode);
        response.put("target", request.getOrDefault("target", Map.of()));
        response.put("frontendCandidate", request.getOrDefault("frontendCandidate", Map.of()));
        response.put("changedFiles", changedFiles);
        response.put("compilePlan", compilePlan(mode, changedFiles));
        response.put("verificationPlan", verificationPlan(mode));
        response.put("rollbackPlan", rollbackPlan(mode, changedFiles));
        response.put("generatedAt", Instant.now().toString());
        return ResponseEntity.ok(response);
    }

    @PostMapping("/snapshot")
    public ResponseEntity<?> snapshot(@RequestBody Map<String, Object> request) throws IOException {
        Files.createDirectories(backendMetadataRoot.resolve("builder-snapshots"));
        String id = "builder-snapshot-" + Instant.now().toString().replace(":", "").replace(".", "-");
        Path snapshotFile = backendMetadataRoot.resolve("builder-snapshots").resolve(id + ".json").normalize();
        if (!snapshotFile.startsWith(backendMetadataRoot)) {
            throw new IllegalArgumentException("Snapshot path escapes metadata root.");
        }

        Map<String, Object> snapshot = new LinkedHashMap<>();
        snapshot.put("id", id);
        snapshot.put("createdAt", Instant.now().toString());
        snapshot.put("gitHead", runGit("rev-parse", "--short", "HEAD").get("stdout"));
        snapshot.put("gitStatus", changedFiles());
        snapshot.put("request", request);
        snapshot.put("restoreHint", "Use the snapshot metadata with git diff/status and selected frontend candidate to restore builder state.");
        Files.writeString(snapshotFile, objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(snapshot), StandardCharsets.UTF_8);

        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", "SNAPSHOT_CREATED");
        response.put("snapshotId", id);
        response.put("path", backendMetadataRoot.relativize(snapshotFile).toString().replace('\\', '/'));
        response.put("size", Files.size(snapshotFile));
        return ResponseEntity.ok(response);
    }

    private List<String> changedFiles() {
        String stdout = safe(runGit("status", "--short").get("stdout"), "");
        List<String> files = new ArrayList<>();
        for (String line : stdout.split("\\R")) {
            String trimmed = line.trim();
            if (trimmed.length() > 3) {
                files.add(trimmed.substring(3).trim());
            }
        }
        return files;
    }

    private List<Map<String, Object>> compilePlan(String mode, List<String> changedFiles) {
        List<Map<String, Object>> steps = new ArrayList<>();
        boolean frontend = changedFiles.stream().anyMatch(path -> path.startsWith("projects/carbonet-frontend/source/"));
        boolean java = changedFiles.stream().anyMatch(path -> path.endsWith(".java") || path.contains("/src/main/java/"));
        boolean db = changedFiles.stream().anyMatch(path -> path.endsWith(".sql") || path.contains("/db/") || path.contains("/migration/"));

        if ("frontend-only".equals(mode) || frontend) {
            steps.add(step("FRONTEND_OVERLAY", "npm run build from carbonet frontend source; sync generated static overlay only after success", !changedFiles.isEmpty()));
        }
        if ("metadata-api".equals(mode)) {
            steps.add(step("METADATA_CONTRACT", "validate builder metadata JSON/API contract; avoid Java build unless controller signature changes", true));
        }
        if ("java-core".equals(mode) || java) {
            steps.add(step("JAVA_INCREMENTAL", "./gradlew :apps:carbonet-api:classes or project-core target classes for changed Java files", java));
            steps.add(step("RUNTIME_RELOAD_DECISION", "try hot reload if class shape is compatible; otherwise schedule rolling restart", java));
        }
        if ("db-migration".equals(mode) || db) {
            steps.add(step("DB_DRY_RUN", "generate rollback SQL, run validation transaction, then apply with lock/timeout guard", db));
        }
        if (steps.isEmpty()) {
            steps.add(step("NO_COMPILE", "metadata-only or prompt-only change; create snapshot and verify target route", true));
        }
        return steps;
    }

    private List<String> verificationPlan(String mode) {
        List<String> checks = new ArrayList<>();
        checks.add("capture git status before and after");
        checks.add("verify target route returns non-bootstrap-error HTML");
        checks.add("verify /actuator/health readiness");
        if ("db-migration".equals(mode)) {
            checks.add("verify migration dry-run and rollback SQL");
        }
        if ("java-core".equals(mode)) {
            checks.add("run targeted Gradle classes/test task for changed Java packages");
        }
        return checks;
    }

    private List<String> rollbackPlan(String mode, List<String> changedFiles) {
        List<String> rollback = new ArrayList<>();
        rollback.add("builder snapshot JSON in backend metadata");
        rollback.add("git diff patch for changed source files");
        rollback.add("selected frontend candidate id/html saved in request payload");
        if ("db-migration".equals(mode) || changedFiles.stream().anyMatch(path -> path.endsWith(".sql"))) {
            rollback.add("rollback SQL must be generated before apply");
        }
        return rollback;
    }

    private Map<String, Object> step(String id, String detail, boolean active) {
        Map<String, Object> step = new LinkedHashMap<>();
        step.put("id", id);
        step.put("detail", detail);
        step.put("active", active);
        return step;
    }

    private Map<String, String> runGit(String... args) {
        Map<String, String> result = new LinkedHashMap<>();
        List<String> command = new ArrayList<>();
        command.add("git");
        command.addAll(List.of(args));
        try {
            Process process = new ProcessBuilder(command)
                    .directory(workspaceRoot.toFile())
                    .redirectErrorStream(true)
                    .start();
            boolean finished = process.waitFor(4, TimeUnit.SECONDS);
            String output = new String(process.getInputStream().readAllBytes(), StandardCharsets.UTF_8).trim();
            result.put("stdout", output);
            result.put("exitCode", finished ? String.valueOf(process.exitValue()) : "timeout");
        } catch (Exception e) {
            result.put("stdout", "");
            result.put("exitCode", "error");
            result.put("message", e.getMessage());
        }
        return result;
    }

    private String safe(Object value, String fallback) {
        return value == null ? fallback : String.valueOf(value).trim();
    }

    private List<String> stringList(Object value) {
        if (!(value instanceof List<?> values)) {
            return List.of();
        }
        List<String> result = new ArrayList<>();
        for (Object item : values) {
            String text = safe(item, "");
            if (!text.isEmpty()) {
                result.add(text);
            }
        }
        return result;
    }
}
