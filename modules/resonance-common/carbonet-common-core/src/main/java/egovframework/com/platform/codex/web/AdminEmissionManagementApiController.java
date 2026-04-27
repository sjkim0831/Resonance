package egovframework.com.platform.codex.web;

import egovframework.com.feature.admin.web.*;
import egovframework.com.feature.admin.dto.request.EmissionManagementElementSaveRequest;
import egovframework.com.feature.admin.dto.request.EmissionInputSessionSaveRequest;
import egovframework.com.platform.executiongate.support.OperationsConsoleGateSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping({
        "/api/admin/emission-management",
        "/admin/api/admin/emission-management",
        "/en/admin/api/admin/emission-management"
})
public class AdminEmissionManagementApiController {

    private final AdminReactRouteSupport adminReactRouteSupport;
    private final OperationsConsoleGateSupport operationsConsoleGateSupport;

    @GetMapping("/categories")
    public ResponseEntity<Map<String, Object>> getCategories(
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            HttpServletRequest httpServletRequest) {
        return execute("emission.categories.get", mapOf("searchKeyword", searchKeyword), null, httpServletRequest);
    }

    @GetMapping("/categories/{categoryId}/tiers")
    public ResponseEntity<Map<String, Object>> getTiers(@PathVariable("categoryId") Long categoryId,
                                                        HttpServletRequest httpServletRequest) {
        return execute("emission.tiers.get", mapOf("categoryId", categoryId), String.valueOf(categoryId), httpServletRequest);
    }

    @GetMapping("/categories/{categoryId}/tiers/{tier}/variables")
    public ResponseEntity<Map<String, Object>> getVariableDefinitions(@PathVariable("categoryId") Long categoryId,
                                                                      @PathVariable("tier") Integer tier,
                                                                      HttpServletRequest httpServletRequest) {
        Map<String, Object> parameters = mapOf("categoryId", categoryId);
        parameters.put("tier", tier);
        return execute("emission.variables.get", parameters, categoryId + ":" + tier, httpServletRequest);
    }

    @PostMapping("/input-sessions")
    public ResponseEntity<Map<String, Object>> saveInputSession(@RequestBody EmissionInputSessionSaveRequest request,
                                                                HttpServletRequest httpServletRequest) {
        return execute("emission.input-session.save", withRequest(request, httpServletRequest), null, httpServletRequest);
    }

    @GetMapping("/input-sessions/{sessionId}")
    public ResponseEntity<Map<String, Object>> getInputSession(@PathVariable("sessionId") Long sessionId,
                                                               HttpServletRequest httpServletRequest) {
        return execute("emission.input-session.get", mapOf("sessionId", sessionId), String.valueOf(sessionId), httpServletRequest);
    }

    @PostMapping("/input-sessions/{sessionId}/calculate")
    public ResponseEntity<Map<String, Object>> calculateInputSession(@PathVariable("sessionId") Long sessionId,
                                                                     HttpServletRequest httpServletRequest) {
        return execute("emission.input-session.calculate", mapOf("sessionId", sessionId), String.valueOf(sessionId), httpServletRequest);
    }

    @GetMapping("/lime/default-factor")
    public ResponseEntity<Map<String, Object>> getLimeDefaultFactor(HttpServletRequest httpServletRequest) {
        return execute("emission.lime-factor.get", Map.of(), null, httpServletRequest);
    }

    @GetMapping("/element-definitions")
    public ResponseEntity<Map<String, Object>> getElementDefinitions(HttpServletRequest request) {
        Map<String, Object> parameters = new LinkedHashMap<>();
        parameters.put("isEn", adminReactRouteSupport.isEnglishRequest(request, null));
        return execute("emission.element-definitions.get", parameters, null, request);
    }

    @PostMapping("/element-definitions")
    public ResponseEntity<Map<String, Object>> saveElementDefinition(@RequestBody EmissionManagementElementSaveRequest request,
                                                                     HttpServletRequest httpServletRequest) {
        Map<String, Object> parameters = withRequest(request, httpServletRequest);
        parameters.put("isEn", adminReactRouteSupport.isEnglishRequest(httpServletRequest, null));
        return execute("emission.element-definitions.save", parameters, request == null ? null : request.getDefinitionId(), httpServletRequest);
    }

    @PostMapping("/definition-scopes/{draftId}/materialize")
    public ResponseEntity<Map<String, Object>> materializeDefinitionScope(@PathVariable("draftId") String draftId,
                                                                          HttpServletRequest httpServletRequest) {
        Map<String, Object> parameters = new LinkedHashMap<>();
        parameters.put("draftId", draftId);
        parameters.put("isEn", adminReactRouteSupport.isEnglishRequest(httpServletRequest, null));
        return execute("emission.definition-scope.materialize", parameters, draftId, httpServletRequest);
    }

    @GetMapping("/scopes/{categoryCode}/{tier}/status")
    public ResponseEntity<Map<String, Object>> getScopeStatus(@PathVariable("categoryCode") String categoryCode,
                                                              @PathVariable("tier") Integer tier,
                                                              HttpServletRequest httpServletRequest) {
        Map<String, Object> parameters = new LinkedHashMap<>();
        parameters.put("categoryCode", categoryCode);
        parameters.put("tier", tier);
        parameters.put("isEn", adminReactRouteSupport.isEnglishRequest(httpServletRequest, null));
        return execute("emission.scope-status.get", parameters, categoryCode + ":" + tier, httpServletRequest);
    }

    @PostMapping("/definition-scopes/{draftId}/precheck")
    public ResponseEntity<Map<String, Object>> precheckDefinitionScope(@PathVariable("draftId") String draftId,
                                                                       HttpServletRequest httpServletRequest) {
        Map<String, Object> parameters = new LinkedHashMap<>();
        parameters.put("draftId", draftId);
        parameters.put("isEn", adminReactRouteSupport.isEnglishRequest(httpServletRequest, null));
        return execute("emission.definition-scope.precheck", parameters, draftId, httpServletRequest);
    }

    private ResponseEntity<Map<String, Object>> execute(String actionKey,
                                                        Map<String, Object> parameters,
                                                        String targetId,
                                                        HttpServletRequest request) {
        return ResponseEntity.ok(operationsConsoleGateSupport.payloadForCurrentAdmin(
                request,
                actionKey,
                targetId,
                new LinkedHashMap<>(parameters)));
    }

    private Map<String, Object> withRequest(Object body, HttpServletRequest request) {
        Map<String, Object> parameters = new LinkedHashMap<>();
        parameters.put("request", body);
        return parameters;
    }

    private Map<String, Object> mapOf(String key, Object value) {
        Map<String, Object> map = new LinkedHashMap<>();
        map.put(key, value);
        return map;
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

}
