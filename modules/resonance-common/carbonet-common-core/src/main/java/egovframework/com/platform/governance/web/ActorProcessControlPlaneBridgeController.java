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
    private static final Map<String, String> DESIGN_DOCUMENT_TYPES = new LinkedHashMap<>();
    private static final Set<String> DESIGN_DOCUMENT_STATUSES =
            Set.of("DRAFT", "READY", "IN_REVIEW", "APPROVED", "VERIFIED");
    static {
        DESIGN_DOCUMENT_TYPES.put("REQUIREMENT", "업무·요구사항");
        DESIGN_DOCUMENT_TYPES.put("ACTOR_RACI", "액터·RACI");
        DESIGN_DOCUMENT_TYPES.put("AUTHORITY", "권한·데이터 범위");
        DESIGN_DOCUMENT_TYPES.put("PROCESS", "프로세스·분기");
        DESIGN_DOCUMENT_TYPES.put("STATE", "상태 전이");
        DESIGN_DOCUMENT_TYPES.put("NAVIGATION", "화면 흐름·라우트");
        DESIGN_DOCUMENT_TYPES.put("ACTIVE_UI", "액티브 UI·레이아웃");
        DESIGN_DOCUMENT_TYPES.put("DESIGN_ASSET", "테마·섹션·컴포넌트");
        DESIGN_DOCUMENT_TYPES.put("FIELD_DICTIONARY", "필드·데이터 사전");
        DESIGN_DOCUMENT_TYPES.put("DATA_HANDOFF", "입출력·데이터 인계");
        DESIGN_DOCUMENT_TYPES.put("DATABASE", "DB·스키마");
        DESIGN_DOCUMENT_TYPES.put("API", "API·이벤트");
        DESIGN_DOCUMENT_TYPES.put("BUSINESS_RULE", "업무 규칙·계산식");
        DESIGN_DOCUMENT_TYPES.put("VALIDATION", "검증·오류·예외");
        DESIGN_DOCUMENT_TYPES.put("NOTIFICATION", "알림·기한·에스컬레이션");
        DESIGN_DOCUMENT_TYPES.put("TEST", "테스트 시나리오·기대값");
        DESIGN_DOCUMENT_TYPES.put("TASK_EVIDENCE", "개발 태스크·산출물·증적");
        DESIGN_DOCUMENT_TYPES.put("RELEASE_AUDIT", "배포·감사·복구");
    }
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
            int importedSteps = importRequirementProcessContract((Map<?, ?>) contract);
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
            response.put("importedRequirementSteps", importedSteps);
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
            @RequestHeader(value = "X-Resonance-Account", defaultValue = "") String account,
            @RequestParam(value = "dataset", defaultValue = "") String dataset) {
        if (!authorized(suppliedToken)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("success", false, "message", "Invalid control-plane bridge token."));
        }
        if (dataset.isBlank()) {
            if (account.isBlank() || !governance.isControlPlaneAdministrator(account)) {
                return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                        "success", false,
                        "message", "Administrator authority is required for the unscoped dashboard."));
            }
            return ResponseEntity.ok(governance.dashboard());
        }
        if (!dataset.matches("^[A-Za-z][A-Za-z0-9]*$")) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", "Invalid dataset key."));
        }
        try {
            return ResponseEntity.ok(Map.of(dataset, governance.dashboardDataset(dataset, account)));
        } catch (SecurityException exception) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "success", false,
                    "message", exception.getMessage()));
        }
    }

    @PostMapping("/commands")
    public ResponseEntity<?> executeGovernanceCommand(
            @RequestHeader(value = "X-Resonance-Token", defaultValue = "") String suppliedToken,
            @RequestHeader(value = "X-Resonance-Actor", defaultValue = "BACKSTAGE_CONTROL_PLANE") String actor,
            @RequestHeader(value = "X-Resonance-Account", defaultValue = "") String account,
            @RequestBody Map<String, Object> body) {
        if (!authorized(suppliedToken)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("success", false, "message", "Invalid control-plane bridge token."));
        }
        try {
            if (account.isBlank()) {
                throw new SecurityException("Authenticated control-plane account is required.");
            }
            body = new LinkedHashMap<>(body);
            body.put("requestingAccount", account);
            String command = required(body, "command").toLowerCase();
            Object result;
            switch (command) {
                case "actor.save" -> {
                    if (!governance.isControlPlaneAdministrator(account)) {
                        throw new SecurityException("Administrator authority is required to save an actor definition.");
                    }
                    governance.createActor(body);
                    result = Map.of("success", true, "command", command, "actorCode", required(body, "actorCode"));
                }
                case "process.save" -> {
                    if (!governance.isControlPlaneAdministrator(account)) {
                        throw new SecurityException("Administrator authority is required to save a process definition.");
                    }
                    governance.createProcess(body);
                    result = Map.of("success", true, "command", command, "processCode", required(body, "processCode"));
                }
                case "step.save" -> {
                    if (!governance.isControlPlaneAdministrator(account)) {
                        throw new SecurityException("Administrator authority is required to save a process step.");
                    }
                    result = governance.addStep(body, actor);
                }
                case "screen.bind-archetype" -> {
                    if (!governance.isControlPlaneAdministrator(account)) {
                        throw new SecurityException("Administrator authority is required to bind a screen flow.");
                    }
                    result = governance.bindScreenProcessArchetype(body, actor);
                }
                case "screen.contract.save" -> {
                    if (!governance.isControlPlaneAdministrator(account)) {
                        throw new SecurityException("Administrator authority is required to save a screen data contract.");
                    }
                    result = governance.saveProfessionalScreenContract(body, actor);
                }
                case "screen.design.generate" ->
                        result = governance.saveDesignAndGenerate(body, actor);
                case "assignment.save" -> {
                    if (!governance.isControlPlaneAdministrator(account)) {
                        throw new SecurityException("Administrator authority is required to save an actor assignment.");
                    }
                    governance.assignActor(body);
                    result = Map.of("success", true, "command", command, "accountId", required(body, "accountId"));
                }
                case "assignment.deactivate" -> {
                    if (!governance.isControlPlaneAdministrator(account)) {
                        throw new SecurityException("Administrator authority is required to deactivate an actor assignment.");
                    }
                    result = governance.deactivateActorAssignment(body);
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
                case "development.execute" -> {
                    if (!governance.isControlPlaneAdministrator(account)) {
                        throw new SecurityException("Administrator authority is required to execute the development pipeline.");
                    }
                    result = governance.executeDevelopmentPipeline(body, actor);
                }
                case "development.retry" -> {
                    if (!governance.isControlPlaneAdministrator(account)) {
                        throw new SecurityException("Administrator authority is required to retry development work.");
                    }
                    result = governance.retryDevelopmentJob(
                            Long.parseLong(required(body, "jobId")), actor);
                }
                case "development.rollback.request" -> {
                    if (!governance.isControlPlaneAdministrator(account)) {
                        throw new SecurityException("Administrator authority is required to request rollback.");
                    }
                    result = governance.requestDevelopmentRollback(
                            Long.parseLong(required(body, "jobId")),
                            String.valueOf(body.getOrDefault("reason", "")), actor);
                }
                case "development.rollback.approve" -> {
                    if (!governance.isControlPlaneAdministrator(account)) {
                        throw new SecurityException("Administrator authority is required to approve rollback.");
                    }
                    result = governance.approveDevelopmentRollback(
                            Long.parseLong(required(body, "rollbackRequestId")), actor);
                }
                case "backend.verify" ->
                        result = governance.verifyBackendProcessContracts(
                                String.valueOf(body.getOrDefault("sourceCommit", "")), actor);
                case "project-delivery.e2e" -> {
                    if (!governance.isControlPlaneAdministrator(account)) {
                        throw new SecurityException("Administrator authority is required to run project delivery E2E.");
                    }
                    result = governance.verifyProjectDeliveryBlueprintE2E(actor);
                }
                case "execution.start" -> result = governance.startProcessExecution(body, actor);
                case "execution.validate" -> result =
                        governance.validateProcessCommandFromControlPlane(
                                java.util.UUID.fromString(required(body, "executionId")), body, actor);
                case "execution.advance" -> result =
                        governance.advanceProcessCommandFromControlPlane(
                                java.util.UUID.fromString(required(body, "executionId")), body, actor);
                case "standard.install" -> result = governance.installStandardPack();
                default -> {
                    return ResponseEntity.unprocessableEntity().body(Map.of(
                            "success", false,
                            "message", "Unsupported Actor Process command: " + command));
                }
            }
            return ResponseEntity.ok(result);
        } catch (SecurityException exception) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of(
                    "success", false,
                    "message", exception.getMessage() == null
                            ? "Actor or project assignment is required."
                            : exception.getMessage()));
        } catch (Exception exception) {
            return ResponseEntity.badRequest().body(Map.of(
                    "success", false,
                    "message", exception.getMessage() == null ? "Actor Process command failed." : exception.getMessage()));
        }
    }

    @GetMapping("/design-documents")
    public ResponseEntity<?> designDocuments(
            @RequestHeader(value = "X-Resonance-Token", defaultValue = "") String suppliedToken,
            @RequestParam String processCode,
            @RequestParam(defaultValue = "") String stepCode,
            @RequestParam(defaultValue = "") String routePath) {
        if (!authorized(suppliedToken)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("success", false, "message", "Invalid control-plane bridge token."));
        }
        List<Map<String, Object>> saved = jdbc.queryForList("""
                select document_id as "documentId",document_type as "documentType",
                       title,content,status,revision,updated_by as "updatedBy",
                       updated_at as "updatedAt"
                  from integrated_design_document
                 where process_code=? and step_code=? and route_path=? and active_yn='Y'
                """, processCode, stepCode, routePath);
        Map<String, Map<String, Object>> byType = new LinkedHashMap<>();
        saved.forEach(row -> byType.put(String.valueOf(row.get("documentType")), row));
        List<Map<String, Object>> documents = DESIGN_DOCUMENT_TYPES.entrySet().stream().map(entry -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("documentType", entry.getKey());
            row.put("title", entry.getValue());
            row.put("content", "");
            row.put("status", "DRAFT");
            row.put("revision", 0);
            row.putAll(byType.getOrDefault(entry.getKey(), Map.of()));
            return row;
        }).toList();
        long ready = documents.stream()
                .filter(row -> Set.of("READY", "APPROVED", "VERIFIED").contains(row.get("status")))
                .count();
        return ResponseEntity.ok(Map.of(
                "processCode", processCode,
                "stepCode", stepCode,
                "routePath", routePath,
                "documents", documents,
                "total", DESIGN_DOCUMENT_TYPES.size(),
                "ready", ready));
    }

    @PostMapping("/design-documents")
    @Transactional
    public ResponseEntity<?> saveDesignDocument(
            @RequestHeader(value = "X-Resonance-Token", defaultValue = "") String suppliedToken,
            @RequestHeader(value = "X-Resonance-Actor", defaultValue = "BACKSTAGE_CONTROL_PLANE") String actor,
            @RequestBody Map<String, Object> body) {
        if (!authorized(suppliedToken)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("success", false, "message", "Invalid control-plane bridge token."));
        }
        String processCode = required(body, "processCode");
        String stepCode = String.valueOf(body.getOrDefault("stepCode", "")).trim();
        String routePath = String.valueOf(body.getOrDefault("routePath", "")).trim();
        String documentType = required(body, "documentType").toUpperCase();
        if (!DESIGN_DOCUMENT_TYPES.containsKey(documentType)) {
            return ResponseEntity.unprocessableEntity().body(Map.of(
                    "success", false, "message", "Unsupported design document type."));
        }
        String title = String.valueOf(body.getOrDefault(
                "title", DESIGN_DOCUMENT_TYPES.get(documentType))).trim();
        String status = String.valueOf(body.getOrDefault("status", "DRAFT")).trim().toUpperCase();
        if (!DESIGN_DOCUMENT_STATUSES.contains(status)) {
            status = "DRAFT";
        }
        jdbc.update("""
                insert into integrated_design_document(
                  process_code,step_code,route_path,document_type,title,content,status,updated_by)
                values(?,?,?,?,?,?,?,?)
                on conflict(process_code,step_code,route_path,document_type) do update set
                  title=excluded.title,content=excluded.content,status=excluded.status,
                  active_yn='Y',updated_by=excluded.updated_by
                """, processCode, stepCode, routePath, documentType, title,
                String.valueOf(body.getOrDefault("content", "")), status, actor);
        Long revision = jdbc.queryForObject("""
                select revision from integrated_design_document
                 where process_code=? and step_code=? and route_path=? and document_type=?
                """, Long.class, processCode, stepCode, routePath, documentType);
        return ResponseEntity.ok(Map.of(
                "success", true,
                "documentType", documentType,
                "revision", revision == null ? 0 : revision));
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

    private int importRequirementProcessContract(Map<?, ?> contract) {
        Object sourceValue = contract.get("source");
        if (!(sourceValue instanceof Map<?, ?> source)
                || !"REQUIREMENT_DOCUMENT".equals(String.valueOf(source.get("type")))) {
            return 0;
        }
        Object processValue = contract.get("process");
        if (!(processValue instanceof Map<?, ?> process)) {
            throw new IllegalArgumentException("Requirement process contract is missing.");
        }
        String processCode = requiredRaw(process, "processCode").toUpperCase();
        Object stepsValue = process.get("steps");
        if (!(stepsValue instanceof List<?> steps) || steps.isEmpty() || steps.size() > 1000) {
            throw new IllegalArgumentException("Requirement process must contain 1-1000 steps.");
        }
        governance.saveWorkType(new LinkedHashMap<>(Map.of(
                "workTypeCode", "REQUIREMENT_AUTOMATION",
                "workTypeName", "요구분석 자동 개발",
                "workTypeNameEn", "Requirement Automation",
                "description", "요구분석서에서 검증된 실행 설계와 개발 작업",
                "sortOrder", 5,
                "useAt", "N")));
        LinkedHashSet<String> actorCodes = new LinkedHashSet<>();
        for (Object stepValue : steps) {
            if (!(stepValue instanceof Map<?, ?> step)) {
                throw new IllegalArgumentException("Requirement step must be an object.");
            }
            actorCodes.add(requiredRaw(step, "actorCode").toUpperCase());
        }
        for (String actorCode : actorCodes) {
            governance.createActor(new LinkedHashMap<>(Map.of(
                    "actorCode", actorCode,
                    "actorName", actorCode,
                    "actorNameEn", actorCode,
                    "actorType", actorCode.contains("ADMIN") ? "ADMIN" : "BUSINESS",
                    "purpose", "요구분석서 기반 " + actorCode + " 업무 수행",
                    "capabilityCodes", "REQUIREMENT_AUTOMATION",
                    "delegationAllowed", false,
                    "useAt", "Y")));
        }
        String ownerActor = actorCodes.iterator().next();
        governance.createProcess(new LinkedHashMap<>(Map.ofEntries(
                Map.entry("processCode", processCode),
                Map.entry("processName", processCode + " 요구분석 실행"),
                Map.entry("domainCode", "DATA_GOVERNANCE"),
                Map.entry("version", "1.0.0"),
                Map.entry("goal", "업로드된 요구분석서를 실행 가능한 화면·API·데이터 계약으로 완성"),
                Map.entry("startCondition", "검증된 요구분석서와 프로젝트가 존재"),
                Map.entry("completionCondition", "모든 단계 구현·계약 테스트·DB 재조회 검증 완료"),
                Map.entry("automationMode", "AUTOMATED"),
                Map.entry("processStatus", "DEVELOPMENT_READY"),
                Map.entry("lifecycleStatus", "VALIDATED"),
                Map.entry("ownerActorCode", ownerActor),
                Map.entry("riskLevel", "MEDIUM"),
                Map.entry("developmentOrder", 1))));
        int order = 0;
        for (Object stepValue : steps) {
            Map<?, ?> step = (Map<?, ?>) stepValue;
            order++;
            String stepCode = requiredRaw(step, "stepCode").toUpperCase();
            String actorCode = requiredRaw(step, "actorCode").toUpperCase();
            String fromState = order == 1 ? "DRAFT" : "STEP_" + (order - 1) + "_COMPLETED";
            String toState = order == steps.size() ? "COMPLETED" : "STEP_" + order + "_COMPLETED";
            String routePath = requiredRaw(step, "routePath");
            Object endpointValue = step.get("endpoint");
            String apiContract = endpointValue instanceof Map<?, ?> endpoint
                    ? writeJson(endpoint) : "{}";
            Object fieldValue = step.get("fields");
            String inputContract = fieldValue instanceof List<?> fields
                    ? writeJson(Map.of("fields", fields)) : "{}";
            String requirement = requiredRaw(step, "description");
            LinkedHashMap<String, Object> stepRequest = new LinkedHashMap<>();
            stepRequest.put("processCode", processCode);
            stepRequest.put("stepCode", stepCode);
            stepRequest.put("stepOrder", order);
            stepRequest.put("stepName", requiredRaw(step, "screenName"));
            stepRequest.put("stepType", "TASK");
            stepRequest.put("actorCode", actorCode);
            stepRequest.put("fromState", fromState);
            stepRequest.put("commandCode", "EXECUTE_" + stepCode);
            stepRequest.put("toState", toState);
            stepRequest.put("completionRule", "필수 필드, 권한, DB 재조회, 증적 검증을 통과한다.");
            stepRequest.put("requirementText", requirement);
            stepRequest.put("inputContract", inputContract);
            stepRequest.put("outputContract", writeJson(Map.of(
                    "projectId", "string", "processCode", processCode,
                    "stepCode", stepCode, "statusCode", toState, "rowVersion", "integer")));
            stepRequest.put("requiresUserPage", !actorCode.contains("ADMIN"));
            stepRequest.put("requiresAdminPage", actorCode.contains("ADMIN"));
            stepRequest.put("requiresApi", true);
            stepRequest.put("requiresDatabase", true);
            stepRequest.put("requiresNotification", true);
            stepRequest.put(actorCode.contains("ADMIN") ? "adminPath" : "userPath", routePath);
            stepRequest.put("apiContract", apiContract);
            stepRequest.put("evidenceRequired", true);
            stepRequest.put("evidenceTypes", "REQUEST,RESPONSE,DB_REREAD,E2E,ROLLBACK");
            stepRequest.put("rollbackCommandCode", "ROLLBACK_" + stepCode);
            governance.addStep(stepRequest, "BACKSTAGE_REQUIREMENT_AUTOMATION");
        }
        int safetyScenarioTypes = governance.ensureGeneratedProcessSafetyCases(processCode);
        if (safetyScenarioTypes < 5) {
            throw new IllegalStateException("Requirement process safety harness is incomplete: " + processCode);
        }
        int readyDesignContracts = governance.ensureGeneratedProcessDesignContracts(
                processCode, "BACKSTAGE_REQUIREMENT_AUTOMATION");
        if (readyDesignContracts < steps.size()) {
            throw new IllegalStateException("Requirement screen design contracts are incomplete: " + processCode);
        }
        int pageDesigns = governance.ensureGeneratedProcessPageDesigns(
                processCode, "BACKSTAGE_REQUIREMENT_AUTOMATION");
        if (pageDesigns < steps.size()) {
            throw new IllegalStateException("Requirement page and field designs are incomplete: " + processCode);
        }
        return order;
    }

    private static String requiredRaw(Map<?, ?> body, String key) {
        Object value = body.get(key);
        String text = value == null ? "" : String.valueOf(value).trim();
        if (text.isEmpty()) throw new IllegalArgumentException(key + " is required");
        return text;
    }

    @Scheduled(
            fixedDelayString = "${resonance.actor-process.generation-recovery-delay-ms:60000}",
            initialDelayString = "${resonance.actor-process.generation-recovery-initial-delay-ms:2000}")
    public void recoverQueuedDesignGeneration() {
        jdbc.update("update framework_business_work_type set use_at='N',updated_at=current_timestamp where work_type_code='REQUIREMENT_AUTOMATION'");
        List<String> requirementProcesses = jdbc.queryForList("""
                select process_code from framework_process_definition
                 where left(process_code,4)='REQ_'
                 order by process_code
                """, String.class);
        for (String processCode : requirementProcesses) {
            governance.ensureGeneratedProcessSafetyCases(processCode);
            governance.ensureGeneratedProcessDesignContracts(processCode, "REQUIREMENT_SELF_HEALER");
            governance.ensureGeneratedProcessPageDesigns(processCode, "REQUIREMENT_SELF_HEALER");
        }
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
