package egovframework.com.platform.menu.mapper;

import egovframework.com.platform.menu.dto.AdminCodeCommandDTO;
import egovframework.com.platform.menu.dto.MenuInfoDTO;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;

import egovframework.com.common.mapper.support.BaseMapperSupport;

@Component("menuInfoMapper")
public class MenuInfoMapper extends BaseMapperSupport {
    private static final Logger log = LoggerFactory.getLogger(MenuInfoMapper.class);

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

    public void insertMenuInfo(MenuInfoDTO menuInfo) {
        insert("MenuInfoMapper.insertMenuInfo", menuInfo);
    }

    public void insertCommonDetailCode(String codeId, String code, String codeNm, String codeDc, String useAt) {
        Map<String, String> params = new HashMap<>();
        params.put("codeId", codeId);
        params.put("code", code);
        params.put("codeNm", codeNm);
        params.put("codeDc", codeDc);
        params.put("useAt", useAt);
        insert("MenuInfoMapper.insertCommonDetailCode", params);
    }

    public void updateCommonDetailCode(String codeId, String code, String codeNm, String codeDc, String useAt) {
        Map<String, String> params = new HashMap<>();
        params.put("codeId", codeId);
        params.put("code", code);
        params.put("codeNm", codeNm);
        params.put("codeDc", codeDc);
        params.put("useAt", useAt);
        update("MenuInfoMapper.updateCommonDetailCode", params);
    }

    public void updateMenuExposure(String menuCode, String expsrAt) {
        Map<String, String> params = new HashMap<>();
        params.put("menuCode", menuCode);
        params.put("expsrAt", expsrAt);
        update("MenuInfoMapper.updateMenuExposure", params);
    }

    public void updateDependentScreenCode(String menuCode, String dependentScreenCode) {
        Map<String, String> params = new HashMap<>();
        params.put("menuCode", menuCode);
        params.put("dependentScreenCode", dependentScreenCode);
        int updated = update("MenuInfoMapper.updateDependentScreenCode", params);
        log.info("[MenuInfoMapper] updateDependentScreenCode: menuCode={}, dependentScreenCode={}, updated={}", menuCode, dependentScreenCode, updated);
        if (updated == 0) {
            int inserted = insert("MenuInfoMapper.insertDependentScreenCode", params);
            log.info("[MenuInfoMapper] insertDependentScreenCode: menuCode={}, inserted={}", menuCode, inserted);
            if (inserted == 0) {
                throw new RuntimeException("Failed to update or insert dependent screen code for menu: " + menuCode);
            }
        }
    }

    public void deleteMenu(String menuCode) {
        update("MenuInfoMapper.deleteMenu", menuCode);
    }

    public void deleteMenuOrder(String menuCode) {
        update("MenuInfoMapper.deleteMenuOrder", menuCode);
    }
}
