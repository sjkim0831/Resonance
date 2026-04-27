package egovframework.com.feature.home.web;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.FileSystemResource;
import org.springframework.core.io.Resource;
import org.springframework.core.io.ResourceLoader;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Collections;
import java.util.List;
import java.util.Map;

@Component
public class ReactAppAssetResolver {

    private static final String MANIFEST_RESOURCE = "classpath:/static/react-app/.vite/manifest.json";
    private static final String ENTRY_KEY = "src/main.tsx";
    private static final String FALLBACK_ENTRY_KEY = "index.html";

    private final ObjectMapper objectMapper;
    private final ResourceLoader resourceLoader;
    private final String fallbackJs;
    private final String fallbackCss;
    private final boolean filesystemOverrideEnabled;
    private final String filesystemOverridePath;
    private volatile CachedAssets cachedAssets;

    public ReactAppAssetResolver(
            ObjectMapper objectMapper,
            ResourceLoader resourceLoader,
            @Value("${CARBONET_REACT_APP_FS_OVERRIDE_ENABLED:false}") boolean filesystemOverrideEnabled,
            @Value("${CARBONET_REACT_APP_FS_OVERRIDE_PATH:}") String filesystemOverridePath,
            @Value("${carbonet.react-app.prod-js:/assets/react/assets/index.js}") String fallbackJs,
            @Value("${carbonet.react-app.prod-css:/assets/react/assets/index.css}") String fallbackCss) {
        this.objectMapper = objectMapper;
        this.resourceLoader = resourceLoader;
        this.filesystemOverrideEnabled = filesystemOverrideEnabled;
        this.filesystemOverridePath = filesystemOverridePath == null ? "" : filesystemOverridePath.trim();
        this.fallbackJs = fallbackJs;
        this.fallbackCss = fallbackCss;
    }

    public ReactAppAssets resolveAssets() {
        Resource manifestResource = resolveManifestResource();
        if (!manifestResource.exists()) {
            return versionedAssets(fallbackJs, fallbackCss, "fallback");
        }

        long lastModified = readLastModified(manifestResource);
        CachedAssets snapshot = cachedAssets;
        if (snapshot != null && snapshot.matches(lastModified)) {
            return snapshot.getAssets();
        }
        synchronized (this) {
            snapshot = cachedAssets;
            if (snapshot != null && snapshot.matches(lastModified)) {
                return snapshot.getAssets();
            }
            ReactAppAssets assets = loadAssets(manifestResource);
            cachedAssets = new CachedAssets(lastModified, assets);
            return assets;
        }
    }

    private ReactAppAssets versionedAssets(String jsPath, String cssPath, String versionToken) {
        return new ReactAppAssets(appendVersion(jsPath, versionToken), appendVersion(cssPath, versionToken));
    }

    private String firstCssPath(List<String> cssFiles) {
        if (cssFiles == null || cssFiles.isEmpty() || isBlank(cssFiles.get(0))) {
            return null;
        }
        return toPublicAssetPath(cssFiles.get(0));
    }

    private String toPublicAssetPath(String relativePath) {
        String normalized = relativePath.startsWith("/") ? relativePath.substring(1) : relativePath;
        return "/assets/react/" + normalized;
    }

    private Resource resolveManifestResource() {
        Resource filesystemManifest = resolveFilesystemManifestResource();
        if (filesystemManifest != null && filesystemManifest.exists()) {
            return filesystemManifest;
        }
        return resourceLoader.getResource(MANIFEST_RESOURCE);
    }

    private Resource resolveFilesystemManifestResource() {
        if (!filesystemOverrideEnabled || isBlank(filesystemOverridePath)) {
            return null;
        }
        Path manifestPath = Path.of(filesystemOverridePath, ".vite", "manifest.json");
        if (!Files.exists(manifestPath)) {
            return null;
        }
        return new FileSystemResource(manifestPath);
    }

    private String appendVersion(String path, String versionToken) {
        if (isBlank(path) || isBlank(versionToken) || path.contains("?v=")) {
            return path;
        }
        return path + "?v=" + versionToken;
    }

    private String buildVersionToken(String jsFile, String cssPath) {
        return Integer.toHexString((safeValue(jsFile) + "|" + safeValue(cssPath)).hashCode());
    }

    private ReactAppAssets loadAssets(Resource manifestResource) {
        try (InputStream inputStream = manifestResource.getInputStream()) {
            Map<String, ManifestEntry> manifest = objectMapper.readValue(inputStream, new TypeReference<Map<String, ManifestEntry>>() {
            });
            ManifestEntry entry = manifest.get(ENTRY_KEY);
            if (entry == null) {
                entry = manifest.get(FALLBACK_ENTRY_KEY);
            }
            if (entry == null || isBlank(entry.getFile())) {
                return versionedAssets(fallbackJs, fallbackCss, "fallback");
            }

            String jsPath = toPublicAssetPath(entry.getFile());
            String cssPath = firstCssPath(entry.getCss());
            String resolvedCssPath = cssPath == null ? fallbackCss : cssPath;
            String versionToken = buildVersionToken(entry.getFile(), resolvedCssPath);
            return versionedAssets(jsPath, resolvedCssPath, versionToken);
        } catch (IOException ex) {
            return versionedAssets(fallbackJs, fallbackCss, "fallback");
        }
    }

    private long readLastModified(Resource manifestResource) {
        try {
            return manifestResource.lastModified();
        } catch (IOException ignored) {
            return -1L;
        }
    }

    private String safeValue(String value) {
        return value == null ? "" : value.trim();
    }

    private boolean isBlank(String value) {
        return value == null || value.trim().isEmpty();
    }

    public static class ReactAppAssets {
        private final String jsPath;
        private final String cssPath;

        public ReactAppAssets(String jsPath, String cssPath) {
            this.jsPath = jsPath;
            this.cssPath = cssPath;
        }

        public String getJsPath() {
            return jsPath;
        }

        public String getCssPath() {
            return cssPath;
        }
    }

    public static class ManifestEntry {
        private String file;
        private List<String> css = Collections.emptyList();

        public String getFile() {
            return file;
        }

        public void setFile(String file) {
            this.file = file;
        }

        public List<String> getCss() {
            return css;
        }

        public void setCss(List<String> css) {
            this.css = css;
        }
    }

    private static final class CachedAssets {
        private final long lastModified;
        private final ReactAppAssets assets;

        private CachedAssets(long lastModified, ReactAppAssets assets) {
            this.lastModified = lastModified;
            this.assets = assets;
        }

        private boolean matches(long otherLastModified) {
            return lastModified == otherLastModified;
        }

        private ReactAppAssets getAssets() {
            return assets;
        }
    }
}
