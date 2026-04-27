package egovframework.com.platform.menu.mapper;

import egovframework.com.platform.menu.dto.AdminCodeCommandDTO;
import egovframework.com.platform.menu.dto.MenuInfoDTO;

import java.util.List;

import org.springframework.stereotype.Component;

import egovframework.com.common.mapper.support.BaseMapperSupport;

@Component("menuInfoMapper")
public class MenuInfoMapper extends BaseMapperSupport {

    public List<MenuInfoDTO> selectMenuUrlListByPrefix(String prefix) {
        return selectList("MenuInfoMapper.selectMenuUrlListByPrefix", prefix);
    }

    public List<MenuInfoDTO> selectAdminMenuDetailList(String codeId) {
        return selectList("MenuInfoMapper.selectAdminMenuDetailList", codeId);
    }

    public List<MenuInfoDTO> selectMenuTreeList(String codeId) {
        return selectList("MenuInfoMapper.selectMenuTreeList", codeId);
    }

    public MenuInfoDTO selectMenuDetailByUrl(String menuUrl) {
        return selectOne("MenuInfoMapper.selectMenuDetailByUrl", menuUrl);
    }

    public int countMenuInfoByCode(String menuCode) {
        Integer count = selectOne("MenuInfoMapper.countMenuInfoByCode", menuCode);
        return count == null ? 0 : count;
    }

    public int countMenuOrder(String menuCode) {
        Integer count = selectOne("MenuInfoMapper.countMenuOrder", menuCode);
        return count == null ? 0 : count;
    }

    public void insertMenuOrder(String menuCode, int sortOrdr) {
        AdminCodeCommandDTO params = new AdminCodeCommandDTO();
        params.setCode(menuCode);
        params.setSortOrdr(sortOrdr);
        insert("MenuInfoMapper.insertMenuOrder", params);
    }

    public void updateMenuOrder(String menuCode, int sortOrdr) {
        AdminCodeCommandDTO params = new AdminCodeCommandDTO();
        params.setCode(menuCode);
        params.setSortOrdr(sortOrdr);
        update("MenuInfoMapper.updateMenuOrder", params);
    }
}
