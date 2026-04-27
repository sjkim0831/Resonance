package egovframework.com.framework.builder.model;

import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class FrameworkBuilderMigrationPlanVO {

    private String migrationPlanId;
    private String fromBuilderVersion;
    private String toBuilderVersion;
    private List<String> fromSourceContractVersions = new ArrayList<>();
    private List<String> toSourceContractVersions = new ArrayList<>();
    private List<String> fromOverlaySchemaVersions = new ArrayList<>();
    private List<String> toOverlaySchemaVersions = new ArrayList<>();
    private Boolean manualReviewRequiredYn;
    private String status;
}
