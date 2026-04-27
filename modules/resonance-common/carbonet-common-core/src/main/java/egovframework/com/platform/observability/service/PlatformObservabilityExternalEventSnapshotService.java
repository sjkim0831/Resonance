package egovframework.com.platform.observability.service;

import egovframework.com.common.error.ErrorEventRecordVO;
import egovframework.com.common.error.ErrorEventSearchVO;
import egovframework.com.common.logging.AccessEventRecordVO;
import egovframework.com.common.logging.AccessEventSearchVO;
import egovframework.com.common.trace.TraceEventRecordVO;
import egovframework.com.common.trace.TraceEventSearchVO;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Locale;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PlatformObservabilityExternalEventSnapshotService {

    private final ObservabilityQueryService observabilityQueryService;

    public ExternalEventSnapshot loadSnapshot() {
        AccessEventSearchVO accessSearch = new AccessEventSearchVO();
        accessSearch.setFirstIndex(0);
        accessSearch.setRecordCountPerPage(150);
        List<AccessEventRecordVO> accessEvents = observabilityQueryService.selectAccessEventList(accessSearch).stream()
                .filter(this::isIntegrationAccessEvent)
                .collect(Collectors.toList());

        ErrorEventSearchVO errorSearch = new ErrorEventSearchVO();
        errorSearch.setFirstIndex(0);
        errorSearch.setRecordCountPerPage(80);
        List<ErrorEventRecordVO> errorEvents = observabilityQueryService.selectErrorEventList(errorSearch).stream()
                .filter(this::isIntegrationErrorEvent)
                .collect(Collectors.toList());

        TraceEventSearchVO traceSearch = new TraceEventSearchVO();
        traceSearch.setFirstIndex(0);
        traceSearch.setRecordCountPerPage(120);
        List<TraceEventRecordVO> traceEvents = observabilityQueryService.selectTraceEventList(traceSearch).stream()
                .filter(this::isIntegrationTraceEvent)
                .collect(Collectors.toList());

        return new ExternalEventSnapshot(accessEvents, errorEvents, traceEvents);
    }

    private boolean isIntegrationAccessEvent(AccessEventRecordVO item) {
        String apiId = safeString(item == null ? null : item.getApiId()).toLowerCase(Locale.ROOT);
        String requestUri = safeString(item == null ? null : item.getRequestUri()).toLowerCase(Locale.ROOT);
        String pageId = safeString(item == null ? null : item.getPageId()).toLowerCase(Locale.ROOT);
        return !apiId.isEmpty()
                || requestUri.startsWith("/api/external")
                || requestUri.startsWith("/external/")
                || requestUri.contains("/partner/")
                || pageId.startsWith("external-");
    }

    private boolean isIntegrationErrorEvent(ErrorEventRecordVO item) {
        String apiId = safeString(item == null ? null : item.getApiId()).toLowerCase(Locale.ROOT);
        String requestUri = safeString(item == null ? null : item.getRequestUri()).toLowerCase(Locale.ROOT);
        return !apiId.isEmpty()
                || requestUri.startsWith("/api/external")
                || requestUri.startsWith("/external/")
                || requestUri.contains("/partner/");
    }

    private boolean isIntegrationTraceEvent(TraceEventRecordVO item) {
        String apiId = safeString(item == null ? null : item.getApiId()).toLowerCase(Locale.ROOT);
        String eventType = safeString(item == null ? null : item.getEventType()).toUpperCase(Locale.ROOT);
        return !apiId.isEmpty() || eventType.contains("API");
    }

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }

    @Getter
    public static class ExternalEventSnapshot {
        private final List<AccessEventRecordVO> accessEvents;
        private final List<ErrorEventRecordVO> errorEvents;
        private final List<TraceEventRecordVO> traceEvents;

        public ExternalEventSnapshot(List<AccessEventRecordVO> accessEvents,
                                     List<ErrorEventRecordVO> errorEvents,
                                     List<TraceEventRecordVO> traceEvents) {
            this.accessEvents = accessEvents;
            this.errorEvents = errorEvents;
            this.traceEvents = traceEvents;
        }
    }
}
