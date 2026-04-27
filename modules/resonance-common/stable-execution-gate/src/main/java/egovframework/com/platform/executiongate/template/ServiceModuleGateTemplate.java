package egovframework.com.platform.executiongate.template;

import egovframework.com.platform.executiongate.ExecutionGateRequestContext;

public interface ServiceModuleGateTemplate<RQ, RS> {

    String gateName();

    String actionKeyPrefix();

    String executionGateVersion();

    GateCompatibilityClass compatibilityClass();

    RS execute(ExecutionGateRequestContext context, String actionKey, RQ request);
}
