package egovframework.com.feature.admin.dto.request;

import java.util.List;

public class AdminAuthorRoleProfileSaveRequestDTO {

    private String authorCode;
    private String roleCategory;
    private String displayTitle;
    private List<String> priorityWorks;
    private String description;
    private String memberEditVisibleYn;
    private String roleType;
    private String baseRoleYn;
    private String parentAuthorCode;
    private String assignmentScope;
    private List<String> defaultMemberTypes;

    public String getAuthorCode() {
        return authorCode;
    }

    public void setAuthorCode(String authorCode) {
        this.authorCode = authorCode;
    }

    public String getRoleCategory() {
        return roleCategory;
    }

    public void setRoleCategory(String roleCategory) {
        this.roleCategory = roleCategory;
    }

    public String getDisplayTitle() {
        return displayTitle;
    }

    public void setDisplayTitle(String displayTitle) {
        this.displayTitle = displayTitle;
    }

    public List<String> getPriorityWorks() {
        return priorityWorks;
    }

    public void setPriorityWorks(List<String> priorityWorks) {
        this.priorityWorks = priorityWorks;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getMemberEditVisibleYn() {
        return memberEditVisibleYn;
    }

    public void setMemberEditVisibleYn(String memberEditVisibleYn) {
        this.memberEditVisibleYn = memberEditVisibleYn;
    }

    public String getRoleType() {
        return roleType;
    }

    public void setRoleType(String roleType) {
        this.roleType = roleType;
    }

    public String getBaseRoleYn() {
        return baseRoleYn;
    }

    public void setBaseRoleYn(String baseRoleYn) {
        this.baseRoleYn = baseRoleYn;
    }

    public String getParentAuthorCode() {
        return parentAuthorCode;
    }

    public void setParentAuthorCode(String parentAuthorCode) {
        this.parentAuthorCode = parentAuthorCode;
    }

    public String getAssignmentScope() {
        return assignmentScope;
    }

    public void setAssignmentScope(String assignmentScope) {
        this.assignmentScope = assignmentScope;
    }

    public List<String> getDefaultMemberTypes() {
        return defaultMemberTypes;
    }

    public void setDefaultMemberTypes(List<String> defaultMemberTypes) {
        this.defaultMemberTypes = defaultMemberTypes;
    }
}
