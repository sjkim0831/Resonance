package egovframework.com.platform.governance.web;

import egovframework.com.platform.governance.service.DynamicPageRuntimeService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.security.Principal;
import java.util.List;
import java.util.Map;

@RestController
@RequiredArgsConstructor
public class DynamicPageRuntimeApiController {
    private final DynamicPageRuntimeService service;

    @GetMapping({"/home/api/dynamic-pages/{pageId}","/en/home/api/dynamic-pages/{pageId}"})
    public ResponseEntity<?> page(@PathVariable String pageId){try{return ResponseEntity.ok(service.load(pageId));}catch(Exception e){return ResponseEntity.status(404).body(Map.of("success",false,"message",e.getMessage()));}}

    @PostMapping({"/admin/api/system/dynamic-pages/compile","/en/admin/api/system/dynamic-pages/compile"})
    public ResponseEntity<?> compile(@RequestBody Map<String,Object> body,HttpServletRequest request){try{Principal p=request.getUserPrincipal();@SuppressWarnings("unchecked") List<Map<String,Object>> pages=(List<Map<String,Object>>)body.getOrDefault("pages",List.of());return ResponseEntity.ok(service.compile(pages,p==null?"SYSTEM":p.getName()));}catch(Exception e){return ResponseEntity.badRequest().body(Map.of("success",false,"message",e.getMessage()));}}
}
