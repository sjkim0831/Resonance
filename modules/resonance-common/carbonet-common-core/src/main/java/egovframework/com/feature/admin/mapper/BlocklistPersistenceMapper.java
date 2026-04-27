package egovframework.com.feature.admin.mapper;

import egovframework.com.common.mapper.support.BaseMapperSupport;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component("blocklistPersistenceMapper")
public class BlocklistPersistenceMapper extends BaseMapperSupport {

    public List<Map<String, String>> selectBlockRows() {
        return selectList("BlocklistPersistenceMapper.selectBlockRows");
    }

    public List<Map<String, String>> selectActionHistoryRows() {
        return selectList("BlocklistPersistenceMapper.selectActionHistoryRows");
    }

    public int countBlockById(String blockId) {
        Integer count = selectOne("BlocklistPersistenceMapper.countBlockById", blockId);
        return count == null ? 0 : count;
    }

    public int countActionById(String actionId) {
        Integer count = selectOne("BlocklistPersistenceMapper.countActionById", actionId);
        return count == null ? 0 : count;
    }

    public void insertBlockRow(Map<String, String> row) {
        insert("BlocklistPersistenceMapper.insertBlockRow", row);
    }

    public void updateBlockRow(Map<String, String> row) {
        update("BlocklistPersistenceMapper.updateBlockRow", row);
    }

    public void insertActionHistoryRow(Map<String, String> row) {
        insert("BlocklistPersistenceMapper.insertActionHistoryRow", row);
    }

    public void updateActionHistoryRow(Map<String, String> row) {
        update("BlocklistPersistenceMapper.updateActionHistoryRow", row);
    }
}
