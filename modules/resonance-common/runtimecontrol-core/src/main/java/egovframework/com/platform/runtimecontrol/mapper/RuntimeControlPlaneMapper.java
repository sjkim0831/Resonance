package egovframework.com.platform.runtimecontrol.mapper;

import egovframework.com.common.mapper.support.BaseMapperSupport;
import org.springframework.stereotype.Component;

import java.util.Map;

@Component("runtimeControlPlaneMapper")
public class RuntimeControlPlaneMapper extends BaseMapperSupport {

    private static final String NAMESPACE = "egovframework.com.platform.runtimecontrol.mapper.RuntimeControlPlaneMapper";

    public void insertParityCompareRun(Map<String, Object> params) {
        insert(NAMESPACE + ".insertParityCompareRun", params);
    }

    public void insertRepairSession(Map<String, Object> params) {
        insert(NAMESPACE + ".insertRepairSession", params);
    }

    public void insertRepairApplyRun(Map<String, Object> params) {
        insert(NAMESPACE + ".insertRepairApplyRun", params);
    }

    public void insertVerificationRun(Map<String, Object> params) {
        insert(NAMESPACE + ".insertVerificationRun", params);
    }

    public void insertModuleBindingPreview(Map<String, Object> params) {
        insert(NAMESPACE + ".insertModuleBindingPreview", params);
    }

    public void insertModuleBindingResult(Map<String, Object> params) {
        insert(NAMESPACE + ".insertModuleBindingResult", params);
    }
}
