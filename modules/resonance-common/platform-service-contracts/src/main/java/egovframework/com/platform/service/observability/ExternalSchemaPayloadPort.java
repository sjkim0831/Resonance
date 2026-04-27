package egovframework.com.platform.service.observability;

import java.util.Map;

public interface ExternalSchemaPayloadPort {

    Map<String, Object> buildExternalSchemaPagePayload(boolean isEn);
}
