package egovframework.com.platform.screenbuilder.web;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.platform.screenbuilder.support.CarbonetScreenBuilderAuditSource;
import egovframework.com.platform.screenbuilder.support.CarbonetScreenBuilderAuthoritySource;
import egovframework.com.platform.screenbuilder.support.model.ScreenBuilderAuthorityDecision;
import egovframework.com.platform.screenbuilder.model.ScreenBuilderComponentRegistryItemVO;
import egovframework.com.platform.screenbuilder.model.ScreenBuilderComponentRegistrySaveRequestVO;
import egovframework.com.platform.screenbuilder.model.ScreenBuilderComponentRegistryUpdateRequestVO;
import egovframework.com.platform.screenbuilder.model.ScreenBuilderDraftDocumentVO;
import egovframework.com.platform.screenbuilder.model.ScreenBuilderSaveRequestVO;
import egovframework.com.platform.screenbuilder.model.ScreenBuilderVersionSummaryVO;
import egovframework.com.platform.screenbuilder.service.ScreenBuilderDraftService;
import egovframework.com.platform.screenbuilder.support.ScreenBuilderArtifactNamingPolicyPort;
import egovframework.com.platform.screenbuilder.support.ScreenBuilderRequestContextPolicyPort;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.RestController;

import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@RestController
@RequiredArgsConstructor
@RequestMapping({
        "/api/platform/screen-builder",
        "/en/api/platform/screen-builder",
        "/admin/api/platform/screen-builder",
        "/en/admin/api/platform/screen-builder"
})
public class ScreenBuilderApiController {

    private final ScreenBuilderDraftService screenBuilderDraftService;
    private final ScreenBuilderArtifactNamingPolicyPort screenBuilderArtifactNamingPolicyPort;
    private final ScreenBuilderRequestContextPolicyPort screenBuilderRequestContextPolicyPort;
    private final CarbonetScreenBuilderAuditSource carbonetScreenBuilderAuditSource;
    private final CarbonetScreenBuilderAuthoritySource carbonetScreenBuilderAuthoritySource;
    private final ObjectMapper objectMapper;

    @GetMapping("/page")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getScreenBuilderPage(
            @RequestParam(value = "menuCode", required = false) String menuCode,
            @RequestParam(value = "pageId", required = false) String pageId,
            @RequestParam(value = "menuTitle", required = false) String menuTitle,
            @RequestParam(value = "menuUrl", required = false) String menuUrl,
            HttpServletRequest request,
            Locale locale) throws Exception {
        ResponseEntity<Map<String, Object>> denied = authorizeMenuAccess(
                safe(menuCode),
                safe(menuUrl),
                "VIEW",
                request,
                "SCREEN_BUILDER_PAGE_VIEW");
        if (denied != null) {
            return denied;
        }
        return ok(screenBuilderDraftService.getPagePayload(menuCode, pageId, menuTitle, menuUrl, isEn(request, locale)));
    }

    @GetMapping("/status-summary")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getScreenBuilderStatusSummary(
            @RequestParam(value = "menuCode", required = false) List<String> menuCodes,
            HttpServletRequest request,
            Locale locale) throws Exception {
        ResponseEntity<Map<String, Object>> denied = authorizeMenuBatch(
                menuCodes,
                "/admin/system/screen-builder",
                "QUERY",
                request,
                "SCREEN_BUILDER_STATUS_SUMMARY_VIEW");
        if (denied != null) {
            return denied;
        }
        return ok(screenBuilderDraftService.getStatusSummary(menuCodes, isEn(request, locale)));
    }

