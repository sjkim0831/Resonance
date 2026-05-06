package egovframework.com.feature.admin.service;

import egovframework.com.platform.menu.dto.AdminMenuDomainDTO;
import egovframework.com.platform.menu.dto.AdminMenuGroupDTO;
import egovframework.com.platform.menu.dto.AdminMenuLinkDTO;
import egovframework.com.platform.menu.dto.MenuInfoDTO;
import egovframework.com.platform.menu.service.MenuInfoService;
import egovframework.com.platform.menu.service.AdminMenuTreeService;
import egovframework.com.feature.auth.service.CurrentUserContextService;
import egovframework.com.platform.codex.service.AuthGroupManageService;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class AdminMenuTreeServiceTest {

    @Test
    void menuManagementKeepsSystemAndLegacyContentMenusWhenBothExist() throws Exception {
        MenuInfoService menuInfoService = mock(MenuInfoService.class);
        AuthGroupManageService authGroupManageService = mock(AuthGroupManageService.class);
        CurrentUserContextService currentUserContextService = mock(CurrentUserContextService.class);
        when(menuInfoService.selectMenuTreeList("AMENU1")).thenReturn(List.of(
                menu("A004", "콘텐츠", "Content", "#", "folder", 4),
                menu("A00403", "운영", "Operations", "#", "folder", 4),
                menu("A0040304", "메뉴 관리", "Menu Management", "/admin/content/menu", "account_tree", 1),
                menu("A006", "시스템", "System", "#", "folder", 6),
                menu("A00601", "환경", "Environment", "#", "folder_open", 1),
                menu("A0060107", "메뉴 관리", "Menu Management", "/admin/system/menu", "account_tree", 1)
        ));

        AdminMenuTreeService service = new AdminMenuTreeService(menuInfoService, authGroupManageService, currentUserContextService);

        Map<String, AdminMenuDomainDTO> tree = service.buildAdminMenuTree(false, "ROLE_SYSTEM_MASTER");

        AdminMenuDomainDTO systemDomain = tree.get("시스템");
        assertNotNull(systemDomain);
        assertEquals(1, systemDomain.getGroups().size());
        AdminMenuGroupDTO environmentGroup = systemDomain.getGroups().get(0);
        assertEquals("환경", environmentGroup.getTitle());
        assertEquals(1, environmentGroup.getLinks().size());
        AdminMenuLinkDTO menuManagement = environmentGroup.getLinks().get(0);
        assertEquals("메뉴 관리", menuManagement.getText());
        assertEquals("/admin/system/menu", menuManagement.getU());

        AdminMenuDomainDTO contentDomain = tree.get("콘텐츠");
        assertNotNull(contentDomain);
        assertEquals(1, contentDomain.getGroups().size());
        AdminMenuGroupDTO contentGroup = contentDomain.getGroups().get(0);
        assertEquals("운영", contentGroup.getTitle());
        assertEquals(1, contentGroup.getLinks().size());
        AdminMenuLinkDTO legacyMenuManagement = contentGroup.getLinks().get(0);
        assertEquals("메뉴 관리", legacyMenuManagement.getText());
        assertEquals("/admin/content/menu", legacyMenuManagement.getU());
    }

    private static MenuInfoDTO menu(String code, String codeNm, String codeDc, String menuUrl, String menuIcon, int sortOrdr) {
        MenuInfoDTO dto = new MenuInfoDTO();
        dto.setCode(code);
        dto.setCodeNm(codeNm);
        dto.setCodeDc(codeDc);
        dto.setMenuUrl(menuUrl);
        dto.setMenuIcon(menuIcon);
        dto.setUseAt("Y");
        dto.setSortOrdr(sortOrdr);
        return dto;
    }
}
