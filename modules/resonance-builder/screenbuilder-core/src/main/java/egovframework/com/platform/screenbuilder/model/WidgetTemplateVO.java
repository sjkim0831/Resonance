package egovframework.com.platform.screenbuilder.model;

import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

@Getter
@Setter
public class WidgetTemplateVO {

    private String templateId;
    private String templateNm;
    private String templateDc;
    private String templateType;
    private String thumbnailUrl;
    private Map<String, Object> defaultProps;
    private String defaultClassNm;
    private List<ScreenBuilderNodeVO> nodes;
    private Integer sortOrder;
    private String useAt;
    private LocalDateTime creatPnttm;
    private String creatUserId;

    public static final String TYPE_WIDGET = "WIDGET";
    public static final String TYPE_SNIPPET = "SNIPPET";
    public static final String TYPE_LAYOUT = "LAYOUT";
    public static final String TYPE_TABLE_CELL = "TABLE_CELL";
}