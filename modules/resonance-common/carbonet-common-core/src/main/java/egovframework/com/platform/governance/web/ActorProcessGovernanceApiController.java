package egovframework.com.platform.governance.web;

import egovframework.com.feature.auth.service.CurrentUserContextService;
import egovframework.com.platform.governance.service.ActorProcessGovernanceService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.security.Principal;
import java.util.Map;
import java.util.UUID;

@RestController
@RequiredArgsConstructor
@RequestMapping({"/admin/api/system/actor-process","/en/admin/api/system/actor-process"})
public class ActorProcessGovernanceApiController {
    private final ActorProcessGovernanceService service;
    private final CurrentUserContextService currentUserContextService;
    @GetMapping public ResponseEntity<?> dashboard(HttpServletRequest request){var context=currentUserContextService.resolve(request);ResponseEntity<?> denied=systemReportAccessFailure(context);return denied==null?ResponseEntity.ok(service.dashboard()):denied;}
    @GetMapping("/dashboard/core") public ResponseEntity<?> dashboardCore(HttpServletRequest request){var context=currentUserContextService.resolve(request);ResponseEntity<?> denied=systemReportAccessFailure(context);return denied==null?ResponseEntity.ok(service.dashboardCore()):denied;}
    @GetMapping("/process-closing") public Map<String,Object> processClosing(){return service.processClosingStatus();}
    @PostMapping("/process-closing/audit") public ResponseEntity<?> auditProcessClosing(HttpServletRequest request){Principal p=request.getUserPrincipal();try{return ResponseEntity.ok(service.auditProcessClosing(p==null?"SYSTEM":p.getName()));}catch(Exception e){return bad(e);}}
    @GetMapping("/executable-screens") public Map<String,Object> executableScreens(@RequestParam(defaultValue="") String status,@RequestParam(defaultValue="0") int page,@RequestParam(defaultValue="100") int size){return service.executableScreens(status,page,size);}
    @GetMapping("/process-design") public ResponseEntity<?> processDesign(@RequestParam String processCode){try{return ResponseEntity.ok(service.processDesign(processCode));}catch(Exception e){return bad(e);}}
    @GetMapping("/cases") public ResponseEntity<?> cases(@RequestParam String processCode){try{return ResponseEntity.ok(service.simulationCases(processCode));}catch(Exception e){return bad(e);}}
    @GetMapping("/design-assets") public ResponseEntity<?> designAssets(HttpServletRequest request){var context=currentUserContextService.resolve(request);ResponseEntity<?> denied=systemReportAccessFailure(context);return denied==null?ResponseEntity.ok(service.designAssetInventory()):denied;}
    @GetMapping("/assets/search") public Map<String,Object> searchAssets(@RequestParam(defaultValue="") String query,@RequestParam(defaultValue="") String assetType,@RequestParam(defaultValue="30") int limit){return service.searchAssetCatalog(query,assetType,limit);}
    @GetMapping("/assets/impact") public ResponseEntity<?> assetImpact(@RequestParam String assetId,@RequestParam(defaultValue="2") int depth){try{return ResponseEntity.ok(service.assetImpact(assetId,depth));}catch(Exception e){return bad(e);}}
    @PostMapping("/assets/refresh") public ResponseEntity<?> refreshAssets(HttpServletRequest request){Principal p=request.getUserPrincipal();try{return ResponseEntity.ok(service.refreshAssetCatalog(p==null?"SYSTEM":p.getName()));}catch(Exception e){return bad(e);}}
    @PostMapping("/process-archetypes/bind-screen") public ResponseEntity<?> bindScreenArchetype(@RequestBody Map<String,Object>b,HttpServletRequest request){Principal p=request.getUserPrincipal();try{return ResponseEntity.ok(service.bindScreenProcessArchetype(b,p==null?"SYSTEM":p.getName()));}catch(Exception e){return bad(e);}}
    @PostMapping("/design-assets/preflight") public ResponseEntity<?> designPreflight(@RequestBody Map<String,Object>b,HttpServletRequest request){Principal p=request.getUserPrincipal();try{return ResponseEntity.ok(service.runDesignPreflight(b,p==null?"SYSTEM":p.getName()));}catch(Exception e){return ResponseEntity.badRequest().body(Map.of("success",false,"message",e.getMessage()==null?"Request failed":e.getMessage()));}}
    @PostMapping("/actors") public ResponseEntity<?> actor(@RequestBody Map<String,Object>b){return run(()->service.createActor(b));}
    @PostMapping("/work-types") public ResponseEntity<?> workType(@RequestBody Map<String,Object>b){return run(()->service.saveWorkType(b));}
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
    @PostMapping("/delivery/blueprints") public ResponseEntity<?> saveDeliveryBlueprint(@RequestBody Map<String,Object>b,HttpServletRequest request){Principal p=request.getUserPrincipal();try{return ResponseEntity.ok(service.saveProjectDeliveryBlueprint(b,p==null?"SYSTEM":p.getName()));}catch(Exception e){return bad(e);}}
    @PostMapping("/delivery/validate") public ResponseEntity<?> validateDeliveryBlueprint(@RequestBody Map<String,Object>b){try{return ResponseEntity.ok(service.validateProjectDeliveryBlueprint(String.valueOf(b.getOrDefault("blueprintCode",""))));}catch(Exception e){return bad(e);}}
    @PostMapping("/delivery/apply") public ResponseEntity<?> applyDeliveryBlueprint(@RequestBody Map<String,Object>b,HttpServletRequest request){Principal p=request.getUserPrincipal();try{return ResponseEntity.ok(service.applyProjectDeliveryBlueprint(b,p==null?"SYSTEM":p.getName()));}catch(Exception e){return bad(e);}}
    @PostMapping("/processes") public ResponseEntity<?> process(@RequestBody Map<String,Object>b){return run(()->service.createProcess(b));}
    @PostMapping("/steps") public ResponseEntity<?> step(@RequestBody Map<String,Object>b,HttpServletRequest request){Principal p=request.getUserPrincipal();try{return ResponseEntity.ok(service.addStep(b,p==null?"SYSTEM":p.getName()));}catch(Exception e){return bad(e);}}
    @PostMapping("/development/plan") public ResponseEntity<?> plan(@RequestBody Map<String,Object>b,HttpServletRequest request){Principal p=request.getUserPrincipal();try{return ResponseEntity.ok(service.generateDevelopmentPlan(String.valueOf(b.get("processCode")),String.valueOf(b.get("stepCode")),p==null?"SYSTEM":p.getName()));}catch(Exception e){return bad(e);}}
    @PostMapping("/development/bootstrap-process") public ResponseEntity<?> bootstrapProcess(@RequestBody Map<String,Object>b,HttpServletRequest request){Principal p=request.getUserPrincipal();try{return ResponseEntity.ok(service.bootstrapProcessDevelopment(b,p==null?"SYSTEM":p.getName()));}catch(Exception e){return bad(e);}}
    @PostMapping("/development/direct") public ResponseEntity<?> directDevelopment(@RequestBody Map<String,Object>b,HttpServletRequest request){Principal p=request.getUserPrincipal();try{return ResponseEntity.ok(service.executeDesignDirectDevelopment(b,p==null?"SYSTEM":p.getName()));}catch(Exception e){return bad(e);}}
    @PostMapping("/design/save-and-generate") public ResponseEntity<?> saveDesignAndGenerate(@RequestBody Map<String,Object>b,HttpServletRequest request){Principal p=request.getUserPrincipal();try{return ResponseEntity.ok(service.saveDesignAndGenerate(b,p==null?"SYSTEM":p.getName()));}catch(Exception e){return bad(e);}}
    @PostMapping("/development/approve") public ResponseEntity<?> approve(@RequestBody Map<String,Object>b,HttpServletRequest request){Principal p=request.getUserPrincipal();try{return ResponseEntity.ok(service.approveDevelopmentPlan(String.valueOf(b.get("processCode")),String.valueOf(b.get("stepCode")),p==null?"SYSTEM":p.getName()));}catch(Exception e){return bad(e);}}
    @PostMapping("/development/preflight") public ResponseEntity<?> developmentPreflight(@RequestBody Map<String,Object>b,HttpServletRequest request){Principal p=request.getUserPrincipal();try{return ResponseEntity.ok(service.runScreenDevelopmentPreflight(String.valueOf(b.get("processCode")),String.valueOf(b.get("stepCode")),p==null?"SYSTEM":p.getName()));}catch(Exception e){return bad(e);}}
    @PostMapping("/design/validate") public ResponseEntity<?> validateDesign(@RequestBody Map<String,Object>b,HttpServletRequest request){Principal p=request.getUserPrincipal();try{return ResponseEntity.ok(service.validateProcessDesign(String.valueOf(b.get("processCode")),p==null?"SYSTEM":p.getName()));}catch(Exception e){return bad(e);}}
    @PostMapping("/design/generate-professional-graph") public ResponseEntity<?> generateProfessionalGraph(@RequestBody(required=false) Map<String,Object>b,HttpServletRequest request){Principal p=request.getUserPrincipal();try{String process=b==null?null:String.valueOf(b.getOrDefault("processCode",""));return ResponseEntity.ok(service.generateProfessionalDesignGraph(process,p==null?"SYSTEM":p.getName()));}catch(Exception e){return bad(e);}}
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
    @PostMapping("/screen-workflow-test") public ResponseEntity<?> runScreenWorkflowTest(@RequestBody Map<String,Object>b,HttpServletRequest request){Principal p=request.getUserPrincipal();try{return ResponseEntity.ok(service.runDeterministicScreenWorkflowTest(b,p==null?"SYSTEM":p.getName()));}catch(Exception e){return bad(e);}}
    @GetMapping("/screen-workflow-test-cases") public ResponseEntity<?> screenWorkflowTestCases(@RequestParam long screenResourceId,@RequestParam String processCode,@RequestParam String stepCode,@RequestParam(defaultValue="ALL") String capabilityCode){try{return ResponseEntity.ok(service.screenWorkflowTestCases(screenResourceId,processCode,stepCode,capabilityCode));}catch(Exception e){return bad(e);}}
    @PostMapping("/screen-workflow-test-cases") public ResponseEntity<?> saveScreenWorkflowTestCase(@RequestBody Map<String,Object>b,HttpServletRequest request){Principal p=request.getUserPrincipal();try{return ResponseEntity.ok(service.saveScreenWorkflowTestCase(b,p==null?"SYSTEM":p.getName()));}catch(Exception e){return bad(e);}}
    @GetMapping("/qa-datasets") public ResponseEntity<?> qaDatasets(@RequestParam String processCode,@RequestParam(defaultValue="") String stepCode){try{return ResponseEntity.ok(service.qaProcessCaseCatalog(processCode,stepCode));}catch(Exception e){return bad(e);}}
    @GetMapping("/qa-sessions/latest") public ResponseEntity<?> qaSession(@RequestParam String processCode,@RequestParam(defaultValue="") String projectId){try{return ResponseEntity.ok(service.qaProcessTestSession(processCode,projectId));}catch(Exception e){return bad(e);}}
    @PostMapping("/qa-sessions") public ResponseEntity<?> saveQaSession(@RequestBody Map<String,Object>b,HttpServletRequest request){Principal p=request.getUserPrincipal();try{return ResponseEntity.ok(service.saveQaProcessTestSession(b,p==null?"SYSTEM":p.getName()));}catch(Exception e){return bad(e);}}
    @PostMapping("/common-features/install") public ResponseEntity<?> installFeature(@RequestBody Map<String,Object>b,HttpServletRequest request){Principal p=request.getUserPrincipal();try{return ResponseEntity.ok(service.installCommonFeature(String.valueOf(b.get("featureCode")),String.valueOf(b.getOrDefault("projectScope","PLATFORM")),p==null?"SYSTEM":p.getName(),config(b.get("configuration"))));}catch(Exception e){return bad(e);}}
    @PostMapping("/professional-screen-contracts") public ResponseEntity<?> professionalScreenContract(@RequestBody Map<String,Object>b,HttpServletRequest request){Principal p=request.getUserPrincipal();try{return ResponseEntity.ok(service.saveProfessionalScreenContract(b,p==null?"SYSTEM":p.getName()));}catch(Exception e){return bad(e);}}
    @PostMapping("/professional-screen-contracts/preview")
    public ResponseEntity<?> professionalScreenContractPreview(@RequestBody Map<String,Object>b,HttpServletRequest request){
        var context=currentUserContextService.resolve(request);ResponseEntity<?> denied=systemReportAccessFailure(context);if(denied!=null)return denied;
        try{return ResponseEntity.ok(service.saveProfessionalScreenContractPreview(b,context.getUserId()));}catch(Exception e){return bad(e);}
    }
    @PostMapping("/professional-factory/execute") public ResponseEntity<?> executeProfessionalFactory(@RequestBody Map<String,Object>b,HttpServletRequest request){Principal p=request.getUserPrincipal();try{return ResponseEntity.ok(service.executeProfessionalFactory(b,p==null?"SYSTEM":p.getName()));}catch(Exception e){return bad(e);}}
    @PostMapping("/professional-factory/evidence") public ResponseEntity<?> recordProfessionalEvidence(@RequestBody Map<String,Object>b,HttpServletRequest request){Principal p=request.getUserPrincipal();try{return ResponseEntity.ok(service.recordProfessionalEvidence(b,p==null?"SYSTEM":p.getName()));}catch(Exception e){return bad(e);}}
    @PostMapping("/professional-factory/assemble-assets") public ResponseEntity<?> assembleAssets(@RequestBody Map<String,Object>b,HttpServletRequest request){Principal p=request.getUserPrincipal();try{return ResponseEntity.ok(service.assembleScreenAssets(String.valueOf(b.get("processCode")),p==null?"SYSTEM":p.getName()));}catch(Exception e){return bad(e);}}
    @PostMapping("/executions/start") public ResponseEntity<?> startExecution(@RequestBody Map<String,Object>b,HttpServletRequest request){Principal p=request.getUserPrincipal();try{return ResponseEntity.ok(service.startProcessExecution(b,p==null?"SYSTEM":p.getName()));}catch(Exception e){return bad(e);}}
    @PostMapping("/executions/{executionId}/commands") public ResponseEntity<?> executeCommand(@PathVariable UUID executionId,@RequestBody Map<String,Object>b,HttpServletRequest request){Principal p=request.getUserPrincipal();try{return ResponseEntity.ok(service.executeProcessCommand(executionId,b,p==null?"SYSTEM":p.getName()));}catch(Exception e){return bad(e);}}
    @PostMapping("/backend/verify") public ResponseEntity<?> verifyBackend(@RequestBody Map<String,Object>b,HttpServletRequest request){Principal p=request.getUserPrincipal();try{return ResponseEntity.ok(service.verifyBackendProcessContracts(String.valueOf(b.getOrDefault("sourceCommit","")),p==null?"SYSTEM":p.getName()));}catch(Exception e){return bad(e);}}
    @PostMapping("/backend/runtime-smoke") public ResponseEntity<?> runtimeSmoke(@RequestParam(defaultValue="") String processCode,HttpServletRequest request){Principal p=request.getUserPrincipal();try{return ResponseEntity.ok(service.runProcessRuntimeSmoke(processCode,p==null?"SYSTEM":p.getName()));}catch(Exception e){return bad(e);}}
    @GetMapping("/backend/runtime-smoke/{executionId}/rollback-check") public ResponseEntity<?> runtimeSmokeRollback(@PathVariable UUID executionId){try{return ResponseEntity.ok(service.verifyProcessRuntimeSmokeRollback(executionId));}catch(Exception e){return bad(e);}}
    @PostMapping("/development/claim") public ResponseEntity<?> claim(@RequestBody Map<String,Object>b){try{return ResponseEntity.ok(service.claimDevelopmentJob(String.valueOf(b.getOrDefault("workerId","AI_RUNNER"))));}catch(Exception e){return bad(e);}}
    @PostMapping("/development/heartbeat") public ResponseEntity<?> heartbeat(@RequestBody Map<String,Object>b){try{return ResponseEntity.ok(service.heartbeatDevelopmentJob(Long.parseLong(String.valueOf(b.get("jobId"))),String.valueOf(b.get("leaseToken")),String.valueOf(b.getOrDefault("workerId","AI_RUNNER"))));}catch(Exception e){return bad(e);}}
    @PostMapping("/development/complete") public ResponseEntity<?> complete(@RequestBody Map<String,Object>b){try{return ResponseEntity.ok(service.completeDevelopmentJob(b,String.valueOf(b.getOrDefault("workerId","AI_RUNNER"))));}catch(Exception e){return bad(e);}}
    @PostMapping("/development/retry") public ResponseEntity<?> retry(@RequestBody Map<String,Object>b,HttpServletRequest request){Principal p=request.getUserPrincipal();try{return ResponseEntity.ok(service.retryDevelopmentJob(Long.parseLong(String.valueOf(b.get("jobId"))),p==null?"SYSTEM":p.getName()));}catch(Exception e){return bad(e);}}
    @PostMapping("/development/request") public ResponseEntity<?> requestDevelopment(@RequestBody Map<String,Object>b,HttpServletRequest request){Principal p=request.getUserPrincipal();try{return ResponseEntity.ok(service.requestDevelopmentJob(Long.parseLong(String.valueOf(b.get("jobId"))),p==null?"SYSTEM":p.getName()));}catch(Exception e){return bad(e);}}
    @PostMapping("/references/scan") public ResponseEntity<?> scanReferences(@RequestBody Map<String,Object>b,HttpServletRequest request){Principal p=request.getUserPrincipal();try{return ResponseEntity.ok(service.scanReferences(String.valueOf(b.getOrDefault("rootPath","/opt/reference")),p==null?"SYSTEM":p.getName()));}catch(Exception e){return bad(e);}}
    @PostMapping("/generation/compile") public ResponseEntity<?> compileScreens(@RequestBody Map<String,Object>b,HttpServletRequest request){Principal p=request.getUserPrincipal();try{return ResponseEntity.ok(service.compileScreenBlueprints(b,p==null?"SYSTEM":p.getName()));}catch(Exception e){return bad(e);}}
    @PostMapping("/generation/compile-and-queue") public ResponseEntity<?> compileAndQueueScreens(@RequestBody Map<String,Object>b,HttpServletRequest request){Principal p=request.getUserPrincipal();try{return ResponseEntity.ok(service.compileAndQueueScreens(b,p==null?"SYSTEM":p.getName()));}catch(Exception e){return bad(e);}}
    @PostMapping("/generation/adopt-existing") public ResponseEntity<?> adoptExistingScreens(@RequestBody Map<String,Object>b,HttpServletRequest request){Principal p=request.getUserPrincipal();try{return ResponseEntity.ok(service.adoptExistingScreens(b,p==null?"SYSTEM":p.getName()));}catch(Exception e){return bad(e);}}
    @PostMapping("/generation/queue") public ResponseEntity<?> queueScreens(@RequestBody Map<String,Object>b,HttpServletRequest request){Principal p=request.getUserPrincipal();try{return ResponseEntity.ok(service.queueScreenGeneration(Long.parseLong(String.valueOf(b.get("batchId"))),p==null?"SYSTEM":p.getName()));}catch(Exception e){return bad(e);}}
    @GetMapping("/generation/batches/{batchId}/export") public ResponseEntity<?> exportScreens(@PathVariable long batchId){try{return ResponseEntity.ok(service.exportScreenGeneration(batchId));}catch(Exception e){return bad(e);}}
    @PostMapping("/cases") public ResponseEntity<?> simulationCase(@RequestBody Map<String,Object>b){return run(()->service.createCase(b));}
    @PostMapping("/artifacts") public ResponseEntity<?> artifact(@RequestBody Map<String,Object>b){return run(()->service.saveArtifact(b));}
    @PostMapping("/runs") public ResponseEntity<?> runCase(@RequestBody Map<String,Object>b, HttpServletRequest request){Principal p=request.getUserPrincipal();return run(()->service.recordRun(b,p==null?"SYSTEM":p.getName()));}
    @PostMapping("/standard-pack") public ResponseEntity<?> standardPack(){try{return ResponseEntity.ok(service.installStandardPack());}catch(Exception e){return ResponseEntity.badRequest().body(Map.of("success",false,"message",e.getMessage()==null?"Request failed":e.getMessage()));}}
    private ResponseEntity<?> bad(Exception e){return ResponseEntity.badRequest().body(Map.of("success",false,"message",e.getMessage()==null?"Request failed":e.getMessage()));}
    private ResponseEntity<?> run(Runnable command){try{command.run();return ResponseEntity.ok(Map.of("success",true));}catch(Exception e){return ResponseEntity.badRequest().body(Map.of("success",false,"message",e.getMessage()==null?"Request failed":e.getMessage()));}}
    private Map<String,Object> config(Object value){Map<String,Object> result=new java.util.LinkedHashMap<>();if(value instanceof Map<?,?> raw)raw.forEach((key,item)->result.put(String.valueOf(key),item));return result;}
    private boolean isPlatformAdministrator(CurrentUserContextService.CurrentUserContext context){
        if(context.isWebmaster())return true;
        String authority=context.getAuthorCode()==null?"":context.getAuthorCode().trim().toUpperCase(java.util.Locale.ROOT);
        return java.util.Set.of("ROLE_SYSTEM_MASTER","ROLE_SYSTEM_ADMIN","ROLE_OPERATION_ADMIN").contains(authority);
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
