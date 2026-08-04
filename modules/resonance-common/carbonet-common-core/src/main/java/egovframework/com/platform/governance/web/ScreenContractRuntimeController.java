package egovframework.com.platform.governance.web;

import egovframework.com.platform.governance.service.ScreenContractRuntimeService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class ScreenContractRuntimeController {
    private final ScreenContractRuntimeService service;

    @GetMapping("/runtime/screens/{screenKey}")
    public ResponseEntity<?> screen(@PathVariable String screenKey) {
        try {
            Map<String,Object> result = service.load(screenKey);
            String etag = "\"" + result.get("contractHash") + "\"";
            return ResponseEntity.ok().cacheControl(CacheControl.noCache()).eTag(etag).body(result);
        } catch (Exception e) {
            return bad(e);
        }
    }

    @PostMapping({"/admin/api/system/runtime/screens/{screenKey}/publish","/en/admin/api/system/runtime/screens/{screenKey}/publish"})
    public ResponseEntity<?> publish(@PathVariable String screenKey,@RequestBody Map<String,Object> body,HttpServletRequest request) {
        Principal principal=request.getUserPrincipal();
        try { return ResponseEntity.ok(service.publish(screenKey,body,principal==null?"SYSTEM":principal.getName())); }
        catch (Exception e) { return bad(e); }
    }

    @PostMapping({"/admin/api/system/runtime/screens/{screenKey}/rollback","/en/admin/api/system/runtime/screens/{screenKey}/rollback"})
    public ResponseEntity<?> rollback(@PathVariable String screenKey,HttpServletRequest request) {
        Principal principal=request.getUserPrincipal();
        try { return ResponseEntity.ok(service.rollback(screenKey,principal==null?"SYSTEM":principal.getName())); }
        catch (Exception e) { return bad(e); }
    }

    private ResponseEntity<?> bad(Exception e) {
        return ResponseEntity.badRequest().body(Map.of("success",false,"message",e.getMessage()==null?"Request failed":e.getMessage()));
    }
}

