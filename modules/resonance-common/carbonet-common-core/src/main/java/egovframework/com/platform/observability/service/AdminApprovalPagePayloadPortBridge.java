package egovframework.com.platform.observability.service;

import egovframework.com.platform.codex.service.AdminApprovalPagePayloadService;
import egovframework.com.platform.service.observability.AdminApprovalPagePayloadPort;
import org.springframework.stereotype.Service;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Locale;
import java.util.Map;

@Service
public class AdminApprovalPagePayloadPortBridge implements AdminApprovalPagePayloadPort {

    private final AdminApprovalPagePayloadService delegate;

    public AdminApprovalPagePayloadPortBridge(AdminApprovalPagePayloadService delegate) {
        this.delegate = delegate;
    }

    @Override
    public Map<String, Object> buildMemberApprovePagePayload(String pageIndex, String searchKeyword, String searchCondition,
                                                             String reqStatus, String searchUseAt,
                                                             HttpServletRequest request, Locale locale) {
        return delegate.buildMemberApprovePagePayload(pageIndex, searchKeyword, searchCondition, reqStatus, searchUseAt, request, locale);
    }

    @Override
    public Map<String, Object> buildCompanyApprovePagePayload(String pageIndex, String searchKeyword, String reqStatus,
                                                              String searchUseAt, HttpServletRequest request, Locale locale) {
        return delegate.buildCompanyApprovePagePayload(pageIndex, searchKeyword, reqStatus, searchUseAt, request, locale);
    }
}
