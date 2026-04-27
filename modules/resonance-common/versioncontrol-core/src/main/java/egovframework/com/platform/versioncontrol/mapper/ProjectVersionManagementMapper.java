package egovframework.com.platform.versioncontrol.mapper;

import egovframework.com.common.mapper.support.BaseMapperSupport;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;

@Component("projectVersionManagementMapper")
public class ProjectVersionManagementMapper extends BaseMapperSupport {

    private static final String NAMESPACE = "egovframework.com.platform.versioncontrol.mapper.ProjectVersionManagementMapper";

    public Map<String, Object> selectProjectOverview(String projectId) {
        return selectOne(NAMESPACE + ".selectProjectOverview", idParam("projectId", projectId));
    }

    public List<Map<String, Object>> selectInstalledArtifactList(String projectId) {
        return selectList(NAMESPACE + ".selectInstalledArtifactList", idParam("projectId", projectId));
    }

    public List<Map<String, Object>> selectInstalledPackageList(String projectId) {
        return selectList(NAMESPACE + ".selectInstalledPackageList", idParam("projectId", projectId));
    }

    public List<Map<String, Object>> selectAdapterHistoryList(Map<String, Object> params) {
        return selectList(NAMESPACE + ".selectAdapterHistoryList", params);
    }

    public Integer countAdapterHistory(String projectId) {
        return selectOne(NAMESPACE + ".countAdapterHistory", idParam("projectId", projectId));
    }

    public List<Map<String, Object>> selectReleaseUnitList(Map<String, Object> params) {
        return selectList(NAMESPACE + ".selectReleaseUnitList", params);
    }

    public List<Map<String, Object>> selectReleaseUnits(String projectId) {
        return selectReleaseUnitList(defaultPageParams(projectId));
    }

    public Integer countReleaseUnits(String projectId) {
        return selectOne(NAMESPACE + ".countReleaseUnits", idParam("projectId", projectId));
    }

    public List<Map<String, Object>> selectServerDeploymentStateList(String projectId) {
        return selectList(NAMESPACE + ".selectServerDeploymentStateList", idParam("projectId", projectId));
    }

    public List<Map<String, Object>> selectServerDeploymentState(String projectId) {
        return selectServerDeploymentStateList(projectId);
    }

    public List<Map<String, Object>> selectCandidateArtifactList(Map<String, Object> params) {
        return selectList(NAMESPACE + ".selectCandidateArtifactList", params);
    }

    public Integer countCandidateArtifacts(String projectId) {
        return selectOne(NAMESPACE + ".countCandidateArtifacts", idParam("projectId", projectId));
    }

    public List<Map<String, Object>> selectArtifactLockList(Map<String, Object> params) {
        return selectList(NAMESPACE + ".selectArtifactLockList", params);
    }

    public Integer countArtifactLocks(String projectId) {
        return selectOne(NAMESPACE + ".countArtifactLocks", idParam("projectId", projectId));
    }

    public List<Map<String, Object>> selectCompatibilityRunList(Map<String, Object> params) {
        return selectList(NAMESPACE + ".selectCompatibilityRunList", params);
    }

    public Integer countCompatibilityRuns(String projectId) {
        return selectOne(NAMESPACE + ".countCompatibilityRuns", idParam("projectId", projectId));
    }

    public Map<String, Object> selectArtifactVersion(Map<String, Object> params) {
        return selectOne(NAMESPACE + ".selectArtifactVersion", params);
    }

    public Map<String, Object> selectArtifactVersionByKey(Map<String, Object> params) {
        return selectArtifactVersion(params);
    }

    public Map<String, Object> selectActiveInstalledArtifact(Map<String, Object> params) {
        return selectOne(NAMESPACE + ".selectActiveInstalledArtifact", params);
    }

    public Map<String, Object> selectReleaseUnit(String releaseUnitId) {
        return selectOne(NAMESPACE + ".selectReleaseUnit", idParam("releaseUnitId", releaseUnitId));
    }

    public Map<String, Object> selectProjectRegistry(String projectId) {
        return selectOne(NAMESPACE + ".selectProjectRegistry", idParam("projectId", projectId));
    }

    public List<Map<String, Object>> selectInstalledArtifacts(String projectId) {
        return selectInstalledArtifactList(projectId);
    }

    public Integer countArtifactVersionRegistry() {
        return selectOne(NAMESPACE + ".countArtifactVersionRegistry");
    }

    public Integer countProjectArtifactInstall() {
        return selectOne(NAMESPACE + ".countProjectArtifactInstall");
    }

    public Integer countReleaseUnitRegistry() {
        return selectOne(NAMESPACE + ".countReleaseUnitRegistry");
    }

    public int deactivateArtifactInstall(Map<String, Object> params) {
        return update(NAMESPACE + ".deactivateArtifactInstall", params);
    }

    public int deactivateProjectArtifactInstalls(String projectId) {
        return update(NAMESPACE + ".deactivateProjectArtifactInstalls", idParam("projectId", projectId));
    }

    public void insertProjectArtifactInstall(Map<String, Object> params) {
        insert(NAMESPACE + ".insertProjectArtifactInstall", params);
    }

    public void insertAdapterChangeLog(Map<String, Object> params) {
        insert(NAMESPACE + ".insertAdapterChangeLog", params);
    }

    public void insertReleaseUnitRegistry(Map<String, Object> params) {
        insert(NAMESPACE + ".insertReleaseUnitRegistry", params);
    }

    public void insertServerDeploymentState(Map<String, Object> params) {
        insert(NAMESPACE + ".insertServerDeploymentState", params);
    }

    public int deleteArtifactLock(Map<String, Object> params) {
        return delete(NAMESPACE + ".deleteArtifactLock", params);
    }

    public void insertArtifactLock(Map<String, Object> params) {
        insert(NAMESPACE + ".insertArtifactLock", params);
    }

    public void insertCompatibilityRun(Map<String, Object> params) {
        insert(NAMESPACE + ".insertCompatibilityRun", params);
    }

    public List<Map<String, Object>> selectRecentDeploymentHistory(String projectId) {
        return selectList(NAMESPACE + ".selectRecentDeploymentHistory", idParam("projectId", projectId));
    }

    public void insertProjectDeploymentHistory(Map<String, Object> params) {
        insert(NAMESPACE + ".insertProjectDeploymentHistory", params);
    }

    public int updateProjectDeploymentHistory(Map<String, Object> params) {
        return update(NAMESPACE + ".updateProjectDeploymentHistory", params);
    }

    private Map<String, Object> defaultPageParams(String projectId) {
        Map<String, Object> params = new LinkedHashMap<String, Object>();
        params.put("projectId", projectId);
        params.put("pageSize", Integer.valueOf(200));
        params.put("offset", Integer.valueOf(0));
        return params;
    }

    private Map<String, Object> idParam(String key, String value) {
        Map<String, Object> params = new LinkedHashMap<String, Object>();
        params.put(key, value);
        return params;
    }
}
