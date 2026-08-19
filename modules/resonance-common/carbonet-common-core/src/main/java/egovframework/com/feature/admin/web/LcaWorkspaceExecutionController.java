package egovframework.com.feature.admin.web;

import egovframework.com.feature.admin.service.LcaWorkspaceExecutionService;
import egovframework.com.feature.auth.service.CurrentUserContextService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping({"/admin/emission/api/lca-workspaces", "/en/admin/emission/api/lca-workspaces"})
@RequiredArgsConstructor
public class LcaWorkspaceExecutionController {
    private final LcaWorkspaceExecutionService service;
    private final CurrentUserContextService currentUserContextService;

    @GetMapping("/{processCode}")
    public ResponseEntity<?> list(@PathVariable String processCode, HttpServletRequest request) {
        return guarded(request, actor -> service.list(processCode));
    }

    @PostMapping("/{processCode}")
    public ResponseEntity<?> save(@PathVariable String processCode, @RequestBody Map<String, Object> body, HttpServletRequest request) {
        return guarded(request, actor -> service.save(processCode, body, actor));
    }

    @PostMapping("/{processCode}/{workspaceId}/commands")
    public ResponseEntity<?> command(@PathVariable String processCode, @PathVariable UUID workspaceId,
                                     @RequestBody Map<String, Object> body, HttpServletRequest request) {
        return guarded(request, actor -> service.command(processCode, workspaceId, body, actor));
    }

    private ResponseEntity<?> guarded(HttpServletRequest request, Operation operation) {
        try {
            var context = currentUserContextService.resolve(request);
            if (!context.isAuthenticated()) return ResponseEntity.status(401).body(Map.of("message", "authentication required"));
            return ResponseEntity.ok(operation.execute(context.getUserId()));
        } catch (SecurityException e) {
            return ResponseEntity.status(403).body(Map.of("message", safe(e.getMessage())));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of("message", safe(e.getMessage())));
        } catch (IllegalStateException e) {
            return ResponseEntity.status(409).body(Map.of("message", safe(e.getMessage())));
        }
    }

    private static String safe(String value) { return value == null ? "" : value; }

    @FunctionalInterface
    private interface Operation { Object execute(String actor); }
}
