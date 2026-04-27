package egovframework.com.platform.menu.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class AdminMenuDomainDTO {
    private String label;
    private String labelEn;
    private String summary;
    private List<AdminMenuGroupDTO> groups = new ArrayList<>();

    public String getLabel() { return label; }
    public void setLabel(String label) { this.label = label; }
    public String getLabelEn() { return labelEn; }
    public void setLabelEn(String labelEn) { this.labelEn = labelEn; }
    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }
    public List<AdminMenuGroupDTO> getGroups() { return groups; }
    public void setGroups(List<AdminMenuGroupDTO> groups) { this.groups = groups; }
}
