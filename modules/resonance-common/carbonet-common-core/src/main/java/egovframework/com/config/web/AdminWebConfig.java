package egovframework.com.config.web;

import egovframework.com.common.interceptor.AdminMainAuthInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.InterceptorRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@RequiredArgsConstructor
public class AdminWebConfig implements WebMvcConfigurer {

    private final AdminMainAuthInterceptor adminMainAuthInterceptor;

    @Override
    public void addInterceptors(InterceptorRegistry registry) {
        registry.addInterceptor(adminMainAuthInterceptor)
                .addPathPatterns("/admin/**", "/en/admin/**")
                .excludePathPatterns(
                        "/admin/login/**",
                        "/en/admin/login/**",
                        "/admin/assets/react/**",
                        "/en/admin/assets/react/**",
                        "/admin/css/**",
                        "/admin/js/**",
                        "/admin/img/**",
                        "/admin/fonts/**",
                        "/en/admin/css/**",
                        "/en/admin/js/**",
                        "/en/admin/img/**",
                        "/en/admin/fonts/**",
                        "/admin/**/*.png",
                        "/admin/**/*.jpg",
                        "/admin/**/*.jpeg",
                        "/admin/**/*.gif",
                        "/admin/**/*.svg",
                        "/admin/**/*.woff",
                        "/admin/**/*.woff2",
                        "/admin/**/*.ttf",
                        "/admin/**/*.otf",
                        "/admin/**/*.eot",
                        "/admin/**/*.ico",
                        "/en/admin/**/*.png",
                        "/en/admin/**/*.jpg",
                        "/en/admin/**/*.jpeg",
                        "/en/admin/**/*.gif",
                        "/en/admin/**/*.svg",
                        "/en/admin/**/*.woff",
                        "/en/admin/**/*.woff2",
                        "/en/admin/**/*.ttf",
                        "/en/admin/**/*.otf",
                        "/en/admin/**/*.eot",
                        "/en/admin/**/*.ico"
                );
    }
}
