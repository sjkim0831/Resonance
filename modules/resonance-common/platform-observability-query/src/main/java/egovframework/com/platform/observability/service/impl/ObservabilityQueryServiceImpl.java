package egovframework.com.platform.observability.service.impl;

import egovframework.com.common.audit.AuditEventRecordVO;
import egovframework.com.common.audit.AuditEventSearchVO;
import egovframework.com.common.error.ErrorEventRecordVO;
import egovframework.com.common.error.ErrorEventSearchVO;
import egovframework.com.common.logging.AccessEventRecordVO;
import egovframework.com.common.logging.AccessEventSearchVO;
import egovframework.com.platform.observability.mapper.PlatformObservabilityQueryMapper;
import egovframework.com.platform.observability.service.ObservabilityQueryService;
import egovframework.com.common.trace.TraceEventRecordVO;
import egovframework.com.common.trace.TraceEventSearchVO;
import egovframework.com.feature.admin.dto.request.AdminUnifiedLogSearchRequestDTO;
import egovframework.com.feature.admin.dto.response.AdminUnifiedLogRowResponse;
import org.egovframe.rte.fdl.cmmn.EgovAbstractServiceImpl;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

@Service("observabilityQueryService")
public class ObservabilityQueryServiceImpl extends EgovAbstractServiceImpl implements ObservabilityQueryService {

    private static final Logger log = LoggerFactory.getLogger(ObservabilityQueryServiceImpl.class);

    private final PlatformObservabilityQueryMapper observabilityMapper;

    public ObservabilityQueryServiceImpl(PlatformObservabilityQueryMapper observabilityMapper) {
        this.observabilityMapper = observabilityMapper;
    }

    @Override
    public int selectAuditEventCount(AuditEventSearchVO searchVO) {
        return observabilityMapper.selectAuditEventCount(searchVO);
    }

    @Override
    public List<AuditEventRecordVO> selectAuditEventList(AuditEventSearchVO searchVO) {
        return loadAuditEventListSafely(searchVO);
    }

    @Override
    public int selectTraceEventCount(TraceEventSearchVO searchVO) {
        return observabilityMapper.selectTraceEventCount(searchVO);
    }

    @Override
    public List<TraceEventRecordVO> selectTraceEventList(TraceEventSearchVO searchVO) {
        return loadTraceEventListSafely(searchVO);
    }

    @Override
    public int selectAccessEventCount(AccessEventSearchVO searchVO) {
        return observabilityMapper.selectAccessEventCount(searchVO);
    }

    @Override
    public List<AccessEventRecordVO> selectAccessEventList(AccessEventSearchVO searchVO) {
        return loadAccessEventListSafely(searchVO);
    }

    @Override
    public int selectErrorEventCount(ErrorEventSearchVO searchVO) {
        return observabilityMapper.selectErrorEventCount(searchVO);
    }

    @Override
    public List<ErrorEventRecordVO> selectErrorEventList(ErrorEventSearchVO searchVO) {
        return loadErrorEventListSafely(searchVO);
    }

    @Override
    public int selectUnifiedLogCount(AdminUnifiedLogSearchRequestDTO searchDTO) {
        return loadUnifiedLogRows(searchDTO).size();
    }

    @Override
    public List<AdminUnifiedLogRowResponse> selectUnifiedLogList(AdminUnifiedLogSearchRequestDTO searchDTO) {
        List<AdminUnifiedLogRowResponse> rows = loadUnifiedLogRows(searchDTO);
        int pageIndex = Math.max(defaultInt(searchDTO.getPageIndex(), 1), 1);
        int pageSize = Math.max(defaultInt(searchDTO.getPageSize(), 10), 1);
        int fromIndex = Math.max(pageIndex - 1, 0) * pageSize;
        if (fromIndex >= rows.size()) {
            return new ArrayList<>();
        }
        int toIndex = Math.min(fromIndex + pageSize, rows.size());
        return new ArrayList<>(rows.subList(fromIndex, toIndex));
    }

    private List<AdminUnifiedLogRowResponse> loadUnifiedLogRows(AdminUnifiedLogSearchRequestDTO searchDTO) {
        List<AdminUnifiedLogRowResponse> rows = new ArrayList<>();
        if (includesLogType(searchDTO, "ACCESS")) {
            rows.addAll(mapAccessRows(searchDTO));
        }
        if (includesLogType(searchDTO, "AUDIT")) {
            rows.addAll(mapAuditRows(searchDTO));
        }
        if (includesLogType(searchDTO, "ERROR")) {
            rows.addAll(mapErrorRows(searchDTO));
        }
        if (includesLogType(searchDTO, "TRACE")) {
            rows.addAll(mapTraceRows(searchDTO));
        }
        rows.sort(Comparator.comparing(AdminUnifiedLogRowResponse::getOccurredAt, Comparator.nullsLast(String::compareTo)).reversed());
        return rows;
    }

