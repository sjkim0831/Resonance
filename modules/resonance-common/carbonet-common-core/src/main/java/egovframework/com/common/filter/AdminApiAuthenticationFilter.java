package egovframework.com.common.filter;

import egovframework.com.feature.auth.util.JwtTokenProvider;
import org.springframework.util.ObjectUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

public class AdminApiAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider jwtTokenProvider;

    public AdminApiAuthenticationFilter(JwtTokenProvider jwtTokenProvider) {
        this.jwtTokenProvider = jwtTokenProvider;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request == null ? "" : safeString(request.getRequestURI());
        return !(path.startsWith("/api/admin/")
                || path.startsWith("/en/api/admin/")
                || path.startsWith("/admin/api/admin/")
                || path.startsWith("/en/admin/api/admin/"));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String accessToken = jwtTokenProvider.getCookie(request, "accessToken");
        if (ObjectUtils.isEmpty(accessToken) || jwtTokenProvider.accessValidateToken(accessToken) != 200) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setCharacterEncoding(StandardCharsets.UTF_8.name());
            response.setContentType("application/json;charset=UTF-8");
            response.getWriter().write("{\"status\":401,\"message\":\"Unauthorized\"}");
            return;
        }
        filterChain.doFilter(request, response);
    }

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }
}
