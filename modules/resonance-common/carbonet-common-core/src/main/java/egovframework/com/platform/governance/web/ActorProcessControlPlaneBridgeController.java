package egovframework.com.platform.governance.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.platform.governance.service.ActorProcessGovernanceService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

import jakarta.annotation.PreDestroy;

@RestController
@RequestMapping("/api/internal/actor-process")
public class ActorProcessControlPlaneBridgeController {
    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper;
    private final ActorProcessGovernanceService governance;
    private final ExecutorService generationExecutor = Executors.newSingleThreadExecutor(runnable -> {
        Thread thread = new Thread(runnable, "actor-process-generation");
        thread.setDaemon(true);
        return thread;
    });
    private final String bridgeToken;

    public ActorProcessControlPlaneBridgeController(
            JdbcTemplate jdbc,
            ObjectMapper mapper,
            ActorProcessGovernanceService governance,
            @Value("${resonance.ops.token:}") String bridgeToken) {
        this.jdbc = jdbc;
        this.mapper = mapper;
        this.governance = governance;
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
                    generationExecutor.execute(() -> compilePromotedRelease(projectId, designVersion));
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

    @GetMapping("/dashboard")
    public ResponseEntity<?> dashboard(
            @RequestHeader(value = "X-Resonance-Token", defaultValue = "") String suppliedToken,
            @RequestParam(value = "dataset", defaultValue = "") String dataset) {
        if (!authorized(suppliedToken)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("success", false, "message", "Invalid control-plane bridge token."));
        }
        if (dataset.isBlank()) {
            return ResponseEntity.ok(governance.dashboard());
        }
        if (!dataset.matches("^[A-Za-z][A-Za-z0-9]*$")) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "Invalid dataset key."));
        }
        return ResponseEntity.ok(Map.of(dataset, governance.dashboardDataset(dataset)));
    }

    @PostMapping("/commands")
    public ResponseEntity<?> executeGovernanceCommand(
            @RequestHeader(value = "X-Resonance-Token", defaultValue = "") String suppliedToken,
            @RequestHeader(value = "X-Resonance-Actor", defaultValue = "BACKSTAGE_CONTROL_PLANE") String actor,
            @RequestBody Map<String, Object> body) {
        if (!authorized(suppliedToken)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("success", false, "message", "Invalid control-plane bridge token."));
        }
        try {
            String command = required(body, "command").toLowerCase();
            Object result;
            switch (command) {
                case "actor.save" -> {
                    governance.createActor(body);
                    result = Map.of("success", true, "command", command, "actorCode", required(body, "actorCode"));
                }
                case "process.save" -> {
                    governance.createProcess(body);
                    result = Map.of("success", true, "command", command, "processCode", required(body, "processCode"));
                }
                case "step.save" -> result = governance.addStep(body, actor);
                case "assignment.save" -> {
                    governance.assignActor(body);
                    result = Map.of("success", true, "command", command, "accountId", required(body, "accountId"));
                }
                case "case.save" -> {
                    governance.createCase(body);
                    result = Map.of("success", true, "command", command, "caseCode", required(body, "caseCode"));
                }
                case "artifact.save" -> {
                    governance.saveArtifact(body);
                    result = Map.of("success", true, "command", command, "artifactCode", required(body, "artifactCode"));
                }
                case "design.validate" ->
                        result = governance.validateProcessDesign(required(body, "processCode"), actor);
                case "design.graph" ->
                        result = governance.generateProfessionalDesignGraph(
                                String.valueOf(body.getOrDefault("processCode", "")), actor);
                case "development.plan" ->
                        result = governance.generateDevelopmentPlan(
                                required(body, "processCode"), required(body, "stepCode"), actor);
                case "development.preflight" ->
                        result = governance.runScreenDevelopmentPreflight(
                                required(body, "processCode"), required(body, "stepCode"), actor);
                case "backend.verify" ->
                        result = governance.verifyBackendProcessContracts(
                                String.valueOf(body.getOrDefault("sourceCommit", "")), actor);
                case "execution.start" -> result = governance.startProcessExecution(body, actor);
                case "standard.install" -> result = governance.installStandardPack();
                default -> {
                    return ResponseEntity.unprocessableEntity().body(Map.of(
                            "success", false,
                            "message", "Unsupported Actor Process command: " + command));
                }
            }
            return ResponseEntity.ok(result);
        } catch (Exception exception) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", exception.getMessage() == null ? "Actor Process command failed." : exception.getMessage()));
        }
    }

    @PostMapping("/control-assets/cutover")
    @Transactional
    public ResponseEntity<?> cutoverControlAssetMenus(
            @RequestHeader(value = "X-Resonance-Token", defaultValue = "") String suppliedToken,
            @RequestBody Map<String, Object> body) {
        if (!authorized(suppliedToken)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("success", false, "message", "Invalid control-plane bridge token."));
        }
        try {
            String projectId = required(body, "projectId").toUpperCase();
            String action = required(body, "action").toUpperCase();
            Object rawRoutes = body.get("sourceRoutes");
            if (!(rawRoutes instanceof List<?> routeValues) || routeValues.isEmpty()
                    || (!"RETIRE".equals(action) && !"RESTORE".equals(action))) {
                return ResponseEntity.unprocessableEntity().body(Map.of(
                        "success", false,
                        "message", "RETIRE or RESTORE with sourceRoutes is required."));
            }
            Set<String> routes = new LinkedHashSet<>();
            for (Object value : routeValues) {
                String route = String.valueOf(value == null ? "" : value).trim();
                if (!route.startsWith("/admin/")) {
                    throw new IllegalArgumentException("Only admin control-plane routes can be cut over.");
                }
                routes.add(route);
            }

            int changed = 0;
            int matched = 0;
            for (String route : routes) {
                List<Map<String, Object>> menus = jdbc.queryForList("""
                        select m.menu_code,
                               coalesce(m.use_at, 'Y') as menu_use_at,
                               coalesce(d.use_at, 'Y') as detail_use_at
                          from comtnmenuinfo m
                          left join comtccmmndetailcode d on d.code=m.menu_code
                         where m.menu_url=?
                            or ('/' || m.menu_url)=?
                        """, route, route);
                matched += menus.size();
                for (Map<String, Object> menu : menus) {
                    String menuCode = String.valueOf(menu.get("menu_code"));
                    if ("RETIRE".equals(action)) {
                        jdbc.update("""
                                insert into framework_control_plane_menu_cutover(
                                  menu_code,project_id,source_route,
                                  previous_menu_use_at,previous_detail_use_at,
                                  cutover_status,retired_at,updated_at
                                ) values(?,?,?,?,?,'RETIRED',current_timestamp,current_timestamp)
                                on conflict(menu_code) do update set
                                  project_id=excluded.project_id,
                                  source_route=excluded.source_route,
                                  cutover_status='RETIRED',
                                  retired_at=current_timestamp,
                                  restored_at=null,
                                  updated_at=current_timestamp
                                """, menuCode, projectId, route,
                                String.valueOf(menu.get("menu_use_at")),
                                String.valueOf(menu.get("detail_use_at")));
                        changed += jdbc.update(
                                "update comtnmenuinfo set use_at='N' where menu_code=? and coalesce(use_at,'Y')<>'N'",
                                menuCode);
                        jdbc.update("update comtccmmndetailcode set use_at='N' where code=?", menuCode);
                    } else {
                        List<Map<String, Object>> snapshots = jdbc.queryForList("""
                                select previous_menu_use_at,previous_detail_use_at
                                  from framework_control_plane_menu_cutover
                                 where menu_code=? and cutover_status='RETIRED'
                                """, menuCode);
                        if (snapshots.isEmpty()) {
                            continue;
                        }
                        Map<String, Object> snapshot = snapshots.get(0);
                        changed += jdbc.update(
                                "update comtnmenuinfo set use_at=? where menu_code=?",
                                String.valueOf(snapshot.get("previous_menu_use_at")), menuCode);
                        jdbc.update(
                                "update comtccmmndetailcode set use_at=? where code=?",
                                String.valueOf(snapshot.get("previous_detail_use_at")), menuCode);
                        jdbc.update("""
                                update framework_control_plane_menu_cutover
                                   set cutover_status='RESTORED',restored_at=current_timestamp,
                                       updated_at=current_timestamp
                                 where menu_code=?
                                """, menuCode);
                    }
                }
            }
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "projectId", projectId,
                    "action", action,
                    "routeCount", routes.size(),
                    "matchedMenus", matched,
                    "changedMenus", changed,
                    "reversible", true));
        } catch (Exception exception) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", exception.getMessage() == null
                            ? "Control-plane menu cutover failed." : exception.getMessage()));
        }
    }

    private void compilePromotedRelease(String projectId, int designVersion) {
        int claimed = jdbc.update("""
                update framework_actor_process_design_release
                   set release_status='RUNNING',received_at=current_timestamp
                 where project_id=? and design_version=?
                   and (
                     release_status='QUEUED'
                     or (
                       release_status='RUNNING'
                       and received_at < current_timestamp - interval '15 minutes'
                     )
                   )
                """, projectId, designVersion);
        if (claimed != 1) {
            return;
        }
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

    @Scheduled(
            fixedDelayString = "${resonance.actor-process.generation-recovery-delay-ms:60000}",
            initialDelayString = "${resonance.actor-process.generation-recovery-initial-delay-ms:60000}")
    public void recoverQueuedDesignGeneration() {
        List<Map<String, Object>> releases = jdbc.queryForList("""
                select project_id,design_version
                  from framework_actor_process_design_release
                 where release_status='QUEUED'
                    or (
                      release_status='RUNNING'
                      and received_at < current_timestamp - interval '15 minutes'
                    )
                 order by received_at
                 limit 10
                """);
        for (Map<String, Object> release : releases) {
            String projectId = String.valueOf(release.get("project_id"));
            int designVersion = ((Number) release.get("design_version")).intValue();
            generationExecutor.execute(() -> compilePromotedRelease(projectId, designVersion));
        }
    }

    @PreDestroy
    public void shutdownGenerationExecutor() {
        generationExecutor.shutdown();
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
