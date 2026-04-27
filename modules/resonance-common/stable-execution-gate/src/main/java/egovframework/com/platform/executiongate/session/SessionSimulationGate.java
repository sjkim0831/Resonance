package egovframework.com.platform.executiongate.session;

import jakarta.servlet.http.HttpServletRequest;

public interface SessionSimulationGate {

    SessionSimulationGateResponse execute(SessionSimulationGateRequest request, HttpServletRequest httpServletRequest);
}