    @PostMapping("/status-summary/rebuild")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> rebuildScreenBuilderStatusSummary(
            @RequestParam(value = "menuCode", required = false) List<String> menuCodes,
            HttpServletRequest request,
            Locale locale) throws Exception {
        ResponseEntity<Map<String, Object>> denied = authorizeMenuBatch(
                menuCodes,
                "/admin/system/screen-builder",
                "EXECUTE",
                request,
                "SCREEN_BUILDER_STATUS_SUMMARY_REBUILD");
        if (denied != null) {
            return denied;
        }
        return ok(screenBuilderDraftService.rebuildStatusSummary(menuCodes, isEn(request, locale)));
    }

    @GetMapping("/preview")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getScreenBuilderPreview(
            @RequestParam(value = "menuCode", required = false) String menuCode,
            @RequestParam(value = "pageId", required = false) String pageId,
            @RequestParam(value = "menuTitle", required = false) String menuTitle,
            @RequestParam(value = "menuUrl", required = false) String menuUrl,
            @RequestParam(value = "versionStatus", required = false) String versionStatus,
            HttpServletRequest request,
            Locale locale) throws Exception {
        ResponseEntity<Map<String, Object>> denied = authorizeMenuAccess(
                safe(menuCode),
                safe(menuUrl),
                "VIEW",
                request,
                "SCREEN_BUILDER_PREVIEW_VIEW");
        if (denied != null) {
            return denied;
        }
        boolean isEn = isEn(request, locale);
        ScreenBuilderDraftDocumentVO draft = "PUBLISHED".equalsIgnoreCase(safe(versionStatus))
                ? screenBuilderDraftService.getLatestPublishedDraft(menuCode)
                : screenBuilderDraftService.getDraft(menuCode, pageId, menuTitle, menuUrl);
        if (draft == null) {
            draft = screenBuilderDraftService.getDraft(menuCode, pageId, menuTitle, menuUrl);
        }
        String releaseUnitId = screenBuilderArtifactNamingPolicyPort.resolveReleaseUnitId(
                draft,
                draft == null ? "" : safe(draft.getVersionId()));
        return ok(orderedMap(
                "isEn", isEn,
                "menuCode", safe(draft.getMenuCode()),
                "pageId", safe(draft.getPageId()),
                "menuTitle", safe(draft.getMenuTitle()),
                "menuUrl", safe(draft.getMenuUrl()),
                "templateType", safe(draft.getTemplateType()),
                "versionStatus", safe(draft.getVersionStatus()),
                "registryDiagnostics", screenBuilderDraftService.getRegistryDiagnostics(draft, isEn),
                "releaseUnitId", releaseUnitId,
                "artifactEvidence", screenBuilderArtifactNamingPolicyPort.buildArtifactEvidence(
                        draft,
                        releaseUnitId,
                        draft == null ? "" : safe(draft.getVersionId()),
                        ""),
                "nodes", draft.getNodes(),
                "events", draft.getEvents()));
    }

    @PostMapping("/draft")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> saveScreenBuilderDraft(
            @RequestBody ScreenBuilderSaveRequestVO request,
            HttpServletRequest httpServletRequest,
            Locale locale) {
        ResponseEntity<Map<String, Object>> denied = authorizeMenuAccess(
                safe(request == null ? null : request.getMenuCode()),
                safe(request == null ? null : request.getMenuUrl()),
                "UPDATE",
                httpServletRequest,
                "SCREEN_BUILDER_DRAFT_SAVE");
        if (denied != null) {
            return denied;
        }
        return execute(() -> {
            ScreenBuilderDraftDocumentVO before = screenBuilderDraftService.getDraft(
                    request == null ? "" : request.getMenuCode(),
                    request == null ? "" : request.getPageId(),
                    request == null ? "" : request.getMenuTitle(),
                    request == null ? "" : request.getMenuUrl()
            );
            Map<String, Object> response = screenBuilderDraftService.saveDraft(request, isEn(httpServletRequest, locale));
            ScreenBuilderDraftDocumentVO after = screenBuilderDraftService.getDraft(
                    request == null ? "" : request.getMenuCode(),
                    request == null ? "" : request.getPageId(),
                    request == null ? "" : request.getMenuTitle(),
                    request == null ? "" : request.getMenuUrl()
            );
            recordScreenBuilderAudit(
                    httpServletRequest,
                    safe(request == null ? null : request.getMenuCode()),
                    "SCREEN_BUILDER_DRAFT_SAVE",
                    "SCREEN_BUILDER_DEF",
                    safe(request == null ? null : request.getMenuCode()),
                    "Screen builder draft saved",
                    before,
                    after);
            return response;
        });
    }

