package egovframework.com.platform.versioncontrol.service;

import egovframework.com.platform.versioncontrol.model.vo.ReleaseUnitVO;
import egovframework.com.platform.versioncontrol.model.vo.RuntimePackageVO;
import egovframework.com.platform.versioncontrol.model.vo.DeployTraceVO;

import java.util.List;

public interface VersionControlService {

    // Release Unit Management
    String createReleaseUnit(ReleaseUnitVO releaseUnit);
    ReleaseUnitVO getReleaseUnit(String releaseUnitId);
    List<ReleaseUnitVO> getReleaseUnitsByProject(String projectId);
    void updateReleaseStatus(String releaseUnitId, String status);

    // Runtime Package Management
    String registerRuntimePackage(RuntimePackageVO runtimePackage);
    RuntimePackageVO getRuntimePackage(String runtimePackageId);
    List<RuntimePackageVO> getPackagesByReleaseUnit(String releaseUnitId);

    // Deploy Trace Management
    String recordDeployStart(DeployTraceVO deployTrace);
    void recordDeployResult(String deployTraceId, String status, String log);
    DeployTraceVO getLatestDeployTrace(String runtimePackageId, String targetEnv);
    List<DeployTraceVO> getDeployHistory(String projectId, String targetEnv);
}
