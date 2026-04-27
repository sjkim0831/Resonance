package egovframework.com.common.trace;

import egovframework.com.common.mapper.UiObservabilityRegistryMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Component
@RequiredArgsConstructor
public class UiAssetScanProvider implements AssetScanProvider {

    private final UiObservabilityRegistryMapper uiRegistryMapper;

    @Override
    public List<SystemAssetInventoryVO> scan() {
        List<SystemAssetInventoryVO> assets = new ArrayList<>();
        
        // Scan Pages from existing UI_PAGE_MANIFEST
        List<UiPageManifestVO> pages = uiRegistryMapper.selectUiPageManifestList();
        for (UiPageManifestVO page : pages) {
            SystemAssetInventoryVO asset = new SystemAssetInventoryVO();
            asset.setAssetId("PAGE-" + page.getPageId());
            asset.setAssetType("PAGE");
            asset.setAssetName(page.getPageName());
            asset.setAssetFamily("SERVICE");
            asset.setSourcePath("frontend/src/features/" + page.getPageId()); // Heuristic
            asset.setSourceSymbol(page.getRoutePath());
            asset.setOwnerDomain(page.getDomainCode());
            asset.setOwnerScope("PROJECT");
            asset.setCriticality("MEDIUM");
            asset.setHealthStatus("OK");
            asset.setLastScanAt(LocalDateTime.now());
            asset.setContentHash(generateHash(page));
            asset.setActiveYn(page.getActiveYn());
            asset.setCreatedAt(LocalDateTime.now());
            asset.setUpdatedAt(LocalDateTime.now());
            assets.add(asset);
        }

        // Scan Components from existing UI_COMPONENT_REGISTRY
        List<UiComponentRegistryVO> components = uiRegistryMapper.selectUiComponentRegistryList();
        for (UiComponentRegistryVO comp : components) {
            SystemAssetInventoryVO asset = new SystemAssetInventoryVO();
            asset.setAssetId("COMP-" + comp.getComponentId());
            asset.setAssetType("COMPONENT");
            asset.setAssetName(comp.getComponentName());
            asset.setSourcePath(comp.getDesignReference());
            asset.setSourceSymbol(comp.getComponentType());
            asset.setOwnerDomain(comp.getOwnerDomain());
            asset.setContentHash(generateHash(comp));
            asset.setActiveYn(comp.getActiveYn());
            asset.setCreatedAt(LocalDateTime.now());
            asset.setUpdatedAt(LocalDateTime.now());
            assets.add(asset);
        }

        return assets;
    }

    @Override
    public List<SystemAssetCompositionVO> traceDependencies(List<SystemAssetInventoryVO> assets) {
        List<SystemAssetCompositionVO> compositions = new ArrayList<>();
        
        // Use existing UI_PAGE_COMPONENT_MAP to build relations
        List<UiPageManifestVO> pages = uiRegistryMapper.selectUiPageManifestList();
        for (UiPageManifestVO page : pages) {
            List<UiPageComponentDetailVO> details = uiRegistryMapper.selectUiPageComponentDetails(page.getPageId());
            for (UiPageComponentDetailVO detail : details) {
                SystemAssetCompositionVO comp = new SystemAssetCompositionVO();
                comp.setParentAssetId("PAGE-" + page.getPageId());
                comp.setChildAssetId("COMP-" + detail.getComponentId());
                comp.setRelationType("CONTAINS");
                comp.setMappingNotes("Layout Zone: " + detail.getLayoutZone());
                compositions.add(comp);
            }
        }
        
        return compositions;
    }

    private String generateHash(Object obj) {
        // Simplified hash for demo; in production use a more robust object-to-string-to-hash
        return Integer.toHexString(obj.hashCode());
    }
}
