package egovframework.com.framework.contract.model;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class FrameworkContractMetadataVO {

    private String frameworkId;
    private String frameworkName;
    private String contractVersion;
    private String authorityPolicyId;
    private FrameworkBuilderProfilesMetadataVO builderProfiles = new FrameworkBuilderProfilesMetadataVO();
    private FrameworkAuthorityDefaultsMetadataVO authorityDefaults = new FrameworkAuthorityDefaultsMetadataVO();
}
