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
    @PostMapping("/actors") public ResponseEntity<?> actor(@RequestBody Map<String,Object>b){return run(()->service.createActor(b));}
    @PostMapping("/assignments") public ResponseEntity<?> assignment(@RequestBody Map<String,Object>b){return run(()->service.assignActor(b));}
    @PostMapping("/processes") public ResponseEntity<?> process(@RequestBody Map<String,Object>b){return run(()->service.createProcess(b));}
    @PostMapping("/steps") public ResponseEntity<?> step(@RequestBody Map<String,Object>b){return run(()->service.addStep(b));}
    @PostMapping("/cases") public ResponseEntity<?> simulationCase(@RequestBody Map<String,Object>b){return run(()->service.createCase(b));}
    @PostMapping("/runs") public ResponseEntity<?> runCase(@RequestBody Map<String,Object>b, HttpServletRequest request){Principal p=request.getUserPrincipal();return run(()->service.recordRun(b,p==null?"SYSTEM":p.getName()));}
    private ResponseEntity<?> run(Runnable command){try{command.run();return ResponseEntity.ok(Map.of("success",true));}catch(Exception e){return ResponseEntity.badRequest().body(Map.of("success",false,"message",e.getMessage()==null?"Request failed":e.getMessage()));}}
}
