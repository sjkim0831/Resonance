package egovframework.com.platform.screenbuilder.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.platform.screenbuilder.model.BuilderComponentVO;
import egovframework.com.platform.screenbuilder.model.ScreenBuilderNodeVO;
import egovframework.com.platform.screenbuilder.model.ScreenConfigVO;
import egovframework.com.platform.screenbuilder.model.ThemeVO;
import egovframework.com.platform.screenbuilder.service.BuilderComponentService;
import egovframework.com.platform.screenbuilder.service.BuilderScreenService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequiredArgsConstructor
@RequestMapping({
        "/api/platform/builder",
        "/en/api/platform/builder",
        "/admin/api/platform/builder",
        "/en/admin/api/platform/builder"
})
public class BuilderApiController {

    private final BuilderComponentService builderComponentService;
    private final BuilderScreenService builderScreenService;
    private final ObjectMapper objectMapper;

    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> health() {
        return ResponseEntity.ok(orderedMap(
                "status", "ok",
                "timestamp", System.currentTimeMillis()
        ));
    }

    @GetMapping("/components")
    public ResponseEntity<Map<String, Object>> getComponents(
            @RequestParam(value = "type", required = false) String type,
            @RequestParam(value = "category", required = false) String category,
            @RequestParam(value = "activeOnly", required = false) Boolean activeOnly) {
        boolean active = activeOnly != null ? activeOnly : true;
        List<BuilderComponentVO> components;
        if (type != null && !type.isEmpty()) {
            components = builderComponentService.getComponentsByType(type);
        } else if (category != null && !category.isEmpty()) {
            components = builderComponentService.getComponentsByCategory(category);
        } else if (active) {
            components = builderComponentService.getActiveComponents();
        } else {
            components = builderComponentService.getAllComponents();
        }
        return ok(orderedMap(
                "components", components,
                "count", components.size()
        ));
    }

    @GetMapping("/components/{componentId}")
    public ResponseEntity<Map<String, Object>> getComponent(@PathVariable String componentId) {
        try {
            BuilderComponentVO component = builderComponentService.getComponent(componentId);
            return ok(orderedMap("component", component));
        } catch (IllegalArgumentException e) {
            return notFound(e.getMessage());
        }
    }

    @PostMapping("/components")
    public ResponseEntity<Map<String, Object>> createComponent(@RequestBody BuilderComponentVO component) {
        BuilderComponentVO created = builderComponentService.createComponent(component);
        return ResponseEntity.status(HttpStatus.CREATED).body(orderedMap(
                "component", created,
                "message", "Component created successfully"
        ));
    }

    @PutMapping("/components/{componentId}")
    public ResponseEntity<Map<String, Object>> updateComponent(
            @PathVariable String componentId,
            @RequestBody BuilderComponentVO component) {
        try {
            BuilderComponentVO updated = builderComponentService.updateComponent(componentId, component);
            return ok(orderedMap(
                    "component", updated,
                    "message", "Component updated successfully"
            ));
        } catch (IllegalArgumentException e) {
            return notFound(e.getMessage());
        }
    }

    @DeleteMapping("/components/{componentId}")
    public ResponseEntity<Map<String, Object>> deleteComponent(@PathVariable String componentId) {
        try {
            builderComponentService.deleteComponent(componentId);
            return ok(orderedMap("message", "Component deleted successfully"));
        } catch (IllegalArgumentException e) {
            return notFound(e.getMessage());
        }
    }

    @GetMapping("/screens")
    public ResponseEntity<Map<String, Object>> getScreens(
            @RequestParam(value = "status", required = false) String status) {
        List<ScreenConfigVO> screens;
        if (status != null && !status.isEmpty()) {
            screens = builderScreenService.getScreensByStatus(status);
        } else {
            screens = builderScreenService.getAllScreens();
        }
        return ok(orderedMap(
                "screens", screens,
                "count", screens.size()
        ));
    }

    @GetMapping("/screens/{screenId}")
    public ResponseEntity<Map<String, Object>> getScreen(@PathVariable String screenId) {
        try {
            ScreenConfigVO screen = builderScreenService.getScreen(screenId);
            return ok(orderedMap("screen", screen));
        } catch (IllegalArgumentException e) {
            return notFound(e.getMessage());
        }
    }

