package egovframework.com.platform.codex.mapper;

import egovframework.com.common.context.ProjectRuntimeContext;
import egovframework.com.common.mapper.support.BaseMapperSupport;
import egovframework.com.platform.codex.model.AdminRoleAssignmentVO;
import egovframework.com.platform.codex.model.AuthorInfoVO;
import egovframework.com.platform.codex.model.DepartmentRoleMappingVO;
import egovframework.com.platform.codex.model.FeatureAssignmentStatVO;
import egovframework.com.platform.codex.model.FeatureCatalogItemVO;
import egovframework.com.platform.codex.model.FeatureReferenceCountVO;
import egovframework.com.platform.codex.model.UserAuthorityTargetVO;
import egovframework.com.platform.codex.model.UserFeatureOverrideVO;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component("authGroupManageMapper")
public class AuthGroupManageMapper extends BaseMapperSupport {

    private final ProjectRuntimeContext projectRuntimeContext;

    public AuthGroupManageMapper(ProjectRuntimeContext projectRuntimeContext) {
        this.projectRuntimeContext = projectRuntimeContext;
    }

    public List<AuthorInfoVO> selectAuthorList() {
        return selectList("AuthGroupManageMapper.selectAuthorList");
    }

    public AuthorInfoVO selectAuthor(String authorCode) {
        return selectOne("AuthGroupManageMapper.selectAuthor", authorCode);
    }

    public List<FeatureCatalogItemVO> selectFeatureCatalog() {
        return selectList("AuthGroupManageMapper.selectFeatureCatalog");
    }

    public List<Map<String, String>> selectActiveMenuUrlRows() {
        return selectList("AuthGroupManageMapper.selectActiveMenuUrlRows");
    }

    public List<Map<String, String>> selectActiveMenuViewFeatureRows() {
        return selectList("AuthGroupManageMapper.selectActiveMenuViewFeatureRows");
    }

    public List<Map<String, String>> selectActiveMenusMissingViewRows() {
        return selectList("AuthGroupManageMapper.selectActiveMenusMissingViewRows");
    }

    public List<Map<String, String>> selectInactiveAuthorFeatureRelationRows() {
        return selectList("AuthGroupManageMapper.selectInactiveAuthorFeatureRelationRows");
    }

    public List<Map<String, String>> selectInactiveUserFeatureOverrideRows() {
        return selectList("AuthGroupManageMapper.selectInactiveUserFeatureOverrideRows");
    }

    public List<Map<String, String>> selectSensitiveFeatureRoleExposureRows() {
        return selectList("AuthGroupManageMapper.selectSensitiveFeatureRoleExposureRows");
    }

    public List<Map<String, String>> selectCompanyScopeSensitiveFeatureExposureRows() {
        return selectList("AuthGroupManageMapper.selectCompanyScopeSensitiveFeatureExposureRows");
    }

    public List<FeatureAssignmentStatVO> selectFeatureAssignmentStats() {
        return selectList("AuthGroupManageMapper.selectFeatureAssignmentStats");
    }

    public List<String> selectAuthorFeatureCodes(String authorCode) {
        return selectList("AuthGroupManageMapper.selectAuthorFeatureCodes", authorCode);
    }

    public int countAuthorCode(String authorCode) {
        Integer count = selectOne("AuthGroupManageMapper.countAuthorCode", authorCode);
        return count == null ? 0 : count;
    }

    public void insertAuthor(AuthorInfoVO authorInfoVO) {
        insert("AuthGroupManageMapper.insertAuthor", authorInfoVO);
    }

    public void deleteAuthorFeatureRelations(String authorCode) {
        delete("AuthGroupManageMapper.deleteAuthorFeatureRelations", authorCode);
    }

    public void insertAuthorFeatureRelation(Map<String, String> params) {
        insert("AuthGroupManageMapper.insertAuthorFeatureRelation", params);
    }

    public String selectAuthorCodeByUserId(String userId) {
        return selectOne("AuthGroupManageMapper.selectAuthorCodeByUserId", userId);
    }

    public List<String> selectRequiredViewFeatureCodesByMenuUrl(String menuUrl) {
        return selectList("AuthGroupManageMapper.selectRequiredViewFeatureCodeByMenuUrl", menuUrl);
    }

    public String selectRequiredViewFeatureCodeByMenuUrl(String menuUrl) {
        List<String> featureCodes = selectRequiredViewFeatureCodesByMenuUrl(menuUrl);
        return featureCodes == null || featureCodes.isEmpty() ? null : featureCodes.get(0);
    }

    public List<String> selectMenuCodesByMenuUrl(String menuUrl) {
        return selectList("AuthGroupManageMapper.selectMenuCodeByMenuUrl", menuUrl);
    }

