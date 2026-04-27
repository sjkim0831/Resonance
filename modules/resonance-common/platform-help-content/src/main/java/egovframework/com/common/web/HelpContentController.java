package egovframework.com.common.web;

import egovframework.com.common.help.HelpContentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;

import java.util.LinkedHashMap;
import java.util.Map;

@Controller
@RequiredArgsConstructor
public class HelpContentController {

    private final HelpContentService helpContentService;

    @GetMapping({"/api/help/page", "/api/en/help/page"})
    @ResponseBody
    public ResponseEntity<Map<String, Object>> pageHelp(
            @RequestParam(value = "pageId", required = false) String pageId) {
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("pageId", pageId == null ? "" : pageId.trim());
        response.putAll(helpContentService.getPageHelp(pageId));
        return ResponseEntity.ok(response);
    }
}