    private boolean includesLogType(AdminUnifiedLogSearchRequestDTO searchDTO, String candidate) {
        String tab = safe(searchDTO.getTab()).toLowerCase(Locale.ROOT);
        String logType = safe(searchDTO.getLogType()).toUpperCase(Locale.ROOT);
        if (!logType.isEmpty()) {
            return matchesTokenList(logType, candidate);
        }
        switch (tab) {
            case "access-auth":
                return "ACCESS".equals(candidate);
            case "audit":
                return "AUDIT".equals(candidate);
            case "error":
                return "ERROR".equals(candidate);
            case "trace":
                return "TRACE".equals(candidate);
            default:
                return true;
        }
    }

    private List<AdminUnifiedLogRowResponse> mapAccessRows(AdminUnifiedLogSearchRequestDTO searchDTO) {
        AccessEventSearchVO searchVO = new AccessEventSearchVO();
        searchVO.setFirstIndex(0);
        searchVO.setRecordCountPerPage(resolveFetchWindow(searchDTO));
        searchVO.setProjectId(safe(searchDTO.getProjectId()));
        searchVO.setSearchKeyword(safe(searchDTO.getSearchKeyword()));
        searchVO.setInsttId(safe(searchDTO.getInsttId()));
        searchVO.setActorId(safe(searchDTO.getActorId()));
        searchVO.setPageId(safe(searchDTO.getPageId()));
        searchVO.setApiId(safe(searchDTO.getApiId()));
        searchVO.setFeatureType(safe(searchDTO.getDetailType()));
        List<AdminUnifiedLogRowResponse> rows = new ArrayList<>();
        for (AccessEventRecordVO item : observabilityMapper.selectAccessEventListCompact(searchVO)) {
            AdminUnifiedLogRowResponse row = new AdminUnifiedLogRowResponse();
            row.setLogId(item.getEventId());
            row.setLogType("ACCESS");
            row.setDetailType(safe(item.getFeatureType()));
            row.setProjectId(item.getProjectId());
            row.setOccurredAt(item.getCreatedAt());
            row.setResultCode(item.getResponseStatus() == null ? "" : String.valueOf(item.getResponseStatus()));
            row.setActorId(item.getActorId());
            row.setActorRole(item.getActorRole());
            row.setInsttId(item.getActorInsttId());
            row.setCompanyName("");
            row.setMemberType(safe(item.getActorType()));
            row.setPageId(item.getPageId());
            row.setApiId(item.getApiId());
            row.setTraceId(item.getTraceId());
            row.setRequestUri(item.getRequestUri());
            row.setRemoteAddr(item.getRemoteAddr());
            row.setDurationMs(item.getDurationMs());
            row.setSummary(item.getParameterSummary());
            row.setMessage(item.getCompanyScopeReason());
            row.setRawSourceType(item.getFeatureType());
            if (matchesUnifiedFilters(searchDTO, row)) {
                rows.add(row);
            }
        }
        return rows;
    }

    private List<AccessEventRecordVO> loadAccessEventListSafely(AccessEventSearchVO searchVO) {
        try {
            return observabilityMapper.selectAccessEventList(searchVO);
        } catch (Exception e) {
            log.warn("Access event list lookup failed with full payload. Retrying with compact projection. actorId={}, insttId={}, pageId={}, apiId={}, featureType={}",
                    safe(searchVO == null ? null : searchVO.getActorId()),
                    safe(searchVO == null ? null : searchVO.getInsttId()),
                    safe(searchVO == null ? null : searchVO.getPageId()),
                    safe(searchVO == null ? null : searchVO.getApiId()),
                    safe(searchVO == null ? null : searchVO.getFeatureType()),
                    e);
            return observabilityMapper.selectAccessEventListCompact(searchVO);
        }
    }

