package egovframework.com.platform.codex.service.impl;

import egovframework.com.platform.codex.mapper.AuthGroupManageMapper;
import egovframework.com.platform.codex.model.AdminRoleAssignmentVO;
import egovframework.com.platform.codex.model.AuthorInfoVO;
import egovframework.com.platform.codex.model.DepartmentRoleMappingVO;
import egovframework.com.platform.codex.model.FeatureAssignmentStatVO;
import egovframework.com.platform.codex.model.FeatureCatalogItemVO;
import egovframework.com.platform.codex.model.FeatureReferenceCountVO;
import egovframework.com.platform.codex.model.UserAuthorityTargetVO;
import egovframework.com.platform.codex.model.UserFeatureOverrideVO;
import egovframework.com.platform.codex.service.AuthGroupManageService;
import org.egovframe.rte.fdl.cmmn.EgovAbstractServiceImpl;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service("authGroupManageService")
public class AuthGroupManageServiceImpl extends EgovAbstractServiceImpl implements AuthGroupManageService {

    private static final Logger log = LoggerFactory.getLogger(AuthGroupManageServiceImpl.class);

    private final AuthGroupManageMapper authGroupManageMapper;

    public AuthGroupManageServiceImpl(AuthGroupManageMapper authGroupManageMapper) {
        this.authGroupManageMapper = authGroupManageMapper;
    }

    @Override
    public List<AuthorInfoVO> selectAuthorList() {
        return authGroupManageMapper.selectAuthorList();
    }

    @Override
    public AuthorInfoVO selectAuthor(String authorCode) {
        return authGroupManageMapper.selectAuthor(authorCode);
    }

    @Override
    public List<FeatureCatalogItemVO> selectFeatureCatalog() {
        return authGroupManageMapper.selectFeatureCatalog();
    }

    @Override
    public List<FeatureAssignmentStatVO> selectFeatureAssignmentStats() {
        return authGroupManageMapper.selectFeatureAssignmentStats();
    }

    @Override
    public List<String> selectAuthorFeatureCodes(String authorCode) {
        return authGroupManageMapper.selectAuthorFeatureCodes(authorCode);
    }

    @Override
    public int countAuthorCode(String authorCode) {
        return authGroupManageMapper.countAuthorCode(authorCode);
    }

    @Override
    public void insertAuthor(String authorCode, String authorNm, String authorDc) {
        AuthorInfoVO vo = new AuthorInfoVO();
        vo.setAuthorCode(authorCode == null ? "" : authorCode.trim().toUpperCase(Locale.ROOT));
        vo.setAuthorNm(authorNm == null ? "" : authorNm.trim());
        vo.setAuthorDc(authorDc == null ? "" : authorDc.trim());
        vo.setAuthorCreatDe(LocalDate.now().format(DateTimeFormatter.ofPattern("MM/dd/yyyy")));
        authGroupManageMapper.insertAuthor(vo);
    }

    @Override
    public void saveAuthorFeatureRelations(String authorCode, List<String> featureCodes) {
        authGroupManageMapper.deleteAuthorFeatureRelations(authorCode);
        if (featureCodes == null || featureCodes.isEmpty()) {
            return;
        }
        for (String featureCode : featureCodes) {
            Map<String, String> params = new HashMap<>();
            params.put("authorCode", authorCode);
            params.put("featureCode", featureCode);
            authGroupManageMapper.insertAuthorFeatureRelation(params);
        }
    }

    @Override
    public String selectAuthorCodeByUserId(String userId) {
        return authGroupManageMapper.selectAuthorCodeByUserId(userId);
    }

    @Override
    public List<String> selectRequiredViewFeatureCodesByMenuUrl(String menuUrl) {
        return authGroupManageMapper.selectRequiredViewFeatureCodesByMenuUrl(menuUrl);
    }

    @Override
    public String selectRequiredViewFeatureCodeByMenuUrl(String menuUrl) {
        return authGroupManageMapper.selectRequiredViewFeatureCodeByMenuUrl(menuUrl);
    }

    @Override
    public List<String> selectMenuCodesByMenuUrl(String menuUrl) {
        return authGroupManageMapper.selectMenuCodesByMenuUrl(menuUrl);
    }

    @Override
    public String selectMenuCodeByMenuUrl(String menuUrl) {
        return authGroupManageMapper.selectMenuCodeByMenuUrl(menuUrl);
    }

