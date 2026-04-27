package egovframework.com.platform.versioncontrol.mapper;

import egovframework.com.platform.versioncontrol.model.vo.DeployTraceVO;
import egovframework.com.platform.versioncontrol.model.vo.ReleaseUnitVO;
import egovframework.com.platform.versioncontrol.model.vo.RuntimePackageVO;
import org.springframework.stereotype.Component;
import egovframework.com.common.mapper.support.BaseMapperSupport;

import java.util.List;

@Component("versionControlMapper")
public class VersionControlMapper extends BaseMapperSupport {

    // Release Unit
    public void insertReleaseUnit(ReleaseUnitVO vo) {
        insert("VersionControlMapper.insertReleaseUnit", vo);
    }

    public ReleaseUnitVO selectReleaseUnit(String releaseUnitId) {
        return selectOne("VersionControlMapper.selectReleaseUnit", releaseUnitId);
    }

    public List<ReleaseUnitVO> selectReleaseUnitsByProject(String projectId) {
        return selectList("VersionControlMapper.selectReleaseUnitsByProject", projectId);
    }

    public void updateReleaseStatus(ReleaseUnitVO vo) {
        update("VersionControlMapper.updateReleaseStatus", vo);
    }

    // Runtime Package
    public void insertRuntimePackage(RuntimePackageVO vo) {
        insert("VersionControlMapper.insertRuntimePackage", vo);
    }

    public RuntimePackageVO selectRuntimePackage(String runtimePackageId) {
        return selectOne("VersionControlMapper.selectRuntimePackage", runtimePackageId);
    }

    public List<RuntimePackageVO> selectPackagesByReleaseUnit(String releaseUnitId) {
        return selectList("VersionControlMapper.selectPackagesByReleaseUnit", releaseUnitId);
    }

    // Deploy Trace
    public void insertDeployTrace(DeployTraceVO vo) {
        insert("VersionControlMapper.insertDeployTrace", vo);
    }

    public void updateDeployResult(DeployTraceVO vo) {
        update("VersionControlMapper.updateDeployResult", vo);
    }

    public DeployTraceVO selectLatestDeployTrace(DeployTraceVO params) {
        return selectOne("VersionControlMapper.selectLatestDeployTrace", params);
    }

    public List<DeployTraceVO> selectDeployHistory(DeployTraceVO params) {
        return selectList("VersionControlMapper.selectDeployHistory", params);
    }
}
