package egovframework.com.common.trace;

import java.util.List;

public interface AssetScanProvider {
    /**
     * Scan for assets of a specific type.
     * @return List of discovered assets.
     */
    List<SystemAssetInventoryVO> scan();
    
    /**
     * Identify relationships between assets.
     * @return List of discovered compositions/dependencies.
     */
    List<SystemAssetCompositionVO> traceDependencies(List<SystemAssetInventoryVO> assets);
}
