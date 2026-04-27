package egovframework.com.platform.observability.service;

import egovframework.com.common.logging.RequestExecutionLogPage;
import egovframework.com.common.logging.RequestExecutionLogService;
import egovframework.com.common.logging.RequestExecutionLogVO;
import egovframework.com.platform.service.observability.RequestExecutionLogQueryPort;
import org.springframework.stereotype.Service;

import java.util.function.Predicate;

@Service
public class RequestExecutionLogQueryPortBridge implements RequestExecutionLogQueryPort {

    private final RequestExecutionLogService delegate;

    public RequestExecutionLogQueryPortBridge(RequestExecutionLogService delegate) {
        this.delegate = delegate;
    }

    @Override
    public RequestExecutionLogPage searchRecent(Predicate<RequestExecutionLogVO> predicate, int page, int size) {
        return delegate.searchRecent(predicate, page, size);
    }
}
