package egovframework.com.platform.dbchange.service;

import java.util.List;
import java.util.Map;

public interface DbChangeQueueService {

    List<Map<String, Object>> getRecentBusinessChangeLogs(String projectId, int limit);

    List<Map<String, Object>> getDeployableQueueList(String projectId, int limit);

    List<Map<String, Object>> getDeployableResultList(String projectId, int limit);

    Map<String, Object> queueChangeLog(String changeLogId, String actorId, Map<String, Object> options);

    Map<String, Object> approveQueue(String queueId, String actorId);

    Map<String, Object> rejectQueue(String queueId, String actorId, String reason);

    Map<String, Object> executeQueue(String queueId, String actorId, Map<String, Object> options);
}
