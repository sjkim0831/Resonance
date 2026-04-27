package egovframework.com.common.trace;

import egovframework.com.common.mapper.SystemAssetInventoryMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping({"/api/admin/system/asset", "/en/api/admin/system/asset"})
@RequiredArgsConstructor
public class SystemAssetApiController {

    private final ProjectAssetScannerService scannerService;
    private final SystemAssetInventoryMapper inventoryMapper;

    @PostMapping("/scan")
    public ProjectAssetScannerService.AssetScanSummary triggerScan() {
        return scannerService.runFullScan();
    }

    @GetMapping("/list")
    public List<SystemAssetInventoryVO> getAssetList(
            @RequestParam(required = false) String type,
            @RequestParam(required = false) String domain,
            @RequestParam(required = false) String health) {
        Map<String, Object> params = new HashMap<>();
        params.put("assetType", type);
        params.put("ownerDomain", domain);
        params.put("healthStatus", health);
        params.put("activeYn", "Y");
        return inventoryMapper.selectSystemAssetList(params);
    }

    @GetMapping("/detail")
    public Map<String, Object> getAssetDetail(@RequestParam String id) {
        Map<String, Object> response = new HashMap<>();
        SystemAssetInventoryVO asset = inventoryMapper.selectSystemAsset(id);
        if (asset != null) {
            response.put("asset", asset);
            response.put("compositions", inventoryMapper.selectSystemAssetCompositions(id));
            response.put("scanLogs", inventoryMapper.selectSystemAssetScanLogList(id));
        }
        return response;
    }

    @GetMapping("/impact")
    public Map<String, Object> getAssetImpact(@RequestParam String id) {
        Map<String, Object> response = new HashMap<>();
        SystemAssetInventoryVO asset = inventoryMapper.selectSystemAsset(id);
        if (asset == null) {
            return response;
        }
        
        response.put("asset", asset);
        
        // Downstream: What does this asset depend on?
        List<SystemAssetCompositionVO> downstreamRaw = inventoryMapper.selectSystemAssetCompositions(id);
        response.put("downstream", enrichCompositionList(downstreamRaw, true));
        
        // Upstream: What depends on this asset?
        List<SystemAssetCompositionVO> upstreamRaw = inventoryMapper.selectSystemAssetUpstreamCompositions(id);
        response.put("upstream", enrichCompositionList(upstreamRaw, false));
        
        return response;
    }

    @GetMapping("/gap")
    public Map<String, Object> getAssetGap(
            @RequestParam(required = false) String type) {
        Map<String, Object> response = new HashMap<>();
        response.put("summary", inventoryMapper.selectSystemAssetGapSummary());
        if (type != null && !type.isEmpty()) {
            response.put("assets", inventoryMapper.selectSystemAssetListByGapType(type));
        }
        return response;
    }

    @GetMapping("/lifecycle")
    public Map<String, Object> getAssetLifecycle(@RequestParam(required = false) String id) {
        Map<String, Object> response = new HashMap<>();
        Map<String, Object> params = new HashMap<>();
        
        params.put("activeYn", "Y");
        response.put("activeCount", inventoryMapper.selectSystemAssetList(params).size());
        
        params.put("activeYn", "N");
        response.put("inactiveCount", inventoryMapper.selectSystemAssetList(params).size());
        
        response.put("totalCount", inventoryMapper.selectSystemAssetList(new HashMap<>()).size());

        // Lifecycle Plans
        Map<String, Object> planParams = new HashMap<>();
        if (id != null && !id.isEmpty()) {
            planParams.put("assetId", id);
        }
        List<SystemAssetLifecyclePlanVO> plans = inventoryMapper.selectSystemAssetLifecyclePlanList(planParams);
        response.put("plans", plans);

        // Evidence Count (Simplified: sum of all evidence for these plans)
        int evidenceCount = 0;
        for (SystemAssetLifecyclePlanVO plan : plans) {
            evidenceCount += inventoryMapper.selectSystemAssetLifecycleEvidenceList(plan.getPlanId()).size();
        }
        response.put("totalEvidenceCount", evidenceCount);
        
        return response;
    }

