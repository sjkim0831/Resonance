package egovframework.com.platform.runtimecontrol.mapper;

import egovframework.com.common.mapper.support.BaseMapperSupport;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component("ipWhitelistPersistenceMapper")
public class IpWhitelistPersistenceMapper extends BaseMapperSupport {

    public List<Map<String, String>> selectRuleRows() {
        return selectList("IpWhitelistPersistenceMapper.selectRuleRows");
    }

    public List<Map<String, String>> selectRequestRows() {
        return selectList("IpWhitelistPersistenceMapper.selectRequestRows");
    }

    public int countRuleById(String ruleId) {
        Integer count = selectOne("IpWhitelistPersistenceMapper.countRuleById", ruleId);
        return count == null ? 0 : count;
    }

    public int countRequestById(String requestId) {
        Integer count = selectOne("IpWhitelistPersistenceMapper.countRequestById", requestId);
        return count == null ? 0 : count;
    }

    public void insertRuleRow(Map<String, String> row) {
        insert("IpWhitelistPersistenceMapper.insertRuleRow", row);
    }

    public void updateRuleRow(Map<String, String> row) {
        update("IpWhitelistPersistenceMapper.updateRuleRow", row);
    }

    public void insertRequestRow(Map<String, String> row) {
        insert("IpWhitelistPersistenceMapper.insertRequestRow", row);
    }

    public void updateRequestRow(Map<String, String> row) {
        update("IpWhitelistPersistenceMapper.updateRequestRow", row);
    }
}