    public String selectMenuCodeByMenuUrl(String menuUrl) {
        List<String> menuCodes = selectMenuCodesByMenuUrl(menuUrl);
        return menuCodes == null || menuCodes.isEmpty() ? null : menuCodes.get(0);
    }

    public List<String> selectFeatureCodesByMenuCode(String menuCode) {
        return selectList("AuthGroupManageMapper.selectFeatureCodesByMenuCode", menuCode);
    }

    public List<String> selectAuthorCodesByFeatureCode(String featureCode) {
        return selectList("AuthGroupManageMapper.selectAuthorCodesByFeatureCode", featureCode);
    }

    public int countAuthorFeaturePermission(String authorCode, String featureCode) {
        Map<String, String> params = new java.util.HashMap<>();
        params.put("authorCode", authorCode);
        params.put("featureCode", featureCode);
        Integer count = selectOne("AuthGroupManageMapper.countAuthorFeaturePermission", params);
        return count == null ? 0 : count;
    }

    public int countAuthorFeatureRelationsByFeatureCode(String featureCode) {
        Integer count = selectOne("AuthGroupManageMapper.countAuthorFeatureRelationsByFeatureCode", featureCode);
        return count == null ? 0 : count;
    }

    public int countUserFeatureOverridesByFeatureCode(String featureCode) {
        Integer count = selectOne("AuthGroupManageMapper.countUserFeatureOverridesByFeatureCode", featureCode);
        return count == null ? 0 : count;
    }

    public List<FeatureReferenceCountVO> selectAuthorFeatureRelationCounts(List<String> featureCodes) {
        return selectList("AuthGroupManageMapper.selectAuthorFeatureRelationCounts", featureCodes);
    }

    public List<FeatureReferenceCountVO> selectUserFeatureOverrideCounts(List<String> featureCodes) {
        return selectList("AuthGroupManageMapper.selectUserFeatureOverrideCounts", featureCodes);
    }

    public void deleteAuthorFeatureRelationsByFeatureCode(String featureCode) {
        delete("AuthGroupManageMapper.deleteAuthorFeatureRelationsByFeatureCode", featureCode);
    }

    public void deleteAuthorFeatureRelation(String authorCode, String featureCode) {
        Map<String, String> params = new java.util.HashMap<>();
        params.put("authorCode", authorCode);
        params.put("featureCode", featureCode);
        delete("AuthGroupManageMapper.deleteAuthorFeatureRelation", params);
    }

    public void deleteUserFeatureOverridesByFeatureCode(String featureCode) {
        delete("AuthGroupManageMapper.deleteUserFeatureOverridesByFeatureCode", featureCode);
    }

    public List<UserFeatureOverrideVO> selectUserFeatureOverrides(String scrtyDtrmnTrgetId) {
        return selectList("AuthGroupManageMapper.selectUserFeatureOverrides", scrtyDtrmnTrgetId);
    }

    public List<AdminRoleAssignmentVO> selectAdminRoleAssignments() {
        return selectList("AuthGroupManageMapper.selectAdminRoleAssignments");
    }

    public int countAdminRoleAssignments(Map<String, Object> params) {
        Integer count = selectOne("AuthGroupManageMapper.countAdminRoleAssignments", params);
        return count == null ? 0 : count;
    }

    public List<AdminRoleAssignmentVO> selectAdminRoleAssignmentsPage(Map<String, Object> params) {
        return selectList("AuthGroupManageMapper.selectAdminRoleAssignmentsPage", params);
    }

    public List<DepartmentRoleMappingVO> selectDepartmentRoleMappings() {
        return selectList("AuthGroupManageMapper.selectDepartmentRoleMappings", projectScopeParams());
    }

    public DepartmentRoleMappingVO selectDepartmentRoleMapping(Map<String, String> params) {
        return selectOne("AuthGroupManageMapper.selectDepartmentRoleMapping", projectScopeParams(params));
    }

    public List<UserAuthorityTargetVO> selectUserAuthorityTargets(Map<String, String> params) {
        return selectList("AuthGroupManageMapper.selectUserAuthorityTargets", projectScopeParams(params));
    }

    public UserAuthorityTargetVO selectUserAuthorityTarget(Map<String, String> params) {
        return selectOne("AuthGroupManageMapper.selectUserAuthorityTarget", projectScopeParams(params));
    }

    public String selectEssentialIdByEmplyrId(String emplyrId) {
        return selectOne("AuthGroupManageMapper.selectEssentialIdByEmplyrId", emplyrId);
    }

    public String selectAdminInsttIdByUserId(String emplyrId) {
        return selectOne("AuthGroupManageMapper.selectAdminInsttIdByUserId", emplyrId);
    }

