package egovframework.com.framework.builder.model;

import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class FrameworkBuilderContractVO {

    private String frameworkId;
    private String frameworkName;
    private String contractVersion;
    private String source;
    private String generatedAt;
    private List<FrameworkBuilderPageContractVO> pages = new ArrayList<>();
    private List<FrameworkBuilderComponentContractVO> components = new ArrayList<>();
    private FrameworkBuilderProfilesVO builderProfiles = new FrameworkBuilderProfilesVO();
}

