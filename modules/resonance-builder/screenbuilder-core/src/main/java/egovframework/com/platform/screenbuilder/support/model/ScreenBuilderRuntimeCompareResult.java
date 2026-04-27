package egovframework.com.platform.screenbuilder.support.model;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ScreenBuilderRuntimeCompareResult {

    private String traceId;
    private int mismatchCount;
    private int gapCount;
}
