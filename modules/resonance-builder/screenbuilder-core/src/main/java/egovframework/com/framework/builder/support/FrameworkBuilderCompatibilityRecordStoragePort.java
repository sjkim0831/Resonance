package egovframework.com.framework.builder.support;

import java.util.Map;

public interface FrameworkBuilderCompatibilityRecordStoragePort {

    void appendRecord(Map<String, Object> payload) throws Exception;

    Map<String, Object> findLastRecord(String key, String value) throws Exception;
}
