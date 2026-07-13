package egovframework.com.platform.menu.mapper;

import egovframework.com.platform.menu.dto.AdminCodeCommandDTO;
import egovframework.com.platform.menu.dto.MenuInfoDTO;

import java.util.List;
import java.util.Map;

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
    public void updateMenuExposure(String menuCode, String expsrAt) {
        update("MenuInfoMapper.updateMenuExposure", Map.of("menuCode", menuCode, "expsrAt", expsrAt));
    }
    public void updateMenuActivation(String menuCode, String useAt) {
        update("MenuInfoMapper.updateMenuActivation", Map.of("menuCode", menuCode, "useAt", useAt));
    }

    public int countMenuInfoByMenuCode(String menuCode) {
        Integer count = selectOne("MenuInfoMapper.countMenuInfoByMenuCode", menuCode);
        return count == null ? 0 : count;
    }

    public void updateDependentScreen(String menuCode, String dependentScreenCode) {
        update("MenuInfoMapper.updateDependentScreen", Map.of("menuCode", menuCode, "dependentScreenCode", dependentScreenCode));
    }

    public void insertMenuInfoForDependentScreen(String menuCode, String dependentScreenCode) {
        insert("MenuInfoMapper.insertMenuInfoForDependentScreen", Map.of("menuCode", menuCode, "dependentScreenCode", dependentScreenCode));
    }
}
