package egovframework.com.platform.screenbuilder.model;

import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class ScreenConfigVO {

    private String screenId;
    private String menuCode;
    private String pageId;
    private String menuNm;
    private String menuUrl;
    private String templateType;

    private List<ScreenBuilderNodeVO> nodes = new ArrayList<>();
    private List<ScreenBuilderEventBindingVO> events = new ArrayList<>();

    private String themeId;
    private String customClasses;
    private String customStyles;

    private String status;
    private LocalDateTime createdAt;
    private String createdBy;
    private LocalDateTime updatedAt;
    private String updatedBy;
    private LocalDateTime publishedAt;
    private String publishedBy;
    private Integer version;

    private String screenFamily;
    private String screenGroup;

    public static final String STATUS_DRAFT = "DRAFT";
    public static final String STATUS_PUBLISHED = "PUBLISHED";
    public static final String STATUS_ARCHIVED = "ARCHIVED";

    public static final String TEMPLATE_ADMIN = "admin";
    public static final String TEMPLATE_PUBLIC = "public";
    public static final String TEMPLATE_MOBILE = "mobile";

    public ScreenConfigVO() {
        this.status = STATUS_DRAFT;
        this.version = 1;
        this.templateType = TEMPLATE_ADMIN;
        this.createdAt = LocalDateTime.now();
        this.updatedAt = LocalDateTime.now();
    }

    public String getJsonNodes() {
        return nodes != null ? String.valueOf(nodes.size()) + " nodes" : "[]";
    }

    public String getJsonEvents() {
        return events != null ? String.valueOf(events.size()) + " events" : "[]";
    }
}