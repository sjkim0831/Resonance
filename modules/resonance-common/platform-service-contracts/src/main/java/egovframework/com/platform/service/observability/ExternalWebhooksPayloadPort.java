package egovframework.com.platform.service.observability;

import java.util.Map;

public interface ExternalWebhooksPayloadPort {

    Map<String, Object> buildExternalWebhooksPagePayload(String keyword, String syncMode, String status, boolean isEn);
}
