package egovframework.com.common.governance.model;

import lombok.Data;
import java.util.List;
import java.util.Map;

@Data
public class CompatibilityMatrixVO {
    private List<Rule> rules;
    private Map<String, Object> contracts;

    @Data
    public static class Rule {
        private String sourceComponent;
        private String sourceVersion;
        private Map<String, String> dependencies;
        private String compatibilityClass;
        private String impact;
        private String notes;
    }
}
