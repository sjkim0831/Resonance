package egovframework.com.framework.builder.support;

import egovframework.com.framework.contract.model.FrameworkContractMetadataVO;

public interface FrameworkBuilderMetadataPort {

    FrameworkContractMetadataVO getMetadata() throws Exception;
}
