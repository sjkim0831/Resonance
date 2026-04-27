package egovframework.com.platform.observability.service;

import egovframework.com.platform.service.observability.PlatformObservabilityCompanyScopePort;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class PlatformObservabilityCompanyScopePortBridge implements PlatformObservabilityCompanyScopePort {

    private final PlatformObservabilityCompanyScopeService platformObservabilityCompanyScopeService;

    public PlatformObservabilityCompanyScopePortBridge(PlatformObservabilityCompanyScopeService platformObservabilityCompanyScopeService) {
        this.platformObservabilityCompanyScopeService = platformObservabilityCompanyScopeService;
    }

    @Override
    public List<Map<String, String>> loadAccessHistoryCompanyOptions() {
        return platformObservabilityCompanyScopeService.loadAccessHistoryCompanyOptions();
    }

    @Override
    public List<Map<String, String>> buildScopedAccessHistoryCompanyOptions(String insttId) {
        return platformObservabilityCompanyScopeService.buildScopedAccessHistoryCompanyOptions(insttId);
    }

    @Override
    public String resolveCompanyNameByInsttId(String insttId) {
        return platformObservabilityCompanyScopeService.resolveCompanyNameByInsttId(insttId);
    }
}
