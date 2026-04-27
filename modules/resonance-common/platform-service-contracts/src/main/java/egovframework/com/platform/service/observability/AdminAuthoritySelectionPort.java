package egovframework.com.platform.service.observability;

import java.util.List;
import java.util.Map;

public interface AdminAuthoritySelectionPort {

    String resolveSelectedInsttId(String insttId, List<Map<String, String>> companyOptions, boolean allowEmptySelection);
}
