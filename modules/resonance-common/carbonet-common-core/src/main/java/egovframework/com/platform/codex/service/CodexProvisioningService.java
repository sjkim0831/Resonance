package egovframework.com.platform.codex.service;

import egovframework.com.platform.codex.model.CodexProvisionResponse;
import egovframework.com.platform.request.codex.CodexProvisionRequest;

public interface CodexProvisioningService {

    CodexProvisionResponse provision(CodexProvisionRequest request) throws Exception;

    CodexProvisionResponse provision(egovframework.com.feature.admin.dto.request.CodexProvisionRequest request) throws Exception;
}
