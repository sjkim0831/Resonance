package egovframework.com.platform.runtimecontrol.service;

import egovframework.com.platform.runtimecontrol.model.ModuleBindingPreviewRequest;
import egovframework.com.platform.runtimecontrol.model.ModuleBindingResultRequest;
import egovframework.com.platform.runtimecontrol.model.ParityCompareRequest;
import egovframework.com.platform.runtimecontrol.model.ProjectPipelineRunRequest;
import egovframework.com.platform.runtimecontrol.model.ProjectPipelineStatusRequest;
import egovframework.com.platform.runtimecontrol.model.RepairApplyRequest;
import egovframework.com.platform.runtimecontrol.model.RepairOpenRequest;
import egovframework.com.platform.runtimecontrol.model.VerificationRunRequest;

import java.util.Map;

public interface RuntimeControlPlaneService {

    Map<String, Object> getParityCompare(ParityCompareRequest request) throws Exception;

    Map<String, Object> openRepairSession(RepairOpenRequest request) throws Exception;

    Map<String, Object> applyRepair(RepairApplyRequest request) throws Exception;

    Map<String, Object> runProjectPipeline(ProjectPipelineRunRequest request) throws Exception;

    Map<String, Object> getProjectPipelineStatus(ProjectPipelineStatusRequest request) throws Exception;

    Map<String, Object> saveVerificationRun(VerificationRunRequest request) throws Exception;

    Map<String, Object> saveModuleBindingPreview(ModuleBindingPreviewRequest request) throws Exception;

    Map<String, Object> saveModuleBindingResult(ModuleBindingResultRequest request) throws Exception;
}
