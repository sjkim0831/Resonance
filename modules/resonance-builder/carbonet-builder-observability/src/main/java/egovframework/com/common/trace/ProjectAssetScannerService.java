package egovframework.com.common.trace;

import egovframework.com.common.mapper.SystemAssetInventoryMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
@Slf4j
@RequiredArgsConstructor
public class ProjectAssetScannerService {

    private final SystemAssetInventoryMapper inventoryMapper;
    private final List<AssetScanProvider> scanProviders;

    @Transactional
    public AssetScanSummary runFullScan() {
        log.info("[AssetScanner] Starting full system asset scan...");
        long startTime = System.currentTimeMillis();
        
        int totalProcessed = 0;
        int newAssets = 0;
        int updatedAssets = 0;
        int driftedAssets = 0;

        for (AssetScanProvider provider : scanProviders) {
            List<SystemAssetInventoryVO> scannedAssets = provider.scan();
            for (SystemAssetInventoryVO scanned : scannedAssets) {
                totalProcessed++;
                SystemAssetInventoryVO existing = inventoryMapper.selectSystemAsset(scanned.getAssetId());
                
                if (existing == null) {
                    scanned.setLastScanAt(LocalDateTime.now());
                    scanned.setHealthStatus("OK");
                    inventoryMapper.insertSystemAsset(scanned);
                    recordScanLog(scanned.getAssetId(), null, scanned.getContentHash(), "NEW", "Initial scan discovery");
                    newAssets++;
                } else {
                    boolean hashChanged = !safeEquals(existing.getContentHash(), scanned.getContentHash());
                    if (hashChanged) {
                        existing.setContentHash(scanned.getContentHash());
                        existing.setHealthStatus("DRIFTED");
                        existing.setLastScanAt(LocalDateTime.now());
                        existing.setUpdatedAt(LocalDateTime.now());
                        inventoryMapper.updateSystemAsset(existing);
                        recordScanLog(existing.getAssetId(), existing.getContentHash(), scanned.getContentHash(), "CHANGED", "Content drift detected during scan");
                        driftedAssets++;
                        updatedAssets++;
                    } else {
                        existing.setLastScanAt(LocalDateTime.now());
                        existing.setHealthStatus("OK");
                        inventoryMapper.updateSystemAsset(existing);
                    }
                }
            }
            
            // Handle dependencies
            List<SystemAssetCompositionVO> scannedCompositions = provider.traceDependencies(scannedAssets);
            for (SystemAssetCompositionVO comp : scannedCompositions) {
                // Simplified: replace existing compositions for this parent
                inventoryMapper.deleteSystemAssetCompositions(comp.getParentAssetId());
                comp.setCompositionId(UUID.randomUUID().toString());
                comp.setCreatedAt(LocalDateTime.now());
                inventoryMapper.insertSystemAssetComposition(comp);
            }
        }

        long duration = System.currentTimeMillis() - startTime;
        log.info("[AssetScanner] Full scan completed in {}ms. Total: {}, New: {}, Updated: {}, Drifted: {}", 
                 duration, totalProcessed, newAssets, updatedAssets, driftedAssets);
        
        return new AssetScanSummary(totalProcessed, newAssets, updatedAssets, driftedAssets, duration);
    }

    private void recordScanLog(String assetId, String prevHash, String currHash, String result, String details) {
        SystemAssetScanLogVO scanLog = new SystemAssetScanLogVO();
        scanLog.setScanId(UUID.randomUUID().toString());
        scanLog.setAssetId(assetId);
        scanLog.setPreviousHash(prevHash);
        scanLog.setCurrentHash(currHash);
        scanLog.setScanResult(result);
        scanLog.setScanDetails(details);
        scanLog.setCreatedAt(LocalDateTime.now());
        inventoryMapper.insertSystemAssetScanLog(scanLog);
    }

    private boolean safeEquals(String a, String b) {
        if (a == null && b == null) return true;
        if (a == null || b == null) return false;
        return a.equals(b);
    }

    @lombok.Value
    public static class AssetScanSummary {
        int total;
        int newCount;
        int updatedCount;
        int driftedCount;
        long durationMs;
    }
}
