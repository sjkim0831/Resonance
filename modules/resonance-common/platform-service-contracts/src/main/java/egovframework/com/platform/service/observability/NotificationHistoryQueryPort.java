package egovframework.com.platform.service.observability;

import java.util.List;
import java.util.Map;

public interface NotificationHistoryQueryPort {

    int countDeliveryHistory(Map<String, Object> params);

    List<Map<String, String>> selectDeliveryHistory(Map<String, Object> params);

    int countActivityHistory(Map<String, Object> params);

    List<Map<String, String>> selectActivityHistory(Map<String, Object> params);
}
