package egovframework.com.platform.screenbuilder.support;

import egovframework.com.platform.screenbuilder.support.model.ScreenBuilderRuntimeCompareRequest;
import egovframework.com.platform.screenbuilder.support.model.ScreenBuilderRuntimeCompareResult;

public interface ScreenBuilderRuntimeComparePort {

    ScreenBuilderRuntimeCompareResult compare(ScreenBuilderRuntimeCompareRequest request) throws Exception;
}