    private List<AdminUnifiedLogRowResponse> mapAuditRows(AdminUnifiedLogSearchRequestDTO searchDTO) {
        AuditEventSearchVO searchVO = new AuditEventSearchVO();
        searchVO.setFirstIndex(0);
        searchVO.setRecordCountPerPage(resolveFetchWindow(searchDTO));
        searchVO.setProjectId(safe(searchDTO.getProjectId()));
        searchVO.setTraceId(safe(searchDTO.getTraceId()));
        searchVO.setActorId(safe(searchDTO.getActorId()));
        searchVO.setActionCode(safe(searchDTO.getActionCode()));
        searchVO.setMenuCode(safe(searchDTO.getMenuCode()));
        searchVO.setPageId(safe(searchDTO.getPageId()));
        searchVO.setResultStatus(safe(searchDTO.getResultCode()));
        searchVO.setSearchKeyword(safe(searchDTO.getSearchKeyword()));
        List<AdminUnifiedLogRowResponse> rows = new ArrayList<>();
        for (AuditEventRecordVO item : observabilityMapper.selectAuditEventListCompact(searchVO)) {
            AdminUnifiedLogRowResponse row = new AdminUnifiedLogRowResponse();
            row.setLogId(item.getAuditId());
            row.setLogType("AUDIT");
            row.setDetailType(safe(item.getActionCode()));
            row.setProjectId(item.getProjectId());
            row.setOccurredAt(item.getCreatedAt());
            row.setResultCode(item.getResultStatus());
            row.setActorId(item.getActorId());
            row.setActorRole(item.getActorRole());
            row.setMenuCode(item.getMenuCode());
            row.setPageId(item.getPageId());
            row.setActionCode(item.getActionCode());
            row.setTargetType(item.getEntityType());
            row.setTargetId(item.getEntityId());
            row.setTraceId(item.getTraceId());
            row.setRequestUri(item.getRequestUri());
            row.setRemoteAddr(item.getIpAddress());
            row.setSummary(item.getReasonSummary());
            row.setMessage(item.getAfterSummaryJson());
            row.setRawSourceType(item.getHttpMethod());
            if (matchesUnifiedFilters(searchDTO, row)) {
                rows.add(row);
            }
        }
        return rows;
    }

    private List<AuditEventRecordVO> loadAuditEventListSafely(AuditEventSearchVO searchVO) {
        try {
            return observabilityMapper.selectAuditEventList(searchVO);
        } catch (Exception e) {
            log.warn("Audit event list lookup failed with full payload. Retrying with compact projection. traceId={}, actorId={}, actionCode={}, menuCode={}, pageId={}, resultStatus={}",
                    safe(searchVO == null ? null : searchVO.getTraceId()),
                    safe(searchVO == null ? null : searchVO.getActorId()),
                    safe(searchVO == null ? null : searchVO.getActionCode()),
                    safe(searchVO == null ? null : searchVO.getMenuCode()),
                    safe(searchVO == null ? null : searchVO.getPageId()),
                    safe(searchVO == null ? null : searchVO.getResultStatus()),
                    e);
            return observabilityMapper.selectAuditEventListCompact(searchVO);
        }
    }

    private List<AdminUnifiedLogRowResponse> mapErrorRows(AdminUnifiedLogSearchRequestDTO searchDTO) {
        ErrorEventSearchVO searchVO = new ErrorEventSearchVO();
        searchVO.setFirstIndex(0);
        searchVO.setRecordCountPerPage(resolveFetchWindow(searchDTO));
        searchVO.setProjectId(safe(searchDTO.getProjectId()));
        searchVO.setSearchKeyword(safe(searchDTO.getSearchKeyword()));
        searchVO.setSourceType(safe(searchDTO.getDetailType()));
        searchVO.setErrorType(safe(searchDTO.getDetailType()));
        searchVO.setResultStatus(safe(searchDTO.getResultCode()));
        searchVO.setActorId(safe(searchDTO.getActorId()));
        searchVO.setInsttId(safe(searchDTO.getInsttId()));
        searchVO.setPageId(safe(searchDTO.getPageId()));
        searchVO.setApiId(safe(searchDTO.getApiId()));
        List<AdminUnifiedLogRowResponse> rows = new ArrayList<>();
        for (ErrorEventRecordVO item : observabilityMapper.selectErrorEventListCompact(searchVO)) {
            AdminUnifiedLogRowResponse row = new AdminUnifiedLogRowResponse();
            row.setLogId(item.getErrorId());
            row.setLogType("ERROR");
            row.setDetailType(safe(item.getErrorType()));
            row.setProjectId(item.getProjectId());
            row.setOccurredAt(item.getCreatedAt());
            row.setResultCode(item.getResultStatus());
            row.setActorId(item.getActorId());
            row.setActorRole(item.getActorRole());
            row.setInsttId(item.getActorInsttId());
            row.setPageId(item.getPageId());
            row.setApiId(item.getApiId());
            row.setTraceId(item.getTraceId());
            row.setRequestUri(item.getRequestUri());
            row.setRemoteAddr(item.getRemoteAddr());
            row.setSummary(item.getMessage());
            row.setMessage(item.getStackSummary());
            row.setRawSourceType(item.getSourceType());
            if (matchesUnifiedFilters(searchDTO, row)) {
                rows.add(row);
            }
        }
        return rows;
    }