    public String selectEnterpriseAuthorCodeByUserId(String entrprsMberId) {
        return selectOne("AuthGroupManageMapper.selectEnterpriseAuthorCodeByUserId", projectScopeParams("userId", entrprsMberId));
    }

    public String selectEnterpriseEssentialIdByUserId(String entrprsMberId) {
        return selectOne("AuthGroupManageMapper.selectEnterpriseEssentialIdByUserId", projectScopeParams("userId", entrprsMberId));
    }

    public String selectEnterpriseInsttIdByUserId(String entrprsMberId) {
        return selectOne("AuthGroupManageMapper.selectEnterpriseInsttIdByUserId", projectScopeParams("userId", entrprsMberId));
    }

    public int countEmployrSecurityMapping(String esntlId) {
        Integer count = selectOne("AuthGroupManageMapper.countEmployrSecurityMapping", esntlId);
        return count == null ? 0 : count;
    }

    public void updateEmployrSecurityAuthorCode(Map<String, String> params) {
        update("AuthGroupManageMapper.updateEmployrSecurityAuthorCode", params);
    }

    public void insertEmployrSecurityMapping(Map<String, String> params) {
        insert("AuthGroupManageMapper.insertEmployrSecurityMapping", params);
    }

    public void insertEnterpriseSecurityMapping(Map<String, String> params) {
        insert("AuthGroupManageMapper.insertEnterpriseSecurityMapping", params);
    }

    public void deleteUserFeatureOverrides(String scrtyDtrmnTrgetId) {
        delete("AuthGroupManageMapper.deleteUserFeatureOverrides", scrtyDtrmnTrgetId);
    }

    public void insertUserFeatureOverride(Map<String, String> params) {
        insert("AuthGroupManageMapper.insertUserFeatureOverride", params);
    }

    public int countDepartmentRoleMapping(Map<String, String> params) {
        Integer count = selectOne("AuthGroupManageMapper.countDepartmentRoleMapping", params);
        return count == null ? 0 : count;
    }

    public void updateDepartmentRoleMapping(Map<String, String> params) {
        update("AuthGroupManageMapper.updateDepartmentRoleMapping", params);
    }

    public void insertDepartmentRoleMapping(Map<String, String> params) {
        insert("AuthGroupManageMapper.insertDepartmentRoleMapping", params);
    }

    private Map<String, Object> projectScopeParams() {
        return projectScopeParams(new java.util.HashMap<>());
    }

    private Map<String, Object> projectScopeParams(Map<String, ?> params) {
        Map<String, Object> scoped = new java.util.HashMap<>();
        if (params != null) {
            scoped.putAll(params);
        }
        String projectId = currentProjectId();
        if (!projectId.isEmpty() && !scoped.containsKey("projectId")) {
            scoped.put("projectId", projectId);
        }
        return scoped;
    }

    private Map<String, Object> projectScopeParams(String key, String value) {
        Map<String, Object> params = new java.util.HashMap<>();
        params.put(key, value);
        return projectScopeParams(params);
    }

    private String currentProjectId() {
        return projectRuntimeContext == null || projectRuntimeContext.getProjectId() == null
                ? ""
                : projectRuntimeContext.getProjectId().trim();
    }

    public void disableMenusByMenuCodes(List<String> menuCodes) {
        if (menuCodes == null || menuCodes.isEmpty()) {
            return;
        }
        update("AuthGroupManageMapper.disableMenusByMenuCodes", menuCodes);
    }

    public void disableFeaturesByFeatureCodes(List<String> featureCodes) {
        if (featureCodes == null || featureCodes.isEmpty()) {
            return;
        }
        update("AuthGroupManageMapper.disableFeaturesByFeatureCodes", featureCodes);
    }

    public void enableFeaturesByFeatureCodes(List<String> featureCodes) {
        if (featureCodes == null || featureCodes.isEmpty()) {
            return;
        }
        update("AuthGroupManageMapper.enableFeaturesByFeatureCodes", featureCodes);
    }

    public void deactivateUserFeatureOverride(String targetId, String featureCode) {
        Map<String, String> params = new java.util.HashMap<>();
        params.put("targetId", targetId);
        params.put("featureCode", featureCode);
        update("AuthGroupManageMapper.deactivateUserFeatureOverride", params);
    }

    public void reactivateUserFeatureOverride(String targetId, String featureCode) {
        Map<String, String> params = new java.util.HashMap<>();
        params.put("targetId", targetId);
        params.put("featureCode", featureCode);
        update("AuthGroupManageMapper.reactivateUserFeatureOverride", params);
    }
}
