package egovframework.com.platform.governance.web;

import egovframework.com.platform.governance.service.ActorProcessGovernanceService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.security.Principal;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping({"/admin/api/system/actor-process","/en/admin/api/system/actor-process"})
public class ActorProcessGovernanceApiController {
    private final ActorProcessGovernanceService service;
    @GetMapping public Map<String,Object> dashboard(){return service.dashboard();}
    @GetMapping("/design-assets") public Map<String,Object> designAssets(){return service.designAssetInventory();}
    @PostMapping("/design-assets/preflight") public ResponseEntity<?> designPreflight(@RequestBody Map<String,Object>b,HttpServletRequest request){Principal p=request.getUserPrincipal();try{return ResponseEntity.ok(service.runDesignPreflight(b,p==null?"SYSTEM":p.getName()));}catch(Exception e){return ResponseEntity.badRequest().body(Map.of("success",false,"message",e.getMessage()==null?"Request failed":e.getMessage()));}}
    @PostMapping("/actors") public ResponseEntity<?> actor(@RequestBody Map<String,Object>b){return run(()->service.createActor(b));}
    @PostMapping("/assignments") public ResponseEntity<?> assignment(@RequestBody Map<String,Object>b){return run(()->service.assignActor(b));}
    @PostMapping("/processes") public ResponseEntity<?> process(@RequestBody Map<String,Object>b){return run(()->service.createProcess(b));}
    @PostMapping("/steps") public ResponseEntity<?> step(@RequestBody Map<String,Object>b,HttpServletRequest request){Principal p=request.getUserPrincipal();try{return ResponseEntity.ok(service.addStep(b,p==null?"SYSTEM":p.getName()));}catch(Exception e){return bad(e);}}
    @PostMapping("/development/plan") public ResponseEntity<?> plan(@RequestBody Map<String,Object>b,HttpServletRequest request){Principal p=request.getUserPrincipal();try{return ResponseEntity.ok(service.generateDevelopmentPlan(String.valueOf(b.get("processCode")),String.valueOf(b.get("stepCode")),p==null?"SYSTEM":p.getName()));}catch(Exception e){return bad(e);}}
    @PostMapping("/development/approve") public ResponseEntity<?> approve(@RequestBody Map<String,Object>b,HttpServletRequest request){Principal p=request.getUserPrincipal();try{return ResponseEntity.ok(service.approveDevelopmentPlan(String.valueOf(b.get("processCode")),String.valueOf(b.get("stepCode")),p==null?"SYSTEM":p.getName()));}catch(Exception e){return bad(e);}}
    @PostMapping("/development/claim") public ResponseEntity<?> claim(@RequestBody Map<String,Object>b){try{return ResponseEntity.ok(service.claimDevelopmentJob(String.valueOf(b.getOrDefault("workerId","AI_RUNNER"))));}catch(Exception e){return bad(e);}}
    @PostMapping("/development/heartbeat") public ResponseEntity<?> heartbeat(@RequestBody Map<String,Object>b){try{return ResponseEntity.ok(service.heartbeatDevelopmentJob(Long.parseLong(String.valueOf(b.get("jobId"))),String.valueOf(b.get("leaseToken")),String.valueOf(b.getOrDefault("workerId","AI_RUNNER"))));}catch(Exception e){return bad(e);}}
    @PostMapping("/development/complete") public ResponseEntity<?> complete(@RequestBody Map<String,Object>b){try{return ResponseEntity.ok(service.completeDevelopmentJob(b,String.valueOf(b.getOrDefault("workerId","AI_RUNNER"))));}catch(Exception e){return bad(e);}}
    @PostMapping("/development/retry") public ResponseEntity<?> retry(@RequestBody Map<String,Object>b,HttpServletRequest request){Principal p=request.getUserPrincipal();try{return ResponseEntity.ok(service.retryDevelopmentJob(Long.parseLong(String.valueOf(b.get("jobId"))),p==null?"SYSTEM":p.getName()));}catch(Exception e){return bad(e);}}
    @PostMapping("/references/scan") public ResponseEntity<?> scanReferences(@RequestBody Map<String,Object>b,HttpServletRequest request){Principal p=request.getUserPrincipal();try{return ResponseEntity.ok(service.scanReferences(String.valueOf(b.getOrDefault("rootPath","/opt/reference")),p==null?"SYSTEM":p.getName()));}catch(Exception e){return bad(e);}}
    @PostMapping("/generation/compile") public ResponseEntity<?> compileScreens(@RequestBody Map<String,Object>b,HttpServletRequest request){Principal p=request.getUserPrincipal();try{return ResponseEntity.ok(service.compileScreenBlueprints(b,p==null?"SYSTEM":p.getName()));}catch(Exception e){return bad(e);}}
    @PostMapping("/generation/queue") public ResponseEntity<?> queueScreens(@RequestBody Map<String,Object>b,HttpServletRequest request){Principal p=request.getUserPrincipal();try{return ResponseEntity.ok(service.queueScreenGeneration(Long.parseLong(String.valueOf(b.get("batchId"))),p==null?"SYSTEM":p.getName()));}catch(Exception e){return bad(e);}}
    @GetMapping("/generation/batches/{batchId}/export") public ResponseEntity<?> exportScreens(@PathVariable long batchId){try{return ResponseEntity.ok(service.exportScreenGeneration(batchId));}catch(Exception e){return bad(e);}}
    @PostMapping("/cases") public ResponseEntity<?> simulationCase(@RequestBody Map<String,Object>b){return run(()->service.createCase(b));}
    @PostMapping("/artifacts") public ResponseEntity<?> artifact(@RequestBody Map<String,Object>b){return run(()->service.saveArtifact(b));}
    @PostMapping("/runs") public ResponseEntity<?> runCase(@RequestBody Map<String,Object>b, HttpServletRequest request){Principal p=request.getUserPrincipal();return run(()->service.recordRun(b,p==null?"SYSTEM":p.getName()));}
    @PostMapping("/standard-pack") public ResponseEntity<?> standardPack(){try{return ResponseEntity.ok(service.installStandardPack());}catch(Exception e){return ResponseEntity.badRequest().body(Map.of("success",false,"message",e.getMessage()==null?"Request failed":e.getMessage()));}}
    private ResponseEntity<?> bad(Exception e){return ResponseEntity.badRequest().body(Map.of("success",false,"message",e.getMessage()==null?"Request failed":e.getMessage()));}
    private ResponseEntity<?> run(Runnable command){try{command.run();return ResponseEntity.ok(Map.of("success",true));}catch(Exception e){return ResponseEntity.badRequest().body(Map.of("success",false,"message",e.getMessage()==null?"Request failed":e.getMessage()));}}
}
