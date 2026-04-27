package egovframework.com.platform.service.observability;

import java.util.Map;

public interface ExternalUsagePayloadPort {

    Map<String, Object> buildExternalUsagePagePayload(boolean isEn);
}
