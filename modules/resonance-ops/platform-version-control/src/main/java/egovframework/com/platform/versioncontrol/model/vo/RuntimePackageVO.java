package egovframework.com.platform.versioncontrol.model.vo;

import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

@Getter
@Setter
public class RuntimePackageVO {
    private String runtimePackageId;
    private String releaseUnitId;
    private String packageType; // JAR, WAR, DOCKER
    private String packageHash; // SHA-256
    private String artifactPath;
    private long fileSize;
    private String buildRunId;
    private LocalDateTime createdAt;
}
