package egovframework.com.platform.service.workbench;

import egovframework.com.platform.request.workbench.SrTicketApprovalRequest;
import egovframework.com.platform.request.workbench.SrTicketCreateRequest;
import egovframework.com.platform.request.workbench.SrWorkbenchStackItemCreateRequest;

import java.util.Map;

public interface SrTicketWorkbenchPort {

    Map<String, Object> getPage(String selectedPageId) throws Exception;

    Map<String, Object> createTicket(SrTicketCreateRequest request, String actorId) throws Exception;

    Map<String, Object> quickExecuteTicket(SrTicketCreateRequest request, String actorId) throws Exception;

    Map<String, Object> addStackItem(SrWorkbenchStackItemCreateRequest request, String actorId) throws Exception;

    Map<String, Object> removeStackItem(String stackItemId, String actorId) throws Exception;

    Map<String, Object> clearStack(String actorId) throws Exception;

    Map<String, Object> updateApproval(String ticketId, SrTicketApprovalRequest request, String actorId) throws Exception;

    Map<String, Object> prepareExecution(String ticketId, String actorId) throws Exception;

    Map<String, Object> planTicket(String ticketId, String actorId) throws Exception;

    Map<String, Object> executeTicket(String ticketId, String actorId, String approvalToken) throws Exception;

    Map<String, Object> directExecuteTicket(String ticketId, String actorId, String approvalToken) throws Exception;

    Map<String, Object> queueDirectExecuteTicket(String ticketId, String actorId) throws Exception;

    Map<String, Object> skipPlanExecuteTicket(String ticketId, String actorId, String approvalToken) throws Exception;

    Map<String, Object> rollbackTicket(String ticketId, String actorId) throws Exception;

    Map<String, Object> reissueTicket(String ticketId, String actorId) throws Exception;

    Map<String, Object> deleteTicket(String ticketId, String actorId) throws Exception;

    Map<String, Object> getTicketDetail(String ticketId) throws Exception;

    Map<String, Object> getTicketArtifact(String ticketId, String artifactType) throws Exception;
}
