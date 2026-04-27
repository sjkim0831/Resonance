package egovframework.com.framework.authority.model;

import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class FrameworkAuthorityContractVO {

    private String policyId;
    private String frameworkId;
    private String contractVersion;
    private String generatedAt;
    private List<FrameworkAuthorityRoleContractVO> authorityRoles = new ArrayList<>();
    private List<FrameworkAuthorityOptionVO> roleCategoryOptions = new ArrayList<>();
    private List<FrameworkAuthorityTextVO> assignmentAuthorities = new ArrayList<>();
    private List<FrameworkAuthorityTextVO> roleCategories = new ArrayList<>();
    private List<String> allowedScopePolicies = new ArrayList<>();
    private List<String> tierOrder = new ArrayList<>();
}
