package egovframework.com.platform.runtimecontrol.service.impl;

import egovframework.com.platform.runtimecontrol.mapper.IpWhitelistPersistenceMapper;
import egovframework.com.platform.runtimecontrol.service.IpWhitelistPersistenceService;
import org.egovframe.rte.fdl.cmmn.EgovAbstractServiceImpl;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;
import java.util.Map;

@Service("ipWhitelistPersistenceService")
public class IpWhitelistPersistenceServiceImpl extends EgovAbstractServiceImpl implements IpWhitelistPersistenceService {

    private final IpWhitelistPersistenceMapper ipWhitelistPersistenceMapper;

    public IpWhitelistPersistenceServiceImpl(IpWhitelistPersistenceMapper ipWhitelistPersistenceMapper) {
        this.ipWhitelistPersistenceMapper = ipWhitelistPersistenceMapper;
    }

    @Override
    public List<Map<String, String>> selectRuleRows() {
        List<Map<String, String>> rows = ipWhitelistPersistenceMapper.selectRuleRows();
        return rows == null ? Collections.emptyList() : rows;
    }

    @Override
    public List<Map<String, String>> selectRequestRows() {
        List<Map<String, String>> rows = ipWhitelistPersistenceMapper.selectRequestRows();
        return rows == null ? Collections.emptyList() : rows;
    }

    @Override
    @Transactional
    public void saveRuleRow(Map<String, String> row) {
        if (row == null || safe(row.get("ruleId")).isEmpty()) {
            return;
        }
        if (ipWhitelistPersistenceMapper.countRuleById(safe(row.get("ruleId"))) > 0) {
            ipWhitelistPersistenceMapper.updateRuleRow(row);
            return;
        }
        ipWhitelistPersistenceMapper.insertRuleRow(row);
    }

    @Override
    @Transactional
    public void saveRequestRow(Map<String, String> row) {
        if (row == null || safe(row.get("requestId")).isEmpty()) {
            return;
        }
        if (ipWhitelistPersistenceMapper.countRequestById(safe(row.get("requestId"))) > 0) {
            ipWhitelistPersistenceMapper.updateRequestRow(row);
            return;
        }
        ipWhitelistPersistenceMapper.insertRequestRow(row);
    }

    private String safe(String value) {
        return value == null ? "" : value.trim();
    }
}
