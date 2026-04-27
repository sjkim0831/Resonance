package egovframework.com.platform.observability.mapper;

import egovframework.com.common.audit.AuditEventRecordVO;
import egovframework.com.common.audit.AuditEventSearchVO;
import egovframework.com.common.error.ErrorEventRecordVO;
import egovframework.com.common.error.ErrorEventSearchVO;
import egovframework.com.common.logging.AccessEventRecordVO;
import egovframework.com.common.logging.AccessEventSearchVO;
import egovframework.com.common.mapper.support.BaseMapperSupport;
import egovframework.com.common.trace.TraceEventRecordVO;
import egovframework.com.common.trace.TraceEventSearchVO;
import org.springframework.stereotype.Component;

import java.util.List;

@Component("platformObservabilityQueryMapper")
public class PlatformObservabilityQueryMapper extends BaseMapperSupport {

    public int selectAuditEventCount(AuditEventSearchVO searchVO) {
        Integer count = selectOne("PlatformObservabilityQueryMapper.selectAuditEventCount", searchVO);
        return count == null ? 0 : count;
    }

    public List<AuditEventRecordVO> selectAuditEventList(AuditEventSearchVO searchVO) {
        return selectList("PlatformObservabilityQueryMapper.selectAuditEventList", searchVO);
    }

    public List<AuditEventRecordVO> selectAuditEventListCompact(AuditEventSearchVO searchVO) {
        return selectList("PlatformObservabilityQueryMapper.selectAuditEventListCompact", searchVO);
    }

    public int selectTraceEventCount(TraceEventSearchVO searchVO) {
        Integer count = selectOne("PlatformObservabilityQueryMapper.selectTraceEventCount", searchVO);
        return count == null ? 0 : count;
    }

    public List<TraceEventRecordVO> selectTraceEventList(TraceEventSearchVO searchVO) {
        return selectList("PlatformObservabilityQueryMapper.selectTraceEventList", searchVO);
    }

    public List<TraceEventRecordVO> selectTraceEventListCompact(TraceEventSearchVO searchVO) {
        return selectList("PlatformObservabilityQueryMapper.selectTraceEventListCompact", searchVO);
    }

    public int selectAccessEventCount(AccessEventSearchVO searchVO) {
        Integer count = selectOne("PlatformObservabilityQueryMapper.selectAccessEventCount", searchVO);
        return count == null ? 0 : count;
    }

    public List<AccessEventRecordVO> selectAccessEventList(AccessEventSearchVO searchVO) {
        return selectList("PlatformObservabilityQueryMapper.selectAccessEventList", searchVO);
    }

    public List<AccessEventRecordVO> selectAccessEventListCompact(AccessEventSearchVO searchVO) {
        return selectList("PlatformObservabilityQueryMapper.selectAccessEventListCompact", searchVO);
    }

    public int selectErrorEventCount(ErrorEventSearchVO searchVO) {
        Integer count = selectOne("PlatformObservabilityQueryMapper.selectErrorEventCount", searchVO);
        return count == null ? 0 : count;
    }

    public List<ErrorEventRecordVO> selectErrorEventList(ErrorEventSearchVO searchVO) {
        return selectList("PlatformObservabilityQueryMapper.selectErrorEventList", searchVO);
    }

    public List<ErrorEventRecordVO> selectErrorEventListCompact(ErrorEventSearchVO searchVO) {
        return selectList("PlatformObservabilityQueryMapper.selectErrorEventListCompact", searchVO);
    }
}
