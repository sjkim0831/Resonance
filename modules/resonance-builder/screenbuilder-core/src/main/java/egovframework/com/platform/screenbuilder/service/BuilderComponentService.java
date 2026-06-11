package egovframework.com.platform.screenbuilder.service;

import egovframework.com.platform.screenbuilder.model.BuilderComponentVO;
import java.util.List;

public interface BuilderComponentService {

    BuilderComponentVO createComponent(BuilderComponentVO component);

    BuilderComponentVO updateComponent(String componentId, BuilderComponentVO component);

    BuilderComponentVO getComponent(String componentId);

    List<BuilderComponentVO> getAllComponents();

    List<BuilderComponentVO> getComponentsByType(String componentType);

    List<BuilderComponentVO> getComponentsByCategory(String categoryCd);

    List<BuilderComponentVO> getActiveComponents();

    void deleteComponent(String componentId);

    int getComponentCount();
}