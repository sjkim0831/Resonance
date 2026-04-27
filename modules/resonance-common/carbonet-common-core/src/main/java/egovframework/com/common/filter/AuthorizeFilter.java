package egovframework.com.common.filter;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import org.springframework.util.ObjectUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

@Component
@Slf4j
public class AuthorizeFilter extends OncePerRequestFilter {

    @Value("${security.gateway.code-id:}")
    private String configuredCodeId;

    @Value("${security.gateway.enabled:false}")
    private boolean gatewayGuardEnabled;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain) throws ServletException, IOException {
        String uri = request.getRequestURI();
        if (isPublicPath(uri)) {
            filterChain.doFilter(request, response);
            return;
        }
        if (!gatewayGuardEnabled) {
            filterChain.doFilter(request, response);
            return;
        }

        String requestCodeId = request.getHeader("X-CODE-ID");
        String secretCode = configuredCodeId == null ? "" : configuredCodeId.trim();
        if (secretCode.isEmpty()) {
            log.error("##### Access Denied: security.gateway.code-id is not configured. uri={}", uri);
            response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"status\":503,\"message\":\"Security guard misconfigured\"}");
            return;
        }
        if (ObjectUtils.isEmpty(requestCodeId) || !equalsConstantTime(secretCode, requestCodeId)) {
            log.warn("##### Access Denied: Unauthorized Access Attempt uri={}", uri);
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"status\":403,\"message\":\"Forbidden\"}");
            return;
        }

        filterChain.doFilter(request, response);
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return path.matches(".*\\.(css|js|png|jpg|jpeg|gif|svg|woff|woff2|ttf|otf|eot|ico|html)$") ||
                isPublicPath(path);
    }

    private boolean isPublicPath(String path) {
        return "/".equals(path) ||
                path.startsWith("/error") ||
                path.startsWith("/actuator/health") ||
                path.startsWith("/actuator/info") ||
                path.startsWith("/admin/login") ||
                path.startsWith("/en/admin/login") ||
                path.startsWith("/admin/assets/react/") ||
                path.startsWith("/en/admin/assets/react/") ||
                path.startsWith("/signin") ||
                path.startsWith("/en/signin") ||
                "/home".equals(path) ||
                path.startsWith("/home/") ||
                path.startsWith("/en/home") ||
                path.startsWith("/mypage") ||
                path.startsWith("/actuator") ||
                path.startsWith("/join") ||
                path.startsWith("/en/join");
    }

    private boolean equalsConstantTime(String expected, String actual) {
        byte[] expectedBytes = expected.getBytes(StandardCharsets.UTF_8);
        byte[] actualBytes = (actual == null ? "" : actual).getBytes(StandardCharsets.UTF_8);
        return MessageDigest.isEqual(expectedBytes, actualBytes);
    }

}
