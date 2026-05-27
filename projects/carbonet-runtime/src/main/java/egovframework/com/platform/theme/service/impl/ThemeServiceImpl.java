package egovframework.com.platform.theme.service.impl;

import egovframework.com.platform.theme.service.ThemeService;
import egovframework.com.platform.theme.dao.ThemeDao;
import egovframework.com.platform.theme.vo.ThemeVO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ThemeServiceImpl implements ThemeService {

    @Autowired
    private ThemeDao themeDao;

    @Override
    public List<ThemeVO> selectThemeList(ThemeVO searchVO) throws Exception {
        return themeDao.selectThemeList(searchVO);
    }

    @Override
    public ThemeVO selectThemeById(String id) throws Exception {
        return themeDao.selectThemeById(id);
    }

    @Override
    public void insertTheme(ThemeVO themeVO) throws Exception {
        themeDao.insertTheme(themeVO);
    }

    @Override
    public void updateTheme(ThemeVO themeVO) throws Exception {
        themeDao.updateTheme(themeVO);
    }

    @Override
    public void deleteTheme(String id) throws Exception {
        themeDao.deleteTheme(id);
    }
}
