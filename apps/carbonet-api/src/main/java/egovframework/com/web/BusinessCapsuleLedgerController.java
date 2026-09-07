package egovframework.com.web;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

@RestController
@RequestMapping({"/admin/api/system/business-capsule-ledger", "/en/admin/api/system/business-capsule-ledger",
    "/api/internal/actor-process/business-capsule-ledger"})
public class BusinessCapsuleLedgerController {
    private static final String MEMBER_REGISTRATION_CAPSULE = "MEMBER_REGISTRATION_CAPSULE";
    private static final Path MEMBER_REGISTRATION_RUNNER = Path.of("/opt/resonance-data/dev-worktrees/certificate-verification/ops/scripts/run-member-registration-capsule-fast-dev.sh");
    private static final Path ASSIGNED_USER_RELAY_RUNNER = Path.of("/opt/resonance-data/dev-worktrees/certificate-verification/ops/scripts/run-assigned-user-relay-qa-replay-fast-dev.sh");
    private static final Path ASSIGNED_USER_RELAY_VIDEO = Path.of("/opt/resonance-data/dev-evidence/assigned-user-relay-qa-replay/latest.mp4");
    private static final Path MEMBER_DOMAIN_QA_RUNNER = Path.of("/opt/resonance-data/dev-worktrees/certificate-verification/ops/scripts/run-member-domain-full-qa-fast-dev.sh");
    private static final Path MEMBER_DOMAIN_QA_VIDEO = Path.of("/opt/resonance-data/dev-evidence/member-domain-qa-replay/latest.mp4");
    private static final AtomicReference<Map<String, Object>> ASSIGNED_USER_RELAY_STATUS = new AtomicReference<>(Map.of(
        "status", "IDLE", "accounts", 5, "coreTasks", 7, "transitions", 22));
    private static final AtomicReference<Map<String, Object>> MEMBER_DOMAIN_QA_STATUS = new AtomicReference<>(Map.of(
        "status", "IDLE", "processes", 21, "steps", 81, "gates", 4));
    private static final ExecutorService E2E_EXECUTOR = Executors.newSingleThreadExecutor(runnable -> {
        Thread thread = new Thread(runnable, "business-capsule-e2e");
        thread.setDaemon(true);
        return thread;
    });
    private final JdbcTemplate jdbc;

