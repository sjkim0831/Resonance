package egovframework.com.platform.governance.web;

import egovframework.com.feature.auth.service.CurrentUserContextService;
import egovframework.com.platform.governance.service.ActorProcessGovernanceService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;
import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping({"/home/api/process-executions","/en/home/api/process-executions"})
public class ProcessExecutionApiController {
    private final ActorProcessGovernanceService service;
    private final CurrentUserContextService currentUserContextService;

    private String authenticatedUser(HttpServletRequest request) {
        var context=currentUserContextService.resolve(request);
        return context.isAuthenticated()?context.getUserId():null;
    }

    @GetMapping
    public ResponseEntity<?> find(@RequestParam String tenantId,@RequestParam String projectId,@RequestParam String processCode,HttpServletRequest request){
        String user=authenticatedUser(request);
        if(user==null)return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("success",false,"message","Authentication is required."));
        try{return ResponseEntity.ok(service.findProcessExecution(tenantId,projectId,processCode,user));}catch(SecurityException e){return forbidden(e);}catch(Exception e){return bad(e);}
    }

    @GetMapping("/screen-contract")
    public ResponseEntity<?> screenContract(@RequestParam String routePath){
        try{return ResponseEntity.ok(service.resolveGeneratedScreen(routePath));}catch(Exception e){return bad(e);}
    }

    @PostMapping("/start")
    public ResponseEntity<?> start(@RequestBody Map<String,Object> body,HttpServletRequest request){
        String user=authenticatedUser(request);
        if(user==null)return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("success",false,"message","Authentication is required."));
        try{return ResponseEntity.ok(service.startProcessExecution(body,user));}catch(SecurityException e){return forbidden(e);}catch(Exception e){return bad(e);}
    }

    @PostMapping("/qa-instance")
    public ResponseEntity<?> qaInstance(@RequestBody Map<String,Object> body,
                                        @RequestHeader(value="X-Carbonet-Test-Mode",required=false) String testMode,
                                        HttpServletRequest request){
        String user=authenticatedUser(request);
        if(user==null)return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("success",false,"message","Authentication is required."));
        if(!"1".equals(testMode))return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("success",false,"message","QA test mode is required."));
        try{return ResponseEntity.ok(service.manageQaProcessExecution(body,user));}
        catch(SecurityException e){return forbidden(e);}catch(IllegalStateException e){return conflict(e);}catch(Exception e){return bad(e);}
    }

    @PostMapping("/{executionId}/commands")
    public ResponseEntity<?> command(@PathVariable UUID executionId,@RequestBody Map<String,Object> body,HttpServletRequest request){
        String user=authenticatedUser(request);
        if(user==null)return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("success",false,"message","Authentication is required."));
        try{return ResponseEntity.ok(service.executeProcessCommand(executionId,body,user));}catch(SecurityException e){return forbidden(e);}catch(Exception e){return bad(e);}
    }

    @GetMapping("/draft")
    public ResponseEntity<?> draft(@RequestParam String tenantId,@RequestParam String projectId,@RequestParam String processCode,
                                   @RequestParam String stepCode,HttpServletRequest request){
        String user=authenticatedUser(request);
        if(user==null)return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("success",false,"message","Authentication is required."));
        try{return ResponseEntity.ok(service.loadWorkDraft(tenantId,projectId,processCode,stepCode,user));}
        catch(SecurityException e){return forbidden(e);}catch(IllegalStateException e){return conflict(e);}catch(Exception e){return bad(e);}
    }

    @GetMapping("/field-options")
    public ResponseEntity<?> fieldOptions(@RequestParam String tenantId,@RequestParam String projectId,
                                          @RequestParam String processCode,@RequestParam String stepCode,
                                          @RequestParam(defaultValue="") String keyword,HttpServletRequest request){
        String user=authenticatedUser(request);
        if(user==null)return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("success",false,"message","Authentication is required."));
        try{return ResponseEntity.ok(service.generatedFieldOptions(tenantId,projectId,processCode,stepCode,keyword,user));}
        catch(SecurityException e){return forbidden(e);}catch(Exception e){return bad(e);}
    }

    @GetMapping("/prerequisites")
    public ResponseEntity<?> prerequisites(@RequestParam String tenantId,@RequestParam String projectId,
                                           @RequestParam(defaultValue="") String processCode,
                                           @RequestParam(defaultValue="") String stepCode,HttpServletRequest request){
        String user=authenticatedUser(request);
        if(user==null)return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("success",false,"message","Authentication is required."));
        try{return ResponseEntity.ok(service.relayPrerequisiteReadiness(tenantId,projectId,processCode,stepCode));}
        catch(Exception e){return bad(e);}
    }

    @PutMapping("/draft")
    public ResponseEntity<?> saveDraft(@RequestBody Map<String,Object> body,HttpServletRequest request){
        String user=authenticatedUser(request);
        if(user==null)return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("success",false,"message","Authentication is required."));
        try{return ResponseEntity.ok(service.saveWorkDraft(body,user));}
        catch(SecurityException e){return forbidden(e);}catch(IllegalStateException e){return conflict(e);}catch(Exception e){return bad(e);}
    }

    @GetMapping("/qa-results")
    public ResponseEntity<?> qaResults(@RequestParam(defaultValue="") String processCode,HttpServletRequest request){
        String user=authenticatedUser(request);
        if(user==null)return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("success",false,"message","Authentication is required."));
        try{return ResponseEntity.ok(Map.of("success",true,"items",service.qaResults(processCode,user)));}
        catch(Exception e){return bad(e);}
    }

    @PostMapping("/qa-smoke")
    public ResponseEntity<?> qaSmoke(@RequestBody Map<String,Object> body,HttpServletRequest request){
        String user=authenticatedUser(request);
        if(user==null)return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("success",false,"message","Authentication is required."));
        String processCode=String.valueOf(body.getOrDefault("processCode","")).trim();
        if(processCode.isBlank())return bad(new IllegalArgumentException("processCode is required."));
        Map<String,Object> result;
        try{
            result=service.runProcessRuntimeSmoke(processCode,user);
            service.recordQaResult(processCode,String.valueOf(body.getOrDefault("stepCode","")),"PASSED",result,"",user);
            return ResponseEntity.ok(Map.of("success",true,"result",result));
        }catch(Exception e){
            service.recordQaResult(processCode,String.valueOf(body.getOrDefault("stepCode","")),"FAILED",Map.of(),e.getMessage()==null?"Runtime verification failed":e.getMessage(),user);
            return bad(e);
        }
    }

    private ResponseEntity<?> forbidden(Exception e){return ResponseEntity.status(HttpStatus.FORBIDDEN).body(Map.of("success",false,"message",e.getMessage()==null?"Access denied":e.getMessage()));}
    private ResponseEntity<?> conflict(Exception e){return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("success",false,"message",e.getMessage()==null?"The work version is stale.":e.getMessage()));}
    private ResponseEntity<?> bad(Exception e){return ResponseEntity.badRequest().body(Map.of("success",false,"message",e.getMessage()==null?"Request failed":e.getMessage()));}
}
