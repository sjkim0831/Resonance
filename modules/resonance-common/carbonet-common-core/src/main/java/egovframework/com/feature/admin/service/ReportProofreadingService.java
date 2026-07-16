package egovframework.com.feature.admin.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpEntity;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestTemplate;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
@RequiredArgsConstructor
public class ReportProofreadingService {

    private static final Pattern PROTECTED_TOKEN = Pattern.compile("(?i)(?:[-+]?\\d[\\d,.]*%?|kg|g|mg|t|ton|km|m3|nm3|kwh|mwh|gj|mj|co2e?|ch4|n2o|nox|sox|[A-Z]{2,}[A-Z0-9_-]*)");

    private final ObjectMapper objectMapper;

    @Value("${CARBONET_AI_GEMMA_BASE_URL:${carbonet.ai.gemma.base-url:http://172.16.1.232:24451/v1}}")
    private String baseUrl;

    @Value("${CARBONET_AI_GEMMA_API_KEY:${carbonet.ai.gemma.api-key:qwer1234}}")
    private String apiKey;

    @Value("${CARBONET_AI_GEMMA_MODEL:${carbonet.ai.gemma.model:gemma4-e4b-gpu-shadow}}")
    private String model;

    public Map<String, Object> proofread(Map<String, Object> request) {
        List<String> labels = normalizeLabels(request.get("labels"));
        if (labels.isEmpty()) {
            return Map.of("success", true, "model", model, "corrections", Map.of(), "changedCount", 0);
        }
        try {
            Map<String, String> corrections = callModel(labels);
            long changedCount = corrections.entrySet().stream().filter(entry -> !entry.getKey().equals(entry.getValue())).count();
            return Map.of("success", true, "model", model, "corrections", corrections, "changedCount", changedCount);
        } catch (Exception exception) {
            Map<String, String> originals = new LinkedHashMap<>();
            labels.forEach(label -> originals.put(label, label));
            return Map.of("success", false, "model", model, "corrections", originals, "changedCount", 0,
                    "message", "Proofreading model unavailable; original report text was preserved.");
        }
    }

    private List<String> normalizeLabels(Object raw) {
        if (!(raw instanceof List<?> values)) return List.of();
        LinkedHashSet<String> unique = new LinkedHashSet<>();
        for (Object value : values) {
            String text = value == null ? "" : String.valueOf(value).trim();
            if (!text.isBlank()) unique.add(text.substring(0, Math.min(text.length(), 500)));
            if (unique.size() >= 300) break;
        }
        return new ArrayList<>(unique);
    }

    private Map<String, String> callModel(List<String> labels) throws Exception {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(3000);
        factory.setReadTimeout(30000);
        RestTemplate client = new RestTemplate(factory);
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.setBearerAuth(apiKey == null ? "" : apiKey.trim());
        String inputJson = objectMapper.writeValueAsString(labels);
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("model", model);
        body.put("temperature", 0);
        body.put("max_tokens", 4096);
        body.put("chat_template_kwargs", Map.of("enable_thinking", false));
        body.put("messages", List.of(Map.of("role", "user", "content", """
                You are a Korean industrial carbon/LCA report proofreader. Correct only unmistakable spelling,
                spacing, or broken-character errors in the JSON string array. Preserve array order and count.
                Never alter numbers, units, chemical formulas, abbreviations, product codes, proper nouns,
                technical meaning, or valid domain terminology. When uncertain, return the original string.
                Return only a JSON array of corrected strings with no markdown or explanation.
                Input: %s
                """.formatted(inputJson))));
        Map<?, ?> response = client.postForObject(trim(baseUrl) + "/chat/completions", new HttpEntity<>(body, headers), Map.class);
        String content = extractContent(response);
        JsonNode result = objectMapper.readTree(extractJsonArray(content));
        if (!result.isArray() || result.size() != labels.size()) throw new IllegalStateException("Invalid proofreading response");
        Map<String, String> corrections = new LinkedHashMap<>();
        for (int index = 0; index < labels.size(); index++) {
            String corrected = result.get(index).asText(labels.get(index)).trim();
            String original = labels.get(index);
            corrections.put(original, corrected.isBlank() || !safeCorrection(original, corrected) ? original : corrected);
        }
        return corrections;
    }

    private String extractContent(Map<?, ?> response) {
        if (response == null || !(response.get("choices") instanceof List<?> choices) || choices.isEmpty()) return "";
        Object first = choices.get(0);
        if (!(first instanceof Map<?, ?> choice) || !(choice.get("message") instanceof Map<?, ?> message)) return "";
        Object content = message.get("content");
        Object reasoning = message.get("reasoning_content");
        return content == null ? (reasoning == null ? "" : String.valueOf(reasoning)) : String.valueOf(content);
    }

    private boolean safeCorrection(String original, String corrected) {
        if (corrected.length() > Math.max(500, original.length() * 2)) return false;
        if (!protectedTokens(original).equals(protectedTokens(corrected))) return false;
        String compactOriginal = original.replaceAll("\\s+", "");
        String compactCorrected = corrected.replaceAll("\\s+", "");
        int allowedChanges = Math.min(3, Math.max(1, compactOriginal.length() / 10));
        return editDistance(compactOriginal, compactCorrected) <= allowedChanges;
    }

    private List<String> protectedTokens(String value) {
        List<String> tokens = new ArrayList<>();
        Matcher matcher = PROTECTED_TOKEN.matcher(value);
        while (matcher.find()) tokens.add(matcher.group().toUpperCase());
        return tokens;
    }

    private int editDistance(String left, String right) {
        int[] previous = new int[right.length() + 1];
        for (int index = 0; index <= right.length(); index++) previous[index] = index;
        for (int row = 1; row <= left.length(); row++) {
            int[] current = new int[right.length() + 1];
            current[0] = row;
            for (int column = 1; column <= right.length(); column++) {
                int substitution = previous[column - 1] + (left.charAt(row - 1) == right.charAt(column - 1) ? 0 : 1);
                current[column] = Math.min(Math.min(previous[column] + 1, current[column - 1] + 1), substitution);
            }
            previous = current;
        }
        return previous[right.length()];
    }

    private String extractJsonArray(String content) {
        int start = content.indexOf('[');
        int end = content.lastIndexOf(']');
        if (start < 0 || end < start) throw new IllegalStateException("Missing JSON array");
        return content.substring(start, end + 1);
    }

    private String trim(String value) {
        return value == null ? "" : value.trim().replaceAll("/+$", "");
    }
}
