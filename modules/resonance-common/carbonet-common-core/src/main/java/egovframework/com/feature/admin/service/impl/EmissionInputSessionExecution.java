package egovframework.com.feature.admin.service.impl;

import java.util.List;
import java.util.Map;

final class EmissionInputSessionExecution {
    final Map<String, Object> session;
    final List<Map<String, Object>> values;
    final Map<String, Object> result;

    EmissionInputSessionExecution(Map<String, Object> session,
                                  List<Map<String, Object>> values,
                                  Map<String, Object> result) {
        this.session = session;
        this.values = values;
        this.result = result;
    }
}
