package egovframework.com.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.annotation.PostConstruct;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.sql.Timestamp;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class CustomerTraceApprovalLedgerService {

    private static final Map<String, Set<String>> TRANSITIONS = Map.of(
            "PENDING", Set.of("IN_REVIEW", "REJECTED"),
            "IN_REVIEW", Set.of("PENDING", "APPROVED", "REJECTED"),
            "APPROVED", Set.of("IN_REVIEW", "VERIFIED"),
            "REJECTED", Set.of("IN_REVIEW"),
            "VERIFIED", Set.of("IN_REVIEW"));

    private final JdbcTemplate jdbcTemplate;
    private final ObjectMapper objectMapper;
    private final Path traceRoot;

    public CustomerTraceApprovalLedgerService(
            JdbcTemplate jdbcTemplate,
            ObjectMapper objectMapper,
            @Value("${CARBONET_BACKEND_METADATA_FS_OVERRIDE_PATH:/app/backend-metadata}") String backendMetadataRoot) {
        this.jdbcTemplate = jdbcTemplate;
        this.objectMapper = objectMapper;
        this.traceRoot = Path.of(backendMetadataRoot).normalize().resolve("customer-trace").normalize();
    }

    @PostConstruct
    public void importBaselineWhenEmpty() throws IOException {
        Path source = traceRoot.resolve("customer-approval-ledger.json");
        if (!Files.isRegularFile(source) || !tableExists()) return;
        JsonNode entries = objectMapper.readTree(source.toFile()).path("entries");
        if (!entries.isArray()) return;
        for (JsonNode row : entries) {
            jdbcTemplate.update("""
                    INSERT INTO carbonet_customer_trace_approval
                    (use_case_id, trace_id, title, domain_name, approval_state, reviewer_id, reviewed_at,
                     evidence_refs, review_comment, source_version)
                    VALUES (?, ?, ?, ?, ?, ?, ?, CAST(? AS jsonb), ?, ?)
                    ON CONFLICT (use_case_id) DO NOTHING
                    """,
                    row.path("useCaseId").asText(), row.path("traceId").asText(), row.path("title").asText(),
                    row.path("domain").asText(), row.path("state").asText("PENDING"), nullable(row, "reviewer"),
                    timestamp(row, "reviewedAt"), row.path("evidenceRefs").toString(), row.path("comment").asText(""),
                    "customer-trace-baseline");
        }
        exportSnapshot();
    }

    public boolean tableExists() {
        Boolean exists = jdbcTemplate.queryForObject("SELECT to_regclass('carbonet_customer_trace_approval') IS NOT NULL", Boolean.class);
        return Boolean.TRUE.equals(exists);
    }

    public Map<String, Integer> stateSummary() {
        Map<String, Integer> summary = new LinkedHashMap<>();
        TRANSITIONS.keySet().stream().sorted().forEach(state -> summary.put(state, 0));
        if (!tableExists()) return summary;
        for (Map<String, Object> row : jdbcTemplate.queryForList(
                "SELECT approval_state, count(*) AS state_count FROM carbonet_customer_trace_approval GROUP BY approval_state")) {
            summary.put(String.valueOf(row.get("approval_state")), ((Number) row.get("state_count")).intValue());
        }
        return summary;
    }

    public Map<String, Object> ledger() {
        List<Map<String, Object>> entries = tableExists() ? jdbcTemplate.query(
                "SELECT * FROM carbonet_customer_trace_approval ORDER BY use_case_id", (resultSet, rowNum) -> mapRow(resultSet)) : List.of();
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("schemaVersion", 1);
        response.put("generatedAt", OffsetDateTime.now().toString());
        response.put("entryCount", entries.size());
        response.put("stateSummary", stateSummary());
        response.put("policy", Map.of("automaticApproval", false, "approvalRequiresReviewer", true, "verificationRequiresEvidence", true));
        response.put("entries", entries);
        return response;
    }

    public Map<String, Object> find(String useCaseId) {
        if (!tableExists()) return Map.of();
        List<Map<String, Object>> rows = jdbcTemplate.query("SELECT * FROM carbonet_customer_trace_approval WHERE use_case_id = ?",
                (resultSet, rowNum) -> mapRow(resultSet), useCaseId);
        return rows.isEmpty() ? Map.of() : rows.getFirst();
    }

    @Transactional
    public Map<String, Object> update(String useCaseId, String requestedState, List<String> evidenceRefs, String comment, String reviewer) {
        String nextState = requestedState.trim().toUpperCase(Locale.ROOT);
        Map<String, Object> current = jdbcTemplate.queryForMap(
                "SELECT approval_state, row_version FROM carbonet_customer_trace_approval WHERE use_case_id = ? FOR UPDATE", useCaseId);
        String currentState = String.valueOf(current.get("approval_state"));
        if (!TRANSITIONS.getOrDefault(currentState, Set.of()).contains(nextState)) {
            throw new IllegalArgumentException("Invalid approval transition: " + currentState + " -> " + nextState);
        }
        List<String> cleanEvidence = evidenceRefs == null ? List.of() : evidenceRefs.stream().map(String::trim).filter(value -> !value.isEmpty()).distinct().toList();
        if ("VERIFIED".equals(nextState) && cleanEvidence.isEmpty()) throw new IllegalArgumentException("VERIFIED requires evidenceRefs.");
        try {
            String evidenceJson = objectMapper.writeValueAsString(cleanEvidence);
            int updated = jdbcTemplate.update("""
                    UPDATE carbonet_customer_trace_approval
                    SET approval_state = ?, reviewer_id = ?, reviewed_at = now(), evidence_refs = CAST(? AS jsonb), review_comment = ?
                    WHERE use_case_id = ? AND row_version = ?
                    """, nextState, reviewer, evidenceJson, comment == null ? "" : comment.trim(), useCaseId, current.get("row_version"));
            if (updated != 1) throw new IllegalStateException("Approval row changed concurrently.");
        } catch (com.fasterxml.jackson.core.JsonProcessingException error) {
            throw new IllegalArgumentException("Invalid evidence references.", error);
        }
        return find(useCaseId);
    }

    public void exportSnapshot() throws IOException {
        if (!tableExists()) return;
        Files.createDirectories(traceRoot);
        Path target = traceRoot.resolve("customer-approval-ledger.json");
        Path temporary = Files.createTempFile(traceRoot, "customer-approval-ledger", ".tmp");
        objectMapper.writerWithDefaultPrettyPrinter().writeValue(temporary.toFile(), ledger());
        try {
            Files.move(temporary, target, StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
        } catch (java.nio.file.AtomicMoveNotSupportedException ignored) {
            Files.move(temporary, target, StandardCopyOption.REPLACE_EXISTING);
        }
    }

    private Map<String, Object> mapRow(java.sql.ResultSet resultSet) throws java.sql.SQLException {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("useCaseId", resultSet.getString("use_case_id"));
        row.put("traceId", resultSet.getString("trace_id"));
        row.put("title", resultSet.getString("title"));
        row.put("domain", resultSet.getString("domain_name"));
        row.put("state", resultSet.getString("approval_state"));
        row.put("reviewer", resultSet.getString("reviewer_id"));
        row.put("reviewedAt", resultSet.getObject("reviewed_at") == null ? null : resultSet.getObject("reviewed_at").toString());
        row.put("evidenceRefs", parseEvidence(resultSet.getString("evidence_refs")));
        row.put("comment", resultSet.getString("review_comment"));
        row.put("rowVersion", resultSet.getLong("row_version"));
        row.put("automaticApproval", false);
        return row;
    }

    private List<String> parseEvidence(String json) {
        try { return objectMapper.readValue(json, new TypeReference<>() {}); }
        catch (IOException ignored) { return new ArrayList<>(); }
    }

    private String nullable(JsonNode row, String field) { return row.path(field).isNull() || row.path(field).isMissingNode() ? null : row.path(field).asText(); }
    private Timestamp timestamp(JsonNode row, String field) { String value = nullable(row, field); return value == null || value.isBlank() ? null : Timestamp.from(OffsetDateTime.parse(value).toInstant()); }
}
