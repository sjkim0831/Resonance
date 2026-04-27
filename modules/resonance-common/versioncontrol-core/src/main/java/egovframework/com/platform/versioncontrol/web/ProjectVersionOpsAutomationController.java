package egovframework.com.platform.versioncontrol.web;

import egovframework.com.platform.versioncontrol.service.ProjectVersionOpsAutomationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping({
        "/api/platform/version-control",
        "/en/api/platform/version-control",
        "/admin/api/platform/version-control",
        "/en/admin/api/platform/version-control"
})
public class ProjectVersionOpsAutomationController {

    private final ProjectVersionOpsAutomationService projectVersionOpsAutomationService;

    @GetMapping("/operations")
    public ResponseEntity<Map<String, Object>> getOperations(HttpServletRequest request,
                                                             @RequestParam(value = "projectId", required = false) String projectId) {
        return ResponseEntity.ok(projectVersionOpsAutomationService.buildOperationsPayload(projectId, isEnglishRequest(request)));
    }

    @PostMapping("/operations/sync-and-deploy")
    public ResponseEntity<Map<String, Object>> startRemoteSyncAndDeploy(HttpServletRequest request,
                                                                        @RequestBody Map<String, Object> body) {
        boolean isEn = isEnglishRequest(request);
        String projectId = stringValue(body == null ? null : body.get("projectId"));
        String actorId = stringValue(body == null ? null : body.get("operator"));
        String releaseVersion = stringValue(body == null ? null : body.get("releaseVersion"));
        String releaseTitle = stringValue(body == null ? null : body.get("releaseTitle"));
        String releaseContent = stringValue(body == null ? null : body.get("releaseContent"));
        String remoteDeployMode = stringValue(body == null ? null : body.get("remoteDeployMode"));
        try {
            return ResponseEntity.ok(projectVersionOpsAutomationService.startRemoteSyncAndDeploy(
                    projectId,
                    actorId,
                    releaseVersion,
                    releaseTitle,
                    releaseContent,
                    remoteDeployMode,
                    isEn));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorBody(defaultIfBlank(ex.getMessage(),
                    isEn ? "The request is invalid." : "요청 값이 올바르지 않습니다.")));
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorBody(defaultIfBlank(ex.getMessage(),
                    isEn ? "The deploy record could not be saved." : "배포 이력을 저장하지 못했습니다.")));
        }
    }

    private Map<String, Object> errorBody(String message) {
        Map<String, Object> payload = new LinkedHashMap<String, Object>();
        payload.put("success", false);
        payload.put("message", message);
        return payload;
    }

    private String stringValue(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private String defaultIfBlank(String value, String fallback) {
        String normalized = stringValue(value);
        return normalized.isEmpty() ? fallback : normalized;
    }

    private boolean isEnglishRequest(HttpServletRequest request) {
        if (request != null) {
            String path = request.getRequestURI();
            if (path != null && path.startsWith("/en/")) {
                return true;
            }
            String language = request.getParameter("language");
            if ("en".equalsIgnoreCase(language)) {
                return true;
            }
        }
        Locale locale = request == null ? null : request.getLocale();
        return locale != null && locale.getLanguage().toLowerCase(Locale.ROOT).startsWith("en");
    }
}
