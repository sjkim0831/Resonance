package egovframework.com.platform.screenbuilder.support;

import egovframework.com.platform.screenbuilder.support.model.ScreenBuilderRuntimeCompareRequest;

import java.util.Map;

public interface CarbonetScreenBuilderRuntimeCompareSource {

    Map<String, Object> compare(ScreenBuilderRuntimeCompareRequest request) throws Exception;
}
