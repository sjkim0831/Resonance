package egovframework.com.platform.hermes.service;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.sql.Clob;
import java.sql.SQLException;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
public class HermesWorkflowAdminService {

    private final JdbcTemplate jdbcTemplate;

    public HermesWorkflowAdminService(DataSource dataSource) {
        this.jdbcTemplate = new JdbcTemplate(dataSource);
    }

    public Map<String, Object> buildPage(String status, String taskType, String keyword, boolean isEn) {
        Map<String, Object> payload = new LinkedHashMap<>();
        List<Map<String, Object>> tasks = queryTasks(status, taskType, keyword);
        String selectedTaskId = tasks.isEmpty() ? "" : stringValue(tasks.get(0).get("hermesTaskId"));

        payload.put("generatedAt", Instant.now().toString());
        payload.put("isEn", isEn);
        payload.put("filters", Map.of(
                "status", safe(status),
                "taskType", safe(taskType),
                "keyword", safe(keyword)
        ));
        payload.put("summary", buildSummary());
        payload.put("tasks", tasks);
        payload.put("selectedTaskId", selectedTaskId);
        payload.put("steps", selectedTaskId.isBlank() ? List.of() : queryByTask("hermes_task_step", selectedTaskId, "step_order"));
        payload.put("interpretations", selectedTaskId.isBlank() ? List.of() : queryByTask("hermes_command_interpretation", selectedTaskId, "frst_regist_pnttm DESC"));
        payload.put("executions", selectedTaskId.isBlank() ? List.of() : queryByTask("hermes_execution_log", selectedTaskId, "frst_regist_pnttm DESC"));
        payload.put("cliSessions", queryCliSessions(selectedTaskId));
        payload.put("runtimeSnapshots", selectedTaskId.isBlank() ? List.of() : queryByTask("hermes_runtime_snapshot", selectedTaskId, "frst_regist_pnttm DESC"));
        payload.put("contextPacks", selectedTaskId.isBlank() ? List.of() : queryByTask("hermes_context_pack", selectedTaskId, "frst_regist_pnttm DESC"));
        payload.put("nextRecommendations", selectedTaskId.isBlank() ? List.of() : queryByTask("hermes_next_action_recommendation", selectedTaskId, "recommendation_order"));
        payload.put("verifications", selectedTaskId.isBlank() ? List.of() : queryByTask("hermes_verification_log", selectedTaskId, "frst_regist_pnttm DESC"));
        payload.put("modelDecisions", selectedTaskId.isBlank() ? List.of() : queryByTask("hermes_model_decision", selectedTaskId, "frst_regist_pnttm DESC"));
        payload.put("failurePatterns", queryFailurePatterns());
        payload.put("stageTemplates", queryStageTemplates());
        payload.put("message", isEn
                ? "Hermes workflow memory is read-only here. Execution remains gated by Codex and deterministic scripts."
                : "이 화면은 Hermes 작업 기억을 조회합니다. 실제 실행은 Codex와 결정론적 스크립트 게이트를 따릅니다.");
        return payload;
    }

    private Map<String, Object> buildSummary() {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("taskCount", count("SELECT COUNT(*) FROM hermes_task"));
        row.put("openTaskCount", count("SELECT COUNT(*) FROM hermes_task WHERE status NOT IN ('COMPLETED', 'FAILED', 'CANCELLED')"));
        row.put("stepCount", count("SELECT COUNT(*) FROM hermes_task_step"));
        row.put("executionCount", count("SELECT COUNT(*) FROM hermes_execution_log"));
        row.put("cliSessionCount", count("SELECT COUNT(*) FROM hermes_cli_session"));
        row.put("snapshotCount", count("SELECT COUNT(*) FROM hermes_runtime_snapshot"));
        row.put("recommendationCount", count("SELECT COUNT(*) FROM hermes_next_action_recommendation WHERE status = 'READY'"));
        row.put("verificationCount", count("SELECT COUNT(*) FROM hermes_verification_log"));
        row.put("failurePatternCount", count("SELECT COUNT(*) FROM hermes_failure_pattern WHERE active_yn = 'Y'"));
        return row;
    }

