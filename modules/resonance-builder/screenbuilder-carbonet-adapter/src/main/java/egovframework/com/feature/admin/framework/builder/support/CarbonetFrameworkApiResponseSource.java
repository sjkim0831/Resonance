package egovframework.com.feature.admin.framework.builder.support;

import org.slf4j.Logger;
import org.springframework.http.ResponseEntity;

public interface CarbonetFrameworkApiResponseSource {

    ResponseEntity<?> execute(ApiAction action, String failureMessage, Logger log);

    @FunctionalInterface
    interface ApiAction {
        Object run() throws Exception;
    }
}