    @PostMapping("/update")
    public Map<String, Object> updateAsset(
            @RequestParam String id,
            @RequestParam(required = false) String assetFamily,
            @RequestParam(required = false) String ownerDomain,
            @RequestParam(required = false) String ownerScope,
            @RequestParam(required = false) String operatorOwner,
            @RequestParam(required = false) String serviceOwner,
            @RequestParam(required = false) String criticality,
            @RequestParam(required = false) String activeYn,
            @RequestParam(defaultValue = "false") boolean propagate) {
        
        Map<String, Object> response = new HashMap<>();
        SystemAssetInventoryVO asset = inventoryMapper.selectSystemAsset(id);
        if (asset == null) {
            response.put("success", false);
            response.put("message", "Asset not found");
            return response;
        }

        if (assetFamily != null) asset.setAssetFamily(assetFamily);
        if (ownerDomain != null) asset.setOwnerDomain(ownerDomain);
        if (ownerScope != null) asset.setOwnerScope(ownerScope);
        if (operatorOwner != null) asset.setOperatorOwner(operatorOwner);
        if (serviceOwner != null) asset.setServiceOwner(serviceOwner);
        if (criticality != null) asset.setCriticality(criticality);
        if (activeYn != null) asset.setActiveYn(activeYn);
        
        inventoryMapper.updateSystemAsset(asset);
        int affectedCount = 1;

        if (propagate) {
            affectedCount += propagateAttributes(id, assetFamily, ownerDomain, ownerScope, operatorOwner, serviceOwner, criticality);
        }

        response.put("success", true);
        response.put("affectedCount", affectedCount);
        return response;
    }

    @PostMapping("/lifecycle/plan/create")
    public Map<String, Object> createLifecyclePlan(@org.springframework.web.bind.annotation.RequestBody SystemAssetLifecyclePlanVO plan) {
        Map<String, Object> response = new HashMap<>();
        String planId = "LCP-" + java.util.UUID.randomUUID().toString().substring(0, 8);
        plan.setPlanId(planId);
        plan.setPlanStatus("PENDING");
        
        inventoryMapper.insertSystemAssetLifecyclePlan(plan);
        
        response.put("success", true);
        response.put("planId", planId);
        return response;
    }

    @GetMapping("/lifecycle/plan/list")
    public List<SystemAssetLifecyclePlanVO> getLifecyclePlanList(
            @RequestParam(required = false) String assetId,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String stage) {
        Map<String, Object> params = new HashMap<>();
        params.put("assetId", assetId);
        params.put("status", status);
        params.put("stage", stage);
        return inventoryMapper.selectSystemAssetLifecyclePlanList(params);
    }

    @PostMapping("/lifecycle/plan/approve")
    public Map<String, Object> approveLifecyclePlan(
            @RequestParam String planId,
            @RequestParam String approverId,
            @RequestParam String status) {
        Map<String, Object> response = new HashMap<>();
        Map<String, Object> params = new HashMap<>();
        params.put("planId", planId);
        params.put("approverId", approverId);
        params.put("status", status);
        
        inventoryMapper.updateSystemAssetLifecyclePlanStatus(params);
        
        response.put("success", true);
        return response;
    }

    private int propagateAttributes(String parentId, String family, String owner, String scope, String operator, String service, String criticality) {
        int count = 0;
        List<SystemAssetCompositionVO> children = inventoryMapper.selectSystemAssetCompositions(parentId);
        for (SystemAssetCompositionVO comp : children) {
            SystemAssetInventoryVO child = inventoryMapper.selectSystemAsset(comp.getChildAssetId());
            if (child != null) {
                boolean changed = false;
                if (family != null && (child.getAssetFamily() == null || child.getAssetFamily().isEmpty())) {
                    child.setAssetFamily(family);
                    changed = true;
                }
                if (owner != null && (child.getOwnerDomain() == null || child.getOwnerDomain().isEmpty())) {
                    child.setOwnerDomain(owner);
                    changed = true;
                }
                if (scope != null && (child.getOwnerScope() == null || child.getOwnerScope().isEmpty())) {
                    child.setOwnerScope(scope);
                    changed = true;
                }
                if (operator != null && (child.getOperatorOwner() == null || child.getOperatorOwner().isEmpty())) {
                    child.setOperatorOwner(operator);
                    changed = true;
                }
                if (service != null && (child.getServiceOwner() == null || child.getServiceOwner().isEmpty())) {
                    child.setServiceOwner(service);
                    changed = true;
                }
                if (criticality != null && (child.getCriticality() == null || child.getCriticality().isEmpty())) {
                    child.setCriticality(criticality);
                    changed = true;
                }
                if (changed) {
                    inventoryMapper.updateSystemAsset(child);
                    count++;
                    // Recursive propagation
                    count += propagateAttributes(child.getAssetId(), family, owner, scope, operator, service, criticality);
                }
            }
        }
        return count;
    }

    private List<Map<String, Object>> enrichCompositionList(List<SystemAssetCompositionVO> compositions, boolean isDownstream) {
        java.util.ArrayList<Map<String, Object>> enriched = new java.util.ArrayList<>();
        for (SystemAssetCompositionVO comp : compositions) {
            String targetId = isDownstream ? comp.getChildAssetId() : comp.getParentAssetId();
            SystemAssetInventoryVO targetAsset = inventoryMapper.selectSystemAsset(targetId);
            
            Map<String, Object> item = new HashMap<>();
            item.put("composition", comp);
            item.put("asset", targetAsset);
            enriched.add(item);
        }
        return enriched;
    }
}
