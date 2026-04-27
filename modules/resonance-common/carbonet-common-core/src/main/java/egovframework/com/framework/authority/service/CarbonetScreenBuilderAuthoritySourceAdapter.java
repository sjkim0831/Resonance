package egovframework.com.framework.authority.service;

import egovframework.com.platform.screenbuilder.support.CarbonetScreenBuilderAuthoritySource;
import egovframework.com.framework.authority.model.FrameworkAuthorityRoleContractVO;

import java.util.Collections;
import java.util.List;

/**
 * Framework-owned authority source adapter consumed by the screenbuilder
 * project adapter module.
 */
public class CarbonetScreenBuilderAuthoritySourceAdapter implements CarbonetScreenBuilderAuthoritySource {

    private final FrameworkAuthorityContractService frameworkAuthorityContractService;

    public CarbonetScreenBuilderAuthoritySourceAdapter(FrameworkAuthorityContractService frameworkAuthorityContractService) {
        this.frameworkAuthorityContractService = frameworkAuthorityContractService;
    }

    @Override
    public List<FrameworkAuthorityRoleContractVO> getAuthorityRoles() throws Exception {
        if (frameworkAuthorityContractService.getAuthorityContract() == null
                || frameworkAuthorityContractService.getAuthorityContract().getAuthorityRoles() == null) {
            return Collections.emptyList();
        }
        return frameworkAuthorityContractService.getAuthorityContract().getAuthorityRoles();
    }
}
