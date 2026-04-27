package egovframework.com.platform.screenbuilder.web;

import egovframework.com.platform.screenbuilder.model.ScreenBuilderComponentRegistrySaveRequestVO;
import egovframework.com.platform.screenbuilder.model.ScreenBuilderComponentRegistryUpdateRequestVO;
import egovframework.com.platform.screenbuilder.model.ScreenBuilderSaveRequestVO;
import egovframework.com.feature.admin.web.CarbonetAdminRouteSource;
import egovframework.com.platform.screenbuilder.web.ScreenBuilderApiController;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Controller
@RequestMapping({"/admin", "/en/admin"})
@RequiredArgsConstructor
public class AdminScreenBuilderController {

    private final CarbonetAdminRouteSource carbonetAdminRouteSource;
    private final ScreenBuilderApiController platformScreenBuilderApiController;

    @RequestMapping(value = "/system/screen-builder", method = RequestMethod.GET)
    public String screenBuilderPage(HttpServletRequest request, Locale locale) {
        return carbonetAdminRouteSource.forwardAdminRoute(request, locale, "screen-builder");
    }

    @RequestMapping(value = "/system/screen-runtime", method = RequestMethod.GET)
    public String screenRuntimePage(HttpServletRequest request, Locale locale) {
        return carbonetAdminRouteSource.forwardAdminRoute(request, locale, "screen-runtime");
    }

    @RequestMapping(value = "/system/current-runtime-compare", method = RequestMethod.GET)
    public String currentRuntimeComparePage(HttpServletRequest request, Locale locale) {
        return carbonetAdminRouteSource.forwardAdminRoute(request, locale, "current-runtime-compare");
    }

    @RequestMapping(value = "/system/repair-workbench", method = RequestMethod.GET)
    public String repairWorkbenchPage(HttpServletRequest request, Locale locale) {
        return carbonetAdminRouteSource.forwardAdminRoute(request, locale, "repair-workbench");
    }

    @GetMapping("/api/admin/screen-builder/page")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getScreenBuilderPage(
            @RequestParam(value = "menuCode", required = false) String menuCode,
            @RequestParam(value = "pageId", required = false) String pageId,
            @RequestParam(value = "menuTitle", required = false) String menuTitle,
            @RequestParam(value = "menuUrl", required = false) String menuUrl,
            HttpServletRequest request,
            Locale locale) throws Exception {
        return platformScreenBuilderApiController.getScreenBuilderPage(menuCode, pageId, menuTitle, menuUrl, request, locale);
    }

    @GetMapping("/api/admin/screen-builder/status-summary")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getScreenBuilderStatusSummary(
            @RequestParam(value = "menuCode", required = false) List<String> menuCodes,
            HttpServletRequest request,
            Locale locale) throws Exception {
        return platformScreenBuilderApiController.getScreenBuilderStatusSummary(menuCodes, request, locale);
    }

    @PostMapping("/api/admin/screen-builder/status-summary/rebuild")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> rebuildScreenBuilderStatusSummary(
            @RequestParam(value = "menuCode", required = false) List<String> menuCodes,
            HttpServletRequest request,
            Locale locale) throws Exception {
        return platformScreenBuilderApiController.rebuildScreenBuilderStatusSummary(menuCodes, request, locale);
    }

    @GetMapping("/api/admin/screen-builder/preview")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getScreenBuilderPreview(
            @RequestParam(value = "menuCode", required = false) String menuCode,
            @RequestParam(value = "pageId", required = false) String pageId,
            @RequestParam(value = "menuTitle", required = false) String menuTitle,
            @RequestParam(value = "menuUrl", required = false) String menuUrl,
            @RequestParam(value = "versionStatus", required = false) String versionStatus,
            HttpServletRequest request,
            Locale locale) throws Exception {
        return platformScreenBuilderApiController.getScreenBuilderPreview(menuCode, pageId, menuTitle, menuUrl, versionStatus, request, locale);
    }

    @PostMapping("/api/admin/screen-builder/draft")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> saveScreenBuilderDraft(
            @RequestBody ScreenBuilderSaveRequestVO request,
            HttpServletRequest httpServletRequest,
            Locale locale) {
        return platformScreenBuilderApiController.saveScreenBuilderDraft(request, httpServletRequest, locale);
    }

    @GetMapping("/api/admin/screen-builder/versions")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getScreenBuilderVersions(
            @RequestParam(value = "menuCode", required = false) String menuCode,
            HttpServletRequest request) throws Exception {
        return platformScreenBuilderApiController.getScreenBuilderVersions(menuCode, request);
    }

    @GetMapping("/api/admin/screen-builder/component-registry")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getScreenBuilderComponentRegistry(
            HttpServletRequest request,
            Locale locale) throws Exception {
        return platformScreenBuilderApiController.getScreenBuilderComponentRegistry(request, locale);
    }

    @PostMapping("/api/admin/screen-builder/component-registry")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> registerScreenBuilderComponent(
            @RequestBody ScreenBuilderComponentRegistrySaveRequestVO request,
            HttpServletRequest httpServletRequest,
            Locale locale) {
        return platformScreenBuilderApiController.registerScreenBuilderComponent(request, httpServletRequest, locale);
    }

