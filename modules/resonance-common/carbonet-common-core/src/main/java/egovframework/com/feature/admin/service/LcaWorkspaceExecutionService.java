package egovframework.com.feature.admin.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class LcaWorkspaceExecutionService {
    private static final Set<String> PROCESS_CODES = Set.of(
            "LCA_OPERATION", "LCA_PROJECT", "LCA_PROJECT_MANAGEMENT", "LCA_PRODUCT_PROCESS",
            "LCA_DATA_COLLECTION", "LCA_REVIEW_APPROVAL", "LCA_DATASET_IMPORT", "LCA_MATERIAL_MAPPING",
            "LCA_LCI_CLASSIFICATION", "LCA_LCI_DATABASE", "LCA_ALLOCATION", "LCA_SCOPE",
            "LCA_CALCULATION_RESULT", "LCA_IMPACT_ASSESSMENT", "LCA_RESULT_CONFIRMATION",
            "LCA_REPORT_GENERATION", "LCA_REPORT_TEMPLATE", "LCA_REPORT_VERIFICATION", "LCA_SURVEY_DATA");
    private static final Map<String, Set<String>> TRANSITIONS = Map.of(
            "DRAFT", Set.of("VALIDATED"),
            "VALIDATED", Set.of("DRAFT", "SUBMITTED"),
            "SUBMITTED", Set.of("APPROVED", "REJECTED"),
            "REJECTED", Set.of("DRAFT"),
            "APPROVED", Set.of());
    private static final Map<String, List<String>> PROCESS_ACTORS = Map.ofEntries(
            Map.entry("LCA_OPERATION", List.of("LCA_PROGRAM_MANAGER", "LCA_SPECIALIST", "LCA_APPROVER")),
            Map.entry("LCA_PROJECT", List.of("LCA_PROJECT_OWNER", "LCA_SPECIALIST", "LCA_APPROVER")),
            Map.entry("LCA_PROJECT_MANAGEMENT", List.of("LCA_SPECIALIST", "LCA_METHOD_REVIEWER", "LCA_APPROVER")),
            Map.entry("LCA_PRODUCT_PROCESS", List.of("LCA_PROCESS_MODELER", "SITE_DATA_OWNER", "LCA_METHOD_REVIEWER")),
            Map.entry("LCA_DATA_COLLECTION", List.of("LCA_SPECIALIST", "SITE_DATA_OWNER", "LCA_DATA_REVIEWER")),
            Map.entry("LCA_REVIEW_APPROVAL", List.of("LCA_DATA_REVIEWER", "LCA_METHOD_REVIEWER", "LCA_APPROVER")),
            Map.entry("LCA_DATASET_IMPORT", List.of("SITE_DATA_OWNER", "LCA_DATA_STEWARD", "LCA_DATA_REVIEWER")),
            Map.entry("LCA_MATERIAL_MAPPING", List.of("LCA_DATA_STEWARD", "LCA_SPECIALIST", "LCA_METHOD_REVIEWER")),
            Map.entry("LCA_LCI_CLASSIFICATION", List.of("LCA_SPECIALIST", "LCA_METHOD_REVIEWER", "LCA_APPROVER")),
            Map.entry("LCA_LCI_DATABASE", List.of("LCA_DATA_STEWARD", "LCA_METHOD_REVIEWER", "LCA_APPROVER")),
            Map.entry("LCA_ALLOCATION", List.of("LCA_SPECIALIST", "FINANCE_DATA_OWNER", "LCA_METHOD_REVIEWER")),
            Map.entry("LCA_SCOPE", List.of("LCA_PROJECT_OWNER", "LCA_SPECIALIST", "LCA_METHOD_REVIEWER")),
            Map.entry("LCA_CALCULATION_RESULT", List.of("LCA_SPECIALIST", "LCA_METHOD_REVIEWER", "LCA_APPROVER")),
            Map.entry("LCA_IMPACT_ASSESSMENT", List.of("LCA_SPECIALIST", "LCA_METHOD_REVIEWER", "LCA_APPROVER")),
            Map.entry("LCA_RESULT_CONFIRMATION", List.of("LCA_SPECIALIST", "LCA_CRITICAL_REVIEWER", "LCA_APPROVER")),
            Map.entry("LCA_REPORT_GENERATION", List.of("LCA_REPORT_AUTHOR", "LCA_SPECIALIST", "LCA_APPROVER")),
            Map.entry("LCA_REPORT_TEMPLATE", List.of("LCA_REPORT_AUTHOR", "DESIGN_SYSTEM_MANAGER", "LCA_APPROVER")),
            Map.entry("LCA_REPORT_VERIFICATION", List.of("REPORT_VERIFIER", "LCA_SPECIALIST", "AUDIT_MANAGER")),
            Map.entry("LCA_SURVEY_DATA", List.of("SITE_DATA_OWNER", "LCA_DATA_STEWARD", "LCA_SPECIALIST")));

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;

    public Map<String, Object> list(String processCode) {
        String process = requireProcess(processCode);
        List<Map<String, Object>> records = jdbc.queryForList("""
                select workspace_id as "workspaceId",process_code as "processCode",business_key as "businessKey",
                       payload_json as "payload",workflow_status as "workflowStatus",assigned_actor as "assignedActor",
                       version,created_by as "createdBy",updated_by as "updatedBy",created_at as "createdAt",updated_at as "updatedAt"
                  from framework_lca_workspace_record
                 where process_code=? order by updated_at desc limit 100
                """, process);
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("processCode", process);
        out.put("records", records);
        out.put("count", records.size());
        return out;
    }

    @Transactional
    public Map<String, Object> save(String processCode, Map<String, Object> body, String actor) {
        String process = requireProcess(processCode);
        String businessKey = requireText(body, "businessKey", 160);
        String assignedActor = requireText(body, "assignedActor", 80);
        String expectedActor = PROCESS_ACTORS.get(process).get(0);
        if (!expectedActor.equals(assignedActor)) throw new IllegalArgumentException("assignedActor must match the process owner: " + expectedActor);
        Object rawPayload = body == null ? null : body.get("payload");
        if (!(rawPayload instanceof Map<?, ?>)) throw new IllegalArgumentException("payload must be a JSON object");
        String payload = writeJson(rawPayload);
        String user = requireActor(actor);
        assertAuthority(user, expectedActor);
        UUID id = jdbc.queryForObject("""
                insert into framework_lca_workspace_record(process_code,business_key,payload_json,assigned_actor,created_by,updated_by)
                values(?,?,?::jsonb,?,?,?)
                on conflict(process_code,business_key) do update
                  set payload_json=excluded.payload_json,assigned_actor=excluded.assigned_actor,updated_by=excluded.updated_by,
                      version=framework_lca_workspace_record.version+1,updated_at=current_timestamp
                returning workspace_id
                """, UUID.class, process, businessKey, payload, assignedActor, user, user);
        return find(id);
    }

    @Transactional
    public Map<String, Object> command(String processCode, UUID workspaceId, Map<String, Object> body, String actor) {
        String process = requireProcess(processCode);
        String command = requireText(body, "command", 24).toUpperCase(Locale.ROOT);
        String target = switch (command) {
            case "VALIDATE" -> "VALIDATED";
            case "REOPEN" -> "DRAFT";
            case "SUBMIT" -> "SUBMITTED";
            case "APPROVE" -> "APPROVED";
            case "REJECT" -> "REJECTED";
            default -> throw new IllegalArgumentException("unsupported command: " + command);
        };
        Map<String, Object> current = find(workspaceId);
        if (!process.equals(current.get("processCode"))) throw new IllegalArgumentException("workspace process mismatch");
        String from = String.valueOf(current.get("workflowStatus"));
        if (!TRANSITIONS.getOrDefault(from, Set.of()).contains(target)) {
            throw new IllegalArgumentException("invalid LCA workflow transition: " + from + " -> " + target);
        }
        String user = requireActor(actor);
        List<String> actorRelay = PROCESS_ACTORS.get(process);
        String requiredActor = switch (command) {
            case "VALIDATE" -> actorRelay.get(1);
            case "APPROVE", "REJECT" -> actorRelay.get(2);
            default -> actorRelay.get(0);
        };
        assertAuthority(user, requiredActor);
        if (!"webmaster".equalsIgnoreCase(user)) {
            String creator = String.valueOf(current.get("createdBy"));
            if (("VALIDATE".equals(command) || "APPROVE".equals(command) || "REJECT".equals(command))
                    && user.equalsIgnoreCase(creator)) {
                throw new SecurityException("LCA segregation of duties forbids self review or approval");
            }
            if (("APPROVE".equals(command) || "REJECT".equals(command))) {
                Integer prior = jdbc.queryForObject("""
                        select count(*) from framework_lca_workspace_event
                         where workspace_id=? and command_code='VALIDATE' and lower(executed_by)=lower(?)
                        """, Integer.class, workspaceId, user);
                if (prior != null && prior > 0) throw new SecurityException("validator cannot approve the same LCA workspace");
            }
        }
        int changed = jdbc.update("""
                update framework_lca_workspace_record
                   set workflow_status=?,updated_by=?,version=version+1,updated_at=current_timestamp
                 where workspace_id=? and process_code=? and workflow_status=?
                """, target, user, workspaceId, process, from);
        if (changed != 1) throw new IllegalStateException("LCA workspace changed concurrently");
        Object evidenceObject = body == null ? null : body.get("evidence");
        String evidence = writeJson(evidenceObject instanceof Map<?, ?> ? evidenceObject : Map.of());
        jdbc.update("""
                insert into framework_lca_workspace_event(workspace_id,process_code,command_code,from_status,to_status,evidence_json,executed_by)
                values(?,?,?,?,?,?::jsonb,?)
                """, workspaceId, process, command, from, target, evidence, user);
        return find(workspaceId);
    }

    private Map<String, Object> find(UUID id) {
        return jdbc.queryForMap("""
                select workspace_id as "workspaceId",process_code as "processCode",business_key as "businessKey",
                       payload_json as "payload",workflow_status as "workflowStatus",assigned_actor as "assignedActor",
                       version,created_by as "createdBy",updated_by as "updatedBy",created_at as "createdAt",updated_at as "updatedAt"
                  from framework_lca_workspace_record where workspace_id=?
                """, id);
    }

    private static String requireProcess(String value) {
        String process = value == null ? "" : value.trim().toUpperCase(Locale.ROOT);
        if (!PROCESS_CODES.contains(process)) throw new IllegalArgumentException("unsupported LCA process code");
        return process;
    }

    private static String requireActor(String value) {
        String actor = value == null ? "" : value.trim();
        if (actor.isEmpty()) throw new SecurityException("authenticated actor is required");
        return actor;
    }

    private void assertAuthority(String accountId, String actorCode) {
        if ("webmaster".equalsIgnoreCase(accountId)) return;
        Integer count = jdbc.queryForObject("""
                select count(*) from framework_account_actor_assignment
                 where lower(account_id)=lower(?) and actor_code=? and assignment_status='ACTIVE'
                   and valid_from<=current_date and (valid_until is null or valid_until>=current_date)
                """, Integer.class, accountId, actorCode);
        if (count == null || count < 1) throw new SecurityException("required LCA actor is not assigned: " + actorCode);
    }

    private static String requireText(Map<String, Object> body, String key, int max) {
        String value = body == null || body.get(key) == null ? "" : String.valueOf(body.get(key)).trim();
        if (value.isEmpty() || value.length() > max) throw new IllegalArgumentException(key + " is required");
        return value;
    }

    private String writeJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("invalid JSON payload", e);
        }
    }
}
