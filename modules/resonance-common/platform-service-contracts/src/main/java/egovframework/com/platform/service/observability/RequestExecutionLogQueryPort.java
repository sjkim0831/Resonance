package egovframework.com.platform.service.observability;

import egovframework.com.common.logging.RequestExecutionLogPage;
import egovframework.com.common.logging.RequestExecutionLogVO;

import java.util.function.Predicate;

public interface RequestExecutionLogQueryPort {

    RequestExecutionLogPage searchRecent(Predicate<RequestExecutionLogVO> predicate, int page, int size);
}
