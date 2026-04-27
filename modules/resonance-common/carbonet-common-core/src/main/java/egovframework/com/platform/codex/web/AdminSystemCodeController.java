package egovframework.com.platform.codex.web;

import egovframework.com.feature.admin.web.*;

import egovframework.com.platform.menu.dto.MenuInfoDTO;
import egovframework.com.platform.runtimecontrol.service.AdminIpWhitelistSupportService;
import egovframework.com.platform.runtimecontrol.service.AdminIpWhitelistCommandService;
import egovframework.com.platform.codex.service.AdminMenuManagementPageService;
import egovframework.com.platform.codex.service.AdminMenuManagementCommandService;
import egovframework.com.platform.codex.service.AdminPageManagementPageService;
import egovframework.com.platform.codex.service.AdminPageManagementCommandService;
import egovframework.com.platform.codex.service.AdminCodeManagementPageService;
import egovframework.com.platform.codex.service.AdminCodeManagementCommandService;
import egovframework.com.platform.codex.service.AdminFeatureManagementPageService;
import egovframework.com.platform.codex.service.AdminFeatureManagementCommandService;
import egovframework.com.platform.observability.service.AdminAccessHistoryPageService;
import egovframework.com.platform.bootstrap.service.AdminShellBootstrapPageService;
import egovframework.com.platform.governance.service.DbSyncDeployManagementService;
import egovframework.com.platform.governance.service.DbPromotionPolicyManagementService;
import egovframework.com.platform.governance.service.WbsManagementService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.ExtendedModelMap;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.security.web.csrf.CsrfToken;

import jakarta.servlet.http.HttpServletRequest;
import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Consumer;

@Controller
@RequestMapping({"/admin/system", "/en/admin/system"})
@RequiredArgsConstructor
public class AdminSystemCodeController {

    private static final String FAQ_BRANCH_CODE = "A00403";
    private static final Map<String, String> PLATFORM_STUDIO_ROUTE_BY_SUFFIX = buildPlatformStudioRouteMap();

    private final AdminIpWhitelistSupportService adminIpWhitelistSupportService;
    private final AdminShellBootstrapPageService adminShellBootstrapPageService;
    private final WbsManagementService wbsManagementService;
    private final DbPromotionPolicyManagementService dbPromotionPolicyManagementService;
    private final DbSyncDeployManagementService dbSyncDeployManagementService;
    private final AdminMenuManagementPageService adminMenuManagementPageService;
    private final AdminMenuManagementCommandService adminMenuManagementCommandService;
    private final AdminPageManagementPageService adminPageManagementPageService;
    private final AdminPageManagementCommandService adminPageManagementCommandService;
    private final AdminFeatureManagementPageService adminFeatureManagementPageService;
    private final AdminFeatureManagementCommandService adminFeatureManagementCommandService;
    private final AdminCodeManagementPageService adminCodeManagementPageService;
    private final AdminCodeManagementCommandService adminCodeManagementCommandService;
    private final AdminAccessHistoryPageService adminAccessHistoryPageService;
    private final AdminIpWhitelistCommandService adminIpWhitelistCommandService;
    private final AdminReactRouteSupport adminReactRouteSupport;

    @RequestMapping(value = "/code", method = { RequestMethod.GET, RequestMethod.POST })
    public String system_codeManagement(
            @RequestParam(value = "detailCodeId", required = false) String detailCodeId,
            HttpServletRequest request,
            Locale locale,
            Model model) {
        return redirectReactMigration(request, locale, "system-code");
    }

    @GetMapping("/code/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> systemCodeManagementPageApi(
            @RequestParam(value = "detailCodeId", required = false) String detailCodeId,
            HttpServletRequest request,
            Locale locale) {
        return buildPageDataResponse(request,
                model -> model.addAllAttributes(
                        adminCodeManagementPageService.buildCodeManagementPageData(detailCodeId, request, locale)));
    }

