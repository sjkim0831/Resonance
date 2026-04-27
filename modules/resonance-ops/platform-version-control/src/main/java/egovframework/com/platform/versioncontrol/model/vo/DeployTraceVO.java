package egovframework.com.platform.versioncontrol.model.vo;

import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

@Getter
@Setter
public class DeployTraceVO {
    private String deployTraceId;
    private String runtimePackageId;
    private String targetEnv; // LOCAL, DEV, STAGING, PROD
    private String deployStatus; // START, SUCCESS, FAILURE, ROLLBACK
    private String operatorId;
    private String deployLog;
    private LocalDateTime startedAt;
    private LocalDateTime finishedAt;
    
    // Query parameters
    private String projectId;
}
