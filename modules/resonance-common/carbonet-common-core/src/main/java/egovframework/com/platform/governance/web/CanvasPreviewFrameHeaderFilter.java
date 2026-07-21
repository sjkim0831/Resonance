package egovframework.com.platform.governance.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpServletResponseWrapper;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Locale;

/**
 * Allows authenticated admin pages to be embedded only by the same origin and
 * only when the professional design canvas explicitly requests a preview.
 * Normal pages retain their existing clickjacking policy.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 20)
public class CanvasPreviewFrameHeaderFilter extends OncePerRequestFilter {
    private static final String FRAME_OPTIONS = "X-Frame-Options";
    private static final String CSP = "Content-Security-Policy";

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        return !request.getRequestURI().startsWith("/admin/")
            || !"1".equals(request.getParameter("canvasPreview"));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
        throws ServletException, IOException {
        HttpServletResponseWrapper safeResponse = new HttpServletResponseWrapper(response) {
            @Override public void setHeader(String name, String value) {
                super.setHeader(name, safeHeader(name, value));
            }
            @Override public void addHeader(String name, String value) {
                if (FRAME_OPTIONS.equalsIgnoreCase(name)) super.setHeader(FRAME_OPTIONS, "SAMEORIGIN");
                else if (CSP.equalsIgnoreCase(name)) super.setHeader(CSP, sameOriginCsp(value));
                else super.addHeader(name, value);
            }
        };
        safeResponse.setHeader(FRAME_OPTIONS, "SAMEORIGIN");
        chain.doFilter(request, safeResponse);
    }

    private static String safeHeader(String name, String value) {
        if (FRAME_OPTIONS.equalsIgnoreCase(name)) return "SAMEORIGIN";
        if (CSP.equalsIgnoreCase(name)) return sameOriginCsp(value);
        return value;
    }

    private static String sameOriginCsp(String value) {
        String source = value == null ? "" : value.trim();
        String[] directives = source.split(";");
        StringBuilder result = new StringBuilder();
        boolean replaced = false;
        for (String directive : directives) {
            String item = directive.trim();
            if (item.isEmpty()) continue;
            if (item.toLowerCase(Locale.ROOT).startsWith("frame-ancestors")) {
                item = "frame-ancestors 'self'";
                replaced = true;
            }
            if (!result.isEmpty()) result.append("; ");
            result.append(item);
        }
        if (!replaced) {
            if (!result.isEmpty()) result.append("; ");
            result.append("frame-ancestors 'self'");
        }
        return result.toString();
    }
}
