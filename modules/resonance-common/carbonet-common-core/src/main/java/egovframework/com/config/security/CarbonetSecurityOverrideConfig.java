package egovframework.com.config.security;

import org.egovframe.boot.security.EgovSecurityProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.annotation.Order;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.annotation.web.configuration.EnableWebSecurity;
import org.springframework.security.web.SecurityFilterChain;

@Configuration
@EnableWebSecurity
@EnableConfigurationProperties(EgovSecurityProperties.class)
public class CarbonetSecurityOverrideConfig {

    @Bean
    public CarbonetAccessDeniedHandler egovAccessDeniedHandler(EgovSecurityProperties properties) {
        return new CarbonetAccessDeniedHandler(properties);
    }

    @Bean
    public CarbonetAdminAwareLoginUrlAuthenticationEntryPoint loginUrlAuthenticationEntryPoint(EgovSecurityProperties properties) {
        return new CarbonetAdminAwareLoginUrlAuthenticationEntryPoint(properties);
    }

    @Bean
    @Order(0)
    public SecurityFilterChain carbonetSecurityFilterChain(HttpSecurity http) throws Exception {
        return http
            .securityMatcher("/admin/api/**", "/en/admin/api/**", "/api/platform/**", "/en/api/platform/**", "/admin/ai/**", "/en/admin/ai/**", "/admin/emission/**", "/en/admin/emission/**")
            .authorizeHttpRequests(authorize -> authorize
                .anyRequest().permitAll()
            )
            .csrf(csrf -> csrf.disable())
            .build();
    }

    @Bean
    @Order(Integer.MAX_VALUE)
    public SecurityFilterChain defaultPublicAccessSecurityFilterChain(HttpSecurity http) throws Exception {
        return http
.securityMatcher(
                "/assets/react/**",
                "/admin/assets/react/**",
                "/en/admin/assets/react/**",
                "/react-shell/**",
                "/home/**",
                "/en/home/**",
                "/api/app/bootstrap",
                "/en/api/app/bootstrap",
                "/api/home",
                "/api/en/home",
                "/api/home/certificate-verify/verify",
                "/api/home/certificate-verify/verify-ocr",
                "/api/en/home/certificate-verify/verify",
                "/api/en/home/certificate-verify/verify-ocr",
                "/api/public/report-certificates/**",
                "/en/api/public/report-certificates/**",
                
                
                "/emission/**",
                "/en/emission/**",
                "/signin/**",
                "/en/signin/**",
                "/actuator/**",
                "/api/monitoring/**",
                "/en/api/monitoring/**",
                "/api/menu/**",
                "/en/api/menu/**",
                "/api/runtime/project-info",
                "/api/runtime/info",
                "/api/platform/**",
                "/en/api/platform/**",
                "/admin/api/**",
                "/en/admin/api/**",
                "/error/**",
                "/favicon.ico",
                "/*.html",
                "/css/**",
                "/js/**",
                "/images/**",
                "/webjars/**",
                "/join/**",
                "/en/join/**"
            )
            .authorizeHttpRequests(authorize -> authorize
                .anyRequest().permitAll()
            )
            .csrf(csrf -> csrf.disable())
            .build();
    }
}