    @Override
    public List<String> selectFeatureCodesByMenuCode(String menuCode) {
        return authGroupManageMapper.selectFeatureCodesByMenuCode(menuCode);
    }

    @Override
    public boolean hasAuthorFeaturePermission(String authorCode, String featureCode) {
        return authGroupManageMapper.countAuthorFeaturePermission(authorCode, featureCode) > 0;
    }

    @Override
    public int countAuthorFeatureRelationsByFeatureCode(String featureCode) {
        return authGroupManageMapper.countAuthorFeatureRelationsByFeatureCode(featureCode);
    }

    @Override
    public int countUserFeatureOverridesByFeatureCode(String featureCode) {
        try {
            return authGroupManageMapper.countUserFeatureOverridesByFeatureCode(featureCode);
        } catch (RuntimeException ex) {
            if (isMissingUserFeatureOverrideTable(ex)) {
                log.warn("Skipping user feature override count because COMTNUSERFEATUREOVERRIDE is unavailable.");
                return 0;
            }
            throw ex;
        }
    }

    @Override
    public List<FeatureReferenceCountVO> selectAuthorFeatureRelationCounts(List<String> featureCodes) {
        return authGroupManageMapper.selectAuthorFeatureRelationCounts(featureCodes);
    }

    @Override
    public List<FeatureReferenceCountVO> selectUserFeatureOverrideCounts(List<String> featureCodes) {
        try {
            return authGroupManageMapper.selectUserFeatureOverrideCounts(featureCodes);
        } catch (RuntimeException ex) {
            if (isMissingUserFeatureOverrideTable(ex)) {
                log.warn("Skipping user feature override reference query because COMTNUSERFEATUREOVERRIDE is unavailable.");
                return Collections.emptyList();
            }
            throw ex;
        }
    }

    @Override
    public void deleteAuthorFeatureRelationsByFeatureCode(String featureCode) {
        authGroupManageMapper.deleteAuthorFeatureRelationsByFeatureCode(featureCode);
    }

    @Override
    public void deleteUserFeatureOverridesByFeatureCode(String featureCode) {
        try {
            authGroupManageMapper.deleteUserFeatureOverridesByFeatureCode(featureCode);
        } catch (RuntimeException ex) {
            if (isMissingUserFeatureOverrideTable(ex)) {
                log.warn("Skipping user feature override delete because COMTNUSERFEATUREOVERRIDE is unavailable.");
                return;
            }
            throw ex;
        }
    }

    @Override
    public List<UserFeatureOverrideVO> selectUserFeatureOverrides(String scrtyDtrmnTrgetId) {
        try {
            return authGroupManageMapper.selectUserFeatureOverrides(scrtyDtrmnTrgetId);
        } catch (RuntimeException ex) {
            if (isMissingUserFeatureOverrideTable(ex)) {
                log.warn("Skipping user feature override lookup because COMTNUSERFEATUREOVERRIDE is unavailable.");
                return Collections.emptyList();
            }
            throw ex;
        }
    }

    @Override
    public List<AdminRoleAssignmentVO> selectAdminRoleAssignments() {
        return authGroupManageMapper.selectAdminRoleAssignments();
    }

    @Override
    public int countAdminRoleAssignments(String orgnztId, String insttId, String searchKeyword) {
        Map<String, Object> params = new HashMap<>();
        params.put("orgnztId", orgnztId == null ? "" : orgnztId.trim());
        params.put("insttId", insttId == null ? "" : insttId.trim());
        params.put("searchKeyword", searchKeyword == null ? "" : searchKeyword.trim());
        return authGroupManageMapper.countAdminRoleAssignments(params);
    }

    @Override
    public List<AdminRoleAssignmentVO> selectAdminRoleAssignmentsPage(String orgnztId, String insttId, String searchKeyword, int firstIndex, int recordCountPerPage) {
        Map<String, Object> params = new HashMap<>();
        params.put("orgnztId", orgnztId == null ? "" : orgnztId.trim());
        params.put("insttId", insttId == null ? "" : insttId.trim());
        params.put("searchKeyword", searchKeyword == null ? "" : searchKeyword.trim());
        params.put("firstIndex", Math.max(firstIndex, 0));
        params.put("recordCountPerPage", Math.max(recordCountPerPage, 1));
        return authGroupManageMapper.selectAdminRoleAssignmentsPage(params);
    }

