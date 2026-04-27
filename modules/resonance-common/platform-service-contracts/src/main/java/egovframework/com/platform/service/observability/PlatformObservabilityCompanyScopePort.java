package egovframework.com.platform.service.observability;

import java.util.List;
import java.util.Map;

public interface PlatformObservabilityCompanyScopePort {

    List<Map<String, String>> loadAccessHistoryCompanyOptions();

    List<Map<String, String>> buildScopedAccessHistoryCompanyOptions(String insttId);

    String resolveCompanyNameByInsttId(String insttId);
}
