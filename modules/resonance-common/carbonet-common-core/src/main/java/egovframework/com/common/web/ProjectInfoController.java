package egovframework.com.common.web;

import egovframework.com.common.context.ProjectRuntimeContext;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.Map;

/**
 * Common endpoint for all runtimes to provide basic status information.
 */
@RestController
@RequestMapping("/api/runtime")
public class ProjectInfoController {

    private final ProjectRuntimeContext runtimeContext;

    public ProjectInfoController(ProjectRuntimeContext runtimeContext) {
        this.runtimeContext = runtimeContext;
    }

    @GetMapping("/info")
    public ResponseEntity<Map<String, Object>> getInfo() {
        Map<String, Object> info = new HashMap<>();
        info.put("projectId", runtimeContext.getProjectId());
        info.put("role", runtimeContext.getRole());
        info.put("status", "UP");
        info.put("timestamp", System.currentTimeMillis());
        return ResponseEntity.ok(info);
    }
}
