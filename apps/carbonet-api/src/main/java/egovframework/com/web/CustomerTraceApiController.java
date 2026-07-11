package egovframework.com.web;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.service.CustomerTraceApprovalLedgerService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.Principal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@RestController
@RequestMapping({"/api/platform/customer-trace", "/en/api/platform/customer-trace"})
public class CustomerTraceApiController {

    private final ObjectMapper objectMapper;
    private final Path traceRoot;
    private final CustomerTraceApprovalLedgerService approvalLedgerService;

    public CustomerTraceApiController(
            ObjectMapper objectMapper,
            CustomerTraceApprovalLedgerService approvalLedgerService,
            @Value("${CARBONET_BACKEND_METADATA_FS_OVERRIDE_PATH:/app/backend-metadata}") String backendMetadataRoot) {
        this.objectMapper = objectMapper;
        this.approvalLedgerService = approvalLedgerService;
        this.traceRoot = Path.of(backendMetadataRoot).normalize().resolve("customer-trace").normalize();
    }

    @GetMapping("/summary")
    public Map<String, Object> summary() throws IOException {
        JsonNode baseline = read("customer-trace-baseline.json");
        JsonNode consensus = read("customer-mapping-consensus.json");
        JsonNode sourceEvidence = read("customer-source-evidence.json");
        JsonNode httpEvidence = read("customer-http-evidence.json");
        JsonNode scorecard = read("customer-governance-scorecard.json");
        JsonNode srImport = read("customer-sr-workbench-import.json");
        JsonNode runtimeFindings = read("customer-runtime-findings.json");
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("traceCount", baseline.path("traceCount").asInt());
        response.put("modelOutputCount", consensus.path("modelOutputCount").asInt());
        response.put("sourceEvidenceCount", sourceEvidence.path("evidenceCount").asInt());
        response.put("httpPathCount", httpEvidence.path("pathCount").asInt());
        response.put("httpSummary", objectMapper.convertValue(httpEvidence.path("summary"), Map.class));
        response.put("customerMaturity", objectMapper.convertValue(scorecard.path("customerMaturity"), Map.class));
        response.put("deliveryReadiness", objectMapper.convertValue(scorecard.path("deliveryReadiness"), Map.class));
        response.put("srRequestCount", srImport.path("requestCount").asInt());
        response.put("runtimeFindingCount", runtimeFindings.path("findingCount").asInt());
        response.put("runtimeFindings", objectMapper.convertValue(runtimeFindings.path("findings"), List.class));
        response.put("approvalStateSummary", approvalLedgerService.stateSummary());
        response.put("policy", objectMapper.convertValue(scorecard.path("policy"), Map.class));
        return response;
    }

    @GetMapping("/traces")
    public Map<String, Object> traces(
            @RequestParam(required = false) String domain,
            @RequestParam(required = false) String query,
            @RequestParam(defaultValue = "0") int offset,
            @RequestParam(defaultValue = "50") int limit) throws IOException {
        JsonNode bindings = read("customer-sdui-bindings.json").path("bindings");
        String normalizedDomain = safe(domain).toLowerCase(Locale.ROOT);
        String normalizedQuery = safe(query).toLowerCase(Locale.ROOT);
        List<JsonNode> matched = new ArrayList<>();
        if (bindings.isArray()) {
            for (JsonNode row : bindings) {
                if (!normalizedDomain.isEmpty() && !row.path("domain").asText().toLowerCase(Locale.ROOT).contains(normalizedDomain)) continue;
                String searchable = (row.path("useCaseId").asText() + " " + row.path("title").asText() + " " + row.path("domain").asText()).toLowerCase(Locale.ROOT);
                if (!normalizedQuery.isEmpty() && !searchable.contains(normalizedQuery)) continue;
                matched.add(row);
            }
        }
        int safeOffset = Math.max(0, offset);
        int safeLimit = Math.max(1, Math.min(200, limit));
        int end = Math.min(matched.size(), safeOffset + safeLimit);
        List<JsonNode> items = safeOffset >= matched.size() ? List.of() : matched.subList(safeOffset, end);
        return Map.of("items", items, "total", matched.size(), "offset", safeOffset, "limit", safeLimit);
    }

    @GetMapping("/trace")
    public ResponseEntity<?> trace(@RequestParam String useCaseId) throws IOException {
        JsonNode bindings = read("customer-sdui-bindings.json").path("bindings");
        JsonNode requests = read("customer-sr-workbench-import.json").path("requests");
        if (bindings.isArray()) {
            for (JsonNode row : bindings) {
                if (useCaseId.equalsIgnoreCase(row.path("useCaseId").asText())) {
                    Map<String, Object> response = new LinkedHashMap<>();
                    response.put("binding", row);
                    response.put("approval", approvalLedgerService.find(useCaseId));
                    List<JsonNode> linkedRequests = new ArrayList<>();
                    if (requests.isArray()) {
                        for (JsonNode request : requests) {
                            for (JsonNode requestId : row.path("srRequestIds")) {
                                if (requestId.asText().equals(request.path("requestId").asText())) linkedRequests.add(request);
                            }
                        }
                    }
                    response.put("srRequests", linkedRequests);
                    return ResponseEntity.ok(response);
                }
            }
        }
        return ResponseEntity.notFound().build();
    }

    @GetMapping("/scorecard")
    public JsonNode scorecard() throws IOException { return read("customer-governance-scorecard.json"); }

    @GetMapping("/sr-backlog")
    public JsonNode srBacklog() throws IOException { return read("customer-sr-workbench-import.json"); }

    @GetMapping("/approval-ledger")
    public Map<String, Object> approvalLedger() { return approvalLedgerService.ledger(); }

    @PostMapping("/approval")
    public synchronized ResponseEntity<?> updateApproval(
            @RequestBody ApprovalUpdateRequest request,
            Principal principal) throws IOException {
        if (principal == null || safe(principal.getName()).isEmpty()) {
            return ResponseEntity.status(401).body(Map.of("message", "Authenticated reviewer is required."));
        }
        List<String> evidenceRefs = request.evidenceRefs() == null ? List.of() : request.evidenceRefs().stream().map(this::safe).filter(value -> !value.isEmpty()).distinct().toList();
        try {
            Map<String, Object> updated = approvalLedgerService.update(safe(request.useCaseId()), safe(request.state()), evidenceRefs, request.comment(), principal.getName());
            approvalLedgerService.exportSnapshot();
            return ResponseEntity.ok(updated);
        } catch (org.springframework.dao.EmptyResultDataAccessException error) {
            return ResponseEntity.notFound().build();
        } catch (IllegalArgumentException | IllegalStateException error) {
            return ResponseEntity.badRequest().body(Map.of("message", error.getMessage()));
        }
    }

    @GetMapping("/catalog")
    public JsonNode catalog() throws IOException { return read("customer-trace-catalog.json"); }

    private JsonNode read(String fileName) throws IOException {
        Path file = traceRoot.resolve(fileName).normalize();
        if (!file.startsWith(traceRoot) || !Files.isRegularFile(file)) return objectMapper.createObjectNode();
        return objectMapper.readTree(file.toFile());
    }

    private JsonNode findBy(JsonNode rows, String field, String value) {
        if (rows.isArray()) {
            for (JsonNode row : rows) if (value.equalsIgnoreCase(row.path(field).asText())) return row;
        }
        return objectMapper.createObjectNode();
    }

    public record ApprovalUpdateRequest(String useCaseId, String state, List<String> evidenceRefs, String comment) {}

    private String safe(String value) { return value == null ? "" : value.trim(); }
}
