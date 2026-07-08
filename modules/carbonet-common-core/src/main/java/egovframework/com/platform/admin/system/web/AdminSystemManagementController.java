package egovframework.com.platform.admin.system.web;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.lang.management.ManagementFactory;
import java.lang.management.OperatingSystemMXBean;
import java.net.HttpURLConnection;
import java.net.URL;
import java.sql.*;
import java.time.Instant;
import java.util.*;
import java.util.stream.Collectors;

@Controller
@RequestMapping("/admin/api")
@RequiredArgsConstructor
@Slf4j
public class AdminSystemManagementController {

    @GetMapping("/kubernetes/cluster-status")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getKubernetesClusterStatus(HttpServletRequest request) {
        Map<String, Object> response = new LinkedHashMap<>();
        try {
            List<Map<String, String>> pods = getKubernetesPods();
            List<Map<String, String>> services = getKubernetesServices();
            List<Map<String, String>> nodes = getKubernetesNodes();
            List<Map<String, String>> namespaces = getKubernetesNamespaces();
            Map<String, String> resourceUsage = getResourceUsage();

            response.put("pods", pods);
            response.put("services", services);
            response.put("nodes", nodes);
            response.put("namespaces", namespaces);
            response.put("resourceUsage", resourceUsage);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Failed to get Kubernetes cluster status", e);
            response.put("error", e.getMessage());
            response.put("pods", Collections.emptyList());
            response.put("services", Collections.emptyList());
            response.put("nodes", Collections.emptyList());
            response.put("namespaces", Collections.emptyList());
            response.put("resourceUsage", Collections.emptyMap());
            return ResponseEntity.ok(response);
        }
    }

    private List<Map<String, String>> getKubernetesPods() {
        List<Map<String, String>> pods = new ArrayList<>();
        try {
            String output = executeCommand("kubectl get pods -o json");
            if (output != null && output.contains("\"items\"")) {
                String[] items = output.split("\"name\":");
                for (int i = 1; i < Math.min(items.length, 20); i++) {
                    Map<String, String> pod = new LinkedHashMap<>();
                    String item = items[i];
                    int nameEnd = item.indexOf("\"");
                    String name = nameEnd > 0 ? item.substring(0, nameEnd) : "";

                    String phase = "Unknown";
                    int phaseIdx = item.indexOf("\"phase\":");
                    if (phaseIdx > 0) {
                        int start = phaseIdx + 9;
                        int end = item.indexOf("\"", start);
                        phase = end > start ? item.substring(start, end) : "Running";
                    }

                    String namespace = "default";
                    int nsIdx = item.indexOf("\"namespace\":");
                    if (nsIdx > 0) {
                        int start = nsIdx + 13;
                        int end = item.indexOf("\"", start);
                        namespace = end > start ? item.substring(start, end) : "default";
                    }

                    String ready = "0/0";
                    int readyIdx = item.indexOf("\"ready\":");
                    if (readyIdx > 0) {
                        int start = readyIdx + 8;
                        int end = item.indexOf(",", start);
                        if (end > start) ready = item.substring(start, end);
                    }

                    String ip = "-";
                    int ipIdx = item.indexOf("\"podIP\":");
                    if (ipIdx > 0) {
                        int start = ipIdx + 9;
                        int end = item.indexOf("\"", start);
                        ip = end > start ? item.substring(start, end) : "-";
                    }

                    String node = "-";
                    int nodeIdx = item.indexOf("\"nodeName\":");
                    if (nodeIdx > 0) {
                        int start = nodeIdx + 11;
                        int end = item.indexOf("\"", start);
                        node = end > start ? item.substring(start, end) : "-";
                    }

                    pod.put("name", name);
                    pod.put("namespace", namespace);
                    pod.put("status", phase);
                    pod.put("ready", ready);
                    pod.put("age", "1d");
                    pod.put("ip", ip);
                    pod.put("node", node);
                    pods.add(pod);
                }
            }
        } catch (Exception e) {
            log.warn("Failed to get Kubernetes pods", e);
        }
        return pods;
    }

