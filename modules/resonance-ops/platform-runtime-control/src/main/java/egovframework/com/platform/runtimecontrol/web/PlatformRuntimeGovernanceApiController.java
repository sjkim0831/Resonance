package egovframework.com.platform.runtimecontrol.web;

import egovframework.com.platform.executiongate.GateActorScope;
import egovframework.com.platform.executiongate.support.OperationsConsoleGateSupport;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import java.nio.file.Files;
import java.nio.file.Paths;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import jakarta.servlet.http.HttpServletRequest;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * REST Controller for Platform Package Governance and Runtime Management.
 * Accessed by the Operations Console.
 */
@RestController
@RequestMapping("/api/operations/governance/runtime")
@RequiredArgsConstructor
public class PlatformRuntimeGovernanceApiController {

    private String MANIFEST_PATH = "data/version-control/project-runtime-manifest.json";

    private final ObjectMapper objectMapper = new ObjectMapper();
    private final OperationsConsoleGateSupport operationsConsoleGateSupport;

    @GetMapping("/projects")
    public ResponseEntity<?> listProjects() {
        try {
            byte[] jsonData = Files.readAllBytes(Paths.get(MANIFEST_PATH));
            Map<String, Object> manifest = objectMapper.readValue(jsonData, Map.class);
            return ResponseEntity.ok(manifest.get("projects"));
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("Error reading project manifest: " + e.getMessage());
        }
    }

    @GetMapping("/projects/registry")
    public ResponseEntity<?> listProjectRegistry() {
        try {
            byte[] jsonData = Files.readAllBytes(Paths.get(MANIFEST_PATH));
            Map<String, Object> manifest = objectMapper.readValue(jsonData, Map.class);
            Map<String, Object> projects = (Map<String, Object>) manifest.get("projects");
            Map<String, Object> response = new LinkedHashMap<>();
            if (projects == null) {
                response.put("items", java.util.Collections.emptyList());
                return ResponseEntity.ok(response);
            }

            java.util.List<Map<String, Object>> items = new java.util.ArrayList<>();
            for (Map.Entry<String, Object> entry : projects.entrySet()) {
                String projectId = entry.getKey();
                Map<String, Object> project = entry.getValue() instanceof Map
                        ? (Map<String, Object>) entry.getValue()
                        : java.util.Collections.emptyMap();
                Map<String, Object> metadata = nestedMap(project, "metadata");
                Map<String, Object> runtime = nestedMap(project, "runtime");
                Map<String, Object> governance = nestedMap(project, "governance");
                Map<String, Object> routing = nestedMap(runtime, "routing");

                // Get live status from shell script
                String liveStatus = getLiveStatus(projectId);

                Map<String, Object> item = new LinkedHashMap<>();
                item.put("projectId", value(metadata, "projectId", projectId));
                item.put("projectName", value(metadata, "projectName", ""));
                item.put("owner", value(metadata, "owner", ""));
                item.put("status", liveStatus); // Overwrite with live status
                item.put("runtimeMode", value(runtime, "runtimeMode", ""));
                item.put("sharedRuntimeId", value(runtime, "sharedRuntimeId", ""));
                item.put("compatibilityClass", value(governance, "compatibilityClass", ""));
                item.put("selectorPath", value(routing, "selectorPath", ""));
                item.put("routePrefix", value(routing, "routePrefix", ""));
                item.put("externalBaseUrl", value(routing, "externalBaseUrl", ""));
                item.put("domainHost", value(routing, "domainHost", ""));
                item.put("managementPath", value(routing, "managementPath", "/api/operations/governance/runtime/projects/" + projectId));
                item.put("infoPath", value(routing, "infoPath", "/api/runtime/project-info"));
                item.put("bootTarget", value(runtime, "bootTarget", ""));
                items.add(item);
            }
            response.put("items", items);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("Error reading project registry: " + e.getMessage());
        }
    }

    private String getLiveStatus(String projectId) {
        try {
            // 1. Process Check via Script
            ProcessBuilder pb = new ProcessBuilder("bash", "ops/scripts/manage-project-runtime.sh", "status", projectId);
            Process process = pb.start();
            java.io.BufferedReader reader = new java.io.BufferedReader(new java.io.InputStreamReader(process.getInputStream()));
            String output = reader.readLine();
            process.waitFor();
            
            if (output == null || !output.contains("RUNNING")) {
                return "STOPPED";
            }

            // 2. HTTP Health Check (Port 18000 for project-runtime)
            // TODO: In a production environment, port would be resolved from the manifest
            try {
                java.net.URL url = new java.net.URL("http://localhost:18000/api/runtime/info");
                java.net.HttpURLConnection con = (java.net.HttpURLConnection) url.openConnection();
                con.setRequestMethod("GET");
                con.setConnectTimeout(500);
                con.setReadTimeout(500);
                int responseCode = con.getResponseCode();
                if (responseCode == 200) {
                    return "RUNNING";
                } else {
                    return "STARTING"; // Process is there, but API not ready
                }
            } catch (Exception e) {
                return "UNSTABLE"; // Process is there, but no HTTP response
            }
        } catch (Exception e) {
            return "UNKNOWN";
        }
    }

