package egovframework.com.feature.admin.framework.builder.support.impl;

import egovframework.com.feature.admin.framework.builder.mapper.FrameworkBuilderCompatibilityMapper;
import egovframework.com.framework.builder.support.FrameworkBuilderCompatibilityPersistencePort;

import java.util.List;
import java.util.Map;

public class CarbonetFrameworkBuilderCompatibilityPersistenceAdapter implements FrameworkBuilderCompatibilityPersistencePort {

    private final FrameworkBuilderCompatibilityMapper frameworkBuilderCompatibilityMapper;

    public CarbonetFrameworkBuilderCompatibilityPersistenceAdapter(FrameworkBuilderCompatibilityMapper frameworkBuilderCompatibilityMapper) {
        this.frameworkBuilderCompatibilityMapper = frameworkBuilderCompatibilityMapper;
    }

    @Override
    public List<Map<String, Object>> selectCompatibilityDeclarations() {
        return frameworkBuilderCompatibilityMapper.selectCompatibilityDeclarations();
    }

    @Override
    public List<Map<String, Object>> selectMigrationPlans() {
        return frameworkBuilderCompatibilityMapper.selectMigrationPlans();
    }

    @Override
    public void insertCompatibilityCheckRun(Map<String, Object> params) {
        frameworkBuilderCompatibilityMapper.insertCompatibilityCheckRun(params);
    }

    @Override
    public void insertCompatibilityCheckResult(Map<String, Object> params) {
        frameworkBuilderCompatibilityMapper.insertCompatibilityCheckResult(params);
    }

    @Override
    public Map<String, Object> selectCompatibilityCheckRun(String compatibilityCheckRunId) {
        return frameworkBuilderCompatibilityMapper.selectCompatibilityCheckRun(compatibilityCheckRunId);
    }

    @Override
    public List<Map<String, Object>> selectCompatibilityCheckResults(String compatibilityCheckRunId) {
        return frameworkBuilderCompatibilityMapper.selectCompatibilityCheckResults(compatibilityCheckRunId);
    }
}
