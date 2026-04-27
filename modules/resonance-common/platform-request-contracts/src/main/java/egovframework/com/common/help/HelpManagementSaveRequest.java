package egovframework.com.common.help;

import java.util.ArrayList;
import java.util.List;

public class HelpManagementSaveRequest {

    private String pageId;
    private String title;
    private String summary;
    private String helpVersion;
    private String activeYn;
    private List<HelpManagementItemRequest> items = new ArrayList<>();

    public String getPageId() { return pageId; }
    public void setPageId(String pageId) { this.pageId = pageId; }
    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }
    public String getSummary() { return summary; }
    public void setSummary(String summary) { this.summary = summary; }
    public String getHelpVersion() { return helpVersion; }
    public void setHelpVersion(String helpVersion) { this.helpVersion = helpVersion; }
    public String getActiveYn() { return activeYn; }
    public void setActiveYn(String activeYn) { this.activeYn = activeYn; }
    public List<HelpManagementItemRequest> getItems() { return items; }
    public void setItems(List<HelpManagementItemRequest> items) { this.items = items == null ? new ArrayList<>() : items; }
}
