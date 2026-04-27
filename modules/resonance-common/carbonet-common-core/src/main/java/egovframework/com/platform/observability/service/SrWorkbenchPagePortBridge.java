package egovframework.com.platform.observability.service;

import egovframework.com.platform.service.observability.SrWorkbenchPagePort;
import egovframework.com.platform.workbench.service.SrTicketWorkbenchService;
import org.springframework.stereotype.Service;

import java.util.Map;

@Service
public class SrWorkbenchPagePortBridge implements SrWorkbenchPagePort {

    private final SrTicketWorkbenchService delegate;

    public SrWorkbenchPagePortBridge(SrTicketWorkbenchService delegate) {
        this.delegate = delegate;
    }

    @Override
    public Map<String, Object> getPage(String searchKeyword) {
        try {
            return loadPage(searchKeyword);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to load SR workbench page payload.", e);
        }
    }

    private Map<String, Object> loadPage(String searchKeyword) throws Exception {
        return delegate.getPage(searchKeyword);
    }
}
