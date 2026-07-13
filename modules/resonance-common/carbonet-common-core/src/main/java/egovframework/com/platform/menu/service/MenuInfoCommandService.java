package egovframework.com.platform.menu.service;

public interface MenuInfoCommandService {

    void saveMenuOrder(String menuCode, int sortOrdr) throws Exception;

    void saveMenuExposure(String menuCode, String expsrAt) throws Exception;

    void saveMenuActivation(String menuCode, String useAt) throws Exception;

    void saveDependentScreen(String menuCode, String dependentScreenCode) throws Exception;
}
