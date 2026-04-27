package egovframework.com.platform.service.observability;

import java.util.Map;

public interface ExternalConnectionSavePort {

    Map<String, Object> saveExternalConnection(Map<String, String> payload, boolean isEn);
}
