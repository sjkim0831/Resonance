package egovframework.com.common.logging;

import java.util.List;
import java.util.function.Predicate;

public interface RequestExecutionLogService {

    void append(RequestExecutionLogVO item);

    List<RequestExecutionLogVO> readRecent(int limit);

    RequestExecutionLogPage searchRecent(Predicate<RequestExecutionLogVO> filter, int pageIndex, int pageSize);
}
