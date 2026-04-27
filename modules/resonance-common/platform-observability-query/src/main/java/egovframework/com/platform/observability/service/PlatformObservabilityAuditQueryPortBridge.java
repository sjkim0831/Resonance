package egovframework.com.platform.observability.service;

import egovframework.com.common.audit.AuditEventRecordVO;
import egovframework.com.common.audit.AuditEventSearchVO;
import egovframework.com.platform.service.observability.PlatformObservabilityAuditQueryPort;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class PlatformObservabilityAuditQueryPortBridge implements PlatformObservabilityAuditQueryPort {

    private final ObservabilityQueryService delegate;

    public PlatformObservabilityAuditQueryPortBridge(ObservabilityQueryService delegate) {
        this.delegate = delegate;
    }

    @Override
    public List<AuditEventRecordVO> selectAuditEventList(AuditEventSearchVO searchVO) {
        return delegate.selectAuditEventList(searchVO);
    }
}
