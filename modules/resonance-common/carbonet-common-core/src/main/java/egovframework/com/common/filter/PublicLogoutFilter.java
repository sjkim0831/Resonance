package egovframework.com.common.filter;

import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.nio.charset.StandardCharsets;

public class PublicLogoutFilter extends OncePerRequestFilter {

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String uri = request.getRequestURI();
        if (!"POST".equalsIgnoreCase(request.getMethod())) {
            return true;
        }
        return !(
                "/signin/actionLogout".equals(uri)
                        || "/admin/login/actionLogout".equals(uri)
                        || "/en/admin/login/actionLogout".equals(uri)
        );
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        response.addHeader(HttpHeaders.SET_COOKIE, expireCookie("accessToken"));
        response.addHeader(HttpHeaders.SET_COOKIE, expireCookie("refreshToken"));
        response.setStatus(HttpServletResponse.SC_OK);
        response.setContentType("application/json;charset=UTF-8");
        response.getOutputStream().write("{\"status\":\"success\",\"error\":\"\"}".getBytes(StandardCharsets.UTF_8));
        response.flushBuffer();
    }

    private String expireCookie(String name) {
        return ResponseCookie.from(name, "")
                .httpOnly(true)
                .path("/")
                .maxAge(0)
                .build()
                .toString();
    }
}
