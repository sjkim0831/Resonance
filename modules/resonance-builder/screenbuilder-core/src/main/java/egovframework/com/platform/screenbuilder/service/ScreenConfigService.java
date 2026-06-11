package egovframework.com.platform.screenbuilder.service;

import egovframework.com.platform.screenbuilder.model.ScreenConfigVO;

import java.util.List;
import java.util.Optional;

public interface ScreenConfigService {

    ScreenConfigVO createOrUpdateConfig(ScreenConfigVO config);

    Optional<ScreenConfigVO> getConfigByMenuCode(String menuCode);

    Optional<ScreenConfigVO> getConfigByScreenId(String screenId);

    List<ScreenConfigVO> getAllConfigs();

    List<ScreenConfigVO> getConfigsByStatus(String status);

    boolean deleteConfig(String screenId);

    ScreenConfigVO publishConfig(String screenId);

    ScreenConfigVO duplicateConfig(String sourceScreenId, String newMenuCode, String newMenuTitle);

    List<String> getAvailableThemes();

    boolean configExists(String menuCode);
}