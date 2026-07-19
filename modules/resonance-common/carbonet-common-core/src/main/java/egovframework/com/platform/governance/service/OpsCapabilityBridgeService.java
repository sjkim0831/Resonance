package egovframework.com.platform.governance.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class OpsCapabilityBridgeService {
    private static final Map<String,String> READ = Map.ofEntries(
        Map.entry("status","/api/status"), Map.entry("cockpit","/api/ops-cockpit"),
        Map.entry("body-framework","/api/framework"), Map.entry("deployments","/api/deploy-status"),
        Map.entry("self-evolving","/api/self-evolving"), Map.entry("model-runtime","/api/ai-models/runtime"),
        Map.entry("model-hangar","/api/model-hangar"), Map.entry("rag","/api/rag-control"),
        Map.entry("ai-teams","/api/ai-teams"), Map.entry("hermes-sessions","/api/hermes-sessions"),
        Map.entry("local-models","/api/models/local"), Map.entry("storage","/api/opt-monitor"),
        Map.entry("incidents","/api/incidents")
    );
    private static final Map<String,String> ACTIONS = Map.ofEntries(
        Map.entry("download-model","/api/hf-download"), Map.entry("ai-team","/api/ai-team-action"),
        Map.entry("start-hermes","/api/hermes-session-start"), Map.entry("model-runtime","/api/ai-models/action"),
        Map.entry("model-hangar","/api/model-hangar/action"), Map.entry("rag","/api/rag-action"),
        Map.entry("record-incident","/api/incidents/record"), Map.entry("self-heal","/api/self-heal/execute")
    );
    private final HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
    private final ObjectMapper mapper;
    private final String baseUrl;
    private final String token;

    public OpsCapabilityBridgeService(ObjectMapper mapper,
                                      @Value("${resonance.ops.base-url:http://172.16.1.232:17890}") String baseUrl,
                                      @Value("${resonance.ops.token:}") String token) {
        this.mapper = mapper;
        this.baseUrl = baseUrl.replaceAll("/+$", "");
        this.token = token;
    }

    public Map<String,Object> catalog() {
        List<Map<String,String>> reads = READ.entrySet().stream().sorted(Map.Entry.comparingByKey())
            .map(e -> Map.of("code",e.getKey(),"endpoint",e.getValue(),"mode","READ")).toList();
        List<Map<String,String>> actions = ACTIONS.entrySet().stream().sorted(Map.Entry.comparingByKey())
            .map(e -> Map.of("code",e.getKey(),"endpoint",e.getValue(),"mode","APPROVAL_REQUIRED")).toList();
        return Map.of("available",!token.isBlank(),"readCapabilities",reads,"actionCapabilities",actions,
            "security","ADMIN_SESSION + SERVER_SIDE_TOKEN + ALLOWLIST","source","resonance-ops-web");
    }

    public Map<String,Object> read(String capability) { return exchange(READ.get(capability), "GET", null); }

    public Map<String,Object> execute(String capability, Map<String,Object> body) {
        return exchange(ACTIONS.get(capability), "POST", body == null ? Map.of() : body);
    }

    private Map<String,Object> exchange(String path, String method, Map<String,Object> body) {
        if (path == null) throw new IllegalArgumentException("Unsupported Ops capability.");
        if (token.isBlank()) throw new IllegalStateException("Ops bridge token is not configured.");
        try {
            HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(baseUrl + path))
                .timeout(Duration.ofSeconds(20)).header("X-Resonance-Token", token).header("Accept", "application/json");
            if ("POST".equals(method)) builder.header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(mapper.writeValueAsString(body)));
            else builder.GET();
            HttpResponse<String> response = http.send(builder.build(), HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300)
                throw new IllegalStateException("Ops upstream returned " + response.statusCode());
            Map<String,Object> result = mapper.readValue(response.body(), new TypeReference<>() {});
            Map<String,Object> wrapped = new LinkedHashMap<>();
            wrapped.put("success",true); wrapped.put("capability",path); wrapped.put("data",result);
            return wrapped;
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalStateException("Ops request interrupted.", e);
        } catch (Exception e) { throw new IllegalStateException("Ops bridge request failed: " + e.getMessage(), e); }
    }
}
