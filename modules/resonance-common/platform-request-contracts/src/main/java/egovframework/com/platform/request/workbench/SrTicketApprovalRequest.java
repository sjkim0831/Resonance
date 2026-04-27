package egovframework.com.platform.request.workbench;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class SrTicketApprovalRequest {

    private String decision;
    private String comment;
    private String approvalToken;
}
