package egovframework.com.platform.codex.web;

import egovframework.com.feature.admin.web.*;
import egovframework.com.feature.admin.dto.request.EmissionDefinitionDraftSaveRequest;
import egovframework.com.platform.executiongate.support.OperationsConsoleGateSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping({
        "/api/admin/emission-definition-studio",
        "/admin/api/admin/emission-definition-studio",
        "/en/admin/api/admin/emission-definition-studio"
})
public class AdminEmissionDefinitionStudioApiController {

    private final AdminReactRouteSupport adminReactRouteSupport;
    private final OperationsConsoleGateSupport operationsConsoleGateSupport;

    @PostMapping("/drafts")
    public ResponseEntity<Map<String, Object>> saveDraft(@RequestBody EmissionDefinitionDraftSaveRequest request,
                                                         HttpServletRequest httpServletRequest,
                                                         Locale locale) {
        Map<String, Object> parameters = new LinkedHashMap<>();
        parameters.put("request", request);
        parameters.put("isEn", adminReactRouteSupport.isEnglishRequest(httpServletRequest, locale));
        return execute("emission-definition-studio.draft.save",
                request == null ? null : request.getDraftId(),
                parameters,
                httpServletRequest);
    }

    @PostMapping("/drafts/{draftId}/publish")
    public ResponseEntity<Map<String, Object>> publishDraft(@PathVariable("draftId") String draftId,
                                                            HttpServletRequest httpServletRequest,
                                                            Locale locale) {
        Map<String, Object> parameters = new LinkedHashMap<>();
        parameters.put("draftId", draftId);
        parameters.put("isEn", adminReactRouteSupport.isEnglishRequest(httpServletRequest, locale));
        return execute("emission-definition-studio.draft.publish", draftId, parameters, httpServletRequest);
    }

    private ResponseEntity<Map<String, Object>> execute(String actionKey,
                                                        String targetId,
                                                        Map<String, Object> parameters,
                                                        HttpServletRequest request) {
        return ResponseEntity.ok(operationsConsoleGateSupport.payloadForCurrentAdmin(
                request,
                actionKey,
                targetId,
                new LinkedHashMap<>(parameters)));
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
