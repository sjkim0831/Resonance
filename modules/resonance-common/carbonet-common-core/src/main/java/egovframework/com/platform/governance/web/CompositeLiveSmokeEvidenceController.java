package egovframework.com.platform.governance.web;

import egovframework.com.feature.auth.service.CurrentUserContextService;
import egovframework.com.platform.governance.service.CompositeLiveSmokeEvidenceService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;

@RestController
@RequestMapping({"/home/api/composite-live-smoke-evidence",
    "/en/home/api/composite-live-smoke-evidence"})
public class CompositeLiveSmokeEvidenceController {
    private final CompositeLiveSmokeEvidenceService evidence;
    private final CurrentUserContextService currentUserContextService;
    private final String opsToken;

    public CompositeLiveSmokeEvidenceController(CompositeLiveSmokeEvidenceService evidence,
            CurrentUserContextService currentUserContextService,
            @Value("${resonance.ops.token:}") String opsToken){
        this.evidence=evidence;this.currentUserContextService=currentUserContextService;
        this.opsToken=opsToken;
    }

    @PostMapping
    public ResponseEntity<?> record(@RequestBody Map<String,Object> body,HttpServletRequest request){
        String supplied=request.getHeader("X-Resonance-Token");
        if(opsToken==null||opsToken.isBlank()||supplied==null||supplied.isBlank()
                ||!MessageDigest.isEqual(opsToken.getBytes(StandardCharsets.UTF_8),
                    supplied.getBytes(StandardCharsets.UTF_8)))
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(
                Map.of("success",false,"message","WORKER_CONTROL_TOKEN_REQUIRED"));
        var context=currentUserContextService.resolve(request);
        if(!context.isAuthenticated())return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(
            Map.of("success",false,"message","Authentication is required."));
        try{return ResponseEntity.ok(evidence.record(body,context.getUserId()));}
        catch(SecurityException error){return ResponseEntity.status(HttpStatus.FORBIDDEN).body(
            Map.of("success",false,"message",message(error)));}
        catch(IllegalStateException error){return ResponseEntity.status(HttpStatus.CONFLICT).body(
            Map.of("success",false,"message",message(error)));}
        catch(IllegalArgumentException error){return ResponseEntity.unprocessableEntity().body(
            Map.of("success",false,"message",message(error)));}
    }

    private static String message(Exception error){
        return error.getMessage()==null?"Live smoke evidence was rejected.":error.getMessage();
    }
}
