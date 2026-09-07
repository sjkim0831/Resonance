package egovframework.com.common.filter;

import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;

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
        // Logout is stateful: the authoritative controller must revoke the
        // persisted access/refresh-token row before returning success. This
        // public filter only preserves the early route exception and must not
        // synthesize a cookie-only response.
        filterChain.doFilter(request, response);
    }
}