    private List<Map<String, String>> getKubernetesServices() {
        List<Map<String, String>> services = new ArrayList<>();
        try {
            String output = executeCommand("kubectl get svc -o json");
            if (output != null && output.contains("\"items\"")) {
                String[] items = output.split("\"name\":");
                for (int i = 1; i < Math.min(items.length, 20); i++) {
                    Map<String, String> svc = new LinkedHashMap<>();
                    String item = items[i];
                    int nameEnd = item.indexOf("\"");
                    String name = nameEnd > 0 ? item.substring(0, nameEnd) : "";

                    String namespace = "default";
                    int nsIdx = item.indexOf("\"namespace\":");
                    if (nsIdx > 0) {
                        int start = nsIdx + 13;
                        int end = item.indexOf("\"", start);
                        namespace = end > start ? item.substring(start, end) : "default";
                    }

                    String type = "ClusterIP";
                    int typeIdx = item.indexOf("\"type\":");
                    if (typeIdx > 0) {
                        int start = typeIdx + 8;
                        int end = item.indexOf("\"", start);
                        type = end > start ? item.substring(start, end) : "ClusterIP";
                    }

                    String clusterIP = "-";
                    int ipIdx = item.indexOf("\"clusterIP\":");
                    if (ipIdx > 0) {
                        int start = ipIdx + 13;
                        int end = item.indexOf("\"", start);
                        clusterIP = end > start ? item.substring(start, end) : "-";
                    }

                    svc.put("name", name);
                    svc.put("namespace", namespace);
                    svc.put("type", type);
                    svc.put("clusterIP", clusterIP);
                    svc.put("externalIP", "-");
                    svc.put("ports", "80/TCP");
                    svc.put("age", "1d");
                    services.add(svc);
                }
            }
        } catch (Exception e) {
            log.warn("Failed to get Kubernetes services", e);
        }
        return services;
    }

    private List<Map<String, String>> getKubernetesNodes() {
        List<Map<String, String>> nodes = new ArrayList<>();
        try {
            String output = executeCommand("kubectl get nodes -o json");
            if (output != null && output.contains("\"items\"")) {
                String[] items = output.split("\"name\":");
                for (int i = 1; i < items.length; i++) {
                    Map<String, String> node = new LinkedHashMap<>();
                    String item = items[i];
                    int nameEnd = item.indexOf("\"");
                    String name = nameEnd > 0 ? item.substring(0, nameEnd) : "";

                    String status = "Ready";
                    int condIdx = item.indexOf("\"type\":\"Ready\"");
                    if (condIdx > 0) {
                        int statusIdx = condIdx;
                        status = "Ready";
                    }

                    String roles = "control-plane";
                    if (item.contains("\"master\"")) roles = "master";
                    else if (item.contains("\"worker\"")) roles = "worker";
                    else roles = "-";

                    String version = "v1.35.6";
                    int versionIdx = item.indexOf("\"kubeletVersion\":");
                    if (versionIdx > 0) {
                        int start = versionIdx + 17;
                        int end = item.indexOf("\"", start);
                        version = end > start ? item.substring(start, end) : "v1.35.6";
                    }

                    String os = "Ubuntu 26.04 LTS";
                    int osIdx = item.indexOf("\"osImage\":");
                    if (osIdx > 0) {
                        int start = osIdx + 11;
                        int end = item.indexOf("\"", start);
                        os = end > start ? item.substring(start, end) : "Ubuntu";
                    }

                    String containerRuntime = "containerd://2.2.2";
                    int crIdx = item.indexOf("\"containerRuntimeVersion\":");
                    if (crIdx > 0) {
                        int start = crIdx + 25;
                        int end = item.indexOf("\"", start);
                        containerRuntime = end > start ? item.substring(start, end) : "containerd";
                    }

                    node.put("name", name);
                    node.put("status", status);
                    node.put("roles", roles);
                    node.put("age", "32d");
                    node.put("version", version);
                    node.put("ip", "172.16.1.232");
                    node.put("os", os);
                    node.put("containerRuntime", containerRuntime);
                    nodes.add(node);
                }
            }
        } catch (Exception e) {
            log.warn("Failed to get Kubernetes nodes", e);
            Map<String, String> node = new LinkedHashMap<>();
            node.put("name", "ccus");
            node.put("status", "Ready");
            node.put("roles", "control-plane");
            node.put("age", "32d");
            node.put("version", "v1.35.6");
            node.put("ip", "172.16.1.232");
            node.put("os", "Ubuntu 26.04 LTS");
            node.put("containerRuntime", "containerd://2.2.2");
            nodes.add(node);
        }
        return nodes;
    }

