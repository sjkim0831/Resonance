package egovframework.com.feature.admin.service.impl;

import egovframework.com.feature.admin.model.vo.EmissionCategoryVO;
import egovframework.com.feature.admin.model.vo.EmissionFactorVO;
import egovframework.com.feature.admin.model.vo.EmissionVariableDefinitionVO;

import java.util.List;
import java.util.Map;

final class EmissionVariableDefinitionsExecution {
    final EmissionCategoryVO category;
    final int tier;
    final List<EmissionVariableDefinitionVO> variables;
    final List<EmissionFactorVO> factors;
    final CalculationDefinition definition;
    final Map<String, Object> publishedDefinition;

    EmissionVariableDefinitionsExecution(EmissionCategoryVO category,
                                         int tier,
                                         List<EmissionVariableDefinitionVO> variables,
                                         List<EmissionFactorVO> factors,
                                         CalculationDefinition definition,
                                         Map<String, Object> publishedDefinition) {
        this.category = category;
        this.tier = tier;
        this.variables = variables;
        this.factors = factors;
        this.definition = definition;
        this.publishedDefinition = publishedDefinition;
    }
}