    @GetMapping("/screens/by-menu/{menuCode}")
    public ResponseEntity<Map<String, Object>> getScreenByMenuCode(@PathVariable String menuCode) {
        ScreenConfigVO screen = builderScreenService.getScreenByMenuCode(menuCode);
        if (screen == null) {
            return notFound("Screen not found for menuCode: " + menuCode);
        }
        return ok(orderedMap("screen", screen));
    }

    @PostMapping("/screens")
    public ResponseEntity<Map<String, Object>> createScreen(@RequestBody ScreenConfigVO config) {
        ScreenConfigVO created = builderScreenService.createScreen(config);
        return ResponseEntity.status(HttpStatus.CREATED).body(orderedMap(
                "screen", created,
                "message", "Screen created successfully"
        ));
    }

    @PutMapping("/screens/{screenId}")
    public ResponseEntity<Map<String, Object>> updateScreen(
            @PathVariable String screenId,
            @RequestBody ScreenConfigVO config) {
        try {
            ScreenConfigVO updated = builderScreenService.updateScreen(screenId, config);
            return ok(orderedMap(
                    "screen", updated,
                    "message", "Screen updated successfully"
            ));
        } catch (IllegalArgumentException e) {
            return notFound(e.getMessage());
        }
    }

    @DeleteMapping("/screens/{screenId}")
    public ResponseEntity<Map<String, Object>> deleteScreen(@PathVariable String screenId) {
        try {
            builderScreenService.deleteScreen(screenId);
            return ok(orderedMap("message", "Screen deleted successfully"));
        } catch (IllegalArgumentException e) {
            return notFound(e.getMessage());
        }
    }

    @PostMapping("/screens/{screenId}/publish")
    public ResponseEntity<Map<String, Object>> publishScreen(@PathVariable String screenId) {
        try {
            ScreenConfigVO published = builderScreenService.publishScreen(screenId);
            return ok(orderedMap(
                    "screen", published,
                    "message", "Screen published successfully"
            ));
        } catch (IllegalArgumentException e) {
            return notFound(e.getMessage());
        }
    }

    @PostMapping("/screens/{screenId}/duplicate")
    public ResponseEntity<Map<String, Object>> duplicateScreen(
            @PathVariable String screenId,
            @RequestParam("newMenuCode") String newMenuCode,
            @RequestParam("newMenuTitle") String newMenuTitle) {
        try {
            ScreenConfigVO duplicated = builderScreenService.duplicateScreen(screenId, newMenuCode, newMenuTitle);
            return ResponseEntity.status(HttpStatus.CREATED).body(orderedMap(
                    "screen", duplicated,
                    "message", "Screen duplicated successfully"
            ));
        } catch (IllegalArgumentException e) {
            return notFound(e.getMessage());
        }
    }

    @GetMapping("/screens/{screenId}/nodes")
    public ResponseEntity<Map<String, Object>> getScreenNodes(@PathVariable String screenId) {
        try {
            List<ScreenBuilderNodeVO> nodes = builderScreenService.getNodes(screenId);
            return ok(orderedMap(
                    "nodes", nodes,
                    "count", nodes.size()
            ));
        } catch (IllegalArgumentException e) {
            return notFound(e.getMessage());
        }
    }

    @PostMapping("/screens/{screenId}/nodes")
    public ResponseEntity<Map<String, Object>> addNode(
            @PathVariable String screenId,
            @RequestBody ScreenBuilderNodeVO node) {
        try {
            ScreenBuilderNodeVO created = builderScreenService.addNodeToScreen(screenId, node);
            return ResponseEntity.status(HttpStatus.CREATED).body(orderedMap(
                    "node", created,
                    "message", "Node added successfully"
            ));
        } catch (IllegalArgumentException e) {
            return notFound(e.getMessage());
        }
    }

    @PutMapping("/screens/{screenId}/nodes/{nodeId}")
    public ResponseEntity<Map<String, Object>> updateNode(
            @PathVariable String screenId,
            @PathVariable String nodeId,
            @RequestBody ScreenBuilderNodeVO node) {
        try {
            ScreenBuilderNodeVO updated = builderScreenService.updateNode(screenId, nodeId, node);
            return ok(orderedMap(
                    "node", updated,
                    "message", "Node updated successfully"
            ));
        } catch (IllegalArgumentException e) {
            return notFound(e.getMessage());
        }
    }

