package egovframework.com.platform.codex.web;

import egovframework.com.platform.executiongate.support.OperationsConsoleGateSupport;
import egovframework.com.platform.governance.dto.FullStackGovernanceAutoCollectRequest;
import egovframework.com.platform.governance.dto.FullStackGovernanceSaveRequest;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping({
        "/api/admin/full-stack-management",
        "/admin/api/admin/full-stack-management",
        "/en/admin/api/admin/full-stack-management"
})
public class AdminFullStackManagementApiController {

    private static final Logger log = LoggerFactory.getLogger(AdminFullStackManagementApiController.class);

    private final OperationsConsoleGateSupport operationsConsoleGateSupport;
    @GetMapping("/registry")
    public ResponseEntity<Map<String, Object>> getRegistry(
            @RequestParam(value = "menuCode", required = false) String menuCode,
            HttpServletRequest httpServletRequest) {
        return execute("full-stack.registry.get", menuCode, mapOf("menuCode", menuCode), httpServletRequest);
    }

    @PostMapping("/registry")
    public ResponseEntity<Map<String, Object>> saveRegistry(
            @RequestBody FullStackGovernanceSaveRequest request,
            HttpServletRequest httpServletRequest) {
        try {
            return execute(
                    "full-stack.registry.save",
                    request == null ? null : request.getMenuCode(),
                    mapOf("request", request),
                    httpServletRequest);
        } catch (IllegalArgumentException e) {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("success", false);
            response.put("message", safe(e.getMessage()));
            return ResponseEntity.badRequest().body(response);
        }
    }

    @PostMapping("/registry/auto-collect")
    public ResponseEntity<Map<String, Object>> autoCollectRegistry(
            @RequestBody(required = false) FullStackGovernanceAutoCollectRequest request,
            HttpServletRequest httpServletRequest) throws Exception {
        try {
            return execute(
                    "full-stack.registry.auto-collect",
                    request == null ? null : request.getMenuCode(),
                    mapOf("request", request),
                    httpServletRequest);
        } catch (IllegalArgumentException e) {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("success", false);
            response.put("message", safe(e.getMessage()));
            return ResponseEntity.badRequest().body(response);
        } catch (Exception e) {
            log.error("Failed to auto collect full-stack governance metadata. menuCode={}, pageId={}",
                    safe(request == null ? null : request.getMenuCode()),
                    safe(request == null ? null : request.getPageId()),
                    e);
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("success", false);
            response.put("message", "Error: " + safe(e.getMessage()));
            return ResponseEntity.status(500).body(response);
        }
    }

    private ResponseEntity<Map<String, Object>> execute(String actionKey,
                                                        String targetId,
                                                        Map<String, Object> parameters,
                                                        HttpServletRequest httpServletRequest) {
        return ResponseEntity.ok(operationsConsoleGateSupport.payloadForCurrentAdmin(
                httpServletRequest,
                actionKey,
                targetId,
                new LinkedHashMap<>(parameters)));
    }

    private Map<String, Object> mapOf(String key, Object value) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put(key, value);
        return map;
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
