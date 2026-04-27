package egovframework.com.platform.workbench.service;

import egovframework.com.platform.request.workbench.SrTicketApprovalRequest;
import egovframework.com.platform.request.workbench.SrTicketCreateRequest;
import egovframework.com.platform.request.workbench.SrWorkbenchStackItemCreateRequest;
import egovframework.com.platform.service.workbench.SrTicketWorkbenchPort;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class SrTicketWorkbenchPortBridge implements SrTicketWorkbenchPort {

    private final SrTicketWorkbenchService delegate;

    public SrTicketWorkbenchPortBridge(SrTicketWorkbenchService delegate) {
        this.delegate = delegate;
    }

    @Override
    public Map<String, Object> getPage(String selectedPageId) throws Exception {
        return delegate.getPage(selectedPageId);
    }

    @Override
    public Map<String, Object> createTicket(SrTicketCreateRequest request, String actorId) throws Exception {
        return delegate.createTicket(request, actorId);
    }

    @Override
    public Map<String, Object> quickExecuteTicket(SrTicketCreateRequest request, String actorId) throws Exception {
        return delegate.quickExecuteTicket(request, actorId);
    }

    @Override
    public Map<String, Object> addStackItem(SrWorkbenchStackItemCreateRequest request, String actorId) throws Exception {
        return delegate.addStackItem(request, actorId);
    }

    @Override
    public Map<String, Object> removeStackItem(String stackItemId, String actorId) throws Exception {
        return delegate.removeStackItem(stackItemId, actorId);
    }

    @Override
    public Map<String, Object> clearStack(String actorId) throws Exception {
        return delegate.clearStack(actorId);
    }

    @Override
    public Map<String, Object> updateApproval(String ticketId, SrTicketApprovalRequest request, String actorId) throws Exception {
        return delegate.updateApproval(ticketId, request, actorId);
    }

    @Override
    public Map<String, Object> prepareExecution(String ticketId, String actorId) throws Exception {
        return delegate.prepareExecution(ticketId, actorId);
    }

    @Override
    public Map<String, Object> planTicket(String ticketId, String actorId) throws Exception {
        return delegate.planTicket(ticketId, actorId);
    }

    @Override
    public Map<String, Object> executeTicket(String ticketId, String actorId, String approvalToken) throws Exception {
        return delegate.executeTicket(ticketId, actorId, approvalToken);
    }

    @Override
    public Map<String, Object> directExecuteTicket(String ticketId, String actorId, String approvalToken) throws Exception {
        return delegate.directExecuteTicket(ticketId, actorId, approvalToken);
    }

    @Override
    public Map<String, Object> queueDirectExecuteTicket(String ticketId, String actorId) throws Exception {
        return delegate.queueDirectExecuteTicket(ticketId, actorId);
    }

    @Override
    public Map<String, Object> skipPlanExecuteTicket(String ticketId, String actorId, String approvalToken) throws Exception {
        return delegate.skipPlanExecuteTicket(ticketId, actorId, approvalToken);
    }

    @Override
    public Map<String, Object> rollbackTicket(String ticketId, String actorId) throws Exception {
        return delegate.rollbackTicket(ticketId, actorId);
    }

    @Override
    public Map<String, Object> reissueTicket(String ticketId, String actorId) throws Exception {
        return delegate.reissueTicket(ticketId, actorId);
    }

    @Override
    public Map<String, Object> deleteTicket(String ticketId, String actorId) throws Exception {
        return delegate.deleteTicket(ticketId, actorId);
    }

    @Override
    public Map<String, Object> getTicketDetail(String ticketId) throws Exception {
        return delegate.getTicketDetail(ticketId);
    }

    @Override
    public Map<String, Object> getTicketArtifact(String ticketId, String artifactType) throws Exception {
        return delegate.getTicketArtifact(ticketId, artifactType);
    }
}