    @GetMapping("/versions")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getScreenBuilderVersions(
            @RequestParam(value = "menuCode", required = false) String menuCode,
            HttpServletRequest request) throws Exception {
        ResponseEntity<Map<String, Object>> denied = authorizeMenuAccess(
                safe(menuCode),
                "",
                "QUERY",
                request,
                "SCREEN_BUILDER_VERSIONS_VIEW");
        if (denied != null) {
            return denied;
        }
        List<ScreenBuilderVersionSummaryVO> history = screenBuilderDraftService.getVersionHistory(menuCode);
        return ok(orderedMap(
                "menuCode", safe(menuCode),
                "versionHistory", history));
    }

    @GetMapping("/component-registry")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getScreenBuilderComponentRegistry(
            HttpServletRequest request,
            Locale locale) throws Exception {
        ResponseEntity<Map<String, Object>> denied = authorizeMenuAccess(
                "",
                "/admin/system/screen-builder",
                "QUERY",
                request,
                "SCREEN_BUILDER_COMPONENT_REGISTRY_VIEW");
        if (denied != null) {
            return denied;
        }
        return ok(orderedMap(
                "items", screenBuilderDraftService.getComponentRegistry(isEn(request, locale))));
    }

    @PostMapping("/component-registry")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> registerScreenBuilderComponent(
            @RequestBody ScreenBuilderComponentRegistrySaveRequestVO request,
            HttpServletRequest httpServletRequest,
            Locale locale) {
        ResponseEntity<Map<String, Object>> denied = authorizeMenuAccess(
                safe(request == null ? null : request.getMenuCode()),
                "/admin/system/screen-builder",
                "CREATE",
                httpServletRequest,
                "SCREEN_BUILDER_COMPONENT_REGISTER");
        if (denied != null) {
            return denied;
        }
        return execute(() -> {
            boolean isEn = isEn(httpServletRequest, locale);
            ScreenBuilderComponentRegistryItemVO item = screenBuilderDraftService.registerComponent(request, isEn);
            recordScreenBuilderAudit(
                    httpServletRequest,
                    safe(request == null ? null : request.getMenuCode()),
                    "SCREEN_BUILDER_COMPONENT_REGISTER",
                    "SCREEN_BUILDER_COMPONENT",
                    safe(item == null ? null : item.getComponentId()),
                    "Screen builder component registered",
                    "",
                    item);
            return successResponse(
                    isEn ? "Component registered." : "컴포넌트를 등록했습니다.",
                    "item", item);
        });
    }

    @PostMapping("/component-registry/update")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> updateScreenBuilderComponentRegistry(
            @RequestBody ScreenBuilderComponentRegistryUpdateRequestVO request,
            HttpServletRequest httpServletRequest,
            Locale locale) {
        ResponseEntity<Map<String, Object>> denied = authorizeMenuAccess(
                safe(request == null ? null : request.getMenuCode()),
                "/admin/system/screen-builder",
                "UPDATE",
                httpServletRequest,
                "SCREEN_BUILDER_COMPONENT_UPDATE");
        if (denied != null) {
            return denied;
        }
        return execute(() -> {
            boolean isEn = isEn(httpServletRequest, locale);
            ScreenBuilderComponentRegistryItemVO item = screenBuilderDraftService.updateComponentRegistryItem(request, isEn);
            recordScreenBuilderAudit(
                    httpServletRequest,
                    safe(request == null ? null : request.getMenuCode()),
                    "SCREEN_BUILDER_COMPONENT_UPDATE",
                    "SCREEN_BUILDER_COMPONENT",
                    safe(item == null ? null : item.getComponentId()),
                    "Screen builder component updated",
                    "",
                    item);
            return successResponse(
                    isEn ? "Component updated." : "컴포넌트를 수정했습니다.",
                    "item", item);
        });
    }

