package egovframework.com.platform.codex.model;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class FeatureCatalogItemVO {

    private String menuCode;
    private String menuNm;
    private String menuNmEn;
    private String menuUrl;
    private String featureCode;
    private String featureNm;
    private String featureNmEn;
    private String featureDc;
    private String useAt;
    private int assignedRoleCount;
    private boolean unassignedToRole;

    public String getMenuCode() {
        return menuCode;
    }

    public String getMenuNm() {
        return menuNm;
    }

    public String getMenuNmEn() {
        return menuNmEn;
    }

    public String getMenuUrl() {
        return menuUrl;
    }

    public void setMenuUrl(String menuUrl) {
        this.menuUrl = menuUrl;
    }

    public String getFeatureCode() {
        return featureCode;
    }

    public String getFeatureNm() {
        return featureNm;
    }

    public int getAssignedRoleCount() {
        return assignedRoleCount;
    }

    public void setAssignedRoleCount(int assignedRoleCount) {
        this.assignedRoleCount = assignedRoleCount;
    }

    public void setUnassignedToRole(boolean unassignedToRole) {
        this.unassignedToRole = unassignedToRole;
    }
}
