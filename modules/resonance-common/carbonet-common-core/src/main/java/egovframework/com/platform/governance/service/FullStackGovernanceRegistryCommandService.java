package egovframework.com.platform.governance.service;

import egovframework.com.platform.governance.dto.FullStackGovernanceAutoCollectRequest;
import egovframework.com.platform.governance.dto.FullStackGovernanceSaveRequest;

import java.util.Map;

public interface FullStackGovernanceRegistryCommandService {

    Map<String, Object> saveEntry(FullStackGovernanceSaveRequest request);

    Map<String, Object> autoCollectEntry(FullStackGovernanceAutoCollectRequest request) throws Exception;
}
