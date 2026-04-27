package egovframework.com.platform.observability.model;

import lombok.Getter;

import java.util.Collections;
import java.util.List;

@Getter
public class EmissionResultFilterSnapshot {

    private final List<EmissionResultSummaryView> items;
    private final long reviewCount;
    private final long verifiedCount;

    public EmissionResultFilterSnapshot(List<EmissionResultSummaryView> items, long reviewCount, long verifiedCount) {
        this.items = items == null ? Collections.emptyList() : items;
        this.reviewCount = reviewCount;
        this.verifiedCount = verifiedCount;
    }

    public int getTotalCount() {
        return items.size();
    }
}
