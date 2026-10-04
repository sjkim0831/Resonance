package egovframework.com.platform.governance.web;

import egovframework.com.feature.auth.service.CurrentUserContextService;
import egovframework.com.platform.governance.service.DynamicPageRuntimeService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
public class DynamicPageRuntimeApiController {
    private final DynamicPageRuntimeService service;
    private final CurrentUserContextService users;

    @Autowired
    public DynamicPageRuntimeApiController(DynamicPageRuntimeService service, CurrentUserContextService users) {
        this.service = service;
        this.users = users;
    }

    /** Source-compatible constructor retained for legacy endpoint tests/tools. */
    public DynamicPageRuntimeApiController(DynamicPageRuntimeService service) {
        this(service, null);
    }

    @GetMapping({"/home/api/dynamic-pages/{pageId}","/en/home/api/dynamic-pages/{pageId}"})
    public ResponseEntity<?> page(@PathVariable String pageId,HttpServletRequest request){return loadPage(()->service.load(pageId),request);}

    @GetMapping({"/home/api/dynamic-pages/resolve","/en/home/api/dynamic-pages/resolve"})
    public ResponseEntity<?> resolve(@RequestParam String routePath,HttpServletRequest request){return loadPage(()->service.loadByRoute(routePath),request);}

    @PostMapping({"/admin/api/system/dynamic-pages/{pageId}/publish","/en/admin/api/system/dynamic-pages/{pageId}/publish"})
    public ResponseEntity<?> publish(@PathVariable String pageId,@RequestBody Map<String,Object> body,HttpServletRequest request){
        var user=users.resolve(request);
        if(user==null||!user.isAuthenticated())return ResponseEntity.status(401).body(Map.of("success",false,"message","AUTHENTICATION_REQUIRED"));
        if(!user.isWebmaster()&&!java.util.Set.of("ROLE_SYSTEM_ADMIN","ROLE_SYSTEM_MASTER").contains(String.valueOf(user.getAuthorCode())))return ResponseEntity.status(403).body(Map.of("success",false,"message","PAGE_PUBLISH_FORBIDDEN"));
        try{
            @SuppressWarnings("unchecked") List<String> authorities=(List<String>)body.get("requiredAuthorities");
            return ResponseEntity.ok(service.publish(pageId,String.valueOf(body.get("routePath")),String.valueOf(body.get("menuCode")),authorities,
                    body.get("expectedVersion")==null?null:Integer.valueOf(String.valueOf(body.get("expectedVersion"))),user.getUserId()));
        }catch(IllegalStateException e){return ResponseEntity.status(409).body(Map.of("success",false,"message",e.getMessage()));}
        catch(IllegalArgumentException e){return ResponseEntity.badRequest().body(Map.of("success",false,"message",e.getMessage()));}
        catch(Exception e){return ResponseEntity.internalServerError().body(Map.of("success",false,"message","PAGE_PUBLISH_FAILED"));}
    }

    @PostMapping({"/admin/api/system/dynamic-pages/{pageId}/rollback","/en/admin/api/system/dynamic-pages/{pageId}/rollback"})
    public ResponseEntity<?> rollback(@PathVariable String pageId,@RequestBody Map<String,Object> body,HttpServletRequest request){
        var user=users.resolve(request);
        if(user==null||!user.isAuthenticated())return ResponseEntity.status(401).body(Map.of("success",false,"message","AUTHENTICATION_REQUIRED"));
        if(!user.isWebmaster()&&!java.util.Set.of("ROLE_SYSTEM_ADMIN","ROLE_SYSTEM_MASTER").contains(String.valueOf(user.getAuthorCode())))return ResponseEntity.status(403).body(Map.of("success",false,"message","PAGE_PUBLISH_FORBIDDEN"));
        try{return ResponseEntity.ok(service.rollback(pageId,Integer.parseInt(String.valueOf(body.get("versionNo"))),user.getUserId()));}
        catch(Exception e){return ResponseEntity.badRequest().body(Map.of("success",false,"message","PAGE_VERSION_NOT_FOUND"));}
    }

    private ResponseEntity<?> loadPage(java.util.function.Supplier<Map<String,Object>> load,HttpServletRequest request){
        var user=users.resolve(request);
        if(user==null||!user.isAuthenticated())return ResponseEntity.status(401).body(Map.of("success",false,"message","AUTHENTICATION_REQUIRED"));
        try{
            Map<String,Object> page=load.get();
            Object rawAuthorities=page.getOrDefault("requiredAuthorities",List.of("AUTHENTICATED"));
            java.util.Set<String> authorities=new java.util.HashSet<>();
            if(rawAuthorities instanceof Iterable<?> values){for(Object value:values)if(value!=null)authorities.add(String.valueOf(value).trim());}
            else if(rawAuthorities!=null){for(String value:String.valueOf(rawAuthorities).replace("[","").replace("]","").replace("\"","").split(","))if(!value.isBlank())authorities.add(value.trim());}
            String role=String.valueOf(user.getAuthorCode());
            boolean permissionGranted=authorities.stream().anyMatch(value->"AUTHENTICATED".equalsIgnoreCase(value)||value.equalsIgnoreCase(role));
            if(!user.isWebmaster()&&!permissionGranted)
                return ResponseEntity.status(403).body(Map.of("success",false,"message","PAGE_PERMISSION_DENIED"));
            return ResponseEntity.ok(page);
        }catch(IllegalArgumentException e){return ResponseEntity.status(404).body(Map.of("success",false,"message",e.getMessage()));}
        catch(Exception e){return ResponseEntity.internalServerError().body(Map.of("success",false,"message","DYNAMIC_PAGE_LOAD_FAILED"));}
    }

    @PostMapping({"/admin/api/system/dynamic-pages/compile","/en/admin/api/system/dynamic-pages/compile"})
    public ResponseEntity<?> compile(@RequestBody(required=false) Map<String,Object> body,HttpServletRequest request){return ResponseEntity.status(410).body(Map.of("success",false,"status","RETIRED","activationPolicy","SOURCE_IMMEDIATE_V1","replacement","/api/resonance-projects/design-assets/CCUS-PLATFORM/source"));}
}
