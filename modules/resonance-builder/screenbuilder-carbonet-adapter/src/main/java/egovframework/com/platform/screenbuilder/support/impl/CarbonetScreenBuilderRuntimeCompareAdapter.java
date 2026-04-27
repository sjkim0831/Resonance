package egovframework.com.platform.screenbuilder.support.impl;

import egovframework.com.platform.screenbuilder.support.CarbonetScreenBuilderRuntimeCompareSource;
import egovframework.com.platform.screenbuilder.support.ScreenBuilderRuntimeComparePort;
import egovframework.com.platform.screenbuilder.support.model.ScreenBuilderRuntimeCompareRequest;
import egovframework.com.platform.screenbuilder.support.model.ScreenBuilderRuntimeCompareResult;
import lombok.RequiredArgsConstructor;

import java.util.Collections;
import java.util.List;
import java.util.Map;

@RequiredArgsConstructor
public class CarbonetScreenBuilderRuntimeCompareAdapter implements ScreenBuilderRuntimeComparePort {

    private final CarbonetScreenBuilderRuntimeCompareSource carbonetScreenBuilderRuntimeCompareSource;

    @Override
    public ScreenBuilderRuntimeCompareResult compare(ScreenBuilderRuntimeCompareRequest request) throws Exception {
        Map<String, Object> response = carbonetScreenBuilderRuntimeCompareSource.compare(request);
        int mismatchCount = 0;
        int gapCount = 0;
        List<Map<String, Object>> compareTargetSet = castObjectList(response == null ? null : response.get("compareTargetSet"));
        for (Map<String, Object> row : compareTargetSet) {
            String compareResult = ScreenBuilderAdapterSupport.safeString(row == null ? null : row.get("result"));
            if ("GAP".equalsIgnoreCase(compareResult)) {
                gapCount++;
            } else if ("MISMATCH".equalsIgnoreCase(compareResult)) {
                mismatchCount++;
            }
        }
        ScreenBuilderRuntimeCompareResult result = new ScreenBuilderRuntimeCompareResult();
        result.setTraceId(response == null ? "" : ScreenBuilderAdapterSupport.safeString(response.get("traceId")));
        result.setMismatchCount(mismatchCount);
        result.setGapCount(gapCount);
        return result;
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> castObjectList(Object value) {
        return value instanceof List ? (List<Map<String, Object>>) value : Collections.emptyList();
    }
}
