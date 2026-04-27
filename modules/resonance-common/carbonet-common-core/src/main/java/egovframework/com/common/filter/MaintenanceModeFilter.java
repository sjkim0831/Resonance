package egovframework.com.common.filter;

import egovframework.com.common.service.MaintenanceModeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.Map;

@RequiredArgsConstructor
public class MaintenanceModeFilter extends OncePerRequestFilter {

    private final MaintenanceModeService maintenanceModeService;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        if (!maintenanceModeService.isActive() || isExemptPath(request.getRequestURI())) {
            filterChain.doFilter(request, response);
            return;
        }

        response.setStatus(HttpServletResponse.SC_SERVICE_UNAVAILABLE);
        response.setHeader("Retry-After", "60");
        response.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");

        if (isApiRequest(request)) {
            response.setContentType(MediaType.APPLICATION_JSON_VALUE);
            response.setCharacterEncoding("UTF-8");
            Map<String, String> snapshot = maintenanceModeService.snapshot();
            response.getWriter().write("{"
                    + "\"status\":503,"
                    + "\"code\":\"MAINTENANCE_MODE\","
                    + "\"message\":\"System maintenance is in progress.\","
                    + "\"reason\":\"" + escapeJson(snapshot.get("reason")) + "\","
                    + "\"startedAt\":\"" + escapeJson(snapshot.get("startedAt")) + "\""
                    + "}");
            return;
        }

        response.setContentType(MediaType.TEXT_HTML_VALUE);
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write(buildMaintenanceHtml(maintenanceModeService.snapshot()));
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = safe(request.getRequestURI()).toLowerCase(Locale.ROOT);
        return path.isEmpty()
                || path.startsWith("/css/")
                || path.startsWith("/js/")
                || path.startsWith("/images/")
                || path.startsWith("/webjars/")
                || path.startsWith("/error")
                || path.startsWith("/actuator")
                || path.matches(".*\\.(css|js|png|jpg|jpeg|gif|svg|woff|woff2|ttf|otf|eot|ico|html)$");
    }

    private boolean isExemptPath(String uri) {
        String path = safe(uri);
        return path.startsWith("/admin/system/backup/run")
                || path.startsWith("/en/admin/system/backup/run");
    }

    private boolean isApiRequest(HttpServletRequest request) {
        String uri = safe(request.getRequestURI());
        String accept = safe(request.getHeader("Accept")).toLowerCase(Locale.ROOT);
        String contentType = safe(request.getContentType()).toLowerCase(Locale.ROOT);
        String requestedWith = safe(request.getHeader("X-Requested-With"));
        return uri.startsWith("/api/")
                || uri.contains("/api/")
                || accept.contains("application/json")
                || contentType.contains("application/json")
                || "XMLHttpRequest".equalsIgnoreCase(requestedWith);
    }

    private String buildMaintenanceHtml(Map<String, String> snapshot) {
        String startedAt = escapeHtml(snapshot.get("startedAt"));
        String reason = escapeHtml(snapshot.get("reason"));
        String timestamp = OffsetDateTime.now().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);
        return "<!DOCTYPE html>\n"
                + "<html lang=\"ko\">\n"
                + "<head>\n"
                + "  <meta charset=\"UTF-8\" />\n"
                + "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />\n"
                + "  <title>System Maintenance</title>\n"
                + "  <style>\n"
                + "    body { margin: 0; font-family: Arial, sans-serif; background: #f4f6f8; color: #111827; }\n"
                + "    .wrap { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 24px; }\n"
                + "    .card { width: 100%; max-width: 720px; background: #fff; border: 1px solid #d1d5db; border-radius: 14px; padding: 28px; box-shadow: 0 12px 40px rgba(17,24,39,0.08); }\n"
                + "    h1 { margin: 0 0 12px; font-size: 28px; color: #991b1b; }\n"
                + "    p { margin: 8px 0; line-height: 1.6; }\n"
                + "    .meta { color: #4b5563; font-size: 14px; }\n"
                + "  </style>\n"
                + "</head>\n"
                + "<body>\n"
                + "  <div class=\"wrap\">\n"
                + "    <div class=\"card\">\n"
                + "      <h1>시스템 점검 중입니다</h1>\n"
                + "      <p>데이터 복구 작업이 진행 중이어서 잠시 서비스 이용이 제한됩니다.</p>\n"
                + "      <p>Please wait a moment while the system restore is being completed.</p>\n"
                + "      <p class=\"meta\">Started: " + startedAt + "</p>\n"
                + "      <p class=\"meta\">Reason: " + reason + "</p>\n"
                + "      <p class=\"meta\">Time: " + escapeHtml(timestamp) + "</p>\n"
                + "    </div>\n"
                + "  </div>\n"
                + "</body>\n"
                + "</html>\n";
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private String escapeHtml(String value) {
        return safe(value)
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }

    private String escapeJson(String value) {
        return safe(value)
                .replace("\\", "\\\\")
                .replace("\"", "\\\"");
    }
}