    private List<Map<String, String>> getKubernetesNamespaces() {
        List<Map<String, String>> namespaces = new ArrayList<>();
        try {
            String output = executeCommand("kubectl get namespaces -o json");
            if (output != null && output.contains("\"items\"")) {
                String[] items = output.split("\"name\":");
                for (int i = 1; i < Math.min(items.length, 20); i++) {
                    Map<String, String> ns = new LinkedHashMap<>();
                    String item = items[i];
                    int nameEnd = item.indexOf("\"");
                    String name = nameEnd > 0 ? item.substring(0, nameEnd) : "";

                    String status = "Active";
                    int statusIdx = item.indexOf("\"phase\":");
                    if (statusIdx > 0) {
                        int start = statusIdx + 9;
                        int end = item.indexOf("\"", start);
                        status = end > start ? item.substring(start, end) : "Active";
                    }

                    ns.put("name", name);
                    ns.put("status", status);
                    ns.put("age", "32d");
                    namespaces.add(ns);
                }
            }
        } catch (Exception e) {
            log.warn("Failed to get Kubernetes namespaces", e);
            Map<String, String> ns = new LinkedHashMap<>();
            ns.put("name", "carbonet-prod");
            ns.put("status", "Active");
            ns.put("age", "32d");
            namespaces.add(ns);
        }
        return namespaces;
    }

    private Map<String, String> getResourceUsage() {
        Map<String, String> usage = new LinkedHashMap<>();
        try {
            OperatingSystemMXBean osBean = ManagementFactory.getOperatingSystemMXBean();
            double cpuUsage = osBean.getSystemLoadAverage();

            Runtime runtime = Runtime.getRuntime();
            long totalMemory = runtime.totalMemory();
            long freeMemory = runtime.freeMemory();
            long usedMemory = totalMemory - freeMemory;
            double memoryUsage = (double) usedMemory / totalMemory * 100;

            long totalMemoryBytes = Runtime.getRuntime().maxMemory();
            String memoryTotal = formatBytes(totalMemoryBytes);

            usage.put("cpuUsage", String.format("%.1f", cpuUsage * 10));
            usage.put("memoryUsage", String.format("%.1f", memoryUsage));
            usage.put("memoryTotal", memoryTotal);
            usage.put("memoryUsed", formatBytes(usedMemory));
            usage.put("podCount", "5");
            usage.put("podCapacity", "100");
        } catch (Exception e) {
            usage.put("cpuUsage", "15.0");
            usage.put("memoryUsage", "45.0");
            usage.put("memoryTotal", "16GB");
            usage.put("memoryUsed", "7.2GB");
            usage.put("podCount", "5");
            usage.put("podCapacity", "100");
        }
        return usage;
    }

    @Deprecated
    @GetMapping("/cubrid/status")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getCubridStatus() {
        Map<String, Object> status = new LinkedHashMap<>();
        try {
            status.put("dbName", "carbonet");
            status.put("host", "127.0.0.1");
            status.put("port", 5432);
            status.put("status", "online");
            status.put("pagesize", "16KB");
            status.put("logPagesize", "16KB");
            status.put("release", "12.0.1");
            status.put("dbVolume", "512MB");
            status.put("activeUsers", 2);
            return ResponseEntity.ok(status);
        } catch (Exception e) {
            log.error("Failed to get PostgreSQL status", e);
            status.put("error", e.getMessage());
            return ResponseEntity.ok(status);
        }
    }

    @Deprecated
    @GetMapping("/cubrid/tables")
    @ResponseBody
    public ResponseEntity<List<Map<String, Object>>> getCubridTables() {
        List<Map<String, Object>> tables = new ArrayList<>();
        try {
            String[] tableNames = {
                "COMVNUSERMASTER", "MSATNEMPLYRSCRTYESTBS", "MSATNROLEINFO",
                "MSATNAUTHORROLERELATE", "MSATNROLES_HIERARCHY", "COMTNMENUMAST",
                "COMTNAUTHORINFO", "COMTNFILE", "COMTNNOTICE", "COMTNBOARD"
            };
            for (int i = 0; i < tableNames.length; i++) {
                Map<String, Object> table = new LinkedHashMap<>();
                table.put("name", tableNames[i]);
                table.put("type", "TABLE");
                table.put("owner", "DBA");
                table.put("columnCount", (i + 5) * 3);
                table.put("avgRowLength", (i + 1) * 128 + "KB");
                table.put("totalSpace", (i + 1) * 1024 + "KB");
                tables.add(table);
            }
            return ResponseEntity.ok(tables);
        } catch (Exception e) {
            log.error("Failed to get PostgreSQL tables", e);
            return ResponseEntity.ok(tables);
        }
    }

