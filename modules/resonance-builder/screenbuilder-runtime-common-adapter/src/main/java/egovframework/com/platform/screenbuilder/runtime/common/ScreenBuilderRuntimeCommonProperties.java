package egovframework.com.platform.screenbuilder.runtime.common;

import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.Arrays;
import java.util.List;

@ConfigurationProperties(prefix = "screenbuilder.project")
public class ScreenBuilderRuntimeCommonProperties {

    private String projectId = "example-main";
    private String menuRoot = "PMENU1";
    private String menuScope = "PROJECT_RUNTIME";
    private String runtimeClass = "PROJECT";
    private String builderIdPrefix = "builder";
    private String releaseUnitPrefix = "example-release";
    private String runtimePackagePrefix = "screenbuilder-runtime-example";
    private String compareBaseline = "CURRENT_RUNTIME";
    private String requestedBy = "screen-builder";
    private String requestedByType = "SCREEN_BUILDER_QUEUE";
    private String ownerLane = "PROJECT";
    private String adminGuidedStateId = "project-admin-guided";
    private String publicGuidedStateId = "project-public-guided";
    private String adminTemplateLineId = "project-admin-line";
    private String publicTemplateLineId = "project-public-line";
    private String artifactSourceSystem = "example-project";
    private String artifactTargetSystem = "example-project";
    private String artifactPathBase = "/runtime";
    private List<String> adminPathPrefixes = Arrays.asList("/admin", "/en/admin");
    private List<String> englishPathPrefixes = Arrays.asList("/en/");

    public String getProjectId() {
        return projectId;
    }

    public void setProjectId(String projectId) {
        this.projectId = projectId;
    }

    public String getMenuRoot() {
        return menuRoot;
    }

    public void setMenuRoot(String menuRoot) {
        this.menuRoot = menuRoot;
    }

    public String getMenuScope() {
        return menuScope;
    }

    public void setMenuScope(String menuScope) {
        this.menuScope = menuScope;
    }

    public String getRuntimeClass() {
        return runtimeClass;
    }

    public void setRuntimeClass(String runtimeClass) {
        this.runtimeClass = runtimeClass;
    }

    public String getBuilderIdPrefix() {
        return builderIdPrefix;
    }

    public void setBuilderIdPrefix(String builderIdPrefix) {
        this.builderIdPrefix = builderIdPrefix;
    }

    public String getReleaseUnitPrefix() {
        return releaseUnitPrefix;
    }

    public void setReleaseUnitPrefix(String releaseUnitPrefix) {
        this.releaseUnitPrefix = releaseUnitPrefix;
    }

    public String getRuntimePackagePrefix() {
        return runtimePackagePrefix;
    }

    public void setRuntimePackagePrefix(String runtimePackagePrefix) {
        this.runtimePackagePrefix = runtimePackagePrefix;
    }

    public String getCompareBaseline() {
        return compareBaseline;
    }

    public void setCompareBaseline(String compareBaseline) {
        this.compareBaseline = compareBaseline;
    }

    public String getRequestedBy() {
        return requestedBy;
    }

    public void setRequestedBy(String requestedBy) {
        this.requestedBy = requestedBy;
    }

    public String getRequestedByType() {
        return requestedByType;
    }

    public void setRequestedByType(String requestedByType) {
        this.requestedByType = requestedByType;
    }

    public String getOwnerLane() {
        return ownerLane;
    }

    public void setOwnerLane(String ownerLane) {
        this.ownerLane = ownerLane;
    }

    public String getAdminGuidedStateId() {
        return adminGuidedStateId;
    }

    public void setAdminGuidedStateId(String adminGuidedStateId) {
        this.adminGuidedStateId = adminGuidedStateId;
    }

    public String getPublicGuidedStateId() {
        return publicGuidedStateId;
    }

    public void setPublicGuidedStateId(String publicGuidedStateId) {
        this.publicGuidedStateId = publicGuidedStateId;
    }

    public String getAdminTemplateLineId() {
        return adminTemplateLineId;
    }

    public void setAdminTemplateLineId(String adminTemplateLineId) {
        this.adminTemplateLineId = adminTemplateLineId;
    }

    public String getPublicTemplateLineId() {
        return publicTemplateLineId;
    }

    public void setPublicTemplateLineId(String publicTemplateLineId) {
        this.publicTemplateLineId = publicTemplateLineId;
    }

    public String getArtifactSourceSystem() {
        return artifactSourceSystem;
    }

    public void setArtifactSourceSystem(String artifactSourceSystem) {
        this.artifactSourceSystem = artifactSourceSystem;
    }

    public String getArtifactTargetSystem() {
        return artifactTargetSystem;
    }

    public void setArtifactTargetSystem(String artifactTargetSystem) {
        this.artifactTargetSystem = artifactTargetSystem;
    }

    public String getArtifactPathBase() {
        return artifactPathBase;
    }

    public void setArtifactPathBase(String artifactPathBase) {
        this.artifactPathBase = artifactPathBase;
    }

    public List<String> getAdminPathPrefixes() {
        return adminPathPrefixes;
    }

    public void setAdminPathPrefixes(List<String> adminPathPrefixes) {
        this.adminPathPrefixes = adminPathPrefixes;
    }

    public List<String> getEnglishPathPrefixes() {
        return englishPathPrefixes;
    }

    public void setEnglishPathPrefixes(List<String> englishPathPrefixes) {
        this.englishPathPrefixes = englishPathPrefixes;
    }
}
