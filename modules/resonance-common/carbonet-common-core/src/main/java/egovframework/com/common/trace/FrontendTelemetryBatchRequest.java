package egovframework.com.common.trace;

import lombok.Getter;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class FrontendTelemetryBatchRequest {

    private List<FrontendTelemetryEvent> events = new ArrayList<>();
}