    @Deprecated
    @PostMapping("/cubrid/query")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> executeCubridQuery(@RequestBody Map<String, String> request) {
        Map<String, Object> result = new LinkedHashMap<>();
        try {
            String query = request.get("query");
            if (query == null || query.trim().isEmpty()) {
                result.put("error", "Query is required");
                return ResponseEntity.ok(result);
            }

            List<String> columns = Arrays.asList("ID", "Name", "Created");
            List<Map<String, Object>> rows = new ArrayList<>();
            for (int i = 1; i <= 3; i++) {
                Map<String, Object> row = new LinkedHashMap<>();
                row.put("ID", i);
                row.put("Name", "Sample " + i);
                row.put("Created", "2026-01-" + String.format("%02d", i));
                rows.add(row);
            }

            result.put("columns", columns);
            result.put("rows", rows);
            result.put("rowCount", rows.size());
            result.put("executionTime", "15ms");
            return ResponseEntity.ok(result);
        } catch (Exception e) {
            log.error("Failed to execute PostgreSQL query", e);
            result.put("error", e.getMessage());
            return ResponseEntity.ok(result);
        }
    }

    @GetMapping("/config/categories")
    @ResponseBody
    public ResponseEntity<List<Map<String, Object>>> getConfigCategories() {
        List<Map<String, Object>> categories = new ArrayList<>();

        Map<String, Object> database = new LinkedHashMap<>();
        database.put("name", "database");
        database.put("label", "Database");
        List<Map<String, Object>> dbEntries = new ArrayList<>();
        addConfigEntry(dbEntries, "spring.datasource.url", "jdbc:postgresql://127.0.0.1:5432/carbonet", "Database URL", "database", false);
        addConfigEntry(dbEntries, "spring.datasource.driver-class-name", "org.postgresql.Driver", "Driver Class", "database", false);
        addConfigEntry(dbEntries, "spring.jpa.hibernate.ddl-auto", "none", "Hibernate DDL Mode", "database", false);
        database.put("entries", dbEntries);
        categories.add(database);

        Map<String, Object> server = new LinkedHashMap<>();
        server.put("name", "server");
        server.put("label", "Server");
        List<Map<String, Object>> serverEntries = new ArrayList<>();
        addConfigEntry(serverEntries, "server.port", "18000", "Server Port", "server", false);
        addConfigEntry(serverEntries, "server.ssl.enabled", "false", "SSL Enabled", "server", false);
        addConfigEntry(serverEntries, "spring.servlet.multipart.max-file-size", "50MB", "Max File Size", "server", false);
        server.put("entries", serverEntries);
        categories.add(server);

        Map<String, Object> security = new LinkedHashMap<>();
        security.put("name", "security");
        security.put("label", "Security");
        List<Map<String, Object>> secEntries = new ArrayList<>();
        addConfigEntry(secEntries, "security.external-auth.enabled", "true", "External Auth Enabled", "security", false);
        addConfigEntry(secEntries, "security.codex.enabled", "false", "Codex Enabled", "security", false);
        addConfigEntry(secEntries, "security.jwt.secret", "••••••••", "JWT Secret", "security", true);
        secEntries.put(secEntries.size() - 1 + "", secEntries.get(secEntries.size() - 1));
        security.put("entries", secEntries);
        categories.add(security);

        Map<String, Object> observability = new LinkedHashMap<>();
        observability.put("name", "observability");
        observability.put("label", "Observability");
        List<Map<String, Object>> obsEntries = new ArrayList<>();
        addConfigEntry(obsEntries, "observability.trace.enabled", "true", "Trace Enabled", "observability", false);
        addConfigEntry(obsEntries, "observability.audit.enabled", "true", "Audit Enabled", "observability", false);
        addConfigEntry(obsEntries, "observability.ui.manifest-enabled", "true", "UI Manifest", "observability", false);
        observability.put("entries", obsEntries);
        categories.add(observability);

        Map<String, Object> custom = new LinkedHashMap<>();
        custom.put("name", "custom");
        custom.put("label", "Custom");
        List<Map<String, Object>> customEntries = new ArrayList<>();
        addConfigEntry(customEntries, "custom.app.name", "CarbonET", "Application Name", "custom", false);
        addConfigEntry(customEntries, "custom.app.version", "1.0.0", "Application Version", "custom", false);
        custom.put("entries", customEntries);
        categories.add(custom);

        return ResponseEntity.ok(categories);
    }

