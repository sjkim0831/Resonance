package egovframework.com.common.logging;

import java.util.List;
import java.util.function.Predicate;

public interface RequestExecutionLogService {

    void append(RequestExecutionLogVO item);

    List<RequestExecutionLogVO> readRecent(int limit);

    /**
     * Returns only the newest matching rows. Callers that need an exact total
     * count must use {@link #searchRecent(Predicate, int, int)}; file-backed
     * implementations can satisfy this read from the tail without scanning
     * historical lines that cannot enter the result.
     */
    default List<RequestExecutionLogVO> readRecentMatching(
            Predicate<RequestExecutionLogVO> filter,
            int limit) {
        return searchRecent(filter, 1, limit).getItems();
    }

    RequestExecutionLogPage searchRecent(Predicate<RequestExecutionLogVO> filter, int pageIndex, int pageSize);
}
