package egovframework.com.feature.monitoring.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.FileReader;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Paths;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class MonitoringService {

    private static final String POD_NAME = "postgres-patroni-0";
    private static final String NAMESPACE = "carbonet-prod";

    public Map<String, Object> getSystemMetrics() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("timestamp", new Date());

        try {
            result.put("hostname", getHostnameInfo());
            result.put("cpu", getCpuMetrics());
            result.put("memory", getMemoryMetrics());
            result.put("disks", getDiskMetrics());
            result.put("disk_io", getDiskIoMetrics());
            result.put("network", getNetworkMetrics());
            result.put("load", getLoadMetrics());
            result.put("top_cpu_processes", getTopCpuProcesses());
            result.put("top_mem_processes", getTopMemProcesses());
            result.put("gpu", getGpuMetrics());
            result.put("services", getServiceStatus());
            result.put("tcp_udp", getTcpUdpStats());
            result.put("success", true);
        } catch (Exception e) {
            log.error("Failed to get system metrics", e);
            result.put("success", false);
            result.put("error", e.getMessage());
        }

        return result;
    }

    public Map<String, Object> getDatabaseMetrics() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("timestamp", new Date());

        try {
            String output = executeKubectl("exec " + POD_NAME + " -n " + NAMESPACE + " -- bash -c \"patronictl list\" 2>&1");

            result.put("serverStatus", output.contains("Running") ? "running" : "stopped");
            result.put("serverOutput", output);

            String stats = executeKubectl("exec " + POD_NAME + " -n " + NAMESPACE + " -- bash -c \"psql -U postgres -d carbonet -c 'SELECT COUNT(*) AS class_count FROM pg_class WHERE relkind=\\'r\\' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = \\'public\\'' -c 'SELECT COUNT(*) FROM emission_material_translation'\" 2>&1");

            result.put("stats", stats);
            result.put("success", true);
        } catch (Exception e) {
            log.error("Failed to get database metrics", e);
            result.put("success", false);
            result.put("error", e.getMessage());
        }

        return result;
    }

    public Map<String, Object> getKubernetesMetrics() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("timestamp", new Date());

        try {
            String nodes = executeKubectl("get nodes -o wide");
            String pods = executeKubectl("get pods -n " + NAMESPACE + " -o wide");
            String services = executeKubectl("get svc -n " + NAMESPACE);

            result.put("nodes", nodes);
            result.put("pods", pods);
            result.put("services", services);
            result.put("success", true);
        } catch (Exception e) {
            log.error("Failed to get Kubernetes metrics", e);
            result.put("success", false);
            result.put("error", e.getMessage());
        }

        return result;
    }

    public Map<String, Object> getOverview() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("timestamp", new Date());

        try {
            Map<String, Object> system = getSystemMetrics();
            Map<String, Object> database = getDatabaseMetrics();

            result.put("system", system);
            result.put("database", database);
            result.put("overall", determineOverallHealth(system, database));
            result.put("success", true);
        } catch (Exception e) {
            log.error("Failed to get overview", e);
            result.put("success", false);
            result.put("error", e.getMessage());
        }

        return result;
    }

    public Map<String, Object> getAlerts() {
        Map<String, Object> result = new LinkedHashMap<>();
        List<Map<String, String>> alerts = new ArrayList<>();

        try {
            Map<String, Object> system = getSystemMetrics();

            if (system.containsKey("memory")) {
                @SuppressWarnings("unchecked")
                Map<String, Object> memory = (Map<String, Object>) system.get("memory");
                if (memory != null) {
                    double usage = parseDouble(memory.getOrDefault("usage_percent", "0"));
                    if (usage > 90) {
                        alerts.add(createAlert("critical", "High Memory Usage", String.format("Memory usage is at %.1f%%", usage)));
                    } else if (usage > 75) {
                        alerts.add(createAlert("warning", "Memory Usage High", String.format("Memory usage is at %.1f%%", usage)));
                    }
                }
            }

            if (system.containsKey("disks")) {
                @SuppressWarnings("unchecked")
                List<Map<String, Object>> disks = (List<Map<String, Object>>) system.get("disks");
                if (disks != null) {
                    for (Map<String, Object> disk : disks) {
                        int usage = parseInt(disk.getOrDefault("usage_percent", "0"));
                        if (usage > 95) {
                            alerts.add(createAlert("critical", "Disk Almost Full",
                                String.format("Disk %s is at %d%%", disk.getOrDefault("mounted", "unknown"), usage)));
                        } else if (usage > 85) {
                            alerts.add(createAlert("warning", "High Disk Usage",
                                String.format("Disk %s is at %d%%", disk.getOrDefault("mounted", "unknown"), usage)));
                        }
                    }
                }
            }

            if (system.containsKey("load")) {
                @SuppressWarnings("unchecked")
                Map<String, Object> load = (Map<String, Object>) system.get("load");
                if (load != null) {
                    double load1m = parseDouble(load.getOrDefault("load_1m", "0"));
                    int cores = 32;
                    if (load1m > cores * 2) {
                        alerts.add(createAlert("critical", "High System Load",
                            String.format("Load average is %.2f (very high)", load1m)));
                    } else if (load1m > cores) {
                        alerts.add(createAlert("warning", "Elevated System Load",
                            String.format("Load average is %.2f", load1m)));
                    }
                }
            }

            if (system.containsKey("services")) {
                @SuppressWarnings("unchecked")
                Map<String, Object> services = (Map<String, Object>) system.get("services");
                if (services != null) {
                    for (Map.Entry<String, Object> entry : services.entrySet()) {
                        @SuppressWarnings("unchecked")
                        Map<String, String> serviceInfo = (Map<String, String>) entry.getValue();
                        String status = serviceInfo.getOrDefault("status", "unknown");
                        if ("inactive".equals(status) || "failed".equals(status)) {
                            alerts.add(createAlert("critical", "Service Down",
                                String.format("Service %s is %s", entry.getKey(), status)));
                        }
                    }
                }
            }

            result.put("alerts", alerts);
            result.put("count", alerts.size());
            result.put("success", true);
        } catch (Exception e) {
            log.error("Failed to get alerts", e);
            result.put("success", false);
            result.put("error", e.getMessage());
        }

        return result;
    }

    public Map<String, Object> getHealthStatus() {
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("timestamp", new Date());

        try {
            Map<String, Object> overview = getOverview();

            @SuppressWarnings("unchecked")
            Map<String, Object> overall = (Map<String, Object>) overview.getOrDefault("overall", Map.of());

            result.put("status", overall.getOrDefault("status", "unknown"));
            result.put("checks", overall);
            result.put("success", true);
        } catch (Exception e) {
            log.error("Failed to get health status", e);
            result.put("status", "error");
            result.put("success", false);
            result.put("error", e.getMessage());
        }

        return result;
    }

    private Map<String, Object> getHostnameInfo() {
        Map<String, Object> info = new LinkedHashMap<>();
        try {
            String hostname = executeCommand("hostname");
            String kernel = executeCommand("uname -r");
            String os = executeCommand("cat /etc/os-release 2>/dev/null | grep PRETTY_NAME | cut -d'\"' -f2 || echo Linux");
            String uptime = executeCommand("awk '{print int($1/86400), int(($1%86400)/3600), int(($1%3600)/60)}' /proc/uptime");

            info.put("name", hostname.trim());
            info.put("kernel", kernel.trim());
            info.put("os", os.trim());

            if (uptime.contains(" ")) {
                String[] parts = uptime.trim().split("\\s+");
                if (parts.length >= 3) {
                    info.put("uptime_days", Integer.parseInt(parts[0]));
                    info.put("uptime_hours", Integer.parseInt(parts[1]));
                    info.put("uptime_mins", Integer.parseInt(parts[2]));
                }
            }
        } catch (Exception e) {
            info.put("error", e.getMessage());
        }
        return info;
    }

    private Map<String, Object> getCpuMetrics() {
        Map<String, Object> metrics = new LinkedHashMap<>();
        try {
            String output = executeCommand("cat /proc/stat | head -1").trim();
            String[] fields = output.split("\\s+");

            if (fields.length >= 8) {
                long user = Long.parseLong(fields[1]);
                long nice = Long.parseLong(fields[2]);
                long system = Long.parseLong(fields[3]);
                long idle = Long.parseLong(fields[4]);
                long iowait = Long.parseLong(fields[5]);
                long irq = Long.parseLong(fields[6]);
                long softirq = Long.parseLong(fields[7]);

                long total = user + nice + system + idle + iowait + irq + softirq;
                long active = user + nice + system;
                double usage = total > 0 ? (active * 100.0) / total : 0;
                double idlePercent = total > 0 ? (idle * 100.0) / total : 100;

                String model = executeCommand("grep 'model name' /proc/cpuinfo | head -1 | cut -d: -f2 | sed 's/^ *//'").trim();
                int cores = Runtime.getRuntime().availableProcessors();

                metrics.put("model", model);
                metrics.put("cores", cores);
                metrics.put("usage_percent", Math.round(usage * 10.0) / 10.0);
                metrics.put("idle_percent", Math.round(idlePercent * 10.0) / 10.0);
                metrics.put("user_percent", Math.round((user * 100.0 / total) * 10.0) / 10.0);
                metrics.put("system_percent", Math.round((system * 100.0 / total) * 10.0) / 10.0);
                metrics.put("iowait_percent", Math.round((iowait * 100.0 / total) * 10.0) / 10.0);
            }
        } catch (Exception e) {
            metrics.put("error", e.getMessage());
        }
        return metrics;
    }

    private Map<String, Object> getMemoryMetrics() {
        Map<String, Object> metrics = new LinkedHashMap<>();
        try {
            String output = executeCommand("free -b | awk '/^Mem:/{print $2,$3,$4,$7}'");
            String[] parts = output.trim().split("\\s+");

            if (parts.length >= 4) {
                long total = Long.parseLong(parts[0]);
                long used = Long.parseLong(parts[1]);
                long free = Long.parseLong(parts[2]);
                long available = Long.parseLong(parts[3]);
                double usage = (used * 100.0) / total;

                metrics.put("total_bytes", total);
                metrics.put("used_bytes", used);
                metrics.put("free_bytes", free);
                metrics.put("available_bytes", available);
                metrics.put("usage_percent", Math.round(usage * 10.0) / 10.0);
            }

            String swapOutput = executeCommand("free -b | awk '/^Swap:/{print $2,$3}'");
            String[] swapParts = swapOutput.trim().split("\\s+");
            if (swapParts.length >= 2) {
                long swapTotal = Long.parseLong(swapParts[0]);
                long swapUsed = Long.parseLong(swapParts[1]);
                metrics.put("swap_total_bytes", swapTotal);
                metrics.put("swap_used_bytes", swapUsed);
                if (swapTotal > 0) {
                    metrics.put("swap_usage_percent", Math.round((swapUsed * 100.0 / swapTotal) * 10.0) / 10.0);
                }
            }
        } catch (Exception e) {
            metrics.put("error", e.getMessage());
        }
        return metrics;
    }

    private List<Map<String, Object>> getDiskMetrics() {
        List<Map<String, Object>> disks = new ArrayList<>();
        try {
            String output = executeCommand("df -B1 2>/dev/null | tail -n +2");
            String[] lines = output.split("\n");

            for (String line : lines) {
                if (line.trim().isEmpty()) continue;
                String[] parts = line.split("\\s+");
                if (parts.length >= 6) {
                    String filesystem = parts[0];
                    if (filesystem.contains("tmpfs") || filesystem.contains("devtmpfs") || filesystem.contains("overlay")) continue;

                    Map<String, Object> disk = new LinkedHashMap<>();
                    disk.put("filesystem", filesystem);
                    disk.put("total", formatBytes(Long.parseLong(parts[1])));
                    disk.put("used", formatBytes(Long.parseLong(parts[2])));
                    disk.put("available", formatBytes(Long.parseLong(parts[3])));
                    disk.put("usage_percent", Integer.parseInt(parts[4].replace("%", "")));
                    disk.put("mounted", parts[5]);
                    disks.add(disk);
                }
            }
        } catch (Exception e) {
            log.error("Failed to get disk metrics", e);
        }
        return disks;
    }

    private Map<String, Object> getDiskIoMetrics() {
        Map<String, Object> metrics = new LinkedHashMap<>();
        try {
            String output = executeCommand("cat /proc/diskstats 2>/dev/null | grep -E 'nvme|sd|vd' | head -1");
            String[] parts = output.trim().split("\\s+");

            if (parts.length >= 14) {
                long readsCompleted = Long.parseLong(parts[3]);
                long sectorsRead = Long.parseLong(parts[5]);
                long writesCompleted = Long.parseLong(parts[7]);
                long sectorsWritten = Long.parseLong(parts[9]);
                long ioInProgress = Long.parseLong(parts[10]);
                long ioMs = Long.parseLong(parts[12]);

                metrics.put("tps", Math.round((readsCompleted + writesCompleted) * 10.0) / 10.0);
                metrics.put("read_kb_s", Math.round((sectorsRead * 512.0 / 1024) * 10.0) / 10.0);
                metrics.put("write_kb_s", Math.round((sectorsWritten * 512.0 / 1024) * 10.0) / 10.0);
                metrics.put("await_ms", ioInProgress > 0 ? Math.round((ioMs * 1000.0 / (readsCompleted + writesCompleted)) * 10.0) / 10.0 : 0);
                metrics.put("util_percent", Math.min(100, Math.round((ioMs / 1000.0) * 10.0) / 10.0));
            }
        } catch (Exception e) {
            metrics.put("tps", 0);
            metrics.put("read_kb_s", 0);
            metrics.put("write_kb_s", 0);
            metrics.put("await_ms", 0);
            metrics.put("util_percent", 0);
        }
        return metrics;
    }

    private List<Map<String, Object>> getNetworkMetrics() {
        List<Map<String, Object>> interfaces = new ArrayList<>();
        try {
            String[] ifaces = executeCommand("ls /sys/class/net/ 2>/dev/null | grep -v lo").trim().split("\n");

            for (String iface : ifaces) {
                if (iface.trim().isEmpty()) continue;

                Map<String, Object> net = new LinkedHashMap<>();
                net.put("name", iface.trim());

                try {
                    String rxBytes = executeCommand("cat /sys/class/net/" + iface.trim() + "/statistics/rx_bytes 2>/dev/null || echo 0").trim();
                    String txBytes = executeCommand("cat /sys/class/net/" + iface.trim() + "/statistics/tx_bytes 2>/dev/null || echo 0").trim();
                    String speed = executeCommand("cat /sys/class/net/" + iface.trim() + "/speed 2>/dev/null || echo 0").trim();
                    String status = executeCommand("cat /sys/class/net/" + iface.trim() + "/operstate 2>/dev/null || echo unknown").trim();

                    net.put("rx_bytes", Long.parseLong(rxBytes));
                    net.put("tx_bytes", Long.parseLong(txBytes));
                    net.put("rx_human", formatBytes(Long.parseLong(rxBytes)));
                    net.put("tx_human", formatBytes(Long.parseLong(txBytes)));
                    net.put("speed_mbps", Integer.parseInt(speed));
                    net.put("status", status);
                } catch (Exception ex) {
                    // Skip interface with errors
                }

                interfaces.add(net);
            }
        } catch (Exception e) {
            log.error("Failed to get network metrics", e);
        }
        return interfaces;
    }

    private Map<String, Object> getLoadMetrics() {
        Map<String, Object> metrics = new LinkedHashMap<>();
        try {
            String output = executeCommand("cat /proc/loadavg");
            String[] parts = output.trim().split("\\s+");

            if (parts.length >= 4) {
                metrics.put("load_1m", parseDouble(parts[0]));
                metrics.put("load_5m", parseDouble(parts[1]));
                metrics.put("load_15m", parseDouble(parts[2]));
                metrics.put("running_processes", parts[3]);
            }

            String threads = executeCommand("ps aux --no-headers 2>/dev/null | wc -l").trim();
            metrics.put("total_threads", Integer.parseInt(threads));
        } catch (Exception e) {
            metrics.put("error", e.getMessage());
        }
        return metrics;
    }

    private static final String HOST_METRICS_FILE = "/opt/Resonance/data/monitoring/host_metrics.json";
    private static final String HOST_SERVICES_FILE = "/opt/Resonance/data/monitoring/host_services";

    private Map<String, Object> readHostMetricsJson() {
        Map<String, Object> result = new LinkedHashMap<>();
        try {
            if (Files.exists(Paths.get(HOST_METRICS_FILE))) {
                String content = new String(Files.readAllBytes(Paths.get(HOST_METRICS_FILE)));
                com.fasterxml.jackson.databind.ObjectMapper mapper = new com.fasterxml.jackson.databind.ObjectMapper();
                result = mapper.readValue(content, Map.class);
            }
        } catch (Exception e) {
            log.warn("Failed to read host metrics: {}", e.getMessage());
        }
        return result;
    }

    private List<Map<String, Object>> readHostServices() {
        List<Map<String, Object>> services = new ArrayList<>();
        try {
            if (Files.exists(Paths.get(HOST_SERVICES_FILE))) {
                List<String> lines = Files.readAllLines(Paths.get(HOST_SERVICES_FILE));
                for (String line : lines) {
                    line = line.trim();
                    if (line.isEmpty()) continue;
                    String svcName = line.replaceAll("^\"|\"$", "");
                    Map<String, String> svcInfo = new LinkedHashMap<>();
                    svcInfo.put("status", "active");
                    svcInfo.put("enabled", "unknown");
                    services.add(Map.of(svcName, svcInfo));
                }
            }
        } catch (Exception e) {
            log.warn("Failed to read host services: {}", e.getMessage());
        }
        return services;
    }

    private List<Map<String, Object>> getTopCpuProcesses() {
        List<Map<String, Object>> processes = new ArrayList<>();
        try {
            Map<String, Object> hostMetrics = readHostMetricsJson();
            if (hostMetrics.containsKey("top_cpu_processes")) {
                return (List<Map<String, Object>>) hostMetrics.get("top_cpu_processes");
            }
            String output = executeCommand(
                "ps -eo pid,user,pcpu,pmem,rss,vsz,cmd --no-headers --sort=-pcpu 2>/dev/null | head -10");
            String[] lines = output.split("\n");

            for (String line : lines) {
                if (line.trim().isEmpty()) continue;
                String[] parts = line.trim().split("\\s+", 7);
                if (parts.length >= 6) {
                    try {
                        Map<String, Object> proc = new LinkedHashMap<>();
                        proc.put("pid", Integer.parseInt(parts[0].trim()));
                        proc.put("user", parts[1].trim());
                        proc.put("cpu", Math.round(parseDouble(parts[2]) * 10.0) / 10.0);
                        proc.put("mem", Math.round(parseDouble(parts[3]) * 10.0) / 10.0);
                        long rssKb = Long.parseLong(parts[4]);
                        proc.put("rss_kb", rssKb);
                        proc.put("rss_human", formatBytes(rssKb * 1024));
                        proc.put("vsz_kb", Long.parseLong(parts[5]));
                        proc.put("cmd", parts[6].trim());
                        proc.put("type", categorizeProcess(parts[6].trim()));
                        processes.add(proc);
                    } catch (NumberFormatException ignored) {}
                }
            }
        } catch (Exception e) {
            log.error("Failed to get top CPU processes", e);
        }
        return processes;
    }

    private List<Map<String, Object>> getTopMemProcesses() {
        List<Map<String, Object>> processes = new ArrayList<>();
        try {
            Map<String, Object> hostMetrics = readHostMetricsJson();
            if (hostMetrics.containsKey("top_mem_processes")) {
                return (List<Map<String, Object>>) hostMetrics.get("top_mem_processes");
            }
            String output = executeCommand(
                "ps -eo pid,user,pcpu,pmem,rss,vsz,cmd --no-headers --sort=-pmem 2>/dev/null | head -10");
            String[] lines = output.split("\n");

            for (String line : lines) {
                if (line.trim().isEmpty()) continue;
                String[] parts = line.trim().split("\\s+", 7);
                if (parts.length >= 6) {
                    try {
                        Map<String, Object> proc = new LinkedHashMap<>();
                        proc.put("pid", Integer.parseInt(parts[0].trim()));
                        proc.put("user", parts[1].trim());
                        proc.put("cpu", Math.round(parseDouble(parts[2]) * 10.0) / 10.0);
                        proc.put("mem", Math.round(parseDouble(parts[3]) * 10.0) / 10.0);
                        long rssKb = Long.parseLong(parts[4]);
                        proc.put("rss_kb", rssKb);
                        proc.put("rss_human", formatBytes(rssKb * 1024));
                        proc.put("vsz_kb", Long.parseLong(parts[5]));
                        proc.put("cmd", parts[6].trim());
                        proc.put("type", categorizeProcess(parts[6].trim()));
                        processes.add(proc);
                    } catch (NumberFormatException ignored) {}
                }
            }
        } catch (Exception e) {
            log.error("Failed to get top memory processes", e);
        }
        return processes;
    }

    private String categorizeProcess(String cmd) {
        if (cmd == null || cmd.isEmpty()) return "other";
        cmd = cmd.toLowerCase();
        if (cmd.contains("java") || cmd.contains("jar") || cmd.contains("spring")) return "java";
        if (cmd.contains("python") || cmd.contains("pypy")) return "python";
        if (cmd.contains("node") || cmd.contains("npm")) return "nodejs";
        if (cmd.contains("nginx") || cmd.contains("apache") || cmd.contains("httpd")) return "webserver";
        if (cmd.contains("mysqld") || cmd.contains("mariadb") || cmd.contains("postgres") || cmd.contains("cubrid")) return "database";
        if (cmd.contains("docker") || cmd.contains("containerd") || cmd.contains("kubelet")) return "container";
        if (cmd.contains("bash") || cmd.contains("sh -c")) return "shell";
        if (cmd.contains("curl") || cmd.contains("wget")) return "network";
        if (cmd.contains("redis") || cmd.contains("memcached")) return "cache";
        if (cmd.contains("nvidia") || cmd.contains("cuda")) return "gpu";
        if (cmd.contains("postgres") || cmd.contains("pg")) return "database";
        return "other";
    }

    private Map<String, Object> getGpuMetrics() {
        Map<String, Object> gpu = new LinkedHashMap<>();
        try {
            Map<String, Object> hostMetrics = readHostMetricsJson();
            if (hostMetrics.containsKey("gpu")) {
                return (Map<String, Object>) hostMetrics.get("gpu");
            }
            String output = executeCommand(
                "nvidia-smi --query-gpu=index,name,utilization.gpu,utilization.memory,memory.used,memory.total,memory.free,temperature.gpu,fan.speed,power.draw,power.limit,clocks.current.sm,clocks.current.memory --format=csv,noheader,nounits 2>/dev/null"
            );

            List<Map<String, Object>> gpus = new ArrayList<>();
            String[] lines = output.split("\n");

            for (String line : lines) {
                if (line.trim().isEmpty()) continue;
                String[] parts = line.split(",\\s*");
                if (parts.length >= 11) {
                    Map<String, Object> g = new LinkedHashMap<>();
                    try {
                        g.put("index", Integer.parseInt(parts[0].trim()));
                        g.put("name", parts[1].trim());
                        g.put("utilization_percent", parseDouble(parts[2]));
                        g.put("memory_utilization_percent", parseDouble(parts[3]));
                        g.put("memory_used_mb", parseDouble(parts[4]));
                        g.put("memory_total_mb", parseDouble(parts[5]));
                        g.put("memory_free_mb", parseDouble(parts[6]));
                        g.put("temperature_c", parseInt(parts[7]));
                        g.put("fan_speed_percent", parseDouble(parts[8]));
                        g.put("power_draw_w", Math.round(parseDouble(parts[9]) * 10.0) / 10.0);
                        g.put("power_limit_w", parseDouble(parts[10]));
                        g.put("clock_sm_mhz", parseInt(parts[11]));
                        g.put("clock_memory_mhz", parseInt(parts[12]));
                        g.put("memory_used_percent", Math.round((parseDouble(parts[4]) / parseDouble(parts[5])) * 100 * 10.0) / 10.0);
                        gpus.add(g);
                    } catch (NumberFormatException ignored) {}
                }
            }

            gpu.put("devices", gpus);
            gpu.put("count", gpus.size());
            gpu.put("available", gpus.size() > 0);

            if (!gpus.isEmpty()) {
                double avgUtil = gpus.stream().mapToDouble(g -> (Double) g.get("utilization_percent")).average().orElse(0);
                double avgMem = gpus.stream().mapToDouble(g -> (Double) g.get("memory_used_percent")).average().orElse(0);
                gpu.put("average_utilization_percent", Math.round(avgUtil * 10.0) / 10.0);
                gpu.put("average_memory_utilization_percent", Math.round(avgMem * 10.0) / 10.0);
            }

        } catch (Exception e) {
            gpu.put("available", false);
            gpu.put("error", e.getMessage());
        }
        return gpu;
    }

    private Map<String, Object> getServiceStatus() {
        Map<String, Object> services = new LinkedHashMap<>();
        try {
            List<Map<String, Object>> hostServices = readHostServices();
            if (!hostServices.isEmpty()) {
                for (Map<String, Object> svc : hostServices) {
                    for (Map.Entry<String, Object> entry : svc.entrySet()) {
                        services.put(entry.getKey(), entry.getValue());
                    }
                }
                return services;
            }
        } catch (Exception e) {
            log.warn("Failed to read host services, using defaults: {}", e.getMessage());
        }
        String[] serviceNames = {"java", "python", "node", "nginx", "postgres", "mysqld", "redis"};
        for (String service : serviceNames) {
            try {
                String pgrep = executeCommand("pgrep -c '" + service + "' 2>/dev/null || echo 0").trim();
                int count = parseInt(pgrep);
                String status = count > 0 ? "active" : "inactive";

                Map<String, String> serviceInfo = new LinkedHashMap<>();
                serviceInfo.put("status", status);
                serviceInfo.put("enabled", "unknown");
                serviceInfo.put("count", String.valueOf(count));
                services.put(service, serviceInfo);
            } catch (Exception e) {
                services.put(service, Map.of("status", "unknown", "enabled", "unknown", "count", "0"));
            }
        }
        return services;
    }

    private Map<String, Object> getTcpUdpStats() {
        Map<String, Object> stats = new LinkedHashMap<>();
        try {
            String tcpResult = executeCommand("cat /proc/net/tcp /proc/net/tcp6 2>/dev/null | awk 'NF>=4 && $4 ~ /^[0-9A-Fa-f]{2}$/ {print $4}'");
            String udpResult = executeCommand("cat /proc/net/udp /proc/net/udp6 2>/dev/null | awk 'NF>=4 && $4 ~ /^[0-9A-Fa-f]{2}$/ {print $4}'");

            int established = 0, timewait = 0, listen = 0, closeWait = 0, udp = 0;

            if (tcpResult != null && !tcpResult.isEmpty()) {
                for (String state : tcpResult.split("\n")) {
                    state = state.trim().toUpperCase();
                    if (state.isEmpty()) continue;
                    if (state.equals("01")) established++;
                    else if (state.equals("06")) timewait++;
                    else if (state.equals("0A")) listen++;
                    else if (state.equals("07") || state.equals("08")) closeWait++;
                }
            }

            if (udpResult != null && !udpResult.isEmpty()) {
                int udpCount = 0;
                for (String state : udpResult.split("\n")) {
                    if (!state.trim().isEmpty()) udpCount++;
                }
                udp = Math.max(0, udpCount);
            }

            stats.put("tcp_established", established);
            stats.put("tcp_timewait", timewait);
            stats.put("tcp_listen", listen);
            stats.put("tcp_closewait", closeWait);
            stats.put("udp_sockets", udp);
            stats.put("tcp_total", established + timewait + listen + closeWait);
        } catch (Exception e) {
            stats.put("error", e.getMessage());
        }
        return stats;
    }

    private Map<String, Object> determineOverallHealth(Map<String, Object> system, Map<String, Object> database) {
        Map<String, Object> health = new LinkedHashMap<>();
        health.put("system", "healthy");
        health.put("database", "healthy");

        if (system.containsKey("memory")) {
            @SuppressWarnings("unchecked")
            Map<String, Object> memory = (Map<String, Object>) system.get("memory");
            if (memory != null) {
                double usage = parseDouble(String.valueOf(memory.getOrDefault("usage_percent", "0")));
                if (usage > 90) health.put("system", "critical");
                else if (usage > 75) health.put("system", "warning");
            }
        }

        boolean dbSuccess = Boolean.parseBoolean(String.valueOf(database.getOrDefault("success", false)));
        if (!dbSuccess) health.put("database", "critical");

        String overall = "healthy";
        if ("critical".equals(health.get("system")) || "critical".equals(health.get("database"))) {
            overall = "critical";
        } else if ("warning".equals(health.get("system")) || "warning".equals(health.get("database"))) {
            overall = "warning";
        }

        health.put("status", overall);
        return health;
    }

    private Map<String, String> createAlert(String level, String title, String message) {
        Map<String, String> alert = new LinkedHashMap<>();
        alert.put("level", level);
        alert.put("title", title);
        alert.put("message", message);
        return alert;
    }

    private String formatBytes(long bytes) {
        if (bytes >= 1099511627776L) {
            return String.format("%.1fTB", bytes / 1099511627776.0);
        } else if (bytes >= 1073741824L) {
            return String.format("%.1fGB", bytes / 1073741824.0);
        } else if (bytes >= 1048576L) {
            return String.format("%.1fMB", bytes / 1048576.0);
        } else if (bytes >= 1024L) {
            return String.format("%.1fKB", bytes / 1024.0);
        } else {
            return bytes + "B";
        }
    }

    private String join(String[] arr, String sep) {
        return String.join(sep, arr);
    }

    private double parseDouble(Object value) {
        try {
            return Double.parseDouble(String.valueOf(value));
        } catch (Exception e) {
            return 0.0;
        }
    }

    private int parseInt(Object value) {
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (Exception e) {
            return 0;
        }
    }

    private String executeCommand(String command) {
        try {
            ProcessBuilder pb = new ProcessBuilder("/bin/bash", "-c", command);
            pb.redirectErrorStream(true);
            Process p = pb.start();
            StringBuilder output = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(p.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    if (output.length() > 0) output.append("\n");
                    output.append(line);
                }
            }
            return output.toString();
        } catch (Exception e) {
            return "";
        }
    }

    private String executeKubectl(String args) {
        return executeCommand("kubectl " + args);
    }
}