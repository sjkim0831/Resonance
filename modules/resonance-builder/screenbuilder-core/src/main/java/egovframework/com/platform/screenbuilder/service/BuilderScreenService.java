package egovframework.com.platform.screenbuilder.service;

import egovframework.com.platform.screenbuilder.model.ScreenBuilderNodeVO;
import egovframework.com.platform.screenbuilder.model.ScreenConfigVO;
import java.util.List;

public interface BuilderScreenService {

    ScreenConfigVO createScreen(ScreenConfigVO config);

    ScreenConfigVO updateScreen(String screenId, ScreenConfigVO config);

    ScreenConfigVO getScreen(String screenId);

    ScreenConfigVO getScreenByMenuCode(String menuCode);

    List<ScreenConfigVO> getAllScreens();

    List<ScreenConfigVO> getScreensByStatus(String status);

    void deleteScreen(String screenId);

    ScreenConfigVO publishScreen(String screenId);

    ScreenConfigVO duplicateScreen(String sourceScreenId, String newMenuCode, String newMenuTitle);

    ScreenBuilderNodeVO addNodeToScreen(String screenId, ScreenBuilderNodeVO node);

    ScreenBuilderNodeVO updateNode(String screenId, String nodeId, ScreenBuilderNodeVO node);

    void removeNode(String screenId, String nodeId);

    List<ScreenBuilderNodeVO> getNodes(String screenId);

    String getPreviewHtml(String screenId);
}