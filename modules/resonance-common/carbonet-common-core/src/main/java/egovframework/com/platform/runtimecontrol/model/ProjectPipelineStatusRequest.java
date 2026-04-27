package egovframework.com.platform.runtimecontrol.model;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ProjectPipelineStatusRequest {

    private String pipelineRunId;
    private String projectId;
    private String releaseUnitId;
}
