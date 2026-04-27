package egovframework.com.platform.governance.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class FullStackGovernanceAutoCollectRequest {

    private String menuCode;
    private String pageId;
    private String menuUrl;
    private boolean mergeExisting = true;
    private boolean save = true;
}
