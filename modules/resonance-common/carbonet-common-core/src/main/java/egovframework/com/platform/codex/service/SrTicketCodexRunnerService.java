package egovframework.com.platform.codex.service;

import egovframework.com.platform.workbench.model.SrTicketRecordVO;
import egovframework.com.platform.codex.model.SrTicketRunnerExecutionVO;

public interface SrTicketCodexRunnerService {

    SrTicketRunnerExecutionVO prepareExecution(SrTicketRecordVO ticket, String actorId, String executionMode) throws Exception;

    SrTicketRunnerExecutionVO execute(SrTicketRecordVO ticket, String actorId, String approvalToken, String executionMode) throws Exception;

    SrTicketRunnerExecutionVO executePrepared(SrTicketRecordVO ticket, String actorId, String approvalToken, SrTicketRunnerExecutionVO execution) throws Exception;
}
