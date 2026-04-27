package egovframework.com.platform.screenbuilder.support;

import egovframework.com.platform.screenbuilder.support.model.CarbonetScreenBuilderMenuItem;

import java.util.List;

public interface CarbonetScreenBuilderMenuSource {

    List<CarbonetScreenBuilderMenuItem> selectMenuTreeList(String codeId) throws Exception;
}
