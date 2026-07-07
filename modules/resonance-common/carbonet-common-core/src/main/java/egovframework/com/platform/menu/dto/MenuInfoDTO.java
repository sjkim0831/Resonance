package egovframework.com.platform.menu.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class MenuInfoDTO {

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

    public String getMenuCode() { return menuCode; }
    public void setMenuCode(String menuCode) { this.menuCode = menuCode; }
    public String getMenuUrl() { return menuUrl; }
    public void setMenuUrl(String menuUrl) { this.menuUrl = menuUrl; }
    public String getCode() { return code; }
    public void setCode(String code) { this.code = code; }
    public void setCodeNm(String codeNm) { this.codeNm = codeNm; }
    public void setCodeDc(String codeDc) { this.codeDc = codeDc; }
    public void setMenuIcon(String menuIcon) { this.menuIcon = menuIcon; }
    public void setUseAt(String useAt) { this.useAt = useAt; }
    public void setExpsrAt(String expsrAt) { this.expsrAt = expsrAt; }
    public void setDependentScreenCode(String dependentScreenCode) { this.dependentScreenCode = dependentScreenCode; }
    public void setSortOrdr(Integer sortOrdr) { this.sortOrdr = sortOrdr; }
}
