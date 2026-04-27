package egovframework.com.feature.admin.model.vo;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AdminSummarySnapshotVO {

    private String snapshotKey;
    private String snapshotJson;
    private String snapshotType;
    private String sourceUpdatedAt;
    private String lastComputedAt;
    private String useAt;
}
