package egovframework.com.config.security;

import lombok.extern.slf4j.Slf4j;
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
@Slf4j
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
            log.warn("security.access-denied.committed uri={} method={} exception={}",
                    safeString(request == null ? "" : request.getRequestURI()),
                    safeString(request == null ? "" : request.getMethod()),
                    accessDeniedException == null ? "" : accessDeniedException.getClass().getSimpleName());
            return;
        }

        boolean csrfDenied = isCsrfException(accessDeniedException);
        boolean apiRequest = isApiRequest(request);
        log.warn("security.access-denied uri={} method={} csrf={} api={} session={} requestedWith={} accept={} contentType={} referer={} origin={} csrfHeaderPresent={} exception={}: {}",
                safeString(request == null ? "" : request.getRequestURI()),
                safeString(request == null ? "" : request.getMethod()),
                csrfDenied,
                apiRequest,
                safeString(request == null || request.getSession(false) == null ? "" : request.getSession(false).getId()),
                safeString(request == null ? "" : request.getHeader("X-Requested-With")),
                safeString(request == null ? "" : request.getHeader("Accept")),
                safeString(request == null ? "" : request.getContentType()),
                safeString(request == null ? "" : request.getHeader("Referer")),
                safeString(request == null ? "" : request.getHeader("Origin")),
                hasCsrfHeader(request),
                accessDeniedException == null ? "" : accessDeniedException.getClass().getSimpleName(),
                safeString(accessDeniedException == null ? "" : accessDeniedException.getMessage()));

        if (apiRequest) {
            writeApiResponse(response, csrfDenied);
            return;
        }

        String target = csrfDenied ? csrfAccessDeniedUrl : accessDeniedUrl;
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

    private boolean hasCsrfHeader(HttpServletRequest request) {
        if (request == null) {
            return false;
        }
        return !safeString(request.getHeader("X-CSRF-TOKEN")).isEmpty()
                || !safeString(request.getHeader("X-XSRF-TOKEN")).isEmpty()
                || !safeString(request.getHeader("X-CSRFToken")).isEmpty();
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