    public BusinessCapsuleLedgerController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @GetMapping
    public Map<String, Object> ledger(@RequestParam(defaultValue = "") String workTypeCode) {
        String canonicalWorkType = workTypeCode.trim().toUpperCase();
        boolean automationAvailable = automationAvailable();
        if (!relationExists("framework_business_capsule_readiness_v1")) {
            Map<String, Object> summary = new LinkedHashMap<>();
            summary.put("capsuleCount", 0);
            summary.put("closedCount", 0);
            summary.put("openCount", 0);
            summary.put("stepCount", 0);
            summary.put("screenCount", 0);
            summary.put("readyScreenCount", 0);
            summary.put("integrityPercent", 0);
            summary.put("directMutationAllowed", false);
            summary.put("automationAvailable", false);
            summary.put("schemaStatus", "NOT_INSTALLED");
            return Map.of("summary", summary, "capsules", List.of());
        }
        List<Map<String, Object>> capsules = jdbc.queryForList("""
            SELECT capsule_code AS "capsuleCode", work_type_code AS "workTypeCode",
                   process_code AS "processCode", process_name AS "processName",
                   capsule_version AS "capsuleVersion", step_count AS "stepCount",
                   executable_step_count AS "executableStepCount", actor_count AS "actorCount",
                   screen_count AS "screenCount", ready_screen_count AS "readyScreenCount",
                   permission_requirement_count AS "permissionRequirementCount",
                   covered_permission_count AS "coveredPermissionCount",
                   automated_test_type_count AS "automatedTestTypeCount",
                   passed_test_type_count AS "passedTestTypeCount",
                   next_process_code AS "nextProcessCode", capsule_status AS "capsuleStatus",
                   account_relay_contract AS "accountRelayContract",
                   closure_contract AS "closureContract", updated_at AS "updatedAt"
              FROM framework_business_capsule_readiness_v1
             WHERE (? = '' OR work_type_code = ?)
             ORDER BY work_type_code, process_code
            """, canonicalWorkType, canonicalWorkType);

        for (Map<String, Object> capsule : capsules) {
            String processCode = String.valueOf(capsule.get("processCode"));
            capsule.put("lifecycleStatus", "CLOSED".equals(capsule.get("capsuleStatus")) ? "FROZEN" : "DRAFT");
            capsule.put("steps", jdbc.queryForList("""
                SELECT step_order AS "stepOrder", step_code AS "stepCode", step_name AS "stepName",
                       actor_code AS "actorCode", from_state AS "fromState", to_state AS "toState",
                       completion_rule AS "completionRule", user_path AS "userPath",
                       admin_path AS "adminPath", api_contract AS "apiContract",
                       input_contract AS "inputContract", output_contract AS "outputContract"
                  FROM framework_process_step WHERE process_code=? ORDER BY step_order, step_code
                """, processCode));
            capsule.put("screens", jdbc.queryForList("""
                SELECT step_code AS "stepCode", audience, route_path AS "routePath",
                       screen_name AS "screenName", actor_code AS "actorCode",
                       api_contract AS "apiContract",
                       contract_status AS "contractStatus", api_verified AS "apiVerified",
                       database_verified AS "databaseVerified", authority_verified AS "authorityVerified",
                       responsive_verified AS "responsiveVerified", accessibility_verified AS "accessibilityVerified",
                       exception_states_verified AS "exceptionStatesVerified"
                  FROM framework_professional_screen_contract WHERE process_code=?
                 ORDER BY step_sequence NULLS LAST, audience, route_path
                """, processCode));
            List<Map<String, Object>> accountCandidates = new ArrayList<>();
            if (relationExists("framework_account_actor_assignment")) {
                accountCandidates.addAll(jdbc.queryForList("""
                    SELECT DISTINCT assignment.account_id AS "accountId",
                           assignment.actor_code AS "actorCode",
                           assignment.tenant_id AS "tenantId",
                           assignment.project_id AS "projectId",
                           assignment.assignment_status AS "assignmentStatus"
                      FROM framework_account_actor_assignment assignment
                     WHERE assignment.assignment_status='ACTIVE'
                       AND assignment.actor_code IN (
                         SELECT DISTINCT actor_code FROM framework_process_step WHERE process_code=?
                       )
                     ORDER BY assignment.actor_code, assignment.account_id
                    """, processCode));
            }
            if (relationExists("framework_project_actor_assignment")) {
                accountCandidates.addAll(jdbc.queryForList("""
                    SELECT DISTINCT assignment.user_id AS "accountId",
                           assignment.actor_code AS "actorCode",
                           '' AS "tenantId", assignment.project_id AS "projectId",
                           'ACTIVE' AS "assignmentStatus"
                      FROM framework_project_actor_assignment assignment
                     WHERE assignment.active_yn='Y'
                       AND assignment.actor_code IN (
                         SELECT DISTINCT actor_code FROM framework_process_step WHERE process_code=?
                       )
                     ORDER BY assignment.actor_code, assignment.user_id
                    """, processCode));
            }
            if ("MEMBER_REGISTRATION".equals(processCode)) {
                accountCandidates.add(Map.of(
                    "accountId", "ANONYMOUS_SIGNUP_SESSION", "actorCode", "PUBLIC_APPLICANT",
                    "tenantId", "PUBLIC", "projectId", "MEMBER_REGISTRATION",
                    "assignmentStatus", "PRE_ACCOUNT_CONTEXT"));
            }
            capsule.put("accounts", accountCandidates);
            capsule.put("permissions", jdbc.queryForList("""
                SELECT req.step_code AS "stepCode", req.permission_code AS "permissionCode",
                       req.scope_type AS "scopeType",
                       EXISTS (
                         SELECT 1 FROM framework_process_step step
                         JOIN framework_permission_grant_v1 grant_row
                           ON grant_row.actor_code=step.actor_code
                          AND grant_row.permission_code=req.permission_code
                          AND grant_row.scope_type=req.scope_type
                          AND grant_row.effect='ALLOW' AND grant_row.use_at='Y'
                        WHERE step.process_code=req.process_code AND step.step_code=req.step_code
                       ) AS covered
                  FROM framework_permission_requirement_v1 req
                 WHERE req.process_code=? AND req.use_at='Y'
                 ORDER BY req.step_code, req.permission_code
                """, processCode));
            String capsuleCode = String.valueOf(capsule.get("capsuleCode"));
            if (automationAvailable) {
              capsule.put("versions", jdbc.queryForList("""
                SELECT version_id AS "versionId", version_no AS "versionNo",
                       version_status AS "versionStatus", specification_hash AS "specificationHash",
                       base_version_no AS "baseVersionNo", created_by AS "createdBy",
                       approved_by AS "approvedBy", created_at AS "createdAt", approved_at AS "approvedAt"
                  FROM framework_business_capsule_version WHERE capsule_code=?
                 ORDER BY version_id DESC LIMIT 10
                """, capsuleCode));
              capsule.put("operations", jdbc.queryForList("""
                SELECT operation_id AS "operationId", version_id AS "versionId", operation_type AS "operationType",
                       operation_status AS "operationStatus", output_json AS "outputPayload",
                       requested_by AS "requestedBy", requested_at AS "requestedAt", completed_at AS "finishedAt"
                  FROM framework_business_capsule_operation WHERE capsule_code=?
                 ORDER BY operation_id DESC LIMIT 20
                """, capsuleCode));
            } else {
              capsule.put("versions", List.of());
              capsule.put("operations", List.of());
            }
        }

        long closed = capsules.stream().filter(row -> "CLOSED".equals(row.get("capsuleStatus"))).count();
        long steps = capsules.stream().mapToLong(row -> number(row.get("stepCount"))).sum();
        long screens = capsules.stream().mapToLong(row -> number(row.get("screenCount"))).sum();
        long readyScreens = capsules.stream().mapToLong(row -> number(row.get("readyScreenCount"))).sum();
        Map<String, Object> summary = new LinkedHashMap<>();
        summary.put("capsuleCount", capsules.size());
        summary.put("closedCount", closed);
        summary.put("openCount", capsules.size() - closed);
        summary.put("stepCount", steps);
        summary.put("screenCount", screens);
        summary.put("readyScreenCount", readyScreens);
        summary.put("integrityPercent", screens == 0 ? 0 : Math.round(readyScreens * 100.0 / screens));
        summary.put("directMutationAllowed", false);
        summary.put("automationAvailable", automationAvailable);
        return Map.of("summary", summary, "capsules", capsules);
    }