    @GetMapping("/component-registry/usage")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getScreenBuilderComponentRegistryUsage(
            @RequestParam("componentId") String componentId,
            HttpServletRequest request,
            Locale locale) throws Exception {
        ResponseEntity<Map<String, Object>> denied = authorizeMenuAccess(
                "",
                "/admin/system/screen-builder",
                "QUERY",
                request,
                "SCREEN_BUILDER_COMPONENT_USAGE_VIEW");
        if (denied != null) {
            return denied;
        }
        return ok(orderedMap(
                "componentId", safe(componentId),
                "items", screenBuilderDraftService.getComponentRegistryUsage(componentId, isEn(request, locale))));
    }

    @PostMapping("/component-registry/delete")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> deleteScreenBuilderComponentRegistry(
            @RequestParam("componentId") String componentId,
            HttpServletRequest httpServletRequest,
            Locale locale) {
        ResponseEntity<Map<String, Object>> denied = authorizeMenuAccess(
                "",
                "/admin/system/screen-builder",
                "DELETE",
                httpServletRequest,
                "SCREEN_BUILDER_COMPONENT_DELETE");
        if (denied != null) {
            return denied;
        }
        return execute(() -> {
            Map<String, Object> response = screenBuilderDraftService.deleteComponentRegistryItem(componentId, isEn(httpServletRequest, locale));
            recordScreenBuilderAudit(
                    httpServletRequest,
                    "",
                    "SCREEN_BUILDER_COMPONENT_DELETE",
                    "SCREEN_BUILDER_COMPONENT",
                    safe(componentId),
                    "Screen builder component deleted",
                    "",
                    response);
            return response;
        });
    }

    @PostMapping("/component-registry/remap")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> remapScreenBuilderComponentRegistryUsage(
            @RequestParam("fromComponentId") String fromComponentId,
            @RequestParam("toComponentId") String toComponentId,
            HttpServletRequest httpServletRequest,
            Locale locale) {
        ResponseEntity<Map<String, Object>> denied = authorizeMenuAccess(
                "",
                "/admin/system/screen-builder",
                "UPDATE",
                httpServletRequest,
                "SCREEN_BUILDER_COMPONENT_REMAP");
        if (denied != null) {
            return denied;
        }
        return execute(() -> {
            Map<String, Object> response = screenBuilderDraftService.replaceComponentRegistryUsage(fromComponentId, toComponentId, isEn(httpServletRequest, locale));
            recordScreenBuilderAudit(
                    httpServletRequest,
                    "",
                    "SCREEN_BUILDER_COMPONENT_REMAP",
                    "SCREEN_BUILDER_COMPONENT",
                    safe(fromComponentId),
                    "Screen builder component remapped",
                    "",
                    response);
            return response;
        });
    }

    @PostMapping("/component-registry/auto-replace")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> autoReplaceDeprecatedScreenBuilderComponents(
            @RequestParam("menuCode") String menuCode,
            HttpServletRequest httpServletRequest,
            Locale locale) {
        ResponseEntity<Map<String, Object>> denied = authorizeMenuAccess(
                safe(menuCode),
                "/admin/system/screen-builder",
                "EXECUTE",
                httpServletRequest,
                "SCREEN_BUILDER_COMPONENT_AUTO_REPLACE");
        if (denied != null) {
            return denied;
        }
        return execute(() -> {
            Map<String, Object> response = screenBuilderDraftService.autoReplaceDeprecatedComponents(menuCode, isEn(httpServletRequest, locale));
            recordScreenBuilderAudit(
                    httpServletRequest,
                    safe(menuCode),
                    "SCREEN_BUILDER_COMPONENT_AUTO_REPLACE",
                    "SCREEN_BUILDER_DEF",
                    safe(menuCode),
                    "Screen builder deprecated component auto replace executed",
                    "",
                    response);
            return response;
        });
    }

