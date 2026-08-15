package egovframework.com.feature.home.web;

import egovframework.com.feature.admin.web.AdminApprovalController;
import egovframework.com.feature.auth.dto.response.FrontendSessionResponseDTO;
import egovframework.com.feature.auth.service.FrontendSessionService;
import egovframework.com.feature.home.service.HomeMenuService;
import egovframework.com.feature.home.service.HomeMypageService;
import egovframework.com.platform.bootstrap.service.AdminShellBootstrapPageService;
import egovframework.com.platform.codex.service.AdminHotPathPagePayloadService;
import egovframework.com.platform.menu.service.AdminMenuTreeService;
import egovframework.com.platform.trade.service.TradeRefundListReadPort;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ReactAppBootstrapServiceShellTest {

    @Test
    void neutralAdminShellReturnsSessionAndMenuWithoutBuildingAdminHomeData() {
        FrontendSessionService sessions = mock(FrontendSessionService.class);
        AdminMenuTreeService menuTree = mock(AdminMenuTreeService.class);
        AdminShellBootstrapPageService pageData = mock(AdminShellBootstrapPageService.class);
        HttpServletRequest request = mock(HttpServletRequest.class);
        FrontendSessionResponseDTO session = new FrontendSessionResponseDTO();
        session.setAuthenticated(true);
        when(sessions.buildSession(request)).thenReturn(session);
        when(menuTree.buildAdminMenuTree(false, request)).thenReturn(Map.of());

        ReactAppBootstrapService service = new ReactAppBootstrapService(
                sessions,
                mock(HomeMenuService.class),
                mock(HomeMypageService.class),
                menuTree,
                pageData,
                mock(AdminHotPathPagePayloadService.class),
                mock(AdminApprovalController.class),
                mock(TradeRefundListReadPort.class));

        Map<String, Object> payload = service.buildBootstrapPayload(
                ReactBootstrapRequestAdapter.UNMAPPED_ADMIN_SHELL_ROUTE,
                false,
                true,
                request);

        assertSame(session, payload.get("frontendSession"));
        assertTrue(payload.containsKey("adminMenuTree"));
        assertFalse(payload.containsKey("adminHomePageData"));
        verify(menuTree).buildAdminMenuTree(false, request);
        verify(pageData, never()).buildAdminHomePageData(anyBoolean());
    }
}
