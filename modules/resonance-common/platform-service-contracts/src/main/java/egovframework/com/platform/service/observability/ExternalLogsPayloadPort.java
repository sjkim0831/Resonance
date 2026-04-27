package egovframework.com.platform.service.observability;

import java.util.Map;

public interface ExternalLogsPayloadPort {

    Map<String, Object> buildExternalLogsPagePayload(boolean isEn);
}
