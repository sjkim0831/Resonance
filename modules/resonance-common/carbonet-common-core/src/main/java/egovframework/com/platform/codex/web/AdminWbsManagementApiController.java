package egovframework.com.platform.codex.web;

import egovframework.com.feature.auth.service.CurrentUserContextService;
import egovframework.com.platform.executiongate.ExecutionGateRequestContext;
import egovframework.com.platform.executiongate.GateActorScope;
import egovframework.com.platform.executiongate.GateRouteScope;
import egovframework.com.platform.executiongate.download.BinaryDownloadGate;
import egovframework.com.platform.executiongate.download.BinaryDownloadGateRequest;
import egovframework.com.platform.executiongate.download.BinaryDownloadGateResponse;
import egovframework.com.platform.executiongate.support.OperationsConsoleGateSupport;
import egovframework.com.platform.governance.dto.WbsManagementSaveRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping({
        "/api/admin/wbs-management",
        "/admin/api/admin/wbs-management",
        "/en/admin/api/admin/wbs-management"
})
public class AdminWbsManagementApiController {

    private final BinaryDownloadGate binaryDownloadGate;
    private final OperationsConsoleGateSupport operationsConsoleGateSupport;
    private final CurrentUserContextService currentUserContextService;

    @GetMapping("/excel")
    public ResponseEntity<byte[]> downloadExcel(@RequestParam(value = "menuType", required = false) String menuType,
                                                @RequestParam(value = "statusFilter", required = false) String statusFilter,
                                                @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
                                                HttpServletRequest request) throws Exception {
        BinaryDownloadGateResponse response = binaryDownloadGate.download(new BinaryDownloadGateRequest(
                buildContext(request, "wbs.excel.download"),
                "wbs.excel.download",
                safe(menuType),
                Map.of(
                        "menuType", safe(menuType),
                        "statusFilter", safe(statusFilter),
                        "searchKeyword", safe(searchKeyword)
                )
        ));
        String encoded = URLEncoder.encode(response.fileName(), StandardCharsets.UTF_8.name()).replaceAll("\\+", "%20");

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(response.contentType()));
        headers.set(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename*=UTF-8''" + encoded);

        return ResponseEntity.ok()
                .headers(headers)
                .body(response.content());
    }

    @PostMapping("/entry")
    public ResponseEntity<Map<String, Object>> saveEntry(@RequestBody WbsManagementSaveRequest request,
                                                         HttpServletRequest httpServletRequest) {
        try {
            Map<String, Object> parameters = new LinkedHashMap<>();
            parameters.put("request", request);
            return ResponseEntity.ok(operationsConsoleGateSupport.payloadForCurrentAdmin(
                    httpServletRequest,
                    "wbs.entry.save",
                    request == null ? null : request.getMenuCode(),
                    parameters));
        } catch (IllegalArgumentException e) {
            Map<String, Object> response = new LinkedHashMap<>();
            response.put("success", false);
            response.put("message", safe(e.getMessage()));
            return ResponseEntity.badRequest().body(response);
        }
    }

    private ExecutionGateRequestContext buildContext(HttpServletRequest request, String actionKey) {
        CurrentUserContextService.CurrentUserContext userContext = request == null
                ? new CurrentUserContextService.CurrentUserContext()
                : currentUserContextService.resolve(request);
        return ExecutionGateRequestContext.of(
                null,
                resolveActorScope(userContext),
                GateRouteScope.OPERATIONS_CONSOLE,
                actionKey,
                userContext.getUserId(),
                request == null ? null : request.getHeader("X-Trace-Id"),
                request == null ? null : request.getHeader("X-Request-Id")
        );
    }

    private GateActorScope resolveActorScope(CurrentUserContextService.CurrentUserContext context) {
        String authorCode = context == null ? "" : safe(context.getAuthorCode());
        if ("ROLE_SYSTEM_MASTER".equals(authorCode) || "ROLE_OPERATION_ADMIN".equals(authorCode)) {
            return GateActorScope.COMMON_ADMIN_OPS;
        }
        if (!authorCode.isEmpty()) {
            return GateActorScope.PROJECT_ADMIN;
        }
        return GateActorScope.ANONYMOUS;
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
