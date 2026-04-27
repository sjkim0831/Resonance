package egovframework.com.common.mapper;

import egovframework.com.common.mapper.support.BaseMapperSupport;
import egovframework.com.common.trace.UiComponentRegistryVO;
import egovframework.com.common.trace.UiComponentUsageVO;
import egovframework.com.common.trace.UiPageComponentDetailVO;
import egovframework.com.common.trace.UiPageManifestVO;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component("uiObservabilityRegistryMapper")
public class UiObservabilityRegistryMapper extends BaseMapperSupport {

    public int countUiPageManifest(String pageId) {
        Integer count = selectOne("UiObservabilityRegistryMapper.countUiPageManifest", pageId);
        return count == null ? 0 : count;
    }

    public UiPageManifestVO selectUiPageManifest(String pageId) {
        return selectOne("UiObservabilityRegistryMapper.selectUiPageManifest", pageId);
    }

    public List<UiPageManifestVO> selectUiPageManifestList() {
        return selectList("UiObservabilityRegistryMapper.selectUiPageManifestList");
    }

    public void insertUiPageManifest(UiPageManifestVO manifest) {
        insert("UiObservabilityRegistryMapper.insertUiPageManifest", manifest);
    }

    public void updateUiPageManifest(UiPageManifestVO manifest) {
        update("UiObservabilityRegistryMapper.updateUiPageManifest", manifest);
    }

    public int countUiComponentRegistry(String componentId) {
        Integer count = selectOne("UiObservabilityRegistryMapper.countUiComponentRegistry", componentId);
        return count == null ? 0 : count;
    }

    public void insertUiComponentRegistry(UiComponentRegistryVO component) {
        insert("UiObservabilityRegistryMapper.insertUiComponentRegistry", component);
    }

    public void updateUiComponentRegistry(UiComponentRegistryVO component) {
        update("UiObservabilityRegistryMapper.updateUiComponentRegistry", component);
    }

    public List<UiComponentRegistryVO> selectUiComponentRegistryList() {
        return selectList("UiObservabilityRegistryMapper.selectUiComponentRegistryList");
    }

    public void deleteUiComponentRegistry(String componentId) {
        delete("UiObservabilityRegistryMapper.deleteUiComponentRegistry", componentId);
    }

    public List<UiComponentUsageVO> selectUiComponentUsageList(String componentId) {
        return selectList("UiObservabilityRegistryMapper.selectUiComponentUsageList", componentId);
    }

    public void updateUiPageComponentMapComponentId(Map<String, String> payload) {
        update("UiObservabilityRegistryMapper.updateUiPageComponentMapComponentId", payload);
    }

    public void deleteUiPageComponentMaps(String pageId) {
        delete("UiObservabilityRegistryMapper.deleteUiPageComponentMaps", pageId);
    }

    public void insertUiPageComponentMap(Map<String, Object> payload) {
        insert("UiObservabilityRegistryMapper.insertUiPageComponentMap", payload);
    }

    public List<UiPageComponentDetailVO> selectUiPageComponentDetails(String pageId) {
        return selectList("UiObservabilityRegistryMapper.selectUiPageComponentDetails", pageId);
    }
}
