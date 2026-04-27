package egovframework.com.platform.service.observability;

import java.util.Map;

public interface ExternalKeysPayloadPort {

    Map<String, Object> buildExternalKeysPagePayload(boolean isEn);
}
