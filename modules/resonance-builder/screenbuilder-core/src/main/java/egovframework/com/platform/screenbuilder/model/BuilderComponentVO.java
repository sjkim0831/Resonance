package egovframework.com.platform.screenbuilder.model;

import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;
import java.util.Map;

@Getter
@Setter
public class BuilderComponentVO {

    private String componentId;
    private String componentNm;
    private String componentDc;
    private String componentType;
    private String categoryCd;
    private String iconNm;
    private Map<String, Object> defaultProps;
    private String defaultClassNm;
    private Map<String, Object> defaultStyle;
    private Map<String, Object> dataAttrs;
    private Boolean isContainer;
    private Boolean isReusable;
    private Integer sortOrder;
    private String useAt;
    private LocalDateTime creatPnttm;
    private String creatUserId;
    private LocalDateTime updtPnttm;
    private String updtUserId;

    public static final String TYPE_BUTTON = "BUTTON";
    public static final String TYPE_CARD = "CARD";
    public static final String TYPE_INPUT = "INPUT";
    public static final String TYPE_TABLE = "TABLE";
    public static final String TYPE_FORM = "FORM";
    public static final String TYPE_SECTION = "SECTION";
    public static final String TYPE_LAYOUT = "LAYOUT";
    public static final String TYPE_CHART = "CHART";
    public static final String TYPE_MEDIA = "MEDIA";
    public static final String TYPE_OTHER = "OTHER";

    public static final String CATEGORY_LAYOUT = "LAYOUT";
    public static final String CATEGORY_FORM = "FORM";
    public static final String CATEGORY_DISPLAY = "DISPLAY";
    public static final String CATEGORY_DATA = "DATA";
    public static final String CATEGORY_NAVIGATION = "NAVIGATION";
    public static final String CATEGORY_FEEDBACK = "FEEDBACK";
}