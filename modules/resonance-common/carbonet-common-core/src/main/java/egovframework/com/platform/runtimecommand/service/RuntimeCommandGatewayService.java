package egovframework.com.platform.runtimecommand.service;

import java.util.Map;

public interface RuntimeCommandGatewayService {

    Map<String, Object> execute(String commandId, Map<String, Object> params, String actorId) throws Exception;
}