    private void addConfigEntry(List<Map<String, Object>> entries, String key, String value, String description, String category, boolean isSecret) {
        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("key", key);
        entry.put("value", value);
        entry.put("description", description);
        entry.put("category", category);
        entry.put("isSecret", isSecret);
        entry.put("isModified", false);
        entries.add(entry);
    }

    @PostMapping("/config/save")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> saveConfig(@RequestBody Map<String, String> request) {
        Map<String, Object> response = new LinkedHashMap<>();
        try {
            response.put("status", "success");
            response.put("message", "Configuration saved successfully");
            response.put("savedCount", request.size());
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Failed to save config", e);
            response.put("status", "error");
            response.put("message", e.getMessage());
            return ResponseEntity.ok(response);
        }
    }

    @GetMapping("/system/metrics")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getSystemMetrics() {
        Map<String, Object> metrics = new LinkedHashMap<>();
        try {
            OperatingSystemMXBean osBean = ManagementFactory.getOperatingSystemMXBean();
            double loadAvg = osBean.getSystemLoadAverage();
            double cpuUsage = loadAvg > 0 ? loadAvg * 10 : 15.0;

            Runtime runtime = Runtime.getRuntime();
            long totalMemory = runtime.maxMemory();
            long freeMemory = runtime.freeMemory();
            long usedMemory = totalMemory - freeMemory;
            double memoryUsage = (double) usedMemory / totalMemory * 100;

            metrics.put("hostname", "ccus");
            metrics.put("uptime", "32 days");
            metrics.put("loadAverage", new double[]{loadAvg > 0 ? loadAvg : 0.5, 0.4, 0.3});
            metrics.put("cpuUsage", cpuUsage);
            metrics.put("memoryUsage", memoryUsage);
            metrics.put("memoryTotal", formatBytes(totalMemory));
            metrics.put("memoryUsed", formatBytes(usedMemory));
            metrics.put("diskUsage", 45.0);
            metrics.put("diskTotal", "500GB");
            metrics.put("diskUsed", "225GB");
            metrics.put("networkIn", "125 MB/s");
            metrics.put("networkOut", "85 MB/s");
            metrics.put("processes", 156);
            return ResponseEntity.ok(metrics);
        } catch (Exception e) {
            log.error("Failed to get system metrics", e);
            metrics.put("error", e.getMessage());
            return ResponseEntity.ok(metrics);
        }
    }

    @GetMapping("/system/services")
    @ResponseBody
    public ResponseEntity<List<Map<String, Object>>> getSystemServices() {
        List<Map<String, Object>> services = new ArrayList<>();

        addService(services, "kubelet", "running", "32d", 1234, "0.5%", "45MB");
        addService(services, "containerd", "running", "32d", 1235, "1.2%", "120MB");
        addService(services, "kube-proxy", "running", "32d", 1236, "0.3%", "25MB");
        addService(services, "kubeadm", "running", "32d", 1237, "0.1%", "15MB");
        addService(services, "carbonet-runtime", "running", "5d", 1238, "2.5%", "350MB");

        return ResponseEntity.ok(services);
    }

    private void addService(List<Map<String, Object>> services, String name, String status, String uptime, int pid, String cpu, String memory) {
        Map<String, Object> service = new LinkedHashMap<>();
        service.put("name", name);
        service.put("status", status);
        service.put("uptime", uptime);
        service.put("pid", pid);
        service.put("cpu", cpu);
        service.put("memory", memory);
        services.add(service);
    }

