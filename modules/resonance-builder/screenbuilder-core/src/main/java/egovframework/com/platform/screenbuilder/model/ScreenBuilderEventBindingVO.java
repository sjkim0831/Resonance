package egovframework.com.platform.screenbuilder.model;

import lombok.Getter;
import lombok.Setter;

import java.util.LinkedHashMap;
import java.util.Map;

@Getter
@Setter
public class ScreenBuilderEventBindingVO {

    private String eventBindingId;
    private String nodeId;
    private String eventName;
    private String actionType;
    private Map<String, Object> actionConfig = new LinkedHashMap<>();
}
