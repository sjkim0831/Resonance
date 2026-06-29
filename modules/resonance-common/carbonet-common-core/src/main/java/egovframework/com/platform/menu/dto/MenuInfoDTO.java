package egovframework.com.platform.menu.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class MenuInfoDTO {

    private String codeId;
    private String menuCode;
    private String menuUrl;
    private String code;
    private String codeNm;
    private String codeDc;
    private String menuIcon;
    private String useAt;
    private String expsrAt;
    private String dependentScreenCode;
    private Integer sortOrdr;

    public String getCodeId() { return codeId; }
    public void setCodeId(String codeId) { this.codeId = codeId; }
    public String getMenuCode() { return menuCode; }
    public void setMenuCode(String menuCode) { this.menuCode = menuCode; }
    public String getMenuUrl() { return menuUrl; }
    public void setMenuUrl(String menuUrl) { this.menuUrl = menuUrl; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public String getCodeNm() { return codeNm; }
    public void setCodeNm(String codeNm) { this.codeNm = codeNm; }
    public String getCodeDc() { return codeDc; }
    public void setCodeDc(String codeDc) { this.codeDc = codeDc; }
    public String getMenuIcon() { return menuIcon; }
    public void setMenuIcon(String menuIcon) { this.menuIcon = menuIcon; }
    public String getUseAt() { return useAt; }
    public void setUseAt(String useAt) { this.useAt = useAt; }
    public String getExpsrAt() { return expsrAt; }
    public void setExpsrAt(String expsrAt) { this.expsrAt = expsrAt; }
    public String getDependentScreenCode() { return dependentScreenCode; }
    public void setDependentScreenCode(String dependentScreenCode) { this.dependentScreenCode = dependentScreenCode; }
    public Integer getSortOrdr() { return sortOrdr; }
    public void setSortOrdr(Integer sortOrdr) { this.sortOrdr = sortOrdr; }
}
