package egovframework.com.platform.screenbuilder.support.impl;

import egovframework.com.platform.screenbuilder.support.CarbonetScreenBuilderAuthoritySource;
import egovframework.com.framework.authority.model.FrameworkAuthorityRoleContractVO;
import egovframework.com.platform.screenbuilder.support.ScreenBuilderAuthorityContractPort;
import java.util.List;

public class CarbonetScreenBuilderAuthorityContractAdapter implements ScreenBuilderAuthorityContractPort {

    private final CarbonetScreenBuilderAuthoritySource carbonetScreenBuilderAuthoritySource;

    public CarbonetScreenBuilderAuthorityContractAdapter(CarbonetScreenBuilderAuthoritySource carbonetScreenBuilderAuthoritySource) {
        this.carbonetScreenBuilderAuthoritySource = carbonetScreenBuilderAuthoritySource;
    }

    @Override
    public List<FrameworkAuthorityRoleContractVO> getAuthorityRoles() throws Exception {
        return ScreenBuilderAdapterSupport.emptyIfNull(carbonetScreenBuilderAuthoritySource.getAuthorityRoles());
    }
}
