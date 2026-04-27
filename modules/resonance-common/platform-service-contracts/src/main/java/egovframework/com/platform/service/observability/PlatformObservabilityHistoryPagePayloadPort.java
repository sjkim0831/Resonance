package egovframework.com.platform.service.observability;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;

public interface PlatformObservabilityHistoryPagePayloadPort {

    Map<String, Object> buildSecurityHistoryPagePayload(String pageIndexParam, String searchKeyword, String userSe,
                                                        String insttId, String actionStatus,
                                                        HttpServletRequest request, boolean isEn);
}
