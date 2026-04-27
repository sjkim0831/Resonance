package egovframework.com.platform.governance.model.vo;

import lombok.Getter;

@Getter
public class FeatureCatalogSummarySnapshot {

    private final int totalFeatureCount;
    private final int unassignedFeatureCount;

    public FeatureCatalogSummarySnapshot(int totalFeatureCount, int unassignedFeatureCount) {
        this.totalFeatureCount = totalFeatureCount;
        this.unassignedFeatureCount = unassignedFeatureCount;
    }

    public static FeatureCatalogSummarySnapshot empty() {
        return new FeatureCatalogSummarySnapshot(0, 0);
    }

    public int getTotalFeatureCount() {
        return totalFeatureCount;
    }

    public int getUnassignedFeatureCount() {
        return unassignedFeatureCount;
    }
}
