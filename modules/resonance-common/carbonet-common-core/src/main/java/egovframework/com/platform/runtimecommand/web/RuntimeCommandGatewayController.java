package egovframework.com.platform.runtimecommand.web;

import egovframework.com.feature.auth.service.CurrentUserContextService;
import egovframework.com.platform.runtimecommand.service.RuntimeCommandGatewayService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import java.util.LinkedHashMap;
import java.util.Map;

@Controller
@RequestMapping({"/admin/system/runtime-command", "/en/admin/system/runtime-command"})
@RequiredArgsConstructor
public class RuntimeCommandGatewayController {

    private final RuntimeCommandGatewayService runtimeCommandGatewayService;
    private final CurrentUserContextService currentUserContextService;

    @PostMapping("/execute")
    @ResponseBody
    @SuppressWarnings("unchecked")
    public ResponseEntity<Map<String, Object>> execute(@RequestBody Map<String, Object> requestBody,
                                                       HttpServletRequest request) throws Exception {
        String commandId = safe(requestBody == null ? null : requestBody.get("commandId"));
        Object rawParams = requestBody == null ? null : requestBody.get("params");
        Map<String, Object> params = rawParams instanceof Map<?, ?> ? new LinkedHashMap<>((Map<String, Object>) rawParams) : Map.of();
        String actorId = safe(currentUserContextService.resolve(request).getUserId());
        Map<String, Object> response = runtimeCommandGatewayService.execute(commandId, params, actorId);
        if (Boolean.TRUE.equals(response.get("success"))) {
            return ResponseEntity.ok(response);
        }
        return ResponseEntity.badRequest().body(response);
    }

    private String safe(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }
}
