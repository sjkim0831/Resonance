package egovframework.com.platform.service.observability;

import egovframework.com.common.audit.AuditEventRecordVO;
import egovframework.com.common.audit.AuditEventSearchVO;

import java.util.List;

public interface PlatformObservabilityAuditQueryPort {

    List<AuditEventRecordVO> selectAuditEventList(AuditEventSearchVO searchVO);
}
