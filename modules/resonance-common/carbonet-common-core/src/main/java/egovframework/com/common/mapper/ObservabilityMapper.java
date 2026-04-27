package egovframework.com.common.mapper;

import egovframework.com.common.audit.AuditEvent;
import egovframework.com.common.logging.AccessEventRecordVO;
import egovframework.com.common.mapper.support.BaseMapperSupport;
import egovframework.com.common.trace.TraceEventRecordVO;
import egovframework.com.common.error.ErrorEventRecordVO;
import org.springframework.stereotype.Component;

@Component("observabilityMapper")
public class ObservabilityMapper extends BaseMapperSupport {

    public void insertAuditEvent(AuditEvent auditEvent) {
        insert("ObservabilityMapper.insertAuditEvent", auditEvent);
    }

    public void insertTraceEvent(TraceEventRecordVO traceEventRecordVO) {
        insert("ObservabilityMapper.insertTraceEvent", traceEventRecordVO);
    }

    public void insertAccessEvent(AccessEventRecordVO accessEventRecordVO) {
        insert("ObservabilityMapper.insertAccessEvent", accessEventRecordVO);
    }

    public void insertErrorEvent(ErrorEventRecordVO errorEventRecordVO) {
        insert("ObservabilityMapper.insertErrorEvent", errorEventRecordVO);
    }
}
