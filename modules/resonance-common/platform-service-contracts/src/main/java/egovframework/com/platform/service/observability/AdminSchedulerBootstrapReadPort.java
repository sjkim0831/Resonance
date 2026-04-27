package egovframework.com.platform.service.observability;

import java.util.Map;

public interface AdminSchedulerBootstrapReadPort {

    Map<String, Object> buildSchedulerPageData(String jobStatus, String executionType, boolean isEn);
}
