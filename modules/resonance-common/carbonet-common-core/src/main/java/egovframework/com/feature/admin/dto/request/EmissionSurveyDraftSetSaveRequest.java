package egovframework.com.feature.admin.dto.request;

import lombok.Getter;
import lombok.Setter;

import java.util.List;
import java.util.Map;

@Getter
@Setter
public class EmissionSurveyDraftSetSaveRequest {

    private String setId;
    private String setName;
    private String sourceFileName;
    private String sourcePath;
    private String targetPath;
    private List<Map<String, Object>> sections;
}
