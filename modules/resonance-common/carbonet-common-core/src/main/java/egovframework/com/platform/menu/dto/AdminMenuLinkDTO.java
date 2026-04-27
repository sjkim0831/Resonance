package egovframework.com.platform.menu.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AdminMenuLinkDTO {
    private String text;
    private String tEn;
    private String u;
    private String icon;

    public String getText() { return text; }
    public void setText(String text) { this.text = text; }
    public String getTEn() { return tEn; }
    public void setTEn(String tEn) { this.tEn = tEn; }
    public String getU() { return u; }
    public void setU(String u) { this.u = u; }
    public String getIcon() { return icon; }
    public void setIcon(String icon) { this.icon = icon; }
}