    @GetMapping("/component-registry/auto-replace/preview")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> previewAutoReplaceDeprecatedScreenBuilderComponents(
            @RequestParam("menuCode") String menuCode,
            HttpServletRequest httpServletRequest,
            Locale locale) {
        ResponseEntity<Map<String, Object>> denied = authorizeMenuAccess(
                safe(menuCode),
                "/admin/system/screen-builder",
                "QUERY",
                httpServletRequest,
                "SCREEN_BUILDER_COMPONENT_AUTO_REPLACE_PREVIEW");
        if (denied != null) {
            return denied;
        }
        return execute(() -> screenBuilderDraftService.previewAutoReplaceDeprecatedComponents(menuCode, isEn(httpServletRequest, locale)));
    }

    @GetMapping("/component-registry/scan")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> scanScreenBuilderComponentRegistry(
            HttpServletRequest request,
            Locale locale) throws Exception {
        ResponseEntity<Map<String, Object>> denied = authorizeMenuAccess(
                "",
                "/admin/system/screen-builder",
                "QUERY",
                request,
                "SCREEN_BUILDER_COMPONENT_SCAN");
        if (denied != null) {
            return denied;
        }
        return ok(screenBuilderDraftService.scanAllDraftRegistryDiagnostics(isEn(request, locale)));
    }

    @PostMapping("/nodes/add-from-component")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> addScreenBuilderNodeFromComponent(
            @RequestParam("menuCode") String menuCode,
            @RequestParam("componentId") String componentId,
            @RequestParam(value = "parentNodeId", required = false) String parentNodeId,
            @RequestBody(required = false) Map<String, Object> propsOverride,
            HttpServletRequest httpServletRequest,
            Locale locale) {
        ResponseEntity<Map<String, Object>> denied = authorizeMenuAccess(
                safe(menuCode),
                "/admin/system/screen-builder",
                "UPDATE",
                httpServletRequest,
                "SCREEN_BUILDER_NODE_ADD");
        if (denied != null) {
            return denied;
        }
        return execute(() -> {
            Map<String, Object> response = screenBuilderDraftService.addNodeFromComponent(menuCode, componentId, parentNodeId, propsOverride, isEn(httpServletRequest, locale));
            recordScreenBuilderAudit(
                    httpServletRequest,
                    safe(menuCode),
                    "SCREEN_BUILDER_NODE_ADD",
                    "SCREEN_BUILDER_DEF",
                    safe(menuCode),
                    "Screen builder node added from component",
                    "",
                    response);
            return response;
        });
    }

    @PostMapping("/nodes/add-tree")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> addScreenBuilderNodeTreeFromComponents(
            @RequestParam("menuCode") String menuCode,
            @RequestBody List<Map<String, Object>> items,
            HttpServletRequest httpServletRequest,
            Locale locale) {
        ResponseEntity<Map<String, Object>> denied = authorizeMenuAccess(
                safe(menuCode),
                "/admin/system/screen-builder",
                "UPDATE",
                httpServletRequest,
                "SCREEN_BUILDER_NODE_ADD_TREE");
        if (denied != null) {
            return denied;
        }
        return execute(() -> {
            Map<String, Object> response = screenBuilderDraftService.addNodeTreeFromComponents(menuCode, items, isEn(httpServletRequest, locale));
            recordScreenBuilderAudit(
                    httpServletRequest,
                    safe(menuCode),
                    "SCREEN_BUILDER_NODE_ADD_TREE",
                    "SCREEN_BUILDER_DEF",
                    safe(menuCode),
                    "Screen builder node tree added from components",
                    "",
                    response);
            return response;
        });
    }

