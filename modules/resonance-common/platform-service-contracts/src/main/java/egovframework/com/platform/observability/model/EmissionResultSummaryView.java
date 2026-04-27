package egovframework.com.platform.observability.model;

import lombok.Getter;

@Getter
public class EmissionResultSummaryView {

    private final String resultId;
    private final String projectName;
    private final String companyName;
    private final String calculatedAt;
    private final String totalEmission;
    private final String resultStatusCode;
    private final String resultStatusLabel;
    private final String verificationStatusCode;
    private final String verificationStatusLabel;
    private final String detailUrl;

    public EmissionResultSummaryView(String resultId, String projectName, String companyName,
                                     String calculatedAt, String totalEmission, String resultStatusCode,
                                     String resultStatusLabel, String verificationStatusCode,
                                     String verificationStatusLabel, String detailUrl) {
        this.resultId = resultId;
        this.projectName = projectName;
        this.companyName = companyName;
        this.calculatedAt = calculatedAt;
        this.totalEmission = totalEmission;
        this.resultStatusCode = resultStatusCode;
        this.resultStatusLabel = resultStatusLabel;
        this.verificationStatusCode = verificationStatusCode;
        this.verificationStatusLabel = verificationStatusLabel;
        this.detailUrl = detailUrl;
    }
}
