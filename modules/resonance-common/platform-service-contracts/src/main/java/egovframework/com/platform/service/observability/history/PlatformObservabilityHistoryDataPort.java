package egovframework.com.platform.service.observability.history;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;

public interface PlatformObservabilityHistoryDataPort {

    LoginHistoryDatasetSnapshot loadBlockedLoginHistoryDataset(String searchKeyword, String userSe, String requestedInsttId,
                                                              HttpServletRequest request);

    Map<String, Object> buildLoginHistoryPagePayload(String pageIndexParam, String searchKeyword, String userSe,
                                                     String loginResult, String insttId, HttpServletRequest request,
                                                     boolean isEn);
}
