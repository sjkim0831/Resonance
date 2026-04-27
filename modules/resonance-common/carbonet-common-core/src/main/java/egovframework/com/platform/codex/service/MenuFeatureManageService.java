package egovframework.com.platform.codex.service;

import egovframework.com.platform.codex.model.MenuFeatureVO;

import java.util.List;

public interface MenuFeatureManageService {

    List<MenuFeatureVO> selectMenuPageOptions(String codeId) throws Exception;

    List<MenuFeatureVO> selectMenuFeatureList(String codeId, String menuCode, String searchKeyword) throws Exception;

    MenuFeatureVO selectMenuFeature(String featureCode) throws Exception;

    int countFeaturesByMenuCode(String menuCode) throws Exception;

    int countFeatureCode(String featureCode) throws Exception;

    void insertMenuFeature(String menuCode, String featureCode, String featureNm, String featureNmEn, String featureDc, String useAt) throws Exception;

    void updateMenuFeatureMetadata(String featureCode, String featureNm, String featureNmEn, String featureDc, String useAt) throws Exception;

    void deleteMenuFeature(String featureCode) throws Exception;
}
