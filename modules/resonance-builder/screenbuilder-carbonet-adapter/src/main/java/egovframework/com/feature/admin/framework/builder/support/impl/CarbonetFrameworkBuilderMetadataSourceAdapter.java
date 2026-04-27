package egovframework.com.feature.admin.framework.builder.support.impl;

import egovframework.com.feature.admin.framework.builder.support.CarbonetFrameworkBuilderMetadataSource;
import egovframework.com.framework.contract.model.FrameworkContractMetadataVO;
import egovframework.com.framework.contract.service.FrameworkContractMetadataService;

public class CarbonetFrameworkBuilderMetadataSourceAdapter implements CarbonetFrameworkBuilderMetadataSource {

    private final FrameworkContractMetadataService frameworkContractMetadataService;

    public CarbonetFrameworkBuilderMetadataSourceAdapter(FrameworkContractMetadataService frameworkContractMetadataService) {
        this.frameworkContractMetadataService = frameworkContractMetadataService;
    }

    @Override
    public FrameworkContractMetadataVO getMetadata() throws Exception {
        return frameworkContractMetadataService.getMetadata();
    }
}
