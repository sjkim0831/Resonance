package egovframework.com.common.logging;

import egovframework.com.common.mapper.ObservabilityMapper;
import egovframework.com.common.context.ProjectRuntimeContext;
import egovframework.com.common.trace.FrontendTelemetryEvent;
import egovframework.com.common.trace.TraceContext;
import egovframework.com.common.trace.TraceIdGenerator;
import egovframework.com.platform.codex.service.AuthGroupManageService;
import egovframework.com.feature.auth.domain.entity.EmplyrInfo;
import egovframework.com.feature.auth.domain.entity.EntrprsMber;
import egovframework.com.feature.auth.domain.repository.EmployeeMemberRepository;
import egovframework.com.feature.auth.domain.repository.EnterpriseMemberRepository;
import egovframework.com.feature.auth.util.JwtTokenProvider;
import io.jsonwebtoken.Claims;
import lombok.RequiredArgsConstructor;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.ObjectUtils;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AccessEventService {

    private static final Logger log = LoggerFactory.getLogger(AccessEventService.class);

    private final ObservabilityMapper observabilityMapper;
    private final JwtTokenProvider jwtTokenProvider;
    private final AuthGroupManageService authGroupManageService;
    private final EmployeeMemberRepository employeeMemberRepository;
    private final EnterpriseMemberRepository enterpriseMemberRepository;
    private final ProjectRuntimeContext projectRuntimeContext;

    public void recordRequestLog(RequestExecutionLogVO item, TraceContext traceContext) {
        if (item == null) {
            return;
        }

        AccessEventRecordVO record = new AccessEventRecordVO();
        record.setEventId(TraceIdGenerator.next("ACE"));
        record.setProjectId(currentProjectId());
        record.setTraceId(traceContext == null ? "" : safe(traceContext.getTraceId()));
        record.setRequestId(traceContext == null ? "" : safe(traceContext.getRequestId()));
        record.setPageId(traceContext == null ? "" : safe(traceContext.getPageId()));
        record.setApiId(traceContext == null ? "" : safe(traceContext.getApiId()));
        record.setRequestUri(safe(item.getRequestUri()));
        record.setHttpMethod(safe(item.getHttpMethod()));
        record.setFeatureType(safe(item.getFeatureType()));
        record.setActorId(safe(item.getActorUserId()));
        record.setActorType(safe(item.getActorType()));
        record.setActorRole(safe(item.getActorAuthorCode()));
        record.setActorInsttId(safe(item.getActorInsttId()));
        record.setCompanyContextId(safe(item.getCompanyContextId()));
        record.setTargetCompanyContextId(safe(item.getTargetCompanyContextId()));
        record.setRemoteAddr(safe(item.getRemoteAddr()));
        record.setResponseStatus(item.getResponseStatus());
        record.setDurationMs((int) Math.min(Math.max(item.getDurationMs(), 0L), Integer.MAX_VALUE));
        record.setRequestContentType(safe(item.getRequestContentType()));
        record.setQueryString(truncate(item.getQueryString(), 2000));
        record.setParameterSummary(truncate(item.getParameterSummary(), 4000));
        record.setErrorMessage(truncate(item.getErrorMessage(), 2000));
        record.setCompanyScopeDecision(safe(item.getCompanyScopeDecision()));
        record.setCompanyScopeReason(truncate(item.getCompanyScopeReason(), 1000));

        tryInsertAccessEvent(record, "uri=" + item.getRequestUri());
    }

    public void recordFrontendPageViews(List<FrontendTelemetryEvent> events, HttpServletRequest request) {
        if (events == null || events.isEmpty() || request == null) {
            return;
        }

        FrontendActorContext actor = resolveActor(request);
        for (FrontendTelemetryEvent event : events) {
            if (!isPageViewEvent(event)) {
                continue;
            }
            AccessEventRecordVO record = new AccessEventRecordVO();
            record.setEventId(TraceIdGenerator.next("ACE"));
            record.setProjectId(currentProjectId());
            record.setTraceId(safe(event.getTraceId()));
            record.setRequestId(safe(event.getRequestId()));
            record.setPageId(safe(event.getPageId()));
            record.setApiId("frontend.page_view");
            record.setRequestUri(resolvePageRequestUri(event));
            record.setHttpMethod("GET");
            record.setFeatureType("PAGE_VIEW");
            record.setActorId(actor.actorId);
            record.setActorType(actor.actorType);
            record.setActorRole(actor.actorRole);
            record.setActorInsttId(actor.actorInsttId);
            record.setCompanyContextId(actor.actorInsttId);
            record.setTargetCompanyContextId(actor.actorInsttId);
            record.setRemoteAddr(safe(request.getRemoteAddr()));
            record.setResponseStatus(200);
            record.setDurationMs(0);
            record.setRequestContentType("frontend/page_view");
            record.setQueryString(extractQueryString(record.getRequestUri()));
            record.setParameterSummary(null);
            record.setErrorMessage(null);
            record.setCompanyScopeDecision("");
            record.setCompanyScopeReason(null);
            tryInsertAccessEvent(record, "pageId=" + event.getPageId() + ", traceId=" + event.getTraceId());
        }
    }

    private boolean tryInsertAccessEvent(AccessEventRecordVO record, String contextSummary) {
        try {
            observabilityMapper.insertAccessEvent(record);
            return true;
        } catch (Exception e) {
            if (isClobBindingIssue(e)) {
                log.warn("Access event persistence failed due to CLOB binding. Retrying with compact text fields. {}", contextSummary);
                record.setParameterSummary(null);
                record.setErrorMessage(null);
                record.setCompanyScopeReason(null);
                try {
                    observabilityMapper.insertAccessEvent(record);
                    return true;
                } catch (Exception retryException) {
                    log.warn("Failed to persist access event after compact retry. {}", contextSummary, retryException);
                    return false;
                }
            }
            log.warn("Failed to persist access event. {}", contextSummary, e);
            return false;
        }
    }

    private boolean isClobBindingIssue(Exception exception) {
        Throwable current = exception;
        while (current != null) {
            String message = current.getMessage();
            if (message != null && message.toLowerCase(Locale.ROOT).contains("type clob")) {
                return true;
            }
            current = current.getCause();
        }
        return false;
    }

    private boolean isPageViewEvent(FrontendTelemetryEvent event) {
        return event != null && "PAGE_VIEW".equalsIgnoreCase(safe(event.getType()).replace('-', '_'));
    }

    private String resolvePageRequestUri(FrontendTelemetryEvent event) {
        if (event == null) {
            return "";
        }
        Object payloadSummary = event.getPayloadSummary();
        if (payloadSummary instanceof Map<?, ?>) {
            Object path = ((Map<?, ?>) payloadSummary).get("path");
            if (path != null) {
                return safe(String.valueOf(path));
            }
        }
        return safe(event.getPageId());
    }

    private String extractQueryString(String requestUri) {
        String normalized = safe(requestUri);
        int queryIndex = normalized.indexOf('?');
        if (queryIndex < 0 || queryIndex + 1 >= normalized.length()) {
            return "";
        }
        return normalized.substring(queryIndex + 1);
    }

    private FrontendActorContext resolveActor(HttpServletRequest request) {
        String actorId = extractCurrentUserId(jwtTokenProvider.getCookie(request, "accessToken"));
        if (actorId.isEmpty()) {
            return new FrontendActorContext("", "ANONYMOUS", "", "");
        }
        String actorType = "AUTHENTICATED";
        String actorRole = "";
        String actorInsttId = "";
        try {
            if (employeeMemberRepository.findById(actorId).isPresent()) {
                actorType = "ADMIN";
            } else if (findEnterpriseMember(actorId) != null) {
                actorType = "ENTERPRISE_MEMBER";
            }
            actorRole = safe(authGroupManageService.selectAuthorCodeByUserId(actorId)).toUpperCase(Locale.ROOT);
            if (actorRole.isEmpty()) {
                actorRole = safe(authGroupManageService.selectEnterpriseAuthorCodeByUserId(actorId)).toUpperCase(Locale.ROOT);
            }
        } catch (Exception e) {
            log.debug("Failed to resolve frontend page-view actor role. actorId={}", actorId, e);
        }
        try {
            actorInsttId = employeeMemberRepository.findById(actorId)
                    .map(EmplyrInfo::getInsttId)
                    .map(this::safe)
                    .orElse("");
            if (actorInsttId.isEmpty()) {
                EntrprsMber member = findEnterpriseMember(actorId);
                actorInsttId = member == null ? "" : safe(member.getInsttId());
            }
            if (actorInsttId.isEmpty()) {
                actorInsttId = safe(authGroupManageService.selectEnterpriseInsttIdByUserId(actorId));
            }
        } catch (Exception e) {
            log.debug("Failed to resolve frontend page-view actor company. actorId={}", actorId, e);
        }
        return new FrontendActorContext(actorId, actorType, actorRole, actorInsttId);
    }

    private EntrprsMber findEnterpriseMember(String actorId) {
        String normalizedActorId = safe(actorId);
        if (normalizedActorId.isEmpty()) {
            return null;
        }
        String projectId = currentProjectId();
        if (!projectId.isEmpty()) {
            return enterpriseMemberRepository.findByEntrprsMberIdAndProjectId(normalizedActorId, projectId).orElse(null);
        }
        return enterpriseMemberRepository.findById(normalizedActorId).orElse(null);
    }

    private String extractCurrentUserId(String accessToken) {
        if (ObjectUtils.isEmpty(accessToken)) {
            return "";
        }
        try {
            Claims claims = jwtTokenProvider.accessExtractClaims(accessToken);
            Object encryptedUserId = claims.get("userId");
            if (ObjectUtils.isEmpty(encryptedUserId)) {
                return "";
            }
            return safe(jwtTokenProvider.decrypt(encryptedUserId.toString()));
        } catch (Exception e) {
            return "";
        }
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }

    private String currentProjectId() {
        return safe(projectRuntimeContext == null ? null : projectRuntimeContext.getProjectId());
    }

    private String truncate(String value, int maxLength) {
        String safeValue = safe(value);
        if (safeValue.length() <= maxLength) {
            return safeValue;
        }
        return safeValue.substring(0, maxLength);
    }

    private static final class FrontendActorContext {
        private final String actorId;
        private final String actorType;
        private final String actorRole;
        private final String actorInsttId;

        private FrontendActorContext(String actorId, String actorType, String actorRole, String actorInsttId) {
            this.actorId = actorId;
            this.actorType = actorType;
            this.actorRole = actorRole;
            this.actorInsttId = actorInsttId;
        }
    }
}
