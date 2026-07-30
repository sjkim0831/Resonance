package egovframework.com.platform.governance.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.platform.governance.service.ActorProcessGovernanceService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.core.task.TaskExecutor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/internal/actor-process")
public class ActorProcessControlPlaneBridgeController {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final ActorProcessGovernanceService governance;
    private final TaskExecutor taskExecutor;
    private final String bridgeToken;

    public ActorProcessControlPlaneBridgeController(
            JdbcTemplate jdbc,
            ObjectMapper mapper,
            ActorProcessGovernanceService governance,
            @Qualifier("applicationTaskExecutor") TaskExecutor taskExecutor,
            @Value("${resonance.ops.token:}") String bridgeToken) {
        this.jdbc = jdbc;
        this.mapper = mapper;
        this.governance = governance;
        this.taskExecutor = taskExecutor;
        this.bridgeToken = bridgeToken;
    }

    @PostMapping("/design-releases")
    @Transactional
    public ResponseEntity<?> applyDesignRelease(
            @RequestHeader(value = "X-Resonance-Token", defaultValue = "") String suppliedToken,
            @RequestBody Map<String, Object> body) {
        if (!authorized(suppliedToken)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("success", false, "message", "Invalid control-plane bridge token."));
        }
        try {
            String projectId = required(body, "projectId").toUpperCase();
            int designVersion = Integer.parseInt(required(body, "designVersion"));
            String checksum = required(body, "contractSha256");
            Object contract = body.get("contract");
            if (designVersion < 1 || checksum.length() != 64 || !(contract instanceof Map<?, ?>)) {
                return ResponseEntity.unprocessableEntity().body(Map.of(
                        "success", false,
                        "message", "A versioned, hashed Backstage contract is required."));
            }

            String contractJson = mapper.writeValueAsString(contract);
            jdbc.update("""
                    insert into framework_actor_process_design_release(
                      project_id,design_version,contract_sha256,contract_payload,release_status
                    ) values(?,?,?,cast(? as jsonb),'PROMOTED')
                    on conflict(project_id,design_version) do update set
                      contract_sha256=excluded.contract_sha256,
                      contract_payload=excluded.contract_payload,
                      source_system='BACKSTAGE',
                      release_status='PROMOTED',
                      received_at=current_timestamp,
                      applied_at=null,
                      generation_result=null
                    """, projectId, designVersion, checksum, contractJson);

            jdbc.update("""
                    update framework_actor_process_design_release
                       set release_status='QUEUED',applied_at=null,
                           generation_result=cast(? as jsonb)
                     where project_id=? and design_version=?
                    """, mapper.writeValueAsString(Map.of(
                    "status", "QUEUED",
                    "maxScreens", 1000
            )), projectId, designVersion);

            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    taskExecutor.execute(() -> compilePromotedRelease(projectId, designVersion));
                }
            });

            Map<String, Object> response = new LinkedHashMap<>();
            response.put("success", true);
            response.put("projectId", projectId);
            response.put("designVersion", designVersion);
            response.put("sourceOfTruth", "BACKSTAGE");
            response.put("releaseStatus", "QUEUED");
            response.put("generation", Map.of("status", "QUEUED", "maxScreens", 1000));
            return ResponseEntity.ok(response);
        } catch (Exception exception) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", exception.getMessage() == null ? "Design release application failed." : exception.getMessage()));
        }
    }

    private void compilePromotedRelease(String projectId, int designVersion) {
        try {
            Map<String, Object> generation = governance.compileAndQueueScreens(
                    Map.of("processCode", "", "maxScreens", 1000),
                    "BACKSTAGE_CONTROL_PLANE");
            String releaseStatus = "REVIEW_REQUIRED".equals(generation.get("status"))
                    ? "REVIEW_REQUIRED" : "APPLIED";
            jdbc.update("""
                    update framework_actor_process_design_release
                       set release_status=?,applied_at=current_timestamp,
                           generation_result=cast(? as jsonb)
                     where project_id=? and design_version=?
                    """, releaseStatus, writeJson(generation), projectId, designVersion);
        } catch (Exception exception) {
            jdbc.update("""
                    update framework_actor_process_design_release
                       set release_status='FAILED',
                           generation_result=cast(? as jsonb)
                     where project_id=? and design_version=?
                    """, writeJson(Map.of(
                    "status", "FAILED",
                    "message", exception.getMessage() == null
                            ? "Design generation failed." : exception.getMessage()
            )), projectId, designVersion);
        }
    }

    private String writeJson(Object value) {
        try {
            return mapper.writeValueAsString(value);
        } catch (Exception exception) {
            return "{\"status\":\"FAILED\",\"message\":\"Result serialization failed.\"}";
        }
    }

    private boolean authorized(String suppliedToken) {
        if (bridgeToken == null || bridgeToken.isBlank() || suppliedToken == null || suppliedToken.isBlank()) {
            return false;
        }
        return MessageDigest.isEqual(
                bridgeToken.getBytes(StandardCharsets.UTF_8),
                suppliedToken.getBytes(StandardCharsets.UTF_8));
    }

    private static String required(Map<String, Object> body, String key) {
        String value = body.get(key) == null ? "" : String.valueOf(body.get(key)).trim();
        if (value.isEmpty()) {
            throw new IllegalArgumentException(key + " is required");
        }
        return value;
    }
}
