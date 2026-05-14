package egovframework.com.platform.observability.web;

import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.lang.management.ManagementFactory;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@Controller
@RequestMapping({"/admin/system/operations", "/en/admin/system/operations"})
public class PlatformOperationsInventoryController {

    private static final Duration COMMAND_TIMEOUT = Duration.ofSeconds(3);

    @GetMapping("/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> pageData() {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("generatedAt", Instant.now().toString());
        payload.put("runtime", runtimeSnapshot());
        payload.put("resources", resourceSnapshot());
        payload.put("installedPrograms", installedPrograms());
        payload.put("kubernetes", kubernetesSnapshot());
        payload.put("logs", logSources());
        payload.put("aiHangar", aiHangar());
        payload.put("themes", themeInventory());
        payload.put("automation", automationChecklist());
        return ResponseEntity.ok(payload);
    }

    private Map<String, Object> runtimeSnapshot() {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("javaVersion", System.getProperty("java.version", ""));
        row.put("javaVendor", System.getProperty("java.vendor", ""));
        row.put("osName", System.getProperty("os.name", ""));
        row.put("osArch", System.getProperty("os.arch", ""));
        row.put("availableProcessors", Runtime.getRuntime().availableProcessors());
        row.put("maxMemoryMb", Runtime.getRuntime().maxMemory() / 1024 / 1024);
        row.put("totalMemoryMb", Runtime.getRuntime().totalMemory() / 1024 / 1024);
        row.put("freeMemoryMb", Runtime.getRuntime().freeMemory() / 1024 / 1024);
        row.put("uptimeMs", ManagementFactory.getRuntimeMXBean().getUptime());
        row.put("pid", ProcessHandle.current().pid());
        return row;
    }

    private Map<String, Object> resourceSnapshot() {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("loadavg", readFirstLine(Path.of("/proc/loadavg")));
        row.put("meminfo", readKeyValues(Path.of("/proc/meminfo"), 12));
        row.put("disk", runCommand("df", "-h", "/"));
        row.put("mounts", readLines(Path.of("/proc/mounts"), 20));
        row.put("cpu", readLines(Path.of("/proc/cpuinfo"), 18));
        return row;
    }

    private List<Map<String, Object>> installedPrograms() {
        List<Map<String, Object>> rows = new ArrayList<>();
        addProgram(rows, "java", "-version");
        addProgram(rows, "node", "--version");
        addProgram(rows, "npm", "--version");
        addProgram(rows, "kubectl", "version", "--client=true");
        addProgram(rows, "tmux", "-V");
        addProgram(rows, "curl", "--version");
        addProgram(rows, "bash", "--version");
        addProgram(rows, "python3", "--version");
        return rows;
    }

