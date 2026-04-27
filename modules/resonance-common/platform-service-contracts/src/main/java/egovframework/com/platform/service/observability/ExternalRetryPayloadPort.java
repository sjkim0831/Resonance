package egovframework.com.platform.service.observability;

import java.util.Map;

public interface ExternalRetryPayloadPort {

    Map<String, Object> buildExternalRetryPagePayload(boolean isEn);
}
