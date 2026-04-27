package egovframework.com.platform.service.observability;

import java.util.Map;

public interface ExternalSyncPayloadPort {

    Map<String, Object> buildExternalSyncPagePayload(boolean isEn);
}
