package egovframework.com.feature.admin.dto.request;

import java.util.ArrayList;
import java.util.List;

public class AdminMemberEditSaveRequestDTO {

    private String memberId;
    private String applcntNm;
    private String applcntEmailAdres;
    private String phoneNumber;
    private String entrprsSeCode;
    private String entrprsMberSttus;
    private String authorCode;
    private List<String> featureCodes = new ArrayList<>();
    private String zip;
    private String adres;
    private String detailAdres;
    private String marketingYn;
    private String deptNm;

    public String getMemberId() { return memberId; }
    public void setMemberId(String memberId) { this.memberId = memberId; }
    public String getApplcntNm() { return applcntNm; }
    public void setApplcntNm(String applcntNm) { this.applcntNm = applcntNm; }
    public String getApplcntEmailAdres() { return applcntEmailAdres; }
    public void setApplcntEmailAdres(String applcntEmailAdres) { this.applcntEmailAdres = applcntEmailAdres; }
    public String getPhoneNumber() { return phoneNumber; }
    public void setPhoneNumber(String phoneNumber) { this.phoneNumber = phoneNumber; }
    public String getEntrprsSeCode() { return entrprsSeCode; }
    public void setEntrprsSeCode(String entrprsSeCode) { this.entrprsSeCode = entrprsSeCode; }
    public String getEntrprsMberSttus() { return entrprsMberSttus; }
    public void setEntrprsMberSttus(String entrprsMberSttus) { this.entrprsMberSttus = entrprsMberSttus; }
    public String getAuthorCode() { return authorCode; }
    public void setAuthorCode(String authorCode) { this.authorCode = authorCode; }
    public List<String> getFeatureCodes() { return featureCodes; }
    public void setFeatureCodes(List<String> featureCodes) { this.featureCodes = featureCodes == null ? new ArrayList<>() : featureCodes; }
    public String getZip() { return zip; }
    public void setZip(String zip) { this.zip = zip; }
    public String getAdres() { return adres; }
    public void setAdres(String adres) { this.adres = adres; }
    public String getDetailAdres() { return detailAdres; }
    public void setDetailAdres(String detailAdres) { this.detailAdres = detailAdres; }
    public String getMarketingYn() { return marketingYn; }
    public void setMarketingYn(String marketingYn) { this.marketingYn = marketingYn; }
    public String getDeptNm() { return deptNm; }
    public void setDeptNm(String deptNm) { this.deptNm = deptNm; }
}