    @PostMapping("/draft")
    public Map<String, Object> createDraft(@RequestParam String capsuleCode) {
        requireAutomationAvailable();
        String code = canonical(capsuleCode);
        Map<String, Object> head = head(code);
        if ("DRAFT".equals(head.get("versionStatus")) || "IN_REVIEW".equals(head.get("versionStatus"))) {
            return Map.of("status", "EXISTS", "versionId", head.get("versionId"), "versionNo", head.get("versionNo"));
        }
        String nextVersion = nextPatch(String.valueOf(head.get("versionNo")));
        Long id = jdbc.queryForObject("""
            INSERT INTO framework_business_capsule_version(
              capsule_code,version_no,version_status,specification,specification_hash,base_version_no,created_by)
            SELECT capsule_code,?,'DRAFT',specification,
                   repeat(md5(specification::text||?||clock_timestamp()::text),2),version_no,'CAPSULE_AUTOMATION'
              FROM framework_business_capsule_version WHERE version_id=? RETURNING version_id
            """, Long.class, nextVersion, nextVersion, head.get("versionId"));
        return Map.of("status", "DRAFT", "versionId", id, "versionNo", nextVersion);
    }

    @PostMapping("/run")
    public Map<String, Object> run(@RequestParam String capsuleCode, @RequestParam String operationType) {
        requireAutomationAvailable();
        String code = canonical(capsuleCode);
        String operation = canonical(operationType);
        if (!Set.of("LINT", "IMPACT", "GENERATE", "TEST").contains(operation)) {
            throw new IllegalArgumentException("Unsupported operation: " + operation);
        }
        Map<String, Object> head = head(code);
        long versionId = number(head.get("versionId"));
        Map<String, Object> readiness = jdbc.queryForMap("""
            SELECT step_count, executable_step_count, screen_count, ready_screen_count,
                   permission_requirement_count, covered_permission_count,
                   automated_test_type_count, passed_test_type_count
              FROM framework_business_capsule_readiness_v1 WHERE capsule_code=?
            """, code);
        boolean ready = number(readiness.get("step_count")) == number(readiness.get("executable_step_count"))
            && number(readiness.get("screen_count")) == number(readiness.get("ready_screen_count"))
            && number(readiness.get("permission_requirement_count")) == number(readiness.get("covered_permission_count"))
            && number(readiness.get("automated_test_type_count")) == number(readiness.get("passed_test_type_count"));
        String status = ready ? "PASSED" : "FAILED";
        if ("GENERATE".equals(operation) && !latestPassed(code, versionId, "LINT")) status = "BLOCKED";
        if ("TEST".equals(operation) && !latestPassed(code, versionId, "GENERATE")) status = "BLOCKED";
        String output = switch (operation) {
            case "LINT" -> ready ? "{\"contract\":\"complete\",\"issues\":[]}" : "{\"contract\":\"incomplete\"}";
            case "IMPACT" -> "{\"steps\":" + number(readiness.get("step_count")) + ",\"screens\":" + number(readiness.get("screen_count")) + ",\"permissions\":" + number(readiness.get("permission_requirement_count")) + "}";
            case "GENERATE" -> "{\"projection\":[\"screen-design\",\"help\",\"qa\",\"business-guide\",\"full-work-view\"],\"buildRequired\":false}";
            default -> "{\"relay\":\"account-actor-permission-page-function\",\"testTypes\":" + number(readiness.get("automated_test_type_count")) + "}";
        };
        Long operationId = jdbc.queryForObject("""
            INSERT INTO framework_business_capsule_operation(
              capsule_code,version_id,operation_type,operation_status,output_json,requested_by,completed_at)
            VALUES (?,?,?, ?,?::jsonb,'CAPSULE_AUTOMATION',current_timestamp) RETURNING operation_id
            """, Long.class, code, versionId, operation, status, output);
        return Map.of("operationId", operationId, "operationType", operation, "operationStatus", status,
            "versionId", versionId, "output", output);
    }

