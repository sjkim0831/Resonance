package egovframework.com.platform.screenbuilder.service.impl;

import egovframework.com.platform.screenbuilder.model.BuilderComponentVO;
import egovframework.com.platform.screenbuilder.repository.ComponentRepository;
import egovframework.com.platform.screenbuilder.service.BuilderComponentService;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class BuilderComponentServiceImpl implements BuilderComponentService {

    private final ComponentRepository componentRepository;

    public BuilderComponentServiceImpl(ComponentRepository componentRepository) {
        this.componentRepository = componentRepository;
    }

    @Override
    public BuilderComponentVO createComponent(BuilderComponentVO component) {
        if (component.getComponentId() == null || component.getComponentId().isEmpty()) {
            component.setComponentId("CMPT" + System.currentTimeMillis());
        }
        if (component.getSortOrder() == null) {
            component.setSortOrder(componentRepository.count() + 1);
        }
        if (component.getUseAt() == null) {
            component.setUseAt("Y");
        }
        return componentRepository.save(component);
    }

    @Override
    public BuilderComponentVO updateComponent(String componentId, BuilderComponentVO component) {
        BuilderComponentVO existing = componentRepository.findById(componentId)
                .orElseThrow(() -> new IllegalArgumentException("Component not found: " + componentId));
        component.setComponentId(componentId);
        return componentRepository.save(component);
    }

    @Override
    public BuilderComponentVO getComponent(String componentId) {
        return componentRepository.findById(componentId)
                .orElseThrow(() -> new IllegalArgumentException("Component not found: " + componentId));
    }

    @Override
    public List<BuilderComponentVO> getAllComponents() {
        return componentRepository.findAll();
    }

    @Override
    public List<BuilderComponentVO> getComponentsByType(String componentType) {
        return componentRepository.findByComponentType(componentType);
    }

    @Override
    public List<BuilderComponentVO> getComponentsByCategory(String categoryCd) {
        return componentRepository.findByCategoryCd(categoryCd);
    }

    @Override
    public List<BuilderComponentVO> getActiveComponents() {
        return componentRepository.findByUseAt("Y");
    }

    @Override
    public void deleteComponent(String componentId) {
        if (!componentRepository.existsById(componentId)) {
            throw new IllegalArgumentException("Component not found: " + componentId);
        }
        componentRepository.deleteById(componentId);
    }

    @Override
    public int getComponentCount() {
        return componentRepository.count();
    }
}