    @PostMapping("/api/admin/screen-builder/component-registry/update")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> updateScreenBuilderComponentRegistry(
            @RequestBody ScreenBuilderComponentRegistryUpdateRequestVO request,
            HttpServletRequest httpServletRequest,
            Locale locale) {
        return platformScreenBuilderApiController.updateScreenBuilderComponentRegistry(request, httpServletRequest, locale);
    }

    @GetMapping("/api/admin/screen-builder/component-registry/usage")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> getScreenBuilderComponentRegistryUsage(
            @RequestParam(value = "componentId", required = false) String componentId,
            HttpServletRequest request,
            Locale locale) throws Exception {
        return platformScreenBuilderApiController.getScreenBuilderComponentRegistryUsage(componentId, request, locale);
    }

    @PostMapping("/api/admin/screen-builder/component-registry/delete")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> deleteScreenBuilderComponentRegistry(
            @RequestBody Map<String, String> request,
            HttpServletRequest httpServletRequest,
            Locale locale) {
        return platformScreenBuilderApiController.deleteScreenBuilderComponentRegistry(
                requestValue(request, "componentId"),
                httpServletRequest,
                locale);
    }

    @PostMapping("/api/admin/screen-builder/component-registry/remap")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> remapScreenBuilderComponentRegistryUsage(
            @RequestBody Map<String, String> request,
            HttpServletRequest httpServletRequest,
            Locale locale) {
        return platformScreenBuilderApiController.remapScreenBuilderComponentRegistryUsage(
                requestValue(request, "fromComponentId"),
                requestValue(request, "toComponentId"),
                httpServletRequest,
                locale);
    }

    @PostMapping("/api/admin/screen-builder/component-registry/auto-replace")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> autoReplaceDeprecatedScreenBuilderComponents(
            @RequestBody Map<String, String> request,
            HttpServletRequest httpServletRequest,
            Locale locale) {
        return platformScreenBuilderApiController.autoReplaceDeprecatedScreenBuilderComponents(
                requestValue(request, "menuCode"),
                httpServletRequest,
                locale);
    }

    @PostMapping("/api/admin/screen-builder/component-registry/auto-replace-preview")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> previewAutoReplaceDeprecatedScreenBuilderComponents(
            @RequestBody Map<String, String> request,
            HttpServletRequest httpServletRequest,
            Locale locale) {
        return platformScreenBuilderApiController.previewAutoReplaceDeprecatedScreenBuilderComponents(
                requestValue(request, "menuCode"),
                httpServletRequest,
                locale);
    }

    @GetMapping("/api/admin/screen-builder/component-registry/scan")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> scanScreenBuilderComponentRegistry(
            HttpServletRequest request,
            Locale locale) throws Exception {
        return platformScreenBuilderApiController.scanScreenBuilderComponentRegistry(request, locale);
    }

    @PostMapping("/api/admin/screen-builder/component-registry/add-node")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> addScreenBuilderNodeFromComponent(
            @RequestBody Map<String, Object> request,
            HttpServletRequest httpServletRequest,
            Locale locale) {
        return platformScreenBuilderApiController.addScreenBuilderNodeFromComponent(
                requestValue(request, "menuCode"),
                requestValue(request, "componentId"),
                requestValue(request, "parentNodeId"),
                requestObjectMap(request, "propsOverride"),
                httpServletRequest,
                locale);
    }

    @PostMapping("/api/admin/screen-builder/component-registry/add-node-tree")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> addScreenBuilderNodeTreeFromComponents(
            @RequestBody Map<String, Object> request,
            HttpServletRequest httpServletRequest,
            Locale locale) {
        return platformScreenBuilderApiController.addScreenBuilderNodeTreeFromComponents(
                requestValue(request, "menuCode"),
                requestObjectList(request, "items"),
                httpServletRequest,
                locale);
    }

    @PostMapping("/api/admin/screen-builder/restore")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> restoreScreenBuilderDraft(
            @RequestBody Map<String, String> request,
            HttpServletRequest httpServletRequest,
            Locale locale) {
        return platformScreenBuilderApiController.restoreScreenBuilderDraft(
                requestValue(request, "menuCode"),
                requestValue(request, "versionId"),
                httpServletRequest,
                locale);
    }

    @PostMapping("/api/admin/screen-builder/publish")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> publishScreenBuilderDraft(
            @RequestBody Map<String, String> request,
            HttpServletRequest httpServletRequest,
            Locale locale) {
        return platformScreenBuilderApiController.publishScreenBuilderDraft(
                requestValue(request, "menuCode"),
                httpServletRequest,
                locale);
    }

    private String requestValue(Map<?, ?> request, String key) {
        if (request == null || key == null) {
            return "";
        }
        Object value = request.get(key);
        return value == null ? "" : String.valueOf(value);
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> requestObjectMap(Map<String, Object> request, String key) {
        if (request != null && request.get(key) instanceof Map) {
            return (Map<String, Object>) request.get(key);
        }
        return null;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> requestObjectList(Map<String, Object> request, String key) {
        if (request != null && request.get(key) instanceof List) {
            return (List<Map<String, Object>>) request.get(key);
        }
        return java.util.Collections.emptyList();
    }
}
