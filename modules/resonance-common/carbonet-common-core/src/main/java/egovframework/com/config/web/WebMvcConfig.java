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

    @Override
    public void addResourceHandlers(ResourceHandlerRegistry registry) {
        String[] reactAppLocations = reactAppResourceLocations();
        String[] reactAppAssetsLocations = reactAppAssetsResourceLocations();
        String[] reactAppManifestLocations = reactAppManifestResourceLocations();
        registry.addResourceHandler("/home/**").addResourceLocations("classpath:/static/");
        registry.addResourceHandler("/signin/**").addResourceLocations("classpath:/static/");
        registry.addResourceHandler("/main/**").addResourceLocations("classpath:/static/");
        registry.addResourceHandler("/react-shell/**")
                .addResourceLocations("classpath:/static/react-shell/")
                .setCacheControl(CacheControl.noStore().mustRevalidate());
        registry.addResourceHandler("/assets/react/index.html")
                .addResourceLocations(reactAppLocations)
                .setCacheControl(CacheControl.noStore().mustRevalidate());
        registry.addResourceHandler("/assets/react/assets/**")
                .addResourceLocations(reactAppAssetsLocations)
                .setCacheControl(CacheControl.maxAge(365, TimeUnit.DAYS).cachePublic().immutable());
        registry.addResourceHandler("/assets/react/.vite/**")
                .addResourceLocations(reactAppManifestLocations)
                .setCacheControl(CacheControl.maxAge(365, TimeUnit.DAYS).cachePublic().immutable());
        registry.addResourceHandler("/admin/assets/react/**", "/en/admin/assets/react/**")
                .addResourceLocations(reactAppLocations)
                .setCacheControl(CacheControl.maxAge(365, TimeUnit.DAYS).cachePublic().immutable());
        registry.addResourceHandler("/admin/**").addResourceLocations("classpath:/static/");
        registry.addResourceHandler("/assets/react/**")
                .addResourceLocations(reactAppLocations)
                .setCacheControl(CacheControl.maxAge(365, TimeUnit.DAYS).cachePublic().immutable());
    }

    private String[] reactAppResourceLocations() {
        if (!reactAppFilesystemOverrideEnabled || reactAppFilesystemOverridePath == null || reactAppFilesystemOverridePath.trim().isEmpty()) {
            return new String[]{"classpath:/static/react-app/"};
        }
        String normalized = reactAppFilesystemOverridePath.trim();
        if (!normalized.endsWith("/")) {
            normalized = normalized + "/";
        }
        return new String[]{"file:" + normalized, "classpath:/static/react-app/"};
    }

    private String[] reactAppAssetsResourceLocations() {
        if (!reactAppFilesystemOverrideEnabled || reactAppFilesystemOverridePath == null || reactAppFilesystemOverridePath.trim().isEmpty()) {
            return new String[]{"classpath:/static/react-app/assets/"};
        }
        String normalized = reactAppFilesystemOverridePath.trim();
        if (!normalized.endsWith("/")) {
            normalized = normalized + "/";
        }
        return new String[]{"file:" + normalized + "assets/", "classpath:/static/react-app/assets/"};
    }

    private String[] reactAppManifestResourceLocations() {
        if (!reactAppFilesystemOverrideEnabled || reactAppFilesystemOverridePath == null || reactAppFilesystemOverridePath.trim().isEmpty()) {
            return new String[]{"classpath:/static/react-app/.vite/"};
        }
        String normalized = reactAppFilesystemOverridePath.trim();
        if (!normalized.endsWith("/")) {
            normalized = normalized + "/";
        }
        return new String[]{"file:" + normalized + ".vite/", "classpath:/static/react-app/.vite/"};
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
