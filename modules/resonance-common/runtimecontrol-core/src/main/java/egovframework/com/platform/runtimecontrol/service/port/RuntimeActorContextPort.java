package egovframework.com.platform.runtimecontrol.service.port;

import jakarta.servlet.http.HttpServletRequest;

public interface RuntimeActorContextPort {
    RuntimeActorContext resolve(HttpServletRequest request);
}
