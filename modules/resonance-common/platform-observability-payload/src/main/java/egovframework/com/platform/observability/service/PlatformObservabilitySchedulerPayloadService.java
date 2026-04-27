package egovframework.com.platform.observability.service;

import egovframework.com.platform.service.observability.AdminSchedulerBootstrapReadPort;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.LinkedHashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class PlatformObservabilitySchedulerPayloadService {

    private final AdminSchedulerBootstrapReadPort adminSchedulerBootstrapReadService;

    public Map<String, Object> buildSchedulerPagePayload(String jobStatus, String executionType, boolean isEn) {
        Map<String, Object> payload = new LinkedHashMap<>(adminSchedulerBootstrapReadService.buildSchedulerPageData(jobStatus, executionType, isEn));
        payload.put("isEn", isEn);
        return payload;
    }
}
