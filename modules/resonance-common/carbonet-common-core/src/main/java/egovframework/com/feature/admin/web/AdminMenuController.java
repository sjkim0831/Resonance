package egovframework.com.feature.admin.web;

import egovframework.com.platform.menu.dto.AdminMenuDomainDTO;
import egovframework.com.platform.menu.service.MenuInfoService;
import egovframework.com.feature.auth.service.CurrentUserContextService;
import egovframework.com.platform.executiongate.ExecutionGateRequestContext;
import egovframework.com.platform.executiongate.GateActorScope;
import egovframework.com.platform.executiongate.GateRouteScope;
import egovframework.com.platform.executiongate.menu.MenuResolutionGate;
import egovframework.com.platform.executiongate.menu.MenuResolutionGateRequest;
import egovframework.com.platform.executiongate.menu.MenuResolutionGateResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Locale;
import java.util.Map;

@Controller
@RequestMapping({"/admin/system", "/en/admin/system"})
@RequiredArgsConstructor
public class AdminMenuController {

    private final AdminReactRouteSupport adminReactRouteSupport;
    private final CurrentUserContextService currentUserContextService;
    private final MenuResolutionGate menuResolutionGate;
    private final MenuInfoService menuInfoService;

    @RequestMapping(value = "/menu-data", method = RequestMethod.GET)
    @ResponseBody
    @SuppressWarnings("unchecked")
    public Map<String, AdminMenuDomainDTO> adminMenuData(HttpServletRequest request, Locale locale) {
        boolean englishRequest = adminReactRouteSupport.isEnglishRequest(request, locale);
        MenuResolutionGateResponse response = menuResolutionGate.resolve(new MenuResolutionGateRequest(
                ExecutionGateRequestContext.of(
                        null,
                        GateActorScope.PROJECT_ADMIN,
                        GateRouteScope.PROJECT_ADMIN,
                        "admin.menu.resolve",
                        null,
                        request == null ? null : request.getHeader("X-Trace-Id"),
                        request == null ? null : request.getHeader("X-Request-Id")
                ),
                englishRequest ? "AMENU1:en" : "AMENU1:ko",
                request == null ? null : request.getRequestURI(),
                request == null ? null : currentUserContextService.resolve(request).getAuthorCode(),
                true
        ));
        Object domains = response.menuDescriptor().get("domains");
        if (domains instanceof Map<?, ?> domainMap) {
            return (Map<String, AdminMenuDomainDTO>) domainMap;
        }
        return Map.of();
    }

    @PostMapping("/menu/toggle-exposure")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> toggleMenuExposure(
            @RequestParam String menuType,
            @RequestParam String menuCode,
            @RequestParam String expsrAt) {
        try {
            menuInfoService.saveMenuExposure(menuCode, expsrAt);
            return ResponseEntity.ok(Map.of("success", true, "message", "Menu exposure toggled"));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("success", false, "message", "Failed to toggle menu exposure: " + e.getMessage()));
        }
    }

    @PostMapping("/menu/update-dependent-screen")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> updateDependentScreen(
            @RequestParam String menuType,
            @RequestParam String menuCode,
            @RequestParam String dependentScreenCode) {
        try {
            menuInfoService.saveDependentScreen(menuCode, dependentScreenCode);
            return ResponseEntity.ok(Map.of("success", true, "message", "Dependent screen updated"));
        } catch (Exception e) {
            return ResponseEntity.ok(Map.of("success", false, "message", "Failed to update dependent screen: " + e.getMessage()));
        }
    }
}
