package egovframework.com.platform.aiadmin.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.platform.governance.service.ActorProcessGovernanceService;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class E4bGeneratorSelectionService {
    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;
    private final ActorProcessGovernanceService governance;

    @Value("${CARBONET_KRDS_AI_BASE_URL:http://127.0.0.1:24451/v1}") private String baseUrl;
    @Value("${CARBONET_KRDS_AI_API_KEY:qwer1234}") private String apiKey;
    @Value("${CARBONET_KRDS_AI_MODEL:gemma4-e4b-gpu-shadow}") private String model;

    @Transactional
    public Map<String, Object> selectAndExecute(Map<String, Object> body, String actor) {
        String process = required(body, "processCode");
        String step = text(body, "stepCode");
        boolean execute = Boolean.parseBoolean(String.valueOf(body.getOrDefault("execute", false)));
        List<Map<String, Object>> steps = jdbc.queryForList(
            "select step_code as \"stepCode\",step_name as \"stepName\",actor_code as \"actorCode\"," +
            "requires_user_page as \"requiresUserPage\",requires_admin_page as \"requiresAdminPage\"," +
            "user_path as \"userPath\",admin_path as \"adminPath\",requirement_text as requirement " +
            "from framework_process_step where process_code=? and (?='' or step_code=?) order by step_order",
            process, step, step);
        if (steps.isEmpty()) throw new IllegalArgumentException("Process step not found: " + process + " / " + step);
        List<Map<String, Object>> generators = jdbc.queryForList(
            "select generator_id as \"generatorId\",screen_type as \"screenType\",strategy,template_code as \"templateCode\"," +
            "verification_profile as \"verificationProfile\" from framework_generator_registry where active_yn='Y' order by generator_id");
        List<Map<String, Object>> pages = jdbc.queryForList(
            "select asset_code as \"pageId\",asset_name as \"pageName\",asset_path as route,selection_status as \"selectionStatus\" " +
            "from framework_e4b_selectable_asset where asset_type='PAGE' and (domain_code=(select domain_code from framework_process_definition where process_code=?) " +
            "or lower(coalesce(asset_path,'')) in (select lower(split_part(coalesce(user_path,''),'?',1)) from framework_process_step where process_code=? " +
            "union select lower(split_part(coalesce(admin_path,''),'?',1)) from framework_process_step where process_code=?)) limit 40",
            process, process, process);
        String prompt = "Select exactly one approved generator for this already-designed Carbonet process. " +
            "Prefer ADOPT_EXISTING_PAGE when a matching implemented route exists. Never write source code or invent IDs. " +
            "Return JSON only: {generatorId,screenType,strategy,reason,confidence}.\nPROCESS=" + process +
            "\nSTEPS=" + json(steps) + "\nEXISTING_PAGES=" + json(pages) + "\nALLOWED_GENERATORS=" + json(generators);
        JsonNode selection = callModel(prompt);
        String generatorId = selection.path("generatorId").asText();
        Map<String, Object> generator = generators.stream()
            .filter(row -> generatorId.equals(String.valueOf(row.get("generatorId")))).findFirst()
            .orElseThrow(() -> new IllegalArgumentException("E4B selected an unregistered generator: " + generatorId));
        String screenType = String.valueOf(generator.get("screenType"));
        String strategy = String.valueOf(generator.get("strategy"));
        double confidence = selection.path("confidence").asDouble(0);
        if (confidence < 0.70) throw new IllegalStateException("E4B generator confidence is below 0.70");
        if (!screenType.equals(selection.path("screenType").asText()))
            throw new IllegalArgumentException("E4B screen type does not match the generator registry");
        if (!strategy.equals(selection.path("strategy").asText()))
            throw new IllegalArgumentException("E4B strategy does not match the generator registry");

        String requestId = "E4B-" + UUID.randomUUID().toString().substring(0, 12).toUpperCase();
        Map<String, Object> execution = Map.of("executed", false);
        String executionStatus = "PLANNED";
        if (execute) {
            execution = "ADOPT_EXISTING".equals(strategy)
                ? governance.adoptExistingScreens(Map.of("maxScreens", 1000), actor)
                : governance.executeDesignDirectDevelopment(Map.of("processCode", process, "force", false), actor);
            executionStatus = Boolean.TRUE.equals(execution.get("success")) ? "COMPLETED" : "FAILED";
        }
        jdbc.update("insert into framework_e4b_generator_selection(request_id,process_code,step_code,model_name,generator_id,screen_type,strategy,selection_json,validation_status,execution_status,execution_result,selected_by,executed_at) values(?,?,?,?,?,?,?,?::jsonb,'VERIFIED',?,?::jsonb,?,case when ? then current_timestamp else null end)",
            requestId, process, step.isBlank() ? null : step, model, generatorId, screenType, strategy,
            selection.toString(), executionStatus, json(execution), actor, execute);
        Map<String, Object> result = new LinkedHashMap<>();
        result.put("success", true); result.put("requestId", requestId); result.put("model", model);
        result.put("processCode", process); result.put("stepCode", step); result.put("selection", selection);
        result.put("generator", generator); result.put("execution", execution);
        return result;
    }

    private JsonNode callModel(String prompt) {
        try {
            Map<String, Object> payload = Map.of("model", model, "temperature", 0, "max_tokens", 1500,
                "messages", List.of(
                    Map.of("role", "system", "content", "You are the E4B deterministic generator selector. Select only supplied IDs. Answer immediately with strict JSON, without analysis."),
                    Map.of("role", "user", "content", prompt)));
            HttpRequest request = HttpRequest.newBuilder(URI.create(baseUrl.replaceAll("/$", "") + "/chat/completions"))
                .timeout(Duration.ofSeconds(90)).header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + apiKey)
                .POST(HttpRequest.BodyPublishers.ofString(json(payload))).build();
            HttpResponse<String> response = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build()
                .send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) throw new IllegalStateException("E4B HTTP " + response.statusCode());
            String content = objectMapper.readTree(response.body()).path("choices").path(0).path("message").path("content").asText();
            int start = content.indexOf('{'), end = content.lastIndexOf('}');
            if (start < 0 || end < start) throw new IllegalStateException("E4B returned invalid JSON");
            return objectMapper.readTree(content.substring(start, end + 1));
        } catch (Exception e) { throw new IllegalStateException("E4B generator selection failed: " + e.getMessage(), e); }
    }

    private String required(Map<String, Object> body, String key) { String value = text(body, key); if (value.isBlank()) throw new IllegalArgumentException(key + " is required"); return value; }
    private String text(Map<String, Object> body, String key) { Object value = body.get(key); return value == null ? "" : String.valueOf(value).trim(); }
    private String json(Object value) { try { return objectMapper.writeValueAsString(value); } catch (Exception e) { throw new IllegalStateException(e); } }
}