    @RequestMapping(value = "/page-management", method = RequestMethod.GET)
    public String pageManagement(
            @RequestParam(value = "menuType", defaultValue = "ADMIN") String menuType,
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "searchUrl", required = false) String searchUrl,
            @RequestParam(value = "autoFeature", required = false) String autoFeature,
            @RequestParam(value = "updated", required = false) String updated,
            @RequestParam(value = "deleted", required = false) String deleted,
            @RequestParam(value = "deletedRoleRefs", required = false) String deletedRoleRefs,
            @RequestParam(value = "deletedUserOverrides", required = false) String deletedUserOverrides,
            HttpServletRequest request,
            Locale locale,
            Model model) {
        return redirectReactMigration(request, locale, "page-management");
    }

    @GetMapping("/page-management/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> pageManagementPageApi(
            @RequestParam(value = "menuType", defaultValue = "ADMIN") String menuType,
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "searchUrl", required = false) String searchUrl,
            @RequestParam(value = "autoFeature", required = false) String autoFeature,
            @RequestParam(value = "updated", required = false) String updated,
            @RequestParam(value = "deleted", required = false) String deleted,
            @RequestParam(value = "deletedRoleRefs", required = false) String deletedRoleRefs,
            @RequestParam(value = "deletedUserOverrides", required = false) String deletedUserOverrides,
            HttpServletRequest request,
            Locale locale) {
        return buildPageDataResponse(request,
                model -> model.addAllAttributes(
                        adminPageManagementPageService.buildPageManagementPageData(
                                menuType,
                                searchKeyword,
                                searchUrl,
                                autoFeature,
                                updated,
                                deleted,
                                deletedRoleRefs,
                                deletedUserOverrides,
                                request,
                                locale)));
    }

    @RequestMapping(value = "/ip_whitelist", method = RequestMethod.GET)
    public String ipWhitelist(
            @RequestParam(value = "searchIp", required = false) String searchIp,
            @RequestParam(value = "accessScope", required = false) String accessScope,
            @RequestParam(value = "status", required = false) String status,
            HttpServletRequest request,
            Locale locale,
            Model model) {
        return redirectReactMigration(request, locale, "ip-whitelist");
    }

    @GetMapping("/ip_whitelist/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> ipWhitelistPageApi(
            @RequestParam(value = "searchIp", required = false) String searchIp,
            @RequestParam(value = "accessScope", required = false) String accessScope,
            @RequestParam(value = "status", required = false) String status,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = isEnglishRequest(request, locale);
        return buildPageDataResponse(request, model -> model.addAllAttributes(
                adminIpWhitelistSupportService.buildPageData(isEn, searchIp, accessScope, status)));
    }

    @PostMapping("/ip-whitelist/request")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> createIpWhitelistRequest(
            @RequestBody Map<String, Object> payload,
            HttpServletRequest request,
            Locale locale) {
        return adminIpWhitelistCommandService.createRequest(payload, request, locale);
    }

    @PostMapping("/ip-whitelist/request-decision")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> decideIpWhitelistRequest(
            @RequestBody Map<String, Object> payload,
            HttpServletRequest request,
            Locale locale) {
        return adminIpWhitelistCommandService.decideRequest(payload, request, locale);
    }

    @RequestMapping(value = "/access_history/legacy", method = RequestMethod.GET)
    public String legacyAccessHistory(HttpServletRequest request, Locale locale) {
        return redirectReactMigration(request, locale, "access-history");
    }

    @GetMapping("/access_history/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> accessHistoryPageApi(
            @RequestParam(value = "pageIndex", required = false) String pageIndexParam,
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "insttId", required = false) String insttId,
            HttpServletRequest request,
            Locale locale) {
        return buildPageDataResponse(request,
                model -> model.addAllAttributes(
                        adminAccessHistoryPageService.buildPageData(
                                pageIndexParam,
                                searchKeyword,
                                insttId,
                                request,
                                locale)));
    }

    @RequestMapping(value = {"/function-management", "/feature-management"}, method = RequestMethod.GET)
    public String functionManagement(
            @RequestParam(value = "menuType", defaultValue = "ADMIN") String menuType,
            @RequestParam(value = "searchMenuCode", required = false) String searchMenuCode,
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            HttpServletRequest request,
            Locale locale,
            Model model) {
        return redirectReactMigration(request, locale, "function-management");
    }

    @GetMapping({"/function-management/page-data", "/feature-management/page-data"})
    @ResponseBody
    public ResponseEntity<Map<String, Object>> functionManagementPageApi(
            @RequestParam(value = "menuType", defaultValue = "ADMIN") String menuType,
            @RequestParam(value = "searchMenuCode", required = false) String searchMenuCode,
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            HttpServletRequest request,
            Locale locale) {
        return buildPageDataResponse(request,
                model -> model.addAllAttributes(
                        adminFeatureManagementPageService.buildFunctionManagementPageData(
                                menuType,
                                searchMenuCode,
                                searchKeyword,
                                request == null ? null : request.getParameter("errorMessage"),
                                request,
                                locale)));
    }

    @RequestMapping(value = {"/menu-management", "/menu"}, method = RequestMethod.GET)
    public String menuManagement(
            @RequestParam(value = "menuType", defaultValue = "ADMIN") String menuType,
            @RequestParam(value = "saved", required = false) String saved,
            HttpServletRequest request,
            Locale locale,
            Model model) {
        return redirectReactMigration(request, locale, "menu-management");
    }

    @GetMapping({"/menu-management/page-data", "/menu/page-data"})
    @ResponseBody
    public ResponseEntity<Map<String, Object>> menuManagementPageApi(
            @RequestParam(value = "menuType", defaultValue = "ADMIN") String menuType,
            @RequestParam(value = "saved", required = false) String saved,
            HttpServletRequest request,
            Locale locale) {
        return ResponseEntity.ok(adminMenuManagementPageService.buildMenuManagementPageData(menuType, saved, request, locale));
    }

    @GetMapping({"/admin/content/menu/page-data", "/en/admin/content/menu/page-data"})
    @ResponseBody
    public ResponseEntity<Map<String, Object>> contentMenuManagementPageApi(
            @RequestParam(value = "saved", required = false) String saved,
            HttpServletRequest request,
            Locale locale) {
        return ResponseEntity.ok(adminMenuManagementPageService.buildContentMenuManagementPageData(saved, request, locale));
    }

    @RequestMapping(value = "/full-stack-management", method = RequestMethod.GET)
    public String fullStackManagement(
            @RequestParam(value = "menuType", defaultValue = "ADMIN") String menuType,
            @RequestParam(value = "saved", required = false) String saved,
            HttpServletRequest request,
            Locale locale,
            Model model) {
        return redirectReactMigration(request, locale, "full-stack-management");
    }

    @RequestMapping(value = "/infra", method = RequestMethod.GET)
    public String infraManagement(HttpServletRequest request, Locale locale) {
        return redirectReactMigration(request, locale, "infra");
    }

    @RequestMapping(value = "/environment-management", method = RequestMethod.GET)
    public String environmentManagement(HttpServletRequest request, Locale locale) {
        return redirectReactMigration(request, locale, "environment-management");
    }

    @RequestMapping(value = "/asset-inventory", method = RequestMethod.GET)
    public String assetInventory(HttpServletRequest request, Locale locale) {
        return redirectReactMigration(request, locale, "asset-inventory");
    }

    @RequestMapping(value = "/verification-center", method = RequestMethod.GET)
    public String verificationCenter(HttpServletRequest request, Locale locale) {
        return redirectReactMigration(request, locale, "verification-center");
    }

    @RequestMapping(value = "/verification-assets", method = RequestMethod.GET)
    public String verificationAssets(HttpServletRequest request, Locale locale) {
        return redirectReactMigration(request, locale, "verification-assets");
    }

    @GetMapping("/verification-center/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> verificationCenterPageApi(
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = isEnglishRequest(request, locale);
        return buildPageDataResponse(request, model -> model.addAllAttributes(adminShellBootstrapPageService.buildVerificationCenterPageData(isEn)));
    }

    @PostMapping("/verification-center/run-check")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> runVerificationCenterCheck(
            @RequestBody(required = false) Map<String, Object> payload,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = isEnglishRequest(request, locale);
        try {
            String actionType = payload == null ? "" : String.valueOf(payload.getOrDefault("actionType", ""));
            return ResponseEntity.ok(adminShellBootstrapPageService.runVerificationCenterCheck(actionType, resolveActorId(request), isEn));
        } catch (IllegalArgumentException e) {
            Map<String, Object> error = new LinkedHashMap<String, Object>();
            error.put("success", false);
            error.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    @GetMapping("/verification-assets/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> verificationAssetsPageApi(
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = isEnglishRequest(request, locale);
        return buildPageDataResponse(request, model -> model.addAllAttributes(adminShellBootstrapPageService.buildVerificationAssetManagementPageData(isEn)));
    }

    @PostMapping("/verification-assets/upsert-baseline")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> upsertVerificationBaseline(
            @RequestBody(required = false) Map<String, Object> payload,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = isEnglishRequest(request, locale);
        try {
            return ResponseEntity.ok(adminShellBootstrapPageService.upsertVerificationBaseline(
                    payload == null ? new LinkedHashMap<String, Object>() : payload,
                    resolveActorId(request),
                    isEn));
        } catch (IllegalArgumentException e) {
            Map<String, Object> error = new LinkedHashMap<String, Object>();
            error.put("success", false);
            error.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    @PostMapping("/verification-assets/upsert-account")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> upsertVerificationAccount(
            @RequestBody(required = false) Map<String, Object> payload,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = isEnglishRequest(request, locale);
        try {
            return ResponseEntity.ok(adminShellBootstrapPageService.upsertVerificationAccount(
                    payload == null ? new LinkedHashMap<String, Object>() : payload,
                    resolveActorId(request),
                    isEn));
        } catch (IllegalArgumentException e) {
            Map<String, Object> error = new LinkedHashMap<String, Object>();
            error.put("success", false);
            error.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    @PostMapping("/verification-assets/upsert-dataset")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> upsertVerificationDataset(
            @RequestBody(required = false) Map<String, Object> payload,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = isEnglishRequest(request, locale);
        try {
            return ResponseEntity.ok(adminShellBootstrapPageService.upsertVerificationDataset(
                    payload == null ? new LinkedHashMap<String, Object>() : payload,
                    isEn));
        } catch (IllegalArgumentException e) {
            Map<String, Object> error = new LinkedHashMap<String, Object>();
            error.put("success", false);
            error.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    @PostMapping("/verification-assets/resolve-action")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> resolveVerificationAction(
            @RequestBody(required = false) Map<String, Object> payload,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = isEnglishRequest(request, locale);
        try {
            String actionId = payload == null ? "" : String.valueOf(payload.getOrDefault("actionId", ""));
            return ResponseEntity.ok(adminShellBootstrapPageService.resolveVerificationAction(actionId, isEn));
        } catch (IllegalArgumentException e) {
            Map<String, Object> error = new LinkedHashMap<String, Object>();
            error.put("success", false);
            error.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    @RequestMapping(value = "/asset-detail", method = RequestMethod.GET)
    public String assetDetail(HttpServletRequest request, Locale locale) {
        return redirectReactMigration(request, locale, "asset-detail");
    }

    @RequestMapping(value = "/asset-impact", method = RequestMethod.GET)
    public String assetImpact(HttpServletRequest request, Locale locale) {
        return redirectReactMigration(request, locale, "asset-impact");
    }

    @RequestMapping(value = "/asset-lifecycle", method = RequestMethod.GET)
    public String assetLifecycle(HttpServletRequest request, Locale locale) {
        return redirectReactMigration(request, locale, "asset-lifecycle");
    }

    @RequestMapping(value = "/asset-gap", method = RequestMethod.GET)
    public String assetGap(HttpServletRequest request, Locale locale) {
        return redirectReactMigration(request, locale, "asset-gap");
    }

    @RequestMapping(value = "/wbs-management", method = RequestMethod.GET)
    public String wbsManagement(HttpServletRequest request, Locale locale) {
        return redirectReactMigration(request, locale, "wbs-management");
    }

    @RequestMapping(value = "/db-promotion-policy", method = RequestMethod.GET)
    public String dbPromotionPolicy(HttpServletRequest request, Locale locale) {
        return redirectReactMigration(request, locale, "db-promotion-policy");
    }

    @RequestMapping(value = "/db-sync-deploy", method = RequestMethod.GET)
    public String dbSyncDeploy(HttpServletRequest request, Locale locale) {
        return redirectReactMigration(request, locale, "db-sync-deploy");
    }

    @GetMapping("/db-sync-deploy/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> dbSyncDeployPageApi(
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = isEnglishRequest(request, locale);
        return buildPageDataResponse(request, model -> model.addAllAttributes(dbSyncDeployManagementService.buildPageData(isEn)));
    }

    @PostMapping("/db-sync-deploy/analyze")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> analyzeDbSyncDeploy(
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = isEnglishRequest(request, locale);
        return ResponseEntity.ok(dbSyncDeployManagementService.analyze(isEn));
    }

    @PostMapping("/db-sync-deploy/validate-policy")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> validateDbSyncDeployPolicy(
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = isEnglishRequest(request, locale);
        return ResponseEntity.ok(dbSyncDeployManagementService.validatePolicy(isEn));
    }

    @PostMapping("/db-sync-deploy/execute")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> executeDbSyncDeploy(
            @RequestBody(required = false) Map<String, Object> payload,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = isEnglishRequest(request, locale);
        try {
            return ResponseEntity.ok(dbSyncDeployManagementService.execute(payload, resolveActorId(request), isEn));
        } catch (IllegalArgumentException | IllegalStateException e) {
            Map<String, Object> error = new LinkedHashMap<String, Object>();
            error.put("success", false);
            error.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    @RequestMapping(value = "/new-page", method = RequestMethod.GET)
    public String newPage(HttpServletRequest request, Locale locale) {
        return redirectReactMigration(request, locale, "new-page");
    }

    @GetMapping("/new-page/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> newPagePageApi(
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = isEnglishRequest(request, locale);
        return buildPageDataResponse(request, model -> model.addAllAttributes(adminShellBootstrapPageService.buildNewPagePageData(isEn)));
    }

    @GetMapping("/wbs-management/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> wbsManagementPageApi(
            @RequestParam(value = "menuType", defaultValue = "ADMIN") String menuType,
            HttpServletRequest request,
            Locale locale) {
        String normalizedMenuType = normalizeMenuType(menuType);
        return buildPageDataResponse(request, model -> model.addAllAttributes(wbsManagementService.buildPagePayload(normalizedMenuType)));
    }

    @GetMapping("/db-promotion-policy/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> dbPromotionPolicyPageApi(
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = isEnglishRequest(request, locale);
        return buildPageDataResponse(request, model -> model.addAllAttributes(dbPromotionPolicyManagementService.buildPageData(isEn)));
    }

    @PostMapping("/db-promotion-policy/save")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> saveDbPromotionPolicy(
            @RequestBody(required = false) Map<String, Object> payload,
            HttpServletRequest request,
            Locale locale) {
        boolean isEn = isEnglishRequest(request, locale);
        try {
            return ResponseEntity.ok(dbPromotionPolicyManagementService.save(payload, resolveActorId(request), isEn, request));
        } catch (IllegalArgumentException e) {
            Map<String, Object> error = new LinkedHashMap<String, Object>();
            error.put("success", false);
            error.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(error);
        }
    }

    @RequestMapping(value = {
            "/platform-studio",
            "/screen-elements-management",
            "/event-management-console",
            "/function-management-console",
            "/api-management-console",
            "/controller-management-console",
            "/db-table-management",
            "/column-management-console",
            "/automation-studio"
    }, method = RequestMethod.GET)
    public String platformStudioPages(HttpServletRequest request, Locale locale) {
        return redirectReactMigration(request, locale, resolvePlatformStudioRoute(request));
    }

    @GetMapping("/full-stack-management/page-data")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> fullStackManagementPageApi(
            @RequestParam(value = "menuType", defaultValue = "ADMIN") String menuType,
            @RequestParam(value = "saved", required = false) String saved,
            HttpServletRequest request,
            Locale locale) {
        return buildPageDataResponse(request,
                model -> model.addAllAttributes(
                        adminMenuManagementPageService.buildFullStackManagementPageData(menuType, saved, request, locale)));
    }

    @PostMapping("/full-stack-management/menu-visibility")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> updateFullStackMenuVisibility(
            @RequestParam(value = "menuType", defaultValue = "ADMIN") String menuType,
            @RequestParam(value = "menuCode", required = false) String menuCode,
            @RequestParam(value = "useAt", required = false) String useAt,
            HttpServletRequest request,
            Locale locale) {
        return adminMenuManagementCommandService.updateFullStackMenuVisibility(menuType, menuCode, useAt, request, locale);
    }

    @PostMapping({"/menu-management/order", "/menu/order"})
    @ResponseBody
    public ResponseEntity<Map<String, Object>> saveMenuManagementOrder(
            @RequestParam(value = "menuType", defaultValue = "ADMIN") String menuType,
            @RequestParam(value = "orderPayload", required = false) String orderPayload,
            HttpServletRequest request,
            Locale locale,
            Model model) {
        return adminMenuManagementCommandService.saveMenuManagementOrder(menuType, orderPayload, request, locale);
    }

    @PostMapping({"/admin/content/menu/order", "/en/admin/content/menu/order"})
    @ResponseBody
    public ResponseEntity<Map<String, Object>> saveContentMenuManagementOrder(
            @RequestParam(value = "menuType", defaultValue = "ADMIN") String menuType,
            @RequestParam(value = "orderPayload", required = false) String orderPayload,
            HttpServletRequest request,
            Locale locale,
            Model model) {
        return saveMenuManagementOrder(menuType, orderPayload, request, locale, model);
    }

    @PostMapping({"/menu-management/create-page", "/menu/create-page"})
    @ResponseBody
    public ResponseEntity<Map<String, Object>> createMenuManagedPageApi(
            @RequestParam(value = "menuType", defaultValue = "ADMIN") String menuType,
            @RequestParam(value = "parentCode", required = false) String parentCode,
            @RequestParam(value = "codeNm", required = false) String codeNm,
            @RequestParam(value = "codeDc", required = false) String codeDc,
            @RequestParam(value = "menuUrl", required = false) String menuUrl,
            @RequestParam(value = "menuIcon", required = false) String menuIcon,
            @RequestParam(value = "useAt", required = false) String useAt,
            HttpServletRequest request,
            Locale locale) {
        return adminMenuManagementCommandService.createMenuManagedPage(
                menuType,
                parentCode,
                codeNm,
                codeDc,
                menuUrl,
                menuIcon,
                useAt,
                request,
                locale);
    }

    @PostMapping({"/admin/content/menu/create-page", "/en/admin/content/menu/create-page"})
    @ResponseBody
    public ResponseEntity<Map<String, Object>> createContentMenuManagedPageApi(
            @RequestParam(value = "menuType", defaultValue = "ADMIN") String menuType,
            @RequestParam(value = "parentCode", required = false) String parentCode,
            @RequestParam(value = "codeNm", required = false) String codeNm,
            @RequestParam(value = "codeDc", required = false) String codeDc,
            @RequestParam(value = "menuUrl", required = false) String menuUrl,
            @RequestParam(value = "menuIcon", required = false) String menuIcon,
            @RequestParam(value = "useAt", required = false) String useAt,
            HttpServletRequest request,
            Locale locale) {
        return createMenuManagedPageApi(
                menuType,
                parentCode,
                codeNm,
                codeDc,
                menuUrl,
                menuIcon,
                useAt,
                request,
                locale);
    }

    @PostMapping("/environment-management/page/update")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> updateEnvironmentManagedPageApi(
            @RequestParam(value = "menuType", defaultValue = "ADMIN") String menuType,
            @RequestParam(value = "code", required = false) String code,
            @RequestParam(value = "codeNm", required = false) String codeNm,
            @RequestParam(value = "codeDc", required = false) String codeDc,
            @RequestParam(value = "menuUrl", required = false) String menuUrl,
            @RequestParam(value = "menuIcon", required = false) String menuIcon,
            @RequestParam(value = "useAt", required = false) String useAt,
            HttpServletRequest request,
            Locale locale) {
        return adminPageManagementCommandService.updateEnvironmentManagedPage(
                menuType, code, codeNm, codeDc, menuUrl, menuIcon, useAt, request, locale);
    }

    @GetMapping("/environment-management/page-impact")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> environmentManagedPageImpactApi(
            @RequestParam(value = "menuType", defaultValue = "ADMIN") String menuType,
            @RequestParam(value = "code", required = false) String code,
            HttpServletRequest request,
            Locale locale) {
        return adminPageManagementCommandService.environmentManagedPageImpact(menuType, code, request, locale);
    }

    @PostMapping("/environment-management/page/delete")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> deleteEnvironmentManagedPageApi(
            @RequestParam(value = "menuType", defaultValue = "ADMIN") String menuType,
            @RequestParam(value = "code", required = false) String code,
            HttpServletRequest request,
            Locale locale) {
        return adminPageManagementCommandService.deleteEnvironmentManagedPage(menuType, code, request, locale);
    }

    @RequestMapping(value = "/feature-management/create", method = RequestMethod.POST)
    public String createFeatureManagement(
            @RequestParam(value = "menuType", defaultValue = "ADMIN") String menuType,
            @RequestParam(value = "menuCode", required = false) String menuCode,
            @RequestParam(value = "featureCode", required = false) String featureCode,
            @RequestParam(value = "featureNm", required = false) String featureNm,
            @RequestParam(value = "featureNmEn", required = false) String featureNmEn,
            @RequestParam(value = "featureDc", required = false) String featureDc,
            @RequestParam(value = "useAt", required = false) String useAt,
            HttpServletRequest request,
            Locale locale,
            Model model) {
        return adminFeatureManagementCommandService.createFeatureManagement(
                menuType, menuCode, featureCode, featureNm, featureNmEn, featureDc, useAt, request, locale);
    }

    @PostMapping("/environment-management/feature/update")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> updateEnvironmentFeatureApi(
            @RequestParam(value = "menuType", defaultValue = "ADMIN") String menuType,
            @RequestParam(value = "menuCode", required = false) String menuCode,
            @RequestParam(value = "featureCode", required = false) String featureCode,
            @RequestParam(value = "featureNm", required = false) String featureNm,
            @RequestParam(value = "featureNmEn", required = false) String featureNmEn,
            @RequestParam(value = "featureDc", required = false) String featureDc,
            @RequestParam(value = "useAt", required = false) String useAt,
            HttpServletRequest request,
            Locale locale) {
        return adminFeatureManagementCommandService.updateEnvironmentFeature(
                menuType, menuCode, featureCode, featureNm, featureNmEn, featureDc, useAt, request, locale);
    }

    @GetMapping("/environment-management/feature-impact")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> environmentFeatureImpactApi(
            @RequestParam(value = "featureCode", required = false) String featureCode,
            HttpServletRequest request,
            Locale locale) {
        return adminFeatureManagementCommandService.environmentFeatureImpact(featureCode, request, locale);
    }

    @RequestMapping(value = "/feature-management/delete", method = RequestMethod.POST)
    public String deleteFeatureManagement(
            @RequestParam(value = "menuType", defaultValue = "ADMIN") String menuType,
            @RequestParam(value = "featureCode", required = false) String featureCode,
            @RequestParam(value = "searchMenuCode", required = false) String searchMenuCode,
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            HttpServletRequest request,
            Locale locale,
            Model model) {
        return adminFeatureManagementCommandService.deleteFeatureManagement(
                menuType, featureCode, searchMenuCode, searchKeyword, request, locale);
    }

    @PostMapping("/environment-management/feature/delete")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> deleteEnvironmentFeatureApi(
            @RequestParam(value = "featureCode", required = false) String featureCode,
            HttpServletRequest request,
            Locale locale) {
        return adminFeatureManagementCommandService.deleteEnvironmentFeature(featureCode, request, locale);
    }

    private String normalizeMenuType(String menuType) {
        return "USER".equalsIgnoreCase(safeString(menuType)) ? "USER" : "ADMIN";
    }

    @RequestMapping(value = "/page-management/create", method = RequestMethod.POST)
    public String createPageManagement(
            @RequestParam(value = "menuType", defaultValue = "ADMIN") String menuType,
            @RequestParam(value = "code", required = false) String code,
            @RequestParam(value = "codeNm", required = false) String codeNm,
            @RequestParam(value = "codeDc", required = false) String codeDc,
            @RequestParam(value = "menuUrl", required = false) String menuUrl,
            @RequestParam(value = "menuIcon", required = false) String menuIcon,
            @RequestParam(value = "domainCode", required = false) String domainCode,
            @RequestParam(value = "useAt", required = false) String useAt,
            HttpServletRequest request,
            Locale locale,
            Model model) {
        return adminPageManagementCommandService.createPageManagement(
                menuType, code, codeNm, codeDc, menuUrl, menuIcon, domainCode, useAt, request, locale);
    }

    @RequestMapping(value = "/page-management/update", method = RequestMethod.POST)
    public String updatePageManagement(
            @RequestParam(value = "menuType", defaultValue = "ADMIN") String menuType,
            @RequestParam(value = "code", required = false) String code,
            @RequestParam(value = "codeNm", required = false) String codeNm,
            @RequestParam(value = "codeDc", required = false) String codeDc,
            @RequestParam(value = "menuUrl", required = false) String menuUrl,
            @RequestParam(value = "menuIcon", required = false) String menuIcon,
            @RequestParam(value = "useAt", required = false) String useAt,
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "searchUrl", required = false) String searchUrl,
            HttpServletRequest request,
            Locale locale,
            Model model) {
        return adminPageManagementCommandService.updatePageManagement(
                menuType, code, codeNm, codeDc, menuUrl, menuIcon, useAt, searchKeyword, searchUrl, request, locale);
    }

    @RequestMapping(value = "/page-management/delete", method = RequestMethod.POST)
    public String deletePageManagement(
            @RequestParam(value = "menuType", defaultValue = "ADMIN") String menuType,
            @RequestParam(value = "code", required = false) String code,
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "searchUrl", required = false) String searchUrl,
            HttpServletRequest request,
            Locale locale,
            Model model) {
        return adminPageManagementCommandService.deletePageManagement(
                menuType, code, searchKeyword, searchUrl, request, locale);
    }

    @RequestMapping(value = "/code/class/create", method = RequestMethod.POST)
    public String createClassCode(
            @RequestParam(value = "clCode", required = false) String clCode,
            @RequestParam(value = "clCodeNm", required = false) String clCodeNm,
            @RequestParam(value = "clCodeDc", required = false) String clCodeDc,
            @RequestParam(value = "useAt", required = false) String useAt,
            @RequestParam(value = "currentDetailCodeId", required = false) String currentDetailCodeId,
            HttpServletRequest request,
            Locale locale,
            Model model) {
        return adminCodeManagementCommandService.createClassCode(
                clCode, clCodeNm, clCodeDc, useAt, currentDetailCodeId, request, locale);
    }

    @RequestMapping(value = "/code/class/update", method = RequestMethod.POST)
    public String updateClassCode(
            @RequestParam(value = "clCode", required = false) String clCode,
            @RequestParam(value = "clCodeNm", required = false) String clCodeNm,
            @RequestParam(value = "clCodeDc", required = false) String clCodeDc,
            @RequestParam(value = "useAt", required = false) String useAt,
            @RequestParam(value = "currentDetailCodeId", required = false) String currentDetailCodeId,
            HttpServletRequest request,
            Locale locale,
            Model model) {
        return adminCodeManagementCommandService.updateClassCode(
                clCode, clCodeNm, clCodeDc, useAt, currentDetailCodeId, request, locale);
    }

    @RequestMapping(value = "/code/class/delete", method = RequestMethod.POST)
    public String deleteClassCode(
            @RequestParam(value = "clCode", required = false) String clCode,
            @RequestParam(value = "currentDetailCodeId", required = false) String currentDetailCodeId,
            HttpServletRequest request,
            Locale locale,
            Model model) {
        return adminCodeManagementCommandService.deleteClassCode(
                clCode, currentDetailCodeId, request, locale);
    }

    @RequestMapping(value = "/code/group/create", method = RequestMethod.POST)
    public String createCommonCode(
            @RequestParam(value = "codeId", required = false) String codeId,
            @RequestParam(value = "codeIdNm", required = false) String codeIdNm,
            @RequestParam(value = "codeIdDc", required = false) String codeIdDc,
            @RequestParam(value = "clCode", required = false) String clCode,
            @RequestParam(value = "useAt", required = false) String useAt,
            @RequestParam(value = "currentDetailCodeId", required = false) String currentDetailCodeId,
            HttpServletRequest request,
            Locale locale,
            Model model) {
        return adminCodeManagementCommandService.createCommonCode(
                codeId, codeIdNm, codeIdDc, clCode, useAt, currentDetailCodeId, request, locale);
    }

    @RequestMapping(value = "/code/group/update", method = RequestMethod.POST)
    public String updateCommonCode(
            @RequestParam(value = "codeId", required = false) String codeId,
            @RequestParam(value = "codeIdNm", required = false) String codeIdNm,
            @RequestParam(value = "codeIdDc", required = false) String codeIdDc,
            @RequestParam(value = "clCode", required = false) String clCode,
            @RequestParam(value = "useAt", required = false) String useAt,
            @RequestParam(value = "currentDetailCodeId", required = false) String currentDetailCodeId,
            HttpServletRequest request,
            Locale locale,
            Model model) {
        return adminCodeManagementCommandService.updateCommonCode(
                codeId, codeIdNm, codeIdDc, clCode, useAt, currentDetailCodeId, request, locale);
    }

    @RequestMapping(value = "/code/group/delete", method = RequestMethod.POST)
    public String deleteCommonCode(
            @RequestParam(value = "codeId", required = false) String codeId,
            @RequestParam(value = "currentDetailCodeId", required = false) String currentDetailCodeId,
            HttpServletRequest request,
            Locale locale,
            Model model) {
        return adminCodeManagementCommandService.deleteCommonCode(
                codeId, currentDetailCodeId, request, locale);
    }

    @RequestMapping(value = "/code/detail/create", method = RequestMethod.POST)
    public String createDetailCode(
            @RequestParam(value = "codeId", required = false) String codeId,
            @RequestParam(value = "code", required = false) String code,
            @RequestParam(value = "codeNm", required = false) String codeNm,
            @RequestParam(value = "codeDc", required = false) String codeDc,
            @RequestParam(value = "useAt", required = false) String useAt,
            HttpServletRequest request,
            Locale locale,
            Model model) {
        return adminCodeManagementCommandService.createDetailCode(
                codeId, code, codeNm, codeDc, useAt, request, locale);
    }

    @RequestMapping(value = "/code/detail/update", method = RequestMethod.POST)
    public String updateDetailCode(
            @RequestParam(value = "codeId", required = false) String codeId,
            @RequestParam(value = "code", required = false) String code,
            @RequestParam(value = "codeNm", required = false) String codeNm,
            @RequestParam(value = "codeDc", required = false) String codeDc,
            @RequestParam(value = "useAt", required = false) String useAt,
            HttpServletRequest request,
            Locale locale,
            Model model) {
        return adminCodeManagementCommandService.updateDetailCode(
                codeId, code, codeNm, codeDc, useAt, request, locale);
    }

    @RequestMapping(value = "/code/detail/bulk-use", method = RequestMethod.POST)
    public String bulkUpdateDetailCodeUseAt(
            @RequestParam(value = "codeId", required = false) String codeId,
            @RequestParam(value = "codes", required = false) String codes,
            @RequestParam(value = "useAt", required = false) String useAt,
            HttpServletRequest request,
            Locale locale,
            Model model) {
        return adminCodeManagementCommandService.bulkUpdateDetailCodeUseAt(
                codeId, codes, useAt, request, locale);
    }

    @RequestMapping(value = "/code/detail/delete", method = RequestMethod.POST)
    public String deleteDetailCode(
            @RequestParam(value = "codeId", required = false) String codeId,
            @RequestParam(value = "code", required = false) String code,
            HttpServletRequest request,
            Locale locale,
            Model model) {
        return adminCodeManagementCommandService.deleteDetailCode(
                codeId, code, request, locale);
    }

    private boolean isEnglishRequest(HttpServletRequest request, Locale locale) {
        if (request != null) {
            String path = request.getRequestURI();
            if (path != null && path.startsWith("/en/")) {
                return true;
            }
            String param = request.getParameter("language");
            if ("en".equalsIgnoreCase(param)) {
                return true;
            }
        }
        return locale != null && locale.getLanguage().toLowerCase(Locale.ROOT).startsWith("en");
    }

    private void primeCsrfToken(HttpServletRequest request) {
        if (request == null) {
            return;
        }
        Object token = request.getAttribute("_csrf");
        if (token instanceof CsrfToken) {
            ((CsrfToken) token).getToken();
        }
    }

    private ResponseEntity<Map<String, Object>> buildPageDataResponse(HttpServletRequest request,
                                                                      Consumer<ExtendedModelMap> populator) {
        primeCsrfToken(request);
        ExtendedModelMap model = new ExtendedModelMap();
        populator.accept(model);
        return ResponseEntity.ok(new LinkedHashMap<>(model));
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> filterContentMenuRows(Object menuRows) {
        List<Map<String, Object>> filtered = new ArrayList<>();
        if (!(menuRows instanceof List<?>)) {
            return filtered;
        }
        for (Object row : (List<?>) menuRows) {
            if (!(row instanceof Map<?, ?>)) {
                continue;
            }
            Map<?, ?> rawRow = (Map<?, ?>) row;
            String normalizedCode = safeString(rawRow.get("code")).toUpperCase(Locale.ROOT);
            if (normalizedCode.startsWith(FAQ_BRANCH_CODE)) {
                filtered.add((Map<String, Object>) rawRow);
            }
        }
        return filtered;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> filterContentGroupMenuOptions(Object options) {
        List<Map<String, Object>> filtered = new ArrayList<>();
        if (!(options instanceof List<?>)) {
            return filtered;
        }
        for (Object option : (List<?>) options) {
            if (!(option instanceof Map<?, ?>)) {
                continue;
            }
            Map<?, ?> rawOption = (Map<?, ?>) option;
            String normalizedValue = safeString(rawOption.get("value")).toUpperCase(Locale.ROOT);
            if (normalizedValue.startsWith(FAQ_BRANCH_CODE)) {
                filtered.add((Map<String, Object>) rawOption);
            }
        }
        return filtered;
    }

    private String resolvePlatformStudioRoute(HttpServletRequest request) {
        String requestUri = request == null ? "" : safeString(request.getRequestURI());
        for (Map.Entry<String, String> routeEntry : PLATFORM_STUDIO_ROUTE_BY_SUFFIX.entrySet()) {
            if (requestUri.endsWith(routeEntry.getKey())) {
                return routeEntry.getValue();
            }
        }
        return "platform-studio";
    }

    private static Map<String, String> buildPlatformStudioRouteMap() {
        Map<String, String> routeMap = new LinkedHashMap<>();
        routeMap.put("/screen-elements-management", "screen-elements-management");
        routeMap.put("/event-management-console", "event-management-console");
        routeMap.put("/function-management-console", "function-management-console");
        routeMap.put("/api-management-console", "api-management-console");
        routeMap.put("/controller-management-console", "controller-management-console");
        routeMap.put("/db-table-management", "db-table-management");
        routeMap.put("/column-management-console", "column-management-console");
        routeMap.put("/automation-studio", "automation-studio");
        return Collections.unmodifiableMap(routeMap);
    }

    private String redirectReactMigration(HttpServletRequest request, Locale locale, String route) {
        return adminReactRouteSupport.forwardAdminRoute(request, locale, route);
    }

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }

    private String safeString(Object value) {
        return value == null ? "" : value.toString().trim();
    }

    private String resolveActorId(HttpServletRequest request) {
        if (request == null || request.getSession(false) == null) {
            return "system";
        }
        Object loginId = request.getSession(false).getAttribute("loginId");
        if (loginId != null && !safeString(loginId).isEmpty()) {
            return safeString(loginId);
        }
        Object uniqId = request.getSession(false).getAttribute("uniqId");
        if (uniqId != null && !safeString(uniqId).isEmpty()) {
            return safeString(uniqId);
        }
        return "system";
    }

}
