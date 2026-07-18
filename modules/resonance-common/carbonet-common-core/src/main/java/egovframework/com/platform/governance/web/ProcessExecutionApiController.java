package egovframework.com.platform.governance.web;

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
@RequestMapping({"/home/api/process-executions","/en/home/api/process-executions"})
public class ProcessExecutionApiController {
    private final ActorProcessGovernanceService service;

    @GetMapping
    public ResponseEntity<?> find(@RequestParam String tenantId,@RequestParam String projectId,@RequestParam String processCode){
        try{return ResponseEntity.ok(service.findProcessExecution(tenantId,projectId,processCode));}catch(Exception e){return bad(e);}
    }

    @GetMapping("/screen-contract")
    public ResponseEntity<?> screenContract(@RequestParam String routePath){
        try{return ResponseEntity.ok(service.resolveGeneratedScreen(routePath));}catch(Exception e){return bad(e);}
    }

    @PostMapping("/start")
    public ResponseEntity<?> start(@RequestBody Map<String,Object> body,HttpServletRequest request){
        Principal principal=request.getUserPrincipal();
        try{return ResponseEntity.ok(service.startProcessExecution(body,principal==null?"SYSTEM":principal.getName()));}catch(Exception e){return bad(e);}
    }

    @PostMapping("/{executionId}/commands")
    public ResponseEntity<?> command(@PathVariable UUID executionId,@RequestBody Map<String,Object> body,HttpServletRequest request){
        Principal principal=request.getUserPrincipal();
        try{return ResponseEntity.ok(service.executeProcessCommand(executionId,body,principal==null?"SYSTEM":principal.getName()));}catch(Exception e){return bad(e);}
    }

    private ResponseEntity<?> bad(Exception e){return ResponseEntity.badRequest().body(Map.of("success",false,"message",e.getMessage()==null?"Request failed":e.getMessage()));}
}
