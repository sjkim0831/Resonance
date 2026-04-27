package egovframework.com.platform.menu.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class AdminMenuGroupDTO {
    private String title;
    private String titleEn;
    private String icon;
    private List<AdminMenuLinkDTO> links = new ArrayList<>();

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getTitleEn() { return titleEn; }
    public void setTitleEn(String titleEn) { this.titleEn = titleEn; }
    public String getIcon() { return icon; }
    public void setIcon(String icon) { this.icon = icon; }
    public List<AdminMenuLinkDTO> getLinks() { return links; }
    public void setLinks(List<AdminMenuLinkDTO> links) { this.links = links; }
}
