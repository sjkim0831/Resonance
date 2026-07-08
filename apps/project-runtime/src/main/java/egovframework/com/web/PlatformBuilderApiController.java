package egovframework.com.web;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;

@RestController
@RequestMapping("/api/platform/builder")
public class PlatformBuilderApiController {

    private final ObjectMapper objectMapper;
    private final Path storeFile;

    public PlatformBuilderApiController(
            ObjectMapper objectMapper,
            @Value("${CARBONET_BACKEND_METADATA_FS_OVERRIDE_PATH:/app/backend-metadata}") String backendMetadataRoot) {
        this.objectMapper = objectMapper;
        this.storeFile = Path.of(backendMetadataRoot).normalize().resolve("builder/platform-builder-store.json").normalize();
    }

    @GetMapping("/health")
    public Map<String, Object> health() {
        return Map.of("status", "UP", "timestamp", System.currentTimeMillis());
    }

    @GetMapping("/components")
    public Map<String, Object> components(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String category,
            @RequestParam(defaultValue = "false") boolean activeOnly) throws IOException {
        List<Map<String, Object>> rows = list("components");
        rows = rows.stream()
                .filter(row -> blank(type) || type.equals(string(row, "componentType")))
                .filter(row -> blank(category) || category.equals(string(row, "categoryCd")))
                .filter(row -> !activeOnly || !"N".equalsIgnoreCase(string(row, "useAt")))
                .sorted(Comparator.comparingInt(row -> intValue(row.get("sortOrder"))))
                .toList();
        return Map.of("components", rows, "count", rows.size());
    }

