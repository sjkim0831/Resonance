package egovframework.com.framework.web;

import org.slf4j.Logger;
import org.springframework.http.ResponseEntity;

import java.util.LinkedHashMap;
import java.util.Map;

public final class FrameworkApiResponseSupport {

    private FrameworkApiResponseSupport() {
    }

    public static ResponseEntity<?> execute(FrameworkApiAction action, String failureMessage, Logger log) {
        try {
            return ResponseEntity.ok(action.run());
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(errorBody(e.getMessage()));
        } catch (Exception e) {
            if (log != null) {
                log.error(failureMessage, e);
            }
            return ResponseEntity.internalServerError().body(errorBody(failureMessage));
        }
    }

    public static Map<String, Object> errorBody(String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("success", false);
        body.put("message", message == null ? "" : message);
        return body;
    }

    @FunctionalInterface
    public interface FrameworkApiAction {
        Object run() throws Exception;
    }
}