    @Override
    public List<DepartmentRoleMappingVO> selectDepartmentRoleMappings() {
        return authGroupManageMapper.selectDepartmentRoleMappings();
    }

    @Override
    public DepartmentRoleMappingVO selectDepartmentRoleMapping(String insttId, String deptNm) {
        Map<String, String> params = new HashMap<>();
        params.put("insttId", insttId == null ? "" : insttId.trim());
        params.put("deptNm", deptNm == null ? "" : deptNm.trim());
        return authGroupManageMapper.selectDepartmentRoleMapping(params);
    }

    @Override
    public List<UserAuthorityTargetVO> selectUserAuthorityTargets(String insttId, String searchKeyword) {
        Map<String, String> params = new HashMap<>();
        params.put("insttId", insttId == null ? "" : insttId.trim());
        params.put("searchKeyword", searchKeyword == null ? "" : searchKeyword.trim());
        return authGroupManageMapper.selectUserAuthorityTargets(params);
    }

    @Override
    public UserAuthorityTargetVO selectUserAuthorityTarget(String insttId, String userId) {
        Map<String, String> params = new HashMap<>();
        params.put("insttId", insttId == null ? "" : insttId.trim());
        params.put("userId", userId == null ? "" : userId.trim());
        return authGroupManageMapper.selectUserAuthorityTarget(params);
    }

    @Override
    public void updateAdminRoleAssignment(String emplyrId, String authorCode) {
        String normalizedEmplyrId = emplyrId == null ? "" : emplyrId.trim();
        String normalizedAuthorCode = authorCode == null ? "" : authorCode.trim().toUpperCase(Locale.ROOT);
        if (normalizedEmplyrId.isEmpty() || normalizedAuthorCode.isEmpty()) {
            throw new IllegalArgumentException("Employee ID and author code are required.");
        }

        String esntlId = authGroupManageMapper.selectEssentialIdByEmplyrId(normalizedEmplyrId);
        if (esntlId == null || esntlId.trim().isEmpty()) {
            throw new IllegalArgumentException("Employee not found.");
        }

        Map<String, String> params = new HashMap<>();
        params.put("esntlId", esntlId.trim());
        params.put("authorCode", normalizedAuthorCode);

        if (authGroupManageMapper.countEmployrSecurityMapping(esntlId.trim()) > 0) {
            authGroupManageMapper.updateEmployrSecurityAuthorCode(params);
            return;
        }

        authGroupManageMapper.insertEmployrSecurityMapping(params);
    }

    @Override
    public String selectAdminEssentialIdByUserId(String emplyrId) {
        return authGroupManageMapper.selectEssentialIdByEmplyrId(emplyrId);
    }

    @Override
    public String selectAdminInsttIdByUserId(String emplyrId) {
        return authGroupManageMapper.selectAdminInsttIdByUserId(emplyrId);
    }

    @Override
    public String selectEnterpriseInsttIdByUserId(String entrprsMberId) {
        return authGroupManageMapper.selectEnterpriseInsttIdByUserId(entrprsMberId);
    }

    @Override
    public String selectEnterpriseAuthorCodeByUserId(String entrprsMberId) {
        return authGroupManageMapper.selectEnterpriseAuthorCodeByUserId(entrprsMberId);
    }

    @Override
    public void updateEnterpriseUserRoleAssignment(String entrprsMberId, String authorCode) {
        String normalizedUserId = entrprsMberId == null ? "" : entrprsMberId.trim();
        String normalizedAuthorCode = authorCode == null ? "" : authorCode.trim().toUpperCase(Locale.ROOT);
        if (normalizedUserId.isEmpty() || normalizedAuthorCode.isEmpty()) {
            throw new IllegalArgumentException("Enterprise member ID and author code are required.");
        }

        String esntlId = authGroupManageMapper.selectEnterpriseEssentialIdByUserId(normalizedUserId);
        if (esntlId == null || esntlId.trim().isEmpty()) {
            throw new IllegalArgumentException("Enterprise member not found.");
        }

        Map<String, String> params = new HashMap<>();
        params.put("esntlId", esntlId.trim());
        params.put("authorCode", normalizedAuthorCode);

        if (authGroupManageMapper.countEmployrSecurityMapping(esntlId.trim()) > 0) {
            authGroupManageMapper.updateEmployrSecurityAuthorCode(params);
            return;
        }

        authGroupManageMapper.insertEnterpriseSecurityMapping(params);
    }

