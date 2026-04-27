package egovframework.com.web;

import egovframework.com.common.context.ProjectRuntimeContext;
import egovframework.com.common.governance.model.ProjectManifestVO;
import egovframework.com.common.governance.service.ProjectManifestService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/runtime")
@RequiredArgsConstructor
public class ProjectRuntimeInfoApiController {

    private final ProjectRuntimeContext projectRuntimeContext;
    private final ProjectManifestService projectManifestService;

    @GetMapping("/project-info")
    public ResponseEntity<?> projectInfo() {
        String projectId = safe(projectRuntimeContext == null ? null : projectRuntimeContext.getProjectId());
        if (projectId.isEmpty()) {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("status", "UNBOUND");
            response.put("message", "Project runtime is not bound to a projectId.");
            return ResponseEntity.ok(response);
        }

        try {
            ProjectManifestVO manifest = projectManifestService.getProjectManifest(projectId);
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("projectId", projectId);
            response.put("runtimeRole", safe(projectRuntimeContext == null ? null : projectRuntimeContext.getRole()));
            response.put("bound", manifest != null);
            if (manifest != null) {
                response.put("projectName", manifest.getMetadata() == null ? "" : safe(manifest.getMetadata().getProjectName()));
                response.put("runtimeStatus", manifest.getRuntime() == null ? "" : safe(manifest.getRuntime().getStatus()));
                response.put("runtimeMode", manifest.getRuntime() == null ? "" : safe(manifest.getRuntime().getRuntimeMode()));
                response.put("sharedRuntimeId", manifest.getRuntime() == null ? "" : safe(manifest.getRuntime().getSharedRuntimeId()));
                response.put("routePrefix", routingValue(manifest, "routePrefix"));
                response.put("selectorPath", routingValue(manifest, "selectorPath"));
                response.put("externalBaseUrl", routingValue(manifest, "externalBaseUrl"));
                response.put("domainHost", routingValue(manifest, "domainHost"));
                response.put("managementPath", routingValue(manifest, "managementPath"));
            }
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("projectId", projectId);
            response.put("status", "ERROR");
            response.put("message", e.getMessage());
            return ResponseEntity.internalServerError().body(response);
        }
    }

    private String routingValue(ProjectManifestVO manifest, String field) {
        if (manifest == null || manifest.getRuntime() == null || manifest.getRuntime().getRouting() == null) {
            return "";
        }
        ProjectManifestVO.Routing routing = manifest.getRuntime().getRouting();
        if ("routePrefix".equals(field)) {
            return safe(routing.getRoutePrefix());
        }
        if ("selectorPath".equals(field)) {
            return safe(routing.getSelectorPath());
        }
        if ("externalBaseUrl".equals(field)) {
            return safe(routing.getExternalBaseUrl());
        }
        if ("domainHost".equals(field)) {
            return safe(routing.getDomainHost());
        }
        if ("managementPath".equals(field)) {
            return safe(routing.getManagementPath());
        }
        return "";
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
