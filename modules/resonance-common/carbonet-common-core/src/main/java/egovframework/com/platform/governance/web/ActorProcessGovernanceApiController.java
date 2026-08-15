package egovframework.com.platform.governance.web;

import egovframework.com.feature.auth.service.CurrentUserContextService;
import egovframework.com.platform.governance.service.ActorProcessGovernanceService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping({"/admin/api/system/actor-process","/en/admin/api/system/actor-process"})
public class ActorProcessGovernanceApiController {
    private final ActorProcessGovernanceService service;
    private final CurrentUserContextService currentUserContextService;
    private final String opsToken;
    public ActorProcessGovernanceApiController(ActorProcessGovernanceService service,
                                               CurrentUserContextService currentUserContextService,
                                               @Value("${resonance.ops.token:}") String opsToken){
        this.service=service;this.currentUserContextService=currentUserContextService;this.opsToken=opsToken;
    }
    @GetMapping public ResponseEntity<?> dashboard(HttpServletRequest request){var context=currentUserContextService.resolve(request);ResponseEntity<?> denied=systemReportAccessFailure(context);return denied==null?ResponseEntity.ok(service.dashboard()):denied;}
    @GetMapping("/dashboard/core") public ResponseEntity<?> dashboardCore(HttpServletRequest request){var context=currentUserContextService.resolve(request);ResponseEntity<?> denied=systemReportAccessFailure(context);return denied==null?ResponseEntity.ok(service.dashboardCore()):denied;}
    @GetMapping("/process-closing") public Map<String,Object> processClosing(){return service.processClosingStatus();}
    @PostMapping("/process-closing/audit") public ResponseEntity<?> auditProcessClosing(HttpServletRequest request){return guardedDesignMutation(request,service::auditProcessClosing);}
    @GetMapping("/executable-screens") public Map<String,Object> executableScreens(@RequestParam(defaultValue="") String status,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="100") int size){return service.executableScreens(status,page,size);}
    @GetMapping("/process-design") public ResponseEntity<?> processDesign(@RequestParam String processCode){try{return ResponseEntity.ok(service.processDesign(processCode));}catch(Exception e){return bad(e);}}
    @GetMapping("/cases") public ResponseEntity<?> cases(@RequestParam String processCode){try{return ResponseEntity.ok(service.simulationCases(processCode));}catch(Exception e){return bad(e);}}
    @GetMapping("/design-assets") public ResponseEntity<?> designAssets(HttpServletRequest request){var context=currentUserContextService.resolve(request);ResponseEntity<?> denied=systemReportAccessFailure(context);return denied==null?ResponseEntity.ok(service.designAssetInventory()):denied;}
    @GetMapping("/assets/search") public Map<String,Object> searchAssets(@RequestParam(defaultValue="") String query,@RequestParam(defaultValue="") String assetType,@RequestParam(defaultValue="30") int limit){return service.searchAssetCatalog(query,assetType,limit);}
    @GetMapping("/assets/impact") public ResponseEntity<?> assetImpact(@RequestParam String assetId,@RequestParam(defaultValue="2") int depth){try{return ResponseEntity.ok(service.assetImpact(assetId,depth));}catch(Exception e){return bad(e);}}
    @PostMapping("/assets/refresh") public ResponseEntity<?> refreshAssets(HttpServletRequest request){return guardedDesignMutation(request,service::refreshAssetCatalog);}
    @PostMapping("/process-archetypes/bind-screen") public ResponseEntity<?> bindScreenArchetype(@RequestBody Map<String,Object>b,HttpServletRequest request){return guardedDesignMutation(request,actor->service.bindScreenProcessArchetype(b,actor));}
    @PostMapping("/design-assets/preflight") public ResponseEntity<?> designPreflight(@RequestBody Map<String,Object>b,HttpServletRequest request){return guardedDesignMutation(request,actor->service.runDesignPreflight(b,actor));}
    @PostMapping("/actors") public ResponseEntity<?> actor(@RequestBody Map<String,Object>b,HttpServletRequest request){return guardedDesignMutation(request,actor->service.createActor(b,actor));}
    @PostMapping("/work-types") public ResponseEntity<?> workType(@RequestBody Map<String,Object>b,HttpServletRequest request){return guardedDesignMutation(request,actor->{service.saveWorkType(b);return Map.of("success",true);});}
    @PostMapping("/assignments")
    public ResponseEntity<?> assignment(@RequestBody Map<String,Object>b,HttpServletRequest request){
        var context=currentUserContextService.resolve(request);
        if(!context.isAuthenticated())return ResponseEntity.status(401).body(Map.of("success",false,"message","AUTHENTICATION_REQUIRED"));
        try{
            service.assignActorAuthorized(b,context.getUserId(),context.getInsttId(),context.getAuthorCode(),isPlatformAdministrator(context));
            return ResponseEntity.ok(Map.of("success",true));
        }catch(SecurityException e){
            return ResponseEntity.status(403).body(Map.of("success",false,"message",e.getMessage()));
        }catch(Exception e){
            return bad(e);
        }
    }
    @PostMapping("/delivery/blueprints") public ResponseEntity<?> saveDeliveryBlueprint(@RequestBody Map<String,Object>b,HttpServletRequest request){return guardedDesignMutation(request,actor->service.saveProjectDeliveryBlueprint(b,actor));}
    @PostMapping("/delivery/validate") public ResponseEntity<?> validateDeliveryBlueprint(@RequestBody Map<String,Object>b){try{return ResponseEntity.ok(service.validateProjectDeliveryBlueprint(String.valueOf(b.getOrDefault("blueprintCode",""))));}catch(Exception e){return bad(e);}}
    @PostMapping("/delivery/apply") public ResponseEntity<?> applyDeliveryBlueprint(@RequestBody Map<String,Object>b,HttpServletRequest request){return guardedDesignMutation(request,actor->service.applyProjectDeliveryBlueprint(b,actor));}
    @PostMapping("/processes") public ResponseEntity<?> process(@RequestBody Map<String,Object>b,HttpServletRequest request){return guardedDesignMutation(request,actor->service.createProcess(b,actor));}
    @PostMapping("/steps") public ResponseEntity<?> step(@RequestBody Map<String,Object>b,HttpServletRequest request){return guardedDesignMutation(request,actor->service.addStep(b,actor));}
    @PostMapping("/development/plan") public ResponseEntity<?> plan(@RequestBody Map<String,Object>b,HttpServletRequest request){return guardedDesignMutation(request,actor->service.generateDevelopmentPlan(String.valueOf(b.get("processCode")),String.valueOf(b.get("stepCode")),actor));}
    @PostMapping("/development/bootstrap-process") public ResponseEntity<?> bootstrapProcess(@RequestBody Map<String,Object>b,HttpServletRequest request){return guardedDesignMutation(request,actor->service.bootstrapProcessDevelopment(b,actor));}
    @PostMapping("/development/direct") public ResponseEntity<?> directDevelopment(@RequestBody Map<String,Object>b,HttpServletRequest request){return guardedDesignMutation(request,actor->service.executeDesignDirectDevelopment(b,actor));}
    @PostMapping("/design/save-and-generate")
    public ResponseEntity<?> saveDesignAndGenerate(@RequestBody Map<String,Object>b,HttpServletRequest request){
        return guardedDesignMutation(request,actor->service.saveDesignAndGenerate(b,actor));
    }
    @PostMapping("/development/approve") public ResponseEntity<?> approve(@RequestBody Map<String,Object>b,HttpServletRequest request){return guardedDesignMutation(request,actor->service.approveDevelopmentPlan(String.valueOf(b.get("processCode")),String.valueOf(b.get("stepCode")),actor));}
    @PostMapping("/development/preflight") public ResponseEntity<?> developmentPreflight(@RequestBody Map<String,Object>b,HttpServletRequest request){return guardedDesignMutation(request,actor->service.runScreenDevelopmentPreflight(String.valueOf(b.get("processCode")),String.valueOf(b.get("stepCode")),actor));}
    @PostMapping("/design/validate") public ResponseEntity<?> validateDesign(@RequestBody Map<String,Object>b,HttpServletRequest request){return guardedDesignMutation(request,actor->service.validateProcessDesign(String.valueOf(b.get("processCode")),actor));}
    @PostMapping("/design/generate-professional-graph") public ResponseEntity<?> generateProfessionalGraph(@RequestBody(required=false) Map<String,Object>b,HttpServletRequest request){String process=b==null?null:String.valueOf(b.getOrDefault("processCode",""));return guardedDesignMutation(request,actor->service.generateProfessionalDesignGraph(process,actor));}
    @GetMapping("/design/professional-graph") public ResponseEntity<?> professionalGraph(@RequestParam(defaultValue="") String workTypeCode,@RequestParam(defaultValue="") String processCode){try{return ResponseEntity.ok(service.professionalDesignGraph(workTypeCode,processCode));}catch(Exception e){return bad(e);}}
    @GetMapping("/page-development-master") public ResponseEntity<?> pageDevelopmentMaster(@RequestParam(defaultValue="") String query,@RequestParam(defaultValue="") String processCode,@RequestParam(defaultValue="") String status){try{return ResponseEntity.ok(service.pageDevelopmentMaster(query,processCode,status));}catch(Exception e){return bad(e);}}
    @GetMapping("/page-development-master/{itemId}") public ResponseEntity<?> pageDevelopmentMasterDetail(@PathVariable long itemId){try{return ResponseEntity.ok(service.pageDevelopmentMasterDetail(itemId));}catch(Exception e){return bad(e);}}
    @GetMapping("/system-test-report")
    public ResponseEntity<?> systemTestReport(@RequestParam(defaultValue="") String domainCode,
                                               @RequestParam(defaultValue="") String processCode,
                                               @RequestParam(defaultValue="") String result,
                                               @RequestParam(defaultValue="true") boolean compact,
                                               @RequestParam(defaultValue="0") int page,
                                               @RequestParam(defaultValue="50") int size,
                                               HttpServletRequest request){
        var context=currentUserContextService.resolve(request);ResponseEntity<?> denied=systemReportAccessFailure(context);if(denied!=null)return denied;
        try{return ResponseEntity.ok(service.systemProcessTestReport(domainCode,processCode,result,compact,page,size));}catch(Exception e){return bad(e);}
    }
    @GetMapping("/system-test-report/step-detail")
    public ResponseEntity<?> systemTestReportStepDetail(@RequestParam String processCode,
                                                         @RequestParam String stepCode,
                                                         HttpServletRequest request){
        var context=currentUserContextService.resolve(request);ResponseEntity<?> denied=systemReportAccessFailure(context);if(denied!=null)return denied;
        try{return ResponseEntity.ok(service.systemProcessTestReportStepDetail(processCode,stepCode));}
        catch(java.util.NoSuchElementException e){return ResponseEntity.status(404).body(Map.of("success",false,"message","SYSTEM_TEST_REPORT_STEP_NOT_FOUND"));}
        catch(Exception e){return bad(e);}
    }
    @PostMapping("/system-test-report/audit")
    public ResponseEntity<?> auditSystemTestReport(@RequestBody(required=false) Map<String,Object>b,HttpServletRequest request){
        var context=currentUserContextService.resolve(request);ResponseEntity<?> denied=systemReportAccessFailure(context);if(denied!=null)return denied;
        try{return ResponseEntity.ok(service.auditSystemProcessContracts(b==null?Map.of():b,context.getUserId()));}catch(Exception e){return bad(e);}
    }
    @PostMapping("/system-test-report/audit-batches/start")
    public ResponseEntity<?> startSystemTestReportAuditBatch(@RequestBody(required=false) Map<String,Object>b,HttpServletRequest request){
        var context=currentUserContextService.resolve(request);ResponseEntity<?> denied=systemReportAccessFailure(context);if(denied!=null)return denied;
        try{return ResponseEntity.ok(service.startSystemProcessContractAuditBatch(b==null?Map.of():b,context.getUserId()));}catch(Exception e){return bad(e);}
    }
    @PostMapping("/system-test-report/audit-batches/{auditBatchId}/complete")
    public ResponseEntity<?> completeSystemTestReportAuditBatch(@PathVariable UUID auditBatchId,HttpServletRequest request){
        var context=currentUserContextService.resolve(request);ResponseEntity<?> denied=systemReportAccessFailure(context);if(denied!=null)return denied;
        try{return ResponseEntity.ok(service.completeSystemProcessContractAuditBatch(auditBatchId,context.getUserId()));}catch(Exception e){return bad(e);}
    }
    @PostMapping("/system-test-report/audit-batches/{auditBatchId}/fail")
    public ResponseEntity<?> failSystemTestReportAuditBatch(@PathVariable UUID auditBatchId,@RequestBody(required=false) Map<String,Object>b,HttpServletRequest request){
        var context=currentUserContextService.resolve(request);ResponseEntity<?> denied=systemReportAccessFailure(context);if(denied!=null)return denied;
        try{return ResponseEntity.ok(service.failSystemProcessContractAuditBatch(auditBatchId,b==null?Map.of():b,context.getUserId()));}catch(Exception e){return bad(e);}
    }
    @PostMapping("/system-test-report/reviews")
    public ResponseEntity<?> saveSystemTestReportReview(@RequestBody Map<String,Object>b,HttpServletRequest request){
        var context=currentUserContextService.resolve(request);ResponseEntity<?> denied=systemReportAccessFailure(context);if(denied!=null)return denied;
        try{return ResponseEntity.ok(service.saveSystemUsageReview(b,context.getUserId()));}
        catch(IllegalArgumentException e){
            if("IDEMPOTENCY_KEY_REUSE_MISMATCH".equals(e.getMessage()))
                return ResponseEntity.status(409).body(Map.of("success",false,"message","IDEMPOTENCY_KEY_REUSE_MISMATCH"));
            return bad(e);
        }catch(Exception e){return bad(e);}
    }
    @PostMapping("/screen-workflow-test") public ResponseEntity<?> runScreenWorkflowTest(@RequestBody Map<String,Object>b,HttpServletRequest request){return guardedDesignMutation(request,actor->service.runDeterministicScreenWorkflowTest(b,actor));}
    @GetMapping("/screen-workflow-test-cases") public ResponseEntity<?> screenWorkflowTestCases(@RequestParam long screenResourceId,@RequestParam String processCode,@RequestParam String stepCode,@RequestParam(defaultValue="ALL") String capabilityCode){try{return ResponseEntity.ok(service.screenWorkflowTestCases(screenResourceId,processCode,stepCode,capabilityCode));}catch(Exception e){return bad(e);}}
    @PostMapping("/screen-workflow-test-cases") public ResponseEntity<?> saveScreenWorkflowTestCase(@RequestBody Map<String,Object>b,HttpServletRequest request){return guardedDesignMutation(request,actor->service.saveScreenWorkflowTestCase(b,actor));}
    @GetMapping("/qa-datasets") public ResponseEntity<?> qaDatasets(@RequestParam String processCode,@RequestParam(defaultValue="") String stepCode){try{return ResponseEntity.ok(service.qaProcessCaseCatalog(processCode,stepCode));}catch(Exception e){return bad(e);}}
    @GetMapping("/qa-sessions/latest") public ResponseEntity<?> qaSession(@RequestParam String processCode,@RequestParam(defaultValue="") String projectId){try{return ResponseEntity.ok(service.qaProcessTestSession(processCode,projectId));}catch(Exception e){return bad(e);}}
    @PostMapping("/qa-sessions") public ResponseEntity<?> saveQaSession(@RequestBody Map<String,Object>b,HttpServletRequest request){return guardedDesignMutation(request,actor->service.saveQaProcessTestSession(b,actor));}
    @PostMapping("/common-features/install") public ResponseEntity<?> installFeature(@RequestBody Map<String,Object>b,HttpServletRequest request){return guardedDesignMutation(request,actor->service.installCommonFeature(String.valueOf(b.get("featureCode")),String.valueOf(b.getOrDefault("projectScope","PLATFORM")),actor,config(b.get("configuration"))));}
    @PostMapping("/professional-screen-contracts") public ResponseEntity<?> professionalScreenContract(@RequestBody Map<String,Object>b,HttpServletRequest request){return guardedDesignMutation(request,actor->service.saveProfessionalScreenContract(b,actor));}
    @PostMapping("/professional-screen-contracts/preview")
    public ResponseEntity<?> professionalScreenContractPreview(@RequestBody Map<String,Object>b,HttpServletRequest request){
        var context=currentUserContextService.resolve(request);ResponseEntity<?> denied=systemReportAccessFailure(context);if(denied!=null)return denied;
        try{return ResponseEntity.ok(service.saveProfessionalScreenContractPreview(b,context.getUserId()));}catch(Exception e){return bad(e);}
    }
    @PostMapping("/professional-factory/execute") public ResponseEntity<?> executeProfessionalFactory(@RequestBody Map<String,Object>b,HttpServletRequest request){return guardedDesignMutation(request,actor->service.executeProfessionalFactory(b,actor));}
    @PostMapping("/professional-factory/evidence") public ResponseEntity<?> recordProfessionalEvidence(@RequestBody Map<String,Object>b,HttpServletRequest request){return guardedDesignMutation(request,actor->service.recordProfessionalEvidence(b,actor));}
    @PostMapping("/professional-factory/assemble-assets") public ResponseEntity<?> assembleAssets(@RequestBody Map<String,Object>b,HttpServletRequest request){return guardedDesignMutation(request,actor->service.assembleScreenAssets(String.valueOf(b.get("processCode")),actor));}
    @PostMapping("/executions/start") public ResponseEntity<?> startExecution(@RequestBody Map<String,Object>b,HttpServletRequest request){return processActorOperation(request,user->service.startProcessExecution(b,user));}
    @PostMapping("/executions/{executionId}/commands") public ResponseEntity<?> executeCommand(@PathVariable UUID executionId,@RequestBody Map<String,Object>b,HttpServletRequest request){return processActorOperation(request,user->service.executeProcessCommand(executionId,b,user));}
    @PostMapping("/backend/verify") public ResponseEntity<?> verifyBackend(@RequestBody Map<String,Object>b,HttpServletRequest request){return guardedDesignMutation(request,actor->service.verifyBackendProcessContracts(String.valueOf(b.getOrDefault("sourceCommit","")),actor));}
    @PostMapping("/backend/runtime-smoke") public ResponseEntity<?> runtimeSmoke(@RequestParam(defaultValue="") String processCode,HttpServletRequest request){return guardedDesignMutation(request,actor->service.runProcessRuntimeSmoke(processCode,actor));}
    @GetMapping("/backend/runtime-smoke/{executionId}/rollback-check") public ResponseEntity<?> runtimeSmokeRollback(@PathVariable UUID executionId){try{return ResponseEntity.ok(service.verifyProcessRuntimeSmokeRollback(executionId));}catch(Exception e){return bad(e);}}
    @PostMapping("/development/claim") public ResponseEntity<?> claim(@RequestBody Map<String,Object>b,HttpServletRequest request){ResponseEntity<?> denied=workerAccessFailure(request);if(denied!=null)return denied;try{return ResponseEntity.ok(service.claimDevelopmentJob(String.valueOf(b.getOrDefault("workerId","AI_RUNNER"))));}catch(Exception e){return bad(e);}}
    @PostMapping("/development/heartbeat") public ResponseEntity<?> heartbeat(@RequestBody Map<String,Object>b,HttpServletRequest request){ResponseEntity<?> denied=workerAccessFailure(request);if(denied!=null)return denied;try{return ResponseEntity.ok(service.heartbeatDevelopmentJob(Long.parseLong(String.valueOf(b.get("jobId"))),String.valueOf(b.get("leaseToken")),String.valueOf(b.getOrDefault("workerId","AI_RUNNER"))));}catch(Exception e){return bad(e);}}
    @PostMapping("/development/complete") public ResponseEntity<?> complete(@RequestBody Map<String,Object>b,HttpServletRequest request){ResponseEntity<?> denied=workerAccessFailure(request);if(denied!=null)return denied;try{return ResponseEntity.ok(service.completeDevelopmentJob(b,String.valueOf(b.getOrDefault("workerId","AI_RUNNER"))));}catch(Exception e){return bad(e);}}
    @PostMapping("/development/retry") public ResponseEntity<?> retry(@RequestBody Map<String,Object>b,HttpServletRequest request){return guardedDesignMutation(request,actor->service.retryDevelopmentJob(Long.parseLong(String.valueOf(b.get("jobId"))),actor));}
    @PostMapping("/development/request") public ResponseEntity<?> requestDevelopment(@RequestBody Map<String,Object>b,HttpServletRequest request){return guardedDesignMutation(request,actor->service.requestDevelopmentJob(Long.parseLong(String.valueOf(b.get("jobId"))),actor));}
    @PostMapping("/references/scan") public ResponseEntity<?> scanReferences(@RequestBody Map<String,Object>b,HttpServletRequest request){return guardedDesignMutation(request,actor->service.scanReferences(String.valueOf(b.getOrDefault("rootPath","/opt/reference")),actor));}
    @PostMapping("/generation/compile") public ResponseEntity<?> compileScreens(@RequestBody Map<String,Object>b,HttpServletRequest request){return guardedDesignMutation(request,actor->service.compileScreenBlueprints(b,actor));}
    @PostMapping("/generation/compile-and-queue") public ResponseEntity<?> compileAndQueueScreens(@RequestBody Map<String,Object>b,HttpServletRequest request){return guardedDesignMutation(request,actor->service.compileAndQueueScreens(b,actor));}
    @PostMapping("/generation/adopt-existing") public ResponseEntity<?> adoptExistingScreens(@RequestBody Map<String,Object>b,HttpServletRequest request){return guardedDesignMutation(request,actor->service.adoptExistingScreens(b,actor));}
    @PostMapping("/generation/queue") public ResponseEntity<?> queueScreens(@RequestBody Map<String,Object>b,HttpServletRequest request){return guardedDesignMutation(request,actor->service.queueScreenGeneration(Long.parseLong(String.valueOf(b.get("batchId"))),actor));}
    @GetMapping("/generation/batches/{batchId}/export") public ResponseEntity<?> exportScreens(@PathVariable long batchId){try{return ResponseEntity.ok(service.exportScreenGeneration(batchId));}catch(Exception e){return bad(e);}}
    @PostMapping("/cases") public ResponseEntity<?> simulationCase(@RequestBody Map<String,Object>b,HttpServletRequest request){return guardedDesignMutation(request,actor->{service.createCase(b);return Map.of("success",true);});}
    @PostMapping("/artifacts") public ResponseEntity<?> artifact(@RequestBody Map<String,Object>b,HttpServletRequest request){return guardedDesignMutation(request,actor->{service.saveArtifact(b);return Map.of("success",true);});}
    @PostMapping("/runs") public ResponseEntity<?> runCase(@RequestBody Map<String,Object>b,HttpServletRequest request){return guardedDesignMutation(request,actor->{service.recordRun(b,actor);return Map.of("success",true);});}
    @PostMapping("/standard-pack") public ResponseEntity<?> standardPack(HttpServletRequest request){return guardedDesignMutation(request,actor->service.installStandardPack());}
    private ResponseEntity<?> bad(Exception e){return ResponseEntity.badRequest().body(Map.of("success",false,"message",e.getMessage()==null?"Request failed":e.getMessage()));}
    private ResponseEntity<?> guardedDesignMutation(HttpServletRequest request,DesignMutation command){
        var context=currentUserContextService.resolve(request);ResponseEntity<?> denied=designMutationAccessFailure(context);if(denied!=null)return denied;
        try{return ResponseEntity.ok(command.execute(context.getUserId()));}catch(Exception e){return bad(e);}
    }
    private ResponseEntity<?> processActorOperation(HttpServletRequest request,DesignMutation command){
        var context=currentUserContextService.resolve(request);
        if(context==null||!context.isAuthenticated()||context.getUserId()==null||context.getUserId().isBlank())
            return ResponseEntity.status(401).body(Map.of("success",false,"message","AUTHENTICATION_REQUIRED"));
        try{return ResponseEntity.ok(command.execute(context.getUserId()));}
        catch(SecurityException e){return ResponseEntity.status(403).body(Map.of("success",false,"message",e.getMessage()==null?"PROCESS_ACTOR_FORBIDDEN":e.getMessage()));}
        catch(Exception e){return bad(e);}
    }
    private ResponseEntity<?> workerAccessFailure(HttpServletRequest request){
        String supplied=request==null?"":request.getHeader("X-Resonance-Token");
        if(opsToken==null||opsToken.isBlank()||supplied==null||supplied.isBlank()
                ||!MessageDigest.isEqual(opsToken.getBytes(StandardCharsets.UTF_8),supplied.getBytes(StandardCharsets.UTF_8)))
            return ResponseEntity.status(401).body(Map.of("success",false,"message","WORKER_CONTROL_TOKEN_REQUIRED"));
        return null;
    }
    @FunctionalInterface private interface DesignMutation{Object execute(String actor) throws Exception;}
    private Map<String,Object> config(Object value){Map<String,Object> result=new java.util.LinkedHashMap<>();if(value instanceof Map<?,?> raw)raw.forEach((key,item)->result.put(String.valueOf(key),item));return result;}
    private boolean isPlatformAdministrator(CurrentUserContextService.CurrentUserContext context){
        if(context.isWebmaster())return true;
        String authority=context.getAuthorCode()==null?"":context.getAuthorCode().trim().toUpperCase(java.util.Locale.ROOT);
        return java.util.Set.of("ROLE_SYSTEM_MASTER","ROLE_SYSTEM_ADMIN").contains(authority);
    }
    private ResponseEntity<?> designMutationAccessFailure(CurrentUserContextService.CurrentUserContext context){
        if(context==null||!context.isAuthenticated()||context.getUserId()==null||context.getUserId().isBlank())
            return ResponseEntity.status(401).body(Map.of("success",false,"message","AUTHENTICATION_REQUIRED"));
        if(!context.isWebmaster()){
            String authority=context.getAuthorCode()==null?"":context.getAuthorCode().trim().toUpperCase(java.util.Locale.ROOT);
            if(!java.util.Set.of("ROLE_SYSTEM_MASTER","ROLE_SYSTEM_ADMIN").contains(authority))
            return ResponseEntity.status(403).body(Map.of("success",false,"message","DESIGN_ADMIN_REQUIRED"));
        }
        return null;
    }

    private ResponseEntity<?> systemReportAccessFailure(CurrentUserContextService.CurrentUserContext context){
        if(!context.isAuthenticated()||context.getUserId()==null||context.getUserId().isBlank())
            return ResponseEntity.status(401).body(Map.of("success",false,"message","AUTHENTICATION_REQUIRED"));
        if(context.isWebmaster())return null;
        String authority=context.getAuthorCode()==null?"":context.getAuthorCode().trim().toUpperCase(java.util.Locale.ROOT);
        if(java.util.Set.of("ROLE_SYSTEM_MASTER","ROLE_SYSTEM_ADMIN").contains(authority))return null;
        return ResponseEntity.status(403).body(Map.of("success",false,"message","SYSTEM_REPORT_ADMIN_REQUIRED"));
    }
}