    @GetMapping("/projects/{projectId}")
    public ResponseEntity<?> getProjectDetail(@PathVariable String projectId) {
        try {
            byte[] jsonData = Files.readAllBytes(Paths.get(MANIFEST_PATH));
            Map<String, Object> manifest = objectMapper.readValue(jsonData, Map.class);
            Map<String, Object> projects = (Map<String, Object>) manifest.get("projects");
            
            if (projects != null && projects.containsKey(projectId)) {
                return ResponseEntity.ok(projects.get(projectId));
            } else {
                return ResponseEntity.notFound().build();
            }
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("Error reading project detail: " + e.getMessage());
        }
    }

    @PostMapping("/projects/{projectId}/save")
    public ResponseEntity<?> saveProject(@PathVariable String projectId, @org.springframework.web.bind.annotation.RequestBody Map<String, Object> projectConfig) {
        try {
            synchronized (this) {
                byte[] jsonData = Files.readAllBytes(Paths.get(MANIFEST_PATH));
                Map<String, Object> manifest = objectMapper.readValue(jsonData, Map.class);
                Map<String, Object> projects = (Map<String, Object>) manifest.get("projects");
                if (projects == null) {
                    projects = new LinkedHashMap<>();
                    manifest.put("projects", projects);
                }
                
                projects.put(projectId, projectConfig);
                
                objectMapper.writerWithDefaultPrettyPrinter().writeValue(new java.io.File(MANIFEST_PATH), manifest);
            }
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("success", true);
            response.put("message", "Project configuration saved.");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("Error saving project configuration: " + e.getMessage());
        }
    }

    @PostMapping("/projects/{projectId}/delete")
    public ResponseEntity<?> deleteProject(@PathVariable String projectId) {
        try {
            synchronized (this) {
                byte[] jsonData = Files.readAllBytes(Paths.get(MANIFEST_PATH));
                Map<String, Object> manifest = objectMapper.readValue(jsonData, Map.class);
                Map<String, Object> projects = (Map<String, Object>) manifest.get("projects");
                
                if (projects != null && projects.containsKey(projectId)) {
                    projects.remove(projectId);
                    objectMapper.writerWithDefaultPrettyPrinter().writeValue(new java.io.File(MANIFEST_PATH), manifest);
                }
            }
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("success", true);
            response.put("message", "Project configuration deleted.");
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("Error deleting project configuration: " + e.getMessage());
        }
    }

    @PostMapping("/projects/{projectId}/apply-routing")
    public ResponseEntity<?> applyRouting(@PathVariable String projectId) {
        try {
            // Find project config to get port
            byte[] jsonData = Files.readAllBytes(Paths.get(MANIFEST_PATH));
            Map<String, Object> manifest = objectMapper.readValue(jsonData, Map.class);
            Map<String, Object> projects = (Map<String, Object>) manifest.get("projects");
            
            if (projects == null || !projects.containsKey(projectId)) {
                return ResponseEntity.notFound().build();
            }
            
            Map<String, Object> project = (Map<String, Object>) projects.get(projectId);
            Map<String, Object> runtime = nestedMap(project, "runtime");
            
            String bootCommand = value(runtime, "bootCommand", "");
            String port = "18000";
            if (bootCommand.contains("--server.port=")) {
                port = bootCommand.substring(bootCommand.indexOf("--server.port=") + 14).split(" ")[0];
            }
            
            ProcessBuilder pb = new ProcessBuilder("bash", "ops/scripts/update-nginx-project-routing.sh", projectId, port, "localhost");
            pb.redirectErrorStream(true);
            Process process = pb.start();
            
            java.io.BufferedReader reader = new java.io.BufferedReader(new java.io.InputStreamReader(process.getInputStream()));
            StringBuilder output = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line).append("\n");
            }
            
