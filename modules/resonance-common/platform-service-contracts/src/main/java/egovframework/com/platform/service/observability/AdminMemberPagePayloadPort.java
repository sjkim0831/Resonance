package egovframework.com.platform.service.observability;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Locale;
import java.util.Map;

public interface AdminMemberPagePayloadPort {

    Map<String, Object> buildMemberListPagePayload(String pageIndex, String searchCondition, String searchKeyword,
                                                   String emplyrSttusCode, HttpServletRequest request, Locale locale);

    Map<String, Object> buildCompanyListPagePayload(String pageIndex, String searchKeyword, String emplyrSttusCode,
                                                    HttpServletRequest request, Locale locale);
}
