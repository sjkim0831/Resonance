package egovframework.com.feature.admin.framework.builder.support.impl;

import egovframework.com.feature.admin.framework.builder.support.CarbonetFrameworkBuilderMetadataSource;
import egovframework.com.framework.builder.support.FrameworkBuilderMetadataPort;
import egovframework.com.framework.contract.model.FrameworkContractMetadataVO;
import lombok.RequiredArgsConstructor;

@RequiredArgsConstructor
public class CarbonetFrameworkBuilderMetadataAdapter implements FrameworkBuilderMetadataPort {

    private final CarbonetFrameworkBuilderMetadataSource carbonetFrameworkBuilderMetadataSource;

    @Override
    public FrameworkContractMetadataVO getMetadata() throws Exception {
        return carbonetFrameworkBuilderMetadataSource.getMetadata();
    }
}
