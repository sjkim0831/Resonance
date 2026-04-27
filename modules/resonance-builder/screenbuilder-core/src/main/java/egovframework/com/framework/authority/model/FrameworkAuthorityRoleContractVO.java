package egovframework.com.framework.authority.model;

import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class FrameworkAuthorityRoleContractVO {

    private String roleKey;
    private String authorCode;
    private String label;
    private String description;
    private String tier;
    private String actorType;
    private String scopePolicy;
    private Integer hierarchyLevel;
    private List<String> inherits = new ArrayList<>();
    private List<String> featureCodes = new ArrayList<>();
    private Boolean builtIn;
    private Boolean builderReady;
}

