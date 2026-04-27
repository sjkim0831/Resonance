package egovframework.com.platform.codex.web;

import egovframework.com.platform.codex.model.CodexProvisionResponse;
import egovframework.com.platform.codex.service.CodexProvisioningService;
import egovframework.com.platform.request.codex.CodexProvisionRequest;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.egovframe.boot.security.bean.EgovReloadableFilterInvocationSecurityMetadataSource;
import org.egovframe.boot.security.userdetails.util.EgovUserDetailsHelper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.util.ObjectUtils;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseBody;

import jakarta.servlet.http.HttpServletRequest;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HashMap;
import java.util.Map;

@Controller
@RequestMapping({"/signin/codex", "/en/signin/codex"})
@RequiredArgsConstructor
@Slf4j
public class CodexProvisionApiController {

    private static final String API_KEY_HEADER = "X-CODEX-API-KEY";

    @Value("${security.codex.enabled:false}")
    private boolean codexEnabled;

    @Value("${security.codex.api-key:}")
    private String configuredApiKey;

    private final CodexProvisioningService codexProvisioningService;
    private final EgovReloadableFilterInvocationSecurityMetadataSource securityMetadataSource;

    @PostMapping("/login")
    @ResponseBody
    public ResponseEntity<?> login(@RequestHeader(value = API_KEY_HEADER, required = false) String apiKey,
                                   HttpServletRequest request) {
        return authenticate(apiKey, request);
    }

    @PostMapping("/provision")
    @ResponseBody
    public ResponseEntity<?> provision(@RequestHeader(value = API_KEY_HEADER, required = false) String apiKey,
                                       @RequestBody(required = false) CodexProvisionRequest provisionRequest,
                                       HttpServletRequest request) {
        ResponseEntity<?> authResult = authenticate(apiKey, request);
        if (!authResult.getStatusCode().is2xxSuccessful()) {
            return authResult;
        }

        try {
            CodexProvisionResponse response = codexProvisioningService.provision(provisionRequest);
            if (provisionRequest != null && provisionRequest.isReloadSecurityMetadata()) {
                EgovUserDetailsHelper.reloadSecurityMetadata(securityMetadataSource);
                response.setSecurityMetadataReloaded(true);
            }
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException e) {
            log.warn("Codex provisioning request rejected. reason={}", e.getMessage());
            return ResponseEntity.badRequest().body(errorBody("fail", e.getMessage()));
        } catch (Exception e) {
            log.error("Codex provisioning failed.", e);
            return ResponseEntity.internalServerError().body(errorBody("error", "Provisioning failed."));
        }
    }

    private ResponseEntity<?> authenticate(String apiKey, HttpServletRequest request) {
        if (!codexEnabled) {
            return ResponseEntity.status(503).body(errorBody("disabled", "Codex API is disabled."));
        }
        String expected = safeString(configuredApiKey);
        if (expected.isEmpty()) {
            return ResponseEntity.status(503).body(errorBody("misconfigured", "Codex API key is not configured."));
        }
        if (!equalsConstantTime(expected, safeString(apiKey))) {
            log.warn("Codex API authentication failed. uri={}", request == null ? "" : request.getRequestURI());
            return ResponseEntity.status(403).body(errorBody("forbidden", "Invalid Codex API key."));
        }
        return ResponseEntity.ok(successBody());
    }

    private Map<String, Object> successBody() {
        Map<String, Object> body = new HashMap<>();
        body.put("status", "success");
        return body;
    }

    private Map<String, Object> errorBody(String status, String message) {
        Map<String, Object> body = new HashMap<>();
        body.put("status", status);
        body.put("message", message);
        return body;
    }

    private boolean equalsConstantTime(String expected, String actual) {
        return MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8),
                actual.getBytes(StandardCharsets.UTF_8));
    }

    private String safeString(String value) {
        return ObjectUtils.isEmpty(value) ? "" : value.trim();
    }
}