            int exitCode = process.waitFor();
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("success", exitCode == 0);
            response.put("command", "apply-routing");
            response.put("projectId", projectId);
            response.put("output", output.toString().trim());
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("Error applying routing: " + e.getMessage());
        }
    }

    @GetMapping("/projects/{projectId}/adapters")
    public ResponseEntity<?> listAdapters(@PathVariable String projectId) {
        try {
            String libDirPath = "var/run/project-runtime/" + projectId + "/lib";
            java.io.File libDir = new java.io.File(libDirPath);
            
            List<Map<String, Object>> adapters = new java.util.ArrayList<>();
            if (libDir.exists() && libDir.isDirectory()) {
                java.io.File[] files = libDir.listFiles((dir, name) -> name.endsWith(".jar"));
                if (files != null) {
                    for (java.io.File file : files) {
                        Map<String, Object> adapter = new LinkedHashMap<>();
                        adapter.put("name", file.getName());
                        adapter.put("size", file.length());
                        adapter.put("lastModified", file.lastModified());
                        adapters.add(adapter);
                    }
                }
            }
            
            return ResponseEntity.ok(adapters);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("Error listing adapters: " + e.getMessage());
        }
    }


    @GetMapping("/projects/{projectId}/upgrades")
    public ResponseEntity<?> getUpgradeCandidates(@PathVariable String projectId, HttpServletRequest request) {
        Map<String, Object> params = new LinkedHashMap<>();
        params.put("projectId", projectId);
        return ResponseEntity.ok(operationsConsoleGateSupport.payload(
                request,
                "governance.upgrades.evaluate",
                projectId,
                "admin",
                GateActorScope.COMMON_ADMIN_OPS,
                params));
    }

    @PostMapping("/projects/{projectId}/start")
    public ResponseEntity<?> startProject(@PathVariable String projectId) {
        return executeCommand("start", projectId);
    }

    @PostMapping("/projects/{projectId}/stop")
    public ResponseEntity<?> stopProject(@PathVariable String projectId) {
        return executeCommand("stop", projectId);
    }

    @PostMapping("/projects/{projectId}/restart")
    public ResponseEntity<?> restartProject(@PathVariable String projectId) {
        return executeCommand("restart", projectId);
    }

    @PostMapping("/projects/{projectId}/check-health")
    public ResponseEntity<?> checkHealth(@PathVariable String projectId) {
        try {
            // 1. Find project config to get info (port, etc)
            byte[] jsonData = Files.readAllBytes(Paths.get(MANIFEST_PATH));
            Map<String, Object> manifest = objectMapper.readValue(jsonData, Map.class);
            Map<String, Object> projects = (Map<String, Object>) manifest.get("projects");
            
            if (projects == null || !projects.containsKey(projectId)) {
                return ResponseEntity.notFound().build();
            }
            
            Map<String, Object> project = (Map<String, Object>) projects.get(projectId);
            Map<String, Object> runtime = nestedMap(project, "runtime");
            
            // For now, we assume projects run on local ports (default 18000, but can be configured in bootCommand or similar)
            // Realistically we should have a 'port' field in runtime config. 
            // We'll try port 18000 as default or parse from bootCommand.
            String bootCommand = value(runtime, "bootCommand", "");
            int port = 18000;
            if (bootCommand.contains("--server.port=")) {
                String portStr = bootCommand.substring(bootCommand.indexOf("--server.port=") + 14).split(" ")[0];
                try { port = Integer.parseInt(portStr); } catch (Exception e) {}
            }
            
            String healthUrl = "http://localhost:" + port + "/api/runtime/project-info";
            boolean isHealthy = false;
            try {
                java.net.HttpURLConnection conn = (java.net.HttpURLConnection) new java.net.URL(healthUrl).openConnection();
                conn.setConnectTimeout(2000);
                conn.setReadTimeout(2000);
                int code = conn.getResponseCode();
                isHealthy = (code == 200);
            } catch (Exception e) {
                isHealthy = false;
            }
            
            // 2. Update lastHealthCheck timestamp
            if (isHealthy) {
                runtime.put("status", "RUNNING");
                runtime.put("lastHealthCheck", java.time.OffsetDateTime.now().toString());
                
                synchronized (this) {
                    objectMapper.writerWithDefaultPrettyPrinter().writeValue(new java.io.File(MANIFEST_PATH), manifest);
                }
            }
            
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("projectId", projectId);
            result.put("healthy", isHealthy);
            result.put("timestamp", java.time.OffsetDateTime.now().toString());
            return ResponseEntity.ok(result);
            
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("Health check failed: " + e.getMessage());
        }
    }

    @GetMapping("/projects/{projectId}/status")
    public ResponseEntity<?> getProjectStatus(@PathVariable String projectId) {
        return executeCommand("status", projectId);
    }

    private ResponseEntity<?> executeCommand(String command, String projectId) {
        try {
            ProcessBuilder pb = new ProcessBuilder("bash", "ops/scripts/manage-project-runtime.sh", command, projectId);
            pb.redirectErrorStream(true);
            Process process = pb.start();
            
            java.io.BufferedReader reader = new java.io.BufferedReader(new java.io.InputStreamReader(process.getInputStream()));
            StringBuilder output = new StringBuilder();
            String line;
            while ((line = reader.readLine()) != null) {
                output.append(line).append("\n");
            }
            
            int exitCode = process.waitFor();
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("success", exitCode == 0);
            response.put("command", command);
            response.put("projectId", projectId);
            response.put("output", output.toString().trim());
            
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().body("Error executing " + command + ": " + e.getMessage());
        }
    }

    private Map<String, Object> nestedMap(Map<String, Object> source, String key) {
        if (source == null) {
            return java.util.Collections.emptyMap();
        }
        Object value = source.get(key);
        if (value instanceof Map) {
            return (Map<String, Object>) value;
        }
        return java.util.Collections.emptyMap();
    }

    private String value(Map<String, Object> source, String key, String defaultValue) {
        if (source == null) {
            return defaultValue;
        }
        Object value = source.get(key);
        return value == null ? defaultValue : String.valueOf(value);
    }
}
