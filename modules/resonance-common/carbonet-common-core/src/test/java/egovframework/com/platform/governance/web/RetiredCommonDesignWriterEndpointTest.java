package egovframework.com.platform.governance.web;

import egovframework.com.feature.auth.service.CurrentUserContextService;
import egovframework.com.platform.governance.service.ActorProcessGovernanceService;
import egovframework.com.platform.governance.service.DynamicPageRuntimeService;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

class RetiredCommonDesignWriterEndpointTest {

    @Test
    void alternateCommonDesignWritersAreGoneAndNeverReachTheirServices(){
        ActorProcessGovernanceService governance=mock(ActorProcessGovernanceService.class);
        DynamicPageRuntimeService dynamicPages=mock(DynamicPageRuntimeService.class);
        HttpServletRequest request=mock(HttpServletRequest.class);
        var governanceApi=new ActorProcessGovernanceApiController(governance,
            mock(CurrentUserContextService.class),"");
        var dynamicApi=new DynamicPageRuntimeApiController(dynamicPages);

        var preflight=governanceApi.designPreflight(Map.of("pageId","FORBIDDEN"),request);
        var compile=dynamicApi.compile(Map.of("pages",java.util.List.of()),request);

        assertEquals(410,preflight.getStatusCode().value());
        assertEquals(410,compile.getStatusCode().value());
        assertEquals("RETIRED",((Map<?,?>)preflight.getBody()).get("status"));
        assertEquals("RETIRED",((Map<?,?>)compile.getBody()).get("status"));
        verifyNoInteractions(governance,dynamicPages);
    }
}
