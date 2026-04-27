package egovframework.com.platform.observability.service;

import egovframework.com.feature.admin.mapper.AdminNotificationHistoryMapper;
import egovframework.com.platform.service.observability.NotificationHistoryQueryPort;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Map;

@Service
public class NotificationHistoryQueryPortBridge implements NotificationHistoryQueryPort {

    private final AdminNotificationHistoryMapper delegate;

    public NotificationHistoryQueryPortBridge(AdminNotificationHistoryMapper delegate) {
        this.delegate = delegate;
    }

    @Override
    public int countDeliveryHistory(Map<String, Object> params) {
        return delegate.countDeliveryHistory(params);
    }

    @Override
    public List<Map<String, String>> selectDeliveryHistory(Map<String, Object> params) {
        return delegate.selectDeliveryHistory(params);
    }

    @Override
    public int countActivityHistory(Map<String, Object> params) {
        return delegate.countActivityHistory(params);
    }

    @Override
    public List<Map<String, String>> selectActivityHistory(Map<String, Object> params) {
        return delegate.selectActivityHistory(params);
    }
}
