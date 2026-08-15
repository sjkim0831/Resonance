package egovframework.com.platform.governance.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
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
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
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
            Object rawDesignVersion=body.get("designVersion");
            if(!(rawDesignVersion instanceof Number versionNumber)
                    ||versionNumber.longValue()<1L
                    ||versionNumber.longValue()>Integer.MAX_VALUE
                    ||versionNumber.doubleValue()!=versionNumber.longValue()){
                return ResponseEntity.unprocessableEntity().body(Map.of(
                        "success", false,
                        "message", "designVersion must be a positive 32-bit integer."));
            }
            int designVersion = versionNumber.intValue();
            String checksum = required(body, "contractSha256");
            Object contract = body.get("contract");
            if (!checksum.matches("^[0-9a-f]{64}$")
                    || !(contract instanceof Map<?, ?>)) {
                return ResponseEntity.unprocessableEntity().body(Map.of(
                        "success", false,
                        "message", "A versioned, hashed Backstage contract is required."));
            }

            String contractJson = mapper.writer()
                    .with(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS)
                    .writeValueAsString(contract);
            String actualChecksum = sha256(contractJson);
            if (!MessageDigest.isEqual(checksum.getBytes(StandardCharsets.US_ASCII),
                    actualChecksum.getBytes(StandardCharsets.US_ASCII))) {
                return ResponseEntity.unprocessableEntity().body(Map.of(
                        "success", false,
                        "message", "contractSha256 does not match the canonical contract payload."));
            }
            Map<String,Object> validatedContract=validateRequirementProcessContract(
                    (Map<?,?>)contract,projectId,designVersion);
            jdbc.query("select pg_advisory_xact_lock(hashtextextended('BACKSTAGE_DESIGN_RELEASE_V1:'||?,0))",
                    row->{},projectId);
            String latestReleaseJson=jdbc.queryForObject("""
                    select coalesce((
                      select jsonb_build_object(
                        'designVersion',design_version,'contractSha256',contract_sha256,
                        'releaseStatus',release_status,'generationResult',generation_result)
                        from framework_actor_process_design_release
                       where project_id=? order by design_version desc limit 1 for update
                    ),'{}'::jsonb)::text
                    """,String.class,projectId);
            Map<String,Object> latest=latestReleaseJson==null||latestReleaseJson.isBlank()
                    ?Map.of():mapper.readValue(latestReleaseJson,
                        new com.fasterxml.jackson.core.type.TypeReference<LinkedHashMap<String,Object>>(){});
            if(!latest.isEmpty()){
                int latestVersion=((Number)latest.get("designVersion")).intValue();
                String latestChecksum=String.valueOf(latest.get("contractSha256"));
                if(designVersion<latestVersion||designVersion==latestVersion
                        &&!checksum.equals(latestChecksum)){
                    return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of(
                            "success",false,"projectId",projectId,
                            "designVersion",designVersion,"currentDesignVersion",latestVersion,
                            "message","Design release version is stale or conflicts with the immutable project head."));
                }
                if(designVersion==latestVersion){
                    Map<String,Object> response=new LinkedHashMap<>();
                    response.put("success",true);response.put("idempotent",true);
                    response.put("projectId",projectId);response.put("designVersion",designVersion);
                    response.put("sourceOfTruth","BACKSTAGE");
                    response.put("releaseStatus",String.valueOf(latest.get("releaseStatus")));
                    response.put("applicationStatus",String.valueOf(latest.get("releaseStatus")));
                    response.put("generation",latest.get("generationResult"));
                    response.put("importedRequirementSteps",0);
                    return ResponseEntity.ok(response);
                }
            }
            Map<String,Object> requirementImport =
                    importRequirementProcessContract(validatedContract,projectId,designVersion);
            int importedSteps = ((Number) requirementImport.getOrDefault(
                    "importedSteps", 0)).intValue();
            Object publication = requirementImport.getOrDefault(
                    "publication", Map.of("status", "QUEUED"));
            boolean requirementRelease=Boolean.TRUE.equals(
                    requirementImport.get("requirementRelease"));
            java.util.SortedMap<String,Map<String,Object>> expectedProcessReceipts=
                    requirementRelease?requirementExpectedProcessReceipts(publication):
                    new java.util.TreeMap<>();
            java.util.SortedMap<String,String> expectedProcessHeads=new java.util.TreeMap<>();
            expectedProcessReceipts.forEach((expectedProcess,receipt)->
                    expectedProcessHeads.put(expectedProcess,
                            String.valueOf(receipt.get("processInputHash"))));
            int insertedRelease=jdbc.update("""
                    insert into framework_actor_process_design_release(
                      project_id,design_version,contract_sha256,contract_payload,release_status
                    ) values(?,?,?,cast(? as jsonb),'PROMOTED')
                    on conflict(project_id,design_version) do nothing
                    """, projectId, designVersion, checksum, contractJson);
            if(insertedRelease!=1)throw new IllegalStateException(
                    "DESIGN_RELEASE_HEAD_INSERT_NOT_EXACT: "+projectId+" / "+designVersion);

            Map<String,Object> pendingResult=new LinkedHashMap<>();
            pendingResult.put("status","PENDING");
            pendingResult.put("publication",publication);
            if(requirementRelease){
                pendingResult.put("expectedProcessHeads",expectedProcessHeads);
                pendingResult.put("expectedProcessReceipts",expectedProcessReceipts);
            }
            jdbc.update("""
                    update framework_actor_process_design_release
                       set release_status='QUEUED',applied_at=null,
                           generation_result=cast(? as jsonb)
                     where project_id=? and design_version=?
                    """, mapper.writeValueAsString(pendingResult), projectId, designVersion);

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
            response.put("applicationStatus", "PENDING");
            response.put("generation", publication);
            response.put("importedRequirementSteps", importedSteps);
            return ResponseEntity.ok(response);
        } catch (Exception exception) {
            if (TransactionSynchronizationManager.isActualTransactionActive()) {
                org.springframework.transaction.interceptor.TransactionAspectSupport
                        .currentTransactionStatus().setRollbackOnly();
            }
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
                    result = governance.createActor(body, account);
                }
                case "process.save" -> {
                    if (!governance.isControlPlaneAdministrator(account)) {
                        throw new SecurityException("Administrator authority is required to save a process definition.");
                    }
                    result = governance.createProcess(body, account);
                }
                case "step.save" -> {
                    if (!governance.isControlPlaneAdministrator(account)) {
                        throw new SecurityException("Administrator authority is required to save a process step.");
                    }
                    result = governance.addStep(body, account);
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
                    result = governance.saveProfessionalScreenContract(body, account);
                }
                case "screen.design.generate" -> {
                    if (!governance.isControlPlaneAdministrator(account)) {
                        throw new SecurityException("Administrator authority is required to save and generate a screen design.");
                    }
                    Set<String> structuredFields=Set.of(
                        "contractId","businessPurpose","entryCondition","exitCondition",
                        "sectionContract","fieldContract","commandContract",
                        "stateContract","apiContract","dataContract","permissionCodes",
                        "layout","theme");
                    if(body.keySet().containsAll(structuredFields)){
                        result=governance.saveProfessionalScreenContract(body,account);
                    }else{
                        Map<String,Object> noteResult=new LinkedHashMap<>(
                            governance.saveDesignAndGenerate(body,account));
                        noteResult.put("mutationKind","NOTE_ONLY");
                        noteResult.put("structuredChanged",false);
                        result=noteResult;
                    }
                }
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

    @GetMapping("/page-development-master")
    public ResponseEntity<?> pageDevelopmentMaster(
            @RequestHeader(value = "X-Resonance-Token", defaultValue = "") String suppliedToken,
            @RequestParam(defaultValue = "") String query,
            @RequestParam(defaultValue = "") String processCode,
            @RequestParam(defaultValue = "") String status) {
        if (!authorized(suppliedToken)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("success", false, "message", "Invalid control-plane bridge token."));
        }
        try {
            return ResponseEntity.ok(governance.pageDevelopmentMaster(query, processCode, status));
        } catch (Exception exception) {
            return ResponseEntity.badRequest().body(Map.of("success", false,
                    "message", exception.getMessage() == null ? "Screen list failed." : exception.getMessage()));
        }
    }

    @GetMapping("/page-development-master/{itemId}")
    public ResponseEntity<?> pageDevelopmentMasterDetail(
            @RequestHeader(value = "X-Resonance-Token", defaultValue = "") String suppliedToken,
            @PathVariable long itemId) {
        if (!authorized(suppliedToken)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("success", false, "message", "Invalid control-plane bridge token."));
        }
        try {
            return ResponseEntity.ok(governance.pageDevelopmentMasterDetail(itemId));
        } catch (Exception exception) {
            return ResponseEntity.badRequest().body(Map.of("success", false,
                    "message", exception.getMessage() == null ? "Screen detail failed." : exception.getMessage()));
        }
    }

    @GetMapping("/screen-workflow-test-cases")
    public ResponseEntity<?> screenWorkflowTestCases(
            @RequestHeader(value = "X-Resonance-Token", defaultValue = "") String suppliedToken,
            @RequestParam long screenResourceId,
            @RequestParam String processCode,
            @RequestParam String stepCode,
            @RequestParam(defaultValue = "ALL") String capabilityCode) {
        if (!authorized(suppliedToken)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("success", false, "message", "Invalid control-plane bridge token."));
        }
        try {
            return ResponseEntity.ok(governance.screenWorkflowTestCases(
                    screenResourceId, processCode, stepCode, capabilityCode));
        } catch (Exception exception) {
            return ResponseEntity.badRequest().body(Map.of("success", false,
                    "message", exception.getMessage() == null ? "Test case lookup failed." : exception.getMessage()));
        }
    }

    @PostMapping("/screen-workflow-test-cases")
    public ResponseEntity<?> saveScreenWorkflowTestCase(
            @RequestHeader(value = "X-Resonance-Token", defaultValue = "") String suppliedToken,
            @RequestHeader(value = "X-Resonance-Actor", defaultValue = "BACKSTAGE_CONTROL_PLANE") String actor,
            @RequestBody Map<String, Object> body) {
        if (!authorized(suppliedToken)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("success", false, "message", "Invalid control-plane bridge token."));
        }
        try {
            return ResponseEntity.ok(governance.saveScreenWorkflowTestCase(body, actor));
        } catch (Exception exception) {
            return ResponseEntity.badRequest().body(Map.of("success", false,
                    "message", exception.getMessage() == null ? "Test case save failed." : exception.getMessage()));
        }
    }

    @PostMapping("/screen-workflow-test")
    public ResponseEntity<?> runScreenWorkflowTest(
            @RequestHeader(value = "X-Resonance-Token", defaultValue = "") String suppliedToken,
            @RequestHeader(value = "X-Resonance-Actor", defaultValue = "BACKSTAGE_CONTROL_PLANE") String actor,
            @RequestBody Map<String, Object> body) {
        if (!authorized(suppliedToken)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED)
                    .body(Map.of("success", false, "message", "Invalid control-plane bridge token."));
        }
        try {
            return ResponseEntity.ok(governance.runDeterministicScreenWorkflowTest(body, actor));
        } catch (Exception exception) {
            return ResponseEntity.badRequest().body(Map.of("success", false,
                    "message", exception.getMessage() == null ? "Screen workflow test failed." : exception.getMessage()));
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
        Map<String,Object> release = jdbc.queryForMap("""
                select contract_payload->'source'->>'type' as source_type,
                       upper(contract_payload->'process'->>'processCode') as process_code
                  from framework_actor_process_design_release
                 where project_id=? and design_version=?
                """, projectId, designVersion);
        if ("REQUIREMENT_DOCUMENT".equals(String.valueOf(release.get("source_type")))) {
            reconcileRequirementRelease(projectId,designVersion,
                    String.valueOf(release.get("process_code")));
            return;
        }
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

    void reconcileRequirementRelease(
            String projectId,int designVersion,String processCode){
        List<Map<String,Object>> releaseRows=jdbc.queryForList("""
                select contract_sha256,release_status,
                       generation_result::text generation_result_json,
                       (case
                         when jsonb_typeof(generation_result->'expectedProcessReceipts')='object'
                           then generation_result->'expectedProcessReceipts'
                         else '{}'::jsonb
                       end)::text expected_receipts_json
                  from framework_actor_process_design_release
                 where project_id=? and design_version=?
                """,projectId,designVersion);
        if(releaseRows.size()!=1)return;
        String capturedChecksum=String.valueOf(releaseRows.get(0).get("contract_sha256"));
        String capturedReleaseStatus=String.valueOf(releaseRows.get(0).get("release_status"));
        String capturedGenerationResultJson=String.valueOf(
                releaseRows.get(0).get("generation_result_json"));
        // APPLIED binds a verified immutable receipt set.  A later head is a
        // new design revision; recovery must never downgrade or rewrite the
        // already-applied release while reconciling that newer head.
        if("APPLIED".equals(capturedReleaseStatus))return;
        String capturedReceiptsJson=String.valueOf(
                releaseRows.get(0).get("expected_receipts_json"));
        List<Map<String,Object>> rows=jdbc.queryForList("""
                with release as (
                  select cast(? as jsonb) expected_receipts
                ), expected as (
                  select upper(entry.key) process_code,
                         entry.value->>'processInputHash' expected_input_hash,
                         case
                           when jsonb_typeof(entry.value)='object'
                            and jsonb_typeof(entry.value->'jobId')='number'
                            and entry.value->>'jobId'~'^[1-9][0-9]{0,17}$'
                           then (entry.value->>'jobId')::bigint
                           else null
                         end expected_job_id
                    from release
                    cross join lateral jsonb_each(release.expected_receipts) entry
                ), headed as (
                  select expected.process_code,expected.expected_input_hash,
                         expected.expected_job_id,
                         case when exists(
                           select 1 from framework_process_definition process
                            where process.process_code=expected.process_code)
                           then framework_process_generation_input(expected.process_code)
                           else '{}'::jsonb end current_head
                    from expected
                )
                select headed.process_code as expected_process_code,
                       headed.expected_input_hash,headed.expected_job_id,
                       headed.current_head->>'processInputHash' as current_input_hash,
                       job.job_id,job.job_status,job.quality_status,job.evidence_ref,
                       job.target_path,
                       framework_try_jsonb(job.specification_json)->>'processInputHash'
                         as job_input_hash
                  from headed
                  left join framework_development_job job
                    on job.job_id=headed.expected_job_id
                   and job.process_code=headed.process_code
                   and job.job_type='FULL_STACK_GENERATION'
                   and job.job_group_code=headed.process_code||'_CANONICAL_PUBLICATION'
                 order by headed.process_code collate "C",job.job_id
                """,capturedReceiptsJson);
        java.util.SortedMap<String,String> expectedHeads=new java.util.TreeMap<>();
        java.util.SortedMap<String,Map<String,Object>> expectedReceipts=
                new java.util.TreeMap<>();
        java.util.SortedMap<String,List<Map<String,Object>>> jobsByProcess=
                new java.util.TreeMap<>();
        boolean invalid=rows.isEmpty();
        for(Map<String,Object> row:rows){
            String expectedProcess=String.valueOf(row.get("expected_process_code"));
            String expectedHash=String.valueOf(row.get("expected_input_hash"));
            Object expectedJobValue=row.get("expected_job_id");
            long expectedJobId=expectedJobValue instanceof Number number?
                    number.longValue():0L;
            if(!expectedProcess.matches("^[A-Z][A-Z0-9_:-]{1,79}$")
                    ||!expectedHash.matches("^[0-9a-f]{64}$")
                    ||expectedJobId<1L)invalid=true;
            String previous=expectedHeads.put(expectedProcess,expectedHash);
            if(previous!=null&&!previous.equals(expectedHash))invalid=true;
            Map<String,Object> receipt=new LinkedHashMap<>();
            receipt.put("processInputHash",expectedHash);
            receipt.put("jobId",expectedJobId);
            Map<String,Object> previousReceipt=expectedReceipts.put(expectedProcess,receipt);
            if(previousReceipt!=null&&!previousReceipt.equals(receipt))invalid=true;
            jobsByProcess.computeIfAbsent(expectedProcess,key->new java.util.ArrayList<>())
                    .add(row);
        }
        if(!expectedReceipts.containsKey(processCode))invalid=true;
        boolean superseded=false;
        boolean failed=false;
        boolean pending=false;
        List<Map<String,Object>> processResults=new java.util.ArrayList<>();
        for(Map.Entry<String,Map<String,Object>> expected:expectedReceipts.entrySet()){
            List<Map<String,Object>> jobs=jobsByProcess.getOrDefault(
                    expected.getKey(),List.of());
            Map<String,Object> processResult=new LinkedHashMap<>();
            processResult.put("processCode",expected.getKey());
            String expectedHash=String.valueOf(expected.getValue().get("processInputHash"));
            long expectedJobId=((Number)expected.getValue().get("jobId")).longValue();
            processResult.put("expectedProcessInputHash",expectedHash);
            processResult.put("expectedJobId",expectedJobId);
            int jobCount=(int)jobs.stream().filter(row->row.get("job_id")!=null).count();
            processResult.put("jobCount",jobCount);
            if(jobs.size()!=1||jobCount!=1){
                invalid=true;
                processResult.put("status","REVIEW_REQUIRED");
                processResults.add(processResult);
                continue;
            }
            Map<String,Object> job=jobs.get(0);
            String status=String.valueOf(job.get("job_status"));
            String quality=String.valueOf(job.get("quality_status"));
            String evidence=job.get("evidence_ref")==null?"":
                    String.valueOf(job.get("evidence_ref")).trim();
            String head=String.valueOf(job.get("current_input_hash"));
            boolean exactHead=expectedJobId==((Number)job.get("job_id")).longValue()
                    &&expectedHash.equals(head)
                    &&head.equals(String.valueOf(job.get("job_input_hash")))
                    &&("canonical://"+expected.getKey()+"/"+head)
                        .equals(job.get("target_path"));
            boolean terminal=Set.of("VERIFIED","COMPLETED").contains(status)
                    &&Set.of("VERIFIED","PASSED").contains(quality)
                    &&!evidence.isBlank();
            boolean jobFailed=Set.of("FAILED","BLOCKED").contains(status);
            if(!exactHead)superseded=true;
            if(jobFailed)failed=true;
            if(exactHead&&!terminal&&!jobFailed)pending=true;
            processResult.put("jobId",job.get("job_id"));
            processResult.put("jobStatus",status);
            processResult.put("qualityStatus",quality);
            processResult.put("currentProcessInputHash",head);
            processResult.put("headExact",exactHead);
            processResult.put("evidencePresent",!evidence.isBlank());
            processResult.put("status",exactHead&&terminal?"APPLIED":
                    !exactHead?"SUPERSEDED":jobFailed?"REVIEW_REQUIRED":"PENDING");
            processResults.add(processResult);
        }
        boolean applied=!invalid&&!superseded&&!failed&&!pending&&!expectedHeads.isEmpty();
        boolean reviewRequired=invalid||superseded||failed;
        String releaseStatus=applied?"APPLIED":reviewRequired?"REVIEW_REQUIRED":"QUEUED";
        Map<String,Object> result=new LinkedHashMap<>();
        result.put("status",applied?"APPLIED":superseded?"SUPERSEDED":
                reviewRequired?"REVIEW_REQUIRED":"PENDING");
        result.put("processCode",processCode);
        result.put("expectedProcessHeads",expectedHeads);
        result.put("expectedProcessReceipts",expectedReceipts);
        result.put("processResults",processResults);
        result.put("expectedProcessCount",expectedHeads.size());
        result.put("headExact",!invalid&&!superseded);
        int reconciled=jdbc.update("""
                update framework_actor_process_design_release
                   set release_status=?,applied_at=case when ? then current_timestamp else null end,
                       generation_result=cast(? as jsonb)
                 where project_id=? and design_version=?
                   and contract_sha256=?
                   and release_status=?
                   and generation_result=cast(? as jsonb)
                """,releaseStatus,applied,writeJson(result),projectId,designVersion,
                capturedChecksum,capturedReleaseStatus,capturedGenerationResultJson);
        if(reconciled>1)throw new IllegalStateException(
                "REQUIREMENT_RELEASE_CAS_NOT_EXACT: "+projectId+" / "+designVersion);
    }

    private Map<String,Object> importRequirementProcessContract(
            Map<?, ?> rawContract,String releaseProjectId,int releaseDesignVersion) {
        Map<String,Object> contract=validateRequirementProcessContract(
                rawContract,releaseProjectId,releaseDesignVersion);
        Object processValue = contract.get("process");
        if (!(processValue instanceof Map<?, ?> process)) {
            throw new IllegalArgumentException("Requirement process contract is missing.");
        }
        String processCode = requiredRaw(process, "processCode").toUpperCase();
        Object stepsValue = process.get("steps");
        if (!(stepsValue instanceof List<?> steps) || steps.isEmpty() || steps.size() > 1000) {
            throw new IllegalArgumentException("Requirement process must contain 1-1000 steps.");
        }
        if(!(steps.get(0) instanceof Map<?,?> firstStep)){
            throw new IllegalArgumentException("Requirement step must be an object.");
        }
        String ownerActor=requiredRaw(firstStep,"actorCode").toUpperCase();
        java.util.SortedSet<String> actorCodes = new java.util.TreeSet<>();
        for (Object stepValue : steps) {
            if (!(stepValue instanceof Map<?, ?> step)) {
                throw new IllegalArgumentException("Requirement step must be an object.");
            }
            actorCodes.add(requiredRaw(step, "actorCode").toUpperCase());
        }
        java.util.SortedSet<String> lockedProcesses = new java.util.TreeSet<>(
                governance.lockRequirementImportProcesses(processCode,actorCodes));
        java.util.SortedSet<String> affectedProcesses = new java.util.TreeSet<>();
        affectedProcesses.add(processCode);
        @SuppressWarnings("unchecked")
        List<Map<String,Object>> actorDefinitions=(List<Map<String,Object>>)
                contract.get("actorDefinitions");
        Map<String,Map<String,Object>> actorsByCode=new java.util.TreeMap<>();
        for(Map<String,Object> definition:actorDefinitions){
            actorsByCode.put(String.valueOf(definition.get("actorCode")),definition);
        }
        for (String actorCode : actorCodes) {
            Map<String,Object> definition=actorsByCode.get(actorCode);
            if(definition==null)throw new IllegalArgumentException(
                    "Requirement actor definition is missing: "+actorCode);
            @SuppressWarnings("unchecked")
            List<String> permissionCodes=(List<String>)definition.get("permissionCodes");
            String capabilityCodes=String.join(",",permissionCodes);
            LinkedHashMap<String,Object> actorRequest=new LinkedHashMap<>();
            actorRequest.put("actorCode",actorCode);
            actorRequest.put("actorName",definition.get("actorName"));
            actorRequest.put("actorNameEn",definition.get("actorName"));
            actorRequest.put("actorType",actorCode.contains("ADMIN")?"ADMIN":"BUSINESS");
            actorRequest.put("purpose",definition.get("description"));
            actorRequest.put("capabilityCodes",capabilityCodes);
            actorRequest.put("delegationAllowed",false);
            actorRequest.put("useAt","Y");
            Map<String,Object> actorMutation=governance.createActorForRequirementImport(
                    actorRequest,"BACKSTAGE_REQUIREMENT_AUTOMATION");
            if(Boolean.TRUE.equals(actorMutation.get("definitionChanged"))){
                Object rawAffected=actorMutation.get("affectedProcessCodes");
                if(rawAffected instanceof List<?> list)for(Object value:list){
                    String affected=String.valueOf(value);
                    if(!lockedProcesses.contains(affected))throw new IllegalStateException(
                            "REQUIREMENT_PROCESS_LOCK_SET_EXPANDED: "+affected);
                    affectedProcesses.add(affected);
                }
            }
        }
        governance.createProcessForRequirementImport(new LinkedHashMap<>(Map.ofEntries(
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
                Map.entry("developmentOrder", 1))),"BACKSTAGE_REQUIREMENT_AUTOMATION");
        int order = 0;
        int previousStepOrder=0;
        LinkedHashSet<String> requestedStepCodes = new LinkedHashSet<>();
        for (Object stepValue : steps) {
            Map<?, ?> step = (Map<?, ?>) stepValue;
            order++;
            int declaredOrder=((Number)step.get("stepOrder")).intValue();
            if(declaredOrder<=previousStepOrder)throw new IllegalArgumentException(
                    "Requirement step order is not strictly increasing: "+declaredOrder);
            previousStepOrder=declaredOrder;
            String stepCode = requiredRaw(step, "stepCode").toUpperCase();
            if (!requestedStepCodes.add(stepCode)) {
                throw new IllegalArgumentException("Duplicate requirement step: " + stepCode);
            }
            String actorCode = requiredRaw(step, "actorCode").toUpperCase();
            String fromState = requiredRaw(step,"fromState").toUpperCase();
            String toState = requiredRaw(step,"toState").toUpperCase();
            String routePath = requiredRaw(step, "routePath");
            Object apiContractValue=step.get("apiContract");
            String apiContract=writeJson(apiContractValue);
            Object fieldValue = step.get("fields");
            String inputContract = fieldValue instanceof List<?> fields
                    ? writeJson(Map.of("fields", fields)) : "{}";
            String requirement = requiredRaw(step, "description");
            String completionRule=writeRequirementAcceptanceCriteria(
                    step.get("acceptanceCriteria"));
            LinkedHashMap<String, Object> stepRequest = new LinkedHashMap<>();
            stepRequest.put("processCode", processCode);
            stepRequest.put("stepCode", stepCode);
            stepRequest.put("stepOrder", declaredOrder);
            stepRequest.put("stepName", requiredRaw(step, "screenName"));
            stepRequest.put("stepType", "TASK");
            stepRequest.put("actorCode", actorCode);
            stepRequest.put("fromState", fromState);
            stepRequest.put("commandCode", requiredRaw(step,"commandCode").toUpperCase());
            stepRequest.put("toState", toState);
            stepRequest.put("completionRule", completionRule);
            stepRequest.put("requirementText", requirement);
            stepRequest.put("inputContract", inputContract);
            stepRequest.put("outputContract", writeJson(Map.of(
                    "projectId", "string", "processCode", processCode,
                    "stepCode", stepCode, "statusCode", toState, "toState", toState,
                    "rowVersion", "integer")));
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
            stepRequest.put("decisionRule", "SOURCE:REQUIREMENT_DOCUMENT");
            governance.addStepForRequirementImport(
                    stepRequest, "BACKSTAGE_REQUIREMENT_AUTOMATION");
        }
        governance.reconcileRequirementImportSteps(processCode,requestedStepCodes,
                "BACKSTAGE_REQUIREMENT_AUTOMATION");
        Integer exactStepCount = jdbc.queryForObject("""
                select count(*) from framework_process_step
                 where process_code=? and step_code=any(string_to_array(?,','))
                """, Integer.class, processCode, String.join(",", requestedStepCodes));
        Integer totalStepCount = jdbc.queryForObject(
                "select count(*) from framework_process_step where process_code=?",
                Integer.class, processCode);
        if (exactStepCount == null || totalStepCount == null
                || exactStepCount != requestedStepCodes.size()
                || totalStepCount != requestedStepCodes.size()) {
            throw new IllegalStateException(
                    "Requirement process step set is not exact: " + processCode);
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
        Map<String,Object> designProjection=governance.applyRequirementProcessDesignProjection(
                processCode,contract,"BACKSTAGE_REQUIREMENT_AUTOMATION");
        if(!Boolean.TRUE.equals(designProjection.get("success"))
                ||((Number)designProjection.getOrDefault("screenCount",0)).intValue()<steps.size()){
            throw new IllegalStateException(
                    "Requirement process structured design projection is incomplete: "+designProjection);
        }
        Map<String,Object> publication = governance.finalizeAndQueueProcessDesign(
                processCode,"BACKSTAGE_REQUIREMENT_AUTOMATION",
                "REQUIREMENT_PROCESS_CONTRACT");
        if ("SKIPPED".equals(publication.get("status"))
                || !Boolean.TRUE.equals(publication.get("success"))) {
            throw new IllegalStateException(
                    "Requirement process canonical publication is incomplete: " + publication);
        }
        List<Map<String,Object>> relatedPublications=new java.util.ArrayList<>();
        for(String affectedProcess:affectedProcesses){
            if(processCode.equals(affectedProcess))continue;
            relatedPublications.add(governance.finalizeAndQueueProcessDesign(
                    affectedProcess,"BACKSTAGE_REQUIREMENT_AUTOMATION",
                    "REQUIREMENT_ACTOR_DEFINITION"));
        }
        publication=new LinkedHashMap<>(publication);
        publication.put("relatedProcessPublications",relatedPublications);
        return Map.of("requirementRelease",true,"importedSteps",order,
                "processCode",processCode,"publication",publication);
    }

    private record RequirementSets(java.util.SortedSet<String> steps,
            java.util.SortedSet<String> routes,java.util.SortedSet<String> screens,
            java.util.SortedSet<String> commands,java.util.SortedSet<String> endpoints,
            java.util.SortedSet<String> actors){}

    private Map<String,Object> validateRequirementProcessContract(
            Map<?,?> raw,String projectId,int designVersion){
        Map<String,Object> contract=mapper.convertValue(raw,
            new com.fasterxml.jackson.core.type.TypeReference<LinkedHashMap<String,Object>>(){});
        validateRequirementEnvelope(contract,projectId,designVersion);
        Map<String,Object> source=requiredObject(contract,"source");
        Map<String,Object> identity=requiredObject(contract,"identity");
        requireOnlyKeys(identity,"identity","strategy","stableKey","processCode");
        Map<String,Object> process=requiredObject(contract,"process");
        requireOnlyKeys(process,"process","processCode","startState","endState","steps");
        String processCode=canonicalCode(process,"processCode");
        if(!processCode.equals(canonicalCode(identity,"processCode"))
                ||!processCode.equals(canonicalCode(source,"processCode")))
            throw new IllegalArgumentException("REQUIREMENT_PROCESS_IDENTITY_DIVERGED");
        if(!Set.of("EXPLICIT_PROCESS_CODE","STABLE_DOCUMENT_KEY").contains(requiredRaw(identity,"strategy")))
            throw new IllegalArgumentException("REQUIREMENT_IDENTITY_STRATEGY_UNSUPPORTED");
        requiredRaw(identity,"stableKey");
        Map<String,java.util.SortedSet<String>> actorPermissions=validateRequirementActors(
            requiredObjectList(contract,"actorDefinitions",1,1000));
        Map<String,Object> generation=requiredObject(contract,"generation");
        requireOnlyKeys(generation,"generation","strategy","maxScreens","commonTheme",
            "commonLayout","genericEndpoints");
        RequirementSets sets=validateRequirementSteps(process,processCode,actorPermissions,
            governedCode(generation,"commonLayout"),governedCode(generation,"commonTheme"));
        if(!actorPermissions.keySet().equals(sets.actors()))
            throw new IllegalArgumentException("REQUIREMENT_ACTOR_DEFINITION_SET_NOT_EXACT");
        Map<String,Object> reconciliation=requiredObject(contract,"reconciliation");
        requireOnlyKeys(reconciliation,"reconciliation","mode","staleIdentityIntent",
            "stepCodes","routePaths","screenKeys","commandCodes","endpointIdentities",
            "actorCodes");
        if(!"EXACT_SET".equals(requiredRaw(reconciliation,"mode"))
                ||!"REMOVE_GENERATOR_OWNED_MISSING".equals(requiredRaw(reconciliation,"staleIdentityIntent")))
            throw new IllegalArgumentException("REQUIREMENT_RECONCILIATION_POLICY_UNSUPPORTED");
        Map.of("stepCodes",sets.steps(),"routePaths",sets.routes(),"screenKeys",sets.screens(),
            "commandCodes",sets.commands(),"endpointIdentities",sets.endpoints(),"actorCodes",sets.actors())
            .forEach((key,expected)->requireExactSet(reconciliation,key,expected));
        return contract;
    }

    private void validateRequirementEnvelope(Map<String,Object> contract,String projectId,int designVersion){
        requireOnlyKeys(contract,"contract","schemaVersion","projectId","tenantId","identity",
            "contextFields","workspaces","actorDefinitions","process","generation",
            "reconciliation","qualityGates","designVersion","contentSha256",
            "contentHashAlgorithm","source");
        Object rawVersion=contract.get("designVersion");
        if(!"3.0.0".equals(contract.get("schemaVersion"))
                ||!projectId.equals(requiredRaw(contract,"projectId",64).toUpperCase())
                ||!(rawVersion instanceof Number version)
                ||version.longValue()<1L||version.longValue()>Integer.MAX_VALUE
                ||version.doubleValue()!=version.longValue()||version.intValue()!=designVersion)
            throw new IllegalArgumentException("REQUIREMENT_RELEASE_IDENTITY_MISMATCH");
        requiredRaw(contract,"tenantId",100);
        if(!"SHA-256/CANONICAL-JSON-V1".equals(requiredRaw(contract,"contentHashAlgorithm")))
            throw new IllegalArgumentException("REQUIREMENT_CONTENT_HASH_ALGORITHM_UNSUPPORTED");
        Map<String,Object> source=requiredObject(contract,"source");
        requireOnlyKeys(source,"source","type","fileName","documentSha256","textSha256",
            "stableKey","processCode","contentSha256");
        if(!"REQUIREMENT_DOCUMENT".equals(requiredRaw(source,"type")))
            throw new IllegalArgumentException("UNSUPPORTED_DESIGN_RELEASE_SOURCE");
        requiredRaw(source,"fileName",240);requiredRaw(source,"stableKey",240);
        requireSha256(source,"documentSha256");requireSha256(source,"textSha256");
        String contentSha=requireSha256(contract,"contentSha256");
        if(!contentSha.equals(requireSha256(source,"contentSha256")))
            throw new IllegalArgumentException("REQUIREMENT_CONTENT_HASH_DIVERGED");
        List<String> keys=List.of("schemaVersion","projectId","tenantId","identity","contextFields",
            "workspaces","actorDefinitions","process","generation","reconciliation","qualityGates");
        LinkedHashMap<String,Object> bound=new LinkedHashMap<>();
        keys.forEach(key->{if(!contract.containsKey(key))throw new IllegalArgumentException(
            "REQUIREMENT_HASH_BOUND_FIELD_MISSING: "+key);bound.put(key,contract.get(key));});
        try{
            String canonical=mapper.writer().with(SerializationFeature.ORDER_MAP_ENTRIES_BY_KEYS)
                .writeValueAsString(bound);
            if(!contentSha.equals(sha256(canonical)))
                throw new IllegalArgumentException("REQUIREMENT_CONTENT_HASH_MISMATCH");
        }catch(com.fasterxml.jackson.core.JsonProcessingException error){
            throw new IllegalArgumentException("REQUIREMENT_CONTENT_NOT_CANONICAL",error);
        }
        requireExactList(contract,"contextFields",List.of("projectId","tenantId","designVersion",
            "actorCode","processCode","stepCode"));
        requireExactList(contract,"qualityGates",List.of("ACTOR_PROCESS_TRACEABILITY",
            "INPUT_OUTPUT_HANDOFF","AUTHORITY_ISOLATION","DATABASE_REREAD",
            "RESPONSIVE_ACCESSIBILITY","RECOVERY_EVIDENCE"));
        validateWorkspaces(requiredObjectList(contract,"workspaces",1,200));
    }

    private static Map<String,java.util.SortedSet<String>> validateRequirementActors(
            List<Map<String,Object>> actors){
        Map<String,java.util.SortedSet<String>> permissions=new java.util.TreeMap<>();
        for(Map<String,Object> actor:actors){
            requireOnlyKeys(actor,"actorDefinition","actorCode","actorName","description",
                "permissionCodes");
            String code=canonicalActorCode(actor,"actorCode");
            requiredRaw(actor,"actorName",120);requiredRaw(actor,"description");
            if(permissions.put(code,canonicalPermissionSet(
                    requiredStringList(actor,"permissionCodes",1,200)))!=null)
                throw new IllegalArgumentException("REQUIREMENT_ACTOR_DUPLICATE: "+code);
        }
        return permissions;
    }

    private static RequirementSets validateRequirementSteps(Map<String,Object> process,String processCode,
            Map<String,java.util.SortedSet<String>> actorPermissions,String commonLayout,String commonTheme){
        List<Map<String,Object>> steps=requiredObjectList(process,"steps",1,1000);
        RequirementSets ids=new RequirementSets(new java.util.TreeSet<>(),new java.util.TreeSet<>(),
            new java.util.TreeSet<>(),new java.util.TreeSet<>(),new java.util.TreeSet<>(),new java.util.TreeSet<>());
        java.util.Set<String> requirementIds=new java.util.HashSet<>();
        String expectedFrom=canonicalCode(process,"startState");
        int previousOrder=0;
        for(int index=0;index<steps.size();index++){
            Map<String,Object> step=steps.get(index);
            requireOnlyKeys(step,"process.steps["+index+"]","requirementId","title","description",
                "actorCode","processCode","stepCode","stepOrder","screenName","routePath",
                "layoutCode","themeCode","sections","permissionCodes","commandCode",
                "fromState","toState","endpoint","apiContract","fields","acceptanceCriteria");
            int order=requiredPositiveJavaInteger(step,"stepOrder","process.steps["+index+"]");
            if(order<=previousOrder)
                throw new IllegalArgumentException("REQUIREMENT_STEP_ORDER_NOT_INCREASING");
            previousOrder=order;
            String requirementId=requiredRaw(step,"requirementId",120);
            if(!requirementIds.add(requirementId))
                throw new IllegalArgumentException("REQUIREMENT_ID_DUPLICATE: "+requirementId);
            requiredRaw(step,"title",240);requiredRaw(step,"screenName",160);
            requiredRaw(step,"description");
            String code=canonicalCode(step,"stepCode"),actor=canonicalActorCode(step,"actorCode");
            String command=canonicalCode(step,"commandCode"),from=canonicalCode(step,"fromState");
            String to=canonicalCode(step,"toState"),route=requiredRaw(step,"routePath",300);
            if(!processCode.equals(canonicalCode(step,"processCode"))
                    ||from.length()>60||to.length()>60
                    ||!expectedFrom.equals(from)
                    ||!route.matches("^/[A-Za-z0-9/_{}:.~-]{1,299}$")||route.contains("//"))
                throw new IllegalArgumentException("REQUIREMENT_STEP_PATH_OR_STATE_INVALID: "+code);
            expectedFrom=to;
            step.putIfAbsent("layoutCode",commonLayout);step.putIfAbsent("themeCode",commonTheme);
            governedCode(step,"layoutCode");governedCode(step,"themeCode");
            validateSections(requiredObjectList(step,"sections",1,200));
            validateFields(requiredObjectList(step,"fields",1,500));
            requiredStringList(step,"acceptanceCriteria",1,100);
            java.util.SortedSet<String> permissions=canonicalPermissionSet(
                requiredStringList(step,"permissionCodes",1,200));
            if(!actorPermissions.getOrDefault(actor,new java.util.TreeSet<>()).containsAll(permissions))
                throw new IllegalArgumentException("REQUIREMENT_ACTOR_PERMISSION_COVERAGE_MISSING: "+actor);
            Map<String,Object> endpoint=requiredObject(step,"endpoint"),api=requiredObject(step,"apiContract");
            requireOnlyKeys(endpoint,"process.steps["+index+"].endpoint","method","path");
            requireOnlyKeys(api,"process.steps["+index+"].apiContract","method","path");
            String method=requiredRaw(endpoint,"method"),path=requiredRaw(endpoint,"path",270);
            if(!Set.of("GET","POST","PUT","PATCH","DELETE").contains(method)
                    ||!path.matches("^/[A-Za-z0-9/_{}:.~-]{1,269}$")||path.contains("//")
                    ||!method.equals(requiredRaw(api,"method"))||!path.equals(requiredRaw(api,"path")))
                throw new IllegalArgumentException("REQUIREMENT_ENDPOINT_INVALID: "+code);
            if(!ids.steps().add(code)||!ids.routes().add(route)||!ids.commands().add(command))
                throw new IllegalArgumentException("REQUIREMENT_STEP_IDENTITY_DUPLICATE: "+code);
            ids.actors().add(actor);ids.endpoints().add(method+" "+path);
            ids.screens().add(String.join("|",processCode,code,actor.contains("ADMIN")?"ADMIN":"USER",route));
        }
        if(!expectedFrom.equals(canonicalCode(process,"endState")))
            throw new IllegalArgumentException("REQUIREMENT_END_STATE_NOT_REACHED");
        return ids;
    }

    @SuppressWarnings("unchecked")
    private static Map<String,Object> requiredObject(Map<String,Object> body,String key){
        if(!(body.get(key) instanceof Map<?,?> value))throw new IllegalArgumentException(key+" must be an object");
        return (Map<String,Object>)value;
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String,Object>> requiredObjectList(
            Map<String,Object> body,String key,int minimum,int maximum){
        if(!(body.get(key) instanceof List<?> value)||value.size()<minimum||value.size()>maximum
                ||value.stream().anyMatch(item->!(item instanceof Map<?,?>)))
            throw new IllegalArgumentException(key+" must contain structured objects");
        return (List<Map<String,Object>>)(List<?>)value;
    }

    private static List<String> requiredStringList(
            Map<String,Object> body,String key,int minimum,int maximum){
        if(!(body.get(key) instanceof List<?> raw)||raw.size()<minimum||raw.size()>maximum
                ||raw.stream().anyMatch(value->!(value instanceof String text)||text.isBlank()||!text.equals(text.trim())))
            throw new IllegalArgumentException(key+" must contain canonical strings");
        List<String> values=raw.stream().map(String::valueOf).toList();
        if(new java.util.HashSet<>(values).size()!=values.size())
            throw new IllegalArgumentException(key+" contains duplicates");
        return values;
    }

    private static java.util.SortedSet<String> canonicalPermissionSet(List<String> values){
        java.util.SortedSet<String> set=new java.util.TreeSet<>(values);
        if(!values.equals(List.copyOf(set))||set.stream().anyMatch(v->!v.matches("^[A-Z][A-Z0-9_:-]{1,79}$")))
            throw new IllegalArgumentException("REQUIREMENT_PERMISSION_CODES_NOT_CANONICAL");
        return set;
    }

    private static String canonicalCode(Map<String,Object> body,String key){
        String value=requiredRaw(body,key);
        if(!value.matches("^[A-Z][A-Z0-9_:-]{1,79}$"))
            throw new IllegalArgumentException(key+" is not a canonical code: "+value);
        return value;
    }

    private static String canonicalActorCode(Map<String,Object> body,String key){
        String value=requiredRaw(body,key);
        if(!value.matches("^[A-Z][A-Z0-9_]{1,59}$"))
            throw new IllegalArgumentException(key+" is not a canonical actor code: "+value);
        return value;
    }

    private static String governedCode(Map<String,Object> body,String key){
        String value=requiredRaw(body,key);
        if(!value.matches("^[A-Z][A-Z0-9_]{1,79}$"))
            throw new IllegalArgumentException(key+" is not a governed design code: "+value);
        return value;
    }

    private static String requireSha256(Map<String,Object> body,String key){
        String value=requiredRaw(body,key);
        if(!value.matches("^[0-9a-f]{64}$"))throw new IllegalArgumentException(key+" must be SHA-256");
        return value;
    }

    private static void validateWorkspaces(List<Map<String,Object>> workspaces){
        List<String> expectedWorkspaceIds=List.of("design","develop","operate");
        List<String> expectedSectionCodes=List.of("HELP","NEXT_TASK","QA","SCREEN_DESIGN");
        if(workspaces.size()!=expectedWorkspaceIds.size())
            throw new IllegalArgumentException("REQUIREMENT_WORKSPACES_NOT_EXACT");
        for(int workspaceIndex=0;workspaceIndex<workspaces.size();workspaceIndex++){
            Map<String,Object> workspace=workspaces.get(workspaceIndex);
            String workspacePath="workspaces["+workspaceIndex+"]";
            requireOnlyKeys(workspace,workspacePath,"id","tabs");
            String expectedWorkspaceId=expectedWorkspaceIds.get(workspaceIndex);
            if(!expectedWorkspaceId.equals(requiredRaw(workspace,"id")))
                throw new IllegalArgumentException("REQUIREMENT_WORKSPACE_ORDER_NOT_EXACT");
            int expectedTabCount="operate".equals(expectedWorkspaceId)?9:8;
            List<Map<String,Object>> tabs=requiredObjectList(
                workspace,"tabs",expectedTabCount,expectedTabCount);
            for(int tabIndex=0;tabIndex<tabs.size();tabIndex++){
                Map<String,Object> tab=tabs.get(tabIndex);
                String tabPath=workspacePath+".tabs["+tabIndex+"]";
                requireOnlyKeys(tab,tabPath,"id","label","order","sections");
                String expectedTabId=expectedWorkspaceId+"-"+(tabIndex+1);
                String expectedLabel=expectedWorkspaceId.toUpperCase()+" "+(tabIndex+1);
                if(!expectedTabId.equals(requiredRaw(tab,"id"))
                        ||!expectedLabel.equals(requiredRaw(tab,"label"))
                        ||requiredPositiveJavaInteger(tab,"order",tabPath)!=(tabIndex+1)*10)
                    throw new IllegalArgumentException("REQUIREMENT_WORKSPACE_TAB_NOT_EXACT: "+expectedTabId);
                List<Map<String,Object>> sections=requiredObjectList(
                    tab,"sections",expectedSectionCodes.size(),expectedSectionCodes.size());
                validateSections(sections);
                for(int sectionIndex=0;sectionIndex<sections.size();sectionIndex++){
                    Map<String,Object> section=sections.get(sectionIndex);
                    String expectedCode=expectedSectionCodes.get(sectionIndex);
                    if(!expectedCode.equals(section.get("sectionCode"))
                            ||!expectedCode.equals(section.get("componentType"))
                            ||!Integer.valueOf((sectionIndex+1)*10).equals(section.get("order")))
                        throw new IllegalArgumentException(
                            "REQUIREMENT_WORKSPACE_SECTION_NOT_EXACT: "+expectedTabId);
                }
            }
        }
    }

    private static void validateSections(List<Map<String,Object>> sections){
        int previous=0;java.util.Set<String> codes=new java.util.HashSet<>();
        for(int index=0;index<sections.size();index++){
            Map<String,Object> section=sections.get(index);
            requireOnlyKeys(section,"section["+index+"]","sectionCode","order","componentType");
            String code=canonicalCode(section,"sectionCode");
            int order=requiredPositiveJavaInteger(section,"order","section["+index+"]");
            if(!codes.add(code)||order<=previous)
                throw new IllegalArgumentException("REQUIREMENT_SECTION_ORDER_NOT_EXACT: "+code);
            previous=order;canonicalCode(section,"componentType");
        }
    }

    private static void validateFields(List<Map<String,Object>> fields){
        int previous=0;java.util.Set<String> codes=new java.util.HashSet<>();
        for(int index=0;index<fields.size();index++){
            Map<String,Object> field=fields.get(index);
            requireOnlyKeys(field,"field["+index+"]","fieldCode","label","type","required","order");
            String code=canonicalCode(field,"fieldCode");requiredRaw(field,"label");requiredRaw(field,"type");
            int order=requiredPositiveJavaInteger(field,"order","field["+index+"]");
            if(!codes.add(code)||order<=previous
                    ||!(field.get("required") instanceof Boolean))
                throw new IllegalArgumentException("REQUIREMENT_FIELD_INVALID: "+code);
            previous=order;
        }
    }

    private static int requiredPositiveJavaInteger(
            Map<String,Object> body,String key,String path){
        Object raw=body.get(key);
        if(!(raw instanceof Number number)||number.longValue()<1L
                ||number.longValue()>Integer.MAX_VALUE
                ||number.doubleValue()!=number.longValue())
            throw new IllegalArgumentException(path+"."+key+" must be a positive 32-bit integer");
        return number.intValue();
    }

    private static void requireOnlyKeys(
            Map<?,?> body,String path,String... allowedKeys){
        java.util.Set<String> allowed=Set.of(allowedKeys);
        java.util.SortedSet<String> unknown=new java.util.TreeSet<>();
        for(Object key:body.keySet()){
            if(!(key instanceof String text)||!allowed.contains(text))unknown.add(String.valueOf(key));
        }
        if(!unknown.isEmpty())throw new IllegalArgumentException(
            path+" contains unknown fields: "+String.join(",",unknown));
    }

    private static void requireExactList(Map<String,Object> body,String key,List<String> expected){
        if(!requiredStringList(body,key,expected.size(),expected.size()).equals(expected))
            throw new IllegalArgumentException("REQUIREMENT_LIST_NOT_EXACT: "+key);
    }

    private static void requireExactSet(
            Map<String,Object> body,String key,java.util.SortedSet<String> expected){
        if(!requiredStringList(body,key,expected.size(),expected.size()).equals(List.copyOf(expected)))
            throw new IllegalArgumentException("REQUIREMENT_RECONCILIATION_SET_NOT_EXACT: "+key);
    }

    private static String writeRequirementAcceptanceCriteria(Object value){
        if(!(value instanceof List<?> criteria)||criteria.isEmpty()
                ||criteria.stream().anyMatch(item->!(item instanceof String text)||text.isBlank()))
            throw new IllegalArgumentException("acceptanceCriteria must be a non-empty string array");
        return criteria.stream().map(String::valueOf).collect(java.util.stream.Collectors.joining("; "));
    }

    private java.util.SortedMap<String,Map<String,Object>> requirementExpectedProcessReceipts(
            Object publication){
        java.util.SortedMap<String,Map<String,Object>> expected=new java.util.TreeMap<>();
        collectRequirementPublicationReceipt(publication,expected);
        if(expected.isEmpty())
            throw new IllegalStateException("REQUIREMENT_PUBLICATION_RECEIPT_REQUIRED");
        return expected;
    }

    private void collectRequirementPublicationReceipt(
            Object value,java.util.SortedMap<String,Map<String,Object>> expected){
        if(!(value instanceof Map<?,?> publication)
                ||!Boolean.TRUE.equals(publication.get("success"))
                ||"SKIPPED".equals(String.valueOf(publication.get("status")))){
            throw new IllegalStateException(
                    "REQUIREMENT_PUBLICATION_HEAD_REQUIRED: "+value);
        }
        String processCode=String.valueOf(publication.get("processCode"));
        String processInputHash=String.valueOf(publication.get("processInputHash"));
        Object jobIdValue=publication.get("jobId");
        if(!processCode.matches("^[A-Z][A-Z0-9_:-]{1,79}$")
                ||!processInputHash.matches("^[0-9a-f]{64}$")
                ||!(publication.get("jobCount") instanceof Number jobCount)
                ||jobCount.intValue()!=1
                ||!(jobIdValue instanceof Number jobId)
                ||jobId.longValue()<1L
                ||jobId.doubleValue()!=jobId.longValue()){
            throw new IllegalStateException(
                    "REQUIREMENT_PUBLICATION_RECEIPT_REQUIRED: "+processCode);
        }
        Map<String,Object> receipt=new LinkedHashMap<>();
        receipt.put("processInputHash",processInputHash);
        receipt.put("jobId",jobId.longValue());
        Map<String,Object> previous=expected.put(processCode,receipt);
        if(previous!=null&&!previous.equals(receipt)){
            throw new IllegalStateException(
                    "REQUIREMENT_PUBLICATION_RECEIPT_CONFLICT: "+processCode);
        }
        Object related=publication.get("relatedProcessPublications");
        if(related instanceof List<?> relatedPublications){
            for(Object relatedPublication:relatedPublications){
                collectRequirementPublicationReceipt(relatedPublication,expected);
            }
        }else if(related!=null){
            throw new IllegalStateException(
                    "REQUIREMENT_RELATED_PUBLICATIONS_INVALID");
        }
    }

    private static String requiredRaw(Map<?, ?> body, String key) {
        return requiredRaw(body,key,Integer.MAX_VALUE);
    }

    private static String requiredRaw(Map<?, ?> body, String key,int maximumLength) {
        Object value = body.get(key);
        if(!(value instanceof String text)||text.isBlank()||!text.equals(text.trim()))
            throw new IllegalArgumentException(key + " must be a canonical non-empty string");
        if(text.length()>maximumLength)
            throw new IllegalArgumentException(key+" exceeds maximum length "+maximumLength);
        return text;
    }

    private static String sha256(String value){
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException("SHA-256 is unavailable",impossible);
        }
    }

    @Scheduled(
            fixedDelayString = "${resonance.actor-process.generation-recovery-delay-ms:60000}",
            initialDelayString = "${resonance.actor-process.generation-recovery-initial-delay-ms:2000}")
    @Transactional
    public void recoverQueuedDesignGeneration() {
        Boolean elected = jdbc.queryForObject(
                "select pg_try_advisory_xact_lock(hashtext('resonance:requirement-design-self-healer'))",
                Boolean.class);
        if (!Boolean.TRUE.equals(elected)) {
            return;
        }
        List<String> requirementProcesses = jdbc.queryForList("""
                select process_code from framework_process_definition
                 where left(process_code,4)='REQ_'
                 order by process_code
                """, String.class);
        for (String processCode : requirementProcesses) {
            governance.ensureGeneratedProcessSafetyCases(processCode);
            governance.ensureGeneratedProcessDesignContracts(processCode, "REQUIREMENT_SELF_HEALER");
            governance.ensureGeneratedProcessPageDesigns(processCode, "REQUIREMENT_SELF_HEALER");
            governance.finalizeAndQueueProcessDesign(processCode,"REQUIREMENT_SELF_HEALER",
                    "REQUIREMENT_PROCESS_RECOVERY");
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
        Runnable reconcile=()->{
            for (Map<String, Object> release : releases) {
                String projectId = String.valueOf(release.get("project_id"));
                int designVersion = ((Number) release.get("design_version")).intValue();
                generationExecutor.execute(() -> compilePromotedRelease(projectId, designVersion));
            }
        };
        if(TransactionSynchronizationManager.isSynchronizationActive()){
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization(){
                @Override public void afterCommit(){reconcile.run();}
            });
        }else reconcile.run();
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