    private List<Map<String, Object>> queryTasks(String status, String taskType, String keyword) {
        StringBuilder sql = new StringBuilder();
        sql.append("SELECT hermes_task_id, trace_id, task_type, risk_level, ");
        sql.append("status, owner_model, target_route, target_module, ");
        sql.append("user_request, ");
        sql.append("interpreted_intent, ");
        sql.append("plan_summary, ");
        sql.append("frst_regist_pnttm AS created_at, last_updt_pnttm AS updated_at ");
        sql.append("FROM hermes_task WHERE 1 = 1 ");
        if (!safe(status).isBlank() && !"ALL".equalsIgnoreCase(status)) {
            sql.append("AND status = '").append(escape(status, 40)).append("' ");
        }
        if (!safe(taskType).isBlank() && !"ALL".equalsIgnoreCase(taskType)) {
            sql.append("AND task_type = '").append(escape(taskType, 80)).append("' ");
        }
        if (!safe(keyword).isBlank()) {
            String escaped = escape(keyword, 120);
            sql.append("AND (LOWER(hermes_task_id) LIKE LOWER('%").append(escaped).append("%') ");
            sql.append("OR LOWER(task_type) LIKE LOWER('%").append(escaped).append("%') ");
            sql.append("OR LOWER(target_route) LIKE LOWER('%").append(escaped).append("%') ");
            sql.append("OR LOWER(target_module) LIKE LOWER('%").append(escaped).append("%')) ");
        }
        sql.append("ORDER BY frst_regist_pnttm DESC LIMIT 100");
        return normalizeRows(jdbcTemplate.queryForList(sql.toString()));
    }

    private List<Map<String, Object>> queryByTask(String tableName, String taskId, String orderBy) {
        String sql = "SELECT * FROM " + tableName
                + " WHERE hermes_task_id = '" + escape(taskId, 80) + "'"
                + " ORDER BY " + orderBy
                + " LIMIT 100";
        return normalizeRows(jdbcTemplate.queryForList(sql));
    }

    private List<Map<String, Object>> queryCliSessions(String taskId) {
        StringBuilder sql = new StringBuilder();
        sql.append("SELECT hermes_session_id, hermes_task_id, workspace_path, ");
        sql.append("mode, status, transcript_ref, stdout_ref, stderr_ref, ");
        sql.append("exit_code, started_at, finished_at, elapsed_ms, summary ");
        sql.append("FROM hermes_cli_session WHERE 1 = 1 ");
        if (!safe(taskId).isBlank()) {
            sql.append("AND (hermes_task_id = '").append(escape(taskId, 80)).append("' OR hermes_task_id IS NULL) ");
        }
        sql.append("ORDER BY frst_regist_pnttm DESC LIMIT 100");
        return normalizeRows(jdbcTemplate.queryForList(sql.toString()));
    }

    private List<Map<String, Object>> queryFailurePatterns() {
        String sql = "SELECT failure_pattern_id AS failurePatternId, pattern_key AS patternKey, failure_type AS failureType, "
                + "symptom_summary AS symptomSummary, "
                + "recovery_summary AS recoverySummary, "
                + "prevention_summary AS preventionSummary, "
                + "source_task_id AS sourceTaskId, hit_count AS hitCount, active_yn AS activeYn, last_updt_pnttm AS updatedAt "
                + "FROM hermes_failure_pattern ORDER BY last_updt_pnttm DESC LIMIT 100";
        return normalizeRows(jdbcTemplate.queryForList(sql));
    }

    private List<Map<String, Object>> queryStageTemplates() {
        String sql = "SELECT stage_code AS stageCode, stage_order AS stageOrder, stage_name AS stageName, "
                + "default_executor AS defaultExecutor, evidence_policy AS evidencePolicy, active_yn AS activeYn "
                + "FROM hermes_workflow_stage_template ORDER BY stage_order";
        return normalizeRows(jdbcTemplate.queryForList(sql));
    }

    private int count(String sql) {
        Integer value = jdbcTemplate.queryForObject(sql, Integer.class);
        return value == null ? 0 : value;
    }

    private List<Map<String, Object>> normalizeRows(List<Map<String, Object>> rows) {
        return rows.stream().map(this::normalizeRow).toList();
    }

    private Map<String, Object> normalizeRow(Map<String, Object> source) {
        Map<String, Object> row = new LinkedHashMap<>();
        source.forEach((key, value) -> row.put(toCamelCase(key), normalizeValue(value)));
        return row;
    }

    private Object normalizeValue(Object value) {
        if (value instanceof Clob clob) {
            try {
                return clob.getSubString(1, (int) Math.min(clob.length(), 1200));
            } catch (SQLException ignored) {
                return "";
            }
        }
        return value;
    }

    private String toCamelCase(String value) {
        String lower = value == null ? "" : value.toLowerCase(Locale.ROOT);
        StringBuilder builder = new StringBuilder();
        boolean upperNext = false;
        for (int i = 0; i < lower.length(); i++) {
            char ch = lower.charAt(i);
            if (ch == '_') {
                upperNext = true;
                continue;
            }
            builder.append(upperNext ? Character.toUpperCase(ch) : ch);
            upperNext = false;
        }
        return builder.toString();
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private String escape(String value, int limit) {
        return safe(value).replace("'", "''").substring(0, Math.min(safe(value).length(), limit));
    }

    private String stringValue(Object value) {
        return value == null ? "" : String.valueOf(value);
    }
}
