package egovframework.com.feature.member.model.vo;

public class InstitutionStatusVO {
    private String rawInsttId;
    private String insttId;
    private String insttNm;
    private String reprsntNm;
    private String bizrno;
    private String zip;
    private String adres;
    private String detailAdres;
    private String bizRegFilePath;
    private String insttSttus;
    private String rjctRsn;
    private String rjctPnttm;
    private String frstRegistPnttm;
    private String lastUpdtPnttm;
    private String chargerNm;
    private String chargerEmail;
    private String chargerTel;
    private String entrprsSeCode;

    public boolean isEmpty() {
        return (insttId == null || insttId.trim().isEmpty())
                && (bizrno == null || bizrno.trim().isEmpty())
                && (insttNm == null || insttNm.trim().isEmpty());
    }

    public String getRawInsttId() { return rawInsttId; }
    public void setRawInsttId(String rawInsttId) { this.rawInsttId = rawInsttId; }
    public String getInsttId() { return insttId; }
    public void setInsttId(String insttId) { this.insttId = insttId; }
    public String getInsttNm() { return insttNm; }
    public void setInsttNm(String insttNm) { this.insttNm = insttNm; }
    public String getReprsntNm() { return reprsntNm; }
    public void setReprsntNm(String reprsntNm) { this.reprsntNm = reprsntNm; }
    public String getBizrno() { return bizrno; }
    public void setBizrno(String bizrno) { this.bizrno = bizrno; }
    public String getZip() { return zip; }
    public void setZip(String zip) { this.zip = zip; }
    public String getAdres() { return adres; }
    public void setAdres(String adres) { this.adres = adres; }
    public String getDetailAdres() { return detailAdres; }
    public void setDetailAdres(String detailAdres) { this.detailAdres = detailAdres; }
    public String getBizRegFilePath() { return bizRegFilePath; }
    public void setBizRegFilePath(String bizRegFilePath) { this.bizRegFilePath = bizRegFilePath; }
    public String getInsttSttus() { return insttSttus; }
    public void setInsttSttus(String insttSttus) { this.insttSttus = insttSttus; }
    public String getRjctRsn() { return rjctRsn; }
    public void setRjctRsn(String rjctRsn) { this.rjctRsn = rjctRsn; }
    public String getRjctPnttm() { return rjctPnttm; }
    public void setRjctPnttm(String rjctPnttm) { this.rjctPnttm = rjctPnttm; }
    public String getFrstRegistPnttm() { return frstRegistPnttm; }
    public void setFrstRegistPnttm(String frstRegistPnttm) { this.frstRegistPnttm = frstRegistPnttm; }
    public String getLastUpdtPnttm() { return lastUpdtPnttm; }
    public void setLastUpdtPnttm(String lastUpdtPnttm) { this.lastUpdtPnttm = lastUpdtPnttm; }
    public String getChargerNm() { return chargerNm; }
    public void setChargerNm(String chargerNm) { this.chargerNm = chargerNm; }
    public String getChargerEmail() { return chargerEmail; }
    public void setChargerEmail(String chargerEmail) { this.chargerEmail = chargerEmail; }
    public String getChargerTel() { return chargerTel; }
    public void setChargerTel(String chargerTel) { this.chargerTel = chargerTel; }
    public String getEntrprsSeCode() { return entrprsSeCode; }
    public void setEntrprsSeCode(String entrprsSeCode) { this.entrprsSeCode = entrprsSeCode; }
}
