package egovframework.com.common.trace;

import lombok.Getter;
import lombok.Setter;
import lombok.ToString;
import java.time.LocalDateTime;

@Getter
@Setter
@ToString
public class SystemAssetLifecycleEvidenceVO {
    private String evidenceId;
    private String planId;
    private String checkpointKey;
    private String evidenceType;
    private String evidenceValue;
    private String verifiedBy;
    private LocalDateTime createdAt;
}
