package egovframework.com.feature.admin.service.impl;

import egovframework.com.feature.admin.mapper.BlocklistPersistenceMapper;
import egovframework.com.feature.admin.service.BlocklistPersistenceService;
import org.egovframe.rte.fdl.cmmn.EgovAbstractServiceImpl;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;
import java.util.Map;

@Service("blocklistPersistenceService")
public class BlocklistPersistenceServiceImpl extends EgovAbstractServiceImpl implements BlocklistPersistenceService {

    private final BlocklistPersistenceMapper blocklistPersistenceMapper;

    public BlocklistPersistenceServiceImpl(BlocklistPersistenceMapper blocklistPersistenceMapper) {
        this.blocklistPersistenceMapper = blocklistPersistenceMapper;
    }

    @Override
    public List<Map<String, String>> selectBlockRows() {
        List<Map<String, String>> rows = blocklistPersistenceMapper.selectBlockRows();
        return rows == null ? Collections.emptyList() : rows;
    }

    @Override
    public List<Map<String, String>> selectActionHistoryRows() {
        List<Map<String, String>> rows = blocklistPersistenceMapper.selectActionHistoryRows();
        return rows == null ? Collections.emptyList() : rows;
    }

    @Override
    @Transactional
    public void saveBlockRow(Map<String, String> row) {
        if (row == null || safe(row.get("blockId")).isEmpty()) {
            return;
        }
        if (blocklistPersistenceMapper.countBlockById(safe(row.get("blockId"))) > 0) {
            blocklistPersistenceMapper.updateBlockRow(row);
            return;
        }
        blocklistPersistenceMapper.insertBlockRow(row);
    }

    @Override
    @Transactional
    public void saveActionHistoryRow(Map<String, String> row) {
        if (row == null || safe(row.get("actionId")).isEmpty()) {
            return;
        }
        if (blocklistPersistenceMapper.countActionById(safe(row.get("actionId"))) > 0) {
            blocklistPersistenceMapper.updateActionHistoryRow(row);
            return;
        }
        blocklistPersistenceMapper.insertActionHistoryRow(row);
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