    @Override
    public void replaceUserFeatureOverrides(String scrtyDtrmnTrgetId, String mberTyCode, List<String> allowFeatureCodes,
                                            List<String> denyFeatureCodes, String actorId) {
        String normalizedTargetId = scrtyDtrmnTrgetId == null ? "" : scrtyDtrmnTrgetId.trim();
        String normalizedMemberType = mberTyCode == null ? "" : mberTyCode.trim().toUpperCase(Locale.ROOT);
        if (normalizedTargetId.isEmpty()) {
            throw new IllegalArgumentException("Security target ID is required.");
        }
        try {
            authGroupManageMapper.deleteUserFeatureOverrides(normalizedTargetId);
            insertFeatureOverrides(normalizedTargetId, normalizedMemberType, allowFeatureCodes, "A", actorId);
            insertFeatureOverrides(normalizedTargetId, normalizedMemberType, denyFeatureCodes, "D", actorId);
        } catch (RuntimeException ex) {
            if (isMissingUserFeatureOverrideTable(ex)) {
                log.warn("Skipping user feature override update because COMTNUSERFEATUREOVERRIDE is unavailable.");
                return;
            }
            throw ex;
        }
    }

    @Override
    public void saveDepartmentRoleMapping(String insttId, String cmpnyNm, String deptNm, String authorCode, String actorId) {
        String normalizedInsttId = insttId == null ? "" : insttId.trim();
        String normalizedCmpnyNm = cmpnyNm == null ? "" : cmpnyNm.trim();
        String normalizedDeptNm = deptNm == null ? "" : deptNm.trim();
        String normalizedAuthorCode = authorCode == null ? "" : authorCode.trim().toUpperCase(Locale.ROOT);
        String normalizedActorId = actorId == null ? "" : actorId.trim();

        if (normalizedInsttId.isEmpty() || normalizedDeptNm.isEmpty() || normalizedAuthorCode.isEmpty()) {
            throw new IllegalArgumentException("Company ID, department, and role are required.");
        }

        Map<String, String> params = new HashMap<>();
        params.put("insttId", normalizedInsttId);
        params.put("cmpnyNm", normalizedCmpnyNm);
        params.put("deptNm", normalizedDeptNm);
        params.put("authorCode", normalizedAuthorCode);
        params.put("actorId", normalizedActorId.isEmpty() ? "SYSTEM" : normalizedActorId);

        if (authGroupManageMapper.countDepartmentRoleMapping(params) > 0) {
            authGroupManageMapper.updateDepartmentRoleMapping(params);
            return;
        }

        authGroupManageMapper.insertDepartmentRoleMapping(params);
    }

    private void insertFeatureOverrides(String scrtyDtrmnTrgetId, String mberTyCode, List<String> featureCodes,
                                        String overrideType, String actorId) {
        if (featureCodes == null || featureCodes.isEmpty()) {
            return;
        }
        String normalizedActorId = actorId == null || actorId.trim().isEmpty() ? "SYSTEM" : actorId.trim();
        for (String featureCode : featureCodes) {
            String normalizedFeatureCode = featureCode == null ? "" : featureCode.trim().toUpperCase(Locale.ROOT);
            if (normalizedFeatureCode.isEmpty()) {
                continue;
            }
            Map<String, String> params = new HashMap<>();
            params.put("scrtyDtrmnTrgetId", scrtyDtrmnTrgetId);
            params.put("mberTyCode", mberTyCode);
            params.put("featureCode", normalizedFeatureCode);
            params.put("overrideType", overrideType);
            params.put("actorId", normalizedActorId);
            authGroupManageMapper.insertUserFeatureOverride(params);
        }
    }

    private boolean isMissingUserFeatureOverrideTable(Throwable throwable) {
        Throwable current = throwable;
        while (current != null) {
            String message = current.getMessage();
            if (message != null) {
                String normalized = message.toUpperCase(Locale.ROOT);
                if (normalized.contains("COMTNUSERFEATUREOVERRIDE") && normalized.contains("UNKNOWN CLASS")) {
                    return true;
                }
            }
            current = current.getCause();
        }
        return false;
    }
}