    private List<AdminUnifiedLogRowResponse> mapTraceRows(AdminUnifiedLogSearchRequestDTO searchDTO) {
        TraceEventSearchVO searchVO = new TraceEventSearchVO();
        searchVO.setFirstIndex(0);
        searchVO.setRecordCountPerPage(resolveFetchWindow(searchDTO));
        searchVO.setProjectId(safe(searchDTO.getProjectId()));
        searchVO.setTraceId(safe(searchDTO.getTraceId()));
        searchVO.setPageId(safe(searchDTO.getPageId()));
        searchVO.setComponentId(safe(searchDTO.getComponentId()));
        searchVO.setFunctionId(safe(searchDTO.getFunctionId()));
        searchVO.setApiId(safe(searchDTO.getApiId()));
        searchVO.setEventType(safe(searchDTO.getDetailType()).isEmpty() ? safe(searchDTO.getActionCode()) : safe(searchDTO.getDetailType()));
        searchVO.setResultCode(safe(searchDTO.getResultCode()));
        searchVO.setSearchKeyword(safe(searchDTO.getSearchKeyword()));
        List<AdminUnifiedLogRowResponse> rows = new ArrayList<>();
        for (TraceEventRecordVO item : observabilityMapper.selectTraceEventListCompact(searchVO)) {
            AdminUnifiedLogRowResponse row = new AdminUnifiedLogRowResponse();
            row.setLogId(item.getEventId());
            row.setLogType("TRACE");
            row.setDetailType(safe(item.getEventType()));
            row.setProjectId(item.getProjectId());
            row.setOccurredAt(item.getCreatedAt());
            row.setResultCode(item.getResultCode());
            row.setPageId(item.getPageId());
            row.setComponentId(item.getComponentId());
            row.setFunctionId(item.getFunctionId());
            row.setApiId(item.getApiId());
            row.setTraceId(item.getTraceId());
            row.setDurationMs(item.getDurationMs());
            row.setSummary(item.getPayloadSummaryJson());
            row.setRawSourceType(item.getEventType());
            if (matchesUnifiedFilters(searchDTO, row)) {
                rows.add(row);
            }
        }
        return rows;
    }

    private List<TraceEventRecordVO> loadTraceEventListSafely(TraceEventSearchVO searchVO) {
        try {
            return observabilityMapper.selectTraceEventList(searchVO);
        } catch (Exception e) {
            log.warn("Trace event list lookup failed with full payload. Retrying with compact projection. traceId={}, pageId={}, componentId={}, functionId={}, apiId={}, eventType={}",
                    safe(searchVO == null ? null : searchVO.getTraceId()),
                    safe(searchVO == null ? null : searchVO.getPageId()),
                    safe(searchVO == null ? null : searchVO.getComponentId()),
                    safe(searchVO == null ? null : searchVO.getFunctionId()),
                    safe(searchVO == null ? null : searchVO.getApiId()),
                    safe(searchVO == null ? null : searchVO.getEventType()),
                    e);
            return observabilityMapper.selectTraceEventListCompact(searchVO);
        }
    }

    private List<ErrorEventRecordVO> loadErrorEventListSafely(ErrorEventSearchVO searchVO) {
        try {
            return observabilityMapper.selectErrorEventList(searchVO);
        } catch (Exception e) {
            log.warn("Error event list lookup failed with full payload. Retrying with compact projection. actorId={}, insttId={}, pageId={}, apiId={}, sourceType={}, errorType={}",
                    safe(searchVO == null ? null : searchVO.getActorId()),
                    safe(searchVO == null ? null : searchVO.getInsttId()),
                    safe(searchVO == null ? null : searchVO.getPageId()),
                    safe(searchVO == null ? null : searchVO.getApiId()),
                    safe(searchVO == null ? null : searchVO.getSourceType()),
                    safe(searchVO == null ? null : searchVO.getErrorType()),
                    e);
            return observabilityMapper.selectErrorEventListCompact(searchVO);
        }
    }

