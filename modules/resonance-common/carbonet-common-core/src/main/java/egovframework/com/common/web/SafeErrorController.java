package egovframework.com.common.web;

import egovframework.com.common.error.ErrorEventService;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.web.servlet.error.ErrorController;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.RequestMapping;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import jakarta.servlet.RequestDispatcher;
import jakarta.servlet.http.HttpServletRequest;
import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.LinkedHashMap;
import java.util.Map;

@Controller
@RequiredArgsConstructor
public class SafeErrorController implements ErrorController {

    private static final Logger log = LoggerFactory.getLogger(SafeErrorController.class);
    private final ErrorEventService errorEventService;

    @RequestMapping("/error")
    public Object handleError(HttpServletRequest request) {
        int status = resolveStatus(request);
        String path = safeString(request == null ? null : request.getAttribute(RequestDispatcher.ERROR_REQUEST_URI));
        Throwable ex = request == null ? null : (Throwable) request.getAttribute(RequestDispatcher.ERROR_EXCEPTION);
        String errorMessage = safeString(request == null ? null : request.getAttribute(RequestDispatcher.ERROR_MESSAGE));

        if (ex != null) {
            log.error("Error dispatch for path={}, status={}", path, status, ex);
        } else if (!errorMessage.isEmpty()) {
            log.error("Error dispatch for path={}, status={}, message={}", path, status, errorMessage);
        } else {
            log.error("Error dispatch for path={}, status={} with no exception attached", path, status);
        }
        errorEventService.recordBackendError(
                "BACKEND_ERROR_CONTROLLER",
                ex == null ? "ERROR_DISPATCH" : ex.getClass().getSimpleName(),
                request,
                "",
                "",
                safeString(request == null ? null : request.getAttribute("targetCompanyContextId")),
                status,
                ex,
                errorMessage
        );

        if (isApiRequest(request, path)) {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("status", "error");
            body.put("message", "An unexpected error occurred while processing this request.");
            body.put("path", path.isEmpty() ? "/" : path);
            body.put("timestamp", OffsetDateTime.now().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME));
            return ResponseEntity.status(status)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(body);
        }

        String html = buildHtml(status, path);
        return ResponseEntity.status(status)
                .contentType(MediaType.TEXT_HTML)
                .body(html);
    }

    private int resolveStatus(HttpServletRequest request) {
        if (request == null) {
            return HttpStatus.INTERNAL_SERVER_ERROR.value();
        }
        Object status = request.getAttribute(RequestDispatcher.ERROR_STATUS_CODE);
        if (status == null) {
            return HttpStatus.INTERNAL_SERVER_ERROR.value();
        }
        try {
            return Integer.parseInt(status.toString());
        } catch (NumberFormatException ignored) {
            return HttpStatus.INTERNAL_SERVER_ERROR.value();
        }
    }

    private boolean isApiRequest(HttpServletRequest request, String uri) {
        if (request == null) {
            return uri != null && uri.startsWith("/api/");
        }
        String accept = request.getHeader("Accept");
        if (accept != null && accept.contains("application/json")) {
            return true;
        }
        String contentType = request.getContentType();
        if (contentType != null && contentType.contains("application/json")) {
            return true;
        }
        String requestedWith = request.getHeader("X-Requested-With");
        if ("XMLHttpRequest".equalsIgnoreCase(requestedWith)) {
            return true;
        }
        if (uri == null) {
            return false;
        }
        return uri.startsWith("/api/")
                || uri.contains("/api/")
                || uri.endsWith(".json")
                || uri.endsWith("/actionLogin")
                || uri.endsWith("/validateRefreshToken")
                || uri.endsWith("/recreateAccessToken")
                || uri.endsWith("/resetPassword")
                || uri.endsWith("/reload");
    }

    private String buildHtml(int status, String path) {
        String safePath = path == null || path.isEmpty() ? "/" : path;
        String safeStatus = String.valueOf(status);
        String timestamp = OffsetDateTime.now().format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);
        return "<!DOCTYPE html>\n"
                + "<html lang=\"en\">\n"
                + "<head>\n"
                + "  <meta charset=\"UTF-8\" />\n"
                + "  <meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\" />\n"
                + "  <title>Page Error</title>\n"
                + "  <style>\n"
                + "    body { margin: 0; font-family: Arial, sans-serif; background: #f8fafc; color: #111827; }\n"
                + "    .wrap { max-width: 760px; margin: 24px auto; padding: 20px; }\n"
                + "    .card { background: #ffffff; border: 1px solid #e5e7eb; border-radius: 10px; padding: 18px; }\n"
                + "    .title { margin: 0 0 10px; font-size: 18px; font-weight: 700; color: #991b1b; }\n"
                + "    .meta { margin: 6px 0 0; font-size: 13px; color: #4b5563; }\n"
                + "    .hint { margin-top: 14px; font-size: 13px; color: #1f2937; }\n"
                + "  </style>\n"
                + "</head>\n"
                + "<body>\n"
                + "<div class=\"wrap\">\n"
                + "  <div class=\"card\">\n"
                + "    <h1 class=\"title\">Page Error</h1>\n"
                + "    <p>An unexpected error occurred while processing this page.</p>\n"
                + "    <p class=\"meta\">Status: " + safeStatus + "</p>\n"
                + "    <p class=\"meta\">Path: " + escapeHtml(safePath) + "</p>\n"
                + "    <p class=\"meta\">Time: " + escapeHtml(timestamp) + "</p>\n"
                + "    <p class=\"hint\">The main system is still available. Please try again later or return to a different page.</p>\n"
                + "  </div>\n"
                + "</div>\n"
                + "</body>\n"
                + "</html>\n";
    }

    private String safeString(Object value) {
        return value == null ? "" : value.toString().trim();
    }

    private String escapeHtml(String input) {
        if (input == null || input.isEmpty()) {
            return "";
        }
        return input.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
