package egovframework.com.platform.service.observability;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Locale;
import java.util.Map;

public interface AdminApprovalPagePayloadPort {

    Map<String, Object> buildMemberApprovePagePayload(String pageIndex, String searchKeyword, String searchCondition,
                                                      String reqStatus, String searchUseAt,
                                                      HttpServletRequest request, Locale locale);

    Map<String, Object> buildCompanyApprovePagePayload(String pageIndex, String searchKeyword, String reqStatus,
                                                       String searchUseAt, HttpServletRequest request, Locale locale);
}
