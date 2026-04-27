package egovframework.com.framework.builder.model;

import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class FrameworkBuilderCompatibilityDeclarationVO {

    private String compatibilityDeclarationId;
    private String builderVersion;
    private String builderRulePackVersion;
    private String templatePackVersion;
    private List<String> supportedSourceContractVersions = new ArrayList<>();
    private List<String> supportedOverlaySchemaVersions = new ArrayList<>();
    private String emittedManifestContractVersion;
    private String emittedAuthorityContractVersion;
    private String releaseCompatibilityVersion;
    private String compatibilityVerdict;
    private Boolean breakingChangeYn;
    private String status;
}
