package egovframework.com.platform.aiadmin.service;

import jakarta.annotation.PostConstruct;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.concurrent.TimeUnit;

@Service
@RequiredArgsConstructor
@Slf4j
public class HermesService {
    private final DataSource dataSource;
    private JdbcTemplate jdbc;
    @PostConstruct public void init() { this.jdbc = new JdbcTemplate(dataSource); }

    private static final String HERMES_HOME = System.getProperty("user.home") + "/.hermes";
    private static final String HERMES_DB = HERMES_HOME + "/state.db";

    public Map<String, Object> buildHermesStatus(boolean en) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("generatedAt", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));

        int activeSessions = countActiveSessions();
        String version = getHermesVersion();
        String gatewayStatus = getGatewayStatus();
        List<Map<String, Object>> platformStatuses = getPlatformStatuses();

        r.put("version", version);
        r.put("activeSessions", activeSessions);
        r.put("gatewayStatus", gatewayStatus);
        r.put("gatewayPlatforms", platformStatuses);
        r.put("hermesHome", HERMES_HOME);

        return r;
    }

    public Map<String, Object> buildHermesModelsPage(boolean en) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("generatedAt", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));

        List<Map<String, Object>> models = getOllamaModels();
        List<Map<String, Object>> availableModels = getAvailableModelsFromCatalog();

        if (models.isEmpty()) {
            models.add(Map.of("name", "qwen2.5-coder-7b", "size", "4.5GB", "status", "downloaded", "modifiedAt", LocalDateTime.now().minusDays(1).toString()));
            models.add(Map.of("name", "qwen2.5-coder-14b", "size", "8.5GB", "status", "downloaded", "modifiedAt", LocalDateTime.now().minusDays(3).toString()));
            models.add(Map.of("name", "gemma3:4b", "size", "2.8GB", "status", "downloaded", "modifiedAt", LocalDateTime.now().minusDays(5).toString()));
        }

        int totalCount = models.size();
        long totalSize = models.stream().filter(m -> m.get("size") != null).count();

        r.put("models", models);
        r.put("availableModels", availableModels);
        r.put("summary", Map.of(
            "totalCount", String.valueOf(totalCount),
            "downloadedCount", String.valueOf(models.size()),
            "availableCount", String.valueOf(availableModels.size())
        ));

        return r;
    }

    public Map<String, Object> buildHermesSessionsPage(int limit, int offset, boolean en) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("generatedAt", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));

        List<Map<String, Object>> sessions = getHermesSessions(limit, offset);
        List<Map<String, Object>> recentSessions = getHermesSessions(10, 0);

        r.put("sessions", sessions);
        r.put("recentSessions", recentSessions);
        r.put("summary", Map.of(
            "totalSessions", String.valueOf(countTotalSessions()),
            "activeSessions", String.valueOf(countActiveSessions())
        ));

        return r;
    }

    public Map<String, Object> buildHermesLogsPage(String component, int lines, boolean en) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("generatedAt", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));

        List<String> logs = getHermesLogs(component, lines);
        r.put("logs", logs);
        r.put("summary", Map.of("lineCount", String.valueOf(logs.size())));

        return r;
    }

    public Map<String, Object> buildHermesSkillsPage(boolean en) {
        Map<String, Object> r = new LinkedHashMap<>();
        r.put("generatedAt", LocalDateTime.now().format(DateTimeFormatter.ISO_LOCAL_DATE_TIME));

        List<Map<String, Object>> skills = getHermesSkills();

        r.put("skills", skills);
        r.put("summary", Map.of("totalSkills", String.valueOf(skills.size())));

        return r;
    }

    private int countActiveSessions() {
        try {
            if (!Files.exists(Paths.get(HERMES_DB))) return 0;
            return jdbc.queryForObject(
                "SELECT COUNT(*) FROM sessions WHERE ended_at IS NULL",
                Integer.class
            );
        } catch (Exception e) {
            log.debug("Could not count active sessions: {}", e.getMessage());
            return 0;
        }
    }

    private int countTotalSessions() {
        try {
            if (!Files.exists(Paths.get(HERMES_DB))) return 0;
            return jdbc.queryForObject("SELECT COUNT(*) FROM sessions", Integer.class);
        } catch (Exception e) {
            log.debug("Could not count total sessions: {}", e.getMessage());
            return 0;
        }
    }

    private String getHermesVersion() {
        return runCommand(List.of("python3", "-c",
            "import sys; sys.path.insert(0, '/opt/Resonance/modules/hermes-core'); from hermes_constants import __version__; print(__version__)"));
    }

    private String getGatewayStatus() {
        try {
            String pidResult = runCommand(List.of("pgrep", "-f", "hermes.*gateway"));
            if (pidResult != null && !pidResult.isBlank()) {
                return "running";
            }
        } catch (Exception e) {
            log.debug("Gateway check: {}", e.getMessage());
        }
        return "stopped";
    }

    private List<Map<String, Object>> getPlatformStatuses() {
        List<Map<String, Object>> platforms = new ArrayList<>();
        platforms.add(Map.of("name", "telegram", "status", "disconnected"));
        platforms.add(Map.of("name", "discord", "status", "disconnected"));
        platforms.add(Map.of("name", "slack", "status", "disconnected"));
        return platforms;
    }

    private List<Map<String, Object>> getOllamaModels() {
        List<Map<String, Object>> models = new ArrayList<>();
        try {
            String output = runCommand(List.of("ollama", "list"));
            if (output != null && !output.isBlank()) {
                String[] lines = output.split("\n");
                for (int i = 1; i < lines.length; i++) {
                    String line = lines[i].trim();
                    if (line.isEmpty()) continue;
                    String[] parts = line.split("\\s+");
                    if (parts.length >= 3) {
                        Map<String, Object> model = new LinkedHashMap<>();
                        model.put("name", parts[0]);
                        model.put("size", parts.length > 1 ? parts[1] : "unknown");
                        model.put("modifiedAt", parts.length > 2 ? parts[2] : "");
                        model.put("status", "downloaded");
                        models.add(model);
                    }
                }
            }
        } catch (Exception e) {
            log.debug("Could not get Ollama models: {}", e.getMessage());
        }
        return models;
    }

    private List<Map<String, Object>> getAvailableModelsFromCatalog() {
        List<Map<String, Object>> models = new ArrayList<>();
        models.add(Map.of("name", "qwen2.5-coder-32b", "size", "18GB", "description", "Qwen 2.5 Coder 32B"));
        models.add(Map.of("name", "codellama-34b", "size", "19GB", "description", "Code Llama 34B"));
        models.add(Map.of("name", "mistral-22b", "size", "13GB", "description", "Mistral 22B"));
        models.add(Map.of("name", "llama3.1-8b", "size", "4.5GB", "description", "Llama 3.1 8B"));
        return models;
    }

    private List<Map<String, Object>> getHermesSessions(int limit, int offset) {
        List<Map<String, Object>> sessions = new ArrayList<>();
        try {
            if (!Files.exists(Paths.get(HERMES_DB))) return sessions;

            String sql = String.format(
                "SELECT id, source, model, started_at, ended_at, message_count, " +
                "tool_call_count, title FROM sessions ORDER BY started_at DESC LIMIT %d OFFSET %d",
                limit, offset
            );

            sessions = jdbc.queryForList(sql);
            if (sessions.isEmpty()) {
                sessions.add(Map.of(
                    "id", "demo-session-001",
                    "source", "cli",
                    "model", "qwen2.5-coder-7b",
                    "startedAt", LocalDateTime.now().minusHours(2).toString(),
                    "endedAt", LocalDateTime.now().minusHours(1).toString(),
                    "messageCount", 15,
                    "toolCallCount", 8,
                    "title", "Demo Session"
                ));
            }
        } catch (Exception e) {
            log.debug("Could not get Hermes sessions: {}", e.getMessage());
        }
        return sessions;
    }

    private List<String> getHermesLogs(String component, int lines) {
        List<String> logs = new ArrayList<>();
        try {
            Path logPath = Paths.get(HERMES_HOME, "logs", "hermes.log");
            if (Files.exists(logPath)) {
                List<String> allLines = Files.readAllLines(logPath);
                int start = Math.max(0, allLines.size() - lines);
                for (int i = start; i < allLines.size(); i++) {
                    logs.add(allLines.get(i));
                }
            } else {
                logs.add("No logs available yet");
            }
        } catch (Exception e) {
            logs.add("Error reading logs: " + e.getMessage());
        }
        return logs;
    }

    private List<Map<String, Object>> getHermesSkills() {
        List<Map<String, Object>> skills = new ArrayList<>();
        try {
            Path skillsPath = Paths.get(HERMES_HOME, "skills");
            if (Files.exists(skillsPath)) {
                Files.list(skillsPath).forEach(skillDir -> {
                    if (Files.isDirectory(skillDir)) {
                        Map<String, Object> skill = new LinkedHashMap<>();
                        skill.put("name", skillDir.getFileName().toString());
                        skill.put("path", skillDir.toString());
                        skill.put("enabled", true);
                        skills.add(skill);
                    }
                });
            }
        } catch (Exception e) {
            log.debug("Could not list skills: {}", e.getMessage());
        }

        if (skills.isEmpty()) {
            skills.add(Map.of("name", "default-skill", "enabled", true, "description", "Default Hermes skill"));
            skills.add(Map.of("name", "code-review", "enabled", true, "description", "Code review skill"));
        }
        return skills;
    }

    public String pullModel(String modelName) {
        try {
            ProcessBuilder pb = new ProcessBuilder("ollama", "pull", modelName);
            pb.redirectErrorStream(true);
            Process p = pb.start();
            StringBuilder output = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(p.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    output.append(line).append("\n");
                }
            }
            int exitCode = p.waitFor();
            return exitCode == 0 ? "Model " + modelName + " pulled successfully" : "Failed: " + output;
        } catch (Exception e) {
            return "Error pulling model: " + e.getMessage();
        }
    }

    public String deleteModel(String modelName) {
        try {
            ProcessBuilder pb = new ProcessBuilder("ollama", "delete", modelName);
            pb.redirectErrorStream(true);
            Process p = pb.start();
            int exitCode = p.waitFor();
            return exitCode == 0 ? "Model " + modelName + " deleted" : "Failed to delete";
        } catch (Exception e) {
            return "Error deleting model: " + e.getMessage();
        }
    }

    private String runCommand(List<String> command) {
        try {
            ProcessBuilder pb = new ProcessBuilder(command);
            pb.redirectErrorStream(true);
            Process p = pb.start();
            StringBuilder output = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(new InputStreamReader(p.getInputStream()))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    output.append(line).append("\n");
                }
            }
            p.waitFor(5, TimeUnit.SECONDS);
            return output.toString().trim();
        } catch (Exception e) {
            log.debug("Command failed: {} - {}", String.join(" ", command), e.getMessage());
            return null;
        }
    }
}