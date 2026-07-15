package egovframework.com.platform.governance.web;

import egovframework.com.platform.governance.service.HomeCompositionService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class HomeCompositionApiController {
    private final HomeCompositionService service;

    @GetMapping({"/admin/api/system/home-composition","/en/admin/api/system/home-composition"})
    public Map<String,Object> dashboard(@RequestParam(defaultValue="PUBLIC") String variant){return service.dashboard(variant);}

    @PutMapping({"/admin/api/system/home-composition/draft","/en/admin/api/system/home-composition/draft"})
    public ResponseEntity<?> save(@RequestBody Map<String,Object> body,HttpServletRequest request){
        try { Principal p=request.getUserPrincipal(); @SuppressWarnings("unchecked") List<Map<String,Object>> sections=(List<Map<String,Object>>)body.getOrDefault("sections",List.of()); return ResponseEntity.ok(service.saveDraft(String.valueOf(body.getOrDefault("variant","PUBLIC")),sections,p==null?"SYSTEM":p.getName())); }
        catch(Exception e){return ResponseEntity.badRequest().body(Map.of("success",false,"message",e.getMessage()));}
    }

    @PostMapping({"/admin/api/system/home-composition/publish","/en/admin/api/system/home-composition/publish"})
    public ResponseEntity<?> publish(@RequestBody Map<String,Object> body,HttpServletRequest request){
        try {Principal p=request.getUserPrincipal();return ResponseEntity.ok(service.publish(String.valueOf(body.getOrDefault("variant","PUBLIC")),p==null?"SYSTEM":p.getName()));}
        catch(Exception e){return ResponseEntity.badRequest().body(Map.of("success",false,"message",e.getMessage()));}
    }

    @GetMapping({"/api/home/composition","/en/api/home/composition"})
    public Map<String,Object> publicComposition(@RequestParam(defaultValue="PUBLIC") String variant){return service.published(variant);}
}
