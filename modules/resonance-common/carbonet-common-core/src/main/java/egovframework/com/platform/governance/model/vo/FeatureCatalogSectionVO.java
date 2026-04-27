package egovframework.com.platform.governance.model.vo;

import egovframework.com.platform.codex.model.FeatureCatalogItemVO;

import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class FeatureCatalogSectionVO {

    private String menuCode;
    private String menuNm;
    private String menuNmEn;
    private String menuUrl;
    private List<FeatureCatalogItemVO> features = new ArrayList<>();

    public void setMenuCode(String menuCode) {
        this.menuCode = menuCode;
    }

    public void setMenuNm(String menuNm) {
        this.menuNm = menuNm;
    }

    public void setMenuNmEn(String menuNmEn) {
        this.menuNmEn = menuNmEn;
    }

    public void setMenuUrl(String menuUrl) {
        this.menuUrl = menuUrl;
    }

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

    public List<FeatureCatalogItemVO> getFeatures() {
        return features;
    }

    public void setFeatures(List<FeatureCatalogItemVO> features) {
        this.features = features;
    }
}
