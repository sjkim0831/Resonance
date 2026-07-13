package egovframework.com.feature.home.web;

import egovframework.com.feature.home.service.EmissionProjectRegistryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequiredArgsConstructor
public class EmissionProjectRegistryController {
    private final EmissionProjectRegistryService service;

    @GetMapping({"/home/api/emission-projects", "/en/home/api/emission-projects"})
    public Map<String, Object> list(@RequestParam(defaultValue = "") String keyword,
                                    @RequestParam(defaultValue = "") String status,
                                    @RequestParam(defaultValue = "") String site,
                                    @RequestParam(defaultValue = "1") int page) {
        return service.list(keyword, status, site, page);
    }

    @GetMapping({"/home/api/emission-projects/options", "/en/home/api/emission-projects/options"})
    public Map<String, Object> options(@RequestParam(defaultValue = "") String keyword) { return service.options(keyword); }

    @GetMapping({"/home/api/emission-projects/name-availability", "/en/home/api/emission-projects/name-availability"})
    public Map<String, Object> nameAvailability(@RequestParam String name) { return Map.of("available", service.nameAvailable(name)); }

    @GetMapping({"/home/api/emission-projects/{id}", "/en/home/api/emission-projects/{id}"})
    public ResponseEntity<?> detail(@PathVariable String id) {
        try { return ResponseEntity.ok(service.detail(id)); }
        catch (IllegalArgumentException e) { return ResponseEntity.notFound().build(); }
    }

    @PostMapping({"/home/api/emission-projects/{id}/copy", "/en/home/api/emission-projects/{id}/copy"})
    public ResponseEntity<?> copy(@PathVariable String id, HttpServletRequest request) {
        if (!authenticated(request)) return ResponseEntity.status(401).body(Map.of("message", "로그인이 필요합니다."));
        try { return ResponseEntity.ok(Map.of("success", true, "id", service.copy(id))); }
        catch (IllegalArgumentException e) { return ResponseEntity.badRequest().body(Map.of("message", e.getMessage())); }
    }

    @GetMapping({"/home/api/emission-projects/{id}/activities","/en/home/api/emission-projects/{id}/activities"})
    public ResponseEntity<?> activities(@PathVariable String id,@RequestParam(defaultValue="") String keyword) { try{return ResponseEntity.ok(service.activities(id,keyword));}catch(IllegalArgumentException e){return ResponseEntity.notFound().build();} }

    @PostMapping({"/home/api/emission-projects/{id}/activities","/en/home/api/emission-projects/{id}/activities"})
    public ResponseEntity<?> saveActivity(@PathVariable String id,@RequestBody Map<String,Object> body,HttpServletRequest request) { if(!authenticated(request))return ResponseEntity.status(401).body(Map.of("message","로그인이 필요합니다."));try{return ResponseEntity.ok(Map.of("success",true,"id",service.saveActivity(id,body)));}catch(Exception e){return ResponseEntity.badRequest().body(Map.of("message",e.getMessage()));} }

    @PostMapping({"/home/api/emission-projects/{id}/activities/upload","/en/home/api/emission-projects/{id}/activities/upload"})
    public ResponseEntity<?> uploadActivities(@PathVariable String id,@RequestParam("file") MultipartFile file,HttpServletRequest request) { if(!authenticated(request))return ResponseEntity.status(401).body(Map.of("message","로그인이 필요합니다."));try{return ResponseEntity.ok(Map.of("success",true,"count",service.uploadActivities(id,file)));}catch(Exception e){return ResponseEntity.badRequest().body(Map.of("message",e.getMessage()));} }

    @PostMapping({"/home/api/emission-projects/{id}/activities/{activityId}/factor","/en/home/api/emission-projects/{id}/activities/{activityId}/factor"})
    public ResponseEntity<?> mapFactor(@PathVariable String id,@PathVariable long activityId,@RequestBody Map<String,Object> body,HttpServletRequest request) { if(!authenticated(request))return ResponseEntity.status(401).body(Map.of("message","로그인이 필요합니다."));try{return ResponseEntity.ok(Map.of("success",service.mapFactor(id,activityId,String.valueOf(body.get("factorId")))>0));}catch(Exception e){return ResponseEntity.badRequest().body(Map.of("message",e.getMessage()));} }

    @PostMapping({"/home/api/emission-projects/{id}/activities/auto-map","/en/home/api/emission-projects/{id}/activities/auto-map"})
    public ResponseEntity<?> autoMap(@PathVariable String id,HttpServletRequest request) { if(!authenticated(request))return ResponseEntity.status(401).body(Map.of("message","로그인이 필요합니다."));return ResponseEntity.ok(Map.of("success",true,"count",service.autoMap(id))); }

    @PostMapping({"/home/api/emission-projects", "/en/home/api/emission-projects"})
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        if (!authenticated(request)) return ResponseEntity.status(401).body(Map.of("message", "로그인이 필요합니다."));
        try { return ResponseEntity.ok(Map.of("success", true, "id", service.create(body))); }
        catch (IllegalArgumentException e) { return ResponseEntity.badRequest().body(Map.of("message", e.getMessage())); }
    }

    @DeleteMapping({"/home/api/emission-projects/{id}", "/en/home/api/emission-projects/{id}"})
    public ResponseEntity<?> delete(@PathVariable String id, HttpServletRequest request) {
        if (!authenticated(request)) return ResponseEntity.status(401).body(Map.of("message", "로그인이 필요합니다."));
        return ResponseEntity.ok(Map.of("success", service.delete(id) > 0));
    }

    private boolean authenticated(HttpServletRequest request) {
        if (request.getCookies() == null) return false;
        for (var cookie : request.getCookies()) if ("accessToken".equals(cookie.getName()) && !cookie.getValue().isBlank()) return true;
        return false;
    }
}
