package egovframework.com.platform.versioncontrol.model.vo;

import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;

@Getter
@Setter
public class ReleaseUnitVO {
    private String releaseUnitId;
    private String projectId;
    private String releaseVersion;
    private String releaseStatus; // DRAFT, PUBLISHED, DEPLOYED, ARCHIVED
    private String description;
    private String createdBy;
    private LocalDateTime createdAt;
    private String updatedBy;
    private LocalDateTime updatedAt;
}
