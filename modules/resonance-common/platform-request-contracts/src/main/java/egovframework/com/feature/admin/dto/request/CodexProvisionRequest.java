package egovframework.com.feature.admin.dto.request;

import java.util.ArrayList;
import java.util.List;

public class CodexProvisionRequest {

    private String requestId;
    private String actorId;
    private String targetApiPath;
    private String companyId;
    private String insttId;
    private String menuType;
    private boolean reloadSecurityMetadata = true;
    private PageRequest page;
    private List<FeatureRequest> features = new ArrayList<>();
    private List<AuthorRequest> authors = new ArrayList<>();
    private List<CommonCodeGroupRequest> commonCodeGroups = new ArrayList<>();

    public static class PageRequest {
        private String domainCode;
        private String domainName;
        private String domainNameEn;
        private String groupCode;
        private String groupName;
        private String groupNameEn;
        private String code;
        private String codeNm;
        private String codeDc;
        private String menuUrl;
        private String menuIcon;
        private String useAt;

        public String getDomainCode() { return domainCode; }
        public void setDomainCode(String domainCode) { this.domainCode = domainCode; }
        public String getDomainName() { return domainName; }
        public void setDomainName(String domainName) { this.domainName = domainName; }
        public String getDomainNameEn() { return domainNameEn; }
        public void setDomainNameEn(String domainNameEn) { this.domainNameEn = domainNameEn; }
        public String getGroupCode() { return groupCode; }
        public void setGroupCode(String groupCode) { this.groupCode = groupCode; }
        public String getGroupName() { return groupName; }
        public void setGroupName(String groupName) { this.groupName = groupName; }
        public String getGroupNameEn() { return groupNameEn; }
        public void setGroupNameEn(String groupNameEn) { this.groupNameEn = groupNameEn; }
        public String getCode() { return code; }
        public void setCode(String code) { this.code = code; }
        public String getCodeNm() { return codeNm; }
        public void setCodeNm(String codeNm) { this.codeNm = codeNm; }
        public String getCodeDc() { return codeDc; }
        public void setCodeDc(String codeDc) { this.codeDc = codeDc; }
        public String getMenuUrl() { return menuUrl; }
        public void setMenuUrl(String menuUrl) { this.menuUrl = menuUrl; }
        public String getMenuIcon() { return menuIcon; }
        public void setMenuIcon(String menuIcon) { this.menuIcon = menuIcon; }
        public String getUseAt() { return useAt; }
        public void setUseAt(String useAt) { this.useAt = useAt; }
    }

    public static class FeatureRequest {
        private String menuCode;
        private String featureCode;
        private String featureNm;
        private String featureNmEn;
        private String featureDc;
        private String useAt;

        public String getMenuCode() { return menuCode; }
        public void setMenuCode(String menuCode) { this.menuCode = menuCode; }
        public String getFeatureCode() { return featureCode; }
        public void setFeatureCode(String featureCode) { this.featureCode = featureCode; }
        public String getFeatureNm() { return featureNm; }
        public void setFeatureNm(String featureNm) { this.featureNm = featureNm; }
        public String getFeatureNmEn() { return featureNmEn; }
        public void setFeatureNmEn(String featureNmEn) { this.featureNmEn = featureNmEn; }
        public String getFeatureDc() { return featureDc; }
        public void setFeatureDc(String featureDc) { this.featureDc = featureDc; }
        public String getUseAt() { return useAt; }
        public void setUseAt(String useAt) { this.useAt = useAt; }
    }

    public static class AuthorRequest {
        private String authorCode;
        private String authorNm;
        private String authorDc;
        private List<String> featureCodes = new ArrayList<>();

        public String getAuthorCode() { return authorCode; }
        public void setAuthorCode(String authorCode) { this.authorCode = authorCode; }
        public String getAuthorNm() { return authorNm; }
        public void setAuthorNm(String authorNm) { this.authorNm = authorNm; }
        public String getAuthorDc() { return authorDc; }
        public void setAuthorDc(String authorDc) { this.authorDc = authorDc; }
        public List<String> getFeatureCodes() { return featureCodes; }
        public void setFeatureCodes(List<String> featureCodes) { this.featureCodes = featureCodes == null ? new ArrayList<>() : featureCodes; }
    }

