package com.example.project.screenbuilder.support.impl;

import egovframework.com.framework.authority.model.FrameworkAuthorityRoleContractVO;
import egovframework.com.platform.screenbuilder.support.ScreenBuilderAuthorityContractPort;

import java.util.Collections;
import java.util.List;

public class ProjectScreenBuilderAuthorityContractAdapter implements ScreenBuilderAuthorityContractPort {

    @Override
    public List<FrameworkAuthorityRoleContractVO> getAuthorityRoles() {
        return Collections.emptyList();
    }
}
