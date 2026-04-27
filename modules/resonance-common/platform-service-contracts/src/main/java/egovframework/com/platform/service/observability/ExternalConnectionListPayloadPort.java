package egovframework.com.platform.service.observability;

import java.util.Map;

public interface ExternalConnectionListPayloadPort {

    Map<String, Object> buildExternalConnectionListPagePayload(boolean isEn);
}
