package egovframework.com.platform.codex.service.impl;

import egovframework.com.feature.admin.dto.request.AdminMenuFeatureCommandDTO;
import egovframework.com.platform.codex.mapper.MenuFeatureManageMapper;
import egovframework.com.platform.codex.model.MenuFeatureVO;
import egovframework.com.platform.codex.service.MenuFeatureManageService;
import org.egovframe.rte.fdl.cmmn.EgovAbstractServiceImpl;
import org.springframework.stereotype.Service;

import java.util.List;

@Service("menuFeatureManageService")
public class MenuFeatureManageServiceImpl extends EgovAbstractServiceImpl implements MenuFeatureManageService {

    private final MenuFeatureManageMapper menuFeatureManageMapper;

    public MenuFeatureManageServiceImpl(MenuFeatureManageMapper menuFeatureManageMapper) {
        this.menuFeatureManageMapper = menuFeatureManageMapper;
    }

    @Override
    public List<MenuFeatureVO> selectMenuPageOptions(String codeId) {
        AdminMenuFeatureCommandDTO params = new AdminMenuFeatureCommandDTO();
        params.setCodeId(codeId);
        return menuFeatureManageMapper.selectMenuPageOptions(params);
    }

    @Override
    public List<MenuFeatureVO> selectMenuFeatureList(String codeId, String menuCode, String searchKeyword) {
        AdminMenuFeatureCommandDTO params = new AdminMenuFeatureCommandDTO();
        params.setCodeId(codeId);
        params.setMenuCode(menuCode);
        params.setSearchKeyword(searchKeyword);
        return menuFeatureManageMapper.selectMenuFeatureList(params);
    }

    @Override
    public MenuFeatureVO selectMenuFeature(String featureCode) {
        AdminMenuFeatureCommandDTO params = new AdminMenuFeatureCommandDTO();
        params.setFeatureCode(featureCode);
        return menuFeatureManageMapper.selectMenuFeature(params);
    }

    @Override
    public int countFeaturesByMenuCode(String menuCode) {
        AdminMenuFeatureCommandDTO params = new AdminMenuFeatureCommandDTO();
        params.setMenuCode(menuCode);
        return menuFeatureManageMapper.countFeaturesByMenuCode(params);
    }

    @Override
    public int countFeatureCode(String featureCode) {
        AdminMenuFeatureCommandDTO params = new AdminMenuFeatureCommandDTO();
        params.setFeatureCode(featureCode);
        return menuFeatureManageMapper.countFeatureCode(params);
    }

    @Override
    public void insertMenuFeature(String menuCode, String featureCode, String featureNm, String featureNmEn, String featureDc, String useAt) {
        AdminMenuFeatureCommandDTO params = new AdminMenuFeatureCommandDTO();
        params.setMenuCode(menuCode);
        params.setFeatureCode(featureCode);
        params.setFeatureNm(featureNm);
        params.setFeatureNmEn(featureNmEn);
        params.setFeatureDc(featureDc);
        params.setUseAt(useAt);
        menuFeatureManageMapper.insertMenuFeature(params);
    }

    @Override
    public void updateMenuFeatureMetadata(String featureCode, String featureNm, String featureNmEn, String featureDc, String useAt) {
        AdminMenuFeatureCommandDTO params = new AdminMenuFeatureCommandDTO();
        params.setFeatureCode(featureCode);
        params.setFeatureNm(featureNm);
        params.setFeatureNmEn(featureNmEn);
        params.setFeatureDc(featureDc);
        params.setUseAt(useAt);
        menuFeatureManageMapper.updateMenuFeatureMetadata(params);
    }

    @Override
    public void deleteMenuFeature(String featureCode) {
        menuFeatureManageMapper.deleteMenuFeature(featureCode);
    }
}
