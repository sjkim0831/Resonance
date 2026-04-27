package egovframework.com.platform.codex.service;

import egovframework.com.platform.codex.model.CodexAdminActorContext;
import egovframework.com.platform.codex.model.CodexExecutionHistoryResponse;
import egovframework.com.platform.codex.model.CodexProvisionResponse;
import egovframework.com.platform.request.codex.CodexProvisionRequest;

public interface CodexExecutionAdminPort {

    CodexProvisionResponse execute(CodexProvisionRequest request, CodexAdminActorContext actorContext) throws Exception;

    CodexExecutionHistoryResponse getRecentHistory(int limit) throws Exception;

    CodexExecutionHistoryResponse.CodexExecutionHistoryRow inspect(String logId) throws Exception;

    CodexProvisionResponse remediate(String logId, CodexAdminActorContext actorContext) throws Exception;
}
