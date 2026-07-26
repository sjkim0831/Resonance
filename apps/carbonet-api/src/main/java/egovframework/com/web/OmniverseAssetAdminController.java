package egovframework.com.web;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/admin/api/omniverse/assets")
public class OmniverseAssetAdminController {
    private static final Set<String> ALLOWED_EXTENSIONS = Set.of("usd", "usda", "usdc", "usdz", "zip");

    private final Path storageRoot;
    private final String streamUrl;

    public OmniverseAssetAdminController(
            @Value("${carbonet.omniverse.storage-path:/app/backend-metadata/omniverse-assets}") String storagePath,
            @Value("${carbonet.omniverse.stream-url:}") String streamUrl) throws IOException {
        this.storageRoot = Path.of(storagePath).toAbsolutePath().normalize();
        this.streamUrl = streamUrl == null ? "" : streamUrl.trim();
        Files.createDirectories(this.storageRoot);
    }

    @GetMapping
    public Map<String, Object> list() throws IOException {
        List<Map<String, Object>> items;
        try (var paths = Files.list(storageRoot)) {
            items = paths.filter(Files::isRegularFile)
                    .sorted(Comparator.comparingLong(this::lastModified).reversed())
                    .map(this::toItem)
                    .toList();
        }
        Map<String, Object> response = new LinkedHashMap<>();
        response.put("status", "UP");
        response.put("streamUrl", streamUrl);
        response.put("items", items);
        response.put("maxUploadBytes", 524_288_000L);
        return response;
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<?> upload(@RequestParam("file") MultipartFile file) throws IOException {
        if (file.isEmpty()) return badRequest("빈 파일은 업로드할 수 없습니다.");
        String fileName = safeFileName(file.getOriginalFilename());
        validateExtension(fileName);
        Path target = resolve(fileName);
        Path temporary = Files.createTempFile(storageRoot, ".upload-", ".tmp");
        try {
            file.transferTo(temporary);
            Files.move(temporary, target, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        } finally {
            Files.deleteIfExists(temporary);
        }
        return ResponseEntity.ok(toItem(target));
    }

    @GetMapping("/{name:.+}/download")
    public ResponseEntity<?> download(@PathVariable String name) throws IOException {
        Path target = resolve(safeFileName(name));
        if (!Files.isRegularFile(target)) return ResponseEntity.notFound().build();
        FileSystemResource resource = new FileSystemResource(target);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .contentLength(Files.size(target))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(target.getFileName().toString()).build().toString())
                .body(resource);
    }

    @PostMapping("/{name:.+}/delete")
    public ResponseEntity<?> delete(@PathVariable String name) throws IOException {
        Path target = resolve(safeFileName(name));
        if (!Files.deleteIfExists(target)) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(Map.of("status", "DELETED", "name", target.getFileName().toString()));
    }

    private Map<String, Object> toItem(Path path) {
        Map<String, Object> item = new LinkedHashMap<>();
        String name = path.getFileName().toString();
        item.put("name", name);
        try {
            item.put("size", Files.size(path));
            item.put("modifiedAt", Files.getLastModifiedTime(path).toInstant().toString());
        } catch (IOException exception) {
            item.put("size", 0L);
            item.put("modifiedAt", Instant.EPOCH.toString());
        }
        item.put("downloadUrl", "/admin/api/omniverse/assets/" + encodePath(name) + "/download");
        return item;
    }

    private long lastModified(Path path) {
        try { return Files.getLastModifiedTime(path).toMillis(); }
        catch (IOException exception) { return 0L; }
    }

    private Path resolve(String name) {
        Path target = storageRoot.resolve(name).normalize();
        if (!target.getParent().equals(storageRoot)) throw new IllegalArgumentException("허용되지 않은 파일 경로입니다.");
        return target;
    }

    private String safeFileName(String original) {
        String name = original == null ? "" : Path.of(original.replace('\\', '/')).getFileName().toString().trim();
        if (name.isBlank() || name.equals(".") || name.equals("..")) throw new IllegalArgumentException("파일명이 올바르지 않습니다.");
        return name.replaceAll("[^0-9A-Za-z가-힣._() -]", "_");
    }

    private void validateExtension(String name) {
        int dot = name.lastIndexOf('.');
        String extension = dot < 0 ? "" : name.substring(dot + 1).toLowerCase(Locale.ROOT);
        if (!ALLOWED_EXTENSIONS.contains(extension)) throw new IllegalArgumentException("USD, USDA, USDC, USDZ 또는 ZIP 파일만 허용됩니다.");
    }

    private String encodePath(String value) {
        return java.net.URLEncoder.encode(value, java.nio.charset.StandardCharsets.UTF_8).replace("+", "%20");
    }

    private ResponseEntity<Map<String, String>> badRequest(String message) {
        return ResponseEntity.badRequest().body(Map.of("status", "INVALID", "message", message));
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, String>> invalidRequest(IllegalArgumentException exception) {
        return badRequest(exception.getMessage());
    }
}
