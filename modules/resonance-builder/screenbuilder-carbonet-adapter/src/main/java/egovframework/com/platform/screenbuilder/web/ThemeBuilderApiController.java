package egovframework.com.platform.screenbuilder.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.platform.screenbuilder.model.*;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping({
        "/api/platform/theme-builder",
        "/en/api/platform/theme-builder",
        "/admin/api/platform/theme-builder",
        "/en/admin/api/platform/theme-builder"
})
public class ThemeBuilderApiController {

    private final ObjectMapper objectMapper;

    public ThemeBuilderApiController(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @GetMapping("/themes")
    public ResponseEntity<List<ThemeVO>> getThemeList(
            @RequestParam(value = "ownerId", required = false) String ownerId) {
        List<ThemeVO> themes = new ArrayList<>();
        return ResponseEntity.ok(themes);
    }

    @GetMapping("/themes/{themeId}")
    public ResponseEntity<ThemeDetailVO> getTheme(@PathVariable String themeId) {
        return ResponseEntity.ok(new ThemeDetailVO());
    }

    @PostMapping("/themes")
    public ResponseEntity<ThemeDetailVO> createTheme(
            @RequestBody ThemeSaveRequestVO request,
            HttpServletRequest httpRequest) {
        ThemeDetailVO saved = new ThemeDetailVO();
        saved.setThemeId(UUID.randomUUID().toString());
        saved.setThemeName(request.getThemeName());
        saved.setOwnerId(request.getOwnerId() != null ? request.getOwnerId() : "webmaster");
        return ResponseEntity.status(HttpStatus.CREATED).body(saved);
    }

    @PutMapping("/themes/{themeId}")
    public ResponseEntity<ThemeDetailVO> updateTheme(
            @PathVariable String themeId,
            @RequestBody ThemeSaveRequestVO request) {
        request.setThemeId(themeId);
        ThemeDetailVO updated = new ThemeDetailVO();
        updated.setThemeId(themeId);
        updated.setThemeName(request.getThemeName());
        return ResponseEntity.ok(updated);
    }

    @DeleteMapping("/themes/{themeId}")
    public ResponseEntity<Void> deleteTheme(@PathVariable String themeId) {
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/themes/{themeId}/export")
    public ResponseEntity<ThemeExportVO> exportTheme(@PathVariable String themeId) {
        ThemeExportVO export = new ThemeExportVO();
        export.setThemeId(themeId);
        export.setExportedAt(new Date().toString());
        return ResponseEntity.ok(export);
    }

    @GetMapping("/components")
    public ResponseEntity<List<ThemeComponentVO>> getComponents(
            @RequestParam(value = "themeId", required = false) String themeId) {
        return ResponseEntity.ok(new ArrayList<>());
    }

    @GetMapping("/health")
    public ResponseEntity<Map<String, String>> health() {
        Map<String, String> status = new HashMap<>();
        status.put("status", "UP");
        return ResponseEntity.ok(status);
    }
}