package egovframework.com.platform.read;

import java.util.Map;

public interface FullStackGovernanceRegistryReadPort {

    Map<String, Object> getEntry(String menuCode);

    Map<String, Map<String, Object>> getAllEntries();
}
