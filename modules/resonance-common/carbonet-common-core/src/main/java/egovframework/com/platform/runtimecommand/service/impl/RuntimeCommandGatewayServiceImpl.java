package egovframework.com.platform.runtimecommand.service.impl;

import egovframework.com.platform.governance.service.AdminCodeManageService;
import egovframework.com.platform.menu.service.MenuInfoService;
import egovframework.com.platform.runtimecommand.service.RuntimeCommandGatewayService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.support.TransactionTemplate;

import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class RuntimeCommandGatewayServiceImpl implements RuntimeCommandGatewayService {

    private static final Set<String> BUILT_IN_COMMANDS = Set.of(
            "admin.menu.updatePage",
            "admin.menu.toggleExposure",
            "admin.menu.updateDependentScreen"
    );

    private final AdminCodeManageService adminCodeManageService;
    private final MenuInfoService menuInfoService;
    private final TransactionTemplate transactionTemplate;

    public RuntimeCommandGatewayServiceImpl(AdminCodeManageService adminCodeManageService,
                                            MenuInfoService menuInfoService,
                                            PlatformTransactionManager transactionManager) {
        this.adminCodeManageService = adminCodeManageService;
        this.menuInfoService = menuInfoService;
        this.transactionTemplate = new TransactionTemplate(transactionManager);
    }

    @Override
    public Map<String, Object> execute(String commandId, Map<String, Object> params, String actorId) throws Exception {
        String normalizedCommandId = safe(commandId);
        if (!BUILT_IN_COMMANDS.contains(normalizedCommandId)) {
            return failure(normalizedCommandId, "Unsupported runtime command. Register a safe handler before use.");
        }
        try {
            return transactionTemplate.execute(status -> {
                try {
                    return executeBuiltIn(normalizedCommandId, params == null ? Map.of() : params, safe(actorId));
                } catch (Exception e) {
                    status.setRollbackOnly();
                    return failure(normalizedCommandId, e.getMessage());
                }
            });
        } catch (RuntimeException e) {
            return failure(normalizedCommandId, e.getMessage());
        }
    }

    private Map<String, Object> executeBuiltIn(String commandId, Map<String, Object> params, String actorId) throws Exception {
        switch (commandId) {
            case "admin.menu.updatePage":
                return updateMenuPage(commandId, params, actorId);
            case "admin.menu.toggleExposure":
                return toggleMenuExposure(commandId, params);
            case "admin.menu.updateDependentScreen":
                return updateDependentScreen(commandId, params);
            default:
                return failure(commandId, "Unsupported runtime command");
        }
    }

    private Map<String, Object> updateMenuPage(String commandId, Map<String, Object> params, String actorId) throws Exception {
        String code = safe(params.get("code")).toUpperCase(Locale.ROOT);
        String codeNm = safe(params.get("codeNm"));
        String codeDc = safe(params.get("codeDc"));
        String menuUrl = safe(params.get("menuUrl"));
        String menuIcon = safe(params.get("menuIcon"));
        String useAt = safe(params.get("useAt"));
        if (code.isEmpty() || codeNm.isEmpty() || menuUrl.isEmpty()) {
            return failure(commandId, "code, codeNm, and menuUrl are required");
        }
        String updaterId = actorId.isEmpty() ? "system" : actorId;
        adminCodeManageService.updatePageManagement(
                code,
                codeNm,
                codeDc.isEmpty() ? codeNm : codeDc,
                menuUrl,
                menuIcon.isEmpty() ? "menu" : menuIcon,
                useAt.isEmpty() ? "Y" : useAt,
                updaterId
        );
        return success(commandId, Map.of("code", code, "codeNm", codeNm, "menuUrl", menuUrl));
    }

    private Map<String, Object> toggleMenuExposure(String commandId, Map<String, Object> params) throws Exception {
        String menuCode = firstNonBlank(safe(params.get("menuCode")), safe(params.get("code"))).toUpperCase(Locale.ROOT);
        String expsrAt = safe(params.get("expsrAt")).toUpperCase(Locale.ROOT);
        if (menuCode.isEmpty() || expsrAt.isEmpty()) {
            return failure(commandId, "menuCode and expsrAt are required");
        }
        String normalizedExposure = "Y".equals(expsrAt) ? "Y" : "N";
        menuInfoService.saveMenuExposure(menuCode, normalizedExposure);
        return success(commandId, Map.of("menuCode", menuCode, "expsrAt", normalizedExposure));
    }

    private Map<String, Object> updateDependentScreen(String commandId, Map<String, Object> params) throws Exception {
        String menuCode = firstNonBlank(safe(params.get("menuCode")), safe(params.get("code"))).toUpperCase(Locale.ROOT);
        String dependentScreenCode = safe(params.get("dependentScreenCode")).toUpperCase(Locale.ROOT);
        if (menuCode.isEmpty()) {
            return failure(commandId, "menuCode is required");
        }
        menuInfoService.saveDependentScreen(menuCode, dependentScreenCode);
        return success(commandId, Map.of("menuCode", menuCode, "dependentScreenCode", dependentScreenCode));
    }

    private Map<String, Object> success(String commandId, Map<String, Object> data) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", true);
        response.put("commandId", commandId);
        response.put("transaction", "committed");
        response.put("data", data == null ? Map.of() : data);
        return response;
    }

    private Map<String, Object> failure(String commandId, String message) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("success", false);
        response.put("commandId", commandId);
        response.put("transaction", "rolled_back");
        response.put("message", safe(message).isEmpty() ? "Runtime command failed" : safe(message));
        return response;
    }

    private String firstNonBlank(String first, String second) {
        return first == null || first.isBlank() ? second : first;
    }

    private String safe(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }
}
