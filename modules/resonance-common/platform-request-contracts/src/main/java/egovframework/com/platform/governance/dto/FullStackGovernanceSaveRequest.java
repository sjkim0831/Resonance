package egovframework.com.platform.governance.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class FullStackGovernanceSaveRequest {

    private String menuCode;
    private String pageId;
    private String menuUrl;
    private String summary;
    private String ownerScope;
    private String notes;
    private List<String> frontendSources;
    private List<String> componentIds;
    private List<String> eventIds;
    private List<String> functionIds;
    private List<String> parameterSpecs;
    private List<String> resultSpecs;
    private List<String> apiIds;
    private List<String> controllerActions;
    private List<String> serviceMethods;
    private List<String> mapperQueries;
    private List<String> schemaIds;
    private List<String> tableNames;
    private List<String> columnNames;
    private List<String> featureCodes;
    private List<String> commonCodeGroups;
    private List<String> tags;
}
