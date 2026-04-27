package egovframework.com.feature.admin.dto.request;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AdminPopupEditSaveRequestDTO {

    private String popupId;
    private String popupTitle;
    private String popupType;
    private String exposureStatus;
    private String priority;
    private String useAt;
    private String targetAudience;
    private String displayScope;
    private String startDate;
    private String startTime;
    private String endDate;
    private String endTime;
    private String closePolicy;
    private String width;
    private String height;
    private String headline;
    private String body;
    private String ctaLabel;
    private String ctaUrl;
    private String ownerName;
    private String ownerContact;
    private String notes;
}