    @DeleteMapping("/screens/{screenId}/nodes/{nodeId}")
    public ResponseEntity<Map<String, Object>> removeNode(
            @PathVariable String screenId,
            @PathVariable String nodeId) {
        try {
            builderScreenService.removeNode(screenId, nodeId);
            return ok(orderedMap("message", "Node removed successfully"));
        } catch (IllegalArgumentException e) {
            return notFound(e.getMessage());
        }
    }

    @GetMapping("/screens/{screenId}/preview")
    public ResponseEntity<Map<String, Object>> getScreenPreview(@PathVariable String screenId) {
        try {
            String html = builderScreenService.getPreviewHtml(screenId);
            return ok(orderedMap(
                    "previewHtml", html,
                    "screenId", screenId
            ));
        } catch (IllegalArgumentException e) {
            return notFound(e.getMessage());
        }
    }

    @GetMapping("/themes")
    public ResponseEntity<Map<String, Object>> getThemes() {
        List<ThemeVO> themes = new ArrayList<>();
        ThemeVO light = new ThemeVO();
        light.setThemeId("THEME001");
        light.setThemeName("Default Light");
        light.setDescription("기본 라이트 테마");
        light.setIsDefault(true);
        themes.add(light);

        ThemeVO dark = new ThemeVO();
        dark.setThemeId("THEME002");
        dark.setThemeName("Default Dark");
        dark.setDescription("기본 다크 테마");
        dark.setIsDefault(false);
        themes.add(dark);

        ThemeVO dashboard = new ThemeVO();
        dashboard.setThemeId("THEME003");
        dashboard.setThemeName("Dashboard");
        dashboard.setDescription("대시보드용 다크 테마");
        dashboard.setIsDefault(false);
        themes.add(dashboard);

        return ok(orderedMap(
                "themes", themes,
                "count", themes.size()
        ));
    }

    @GetMapping("/component-types")
    public ResponseEntity<Map<String, Object>> getComponentTypes() {
        return ok(orderedMap(
                "types", List.of(
                        orderedMap("code", BuilderComponentVO.TYPE_BUTTON, "label", "Button"),
                        orderedMap("code", BuilderComponentVO.TYPE_CARD, "label", "Card"),
                        orderedMap("code", BuilderComponentVO.TYPE_INPUT, "label", "Input"),
                        orderedMap("code", BuilderComponentVO.TYPE_TABLE, "label", "Table"),
                        orderedMap("code", BuilderComponentVO.TYPE_FORM, "label", "Form"),
                        orderedMap("code", BuilderComponentVO.TYPE_SECTION, "label", "Section"),
                        orderedMap("code", BuilderComponentVO.TYPE_LAYOUT, "label", "Layout"),
                        orderedMap("code", BuilderComponentVO.TYPE_CHART, "label", "Chart"),
                        orderedMap("code", BuilderComponentVO.TYPE_MEDIA, "label", "Media"),
                        orderedMap("code", BuilderComponentVO.TYPE_OTHER, "label", "Other")
                )
        ));
    }

    @GetMapping("/categories")
    public ResponseEntity<Map<String, Object>> getCategories() {
        return ok(orderedMap(
                "categories", List.of(
                        orderedMap("code", BuilderComponentVO.CATEGORY_LAYOUT, "label", "Layout"),
                        orderedMap("code", BuilderComponentVO.CATEGORY_FORM, "label", "Form"),
                        orderedMap("code", BuilderComponentVO.CATEGORY_DISPLAY, "label", "Display"),
                        orderedMap("code", BuilderComponentVO.CATEGORY_DATA, "label", "Data"),
                        orderedMap("code", BuilderComponentVO.CATEGORY_NAVIGATION, "label", "Navigation"),
                        orderedMap("code", BuilderComponentVO.CATEGORY_FEEDBACK, "label", "Feedback")
                )
        ));
    }

    private Map<String, Object> orderedMap(Object... fields) {
        Map<String, Object> values = new LinkedHashMap<>();
        if (fields == null) {
            return values;
        }
        for (int index = 0; index + 1 < fields.length; index += 2) {
            values.put(String.valueOf(fields[index]), fields[index + 1]);
        }
        return values;
    }

    private ResponseEntity<Map<String, Object>> ok(Map<String, Object> body) {
        return ResponseEntity.ok(body);
    }

    private ResponseEntity<Map<String, Object>> notFound(String message) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(orderedMap(
                "error", true,
                "message", message
        ));
    }
}