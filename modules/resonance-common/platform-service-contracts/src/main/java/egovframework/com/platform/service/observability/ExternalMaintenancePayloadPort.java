package egovframework.com.platform.service.observability;

import java.util.Map;

public interface ExternalMaintenancePayloadPort {

    Map<String, Object> buildExternalMaintenancePagePayload(boolean isEn);
}
