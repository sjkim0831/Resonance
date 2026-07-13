package egovframework.com.feature.home.web;

import egovframework.com.feature.home.service.EmissionProjectRegistryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;

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
