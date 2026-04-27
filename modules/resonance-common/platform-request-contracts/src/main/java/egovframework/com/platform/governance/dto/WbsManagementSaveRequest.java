package egovframework.com.platform.governance.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class WbsManagementSaveRequest {

    private String menuType;
    private String menuCode;
    private String owner;
    private String status;
    private Integer progress;
    private String plannedStartDate;
    private String plannedEndDate;
    private String actualStartDate;
    private String actualEndDate;
    private String startDate;
    private String endDate;
    private String notes;
    private String codexInstruction;
}
