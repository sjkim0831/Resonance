package egovframework.com.platform.dbchange.mapper;

import egovframework.com.common.mapper.support.BaseMapperSupport;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component("dbChangeCaptureMapper")
public class DbChangeCaptureMapper extends BaseMapperSupport {

    public List<Map<String, Object>> selectAllPromotionPolicies() {
        return selectList("DbChangeCaptureMapper.selectAllPromotionPolicies");
    }

    public Map<String, Object> selectPromotionPolicyByTableName(String tableName) {
        return selectOne("DbChangeCaptureMapper.selectPromotionPolicyByTableName", tableName);
    }

    public void insertPromotionPolicy(Map<String, Object> params) {
        insert("DbChangeCaptureMapper.insertPromotionPolicy", params);
    }

    public void updatePromotionPolicy(Map<String, Object> params) {
        update("DbChangeCaptureMapper.updatePromotionPolicy", params);
    }

    public void insertBusinessChangeLog(Map<String, Object> params) {
        insert("DbChangeCaptureMapper.insertBusinessChangeLog", params);
    }

    public void insertDeployableDbPatchQueue(Map<String, Object> params) {
        insert("DbChangeCaptureMapper.insertDeployableDbPatchQueue", params);
    }

    public Map<String, Object> selectChangeCaptureSummary(String projectId) {
        return selectOne("DbChangeCaptureMapper.selectChangeCaptureSummary", projectId);
    }

    public java.util.List<Map<String, Object>> selectRecentBusinessChangeLogs(Map<String, Object> params) {
        return selectList("DbChangeCaptureMapper.selectRecentBusinessChangeLogs", params);
    }

    public List<Map<String, Object>> selectBusinessChangeLogsForProjectTable(Map<String, Object> params) {
        return selectList("DbChangeCaptureMapper.selectBusinessChangeLogsForProjectTable", params);
    }

    public java.util.List<Map<String, Object>> selectDeployableDbPatchQueueList(Map<String, Object> params) {
        return selectList("DbChangeCaptureMapper.selectDeployableDbPatchQueueList", params);
    }

    public java.util.List<Map<String, Object>> selectDeployableDbPatchResultList(Map<String, Object> params) {
        return selectList("DbChangeCaptureMapper.selectDeployableDbPatchResultList", params);
    }

    public Map<String, Object> selectBusinessChangeLogById(String changeLogId) {
        return selectOne("DbChangeCaptureMapper.selectBusinessChangeLogById", changeLogId);
    }

    public Map<String, Object> selectDeployableDbPatchQueueById(String queueId) {
        return selectOne("DbChangeCaptureMapper.selectDeployableDbPatchQueueById", queueId);
    }

    public void updateBusinessChangeLogQueueLink(Map<String, Object> params) {
        update("DbChangeCaptureMapper.updateBusinessChangeLogQueueLink", params);
    }

    public void updateBusinessChangeLogApprovalByQueueId(Map<String, Object> params) {
        update("DbChangeCaptureMapper.updateBusinessChangeLogApprovalByQueueId", params);
    }

    public void updateDeployableDbPatchQueueApproval(Map<String, Object> params) {
        update("DbChangeCaptureMapper.updateDeployableDbPatchQueueApproval", params);
    }

    public void updateDeployableDbPatchQueueApply(Map<String, Object> params) {
        update("DbChangeCaptureMapper.updateDeployableDbPatchQueueApply", params);
    }

    public void insertDeployableDbPatchResult(Map<String, Object> params) {
        insert("DbChangeCaptureMapper.insertDeployableDbPatchResult", params);
    }
}