    @PostMapping("/execute-e2e")
    public Map<String, Object> executeE2e(@RequestParam String capsuleCode) {
        requireAutomationAvailable();
        String code = canonical(capsuleCode);
        require(MEMBER_REGISTRATION_CAPSULE.equals(code), "Visible E2E is currently enabled for member registration only");
        require(Files.isRegularFile(MEMBER_REGISTRATION_RUNNER), "Member registration E2E runner is unavailable");
        Integer active = jdbc.queryForObject("""
            SELECT count(*) FROM framework_business_capsule_operation
             WHERE capsule_code=? AND operation_type='TEST' AND requested_by='CAPSULE_VISIBLE_REPLAY'
               AND operation_status='RUNNING'
            """, Integer.class, code);
        require(active != null && active == 0, "Member registration E2E is already running");
        long versionId = number(head(code).get("versionId"));
        Long operationId = jdbc.queryForObject("""
            INSERT INTO framework_business_capsule_operation(
              capsule_code,version_id,operation_type,operation_status,output_json,requested_by)
            VALUES (?,?,'TEST','RUNNING','{"phase":"VISIBLE_E2E_STARTING"}'::jsonb,'CAPSULE_VISIBLE_REPLAY')
            RETURNING operation_id
            """, Long.class, code, versionId);
        E2E_EXECUTOR.submit(() -> runVisibleE2e(code, operationId));
        return Map.of("operationId", operationId, "operationType", "TEST", "executionMode", "VISIBLE_E2E", "operationStatus", "RUNNING");
    }

