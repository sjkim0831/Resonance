package egovframework.com.feature.admin.mapper;

import egovframework.com.common.mapper.support.BaseMapperSupport;
import egovframework.com.feature.admin.model.vo.EmissionCategoryVO;
import egovframework.com.feature.admin.model.vo.EmissionFactorVO;
import egovframework.com.feature.admin.model.vo.EmissionVariableDefinitionVO;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component("adminEmissionManagementMapper")
public class AdminEmissionManagementMapper extends BaseMapperSupport {

    public List<EmissionCategoryVO> selectEmissionCategories(String searchKeyword) {
        return selectList("AdminEmissionManagementMapper.selectEmissionCategories", searchKeyword);
    }

    public EmissionCategoryVO selectEmissionCategory(Long categoryId) {
        return selectOne("AdminEmissionManagementMapper.selectEmissionCategory", categoryId);
    }

    public EmissionCategoryVO selectEmissionCategoryBySubCode(String subCode) {
        return selectOne("AdminEmissionManagementMapper.selectEmissionCategoryBySubCode", subCode);
    }

    public List<Integer> selectEmissionTierList(Long categoryId) {
        return selectList("AdminEmissionManagementMapper.selectEmissionTierList", categoryId);
    }

    public Map<String, Object> selectEmissionVariableDefinition(Map<String, Object> params) {
        return selectOne("AdminEmissionManagementMapper.selectEmissionVariableDefinition", params);
    }

    public Integer selectEmissionVariableDefinitionCount(Map<String, Object> params) {
        return selectOne("AdminEmissionManagementMapper.selectEmissionVariableDefinitionCount", params);
    }

    public String selectEmissionVariableDefinitionLastUpdatedAt(Map<String, Object> params) {
        return selectOne("AdminEmissionManagementMapper.selectEmissionVariableDefinitionLastUpdatedAt", params);
    }

    public List<EmissionVariableDefinitionVO> selectEmissionVariableDefinitions(Map<String, Object> params) {
        return selectList("AdminEmissionManagementMapper.selectEmissionVariableDefinitions", params);
    }

    public List<EmissionFactorVO> selectEmissionFactors(Map<String, Object> params) {
        return selectList("AdminEmissionManagementMapper.selectEmissionFactors", params);
    }

    public void insertEmissionInputSession(Map<String, Object> params) {
        insert("AdminEmissionManagementMapper.insertEmissionInputSession", params);
    }

    public void insertEmissionInputValue(Map<String, Object> params) {
        insert("AdminEmissionManagementMapper.insertEmissionInputValue", params);
    }

    public Map<String, Object> selectEmissionInputSession(Long sessionId) {
        return selectOne("AdminEmissionManagementMapper.selectEmissionInputSession", sessionId);
    }

    public List<Map<String, Object>> selectEmissionInputValues(Long sessionId) {
        return selectList("AdminEmissionManagementMapper.selectEmissionInputValues", sessionId);
    }

    public void insertEmissionCalcResult(Map<String, Object> params) {
        insert("AdminEmissionManagementMapper.insertEmissionCalcResult", params);
    }

    public void insertEmissionCategory(Map<String, Object> params) {
        insert("AdminEmissionManagementMapper.insertEmissionCategory", params);
    }

    public void insertEmissionVariableDefinition(Map<String, Object> params) {
        insert("AdminEmissionManagementMapper.insertEmissionVariableDefinition", params);
    }

    public void updateEmissionVariableDefinition(Map<String, Object> params) {
        update("AdminEmissionManagementMapper.updateEmissionVariableDefinition", params);
    }

    public void insertEmissionMaterializationHistory(Map<String, Object> params) {
        insert("AdminEmissionManagementMapper.insertEmissionMaterializationHistory", params);
    }

    public Map<String, Object> selectLatestEmissionMaterializationHistory(Map<String, Object> params) {
        return selectOne("AdminEmissionManagementMapper.selectLatestEmissionMaterializationHistory", params);
    }

    public void insertEmissionRuntimeTransitionHistory(Map<String, Object> params) {
        insert("AdminEmissionManagementMapper.insertEmissionRuntimeTransitionHistory", params);
    }

    public Map<String, Object> selectLatestEmissionRuntimeTransitionHistory(Map<String, Object> params) {
        return selectOne("AdminEmissionManagementMapper.selectLatestEmissionRuntimeTransitionHistory", params);
    }

    public Map<String, Object> selectLatestEmissionCalcResult(Long sessionId) {
        return selectOne("AdminEmissionManagementMapper.selectLatestEmissionCalcResult", sessionId);
    }

    public List<Map<String, Object>> selectLatestEmissionCalcResultsByScope() {
        return selectList("AdminEmissionManagementMapper.selectLatestEmissionCalcResultsByScope");
    }
}
