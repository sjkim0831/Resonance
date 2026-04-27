package egovframework.com.platform.read;

import egovframework.com.platform.menu.dto.MenuInfoDTO;

import java.util.List;

public interface MenuInfoReadPort {

    List<MenuInfoDTO> selectMenuUrlListByPrefix(String prefix) throws Exception;

    List<MenuInfoDTO> selectAdminMenuDetailList(String codeId) throws Exception;

    List<MenuInfoDTO> selectMenuTreeList(String codeId) throws Exception;

    MenuInfoDTO selectMenuDetailByUrl(String menuUrl) throws Exception;

    long getMenuTreeVersion();
}
