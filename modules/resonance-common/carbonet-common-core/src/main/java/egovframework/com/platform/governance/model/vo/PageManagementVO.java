package egovframework.com.platform.governance.model.vo;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class PageManagementVO {

    private String codeId;
    private String code;
    private String codeNm;
    private String codeDc;
    private String useAt;
    private String menuUrl;
    private String menuIcon;
    private String domainCode;
    private String domainName;
    private String domainNameEn;
    private int defaultViewRoleRefCount;
    private int defaultViewUserOverrideCount;
    private boolean catalogManaged;
    private boolean catalogRegistered;
    private String managementNote;
}