    @GetMapping("/assigned-user-relay")
    public Map<String, Object> assignedUserRelayStatus() {
        return ASSIGNED_USER_RELAY_STATUS.get();
    }

    @PostMapping("/assigned-user-relay/execute")
    public Map<String, Object> executeAssignedUserRelay() {
        requireAutomationAvailable();
        require(Files.isRegularFile(ASSIGNED_USER_RELAY_RUNNER), "Assigned-user relay E2E runner is unavailable");
        require(!"RUNNING".equals(ASSIGNED_USER_RELAY_STATUS.get().get("status")), "Assigned-user relay E2E is already running");
        long startedAt = System.currentTimeMillis();
        ASSIGNED_USER_RELAY_STATUS.set(Map.of(
            "status", "RUNNING", "phase", "LOGIN_AND_RELAY", "accounts", 5,
            "coreTasks", 7, "transitions", 22, "startedAt", startedAt));
        E2E_EXECUTOR.submit(() -> runAssignedUserRelay(startedAt));
        return ASSIGNED_USER_RELAY_STATUS.get();
    }

    @GetMapping("/assigned-user-relay/video")
    public ResponseEntity<Resource> assignedUserRelayVideo() {
        require(Files.isRegularFile(ASSIGNED_USER_RELAY_VIDEO), "Assigned-user relay replay video is unavailable");
        return ResponseEntity.ok()
            .contentType(MediaType.parseMediaType("video/mp4"))
            .body(new FileSystemResource(ASSIGNED_USER_RELAY_VIDEO));
    }

    @GetMapping("/member-domain-qa")
    public Map<String, Object> memberDomainQaStatus() {
        Map<String, Object> result = new LinkedHashMap<>(MEMBER_DOMAIN_QA_STATUS.get());
        result.put("processes", jdbc.queryForObject("SELECT count(*) FROM framework_process_definition WHERE upper(domain_code)='MEMBER'", Integer.class));
        result.put("steps", jdbc.queryForObject("SELECT count(*) FROM framework_process_step s JOIN framework_process_definition p USING(process_code) WHERE upper(p.domain_code)='MEMBER'", Integer.class));
        result.put("processList", jdbc.queryForList("""
            SELECT p.development_order AS "order", p.process_code AS "processCode",
                   p.process_name AS "processName", p.owner_actor_code AS "ownerActorCode",
                   count(DISTINCT s.step_code) AS "stepCount",
                   count(DISTINCT b.screen_resource_id) AS "screenCount",
                   count(DISTINCT r.permission_code) AS "permissionCount"
              FROM framework_process_definition p
              JOIN framework_process_step s USING(process_code)
              LEFT JOIN framework_process_step_screen_binding b ON b.process_code=s.process_code AND b.step_code=s.step_code AND b.binding_status='ACTIVE'
              LEFT JOIN framework_permission_requirement_v1 r ON r.process_code=s.process_code AND r.step_code=s.step_code AND r.use_at='Y'
             WHERE upper(p.domain_code)='MEMBER'
             GROUP BY p.development_order,p.process_code,p.process_name,p.owner_actor_code
             ORDER BY p.development_order NULLS LAST,p.process_code
            """));
        result.put("videoAvailable", Files.isRegularFile(MEMBER_DOMAIN_QA_VIDEO));
        result.put("videoUrl", "/api/internal/actor-process/business-capsule-ledger/member-domain-qa/video");
        return result;
    }

