package egovframework.com.platform.screenbuilder.model;

import lombok.Getter;
import lombok.Setter;
import java.time.LocalDateTime;
import java.util.Map;

@Getter
@Setter
public class ThemeClassSetVO {

    private String classSetId;
    private String themeId;
    private String classSetNm;
    private String classSetDc;
    private String targetComponent;
    private String baseClasses;
    private String hoverClasses;
    private String focusClasses;
    private String activeClasses;
    private String disabledClasses;
    private Map<String, String> responsiveClasses;
    private Integer sortOrder;
    private String useAt;
    private LocalDateTime creatPnttm;
    private String creatUserId;
}