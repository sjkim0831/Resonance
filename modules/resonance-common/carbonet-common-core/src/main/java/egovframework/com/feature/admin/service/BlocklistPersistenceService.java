package egovframework.com.feature.admin.service;

import java.util.List;
import java.util.Map;

public interface BlocklistPersistenceService {

    List<Map<String, String>> selectBlockRows();

    List<Map<String, String>> selectActionHistoryRows();

    void saveBlockRow(Map<String, String> row);

    void saveActionHistoryRow(Map<String, String> row);
}