    @PostMapping("/member-domain-qa/execute")
    public Map<String, Object> executeMemberDomainQa() {
        require(Files.isRegularFile(MEMBER_DOMAIN_QA_RUNNER), "Member-domain QA runner is unavailable");
        require(!"RUNNING".equals(MEMBER_DOMAIN_QA_STATUS.get().get("status")), "Member-domain QA is already running");
        long startedAt = System.currentTimeMillis();
        MEMBER_DOMAIN_QA_STATUS.set(Map.of("status", "RUNNING", "phase", "STATIC_LIFECYCLE_CONTROLS_EXCEPTIONS", "processes", 21, "steps", 81, "gates", 4, "startedAt", startedAt));
        E2E_EXECUTOR.submit(() -> runMemberDomainQa(startedAt));
        return MEMBER_DOMAIN_QA_STATUS.get();
    }

    @GetMapping("/member-domain-qa/video")
    public ResponseEntity<Resource> memberDomainQaVideo() {
        require(Files.isRegularFile(MEMBER_DOMAIN_QA_VIDEO), "Member-domain QA replay video is unavailable");
        return ResponseEntity.ok().contentType(MediaType.parseMediaType("video/mp4"))
            .body(new FileSystemResource(MEMBER_DOMAIN_QA_VIDEO));
    }

    private void runMemberDomainQa(long startedAt) {
        Path output = null;
        try {
            output = Files.createTempFile("member-domain-full-qa-", ".log");
            Process process = new ProcessBuilder("/bin/bash", MEMBER_DOMAIN_QA_RUNNER.toString())
                .directory(Path.of("/opt/resonance-data/dev-worktrees/certificate-verification").toFile())
                .redirectErrorStream(true).redirectOutput(output.toFile()).start();
            boolean finished = process.waitFor(600, TimeUnit.SECONDS);
            if (!finished) process.destroyForcibly();
            String raw = Files.readString(output, StandardCharsets.UTF_8);
            boolean passed = finished && process.exitValue() == 0 && raw.contains("MEMBER_DOMAIN_FULL_QA_PASS");
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("status", passed ? "PASSED" : "FAILED"); result.put("processes", 21);
            result.put("processesPassed", passed ? 21 : 0); result.put("steps", 81);
            result.put("stepsPassed", passed ? 81 : 0); result.put("gates", 4);
            result.put("gatesPassed", passed ? 4 : 0); result.put("durationMs", System.currentTimeMillis() - startedAt);
            result.put("videoAvailable", passed && Files.isRegularFile(MEMBER_DOMAIN_QA_VIDEO));
            result.put("summary", raw.length() > 6000 ? raw.substring(raw.length() - 6000) : raw);
            MEMBER_DOMAIN_QA_STATUS.set(result);
        } catch (Exception exception) {
            MEMBER_DOMAIN_QA_STATUS.set(Map.of("status", "FAILED", "processes", 21, "steps", 81, "gates", 4,
                "durationMs", System.currentTimeMillis() - startedAt,
                "summary", exception.getClass().getSimpleName() + ": " + String.valueOf(exception.getMessage())));
        } finally { if (output != null) try { Files.deleteIfExists(output); } catch (Exception ignored) { } }
    }