    private void addProgram(List<Map<String, Object>> rows, String... command) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("name", command[0]);
        CommandResult result = runCommand(command);
        row.put("available", result.exitCode == 0);
        row.put("version", firstNonBlankLine(result.output));
        row.put("exitCode", result.exitCode);
        row.put("checkedAt", Instant.now().toString());
        rows.add(row);
    }

    private Map<String, Object> kubernetesSnapshot() {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("nodes", runCommand("kubectl", "get", "nodes", "-o", "wide"));
        row.put("carbonetPods", runCommand("kubectl", "-n", "carbonet-prod", "get", "pods", "-o", "wide"));
        row.put("services", runCommand("kubectl", "-n", "carbonet-prod", "get", "svc", "-o", "wide"));
        row.put("events", runCommand("kubectl", "-n", "carbonet-prod", "get", "events", "--sort-by=.lastTimestamp"));
        return row;
    }

    private List<Map<String, String>> logSources() {
        List<Map<String, String>> rows = new ArrayList<>();
        rows.add(logSource("K8S_DOCTOR", "/opt/Resonance/var/ai-runtime/k8s-ops-doctor-events.jsonl", "Kubernetes/CUBRID doctor event log"));
        rows.add(logSource("NODE_EXPORTER", "/var/lib/prometheus/node-exporter/resonance_k8s.prom", "Prometheus textfile metrics"));
        rows.add(logSource("APP_STDOUT", "kubectl logs deploy/carbonet-runtime", "Application runtime logs"));
        rows.add(logSource("CUBRID_BROKER", "/home/cubrid/CUBRID/log/broker", "CUBRID broker sql/error/access logs"));
        rows.add(logSource("DB_PATCH", "DB_PATCH_HISTORY", "Database patch execution history"));
        return rows;
    }

    private Map<String, String> logSource(String code, String location, String description) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("code", code);
        row.put("location", location);
        row.put("description", description);
        return row;
    }

    private List<Map<String, String>> aiHangar() {
        List<Map<String, String>> rows = new ArrayList<>();
        rows.add(aiItem("tiny-log-classifier", "Planned", "Classify CUBRID, Kubernetes, build, disk, and memory incidents before runbook selection."));
        rows.add(aiItem("runbook-selector", "Ready for rules", "Use deterministic rules first; tiny model may rank matching runbooks after enough incidents are stored."));
        rows.add(aiItem("codex-escalation", "Ready", "Keep deep analysis and code changes under Codex/operator approval."));
        rows.add(aiItem("training-store", "Planned", "Persist failure logs, selected runbook, result, and operator correction for later tuning."));
        return rows;
    }

    private Map<String, String> aiItem(String name, String status, String description) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("name", name);
        row.put("status", status);
        row.put("description", description);
        return row;
    }

    private List<Map<String, String>> themeInventory() {
        List<Map<String, String>> rows = new ArrayList<>();
        rows.add(theme("admin-governed-management-layout", "Active", "Admin management pages and operations consoles"));
        rows.add(theme("krds-public-service", "Active", "Homepage and public service screens"));
        rows.add(theme("screen-builder-runtime", "Active", "Generated and manifest-backed screens"));
        rows.add(theme("operations-dark-data", "Candidate", "Dense runtime and incident dashboards"));
        return rows;
    }

    private Map<String, String> theme(String name, String status, String description) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("name", name);
        row.put("status", status);
        row.put("description", description);
        return row;
    }

    private List<Map<String, String>> automationChecklist() {
        List<Map<String, String>> rows = new ArrayList<>();
        rows.add(check("Kubernetes start", "Required", "kubelet/containerd must start CUBRID and runtime workloads automatically."));
        rows.add(check("Web service start", "Applied outside app", "carbonet-runtime deployment keeps two ready pods behind port 80."));
        rows.add(check("DB start", "Applied outside app", "CUBRID StatefulSet starts broker ports 33000 and 33001."));
        rows.add(check("Build deploy", "Guarded", "Automatic backend redeploy is disabled until source fingerprint loop is corrected."));
        rows.add(check("Recovery evidence", "Applied", "Doctor writes metrics and JSONL events for broker/runtime health."));
        return rows;
    }

    private Map<String, String> check(String name, String status, String description) {
        Map<String, String> row = new LinkedHashMap<>();
        row.put("name", name);
        row.put("status", status);
        row.put("description", description);
        return row;
    }

    private Map<String, String> readKeyValues(Path path, int limit) {
        Map<String, String> values = new LinkedHashMap<>();
        for (String line : readLines(path, limit)) {
            int separator = line.indexOf(':');
            if (separator > 0) {
                values.put(line.substring(0, separator), line.substring(separator + 1).trim());
            }
        }
        return values;
    }

    private String readFirstLine(Path path) {
        List<String> lines = readLines(path, 1);
        return lines.isEmpty() ? "" : lines.get(0);
    }

    private List<String> readLines(Path path, int limit) {
        try {
            return Files.readAllLines(path, StandardCharsets.UTF_8).stream().limit(limit).toList();
        } catch (IOException | SecurityException ignored) {
            return List.of();
        }
    }

    private CommandResult runCommand(String... command) {
        ProcessBuilder builder = new ProcessBuilder(command);
        builder.redirectErrorStream(true);
        try {
            Process process = builder.start();
            boolean finished = process.waitFor(COMMAND_TIMEOUT.toMillis(), TimeUnit.MILLISECONDS);
            String output;
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
                output = reader.lines().limit(80).reduce("", (left, right) -> left + (left.isEmpty() ? "" : "\n") + right);
            }
            if (!finished) {
                process.destroyForcibly();
                return new CommandResult(124, output);
            }
            return new CommandResult(process.exitValue(), output);
        } catch (IOException | InterruptedException | SecurityException ex) {
            if (ex instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            return new CommandResult(127, ex.getMessage() == null ? "" : ex.getMessage());
        }
    }

    private String firstNonBlankLine(String output) {
        for (String line : output.split("\\R")) {
            String compact = line.trim();
            if (!compact.isEmpty()) {
                return compact.length() > 180 ? compact.substring(0, 180) : compact;
            }
        }
        return "";
    }

    private record CommandResult(int exitCode, String output) {
        public String status() {
            return exitCode == 0 ? "OK" : "UNAVAILABLE";
        }
    }
}
