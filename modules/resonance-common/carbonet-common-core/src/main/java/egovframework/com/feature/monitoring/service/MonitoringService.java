package egovframework.com.feature.monitoring.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class MonitoringService {

    private static final String POD_NAME = "cubrid-carbonet-0";
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
            String output = executeKubectl("exec " + POD_NAME + " -n " + NAMESPACE + " -- bash -c \"source /home/cubrid/.cubrid.sh && cubrid server status carbonet\" 2>&1");

            result.put("serverStatus", output.contains("Server") ? "running" : "stopped");
            result.put("serverOutput", output);

            String stats = executeKubectl("exec " + POD_NAME + " -n " + NAMESPACE + " -- bash -c \"source /home/cubrid/.cubrid.sh && csql -C -u dba -p '' -c 'SELECT COUNT(*) FROM db_class; SELECT COUNT(*) FROM emission_material_translation;' carbonet@localhost 2>&1\" 2>&1");

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
            String output = executeCommand("top -bn1 | grep 'Cpu(s)'");
            String[] parts = output.split(",\\s*");

            double user = 0, system = 0, iowait = 0, idle = 100;
            for (String part : parts) {
                if (part.contains("%us")) {
                    user = parseDouble(part.replaceAll("[^0-9.]", ""));
                } else if (part.contains("%sy")) {
                    system = parseDouble(part.replaceAll("[^0-9.]", ""));
                } else if (part.contains("%id")) {
                    idle = parseDouble(part.replaceAll("[^0-9.]", ""));
                }
            }

            String model = executeCommand("grep 'model name' /proc/cpuinfo | head -1 | cut -d: -f2 | sed 's/^ *//'").trim();
            int cores = Runtime.getRuntime().availableProcessors();

            metrics.put("model", model);
            metrics.put("cores", cores);
            metrics.put("usage_percent", Math.round((user + system) * 10.0) / 10.0);
            metrics.put("idle_percent", Math.round(idle * 10.0) / 10.0);
            metrics.put("user_percent", Math.round(user * 10.0) / 10.0);
            metrics.put("system_percent", Math.round(system * 10.0) / 10.0);
            metrics.put("iowait_percent", Math.round(iowait * 10.0) / 10.0);
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

    private List<Map<String, Object>> getTopCpuProcesses() {
        List<Map<String, Object>> processes = new ArrayList<>();
        try {
            String output = executeCommand("ps aux --no-headers 2>/dev/null | sort -k3 -rn | head -10");
            String[] lines = output.split("\n");

            for (String line : lines) {
                if (line.trim().isEmpty()) continue;
                String[] parts = line.split("\\s+");
                if (parts.length >= 11) {
                    Map<String, Object> proc = new LinkedHashMap<>();
                    proc.put("pid", Integer.parseInt(parts[1].trim()));
                    proc.put("user", parts[0]);
                    proc.put("cpu", parseDouble(parts[2]));
                    proc.put("mem", parseDouble(parts[3]));
                    proc.put("cmd", parts.length > 10 ? join(Arrays.copyOfRange(parts, 10, parts.length), " ") : "");
                    processes.add(proc);
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
            String output = executeCommand("ps aux --no-headers 2>/dev/null | sort -k4 -rn | head -10");
            String[] lines = output.split("\n");

            for (String line : lines) {
                if (line.trim().isEmpty()) continue;
                String[] parts = line.split("\\s+");
                if (parts.length >= 11) {
                    Map<String, Object> proc = new LinkedHashMap<>();
                    proc.put("pid", Integer.parseInt(parts[1].trim()));
                    proc.put("user", parts[0]);
                    proc.put("cpu", parseDouble(parts[2]));
                    proc.put("mem", parseDouble(parts[3]));
                    proc.put("cmd", parts.length > 10 ? join(Arrays.copyOfRange(parts, 10, parts.length), " ") : "");
                    processes.add(proc);
                }
            }
        } catch (Exception e) {
            log.error("Failed to get top memory processes", e);
        }
        return processes;
    }

    private Map<String, Object> getServiceStatus() {
        Map<String, Object> services = new LinkedHashMap<>();
        String[] serviceNames = {"kubelet", "containerd", "docker", "java"};
        for (String service : serviceNames) {
            try {
                String pgrep = executeCommand("pgrep -c " + service + " 2>/dev/null || echo 0").trim();
                int count = parseInt(pgrep);
                String status = count > 0 ? "active" : "inactive";

                Map<String, String> serviceInfo = new LinkedHashMap<>();
                serviceInfo.put("status", status);
                serviceInfo.put("enabled", "unknown");
                services.put(service, serviceInfo);
            } catch (Exception e) {
                services.put(service, Map.of("status", "unknown", "enabled", "unknown"));
            }
        }
        return services;
    }

    private Map<String, Object> getTcpUdpStats() {
        Map<String, Object> stats = new LinkedHashMap<>();
        try {
            String tcpEstab = executeCommand("grep ' 01 ' /proc/net/tcp 2>/dev/null | wc -l").trim();
            String tcpTimewait = executeCommand("grep ' 06 ' /proc/net/tcp 2>/dev/null | wc -l").trim();
            String udpSockets = executeCommand("cat /proc/net/udp 2>/dev/null | wc -l").trim();

            stats.put("tcp_established", Integer.parseInt(tcpEstab));
            stats.put("tcp_timewait", Integer.parseInt(tcpTimewait));
            stats.put("udp_sockets", Math.max(0, Integer.parseInt(udpSockets) - 1));
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