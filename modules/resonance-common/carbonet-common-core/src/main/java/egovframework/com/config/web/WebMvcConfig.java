package egovframework.com.config.web;

import egovframework.com.common.interceptor.CompanyScopeInterceptor;
import egovframework.com.common.interceptor.ReactShellNoCacheInterceptor;
import egovframework.com.common.interceptor.TraceContextInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.CacheControl;
import org.springframework.web.reactive.function.client.WebClient;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.ResourceHandlerRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;
import org.springframework.web.servlet.i18n.LocaleChangeInterceptor;

import java.util.concurrent.TimeUnit;

@Configuration
@RequiredArgsConstructor
public class WebMvcConfig implements WebMvcConfigurer {

    private final CompanyScopeInterceptor companyScopeInterceptor;
    private final TraceContextInterceptor traceContextInterceptor;
    private final ReactShellNoCacheInterceptor reactShellNoCacheInterceptor;
    @Value("${CARBONET_REACT_APP_FS_OVERRIDE_ENABLED:false}")
    private boolean reactAppFilesystemOverrideEnabled;
    @Value("${CARBONET_REACT_APP_FS_OVERRIDE_PATH:}")
    private String reactAppFilesystemOverridePath;
    @Value("${CARBONET_STATIC_FS_OVERRIDE_ENABLED:false}")
    private boolean staticFilesystemOverrideEnabled;
    @Value("${CARBONET_STATIC_FS_OVERRIDE_PATH:}")
    private String staticFilesystemOverridePath;

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String[] reactAppLocations = reactAppResourceLocations();
        String[] reactAppAssetsLocations = reactAppAssetsResourceLocations();
        String[] reactAppManifestLocations = reactAppManifestResourceLocations();
        String[] staticLocations = staticResourceLocations();
        String[] reactShellLocations = staticSubResourceLocations("react-shell");
        String[] downloadLocations = staticSubResourceLocations("download");
        String[] downloadsLocations = staticSubResourceLocations("downloads");
        String[] imageLocations = staticSubResourceLocations("img");
        String[] errorLocations = staticSubResourceLocations("error");
        CacheControl runtimeNoStore = CacheControl.noStore().mustRevalidate();
        CacheControl reactAssetCache = reactAppFilesystemOverrideEnabled || staticFilesystemOverrideEnabled
                ? runtimeNoStore
                : CacheControl.maxAge(365, TimeUnit.DAYS).cachePublic().immutable();
        registry.addResourceHandler("/home/**").addResourceLocations(staticLocations).setCacheControl(runtimeNoStore);
        registry.addResourceHandler("/signin/**").addResourceLocations(staticLocations).setCacheControl(runtimeNoStore);
        registry.addResourceHandler("/main/**").addResourceLocations(staticLocations).setCacheControl(runtimeNoStore);
        registry.addResourceHandler("/download/**").addResourceLocations(downloadLocations).setCacheControl(runtimeNoStore);
        registry.addResourceHandler("/downloads/**").addResourceLocations(downloadsLocations).setCacheControl(runtimeNoStore);
        registry.addResourceHandler("/img/**").addResourceLocations(imageLocations).setCacheControl(runtimeNoStore);
        registry.addResourceHandler("/error/**").addResourceLocations(errorLocations).setCacheControl(runtimeNoStore);
        registry.addResourceHandler("/react-shell/**")
                .addResourceLocations(reactShellLocations)
                .setCacheControl(runtimeNoStore);
        registry.addResourceHandler("/assets/react/index.html")
                .addResourceLocations(reactAppLocations)
                .setCacheControl(runtimeNoStore);
        registry.addResourceHandler("/assets/react/assets/**")
                .addResourceLocations(reactAppAssetsLocations)
                .setCacheControl(reactAssetCache);
        registry.addResourceHandler("/assets/react/.vite/**")
                .addResourceLocations(reactAppManifestLocations)
                .setCacheControl(reactAssetCache);
        registry.addResourceHandler("/admin/assets/react/**", "/en/admin/assets/react/**")
                .addResourceLocations(reactAppLocations)
                .setCacheControl(reactAssetCache);
        registry.addResourceHandler("/admin/**").addResourceLocations(staticLocations).setCacheControl(runtimeNoStore);
        registry.addResourceHandler("/assets/react/**")
                .addResourceLocations(reactAppLocations)
                .setCacheControl(reactAssetCache);
    }

    private String[] reactAppResourceLocations() {
        String[] staticReactLocations = staticSubResourceLocations("react-app");
        if (!reactAppFilesystemOverrideEnabled || reactAppFilesystemOverridePath == null || reactAppFilesystemOverridePath.trim().isEmpty()) {
            return staticReactLocations;
        }
        String normalized = reactAppFilesystemOverridePath.trim();
        if (!normalized.endsWith("/")) {
            normalized = normalized + "/";
        }
        return prepend("file:" + normalized, staticReactLocations);
    }

    private String[] reactAppAssetsResourceLocations() {
        String[] staticReactAssetLocations = staticSubResourceLocations("react-app/assets");
        if (!reactAppFilesystemOverrideEnabled || reactAppFilesystemOverridePath == null || reactAppFilesystemOverridePath.trim().isEmpty()) {
            return staticReactAssetLocations;
        }
        String normalized = reactAppFilesystemOverridePath.trim();
        if (!normalized.endsWith("/")) {
            normalized = normalized + "/";
        }
        return prepend("file:" + normalized + "assets/", staticReactAssetLocations);
    }

    private String[] reactAppManifestResourceLocations() {
        String[] staticReactManifestLocations = staticSubResourceLocations("react-app/.vite");
        if (!reactAppFilesystemOverrideEnabled || reactAppFilesystemOverridePath == null || reactAppFilesystemOverridePath.trim().isEmpty()) {
            return staticReactManifestLocations;
        }
        String normalized = reactAppFilesystemOverridePath.trim();
        if (!normalized.endsWith("/")) {
            normalized = normalized + "/";
        }
        return prepend("file:" + normalized + ".vite/", staticReactManifestLocations);
    }

    private String[] staticResourceLocations() {
        if (!staticFilesystemOverrideEnabled || staticFilesystemOverridePath == null || staticFilesystemOverridePath.trim().isEmpty()) {
            return new String[]{"classpath:/static/"};
        }
        String normalized = normalizeDirectory(staticFilesystemOverridePath);
        return new String[]{"file:" + normalized, "classpath:/static/"};
    }

    private String[] staticSubResourceLocations(String subPath) {
        String normalizedSubPath = subPath.endsWith("/") ? subPath : subPath + "/";
        if (!staticFilesystemOverrideEnabled || staticFilesystemOverridePath == null || staticFilesystemOverridePath.trim().isEmpty()) {
            return new String[]{"classpath:/static/" + normalizedSubPath};
        }
        String normalized = normalizeDirectory(staticFilesystemOverridePath);
        return new String[]{"file:" + normalized + normalizedSubPath, "classpath:/static/" + normalizedSubPath};
    }

    private String normalizeDirectory(String value) {
        String normalized = value.trim();
        if (!normalized.endsWith("/")) {
            normalized = normalized + "/";
        }
        return normalized;
    }

    private String[] prepend(String first, String[] rest) {
        String[] combined = new String[rest.length + 1];
        combined[0] = first;
        System.arraycopy(rest, 0, combined, 1, rest.length);
        return combined;
    }

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(localeChangeInterceptor());
        registry.addInterceptor(companyScopeInterceptor)
                .addPathPatterns("/**")
                .excludePathPatterns(
                        "/css/**",
                        "/js/**",
                        "/images/**",
                        "/webjars/**",
                        "/error/**",
                        "/favicon.ico",
                        "/assets/react/**",
                        "/admin/assets/react/**",
                        "/en/admin/assets/react/**");
        registry.addInterceptor(traceContextInterceptor)
                .addPathPatterns("/**")
                .excludePathPatterns(
                        "/css/**",
                        "/js/**",
                        "/images/**",
                        "/webjars/**",
                        "/error/**",
                        "/favicon.ico",
                        "/assets/react/**",
                        "/admin/assets/react/**",
                        "/en/admin/assets/react/**");
        registry.addInterceptor(reactShellNoCacheInterceptor).addPathPatterns("/**");
    }

    @Bean
    public LocaleChangeInterceptor localeChangeInterceptor() {
        LocaleChangeInterceptor interceptor = new LocaleChangeInterceptor();
        interceptor.setParamName("language");
        return interceptor;
    }

    @Bean
    public WebClient.Builder webClientBuilder() {
        return WebClient.builder();
    }
}
