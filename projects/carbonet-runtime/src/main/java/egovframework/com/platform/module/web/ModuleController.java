package egovframework.com.platform.module.web;

import egovframework.com.platform.module.service.ModuleService;
import egovframework.com.platform.module.vo.ModuleVO;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Controller
@RequestMapping("/api/admin/system/module")
public class ModuleController {

    @Autowired
    private ModuleService moduleService;

    @GetMapping("/list")
    @ResponseBody
    public Map<String, Object> listModules(@RequestParam(value = "source", defaultValue = "all") String source,
                                           @RequestParam(value = "keyword", defaultValue = "") String keyword) {
        Map<String, Object> result = new HashMap<>();
        try {
            ModuleVO searchVO = new ModuleVO();
            searchVO.setSource(source);
            searchVO.setKeyword(keyword);
            List<ModuleVO> modules = moduleService.selectModuleList(searchVO);
            result.put("success", true);
            result.put("data", modules);
            result.put("total", modules.size());
        } catch (Exception e) {
            result.put("success", false);
            result.put("error", e.getMessage());
        }
        return result;
    }

    @PostMapping("/save")
    @ResponseBody
    public Map<String, Object> saveModule(ModuleVO moduleVO) {
        Map<String, Object> result = new HashMap<>();
        try {
            if (moduleVO.getId() != null && !moduleVO.getId().isEmpty()) {
                moduleService.updateModule(moduleVO);
            } else {
                moduleService.insertModule(moduleVO);
            }
            result.put("success", true);
            result.put("message", "Module saved successfully");
        } catch (Exception e) {
            result.put("success", false);
            result.put("error", e.getMessage());
        }
        return result;
    }

    @PostMapping("/delete")
    @ResponseBody
    public Map<String, Object> deleteModule(@RequestParam("id") String id) {
        Map<String, Object> result = new HashMap<>();
        try {
            moduleService.deleteModule(id);
            result.put("success", true);
            result.put("message", "Module deleted successfully");
        } catch (Exception e) {
            result.put("success", false);
            result.put("error", e.getMessage());
        }
        return result;
    }
}
