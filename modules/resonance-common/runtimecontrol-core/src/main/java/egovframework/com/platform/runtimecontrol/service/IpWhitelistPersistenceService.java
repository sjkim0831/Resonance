package egovframework.com.platform.runtimecontrol.service;

import java.util.List;
import java.util.Map;

public interface IpWhitelistPersistenceService {

    List<Map<String, String>> selectRuleRows();

    List<Map<String, String>> selectRequestRows();

    void saveRuleRow(Map<String, String> row);

    void saveRequestRow(Map<String, String> row);
}
