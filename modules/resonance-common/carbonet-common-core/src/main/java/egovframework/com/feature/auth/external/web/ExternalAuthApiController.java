package egovframework.com.feature.auth.external.web;

import egovframework.com.feature.auth.external.dto.request.ExternalAuthCompleteRequest;
import egovframework.com.feature.auth.external.dto.request.ExternalAuthStartRequest;
import egovframework.com.feature.auth.external.dto.response.ExternalAuthMethodResponse;
import egovframework.com.feature.auth.external.dto.response.ExternalAuthStartResponse;
import egovframework.com.feature.auth.external.service.ExternalAuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Controller
@RequestMapping({"/signin/external-auth", "/en/signin/external-auth"})
@RequiredArgsConstructor
public class ExternalAuthApiController {

    private final ExternalAuthService externalAuthService;

    @GetMapping("/methods")
    @ResponseBody
    public ResponseEntity<?> methods(HttpServletRequest request) {
        boolean english = request != null && request.getRequestURI() != null
                && request.getRequestURI().startsWith("/en/");
        List<ExternalAuthMethodResponse> methods = externalAuthService.getAvailableMethods(english);
        Map<String, Object> payload = new HashMap<>();
        payload.put("status", "success");
        payload.put("methods", methods);
        return ResponseEntity.ok(payload);
    }

    @PostMapping("/start")
    @ResponseBody
    public ResponseEntity<?> start(@RequestBody ExternalAuthStartRequest request,
            HttpServletRequest servletRequest) {
        try {
            return ResponseEntity.ok(externalAuthService.start(request, servletRequest));
        } catch (Exception e) {
            Map<String, Object> payload = new HashMap<>();
            payload.put("status", "fail");
            payload.put("errors", e.getMessage());
            return ResponseEntity.badRequest().body(payload);
        }
    }

    @PostMapping("/complete")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> complete(@RequestBody ExternalAuthCompleteRequest request,
            HttpServletRequest servletRequest, HttpServletResponse servletResponse) {
        try {
            return ResponseEntity.ok(externalAuthService.complete(request, servletRequest, servletResponse));
        } catch (Exception e) {
            Map<String, Object> payload = new HashMap<>();
            payload.put("status", "fail");
            payload.put("errors", e.getMessage());
            return ResponseEntity.badRequest().body(payload);
        }
    }
}
