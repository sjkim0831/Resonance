package egovframework.com.common.trace;

import lombok.Getter;
import lombok.Setter;
import lombok.ToString;
import java.time.LocalDateTime;

@Getter
@Setter
@ToString
public class SystemAssetLifecyclePlanVO {
    private String planId;
    private String assetId;
    private String targetStage;
    private String planStatus;
    private String requesterId;
    private String approverId;
    private LocalDateTime targetDate;
    private String reason;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
}
