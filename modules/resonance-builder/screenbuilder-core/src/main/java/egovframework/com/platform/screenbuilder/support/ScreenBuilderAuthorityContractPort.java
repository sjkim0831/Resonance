package egovframework.com.platform.screenbuilder.support;

import egovframework.com.framework.authority.model.FrameworkAuthorityRoleContractVO;

import java.util.List;

public interface ScreenBuilderAuthorityContractPort {

    List<FrameworkAuthorityRoleContractVO> getAuthorityRoles() throws Exception;
}
