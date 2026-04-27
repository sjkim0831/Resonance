package egovframework.com.feature.admin.service.impl;

import egovframework.com.platform.menu.dto.AdminMenuDomainDTO;
import egovframework.com.platform.executiongate.ExecutionGateVersion;
import egovframework.com.platform.executiongate.menu.MenuResolutionGate;
import egovframework.com.platform.executiongate.menu.MenuResolutionGateRequest;
import egovframework.com.platform.executiongate.menu.MenuResolutionGateResponse;
import egovframework.com.platform.read.AdminMenuTreeReadPort;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
public class AdminMenuResolutionGateService implements MenuResolutionGate {

    private final AdminMenuTreeReadPort adminMenuTreeReadPort;

    public AdminMenuResolutionGateService(AdminMenuTreeReadPort adminMenuTreeReadPort) {
        this.adminMenuTreeReadPort = adminMenuTreeReadPort;
    }

    @Override
    public MenuResolutionGateResponse resolve(MenuResolutionGateRequest request) {
        boolean english = isEnglishRequest(request.menuCode(), request.requestUri());
        Map<String, AdminMenuDomainDTO> domains = adminMenuTreeReadPort.buildAdminMenuTree(english, request.authorCode());

        Map<String, Object> descriptor = new LinkedHashMap<>();
        descriptor.put("domains", domains);
        descriptor.put("admin", request.admin());
        descriptor.put("locale", english ? "en" : "ko");
        descriptor.put("requestUri", request.requestUri());

        return new MenuResolutionGateResponse(
                request.context() == null ? ExecutionGateVersion.CURRENT : request.context().executionGateVersion(),
                request.menuCode(),
                request.requestUri(),
                descriptor
        );
    }

    private boolean isEnglishRequest(String menuCode, String requestUri) {
        String normalizedMenuCode = safe(menuCode).toLowerCase();
        String normalizedRequestUri = safe(requestUri).toLowerCase();
        return normalizedMenuCode.endsWith(":en") || normalizedRequestUri.startsWith("/en/");
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