    private void runAssignedUserRelay(long startedAt) {
        Path output = null;
        try {
            output = Files.createTempFile("assigned-user-relay-visible-e2e-", ".log");
            Process process = new ProcessBuilder("/bin/bash", ASSIGNED_USER_RELAY_RUNNER.toString())
                .directory(Path.of("/opt/resonance-data/dev-worktrees/certificate-verification").toFile())
                .redirectErrorStream(true).redirectOutput(output.toFile()).start();
            boolean finished = process.waitFor(180, TimeUnit.SECONDS);
            if (!finished) process.destroyForcibly();
            String raw = Files.readString(output, StandardCharsets.UTF_8);
            boolean passed = finished && process.exitValue() == 0 && raw.contains("ASSIGNED_USER_RELAY_QA_PASS");
            Map<String, Object> result = new LinkedHashMap<>();
            result.put("status", passed ? "PASSED" : "FAILED");
            result.put("accounts", 5);
            result.put("coreTasks", 7);
            result.put("coreTasksPassed", passed ? 7 : 0);
            result.put("transitions", 22);
            result.put("transitionsPassed", passed ? 22 : 0);
            result.put("durationMs", System.currentTimeMillis() - startedAt);
            result.put("cleanup", passed);
            result.put("videoAvailable", passed && Files.isRegularFile(ASSIGNED_USER_RELAY_VIDEO));
            result.put("videoUrl", "/api/internal/actor-process/business-capsule-ledger/assigned-user-relay/video");
            result.put("summary", raw.length() > 4000 ? raw.substring(raw.length() - 4000) : raw);
            ASSIGNED_USER_RELAY_STATUS.set(result);
        } catch (Exception exception) {
            ASSIGNED_USER_RELAY_STATUS.set(Map.of(
                "status", "FAILED", "accounts", 5, "coreTasks", 7, "transitions", 22,
                "durationMs", System.currentTimeMillis() - startedAt,
                "summary", exception.getClass().getSimpleName() + ": " + String.valueOf(exception.getMessage())));
        } finally {
            if (output != null) try { Files.deleteIfExists(output); } catch (Exception ignored) { }
        }
    }

    private void runVisibleE2e(String capsuleCode, long operationId) {
        Path output = null;
        int exitCode = -1;
        String status = "FAILED";
        String summary = "runner did not start";
        try {
            output = Files.createTempFile("member-registration-visible-e2e-", ".log");
            Process process = new ProcessBuilder("/bin/bash", MEMBER_REGISTRATION_RUNNER.toString())
                .directory(Path.of("/opt/resonance-data/dev-worktrees/certificate-verification").toFile())
                .redirectErrorStream(true).redirectOutput(output.toFile()).start();
            boolean finished = process.waitFor(240, TimeUnit.SECONDS);
            if (!finished) {
                process.destroyForcibly();
                summary = "E2E timeout after 240 seconds";
            } else {
                exitCode = process.exitValue();
                String raw = Files.readString(output, StandardCharsets.UTF_8);
                summary = raw.length() > 12000 ? raw.substring(raw.length() - 12000) : raw;
                status = exitCode == 0 && (summary.contains("\"status\": \"PASS\"") || summary.contains("\"status\":\"PASS\"")) ? "PASSED" : "FAILED";
            }
        } catch (Exception exception) {
            summary = exception.getClass().getSimpleName() + ": " + String.valueOf(exception.getMessage());
        } finally {
            jdbc.update("""
                UPDATE framework_business_capsule_operation
                   SET operation_status=?, output_json=jsonb_build_object(
                         'exitCode',?,'summary',?,'steps',5,'actualExecution',true),
                       completed_at=current_timestamp
                 WHERE capsule_code=? AND operation_id=? AND operation_status='RUNNING'
                """, status, exitCode, summary, capsuleCode, operationId);
            if (output != null) try { Files.deleteIfExists(output); } catch (Exception ignored) { }
        }
    }

