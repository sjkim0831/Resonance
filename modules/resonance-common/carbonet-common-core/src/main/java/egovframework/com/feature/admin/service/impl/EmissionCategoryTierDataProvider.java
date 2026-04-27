package egovframework.com.feature.admin.service.impl;

import egovframework.com.feature.admin.mapper.AdminEmissionManagementMapper;
import egovframework.com.feature.admin.model.vo.EmissionFactorVO;
import egovframework.com.feature.admin.model.vo.EmissionVariableDefinitionVO;

import java.util.List;
import java.util.Map;

import static egovframework.com.feature.admin.service.impl.EmissionManagementValueSupport.buildCategoryTierParams;

final class EmissionCategoryTierDataProvider {
    private final AdminEmissionManagementMapper adminEmissionManagementMapper;

    EmissionCategoryTierDataProvider(AdminEmissionManagementMapper adminEmissionManagementMapper) {
        this.adminEmissionManagementMapper = adminEmissionManagementMapper;
    }

    List<EmissionVariableDefinitionVO> loadVariableDefinitions(Long categoryId, Integer tier) {
        return adminEmissionManagementMapper.selectEmissionVariableDefinitions(params(categoryId, tier));
    }

    List<EmissionFactorVO> loadFactors(Long categoryId, Integer tier) {
        return adminEmissionManagementMapper.selectEmissionFactors(params(categoryId, tier));
    }

    private Map<String, Object> params(Long categoryId, Integer tier) {
        return buildCategoryTierParams(categoryId, tier);
    }
}
