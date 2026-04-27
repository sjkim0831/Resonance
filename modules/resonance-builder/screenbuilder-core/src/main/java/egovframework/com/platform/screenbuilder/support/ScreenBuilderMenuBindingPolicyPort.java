package egovframework.com.platform.screenbuilder.support;

import egovframework.com.platform.screenbuilder.support.model.ScreenBuilderMenuDescriptor;

import java.util.List;

public interface ScreenBuilderMenuBindingPolicyPort {

    List<String> getMenuCatalogRoots() throws Exception;

    String resolveMenuScope();

    String resolveRuntimeClass();

    String derivePageId(String menuCode, ScreenBuilderMenuDescriptor menu);
}
