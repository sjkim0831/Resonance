package egovframework.com.platform.versioncontrol.web;

import egovframework.com.platform.versioncontrol.model.vo.DeployTraceVO;
import egovframework.com.platform.versioncontrol.model.vo.ReleaseUnitVO;
import egovframework.com.platform.versioncontrol.model.vo.RuntimePackageVO;
import egovframework.com.platform.versioncontrol.service.VersionControlService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/admin/version-control")
@RequiredArgsConstructor
public class VersionControlApiController {

    private final VersionControlService versionControlService;

    // --- Release Unit APIs ---

    @PostMapping("/release-units")
    public ResponseEntity<String> createReleaseUnit(@RequestBody ReleaseUnitVO releaseUnit) {
        String id = versionControlService.createReleaseUnit(releaseUnit);
        return ResponseEntity.ok(id);
    }

    @GetMapping("/release-units/{releaseUnitId}")
    public ResponseEntity<ReleaseUnitVO> getReleaseUnit(@PathVariable String releaseUnitId) {
        ReleaseUnitVO releaseUnit = versionControlService.getReleaseUnit(releaseUnitId);
        if (releaseUnit == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(releaseUnit);
    }

    @GetMapping("/projects/{projectId}/release-units")
    public ResponseEntity<List<ReleaseUnitVO>> getReleaseUnitsByProject(@PathVariable String projectId) {
        return ResponseEntity.ok(versionControlService.getReleaseUnitsByProject(projectId));
    }

    @PutMapping("/release-units/{releaseUnitId}/status")
    public ResponseEntity<Void> updateReleaseStatus(@PathVariable String releaseUnitId, @RequestParam String status) {
        versionControlService.updateReleaseStatus(releaseUnitId, status);
        return ResponseEntity.ok().build();
    }

    // --- Runtime Package APIs ---

    @PostMapping("/packages")
    public ResponseEntity<String> registerRuntimePackage(@RequestBody RuntimePackageVO runtimePackage) {
        String id = versionControlService.registerRuntimePackage(runtimePackage);
        return ResponseEntity.ok(id);
    }

    @GetMapping("/packages/{runtimePackageId}")
    public ResponseEntity<RuntimePackageVO> getRuntimePackage(@PathVariable String runtimePackageId) {
        RuntimePackageVO pack = versionControlService.getRuntimePackage(runtimePackageId);
        if (pack == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(pack);
    }

    @GetMapping("/release-units/{releaseUnitId}/packages")
    public ResponseEntity<List<RuntimePackageVO>> getPackagesByReleaseUnit(@PathVariable String releaseUnitId) {
        return ResponseEntity.ok(versionControlService.getPackagesByReleaseUnit(releaseUnitId));
    }

    // --- Deploy Trace APIs ---

    @PostMapping("/deploys/start")
    public ResponseEntity<String> recordDeployStart(@RequestBody DeployTraceVO deployTrace) {
        String id = versionControlService.recordDeployStart(deployTrace);
        return ResponseEntity.ok(id);
    }

    @PutMapping("/deploys/{deployTraceId}/result")
    public ResponseEntity<Void> recordDeployResult(@PathVariable String deployTraceId, 
                                                   @RequestParam String status, 
                                                   @RequestBody(required = false) String log) {
        versionControlService.recordDeployResult(deployTraceId, status, log);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/packages/{runtimePackageId}/deploys/latest")
    public ResponseEntity<DeployTraceVO> getLatestDeployTrace(@PathVariable String runtimePackageId, 
                                                              @RequestParam String targetEnv) {
        DeployTraceVO trace = versionControlService.getLatestDeployTrace(runtimePackageId, targetEnv);
        if (trace == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(trace);
    }

    @GetMapping("/projects/{projectId}/deploys")
    public ResponseEntity<List<DeployTraceVO>> getDeployHistory(@PathVariable String projectId, 
                                                                @RequestParam String targetEnv) {
        return ResponseEntity.ok(versionControlService.getDeployHistory(projectId, targetEnv));
    }
}
