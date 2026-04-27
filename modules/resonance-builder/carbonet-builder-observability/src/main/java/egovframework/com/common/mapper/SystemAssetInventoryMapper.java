package egovframework.com.common.mapper;

import egovframework.com.common.mapper.support.BaseMapperSupport;
import egovframework.com.common.trace.SystemAssetCompositionVO;
import egovframework.com.common.trace.SystemAssetInventoryVO;
import egovframework.com.common.trace.SystemAssetLifecycleEvidenceVO;
import egovframework.com.common.trace.SystemAssetLifecyclePlanVO;
import egovframework.com.common.trace.SystemAssetScanLogVO;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component("systemAssetInventoryMapper")
public class SystemAssetInventoryMapper extends BaseMapperSupport {
    private static final String NAMESPACE = "egovframework.com.common.mapper.SystemAssetInventoryMapper";

    public int countSystemAsset(String assetId) {
        Integer count = selectOne(NAMESPACE + ".countSystemAsset", assetId);
        return count == null ? 0 : count;
    }

    public SystemAssetInventoryVO selectSystemAsset(String assetId) {
        return selectOne(NAMESPACE + ".selectSystemAsset", assetId);
    }

    public List<SystemAssetInventoryVO> selectSystemAssetList(Map<String, Object> params) {
        return selectList(NAMESPACE + ".selectSystemAssetList", params);
    }

    public void insertSystemAsset(SystemAssetInventoryVO asset) {
        insert(NAMESPACE + ".insertSystemAsset", asset);
    }

    public void updateSystemAsset(SystemAssetInventoryVO asset) {
        update(NAMESPACE + ".updateSystemAsset", asset);
    }

    public void deleteSystemAsset(String assetId) {
        delete(NAMESPACE + ".deleteSystemAsset", assetId);
    }

    public void insertSystemAssetComposition(SystemAssetCompositionVO composition) {
        insert(NAMESPACE + ".insertSystemAssetComposition", composition);
    }

    public void deleteSystemAssetCompositions(String parentAssetId) {
        delete(NAMESPACE + ".deleteSystemAssetCompositions", parentAssetId);
    }

    public List<SystemAssetCompositionVO> selectSystemAssetCompositions(String parentAssetId) {
        return selectList(NAMESPACE + ".selectSystemAssetCompositions", parentAssetId);
    }

    public List<SystemAssetCompositionVO> selectSystemAssetUpstreamCompositions(String childAssetId) {
        return selectList(NAMESPACE + ".selectSystemAssetUpstreamCompositions", childAssetId);
    }

    public void insertSystemAssetScanLog(SystemAssetScanLogVO log) {
        insert(NAMESPACE + ".insertSystemAssetScanLog", log);
    }

    public List<SystemAssetScanLogVO> selectSystemAssetScanLogList(String assetId) {
        return selectList(NAMESPACE + ".selectSystemAssetScanLogList", assetId);
    }

    public Map<String, Object> selectSystemAssetGapSummary() {
        return selectOne(NAMESPACE + ".selectSystemAssetGapSummary");
    }

    public List<SystemAssetInventoryVO> selectSystemAssetListByGapType(String gapType) {
        return selectList(NAMESPACE + ".selectSystemAssetListByGapType", gapType);
    }

    public void insertSystemAssetLifecyclePlan(SystemAssetLifecyclePlanVO plan) {
        insert(NAMESPACE + ".insertSystemAssetLifecyclePlan", plan);
    }

    public void updateSystemAssetLifecyclePlanStatus(Map<String, Object> params) {
        update(NAMESPACE + ".updateSystemAssetLifecyclePlanStatus", params);
    }

    public List<SystemAssetLifecyclePlanVO> selectSystemAssetLifecyclePlanList(Map<String, Object> params) {
        return selectList(NAMESPACE + ".selectSystemAssetLifecyclePlanList", params);
    }

    public void insertSystemAssetLifecycleEvidence(SystemAssetLifecycleEvidenceVO evidence) {
        insert(NAMESPACE + ".insertSystemAssetLifecycleEvidence", evidence);
    }

    public List<SystemAssetLifecycleEvidenceVO> selectSystemAssetLifecycleEvidenceList(String planId) {
        return selectList(NAMESPACE + ".selectSystemAssetLifecycleEvidenceList", planId);
    }
}
