package egovframework.com.feature.admin.dto.request;

import java.util.ArrayList;
import java.util.List;

public class AdminAdminAccountCreateRequestDTO {

    private String rolePreset;
    private String adminId;
    private String adminName;
    private String password;
    private String passwordConfirm;
    private String adminEmail;
    private String phone1;
    private String phone2;
    private String phone3;
    private String deptNm;
    private String insttId;
    private String zip;
    private String adres;
    private String detailAdres;
    private List<String> featureCodes = new ArrayList<>();

    public String getRolePreset() { return rolePreset; }
    public void setRolePreset(String rolePreset) { this.rolePreset = rolePreset; }
    public String getAdminId() { return adminId; }
    public void setAdminId(String adminId) { this.adminId = adminId; }
    public String getAdminName() { return adminName; }
    public void setAdminName(String adminName) { this.adminName = adminName; }
    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
    public String getPasswordConfirm() { return passwordConfirm; }
    public void setPasswordConfirm(String passwordConfirm) { this.passwordConfirm = passwordConfirm; }
    public String getAdminEmail() { return adminEmail; }
    public void setAdminEmail(String adminEmail) { this.adminEmail = adminEmail; }
    public String getPhone1() { return phone1; }
    public void setPhone1(String phone1) { this.phone1 = phone1; }
    public String getPhone2() { return phone2; }
    public void setPhone2(String phone2) { this.phone2 = phone2; }
    public String getPhone3() { return phone3; }
    public void setPhone3(String phone3) { this.phone3 = phone3; }
    public String getDeptNm() { return deptNm; }
    public void setDeptNm(String deptNm) { this.deptNm = deptNm; }
    public String getInsttId() { return insttId; }
    public void setInsttId(String insttId) { this.insttId = insttId; }
    public String getZip() { return zip; }
    public void setZip(String zip) { this.zip = zip; }
    public String getAdres() { return adres; }
    public void setAdres(String adres) { this.adres = adres; }
    public String getDetailAdres() { return detailAdres; }
    public void setDetailAdres(String detailAdres) { this.detailAdres = detailAdres; }
    public List<String> getFeatureCodes() { return featureCodes; }
    public void setFeatureCodes(List<String> featureCodes) { this.featureCodes = featureCodes == null ? new ArrayList<>() : featureCodes; }
}
