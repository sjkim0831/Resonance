package egovframework.com.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;

@RestController
@RequestMapping("/api/runtime/build-studio")
public class BuildStudioMetadataController {

    private final ObjectMapper objectMapper;
    private final Path staticRoot;
    private final Path backendMetadataRoot;

    public BuildStudioMetadataController(
            ObjectMapper objectMapper,
            @Value("${CARBONET_STATIC_FS_OVERRIDE_PATH:/app/static-overlay}") String staticRoot,
            @Value("${CARBONET_BACKEND_METADATA_FS_OVERRIDE_PATH:/app/backend-metadata}") String backendMetadataRoot) {
        this.objectMapper = objectMapper;
        this.staticRoot = Path.of(staticRoot).normalize();
        this.backendMetadataRoot = Path.of(backendMetadataRoot).normalize();
    }

    @GetMapping("/assets")
    public Map<String, Object> listAssets() throws IOException {
        List<Map<String, Object>> assets = new ArrayList<>();
        collectAssets("static", staticRoot, assets);
        collectAssets("backend-metadata", backendMetadataRoot, assets);
        return Map.of("assets", assets, "count", assets.size());
    }

    @GetMapping("/assets/{scope}/{*assetPath}")
    public ResponseEntity<?> readAsset(@PathVariable String scope, @PathVariable String assetPath) throws IOException {
        Path root = rootFor(scope);
        Path file = resolveInside(root, assetPath);
        if (!Files.isRegularFile(file)) {
            return ResponseEntity.notFound().build();
        }
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("scope", scope);
        body.put("path", normalizeRequestPath(assetPath));
        body.put("size", Files.size(file));
        body.put("content", Files.readString(file, StandardCharsets.UTF_8));
        return ResponseEntity.ok(body);
    }

    @PostMapping("/assets/{scope}/{*assetPath}")
    public ResponseEntity<?> writeAsset(
            @PathVariable String scope,
            @PathVariable String assetPath,
            @RequestBody Map<String, Object> payload) throws IOException {
        Path root = rootFor(scope);
        Path file = resolveInside(root, assetPath);
        String content = String.valueOf(payload.getOrDefault("content", ""));
        if (isJsonLike(file)) {
            objectMapper.readTree(content);
        }
        Files.createDirectories(file.getParent());
        Files.writeString(file, content, StandardCharsets.UTF_8);
        return ResponseEntity.ok(Map.of(
                "status", "saved",
                "scope", scope,
                "path", normalizeRequestPath(assetPath),
                "size", Files.size(file)));
    }

    private void collectAssets(String scope, Path root, List<Map<String, Object>> assets) throws IOException {
        if (!Files.isDirectory(root)) {
            return;
        }
        try (Stream<Path> stream = Files.walk(root)) {
            stream.filter(Files::isRegularFile)
                    .sorted()
                    .forEach(path -> assets.add(asset(scope, root, path)));
        }
    }

    private Map<String, Object> asset(String scope, Path root, Path path) {
        Map<String, Object> asset = new LinkedHashMap<>();
        asset.put("scope", scope);
        asset.put("path", root.relativize(path).toString().replace('\\', '/'));
        asset.put("editable", isTextLike(path));
        try {
            asset.put("size", Files.size(path));
            asset.put("updatedAt", Files.getLastModifiedTime(path).toString());
        } catch (IOException ignored) {
            asset.put("size", 0);
        }
        return asset;
    }

    private Path rootFor(String scope) {
        if ("static".equals(scope)) {
            return staticRoot;
        }
        if ("backend-metadata".equals(scope)) {
            return backendMetadataRoot;
        }
        throw new IllegalArgumentException("Unsupported asset scope: " + scope);
    }

    private Path resolveInside(Path root, String assetPath) {
        Path resolved = root.resolve(normalizeRequestPath(assetPath)).normalize();
        if (!resolved.startsWith(root)) {
            throw new IllegalArgumentException("Asset path escapes scope root.");
        }
        return resolved;
    }

    private String normalizeRequestPath(String assetPath) {
        return assetPath == null ? "" : assetPath.replaceFirst("^/", "");
    }

    private boolean isJsonLike(Path path) {
        String value = path.toString().toLowerCase();
        return value.endsWith(".json") || value.endsWith(".sdui");
    }

    private boolean isTextLike(Path path) {
        String value = path.toString().toLowerCase();
        return value.endsWith(".json")
                || value.endsWith(".js")
                || value.endsWith(".css")
                || value.endsWith(".html")
                || value.endsWith(".svg")
                || value.endsWith(".txt")
                || value.endsWith(".md")
                || value.endsWith(".sql")
                || value.endsWith(".pl")
                || value.endsWith(".yml")
                || value.endsWith(".yaml");
    }
}
