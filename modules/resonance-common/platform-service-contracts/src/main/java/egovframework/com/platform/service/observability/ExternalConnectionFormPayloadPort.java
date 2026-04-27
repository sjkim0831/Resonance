package egovframework.com.platform.service.observability;

import java.util.Map;

public interface ExternalConnectionFormPayloadPort {

    Map<String, Object> buildExternalConnectionFormPagePayload(String mode, String connectionId, boolean isEn);
}
