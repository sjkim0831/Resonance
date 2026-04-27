package egovframework.com.common.trace;

import java.util.List;
import java.util.Map;

public interface UiManifestRegistryPort {

    Map<String, Object> syncPageRegistry(Map<String, Object> page);

    Map<String, Object> ensureManagedPageDraft(String pageId,
                                               String pageName,
                                               String routePath,
                                               String menuCode,
                                               String domainCode);

    List<Map<String, Object>> selectActivePageOptions();

    Map<String, Object> getPageRegistry(String pageId);
}
