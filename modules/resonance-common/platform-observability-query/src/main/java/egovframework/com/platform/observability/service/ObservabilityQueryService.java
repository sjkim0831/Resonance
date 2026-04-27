package egovframework.com.platform.observability.service;

import egovframework.com.common.audit.AuditEventRecordVO;
import egovframework.com.common.audit.AuditEventSearchVO;
import egovframework.com.common.error.ErrorEventRecordVO;
import egovframework.com.common.error.ErrorEventSearchVO;
import egovframework.com.common.logging.AccessEventRecordVO;
import egovframework.com.common.logging.AccessEventSearchVO;
import egovframework.com.common.trace.TraceEventRecordVO;
import egovframework.com.common.trace.TraceEventSearchVO;
import egovframework.com.feature.admin.dto.request.AdminUnifiedLogSearchRequestDTO;
import egovframework.com.feature.admin.dto.response.AdminUnifiedLogRowResponse;

import java.util.List;

public interface ObservabilityQueryService {

    int selectAuditEventCount(AuditEventSearchVO searchVO);

    List<AuditEventRecordVO> selectAuditEventList(AuditEventSearchVO searchVO);

    int selectTraceEventCount(TraceEventSearchVO searchVO);

    List<TraceEventRecordVO> selectTraceEventList(TraceEventSearchVO searchVO);

    int selectAccessEventCount(AccessEventSearchVO searchVO);

    List<AccessEventRecordVO> selectAccessEventList(AccessEventSearchVO searchVO);

    int selectErrorEventCount(ErrorEventSearchVO searchVO);

    List<ErrorEventRecordVO> selectErrorEventList(ErrorEventSearchVO searchVO);

    int selectUnifiedLogCount(AdminUnifiedLogSearchRequestDTO searchDTO);

    List<AdminUnifiedLogRowResponse> selectUnifiedLogList(AdminUnifiedLogSearchRequestDTO searchDTO);
}
