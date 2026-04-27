package egovframework.com.platform.observability.service;

import egovframework.com.platform.bootstrap.service.AdminSchedulerBootstrapReadService;
import egovframework.com.platform.service.observability.AdminSchedulerBootstrapReadPort;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class AdminSchedulerBootstrapReadPortBridge implements AdminSchedulerBootstrapReadPort {

    private final AdminSchedulerBootstrapReadService delegate;

    public AdminSchedulerBootstrapReadPortBridge(AdminSchedulerBootstrapReadService delegate) {
        this.delegate = delegate;
    }

    @Override
    public Map<String, Object> buildSchedulerPageData(String jobStatus, String executionType, boolean isEn) {
        return delegate.buildSchedulerPageData(jobStatus, executionType, isEn);
    }
}