    private boolean matchesUnifiedFilters(AdminUnifiedLogSearchRequestDTO searchDTO, AdminUnifiedLogRowResponse row) {
        return matches(searchDTO.getActorId(), row.getActorId())
                && matches(searchDTO.getProjectId(), row.getProjectId())
                && matches(searchDTO.getActorRole(), row.getActorRole())
                && matches(searchDTO.getInsttId(), row.getInsttId())
                && matches(searchDTO.getMemberType(), row.getMemberType())
                && matches(searchDTO.getMenuCode(), row.getMenuCode())
                && matches(searchDTO.getPageId(), row.getPageId())
                && matches(searchDTO.getComponentId(), row.getComponentId())
                && matches(searchDTO.getFunctionId(), row.getFunctionId())
                && matches(searchDTO.getApiId(), row.getApiId())
                && matches(searchDTO.getActionCode(), row.getActionCode())
                && matches(searchDTO.getTargetType(), row.getTargetType())
                && matches(searchDTO.getTargetId(), row.getTargetId())
                && matches(searchDTO.getTraceId(), row.getTraceId())
                && matches(searchDTO.getRequestUri(), row.getRequestUri())
                && matches(searchDTO.getRemoteAddr(), row.getRemoteAddr())
                && matches(searchDTO.getResultCode(), row.getResultCode())
                && matchesDetail(searchDTO.getDetailType(), row.getDetailType(), row.getRawSourceType())
                && matchesSearchKeyword(searchDTO.getSearchKeyword(), row);
    }

    private boolean matches(String filter, String value) {
        String normalizedFilter = safe(filter);
        if (normalizedFilter.isEmpty()) {
            return true;
        }
        return safe(value).toLowerCase(Locale.ROOT).contains(normalizedFilter.toLowerCase(Locale.ROOT));
    }

    private boolean matchesDetail(String filter, String detailType, String rawSourceType) {
        String normalizedFilter = safe(filter);
        if (normalizedFilter.isEmpty()) {
            return true;
        }
        if (matchesTokenList(normalizedFilter, detailType) || matchesTokenList(normalizedFilter, rawSourceType)) {
            return true;
        }
        String candidate = safe(detailType) + " " + safe(rawSourceType);
        return candidate.toLowerCase(Locale.ROOT).contains(normalizedFilter.toLowerCase(Locale.ROOT));
    }

    private boolean matchesTokenList(String filterList, String value) {
        String normalizedValue = safe(value).toUpperCase(Locale.ROOT);
        if (normalizedValue.isEmpty()) {
            return false;
        }
        for (String token : safe(filterList).split(",")) {
            String normalizedToken = safe(token).toUpperCase(Locale.ROOT);
            if (!normalizedToken.isEmpty() && normalizedToken.equals(normalizedValue)) {
                return true;
            }
        }
        return false;
    }

    private boolean matchesSearchKeyword(String filter, AdminUnifiedLogRowResponse row) {
        String normalizedFilter = safe(filter);
        if (normalizedFilter.isEmpty()) {
            return true;
        }
        String haystack = String.join(" ",
                safe(row.getActorId()),
                safe(row.getActorRole()),
                safe(row.getProjectId()),
                safe(row.getInsttId()),
                safe(row.getMenuCode()),
                safe(row.getPageId()),
                safe(row.getComponentId()),
                safe(row.getFunctionId()),
                safe(row.getApiId()),
                safe(row.getActionCode()),
                safe(row.getTargetType()),
                safe(row.getTargetId()),
                safe(row.getTraceId()),
                safe(row.getRequestUri()),
                safe(row.getSummary()),
                safe(row.getMessage()));
        return haystack.toLowerCase(Locale.ROOT).contains(normalizedFilter.toLowerCase(Locale.ROOT));
    }

    private int resolveFetchWindow(AdminUnifiedLogSearchRequestDTO searchDTO) {
        int pageIndex = Math.max(defaultInt(searchDTO.getPageIndex(), 1), 1);
        int pageSize = Math.max(defaultInt(searchDTO.getPageSize(), 10), 1);
        return Math.max(pageIndex * pageSize, 100);
    }

    private int defaultInt(Integer value, int fallback) {
        return value == null ? fallback : value;
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
