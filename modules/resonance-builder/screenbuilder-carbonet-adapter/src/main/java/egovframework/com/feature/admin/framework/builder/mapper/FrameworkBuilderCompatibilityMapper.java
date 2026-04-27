package egovframework.com.feature.admin.framework.builder.mapper;

import egovframework.com.common.mapper.support.BaseMapperSupport;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component("frameworkBuilderCompatibilityMapper")
public class FrameworkBuilderCompatibilityMapper extends BaseMapperSupport {

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> selectCompatibilityDeclarations() {
        return (List<Map<String, Object>>) list(
                "FrameworkBuilderCompatibilityMapper.selectCompatibilityDeclarations",
                null
        );
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> selectMigrationPlans() {
        return (List<Map<String, Object>>) list(
                "FrameworkBuilderCompatibilityMapper.selectMigrationPlans",
                null
        );
    }

    public void insertCompatibilityCheckRun(Map<String, Object> params) {
        insert("FrameworkBuilderCompatibilityMapper.insertCompatibilityCheckRun", params);
    }

    public void insertCompatibilityCheckResult(Map<String, Object> params) {
        insert("FrameworkBuilderCompatibilityMapper.insertCompatibilityCheckResult", params);
    }

    @SuppressWarnings("unchecked")
    public Map<String, Object> selectCompatibilityCheckRun(String compatibilityCheckRunId) {
        return (Map<String, Object>) selectOne(
                "FrameworkBuilderCompatibilityMapper.selectCompatibilityCheckRun",
                compatibilityCheckRunId
        );
    }

    @SuppressWarnings("unchecked")
    public List<Map<String, Object>> selectCompatibilityCheckResults(String compatibilityCheckRunId) {
        return (List<Map<String, Object>>) list(
                "FrameworkBuilderCompatibilityMapper.selectCompatibilityCheckResults",
                compatibilityCheckRunId
        );
    }
}
