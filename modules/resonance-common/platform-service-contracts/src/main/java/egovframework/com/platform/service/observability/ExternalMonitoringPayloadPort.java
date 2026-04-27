package egovframework.com.platform.service.observability;

import java.util.Map;

public interface ExternalMonitoringPayloadPort {

    Map<String, Object> buildExternalMonitoringPagePayload(boolean isEn);
}
