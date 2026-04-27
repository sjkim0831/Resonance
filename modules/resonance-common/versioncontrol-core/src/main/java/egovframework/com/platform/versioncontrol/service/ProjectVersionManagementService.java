package egovframework.com.platform.versioncontrol.service;

import egovframework.com.platform.versioncontrol.model.ProjectApplyUpgradeRequest;
import egovframework.com.platform.versioncontrol.model.ProjectRollbackRequest;
import egovframework.com.platform.versioncontrol.model.ProjectUpgradeImpactRequest;
import egovframework.com.platform.versioncontrol.model.ProjectVersionPageRequest;

import java.util.Map;

public interface ProjectVersionManagementService {

    Map<String, Object> getProjectVersionOverview(String projectId) throws Exception;

    Map<String, Object> getAdapterHistory(ProjectVersionPageRequest request) throws Exception;

    Map<String, Object> getReleaseUnits(ProjectVersionPageRequest request) throws Exception;

    Map<String, Object> getServerDeployState(String projectId) throws Exception;

    Map<String, Object> getCandidateArtifacts(ProjectVersionPageRequest request) throws Exception;

    Map<String, Object> getFleetUpgradeGovernance(ProjectVersionPageRequest request) throws Exception;

    Map<String, Object> analyzeUpgradeImpact(ProjectUpgradeImpactRequest request) throws Exception;

    Map<String, Object> applyUpgrade(ProjectApplyUpgradeRequest request) throws Exception;

    Map<String, Object> rollbackProject(ProjectRollbackRequest request) throws Exception;
}
