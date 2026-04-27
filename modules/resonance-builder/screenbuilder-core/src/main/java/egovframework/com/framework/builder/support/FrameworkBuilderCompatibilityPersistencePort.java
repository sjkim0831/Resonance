package egovframework.com.framework.builder.support;

import java.util.List;
import java.util.Map;

public interface FrameworkBuilderCompatibilityPersistencePort {

    List<Map<String, Object>> selectCompatibilityDeclarations();

    List<Map<String, Object>> selectMigrationPlans();

    void insertCompatibilityCheckRun(Map<String, Object> params);

    void insertCompatibilityCheckResult(Map<String, Object> params);

    Map<String, Object> selectCompatibilityCheckRun(String compatibilityCheckRunId);

    List<Map<String, Object>> selectCompatibilityCheckResults(String compatibilityCheckRunId);
}
