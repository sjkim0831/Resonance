package egovframework.com.feature.admin.web;

import egovframework.com.feature.admin.service.EmissionSiteRegistryService;
import egovframework.com.feature.auth.service.CurrentUserContextService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping({
    "/api/admin/emission/sites",
    "/admin/api/admin/emission/sites",
    "/en/admin/api/admin/emission/sites"
})
public class AdminEmissionSiteRegistryController {
    private final EmissionSiteRegistryService service;
    private final CurrentUserContextService currentUserContextService;

    @GetMapping
    public ResponseEntity<?> list(@RequestParam(defaultValue = "") String keyword,
                                  @RequestParam(defaultValue = "") String status,
                                  HttpServletRequest request) {
        var context = currentUserContextService.resolve(request);
        if (!context.isAuthenticated()) return ResponseEntity.status(401).body(Map.of("success", false, "message", "AUTHENTICATION_REQUIRED"));
        if (!allowed(context, "A0020105_VIEW")) return ResponseEntity.status(403).body(Map.of("success", false, "message", "SITE_VIEW_FORBIDDEN"));
        try { return ResponseEntity.ok(service.list(tenant(context), keyword, status)); }
        catch (IllegalArgumentException exception) { return ResponseEntity.badRequest().body(Map.of("success", false, "message", exception.getMessage())); }
    }

    @PostMapping
    public ResponseEntity<?> save(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        var context = currentUserContextService.resolve(request);
        if (!context.isAuthenticated()) return ResponseEntity.status(401).body(Map.of("success", false, "message", "AUTHENTICATION_REQUIRED"));
        if (!allowed(context, "A0020105_REGISTER") && !allowed(context, "A0020105_MANAGE")) return ResponseEntity.status(403).body(Map.of("success", false, "message", "SITE_WRITE_FORBIDDEN"));
        try { return ResponseEntity.ok(service.save(tenant(context), context.getUserId(), body)); }
        catch (SecurityException exception) { return ResponseEntity.status(403).body(Map.of("success", false, "message", exception.getMessage())); }
        catch (Exception exception) { return ResponseEntity.badRequest().body(Map.of("success", false, "message", exception.getMessage())); }
    }

    private String tenant(CurrentUserContextService.CurrentUserContext context) {
        return context.getInsttId().isBlank() ? "DEFAULT" : context.getInsttId();
    }

    private boolean allowed(CurrentUserContextService.CurrentUserContext context, String featureCode) {
        return context.isWebmaster() || context.getFeatureCodes().stream().anyMatch(featureCode::equalsIgnoreCase);
    }
}