    @PostMapping("/restore")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> restoreScreenBuilderDraft(
            @RequestParam("menuCode") String menuCode,
            @RequestParam("versionId") String versionId,
            HttpServletRequest httpServletRequest,
            Locale locale) {
        ResponseEntity<Map<String, Object>> denied = authorizeMenuAccess(
                safe(menuCode),
                "/admin/system/screen-builder",
                "EXECUTE",
                httpServletRequest,
                "SCREEN_BUILDER_DRAFT_RESTORE");
        if (denied != null) {
            return denied;
        }
        return execute(() -> {
            Map<String, Object> response = screenBuilderDraftService.restoreDraftVersion(menuCode, versionId, isEn(httpServletRequest, locale));
            recordScreenBuilderAudit(
                    httpServletRequest,
                    safe(menuCode),
                    "SCREEN_BUILDER_DRAFT_RESTORE",
                    "SCREEN_BUILDER_DEF",
                    safe(menuCode),
                    "Screen builder draft restored",
                    "",
                    response);
            return response;
        });
    }

    @PostMapping("/publish")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> publishScreenBuilderDraft(
            @RequestParam("menuCode") String menuCode,
            HttpServletRequest httpServletRequest,
            Locale locale) {
        ResponseEntity<Map<String, Object>> denied = authorizeMenuAccess(
                safe(menuCode),
                "/admin/system/screen-runtime",
                "APPROVE",
                httpServletRequest,
                "SCREEN_BUILDER_DRAFT_PUBLISH");
        if (denied != null) {
            return denied;
        }
        return execute(() -> {
            Map<String, Object> response = screenBuilderDraftService.publishDraft(menuCode, isEn(httpServletRequest, locale));
            recordScreenBuilderAudit(
                    httpServletRequest,
                    safe(menuCode),
                    "SCREEN_BUILDER_DRAFT_PUBLISH",
                    "SCREEN_BUILDER_DEF",
                    safe(menuCode),
                    "Screen builder draft published",
                    "",
                    response);
            return response;
        });
    }

    private ResponseEntity<Map<String, Object>> badRequest(Exception e) {
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(errorResponse(e));
    }

