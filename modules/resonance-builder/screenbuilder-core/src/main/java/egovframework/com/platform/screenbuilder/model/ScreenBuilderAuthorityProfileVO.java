package egovframework.com.platform.screenbuilder.model;

import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class ScreenBuilderAuthorityProfileVO {

    private String roleKey;
    private String authorCode;
    private String label;
    private String description;
    private String tier;
    private String actorType;
    private String scopePolicy;
    private Integer hierarchyLevel;
    private List<String> featureCodes = new ArrayList<>();
    private List<String> tags = new ArrayList<>();
}
