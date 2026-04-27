package egovframework.com.platform.screenbuilder.support.impl;

import egovframework.com.platform.screenbuilder.support.CarbonetScreenBuilderMenuSource;
import egovframework.com.platform.screenbuilder.support.model.CarbonetScreenBuilderMenuItem;
import egovframework.com.platform.screenbuilder.support.ScreenBuilderMenuBindingPolicyPort;
import egovframework.com.platform.screenbuilder.support.ScreenBuilderMenuCatalogPort;
import egovframework.com.platform.screenbuilder.support.ScreenBuilderRuntimeComparePolicyPort;
import egovframework.com.platform.screenbuilder.support.model.ScreenBuilderMenuDescriptor;
import lombok.RequiredArgsConstructor;

import java.util.ArrayList;
import java.util.List;

@RequiredArgsConstructor
public class CarbonetScreenBuilderMenuCatalogAdapter implements ScreenBuilderMenuCatalogPort {

    private final CarbonetScreenBuilderMenuSource carbonetScreenBuilderMenuSource;
    private final ScreenBuilderMenuBindingPolicyPort screenBuilderMenuBindingPolicyPort;
    private final ScreenBuilderRuntimeComparePolicyPort screenBuilderRuntimeComparePolicyPort;

    @Override
    public List<ScreenBuilderMenuDescriptor> selectMenuTreeList(String codeId) throws Exception {
        List<ScreenBuilderMenuDescriptor> rows = new ArrayList<>();
        for (CarbonetScreenBuilderMenuItem row : carbonetScreenBuilderMenuSource.selectMenuTreeList(codeId)) {
            rows.add(toDescriptor(row));
        }
        return rows;
    }

    private ScreenBuilderMenuDescriptor toDescriptor(CarbonetScreenBuilderMenuItem row) {
        ScreenBuilderMenuDescriptor descriptor = new ScreenBuilderMenuDescriptor();
        descriptor.setMenuCode(ScreenBuilderAdapterSupport.safe(row == null ? null : row.getMenuCode()));
        descriptor.setCode(ScreenBuilderAdapterSupport.safe(row == null ? null : row.getCode()));
        descriptor.setMenuTitle(ScreenBuilderAdapterSupport.safe(row == null ? null : row.getMenuTitle()));
        descriptor.setMenuUrl(ScreenBuilderAdapterSupport.safe(row == null ? null : row.getMenuUrl()));
        descriptor.setMenuScope(screenBuilderMenuBindingPolicyPort.resolveMenuScope());
        descriptor.setProjectId(screenBuilderRuntimeComparePolicyPort.resolveProjectId());
        descriptor.setRuntimeClass(screenBuilderMenuBindingPolicyPort.resolveRuntimeClass());
        return descriptor;
    }
}
