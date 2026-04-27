package egovframework.com.platform.service.observability;

import java.util.Map;

public interface BatchManagementPagePayloadPort {

    Map<String, Object> buildBatchManagementPagePayload(boolean isEn);
}