    @GetMapping("/components/{componentId}")
    public ResponseEntity<?> component(@PathVariable String componentId) throws IOException {
        return find("components", "componentId", componentId)
                .<ResponseEntity<?>>map(row -> ResponseEntity.ok(Map.of("component", row)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping("/components")
    public Map<String, Object> createComponent(@RequestBody Map<String, Object> payload) throws IOException {
        Map<String, Object> component = normalizeComponent(payload, null);
        Store store = load();
        replaceOrAdd(store.components, "componentId", string(component, "componentId"), component);
        save(store);
        return Map.of("component", component);
    }

    @PutMapping("/components/{componentId}")
    public Map<String, Object> updateComponent(@PathVariable String componentId, @RequestBody Map<String, Object> payload) throws IOException {
        Map<String, Object> current = find("components", "componentId", componentId).orElseGet(LinkedHashMap::new);
        current.putAll(payload);
        Map<String, Object> component = normalizeComponent(current, componentId);
        Store store = load();
        replaceOrAdd(store.components, "componentId", componentId, component);
        save(store);
        return Map.of("component", component);
    }

    @DeleteMapping("/components/{componentId}")
    public Map<String, Object> deleteComponent(@PathVariable String componentId) throws IOException {
        Store store = load();
        store.components.removeIf(row -> componentId.equals(string(row, "componentId")));
        save(store);
        return Map.of("message", "deleted", "componentId", componentId);
    }

    @GetMapping("/screens")
    public Map<String, Object> screens(@RequestParam(required = false) String status) throws IOException {
        List<Map<String, Object>> rows = list("screens").stream()
                .filter(row -> blank(status) || status.equals(string(row, "status")))
                .sorted(Comparator.comparing(row -> string(row, "updatedAt"), Comparator.reverseOrder()))
                .toList();
        return Map.of("screens", rows, "count", rows.size());
    }

    @GetMapping("/screens/by-menu/{menuCode}")
    public ResponseEntity<?> screenByMenuCode(@PathVariable String menuCode) throws IOException {
        return find("screens", "menuCode", menuCode)
                .<ResponseEntity<?>>map(row -> ResponseEntity.ok(Map.of("screen", row)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @GetMapping("/screens/{screenId}")
    public ResponseEntity<?> screen(@PathVariable String screenId) throws IOException {
        return find("screens", "screenId", screenId)
                .<ResponseEntity<?>>map(row -> ResponseEntity.ok(Map.of("screen", row)))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping("/screens")
    public Map<String, Object> createScreen(@RequestBody Map<String, Object> payload) throws IOException {
        Map<String, Object> screen = normalizeScreen(payload, null);
        Store store = load();
        replaceOrAdd(store.screens, "screenId", string(screen, "screenId"), screen);
        save(store);
        return Map.of("screen", screen);
    }

    @PutMapping("/screens/{screenId}")
    public Map<String, Object> updateScreen(@PathVariable String screenId, @RequestBody Map<String, Object> payload) throws IOException {
        Map<String, Object> current = find("screens", "screenId", screenId).orElseGet(LinkedHashMap::new);
        current.putAll(payload);
        Map<String, Object> screen = normalizeScreen(current, screenId);
        Store store = load();
        replaceOrAdd(store.screens, "screenId", screenId, screen);
        save(store);
        return Map.of("screen", screen);
    }

    @DeleteMapping("/screens/{screenId}")
    public Map<String, Object> deleteScreen(@PathVariable String screenId) throws IOException {
        Store store = load();
        store.screens.removeIf(row -> screenId.equals(string(row, "screenId")));
        save(store);
        return Map.of("message", "deleted", "screenId", screenId);
    }

    @PostMapping("/screens/{screenId}/publish")
    public ResponseEntity<?> publishScreen(@PathVariable String screenId) throws IOException {
        Store store = load();
        for (Map<String, Object> screen : store.screens) {
            if (screenId.equals(string(screen, "screenId"))) {
                screen.put("status", "PUBLISHED");
                screen.put("version", intValue(screen.get("version")) + 1);
                screen.put("updatedAt", Instant.now().toString());
                save(store);
                return ResponseEntity.ok(Map.of("screen", screen));
            }
        }
        return ResponseEntity.notFound().build();
    }

    @PostMapping("/screens/{screenId}/duplicate")
    public ResponseEntity<?> duplicateScreen(
            @PathVariable String screenId,
            @RequestParam String newMenuCode,
            @RequestParam String newMenuTitle) throws IOException {
        Map<String, Object> original = find("screens", "screenId", screenId).orElse(null);
        if (original == null) {
            return ResponseEntity.notFound().build();
        }
        Map<String, Object> copy = new LinkedHashMap<>(original);
        copy.put("screenId", "screen-" + UUID.randomUUID());
        copy.put("menuCode", newMenuCode);
        copy.put("pageId", newMenuCode);
        copy.put("menuNm", newMenuTitle);
        copy.put("status", "DRAFT");
        copy.put("version", 1);
        copy.put("createdAt", Instant.now().toString());
        copy.put("updatedAt", Instant.now().toString());
        Store store = load();
        store.screens.add(copy);
        save(store);
        return ResponseEntity.ok(Map.of("screen", copy));
    }

    @GetMapping("/screens/{screenId}/nodes")
    public ResponseEntity<?> nodes(@PathVariable String screenId) throws IOException {
        return find("screens", "screenId", screenId)
                .<ResponseEntity<?>>map(row -> ResponseEntity.ok(Map.of("nodes", nodeList(row), "count", nodeList(row).size())))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }

    @PostMapping("/screens/{screenId}/nodes")
    public ResponseEntity<?> addNode(@PathVariable String screenId, @RequestBody Map<String, Object> payload) throws IOException {
        Store store = load();
        for (Map<String, Object> screen : store.screens) {
            if (screenId.equals(string(screen, "screenId"))) {
                Map<String, Object> node = normalizeNode(payload);
                List<Map<String, Object>> nodes = nodeList(screen);
                nodes.add(node);
                screen.put("nodes", nodes);
                screen.put("updatedAt", Instant.now().toString());
                save(store);
                return ResponseEntity.ok(Map.of("node", node));
            }
        }
        return ResponseEntity.notFound().build();
    }

    @PutMapping("/screens/{screenId}/nodes/{nodeId}")
    public ResponseEntity<?> updateNode(@PathVariable String screenId, @PathVariable String nodeId, @RequestBody Map<String, Object> payload) throws IOException {
        Store store = load();
        for (Map<String, Object> screen : store.screens) {
            if (screenId.equals(string(screen, "screenId"))) {
                List<Map<String, Object>> nodes = nodeList(screen);
                Map<String, Object> node = nodes.stream().filter(row -> nodeId.equals(string(row, "nodeId"))).findFirst().orElseGet(LinkedHashMap::new);
                node.putAll(payload);
                node.put("nodeId", nodeId);
                replaceOrAdd(nodes, "nodeId", nodeId, normalizeNode(node));
                screen.put("nodes", nodes);
                screen.put("updatedAt", Instant.now().toString());
                save(store);
                return ResponseEntity.ok(Map.of("node", node));
            }
        }
        return ResponseEntity.notFound().build();
    }

    @DeleteMapping("/screens/{screenId}/nodes/{nodeId}")
    public ResponseEntity<?> deleteNode(@PathVariable String screenId, @PathVariable String nodeId) throws IOException {
        Store store = load();
        for (Map<String, Object> screen : store.screens) {
            if (screenId.equals(string(screen, "screenId"))) {
                List<Map<String, Object>> nodes = nodeList(screen);
                nodes.removeIf(row -> nodeId.equals(string(row, "nodeId")));
                screen.put("nodes", nodes);
                save(store);
                return ResponseEntity.ok(Map.of("message", "deleted", "nodeId", nodeId));
            }
        }
        return ResponseEntity.notFound().build();
    }

    @GetMapping("/screens/{screenId}/preview")
    public ResponseEntity<?> preview(@PathVariable String screenId) throws IOException {
        Map<String, Object> screen = find("screens", "screenId", screenId).orElse(null);
        if (screen == null) {
            return ResponseEntity.notFound().build();
        }
        String html = "<main data-builder-preview=\"" + escape(screenId) + "\"><h1>" + escape(string(screen, "menuNm")) + "</h1><p>" + escape(string(screen, "menuUrl")) + "</p></main>";
        return ResponseEntity.ok(Map.of("previewHtml", html, "screenId", screenId));
    }

    @GetMapping("/themes")
    public Map<String, Object> themes() throws IOException {
        List<Map<String, Object>> themes = list("themes");
        return Map.of("themes", themes, "count", themes.size());
    }

    @GetMapping("/component-types")
    public Map<String, Object> componentTypes() {
        return Map.of("types", List.of(
                code("BUTTON", "버튼"),
                code("CARD", "카드"),
                code("INPUT", "입력"),
                code("TABLE", "테이블"),
                code("FORM", "폼"),
                code("SECTION", "섹션"),
                code("LAYOUT", "레이아웃"),
                code("CHART", "차트"),
                code("MEDIA", "미디어"),
                code("OTHER", "기타")));
    }

    @GetMapping("/categories")
    public Map<String, Object> categories() {
        return Map.of("categories", List.of(
                code("LAYOUT", "레이아웃"),
                code("FORM", "입력"),
                code("DISPLAY", "표시"),
                code("DATA", "데이터"),
                code("NAVIGATION", "내비게이션"),
                code("FEEDBACK", "피드백")));
    }

    private synchronized List<Map<String, Object>> list(String name) throws IOException {
        Store store = load();
        if ("components".equals(name)) return store.components;
        if ("screens".equals(name)) return store.screens;
        if ("themes".equals(name)) return store.themes;
        return List.of();
    }

    private synchronized java.util.Optional<Map<String, Object>> find(String collection, String key, String value) throws IOException {
        return list(collection).stream().filter(row -> value.equals(string(row, key))).findFirst();
    }

    private synchronized Store load() throws IOException {
        if (!Files.isRegularFile(storeFile)) {
            Store seeded = defaultStore();
            save(seeded);
            return seeded;
        }
        Map<String, Object> raw = objectMapper.readValue(Files.readString(storeFile, StandardCharsets.UTF_8), new TypeReference<>() {});
        Store store = new Store();
        store.components = mapList(raw.get("components"));
        store.screens = mapList(raw.get("screens"));
        store.themes = mapList(raw.get("themes"));
        if (store.components.isEmpty() || store.screens.isEmpty() || store.themes.isEmpty()) {
            Store defaults = defaultStore();
            if (store.components.isEmpty()) store.components = defaults.components;
            if (store.screens.isEmpty()) store.screens = defaults.screens;
            if (store.themes.isEmpty()) store.themes = defaults.themes;
            save(store);
        }
        return store;
    }

    private synchronized void save(Store store) throws IOException {
        Files.createDirectories(storeFile.getParent());
        Map<String, Object> raw = new LinkedHashMap<>();
        raw.put("components", store.components);
        raw.put("screens", store.screens);
        raw.put("themes", store.themes);
        raw.put("updatedAt", Instant.now().toString());
        Files.writeString(storeFile, objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(raw), StandardCharsets.UTF_8);
    }

    private Store defaultStore() {
        Store store = new Store();
        store.components = new ArrayList<>(List.of(
                component("BTN_PRIMARY", "기본 버튼", "BUTTON", "FORM", "px-4 py-2 rounded bg-blue-700 text-white font-bold", false, 10),
                component("CARD_PANEL", "정보 카드", "CARD", "DISPLAY", "rounded border bg-white p-4 shadow-sm", true, 20),
                component("INPUT_TEXT", "텍스트 입력", "INPUT", "FORM", "w-full rounded border px-3 py-2", false, 30),
                component("TABLE_BASIC", "기본 테이블", "TABLE", "DATA", "w-full text-sm border-collapse", false, 40),
                component("SECTION_STANDARD", "표준 섹션", "SECTION", "LAYOUT", "rounded border bg-white p-5", true, 50)));
        store.screens = new ArrayList<>(List.of(screen("builder-default", "A0060119", "builder-studio", "빌더 스튜디오", "/admin/system/builder-studio")));
        store.themes = new ArrayList<>(List.of(theme()));
        return store;
    }

    private Map<String, Object> normalizeComponent(Map<String, Object> payload, String forcedId) {
        Map<String, Object> row = new LinkedHashMap<>(payload);
        String id = blank(forcedId) ? string(row, "componentId") : forcedId;
        if (blank(id)) id = "COMP-" + UUID.randomUUID();
        row.put("componentId", id);
        row.putIfAbsent("componentNm", id);
        row.putIfAbsent("componentDc", "");
        row.putIfAbsent("componentType", "OTHER");
        row.putIfAbsent("categoryCd", "LAYOUT");
        row.putIfAbsent("iconNm", "");
        row.putIfAbsent("defaultProps", new LinkedHashMap<>());
        row.putIfAbsent("defaultClassNm", "");
        row.putIfAbsent("defaultStyle", new LinkedHashMap<>());
        row.putIfAbsent("dataAttrs", new LinkedHashMap<>());
        row.putIfAbsent("isContainer", false);
        row.putIfAbsent("isReusable", true);
        row.putIfAbsent("sortOrder", 999);
        row.putIfAbsent("useAt", "Y");
        return row;
    }

    private Map<String, Object> normalizeScreen(Map<String, Object> payload, String forcedId) {
        Map<String, Object> row = new LinkedHashMap<>(payload);
        String id = blank(forcedId) ? string(row, "screenId") : forcedId;
        if (blank(id)) id = "screen-" + UUID.randomUUID();
        String now = Instant.now().toString();
        row.put("screenId", id);
        row.putIfAbsent("menuCode", id);
        row.putIfAbsent("pageId", row.get("menuCode"));
        row.putIfAbsent("menuNm", id);
        row.putIfAbsent("menuUrl", "/admin/system/builder-studio");
        row.putIfAbsent("templateType", "admin");
        row.putIfAbsent("nodes", new ArrayList<>());
        row.putIfAbsent("events", new ArrayList<>());
        row.putIfAbsent("themeId", "theme-default");
        row.putIfAbsent("customClasses", "");
        row.putIfAbsent("customStyles", "");
        row.putIfAbsent("status", "DRAFT");
        row.putIfAbsent("version", 1);
        row.putIfAbsent("createdAt", now);
        row.put("updatedAt", now);
        return row;
    }

    private Map<String, Object> normalizeNode(Map<String, Object> payload) {
        Map<String, Object> row = new LinkedHashMap<>(payload);
        row.putIfAbsent("nodeId", "node-" + UUID.randomUUID());
        row.putIfAbsent("componentId", "");
        row.putIfAbsent("parentNodeId", null);
        row.putIfAbsent("componentType", "SECTION");
        row.putIfAbsent("slotName", "root");
        row.putIfAbsent("sortOrder", 0);
        row.putIfAbsent("props", new LinkedHashMap<>());
        return row;
    }

    private Map<String, Object> component(String id, String name, String type, String category, String className, boolean container, int sortOrder) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("componentId", id);
        row.put("componentNm", name);
        row.put("componentDc", name + " 빌더 기본 컴포넌트");
        row.put("componentType", type);
        row.put("categoryCd", category);
        row.put("iconNm", "");
        row.put("defaultProps", Map.of("label", name, "className", className));
        row.put("defaultClassNm", className);
        row.put("defaultStyle", new LinkedHashMap<>());
        row.put("dataAttrs", new LinkedHashMap<>());
        row.put("isContainer", container);
        row.put("isReusable", true);
        row.put("sortOrder", sortOrder);
        row.put("useAt", "Y");
        return row;
    }

    private Map<String, Object> screen(String id, String menuCode, String pageId, String title, String url) {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("screenId", id);
        row.put("menuCode", menuCode);
        row.put("pageId", pageId);
        row.put("menuNm", title);
        row.put("menuUrl", url);
        row.put("templateType", "admin");
        row.put("nodes", new ArrayList<>());
        row.put("events", new ArrayList<>());
        row.put("themeId", "theme-default");
        row.put("customClasses", "");
        row.put("customStyles", "");
        row.put("status", "DRAFT");
        row.put("version", 1);
        row.put("createdAt", Instant.now().toString());
        row.put("updatedAt", Instant.now().toString());
        return row;
    }

    private Map<String, Object> theme() {
        Map<String, Object> row = new LinkedHashMap<>();
        row.put("themeId", "theme-default");
        row.put("themeName", "Carbonet 기본 테마");
        row.put("description", "빌더 기본 테마");
        row.put("themeType", "admin");
        row.put("isDefault", true);
        row.put("tokens", new LinkedHashMap<>());
        return row;
    }

    private Map<String, Object> code(String code, String label) {
        return Map.of("code", code, "label", label);
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> mapList(Object value) {
        if (!(value instanceof List<?> list)) return new ArrayList<>();
        List<Map<String, Object>> result = new ArrayList<>();
        for (Object item : list) {
            if (item instanceof Map<?, ?> map) {
                Map<String, Object> row = new LinkedHashMap<>();
                map.forEach((key, val) -> row.put(String.valueOf(key), val));
                result.add(row);
            }
        }
        return result;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> nodeList(Map<String, Object> screen) {
        Object nodes = screen.get("nodes");
        if (nodes instanceof List<?> list) {
            List<Map<String, Object>> result = new ArrayList<>();
            for (Object item : list) {
                if (item instanceof Map<?, ?> map) {
                    Map<String, Object> row = new LinkedHashMap<>();
                    map.forEach((key, value) -> row.put(String.valueOf(key), value));
                    result.add(row);
                }
            }
            return result;
        }
        return new ArrayList<>();
    }

    private void replaceOrAdd(List<Map<String, Object>> rows, String key, String value, Map<String, Object> row) {
        rows.removeIf(item -> Objects.equals(value, string(item, key)));
        rows.add(row);
    }

    private String string(Map<String, Object> row, String key) {
        Object value = row.get(key);
        return value == null ? "" : String.valueOf(value);
    }

    private boolean blank(String value) {
        return value == null || value.trim().isEmpty();
    }

    private int intValue(Object value) {
        if (value instanceof Number number) return number.intValue();
        try {
            return Integer.parseInt(String.valueOf(value));
        } catch (Exception ignored) {
            return 0;
        }
    }

    private String escape(String value) {
        return value == null ? "" : value.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
    }

    private static class Store {
        List<Map<String, Object>> components = new ArrayList<>();
        List<Map<String, Object>> screens = new ArrayList<>();
        List<Map<String, Object>> themes = new ArrayList<>();
    }
}