    public static class CommonCodeGroupRequest {
        private String classCode;
        private String classCodeNm;
        private String classCodeDc;
        private String classUseAt;
        private String codeId;
        private String codeIdNm;
        private String codeIdDc;
        private String useAt;
        private List<CommonCodeDetailRequest> details = new ArrayList<>();

        public String getClassCode() { return classCode; }
        public void setClassCode(String classCode) { this.classCode = classCode; }
        public String getClassCodeNm() { return classCodeNm; }
        public void setClassCodeNm(String classCodeNm) { this.classCodeNm = classCodeNm; }
        public String getClassCodeDc() { return classCodeDc; }
        public void setClassCodeDc(String classCodeDc) { this.classCodeDc = classCodeDc; }
        public String getClassUseAt() { return classUseAt; }
        public void setClassUseAt(String classUseAt) { this.classUseAt = classUseAt; }
        public String getCodeId() { return codeId; }
        public void setCodeId(String codeId) { this.codeId = codeId; }
        public String getCodeIdNm() { return codeIdNm; }
        public void setCodeIdNm(String codeIdNm) { this.codeIdNm = codeIdNm; }
        public String getCodeIdDc() { return codeIdDc; }
        public void setCodeIdDc(String codeIdDc) { this.codeIdDc = codeIdDc; }
        public String getUseAt() { return useAt; }
        public void setUseAt(String useAt) { this.useAt = useAt; }
        public List<CommonCodeDetailRequest> getDetails() { return details; }
        public void setDetails(List<CommonCodeDetailRequest> details) { this.details = details == null ? new ArrayList<>() : details; }
    }

    public static class CommonCodeDetailRequest {
        private String code;
        private String codeNm;
        private String codeDc;
        private String useAt;

        public String getCode() { return code; }
        public void setCode(String code) { this.code = code; }
        public String getCodeNm() { return codeNm; }
        public void setCodeNm(String codeNm) { this.codeNm = codeNm; }
        public String getCodeDc() { return codeDc; }
        public void setCodeDc(String codeDc) { this.codeDc = codeDc; }
        public String getUseAt() { return useAt; }
        public void setUseAt(String useAt) { this.useAt = useAt; }
    }

    public String getRequestId() { return requestId; }
    public void setRequestId(String requestId) { this.requestId = requestId; }
    public String getActorId() { return actorId; }
    public void setActorId(String actorId) { this.actorId = actorId; }
    public String getTargetApiPath() { return targetApiPath; }
    public void setTargetApiPath(String targetApiPath) { this.targetApiPath = targetApiPath; }
    public String getCompanyId() { return companyId; }
    public void setCompanyId(String companyId) { this.companyId = companyId; }
    public String getInsttId() { return insttId; }
    public void setInsttId(String insttId) { this.insttId = insttId; }
    public String getMenuType() { return menuType; }
    public void setMenuType(String menuType) { this.menuType = menuType; }
    public boolean isReloadSecurityMetadata() { return reloadSecurityMetadata; }
    public void setReloadSecurityMetadata(boolean reloadSecurityMetadata) { this.reloadSecurityMetadata = reloadSecurityMetadata; }
    public PageRequest getPage() { return page; }
    public void setPage(PageRequest page) { this.page = page; }
    public List<FeatureRequest> getFeatures() { return features; }
    public void setFeatures(List<FeatureRequest> features) { this.features = features == null ? new ArrayList<>() : features; }
    public List<AuthorRequest> getAuthors() { return authors; }
    public void setAuthors(List<AuthorRequest> authors) { this.authors = authors == null ? new ArrayList<>() : authors; }
    public List<CommonCodeGroupRequest> getCommonCodeGroups() { return commonCodeGroups; }
    public void setCommonCodeGroups(List<CommonCodeGroupRequest> commonCodeGroups) { this.commonCodeGroups = commonCodeGroups == null ? new ArrayList<>() : commonCodeGroups; }
}
