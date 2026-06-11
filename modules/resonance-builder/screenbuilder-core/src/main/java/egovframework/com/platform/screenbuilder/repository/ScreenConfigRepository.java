package egovframework.com.platform.screenbuilder.repository;

import egovframework.com.platform.screenbuilder.model.ScreenConfigVO;
import java.util.List;
import java.util.Optional;

public interface ScreenConfigRepository {

    ScreenConfigVO save(ScreenConfigVO config);

    Optional<ScreenConfigVO> findById(String screenId);

    Optional<ScreenConfigVO> findByMenuCode(String menuCode);

    List<ScreenConfigVO> findAll();

    List<ScreenConfigVO> findByStatus(String status);

    List<ScreenConfigVO> findByTemplateType(String templateType);

    List<ScreenConfigVO> findByThemeId(String themeId);

    boolean existsById(String screenId);

    boolean existsByMenuCode(String menuCode);

    void deleteById(String screenId);

    int count();
}