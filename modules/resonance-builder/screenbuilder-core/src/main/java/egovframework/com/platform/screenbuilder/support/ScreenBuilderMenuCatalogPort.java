package egovframework.com.platform.screenbuilder.support;

import egovframework.com.platform.screenbuilder.support.model.ScreenBuilderMenuDescriptor;

import java.util.List;

public interface ScreenBuilderMenuCatalogPort {

    List<ScreenBuilderMenuDescriptor> selectMenuTreeList(String codeId) throws Exception;
}
