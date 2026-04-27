package egovframework.com.platform.codex.mapper;

import egovframework.com.common.mapper.support.BaseMapperSupport;
import egovframework.com.feature.admin.dto.request.AdminMenuFeatureCommandDTO;
import egovframework.com.platform.codex.model.MenuFeatureVO;
import org.springframework.stereotype.Component;

import java.util.List;

@Component("menuFeatureManageMapper")
public class MenuFeatureManageMapper extends BaseMapperSupport {

    public List<MenuFeatureVO> selectMenuPageOptions(AdminMenuFeatureCommandDTO params) {
        return selectList("MenuFeatureManageMapper.selectMenuPageOptions", params);
    }

    public List<MenuFeatureVO> selectMenuFeatureList(AdminMenuFeatureCommandDTO params) {
        return selectList("MenuFeatureManageMapper.selectMenuFeatureList", params);
    }

    public MenuFeatureVO selectMenuFeature(AdminMenuFeatureCommandDTO params) {
        return selectOne("MenuFeatureManageMapper.selectMenuFeature", params);
    }

    public int countFeaturesByMenuCode(AdminMenuFeatureCommandDTO params) {
        Integer count = selectOne("MenuFeatureManageMapper.countFeaturesByMenuCode", params);
        return count == null ? 0 : count;
    }

    public int countFeatureCode(AdminMenuFeatureCommandDTO params) {
        Integer count = selectOne("MenuFeatureManageMapper.countFeatureCode", params);
        return count == null ? 0 : count;
    }

    public void insertMenuFeature(AdminMenuFeatureCommandDTO params) {
        insert("MenuFeatureManageMapper.insertMenuFeature", params);
    }

    public void updateMenuFeatureMetadata(AdminMenuFeatureCommandDTO params) {
        update("MenuFeatureManageMapper.updateMenuFeatureMetadata", params);
    }

    public void deleteMenuFeature(String featureCode) {
        delete("MenuFeatureManageMapper.deleteMenuFeature", featureCode);
    }
}