    private ResponseEntity<Map<String, Object>> serverError(Exception e) {
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse(e));
    }

    private ResponseEntity<Map<String, Object>> authorizeMenuAccess(String menuCode,
                                                                    String menuUrl,
                                                                    String actionScope,
                                                                    HttpServletRequest request,
                                                                    String deniedActionCode) {
        ScreenBuilderAuthorityDecision decision = carbonetScreenBuilderAuthoritySource.authorizeMenuAccess(
                safe(menuCode),
                safe(menuUrl),
                safe(actionScope),
                request);
        return decision.isAllowed() ? null : forbidden(decision, request, deniedActionCode);
    }

    private ResponseEntity<Map<String, Object>> authorizeMenuBatch(List<String> menuCodes,
                                                                   String menuUrl,
                                                                   String actionScope,
                                                                   HttpServletRequest request,
                                                                   String deniedActionCode) {
        ScreenBuilderAuthorityDecision decision = carbonetScreenBuilderAuthoritySource.authorizeMenuBatch(
                menuCodes,
                safe(menuUrl),
                safe(actionScope),
                request);
        return decision.isAllowed() ? null : forbidden(decision, request, deniedActionCode);
    }

    private ResponseEntity<Map<String, Object>> forbidden(ScreenBuilderAuthorityDecision decision,
                                                          HttpServletRequest request,
                                                          String deniedActionCode) {
        recordScreenBuilderAudit(
                request,
                safe(decision.getMenuCode()),
                safe(deniedActionCode),
                "SCREEN_BUILDER_AUTHORITY",
                safe(decision.getRequiredFeatureCode()),
                safe(decision.getMessage()),
                "",
                orderedMap(
                        "reasonCode", safe(decision.getReasonCode()),
                        "actionScope", safe(decision.getActionScope()),
                        "requiredFeatureCode", safe(decision.getRequiredFeatureCode()),
                        "menuUrl", safe(decision.getMenuUrl()),
                        "actorId", safe(decision.getActorId()),
                        "actorRole", safe(decision.getActorRole())),
                "DENIED");
        return ResponseEntity.status(HttpStatus.FORBIDDEN).body(orderedMap(
                "success", false,
                "blocked", true,
                "message", safe(decision.getMessage()),
                "reasonCode", safe(decision.getReasonCode()),
                "requiredFeatureCode", safe(decision.getRequiredFeatureCode()),
                "menuCode", safe(decision.getMenuCode()),
                "menuUrl", safe(decision.getMenuUrl()),
                "actionScope", safe(decision.getActionScope()),
                "actorId", safe(decision.getActorId()),
                "actorRole", safe(decision.getActorRole())));
    }

    private Map<String, Object> successResponse(String message, Object... fields) {
        Map<String, Object> response = orderedMap(
                "success", true,
                "message", message);
        response.putAll(orderedMap(fields));
        return response;
    }

    private Map<String, Object> errorResponse(Exception e, Object... fields) {
        Map<String, Object> response = orderedMap(
                "success", false,
                "message", e == null ? "" : safe(e.getMessage()));
        response.putAll(orderedMap(fields));
        return response;
    }

    private Map<String, Object> orderedMap(Object... fields) {
        Map<String, Object> values = new LinkedHashMap<>();
        if (fields == null) {
            return values;
        }
        for (int index = 0; index + 1 < fields.length; index += 2) {
            values.put(String.valueOf(fields[index]), fields[index + 1]);
        }
        return values;
    }

    private boolean isEn(HttpServletRequest request, Locale locale) {
        return screenBuilderRequestContextPolicyPort.isEnglishRequest(request, locale);
    }

    private ResponseEntity<Map<String, Object>> ok(Map<String, Object> body) {
        return ResponseEntity.ok(body);
    }

    private ResponseEntity<Map<String, Object>> execute(ScreenBuilderAction action) {
        try {
            return ResponseEntity.ok(action.run());
        } catch (IllegalArgumentException e) {
            return badRequest(e);
        } catch (Exception e) {
            return serverError(e);
        }
    }

    private void recordScreenBuilderAudit(HttpServletRequest request,
                                          String menuCode,
                                          String actionCode,
                                          String entityType,
                                          String entityId,
                                          String summary,
                                          Object beforeState,
                                          Object afterState) {
        recordScreenBuilderAudit(request, menuCode, actionCode, entityType, entityId, summary, beforeState, afterState, "SUCCESS");
    }

    private void recordScreenBuilderAudit(HttpServletRequest request,
                                          String menuCode,
                                          String actionCode,
                                          String entityType,
                                          String entityId,
                                          String summary,
                                          Object beforeState,
                                          Object afterState,
                                          String resultStatus) {
        carbonetScreenBuilderAuditSource.record(
                carbonetScreenBuilderAuthoritySource.resolveActorId(request),
                carbonetScreenBuilderAuthoritySource.resolveActorRole(request),
                safe(menuCode),
                "screen-builder",
                actionCode,
                entityType,
                safe(entityId),
                safe(resultStatus),
                summary,
                safeJson(beforeState),
                safeJson(afterState),
                carbonetScreenBuilderAuthoritySource.resolveRequestIp(request),
                request == null ? "" : safe(request.getHeader("User-Agent")));
    }

    private String safeJson(Object value) {
        if (value == null) {
            return "";
        }
        try {
            return objectMapper.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            return "";
        }
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    @FunctionalInterface
    private interface ScreenBuilderAction {
        Map<String, Object> run() throws Exception;
    }
}
