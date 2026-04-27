package egovframework.com.platform.versioncontrol.web;

import egovframework.com.platform.versioncontrol.model.ProjectApplyUpgradeRequest;
import egovframework.com.platform.versioncontrol.model.ProjectRollbackRequest;
import egovframework.com.platform.versioncontrol.model.ProjectUpgradeImpactRequest;
import egovframework.com.platform.versioncontrol.model.ProjectVersionOverviewRequest;
import egovframework.com.platform.versioncontrol.model.ProjectVersionPageRequest;
import egovframework.com.platform.versioncontrol.service.ProjectVersionManagementService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Locale;

import jakarta.servlet.http.HttpServletRequest;

@RestController
@RequiredArgsConstructor
@RequestMapping({
        "/api/platform/version-control",
        "/en/api/platform/version-control",
        "/admin/api/platform/version-control",
        "/en/admin/api/platform/version-control"
})
@Slf4j
public class ProjectVersionManagementApiController {

    private final ProjectVersionManagementService projectVersionManagementService;

    @GetMapping("/overview")
    public ResponseEntity<Map<String, Object>> getOverview(HttpServletRequest servletRequest,
                                                           @ModelAttribute ProjectVersionOverviewRequest request) {
        return execute(servletRequest,
                () -> projectVersionManagementService.getProjectVersionOverview(request == null ? null : request.getProjectId()));
    }

    @GetMapping("/adapter-history")
    public ResponseEntity<Map<String, Object>> getAdapterHistory(HttpServletRequest servletRequest,
                                                                 @ModelAttribute ProjectVersionPageRequest request) {
        return execute(servletRequest, () -> projectVersionManagementService.getAdapterHistory(request));
    }

    @GetMapping("/release-units")
    public ResponseEntity<Map<String, Object>> getReleaseUnits(HttpServletRequest servletRequest,
                                                               @ModelAttribute ProjectVersionPageRequest request) {
        return execute(servletRequest, () -> projectVersionManagementService.getReleaseUnits(request));
    }

    @GetMapping("/server-deploy-state")
    public ResponseEntity<Map<String, Object>> getServerDeployState(HttpServletRequest servletRequest,
                                                                    @ModelAttribute ProjectVersionOverviewRequest request) {
        return execute(servletRequest,
                () -> projectVersionManagementService.getServerDeployState(request == null ? null : request.getProjectId()));
    }

    @GetMapping("/candidate-artifacts")
    public ResponseEntity<Map<String, Object>> getCandidateArtifacts(HttpServletRequest servletRequest,
                                                                     @ModelAttribute ProjectVersionPageRequest request) {
        return execute(servletRequest, () -> projectVersionManagementService.getCandidateArtifacts(request));
    }

    @GetMapping("/fleet-governance")
    public ResponseEntity<Map<String, Object>> getFleetGovernance(HttpServletRequest servletRequest,
                                                                  @ModelAttribute ProjectVersionPageRequest request) {
        return execute(servletRequest, () -> projectVersionManagementService.getFleetUpgradeGovernance(request));
    }

    @PostMapping("/upgrade-impact")
    public ResponseEntity<Map<String, Object>> analyzeUpgradeImpact(HttpServletRequest servletRequest,
                                                                    @RequestBody ProjectUpgradeImpactRequest request) {
        return execute(servletRequest, () -> projectVersionManagementService.analyzeUpgradeImpact(request));
    }

    @PostMapping("/apply-upgrade")
    public ResponseEntity<Map<String, Object>> applyUpgrade(HttpServletRequest servletRequest,
                                                            @RequestBody ProjectApplyUpgradeRequest request) {
        return execute(servletRequest, () -> projectVersionManagementService.applyUpgrade(request));
    }

    @PostMapping("/rollback")
    public ResponseEntity<Map<String, Object>> rollback(HttpServletRequest servletRequest,
                                                        @RequestBody ProjectRollbackRequest request) {
        return execute(servletRequest, () -> projectVersionManagementService.rollbackProject(request));
    }

    private ResponseEntity<Map<String, Object>> execute(HttpServletRequest servletRequest,
                                                        ControlPlaneAction action) {
        boolean isEn = isEnglishRequest(servletRequest);
        try {
            return ResponseEntity.ok(action.run());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(errorBody(defaultIfBlank(e.getMessage(),
                    isEn ? "The request is invalid." : "요청 값이 올바르지 않습니다.")));
        } catch (Exception e) {
            log.error("Project version management API failed.", e);
            return ResponseEntity.internalServerError().body(errorBody(
                    isEn ? "Project version management API failed." : "프로젝트 버전 관리 API 처리에 실패했습니다."));
        }
    }

    private Map<String, Object> errorBody(String message) {
        return orderedMap(
                "success", false,
                "message", message == null ? "" : message);
    }

    private Map<String, Object> orderedMap(Object... fields) {
        Map<String, Object> values = new LinkedHashMap<String, Object>();
        if (fields == null) {
            return values;
        }
        for (int index = 0; index + 1 < fields.length; index += 2) {
            values.put(String.valueOf(fields[index]), fields[index + 1]);
        }
        return values;
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

    private String defaultIfBlank(String value, String fallback) {
        String normalized = value == null ? "" : value.trim();
        return normalized.isEmpty() ? fallback : normalized;
    }

    @FunctionalInterface
    private interface ControlPlaneAction {
        Map<String, Object> run() throws Exception;
    }
}
