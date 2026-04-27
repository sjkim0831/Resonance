package egovframework.com.common.trace;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import egovframework.com.platform.service.observability.AdminSchedulerBootstrapReadPort;
import egovframework.com.platform.service.observability.BackupConfigManagementPort;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Scan for runtime infrastructure assets: environment, node, scheduler, batch, backup, restore.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class RuntimeAssetScanProvider implements AssetScanProvider {

    private final AdminSchedulerBootstrapReadPort schedulerService;
    private final BackupConfigManagementPort backupService;

    @Override
    public List<SystemAssetInventoryVO> scan() {
        List<SystemAssetInventoryVO> assets = new ArrayList<>();
        LocalDateTime now = LocalDateTime.now();

        // 1. Scan Schedulers and Nodes
        try {
            Map<String, Object> schedulerData = schedulerService.buildSchedulerPageData("", "", false);
            
            // Nodes
            List<Map<String, String>> nodes = (List<Map<String, String>>) schedulerData.get("schedulerNodeRows");
            if (nodes != null) {
                for (Map<String, String> node : nodes) {
                    SystemAssetInventoryVO asset = new SystemAssetInventoryVO();
                    asset.setAssetId("NODE-" + node.get("nodeId"));
                    asset.setAssetType("NODE");
                    asset.setAssetName(node.get("nodeId"));
                    asset.setAssetFamily("INFRA");
                    asset.setOwnerDomain("platform");
                    asset.setOwnerScope("GLOBAL");
                    asset.setOperatorOwner("PLATFORM_OPS");
                    asset.setServiceOwner("PLATFORM_TEAM");
                    asset.setCriticality("HIGH");
                    asset.setHealthStatus("OK");
                    asset.setLastScanAt(now);
                    asset.setCreatedAt(now);
                    asset.setUpdatedAt(now);
                    asset.setContentHash(generateHash(node));
                    assets.add(asset);
                }
            }

            // Scheduler Jobs
            List<Map<String, String>> jobs = (List<Map<String, String>>) schedulerData.get("schedulerJobRows");
            if (jobs != null) {
                for (Map<String, String> job : jobs) {
                    SystemAssetInventoryVO asset = new SystemAssetInventoryVO();
                    asset.setAssetId("SCHEDULER-" + job.get("jobId"));
                    asset.setAssetType("SCHEDULER");
                    asset.setAssetName(job.get("jobName"));
                    asset.setAssetFamily("INFRA");
                    asset.setOwnerDomain("admin");
                    asset.setOwnerScope("PROJECT");
                    asset.setOperatorOwner("APP_OPS");
                    asset.setServiceOwner("APP_TEAM");
                    asset.setCriticality("MEDIUM");
                    asset.setHealthStatus("OK");
                    asset.setLastScanAt(now);
                    asset.setCreatedAt(now);
                    asset.setUpdatedAt(now);
                    asset.setContentHash(generateHash(job));
                    assets.add(asset);
                }
            }
        } catch (Exception e) {
            log.error("Failed to scan scheduler assets", e);
        }

        // 2. Scan Backup and Restore configurations
        try {
            Map<String, Object> backupData = backupService.buildPageData(false);
            
            // Backup Config is an asset
            SystemAssetInventoryVO backupAsset = new SystemAssetInventoryVO();
            backupAsset.setAssetId("BACKUP-CONFIG-001");
            backupAsset.setAssetType("BACKUP");
            backupAsset.setAssetName("System Backup Configuration");
            backupAsset.setAssetFamily("RECOVERY");
            backupAsset.setOwnerDomain("platform");
            backupAsset.setOwnerScope("GLOBAL");
            backupAsset.setOperatorOwner("PLATFORM_OPS");
            backupAsset.setServiceOwner("PLATFORM_TEAM");
            backupAsset.setCriticality("CRITICAL");
            backupAsset.setHealthStatus("OK");
            backupAsset.setLastScanAt(now);
            backupAsset.setCreatedAt(now);
            backupAsset.setUpdatedAt(now);
            backupAsset.setContentHash(generateHash(backupData.get("backupConfigForm")));
            assets.add(backupAsset);

        } catch (Exception e) {
            log.error("Failed to scan backup assets", e);
        }

        // 3. Environment Asset (Static for now, representing the core runtime)
        SystemAssetInventoryVO envAsset = new SystemAssetInventoryVO();
        envAsset.setAssetId("ENV-PROD-001");
        envAsset.setAssetType("ENVIRONMENT");
        envAsset.setAssetName("Carbonet Production Cluster");
        envAsset.setAssetFamily("INFRA");
        envAsset.setOwnerDomain("platform");
        envAsset.setOwnerScope("GLOBAL");
        envAsset.setOperatorOwner("PLATFORM_OPS");
        envAsset.setServiceOwner("PLATFORM_TEAM");
        envAsset.setCriticality("CRITICAL");
        envAsset.setHealthStatus("OK");
        envAsset.setLastScanAt(now);
        envAsset.setCreatedAt(now);
        envAsset.setUpdatedAt(now);
        envAsset.setContentHash("static-prod-env-hash");
        assets.add(envAsset);

        return assets;
    }

    @Override
    public List<SystemAssetCompositionVO> traceDependencies(List<SystemAssetInventoryVO> assets) {
        List<SystemAssetCompositionVO> compositions = new ArrayList<>();
        
        // Find Environment and Node assets to link them
        String envId = "ENV-PROD-001";
        
        for (SystemAssetInventoryVO asset : assets) {
            if ("NODE".equals(asset.getAssetType())) {
                compositions.add(createComposition(envId, asset.getAssetId(), "HOSTS"));
            } else if ("SCHEDULER".equals(asset.getAssetType())) {
                // Link scheduler to production environment by default for now
                compositions.add(createComposition(envId, asset.getAssetId(), "RUNS_IN"));
            } else if ("BACKUP".equals(asset.getAssetType())) {
                compositions.add(createComposition(envId, asset.getAssetId(), "PROTECTS"));
            }
        }
        
        return compositions;
    }

    private SystemAssetCompositionVO createComposition(String parentId, String childId, String type) {
        SystemAssetCompositionVO composition = new SystemAssetCompositionVO();
        composition.setParentAssetId(parentId);
        composition.setChildAssetId(childId);
        composition.setRelationType(type);
        composition.setCreatedAt(LocalDateTime.now());
        return composition;
    }

    private String generateHash(Object obj) {
        return Integer.toHexString(obj == null ? 0 : obj.hashCode());
    }
}
