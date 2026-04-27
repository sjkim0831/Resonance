package egovframework.com.feature.auth.domain.entity;

import lombok.Getter;
import lombok.Setter;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.LocalDateTime;

@Entity(name = "uiaEmplyrInfo")
@Getter
@Setter
@Table(name = "COMTNEMPLYRINFO")
public class EmplyrInfo implements CommonEntity {

    @Id
    @Column(name = "EMPLYR_ID")
    private String emplyrId;

    @Column(name = "ORGNZT_ID")
    private String orgnztId;

    @Column(name = "INSTT_ID")
    private String insttId;

    @Column(name = "USER_NM")
    private String userNm;

    @Column(name = "PASSWORD")
    private String password;

    @Column(name = "EMPL_NO")
    private String empNo;

    @Column(name = "IHIDNUM")
    private String ihidNum;

    @Column(name = "SEXDSTN_CODE")
    private String sexdstnCode;

    @Column(name = "BRTHDY")
    private String brthDy;

    @Column(name = "FXNUM")
    private String fxNum;

    @Column(name = "HOUSE_ADRES")
    private String houseAdres;

    @Column(name = "PASSWORD_HINT")
    private String passwordHint;

    @Column(name = "PASSWORD_CNSR")
    private String passwordCnsr;

    @Column(name = "HOUSE_END_TELNO")
    private String houseEndTelno;

    @Column(name = "AREA_NO")
    private String areaNo;

    @Column(name = "DETAIL_ADRES")
    private String detailAdres;

    @Column(name = "ZIP")
    private String zip;

    @Column(name = "OFFM_TELNO")
    private String offmTelno;

    @Column(name = "MBTLNUM")
    private String mbtlNum;

    @Column(name = "EMAIL_ADRES")
    private String emailAdres;

    @Column(name = "OFCPS_NM")
    private String ofcpsNm;

    @Column(name = "HOUSE_MIDDLE_TELNO")
    private String houseMiddleTelno;

    @Column(name = "GROUP_ID")
    private String groupId;

    @Column(name = "PSTINST_CODE")
    private String pstinstCode;

    @Column(name = "EMPLYR_STTUS_CODE")
    private String emplyrStusCode;

    @Column(name = "ESNTL_ID")
    private String esntlId;

    @Column(name = "CRTFC_DN_VALUE")
    private String crtfcDnValue;

    @Column(name = "SBSCRB_DE")
    private LocalDateTime sbscrbDe;

    @Column(name = "LOCK_AT")
    private String lockAt;

    @Column(name = "LOCK_CNT")
    private Integer lockCnt;

    @Column(name = "LOCK_LAST_PNTTM")
    private LocalDateTime lockLastPnttm;

    @Column(name = "CHG_PWD_LAST_PNTTM")
    private LocalDateTime chgPwdLastPnttm;

    @Column(name = "MARKETING_YN")
    private String marketingYn;

    @Column(name = "AUTH_TY")
    private String authTy;

    @Column(name = "AUTH_DN")
    private String authDn;

    @Column(name = "AUTH_CI")
    private String authCi;

    @Column(name = "AUTH_DI")
    private String authDi;

    @Column(name = "AUTH_EMAIL")
    private String authEmail;

    public String getInsttId() {
        return insttId;
    }

    public void setInsttId(String insttId) {
        this.insttId = insttId;
    }

    public String getOrgnztId() {
        return orgnztId;
    }

    public void setOrgnztId(String orgnztId) {
        this.orgnztId = orgnztId;
    }

    public String getGroupId() {
        return groupId;
    }

    public void setGroupId(String groupId) {
        this.groupId = groupId;
    }

    public String getUserNm() {
        return userNm;
    }

    public void setUserNm(String userNm) {
        this.userNm = userNm;
    }

    public String getEmailAdres() {
        return emailAdres;
    }

    public void setEmailAdres(String emailAdres) {
        this.emailAdres = emailAdres;
    }

    public String getAreaNo() {
        return areaNo;
    }

    public void setAreaNo(String areaNo) {
        this.areaNo = areaNo;
    }

    public String getHouseMiddleTelno() {
        return houseMiddleTelno;
    }

    public void setHouseMiddleTelno(String houseMiddleTelno) {
        this.houseMiddleTelno = houseMiddleTelno;
    }

    public String getHouseEndTelno() {
        return houseEndTelno;
    }

    public void setHouseEndTelno(String houseEndTelno) {
        this.houseEndTelno = houseEndTelno;
    }

    public String getMbtlNum() {
        return mbtlNum;
    }

    public void setMbtlNum(String mbtlNum) {
        this.mbtlNum = mbtlNum;
    }

    public String getEmplyrId() {
        return emplyrId;
    }

    public String getOffmTelno() {
        return offmTelno;
    }

    public void setOffmTelno(String offmTelno) {
        this.offmTelno = offmTelno;
    }

    public String getOfcpsNm() {
        return ofcpsNm;
    }

    public void setOfcpsNm(String ofcpsNm) {
        this.ofcpsNm = ofcpsNm;
    }

    public String getEsntlId() {
        return esntlId;
    }

    public String getEmplyrStusCode() {
        return emplyrStusCode;
    }

    public LocalDateTime getSbscrbDe() {
        return sbscrbDe;
    }

    public void setLockAt(String lockAt) {
        this.lockAt = lockAt;
    }

    public void setLockCnt(Integer lockCnt) {
        this.lockCnt = lockCnt;
    }

    public void setLockLastPnttm(LocalDateTime lockLastPnttm) {
        this.lockLastPnttm = lockLastPnttm;
    }

    public void setAuthTy(String authTy) {
        this.authTy = authTy;
    }

    public void setAuthDn(String authDn) {
        this.authDn = authDn;
    }

    public void setAuthCi(String authCi) {
        this.authCi = authCi;
    }

    public void setAuthDi(String authDi) {
        this.authDi = authDi;
    }

}