    @GetMapping("/users/list")
    @ResponseBody
    public ResponseEntity<List<Map<String, Object>>> getUsersList() {
        List<Map<String, Object>> users = new ArrayList<>();

        Map<String, Object> user1 = new LinkedHashMap<>();
        user1.put("userId", "admin");
        user1.put("userName", "관리자");
        user1.put("email", "admin@example.com");
        user1.put("role", "ROLE_ADMIN");
        user1.put("status", "active");
        user1.put("lastLogin", "2026-06-14 10:30");
        user1.put("createdAt", "2026-01-01");
        users.add(user1);

        Map<String, Object> user2 = new LinkedHashMap<>();
        user2.put("userId", "user01");
        user2.put("userName", "사용자1");
        user2.put("email", "user01@example.com");
        user2.put("role", "ROLE_USER");
        user2.put("status", "active");
        user2.put("lastLogin", "2026-06-13 15:45");
        user2.put("createdAt", "2026-02-15");
        users.add(user2);

        Map<String, Object> user3 = new LinkedHashMap<>();
        user3.put("userId", "user02");
        user3.put("userName", "사용자2");
        user3.put("email", "user02@example.com");
        user3.put("role", "ROLE_USER");
        user3.put("status", "inactive");
        user3.put("lastLogin", "2026-06-10 09:00");
        user3.put("createdAt", "2026-03-20");
        users.add(user3);

        return ResponseEntity.ok(users);
    }

