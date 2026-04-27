package egovframework.com.platform.service.observability;

import java.util.Map;

public interface CertificateAuditLogPageDataPort {

    Map<String, Object> buildCertificateAuditLogPageData(String pageIndexParam, String searchKeyword, String auditType,
                                                         String status, String certificateType, String startDate,
                                                         String endDate, boolean isEn);
}
