package egovframework.com.platform.codex.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.platform.codex.model.CodexAdminActorContext;
import egovframework.com.platform.codex.model.CodexExecutionHistoryResponse;
import egovframework.com.platform.codex.model.CodexProvisionResponse;
import egovframework.com.platform.codex.service.CodexExecutionAdminPort;
import egovframework.com.platform.request.codex.CodexProvisionRequest;
import egovframework.com.platform.request.workbench.SrTicketApprovalRequest;
import egovframework.com.platform.request.workbench.SrTicketCreateRequest;
import egovframework.com.platform.request.workbench.SrWorkbenchStackItemCreateRequest;
import egovframework.com.platform.service.workbench.SrTicketWorkbenchPort;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class CodexAdminOperationsGateAdapter {

    private final CodexExecutionAdminPort codexExecutionAdminPort;
    private final SrTicketWorkbenchPort srTicketWorkbenchPort;
    private final ObjectMapper objectMapper;

    public CodexAdminOperationsGateAdapter(CodexExecutionAdminPort codexExecutionAdminPort,
                                           SrTicketWorkbenchPort srTicketWorkbenchPort,
                                           ObjectMapper objectMapper) {
        this.codexExecutionAdminPort = codexExecutionAdminPort;
        this.srTicketWorkbenchPort = srTicketWorkbenchPort;
        this.objectMapper = objectMapper;
    }

    public CodexProvisionResponse executeProvision(Map<String, Object> payload, CodexAdminActorContext actorContext) throws Exception {
        return codexExecutionAdminPort.execute(objectMapper.convertValue(payload, CodexProvisionRequest.class), actorContext);
    }

    public CodexExecutionHistoryResponse getRecentHistory(int limit) throws Exception {
        return codexExecutionAdminPort.getRecentHistory(limit);
    }

    public CodexExecutionHistoryResponse.CodexExecutionHistoryRow inspectHistory(String logId) throws Exception {
        return codexExecutionAdminPort.inspect(logId);
    }

    public CodexProvisionResponse remediateHistory(String logId, CodexAdminActorContext actorContext) throws Exception {
        return codexExecutionAdminPort.remediate(logId, actorContext);
    }

    public Map<String, Object> getTicketsPage(String selectedPageId) throws Exception {
        return srTicketWorkbenchPort.getPage(selectedPageId);
    }

    public Map<String, Object> createTicket(Map<String, Object> payload, String actorId) throws Exception {
        return srTicketWorkbenchPort.createTicket(objectMapper.convertValue(payload, SrTicketCreateRequest.class), actorId);
    }

    public Map<String, Object> quickExecuteTicket(Map<String, Object> payload, String actorId) throws Exception {
        return srTicketWorkbenchPort.quickExecuteTicket(objectMapper.convertValue(payload, SrTicketCreateRequest.class), actorId);
    }

    public Map<String, Object> addStackItem(Map<String, Object> payload, String actorId) throws Exception {
        return srTicketWorkbenchPort.addStackItem(objectMapper.convertValue(payload, SrWorkbenchStackItemCreateRequest.class), actorId);
    }

    public Map<String, Object> removeStackItem(String stackItemId, String actorId) throws Exception {
        return srTicketWorkbenchPort.removeStackItem(stackItemId, actorId);
    }

    public Map<String, Object> clearStack(String actorId) throws Exception {
        return srTicketWorkbenchPort.clearStack(actorId);
    }

    public Map<String, Object> updateApproval(String ticketId, Map<String, Object> payload, String actorId) throws Exception {
        return srTicketWorkbenchPort.updateApproval(ticketId, objectMapper.convertValue(payload, SrTicketApprovalRequest.class), actorId);
    }

    public Map<String, Object> getTicketDetail(String ticketId) throws Exception {
        return srTicketWorkbenchPort.getTicketDetail(ticketId);
    }

    public Map<String, Object> getTicketArtifact(String ticketId, String artifactType) throws Exception {
        return srTicketWorkbenchPort.getTicketArtifact(ticketId, artifactType);
    }

    public Map<String, Object> prepareTicket(String ticketId, String actorId) throws Exception {
        return srTicketWorkbenchPort.prepareExecution(ticketId, actorId);
    }

    public Map<String, Object> planTicket(String ticketId, String actorId) throws Exception {
        return srTicketWorkbenchPort.planTicket(ticketId, actorId);
    }

    public Map<String, Object> executeTicket(String ticketId, String actorId, String approvalToken) throws Exception {
        return srTicketWorkbenchPort.executeTicket(ticketId, actorId, approvalToken);
    }

    public Map<String, Object> directExecuteTicket(String ticketId, String actorId, String approvalToken) throws Exception {
        return srTicketWorkbenchPort.directExecuteTicket(ticketId, actorId, approvalToken);
    }

    public Map<String, Object> queueDirectExecuteTicket(String ticketId, String actorId) throws Exception {
        return srTicketWorkbenchPort.queueDirectExecuteTicket(ticketId, actorId);
    }

    public Map<String, Object> skipPlanExecuteTicket(String ticketId, String actorId, String approvalToken) throws Exception {
        return srTicketWorkbenchPort.skipPlanExecuteTicket(ticketId, actorId, approvalToken);
    }

    public Map<String, Object> rollbackTicket(String ticketId, String actorId) throws Exception {
        return srTicketWorkbenchPort.rollbackTicket(ticketId, actorId);
    }

    public Map<String, Object> reissueTicket(String ticketId, String actorId) throws Exception {
        return srTicketWorkbenchPort.reissueTicket(ticketId, actorId);
    }

    public Map<String, Object> deleteTicket(String ticketId, String actorId) throws Exception {
        return srTicketWorkbenchPort.deleteTicket(ticketId, actorId);
    }
}