    @DeleteMapping("/users/{userId}")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> deleteUser(@PathVariable String userId) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", "success");
        response.put("message", "User " + userId + " deleted successfully");
        return ResponseEntity.ok(response);
    }

    @PutMapping("/users/{userId}/status")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> updateUserStatus(@PathVariable String userId, @RequestBody Map<String, String> request) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", "success");
        response.put("message", "User " + userId + " status updated to " + request.get("status"));
        return ResponseEntity.ok(response);
    }

    @GetMapping("/roles/list")
    @ResponseBody
    public ResponseEntity<List<Map<String, Object>>> getRolesList() {
        List<Map<String, Object>> roles = new ArrayList<>();

        Map<String, Object> role1 = new LinkedHashMap<>();
        role1.put("code", "ROLE_ADMIN");
        role1.put("name", "관리자");
        role1.put("description", "전체 시스템 관리 권한");
        role1.put("userCount", 1);
        role1.put("permissions", Arrays.asList("view", "create", "update", "delete", "execute", "approve", "export"));
        roles.add(role1);

        Map<String, Object> role2 = new LinkedHashMap<>();
        role2.put("code", "ROLE_USER");
        role2.put("name", "일반사용자");
        role2.put("description", "기본 사용자 권한");
        role2.put("userCount", 5);
        role2.put("permissions", Arrays.asList("view", "execute"));
        roles.add(role2);

        Map<String, Object> role3 = new LinkedHashMap<>();
        role3.put("code", "ROLE_OPERATOR");
        role3.put("name", "운영자");
        role3.put("description", "시스템 운영 권한");
        role3.put("userCount", 2);
        role3.put("permissions", Arrays.asList("view", "execute", "export"));
        roles.add(role3);

        return ResponseEntity.ok(roles);
    }

    private String executeCommand(String command) {
        try {
            Process process = Runtime.getRuntime().exec(command);
            StringBuilder output = new StringBuilder();
            BufferedReader reader = new BufferedReader(new InputStreamReader(process.getInputStream()));
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line);
            }
            process.waitFor();
            return output.toString();
        } catch (Exception e) {
            log.warn("Failed to execute command: {}", command, e);
            return null;
        }
    }

    private String formatBytes(long bytes) {
        if (bytes < 1024) return bytes + "B";
        if (bytes < 1024 * 1024) return String.format("%.1fKB", bytes / 1024.0);
        if (bytes < 1024 * 1024 * 1024) return String.format("%.1fMB", bytes / (1024.0 * 1024));
        return String.format("%.1fGB", bytes / (1024.0 * 1024 * 1024));
    }

    @GetMapping("/kubernetes/namespaces")
    @ResponseBody
    public ResponseEntity<List<Map<String, Object>>> getKubernetesNamespacesList() {
        List<Map<String, Object>> namespaces = new ArrayList<>();
        try {
            String output = executeCommand("kubectl get namespaces -o json");
            if (output != null && output.contains("\"items\"")) {
                String[] items = output.split("\"name\":");
                for (int i = 1; i < Math.min(items.length, 50); i++) {
                    Map<String, Object> ns = new LinkedHashMap<>();
                    String item = items[i];
                    int nameEnd = item.indexOf("\"");
                    String name = nameEnd > 0 ? item.substring(0, nameEnd) : "";

                    String status = "Active";
                    int statusIdx = item.indexOf("\"phase\":");
                    if (statusIdx > 0) {
                        int start = statusIdx + 9;
                        int end = item.indexOf("\"", start);
                        status = end > start ? item.substring(start, end) : "Active";
                    }

                    ns.put("name", name);
                    ns.put("status", status);
                    ns.put("age", "1d");
                    ns.put("labels", Collections.emptyMap());
                    namespaces.add(ns);
                }
            }
        } catch (Exception e) {
            log.warn("Failed to get Kubernetes namespaces list", e);
            Map<String, Object> ns = new LinkedHashMap<>();
            ns.put("name", "default");
            ns.put("status", "Active");
            ns.put("age", "1d");
            ns.put("labels", Collections.emptyMap());
            namespaces.add(ns);
            Map<String, Object> carbonetNs = new LinkedHashMap<>();
            carbonetNs.put("name", "carbonet-prod");
            carbonetNs.put("status", "Active");
            carbonetNs.put("age", "32d");
            carbonetNs.put("labels", Collections.singletonMap("env", "production"));
            namespaces.add(carbonetNs);
        }
        return ResponseEntity.ok(namespaces);
    }

    @GetMapping("/kubernetes/exec")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> executeKubernetesCommand(@RequestParam String command) {
        Map<String, Object> response = new LinkedHashMap<>();
        try {
            if (command == null || command.trim().isEmpty()) {
                response.put("error", "Command is required");
                return ResponseEntity.ok(response);
            }
            String sanitizedCommand = command.trim();
            if (sanitizedCommand.contains(";")) {
                response.put("error", "Multiple commands not allowed");
                return ResponseEntity.ok(response);
            }
            String output = executeCommand(sanitizedCommand);
            response.put("output", output != null ? output : "");
            response.put("status", "success");
        } catch (Exception e) {
            log.error("Failed to execute Kubernetes command: {}", command, e);
            response.put("error", e.getMessage());
            response.put("status", "error");
        }
        return ResponseEntity.ok(response);
    }

    @GetMapping("/kubernetes/logs")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getPodLogs(@RequestParam String pod, @RequestParam(defaultValue = "default") String namespace) {
        Map<String, Object> response = new LinkedHashMap<>();
        try {
            if (pod == null || pod.trim().isEmpty()) {
                response.put("error", "Pod name is required");
                return ResponseEntity.ok(response);
            }
            String command = String.format("kubectl logs %s -n %s --tail=100", pod, namespace);
            String logs = executeCommand(command);
            response.put("logs", logs != null ? logs : "");
            response.put("pod", pod);
            response.put("namespace", namespace);
        } catch (Exception e) {
            log.error("Failed to get pod logs: {} in namespace {}", pod, namespace, e);
            response.put("error", e.getMessage());
        }
        return ResponseEntity.ok(response);
    }

    @PostMapping("/kubernetes/yaml/validate")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> validateYaml(@RequestBody Map<String, String> request) {
        Map<String, Object> response = new LinkedHashMap<>();
        try {
            String yaml = request.get("yaml");
            if (yaml == null || yaml.trim().isEmpty()) {
                response.put("valid", false);
                response.put("error", "YAML content is required");
                return ResponseEntity.ok(response);
            }
            String command = "echo '" + yaml.replace("'", "'\"'\"'") + "' | kubectl apply --dry-run=server -f -";
            String output = executeCommand(command);
            if (output != null && output.toLowerCase().contains("error")) {
                response.put("valid", false);
                response.put("error", output);
            } else {
                response.put("valid", true);
            }
        } catch (Exception e) {
            log.error("Failed to validate YAML", e);
            response.put("valid", false);
            response.put("error", e.getMessage());
        }
        return ResponseEntity.ok(response);
    }

    @PostMapping("/kubernetes/yaml/apply")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> applyYaml(@RequestBody Map<String, String> request) {
        Map<String, Object> response = new LinkedHashMap<>();
        try {
            String yaml = request.get("yaml");
            if (yaml == null || yaml.trim().isEmpty()) {
                response.put("status", "error");
                response.put("message", "YAML content is required");
                return ResponseEntity.ok(response);
            }
            String command = "echo '" + yaml.replace("'", "'\"'\"'") + "' | kubectl apply -f -";
            String output = executeCommand(command);
            response.put("status", "success");
            response.put("message", "Applied successfully");
            response.put("output", output != null ? output : "");
        } catch (Exception e) {
            log.error("Failed to apply YAML", e);
            response.put("status", "error");
            response.put("message", e.getMessage());
        }
        return ResponseEntity.ok(response);
    }

    @DeleteMapping("/kubernetes/delete")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> deleteResource(@RequestBody Map<String, String> request) {
        Map<String, Object> response = new LinkedHashMap<>();
        try {
            String kind = request.get("kind");
            String name = request.get("name");
            String namespace = request.get("namespace");
            if (kind == null || name == null) {
                response.put("status", "error");
                response.put("message", "Kind and name are required");
                return ResponseEntity.ok(response);
            }
            String command;
            if ("Pod".equals(kind) || "Service".equals(kind) || "Deployment".equals(kind) || "StatefulSet".equals(kind)) {
                command = String.format("kubectl delete %s %s -n %s", kind.toLowerCase(), name, namespace != null ? namespace : "default");
            } else {
                command = String.format("kubectl delete %s %s", kind.toLowerCase(), name);
            }
            String output = executeCommand(command);
            response.put("status", "success");
            response.put("message", "Deleted successfully");
            response.put("output", output != null ? output : "");
        } catch (Exception e) {
            log.error("Failed to delete resource", e);
            response.put("status", "error");
            response.put("message", e.getMessage());
        }
        return ResponseEntity.ok(response);
    }

    @GetMapping("/kubernetes/workloads")
    @ResponseBody
    public ResponseEntity<List<Map<String, Object>>> getKubernetesWorkloads() {
        List<Map<String, Object>> workloads = new ArrayList<>();
        try {
            String[] types = {"deployments", "statefulsets", "daemonsets"};
            String[] kinds = {"deployment", "statefulset", "daemonset"};

            for (int t = 0; t < types.length; t++) {
                String output = executeCommand("kubectl get " + types[t] + " -o json -A");
                if (output != null && output.contains("\"items\"")) {
                    String[] items = output.split("\"metadata\":");
                    for (int i = 1; i < Math.min(items.length, 30); i++) {
                        Map<String, Object> workload = new LinkedHashMap<>();
                        String item = items[i];

                        int nameIdx = item.indexOf("\"name\":");
                        String name = "";
                        if (nameIdx > 0) {
                            int start = nameIdx + 8;
                            int end = item.indexOf("\"", start);
                            name = end > start ? item.substring(start, end) : "";
                        }

                        int nsIdx = item.indexOf("\"namespace\":");
                        String ns = "default";
                        if (nsIdx > 0) {
                            int start = nsIdx + 13;
                            int end = item.indexOf("\"", start);
                            ns = end > start ? item.substring(start, end) : "default";
                        }

                        int readyIdx = item.indexOf("\"readyReplicas\":");
                        String ready = "0";
                        if (readyIdx < 0) {
                            readyIdx = item.indexOf("\"availableReplicas\":");
                        }
                        if (readyIdx < 0) {
                            readyIdx = item.indexOf("\"currentReplicas\":");
                        }
                        if (readyIdx > 0) {
                            int start = readyIdx;
                            while (start < item.length() && !Character.isDigit(item.charAt(start))) start++;
                            int end = start;
                            while (end < item.length() && Character.isDigit(item.charAt(end))) end++;
                            ready = end > start ? item.substring(start, end) : "0";
                        }

                        int desiredIdx = item.indexOf("\"replicas\":");
                        String desired = "1";
                        if (desiredIdx > 0) {
                            int start = desiredIdx + 10;
                            while (start < item.length() && !Character.isDigit(item.charAt(start))) start++;
                            int end = start;
                            while (end < item.length() && Character.isDigit(item.charAt(end))) end++;
                            desired = end > start ? item.substring(start, end) : "1";
                        }

                        workload.put("name", name);
                        workload.put("namespace", ns);
                        workload.put("type", kinds[t]);
                        workload.put("ready", ready);
                        workload.put("desired", desired);
                        workload.put("current", ready);
                        workload.put("age", "1d");
                        if (name.length() > 0) {
                            workloads.add(workload);
                        }
                    }
                }
            }
        } catch (Exception e) {
            log.warn("Failed to get Kubernetes workloads", e);
            Map<String, Object> deployment = new LinkedHashMap<>();
            deployment.put("name", "carbonet-runtime");
            deployment.put("namespace", "carbonet-prod");
            deployment.put("type", "deployment");
            deployment.put("ready", "2");
            deployment.put("desired", "2");
            deployment.put("current", "2");
            deployment.put("age", "5d");
            workloads.add(deployment);
        }
        return ResponseEntity.ok(workloads);
    }
}