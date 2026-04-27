package egovframework.com.feature.admin.framework.builder.web;

import egovframework.com.framework.builder.model.FrameworkBuilderCompatibilityCheckRequestVO;
import egovframework.com.framework.builder.service.FrameworkBuilderCompatibilityService;
import egovframework.com.feature.admin.framework.builder.support.CarbonetFrameworkApiResponseSource;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

@Controller
@RequestMapping({"/admin", "/en/admin"})
@RequiredArgsConstructor
@Slf4j
public class FrameworkBuilderCompatibilityController {

    private final FrameworkBuilderCompatibilityService frameworkBuilderCompatibilityService;
    private final CarbonetFrameworkApiResponseSource carbonetFrameworkApiResponseSource;

    @PostMapping("/api/admin/framework/builder-compatibility/check")
    @ResponseBody
    public ResponseEntity<?> runCompatibilityCheck(@RequestBody FrameworkBuilderCompatibilityCheckRequestVO request) {
        return execute(() -> frameworkBuilderCompatibilityService.runCompatibilityCheck(request));
    }

    @GetMapping("/api/admin/framework/builder-compatibility/checks/{compatibilityCheckRunId}")
    @ResponseBody
    public ResponseEntity<?> getCompatibilityCheck(@PathVariable String compatibilityCheckRunId) {
        return execute(() -> frameworkBuilderCompatibilityService.getCompatibilityCheck(compatibilityCheckRunId));
    }

    @GetMapping("/api/admin/framework/builder-compatibility/declarations")
    @ResponseBody
    public ResponseEntity<?> getCompatibilityDeclarations(@RequestParam(required = false) String builderVersion,
                                                          @RequestParam(required = false) String status) {
        return execute(() -> frameworkBuilderCompatibilityService.getCompatibilityDeclarations(builderVersion, status));
    }

    @GetMapping("/api/admin/framework/builder-compatibility/migration-plans")
    @ResponseBody
    public ResponseEntity<?> getMigrationPlans(@RequestParam(required = false) String fromBuilderVersion,
                                               @RequestParam(required = false) String toBuilderVersion,
                                               @RequestParam(required = false) String status) {
        return execute(() -> frameworkBuilderCompatibilityService.getMigrationPlans(fromBuilderVersion, toBuilderVersion, status));
    }

    private ResponseEntity<?> execute(CarbonetFrameworkApiResponseSource.ApiAction action) {
        return carbonetFrameworkApiResponseSource.execute(action, "Framework builder compatibility API failed.", log);
    }
}
