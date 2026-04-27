package egovframework.com.platform.versioncontrol.service.impl;

import egovframework.com.platform.versioncontrol.mapper.VersionControlMapper;
import egovframework.com.platform.versioncontrol.model.vo.ReleaseUnitVO;
import egovframework.com.platform.versioncontrol.model.vo.RuntimePackageVO;
import egovframework.com.platform.versioncontrol.model.vo.DeployTraceVO;
import egovframework.com.platform.versioncontrol.service.VersionControlService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
public class VersionControlServiceImpl implements VersionControlService {

    private final VersionControlMapper versionControlMapper;

    @Override
    public String createReleaseUnit(ReleaseUnitVO releaseUnit) {
        String id = "RU-" + UUID.randomUUID().toString().substring(0, 8);
        releaseUnit.setReleaseUnitId(id);
        releaseUnit.setCreatedAt(LocalDateTime.now());
        if (releaseUnit.getCreatedBy() == null) {
            releaseUnit.setCreatedBy("SYSTEM");
        }
        versionControlMapper.insertReleaseUnit(releaseUnit);
        return id;
    }

    @Override
    public ReleaseUnitVO getReleaseUnit(String releaseUnitId) {
        return versionControlMapper.selectReleaseUnit(releaseUnitId);
    }

    @Override
    public List<ReleaseUnitVO> getReleaseUnitsByProject(String projectId) {
        return versionControlMapper.selectReleaseUnitsByProject(projectId);
    }

    @Override
    public void updateReleaseStatus(String releaseUnitId, String status) {
        ReleaseUnitVO vo = new ReleaseUnitVO();
        vo.setReleaseUnitId(releaseUnitId);
        vo.setReleaseStatus(status);
        vo.setUpdatedAt(LocalDateTime.now());
        versionControlMapper.updateReleaseStatus(vo);
    }

    @Override
    public String registerRuntimePackage(RuntimePackageVO runtimePackage) {
        String id = "PK-" + UUID.randomUUID().toString().substring(0, 8);
        runtimePackage.setRuntimePackageId(id);
        runtimePackage.setCreatedAt(LocalDateTime.now());
        versionControlMapper.insertRuntimePackage(runtimePackage);
        return id;
    }

    @Override
    public RuntimePackageVO getRuntimePackage(String runtimePackageId) {
        return versionControlMapper.selectRuntimePackage(runtimePackageId);
    }

    @Override
    public List<RuntimePackageVO> getPackagesByReleaseUnit(String releaseUnitId) {
        return versionControlMapper.selectPackagesByReleaseUnit(releaseUnitId);
    }

    @Override
    public String recordDeployStart(DeployTraceVO deployTrace) {
        String id = "DT-" + UUID.randomUUID().toString().substring(0, 8);
        deployTrace.setDeployTraceId(id);
        deployTrace.setStartedAt(LocalDateTime.now());
        deployTrace.setDeployStatus("START");
        if (deployTrace.getOperatorId() == null) {
            deployTrace.setOperatorId("SYSTEM");
        }
        versionControlMapper.insertDeployTrace(deployTrace);
        return id;
    }

    @Override
    public void recordDeployResult(String deployTraceId, String status, String log) {
        DeployTraceVO vo = new DeployTraceVO();
        vo.setDeployTraceId(deployTraceId);
        vo.setDeployStatus(status);
        vo.setDeployLog(log);
        vo.setFinishedAt(LocalDateTime.now());
        versionControlMapper.updateDeployResult(vo);
    }

    @Override
    public DeployTraceVO getLatestDeployTrace(String runtimePackageId, String targetEnv) {
        DeployTraceVO params = new DeployTraceVO();
        params.setRuntimePackageId(runtimePackageId);
        params.setTargetEnv(targetEnv);
        return versionControlMapper.selectLatestDeployTrace(params);
    }

    @Override
    public List<DeployTraceVO> getDeployHistory(String projectId, String targetEnv) {
        DeployTraceVO params = new DeployTraceVO();
        params.setTargetEnv(targetEnv);
        params.setProjectId(projectId);
        return versionControlMapper.selectDeployHistory(params);
    }
}
