package egovframework.com.platform.observability.service;

import egovframework.com.platform.codex.service.AdminMemberPagePayloadService;
import egovframework.com.platform.service.observability.AdminMemberPagePayloadPort;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Locale;
import java.util.Map;

@Service
public class AdminMemberPagePayloadPortBridge implements AdminMemberPagePayloadPort {

    private final AdminMemberPagePayloadService delegate;

    public AdminMemberPagePayloadPortBridge(AdminMemberPagePayloadService delegate) {
        this.delegate = delegate;
    }

    @Override
    public Map<String, Object> buildMemberListPagePayload(String pageIndex, String searchCondition, String searchKeyword,
                                                          String emplyrSttusCode, HttpServletRequest request, Locale locale) {
        return delegate.buildMemberListPagePayload(pageIndex, searchCondition, searchKeyword, emplyrSttusCode, request, locale);
    }

    @Override
    public Map<String, Object> buildCompanyListPagePayload(String pageIndex, String searchKeyword, String emplyrSttusCode,
                                                           HttpServletRequest request, Locale locale) {
        return delegate.buildCompanyListPagePayload(pageIndex, searchKeyword, emplyrSttusCode, request, locale);
    }
}
