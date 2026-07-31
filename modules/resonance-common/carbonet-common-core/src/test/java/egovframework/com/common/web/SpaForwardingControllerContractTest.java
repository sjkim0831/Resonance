package egovframework.com.common.web;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.RequestMapping;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertTrue;

class SpaForwardingControllerContractTest {

    @Test
    void forwardsDatabasePlannedScreensToTheSharedReactRuntime() throws Exception {
        RequestMapping mapping = SpaForwardingController.class
                .getMethod("forward", HttpServletRequest.class, Model.class)
                .getAnnotation(RequestMapping.class);
        List<String> paths = List.of(mapping.value());

        assertTrue(paths.contains("/planned/**"));
        assertTrue(paths.contains("/en/planned/**"));
    }
}
