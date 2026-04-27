package egovframework.com.platform.read;

import egovframework.com.platform.menu.dto.AdminMenuDomainDTO;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;

public interface AdminMenuTreeReadPort {

    Map<String, AdminMenuDomainDTO> buildAdminMenuTree(boolean isEn, HttpServletRequest request);

    Map<String, AdminMenuDomainDTO> buildAdminMenuTree(boolean isEn, String authorCode);
}
