package egovframework.com.feature.admin.dto.request;

import lombok.Getter;
import lombok.Setter;

import java.util.List;
import java.util.Map;

@Getter
@Setter
public class EmissionSurveyCaseSaveRequest {

    private String ownerActorId;
    private String datasetId;
    private String datasetName;
    private String productName;
    private String sectionCode;
    private String caseCode;
    private String majorCode;
    private String lciMajorCode;
    private String lciMajorLabel;
    private String lciMiddleCode;
    private String lciMiddleLabel;
    private String lciSmallCode;
    private String lciSmallLabel;
    private String sectionLabel;
    private String sourceFileName;
    private String sourcePath;
    private String targetPath;
    private String titleRowLabel;
    private List<String> guidance;
    private List<Map<String, String>> columns;
    private List<Map<String, Object>> rows;
}
