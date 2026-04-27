package egovframework.com.platform.screenbuilder.support;

import egovframework.com.platform.screenbuilder.support.model.ScreenBuilderAuthorityDecision;
import egovframework.com.framework.authority.model.FrameworkAuthorityRoleContractVO;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;

public interface CarbonetScreenBuilderAuthoritySource {

    List<FrameworkAuthorityRoleContractVO> getAuthorityRoles() throws Exception;

    default ScreenBuilderAuthorityDecision authorizeMenuAccess(String menuCode,
                                                               String menuUrl,
                                                               String actionScope,
                                                               HttpServletRequest request) {
        return ScreenBuilderAuthorityDecision.allow(actionScope, "", menuCode, menuUrl, "system", "ROLE_SYSTEM_MASTER");
    }

    default ScreenBuilderAuthorityDecision authorizeMenuBatch(List<String> menuCodes,
                                                              String menuUrl,
                                                              String actionScope,
                                                              HttpServletRequest request) {
        String menuCode = menuCodes == null || menuCodes.isEmpty() ? "" : String.valueOf(menuCodes.get(0));
        return ScreenBuilderAuthorityDecision.allow(actionScope, "", menuCode, menuUrl, "system", "ROLE_SYSTEM_MASTER");
    }

    default String resolveActorId(HttpServletRequest request) {
        return "system";
    }

    default String resolveActorRole(HttpServletRequest request) {
        return "ROLE_SYSTEM_MASTER";
    }

    default String resolveRequestIp(HttpServletRequest request) {
        return "";
    }
}
