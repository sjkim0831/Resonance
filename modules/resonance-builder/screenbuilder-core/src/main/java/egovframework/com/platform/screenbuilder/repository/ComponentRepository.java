package egovframework.com.platform.screenbuilder.repository;

import egovframework.com.platform.screenbuilder.model.BuilderComponentVO;
import java.util.List;
import java.util.Optional;

public interface ComponentRepository {

    BuilderComponentVO save(BuilderComponentVO component);

    Optional<BuilderComponentVO> findById(String componentId);

    List<BuilderComponentVO> findAll();

    List<BuilderComponentVO> findByComponentType(String componentType);

    List<BuilderComponentVO> findByCategoryCd(String categoryCd);

    List<BuilderComponentVO> findByUseAt(String useAt);

    boolean existsById(String componentId);

    void deleteById(String componentId);

    int count();
}