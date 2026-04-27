package egovframework.com.feature.admin.mapper;

import egovframework.com.common.mapper.support.BaseMapperSupport;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component("adminNotificationHistoryMapper")
public class AdminNotificationHistoryMapper extends BaseMapperSupport {

    public int countDeliveryHistory(Map<String, Object> params) {
        Integer count = selectOne("AdminNotificationHistoryMapper.countDeliveryHistory", params);
        return count == null ? 0 : count;
    }

    public List<Map<String, String>> selectDeliveryHistory(Map<String, Object> params) {
        return selectList("AdminNotificationHistoryMapper.selectDeliveryHistory", params);
    }

    public int countActivityHistory(Map<String, Object> params) {
        Integer count = selectOne("AdminNotificationHistoryMapper.countActivityHistory", params);
        return count == null ? 0 : count;
    }

    public List<Map<String, String>> selectActivityHistory(Map<String, Object> params) {
        return selectList("AdminNotificationHistoryMapper.selectActivityHistory", params);
    }

    public void insertDeliveryHistory(Map<String, Object> params) {
        insert("AdminNotificationHistoryMapper.insertDeliveryHistory", params);
    }

    public void insertActivityHistory(Map<String, Object> params) {
        insert("AdminNotificationHistoryMapper.insertActivityHistory", params);
    }
}
