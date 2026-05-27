package egovframework.com.platform.theme.web;

import egovframework.com.platform.theme.service.ThemeService;
import egovframework.com.platform.theme.vo.ThemeVO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Controller
@RequestMapping("/api/admin/system/theme")
public class ThemeController {

    @Autowired
    private ThemeService themeService;

    @GetMapping("/list")
    @ResponseBody
    public Map<String, Object> listThemes(@RequestParam(value = "source", defaultValue = "all") String source,
                                          @RequestParam(value = "keyword", defaultValue = "") String keyword) {
        Map<String, Object> result = new HashMap<>();
        try {
            ThemeVO searchVO = new ThemeVO();
            searchVO.setSource(source);
            searchVO.setKeyword(keyword);
            List<ThemeVO> themes = themeService.selectThemeList(searchVO);
            result.put("success", true);
            result.put("data", themes);
            result.put("total", themes.size());
        } catch (Exception e) {
            result.put("success", false);
            result.put("error", e.getMessage());
        }
        return result;
    }

    @PostMapping("/save")
    @ResponseBody
    public Map<String, Object> saveTheme(ThemeVO themeVO) {
        Map<String, Object> result = new HashMap<>();
        try {
            if (themeVO.getId() != null && !themeVO.getId().isEmpty()) {
                themeService.updateTheme(themeVO);
            } else {
                themeService.insertTheme(themeVO);
            }
            result.put("success", true);
            result.put("message", "Theme saved successfully");
        } catch (Exception e) {
            result.put("success", false);
            result.put("error", e.getMessage());
        }
        return result;
    }

    @PostMapping("/delete")
    @ResponseBody
    public Map<String, Object> deleteTheme(@RequestParam("id") String id) {
        Map<String, Object> result = new HashMap<>();
        try {
            themeService.deleteTheme(id);
            result.put("success", true);
            result.put("message", "Theme deleted successfully");
        } catch (Exception e) {
            result.put("success", false);
            result.put("error", e.getMessage());
        }
        return result;
    }
}
