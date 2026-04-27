package egovframework.com.common.web;

import egovframework.com.common.error.ErrorEventService;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.web.bind.annotation.ControllerAdvice;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.servlet.ModelAndView;

import jakarta.servlet.http.HttpServletRequest;
import java.util.LinkedHashMap;
import java.util.Map;

@ControllerAdvice(annotations = Controller.class)
@RequiredArgsConstructor
public class PageIsolationExceptionAdvice {

    private static final Logger log = LoggerFactory.getLogger(PageIsolationExceptionAdvice.class);
    private final ErrorEventService errorEventService;

    @ExceptionHandler(Exception.class)
    public Object handlePageException(Exception ex, HttpServletRequest request) {
        final String uri = request.getRequestURI();
        log.error("Page-level error isolated for uri={}", uri, ex);
        errorEventService.recordBackendError(
                "PAGE_EXCEPTION_ADVICE",
                ex == null ? "PAGE_EXCEPTION" : ex.getClass().getSimpleName(),
                request,
                "",
                "",
                safeString(request.getAttribute("targetCompanyContextId")),
                HttpStatus.INTERNAL_SERVER_ERROR.value(),
                ex,
                ex == null ? "" : ex.getMessage()
        );

        // API/AJAX endpoints should receive structured error without affecting main page runtime.
        if (isApiRequest(request, uri)) {
            Map<String, Object> body = new LinkedHashMap<>();
            body.put("status", "error");
            body.put("message", "페이지 처리 중 오류가 발생했습니다.");
            body.put("path", uri);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(body);
        }

        ModelAndView mv = new ModelAndView("egovframework/com/common/error/page_error");
        mv.setStatus(HttpStatus.INTERNAL_SERVER_ERROR);
        mv.addObject("errorPath", uri);
        mv.addObject("errorMessage", "요청한 페이지 처리 중 오류가 발생했습니다. 메인 화면은 계속 사용할 수 있습니다.");
        return mv;
    }

    private String safeString(Object value) {
        return value == null ? "" : value.toString().trim();
    }

    private boolean isApiRequest(HttpServletRequest request, String uri) {
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
                || uri.endsWith(".json")
                || uri.endsWith("/actionLogin")
                || uri.endsWith("/validateRefreshToken")
                || uri.endsWith("/recreateAccessToken")
                || uri.endsWith("/resetPassword")
                || uri.endsWith("/reload");
    }
}
