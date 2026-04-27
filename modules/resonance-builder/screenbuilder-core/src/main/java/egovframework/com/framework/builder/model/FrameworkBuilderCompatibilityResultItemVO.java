package egovframework.com.framework.builder.model;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class FrameworkBuilderCompatibilityResultItemVO {

    private String resultType;
    private String targetScope;
    private String targetKey;
    private String severity;
    private String ruleCode;
    private String summary;
    private Boolean blockingYn;
}