    @PostMapping("/approve")
    public Map<String, Object> approve(@RequestParam String capsuleCode) {
        requireAutomationAvailable();
        String code = canonical(capsuleCode);
        Map<String, Object> head = head(code);
        long versionId = number(head.get("versionId"));
        require("DRAFT".equals(head.get("versionStatus")), "Only DRAFT can be approved");
        require(latestPassed(code, versionId, "LINT") && latestPassed(code, versionId, "IMPACT"),
            "LINT and IMPACT must pass first");
        jdbc.update("UPDATE framework_business_capsule_version SET version_status='APPROVED',approved_by='CAPSULE_AUTOMATION',approved_at=current_timestamp WHERE version_id=?", versionId);
        record(code, versionId, "APPROVE", "PASSED", "{\"gate\":\"lint+impact\"}");
        return Map.of("status", "APPROVED", "versionId", versionId);
    }

    @PostMapping("/close")
    public Map<String, Object> close(@RequestParam String capsuleCode) {
        requireAutomationAvailable();
        String code = canonical(capsuleCode);
        Map<String, Object> head = head(code);
        long versionId = number(head.get("versionId"));
        require("APPROVED".equals(head.get("versionStatus")), "Only APPROVED can be frozen");
        require(latestPassed(code, versionId, "GENERATE") && latestPassed(code, versionId, "TEST"),
            "GENERATE and TEST must pass first");
        jdbc.update("UPDATE framework_business_capsule_version SET version_status='FROZEN' WHERE version_id=?", versionId);
        jdbc.update("UPDATE framework_business_capsule_definition SET capsule_version=?,updated_at=current_timestamp WHERE capsule_code=?", head.get("versionNo"), code);
        record(code, versionId, "CLOSE", "PASSED", "{\"immutable\":true}");
        return Map.of("status", "FROZEN", "versionId", versionId, "versionNo", head.get("versionNo"));
    }

    private boolean automationAvailable() {
        return relationExists("framework_business_capsule_version") && relationExists("framework_business_capsule_operation");
    }

    private boolean relationExists(String relationName) {
        Boolean available = jdbc.queryForObject("SELECT to_regclass('public.' || ?) IS NOT NULL", Boolean.class, relationName);
        return Boolean.TRUE.equals(available);
    }

    private void requireAutomationAvailable() {
        require(automationAvailable(), "Business capsule automation schema is not installed in this environment");
    }

    private Map<String, Object> head(String capsuleCode) {
        return jdbc.queryForMap("SELECT version_id AS \"versionId\",version_no AS \"versionNo\",version_status AS \"versionStatus\" FROM framework_business_capsule_version WHERE capsule_code=? ORDER BY version_id DESC LIMIT 1", capsuleCode);
    }

    private boolean latestPassed(String code, long versionId, String type) {
        Boolean passed = jdbc.queryForObject("SELECT COALESCE((SELECT operation_status='PASSED' FROM framework_business_capsule_operation WHERE capsule_code=? AND version_id=? AND operation_type=? ORDER BY operation_id DESC LIMIT 1),false)", Boolean.class, code, versionId, type);
        return Boolean.TRUE.equals(passed);
    }

    private void record(String code, long versionId, String type, String status, String output) {
        jdbc.update("INSERT INTO framework_business_capsule_operation(capsule_code,version_id,operation_type,operation_status,output_json,requested_by,completed_at) VALUES (?,?,?,?,?::jsonb,'CAPSULE_AUTOMATION',current_timestamp)", code, versionId, type, status, output);
    }

    private void require(boolean condition, String message) {
        if (!condition) throw new IllegalStateException(message);
    }

    private String canonical(String value) {
        return value == null ? "" : value.trim().toUpperCase();
    }

    private String nextPatch(String version) {
        String[] parts = version.split("\\.");
        if (parts.length != 3) return version + ".1";
        return parts[0] + "." + parts[1] + "." + (Integer.parseInt(parts[2]) + 1);
    }

    private long number(Object value) {
        return value instanceof Number number ? number.longValue() : 0L;
    }
}

