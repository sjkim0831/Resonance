package egovframework.com.platform.codex.service;

import egovframework.com.platform.codex.model.AdminRoleAssignmentVO;
import egovframework.com.platform.codex.model.AuthorInfoVO;
import egovframework.com.platform.codex.model.DepartmentRoleMappingVO;
import egovframework.com.platform.codex.model.FeatureAssignmentStatVO;
import egovframework.com.platform.codex.model.FeatureCatalogItemVO;
import egovframework.com.platform.codex.model.FeatureReferenceCountVO;
import egovframework.com.platform.codex.model.UserAuthorityTargetVO;
import egovframework.com.platform.codex.model.UserFeatureOverrideVO;

import java.util.List;

public interface AuthGroupManageService {

    List<AuthorInfoVO> selectAuthorList() throws Exception;

    AuthorInfoVO selectAuthor(String authorCode) throws Exception;

    List<FeatureCatalogItemVO> selectFeatureCatalog() throws Exception;

    List<FeatureAssignmentStatVO> selectFeatureAssignmentStats() throws Exception;

    List<String> selectAuthorFeatureCodes(String authorCode) throws Exception;

    int countAuthorCode(String authorCode) throws Exception;

    void insertAuthor(String authorCode, String authorNm, String authorDc) throws Exception;

    void saveAuthorFeatureRelations(String authorCode, List<String> featureCodes) throws Exception;

    String selectAuthorCodeByUserId(String userId) throws Exception;

    List<String> selectRequiredViewFeatureCodesByMenuUrl(String menuUrl) throws Exception;

    String selectRequiredViewFeatureCodeByMenuUrl(String menuUrl) throws Exception;

    List<String> selectMenuCodesByMenuUrl(String menuUrl) throws Exception;

    String selectMenuCodeByMenuUrl(String menuUrl) throws Exception;

    List<String> selectFeatureCodesByMenuCode(String menuCode) throws Exception;

    boolean hasAuthorFeaturePermission(String authorCode, String featureCode) throws Exception;

    int countAuthorFeatureRelationsByFeatureCode(String featureCode) throws Exception;

    int countUserFeatureOverridesByFeatureCode(String featureCode) throws Exception;

    List<FeatureReferenceCountVO> selectAuthorFeatureRelationCounts(List<String> featureCodes) throws Exception;

    List<FeatureReferenceCountVO> selectUserFeatureOverrideCounts(List<String> featureCodes) throws Exception;

    void deleteAuthorFeatureRelationsByFeatureCode(String featureCode) throws Exception;

    void deleteUserFeatureOverridesByFeatureCode(String featureCode) throws Exception;

    List<UserFeatureOverrideVO> selectUserFeatureOverrides(String scrtyDtrmnTrgetId) throws Exception;

    List<AdminRoleAssignmentVO> selectAdminRoleAssignments() throws Exception;

    int countAdminRoleAssignments(String orgnztId, String insttId, String searchKeyword) throws Exception;

    List<AdminRoleAssignmentVO> selectAdminRoleAssignmentsPage(String orgnztId, String insttId, String searchKeyword, int firstIndex, int recordCountPerPage) throws Exception;

    List<DepartmentRoleMappingVO> selectDepartmentRoleMappings() throws Exception;

    DepartmentRoleMappingVO selectDepartmentRoleMapping(String insttId, String deptNm) throws Exception;

    List<UserAuthorityTargetVO> selectUserAuthorityTargets(String insttId, String searchKeyword) throws Exception;

    UserAuthorityTargetVO selectUserAuthorityTarget(String insttId, String userId) throws Exception;

    void updateAdminRoleAssignment(String emplyrId, String authorCode) throws Exception;

    String selectAdminEssentialIdByUserId(String emplyrId) throws Exception;

    String selectAdminInsttIdByUserId(String emplyrId) throws Exception;

    String selectEnterpriseInsttIdByUserId(String entrprsMberId) throws Exception;

    String selectEnterpriseAuthorCodeByUserId(String entrprsMberId) throws Exception;

    void updateEnterpriseUserRoleAssignment(String entrprsMberId, String authorCode) throws Exception;

    void replaceUserFeatureOverrides(String scrtyDtrmnTrgetId, String mberTyCode, List<String> allowFeatureCodes,
                                     List<String> denyFeatureCodes, String actorId) throws Exception;

    void saveDepartmentRoleMapping(String insttId, String cmpnyNm, String deptNm, String authorCode, String actorId) throws Exception;
}
