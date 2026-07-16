package egovframework.com.platform.aiadmin.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class KrdsCodeGenerationService {
    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    @Value("${CARBONET_KRDS_AI_BASE_URL:http://172.16.1.232:24451/v1}")
    private String baseUrl;
    @Value("${CARBONET_KRDS_AI_API_KEY:qwer1234}")
    private String apiKey;
    @Value("${CARBONET_KRDS_AI_MODEL:gemma4-e4b-gpu-shadow}")
    private String model;

    public Map<String, Object> generate(String userPrompt, String target, boolean en) {
        if (userPrompt == null || userPrompt.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "prompt is required");
        }
        if (userPrompt.length() > 6000) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "prompt is too long");
        }

        long started = System.currentTimeMillis();
        List<Map<String, Object>> sources = retrieveKrdsContext();
        String systemPrompt = loadSystemPrompt() + "\n\n[RETRIEVED KRDS MANUAL AND TOKENS]\n" +
            sources.stream().map(row -> String.valueOf(row.get("content"))).reduce("", (a, b) -> a + "\n---\n" + b);
        String request = "Target: " + safeTarget(target) + "\nUser request:\n" + userPrompt;

        String code = callModel(systemPrompt, request);
        String outputTarget = safeTarget(target);
        List<String> violations = validate(code, outputTarget);
        if (!violations.isEmpty()) {
            code = callModel(systemPrompt, request + "\n\nRepair the previous output. Violations: " + String.join("; ", violations) + "\nPrevious output:\n" + code);
            violations = validate(code, outputTarget);
        }
        boolean passed = violations.isEmpty();
        String generationId = "KRDS-GEN-" + UUID.randomUUID().toString().substring(0, 12).toUpperCase();
        record(generationId, userPrompt, target, systemPrompt, code, sources.size(), passed, violations, System.currentTimeMillis() - started);

        Map<String, Object> result = new LinkedHashMap<>();
        result.put("generationId", generationId);
        result.put("model", model);
        result.put("pipeline", List.of("KRDS_RAG", "SYSTEM_PROMPT", "LLM_API", "WCAG_2_1_AA_GATE"));
        result.put("retrievedSources", sources);
        result.put("wcagStatus", passed ? "PASS" : "REJECTED");
        result.put("violations", violations);
        result.put("code", passed ? normalizeCode(code) : "");
        result.put("durationMs", System.currentTimeMillis() - started);
        result.put("message", passed ? (en ? "KRDS code passed the accessibility gate." : "KRDS 코드가 접근성 게이트를 통과했습니다.") :
            (en ? "Code was withheld because the accessibility gate failed." : "접근성 게이트를 통과하지 못해 코드를 반환하지 않았습니다."));
        return result;
    }

    private List<Map<String, Object>> retrieveKrdsContext() {
        List<Map<String, Object>> rows = new ArrayList<>();
        try {
            rows.addAll(jdbc.query("SELECT c.chunk_id, d.document_name, c.content_text FROM ai_rag_chunk c " +
                    "JOIN ai_rag_document d ON d.document_id=c.document_id WHERE d.document_type='KRDS_MANUAL' " +
                    "AND d.status='ACTIVE' AND c.status='ACTIVE' ORDER BY c.chunk_index LIMIT 12",
                (rs, i) -> Map.of("id", rs.getString(1), "name", rs.getString(2), "content", rs.getString(3))));
        } catch (Exception e) {
            log.warn("KRDS RAG lookup failed: {}", e.getMessage());
        }
        try {
            rows.addAll(jdbc.query("SELECT theme_id, theme_nm, color_config, typography_config, spacing_config FROM comtnthemedefinition " +
                    "WHERE use_at='Y' AND is_active='Y' ORDER BY is_default DESC, sort_order LIMIT 3",
                (rs, i) -> Map.of("id", rs.getString(1), "name", rs.getString(2), "content",
                    "Theme=" + String.valueOf(rs.getString(2)) + "; colors=" + String.valueOf(rs.getString(3)) +
                        "; typography=" + String.valueOf(rs.getString(4)) + "; spacing=" + String.valueOf(rs.getString(5)))));
        } catch (Exception e) {
            log.debug("Theme context unavailable: {}", e.getMessage());
        }
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "KRDS RAG context is not indexed");
        return rows;
    }

    private String loadSystemPrompt() {
        try {
            return jdbc.queryForObject("SELECT system_prompt FROM ai_prompt_template WHERE prompt_type='KRDS_CODE_GENERATION' " +
                "AND status='ACTIVE' AND active_yn='Y' ORDER BY last_updt_pnttm DESC LIMIT 1", String.class);
        } catch (Exception e) {
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "KRDS prompt template is not active");
        }
    }

    private String callModel(String systemPrompt, String userPrompt) {
        try {
            Map<String, Object> payload = Map.of(
                "model", model,
                "temperature", 0.1,
                "max_tokens", 6000,
                "messages", List.of(Map.of("role", "system", "content", systemPrompt), Map.of("role", "user", "content", userPrompt))
            );
            HttpRequest request = HttpRequest.newBuilder(URI.create(baseUrl.replaceAll("/$", "") + "/chat/completions"))
                .timeout(Duration.ofSeconds(120))
                .header("Content-Type", "application/json")
                .header("Authorization", "Bearer " + apiKey)
                .POST(HttpRequest.BodyPublishers.ofString(objectMapper.writeValueAsString(payload))).build();
            HttpResponse<String> response = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build()
                .send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() / 100 != 2) throw new IllegalStateException("model HTTP " + response.statusCode());
            JsonNode root = objectMapper.readTree(response.body());
            String content = root.path("choices").path(0).path("message").path("content").asText();
            if (content.isBlank()) throw new IllegalStateException("empty model response");
            return normalizeCode(content);
        } catch (Exception e) {
            log.error("KRDS model invocation failed", e);
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "KRDS model invocation failed");
        }
    }

    private List<String> validate(String code, String target) {
        String value = normalizeCode(code);
        List<String> failures = new ArrayList<>();
        if (!(value.contains("<main") || value.contains("<section") || value.contains("<form"))) failures.add("semantic landmark is required");
        if (value.matches("(?s).*<img(?![^>]*\\balt=)[^>]*>.*")) failures.add("every image requires alt text");
        if (value.matches("(?s).*<(input|select|textarea)(?![^>]*(aria-label|aria-labelledby|id=))[^>]*>.*")) failures.add("form controls require an accessible name");
        if (value.matches("(?s).*<div[^>]*onClick=.*")) failures.add("interactive div is not keyboard accessible");
        if (value.matches("(?s).*<button(?![^>]*type=)[^>]*>.*")) failures.add("button type is required");
        if (value.contains("outline-none") && !value.contains("focus-visible:")) failures.add("visible keyboard focus is required");
        if (value.matches("(?s).*#[0-9a-fA-F]{3,8}.*")) failures.add("raw colors are forbidden; use KRDS semantic tokens");
        if (value.matches("(?s).*<gov-[a-z][^>]*>.*")) failures.add("gov-* names are CSS classes, not custom HTML elements; use native controls");
        if (value.contains("<table") && !(value.contains("<caption") && value.contains("<th"))) failures.add("data tables require caption and headers");
        if (!value.contains("gov-") && !value.contains("krds-")) failures.add("KRDS/GOV component classes are required");
        if (!"HTML".equals(target)) {
            if (value.matches("(?s).*\\sclass=.*")) failures.add("React output must use className instead of class");
            if (value.matches("(?s).*<label[^>]*\\sfor=.*")) failures.add("React labels must use htmlFor instead of for");
        }
        if ("REACT_TSX".equals(target) && !value.contains("<h1")) failures.add("a page component requires one semantic h1");
        if (value.contains("Simulate API") || value.contains("setTimeout(resolve")) failures.add("fake API behavior is forbidden; expose a typed submit contract instead");
        return failures;
    }

    private void record(String id, String prompt, String target, String systemPrompt, String code, int chunks,
                        boolean passed, List<String> violations, long durationMs) {
        try {
            jdbc.update("INSERT INTO ai_krds_code_generation(generation_id,user_prompt,target_type,model_name,prompt_snapshot,output_code,rag_chunk_count,wcag_status,violations_json,duration_ms) VALUES (?,?,?,?,?,?,?,?,?::jsonb,?)",
                id, prompt, safeTarget(target), model, systemPrompt, code, chunks, passed ? "PASS" : "REJECTED",
                objectMapper.writeValueAsString(violations), durationMs);
        } catch (Exception e) { log.warn("Could not persist KRDS generation trace: {}", e.getMessage()); }
    }

    private String safeTarget(String target) {
        return target != null && List.of("REACT_TSX", "HTML", "SECTION", "COMPONENT").contains(target) ? target : "REACT_TSX";
    }

    private String normalizeCode(String code) {
        return code == null ? "" : code.trim().replaceFirst("^```(?:tsx|jsx|typescript|html)?\\s*", "").replaceFirst("\\s*```$", "").trim();
    }
}
