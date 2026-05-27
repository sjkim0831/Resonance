package egovframework.com.platform.screenmenuassignment.web;

import egovframework.com.platform.screenmenuassignment.service.ScreenMenuAssignmentService;
import egovframework.com.platform.screenmenuassignment.vo.ScreenMenuAssignmentVO;
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
@RequestMapping("/api/admin/system/screen-menu-assignment")
public class ScreenMenuAssignmentController {

    @Autowired
    private ScreenMenuAssignmentService screenMenuAssignmentService;

    @GetMapping("/list")
    @ResponseBody
    public Map<String, Object> listAssignments(@RequestParam(value = "source", defaultValue = "all") String source,
                                               @RequestParam(value = "keyword", defaultValue = "") String keyword) {
        Map<String, Object> result = new HashMap<>();
        try {
            ScreenMenuAssignmentVO searchVO = new ScreenMenuAssignmentVO();
            searchVO.setSource(source);
            searchVO.setKeyword(keyword);
            List<ScreenMenuAssignmentVO> assignments = screenMenuAssignmentService.selectAssignmentList(searchVO);
            result.put("success", true);
            result.put("data", assignments);
            result.put("total", assignments.size());
        } catch (Exception e) {
            result.put("success", false);
            result.put("error", e.getMessage());
        }
        return result;
    }

    @PostMapping("/save")
    @ResponseBody
    public Map<String, Object> saveAssignment(ScreenMenuAssignmentVO assignmentVO) {
        Map<String, Object> result = new HashMap<>();
        try {
            if (assignmentVO.getId() != null && !assignmentVO.getId().isEmpty()) {
                screenMenuAssignmentService.updateAssignment(assignmentVO);
            } else {
                screenMenuAssignmentService.insertAssignment(assignmentVO);
            }
            result.put("success", true);
            result.put("message", "Assignment saved successfully");
        } catch (Exception e) {
            result.put("success", false);
            result.put("error", e.getMessage());
        }
        return result;
    }

    @PostMapping("/delete")
    @ResponseBody
    public Map<String, Object> deleteAssignment(@RequestParam("id") String id) {
        Map<String, Object> result = new HashMap<>();
        try {
            screenMenuAssignmentService.deleteAssignment(id);
            result.put("success", true);
            result.put("message", "Assignment deleted successfully");
        } catch (Exception e) {
            result.put("success", false);
            result.put("error", e.getMessage());
        }
        return result;
    }
}
