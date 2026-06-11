package egovframework.com.platform.screenbuilder.repository;

import egovframework.com.platform.screenbuilder.model.BuilderThemeVO;
import java.util.List;
import java.util.Optional;

public interface ThemeRepository {

    BuilderThemeVO save(BuilderThemeVO theme);

    Optional<BuilderThemeVO> findById(String themeId);

    List<BuilderThemeVO> findAll();

    List<BuilderThemeVO> findByThemeType(String themeType);

    List<BuilderThemeVO> findByIsActive(Boolean isActive);

    Optional<BuilderThemeVO> findDefaultTheme();

    boolean existsById(String themeId);

    void deleteById(String themeId);

    int count();
}