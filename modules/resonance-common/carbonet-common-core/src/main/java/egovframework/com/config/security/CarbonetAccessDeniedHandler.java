package egovframework.com.config.security;

import org.egovframe.boot.security.EgovSecurityProperties;
import org.egovframe.boot.security.bean.EgovAccessDeniedHandler;
import org.springframework.http.MediaType;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.web.csrf.InvalidCsrfTokenException;
import org.springframework.security.web.csrf.MissingCsrfTokenException;

import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;

/**
 * Avoid double-forward failures for CSRF-denied JSON requests such as admin login.
 */
public class CarbonetAccessDeniedHandler extends EgovAccessDeniedHandler {

    private final String accessDeniedUrl;
    private final String csrfAccessDeniedUrl;

    public CarbonetAccessDeniedHandler(EgovSecurityProperties properties) {
        super(properties);
        this.accessDeniedUrl = safeString(properties == null ? "" : properties.getAccessDeniedUrl());
        this.csrfAccessDeniedUrl = safeString(properties == null ? "" : properties.getCsrfAccessDeniedUrl());
    }

    @Override
    public void handle(HttpServletRequest request,
                       HttpServletResponse response,
                       AccessDeniedException accessDeniedException) throws IOException, ServletException {
        if (response.isCommitted()) {
            return;
        }

        if (isApiRequest(request)) {
            writeApiResponse(response, isCsrfException(accessDeniedException));
            return;
        }

        String target = isCsrfException(accessDeniedException) ? csrfAccessDeniedUrl : accessDeniedUrl;
        if (target.isEmpty()) {
            response.sendError(HttpServletResponse.SC_FORBIDDEN);
            return;
        }

        RequestDispatcher dispatcher = request.getRequestDispatcher(target);
        dispatcher.forward(request, response);
    }

    private boolean isApiRequest(HttpServletRequest request) {
        if (request == null) {
            return false;
        }
        String accept = safeString(request.getHeader("Accept"));
        if (accept.contains(MediaType.APPLICATION_JSON_VALUE)) {
            return true;
        }
        String contentType = safeString(request.getContentType());
        if (contentType.contains(MediaType.APPLICATION_JSON_VALUE)) {
            return true;
        }
        String requestedWith = safeString(request.getHeader("X-Requested-With"));
        if ("XMLHttpRequest".equalsIgnoreCase(requestedWith)) {
            return true;
        }
        String uri = safeString(request.getRequestURI());
        return uri.startsWith("/api/")
                || uri.contains("/api/")
                || uri.endsWith("/actionLogin")
                || uri.endsWith("/validateRefreshToken")
                || uri.endsWith("/recreateAccessToken")
                || uri.endsWith("/resetPassword")
                || uri.endsWith("/reload");
    }

    private boolean isCsrfException(AccessDeniedException exception) {
        return exception instanceof InvalidCsrfTokenException
                || exception instanceof MissingCsrfTokenException;
    }

    private void writeApiResponse(HttpServletResponse response, boolean csrfDenied) throws IOException {
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        response.setCharacterEncoding("UTF-8");
        if (csrfDenied) {
            response.getWriter().write("{\"status\":\"forbidden\",\"reason\":\"csrf\",\"message\":\"CSRF token is missing or invalid.\"}");
            return;
        }
        response.getWriter().write("{\"status\":\"forbidden\",\"message\":\"Access denied.\"}");
    }

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }
}
