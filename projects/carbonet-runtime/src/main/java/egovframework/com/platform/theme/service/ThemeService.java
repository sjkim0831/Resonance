package egovframework.com.platform.theme.service;

import egovframework.com.platform.theme.vo.ThemeVO;
import java.util.List;

public interface ThemeService {
    List<ThemeVO> selectThemeList(ThemeVO searchVO) throws Exception;
    ThemeVO selectThemeById(String id) throws Exception;
    void insertTheme(ThemeVO themeVO) throws Exception;
    void updateTheme(ThemeVO themeVO) throws Exception;
    void deleteTheme(String id) throws Exception;
}
