package egovframework.com.platform.workbench.service.impl;

import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.platform.codex.service.ScreenCommandCenterService;
import egovframework.com.platform.codex.service.SrTicketCodexRunnerService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.mock;

class SrTicketWorkbenchServiceImplTest {

    private SrTicketWorkbenchServiceImpl service;

    @AfterEach
    void tearDown() {
        if (service != null) {
            service.shutdownLaneExecutor();
        }
    }

    @Test
    void disabledLocalExecutorDoesNotRequireTmuxOrRepositoryWorkspace() throws Exception {
        service = new SrTicketWorkbenchServiceImpl(
                new ObjectMapper(),
                mock(ScreenCommandCenterService.class),
                mock(SrTicketCodexRunnerService.class));
        setField("codexEnabled", false);
        setField("parallelLaneCount", 2);
        setField("codexRunnerRepoRoot", "/workspace/that/does/not/exist");

        service.initializeLaneExecutor();

        List<Map<String, Object>> lanes = executionLanes();
        assertEquals(2, lanes.size());
        assertEquals("EXTERNAL_EXECUTOR", lanes.get(0).get("transport"));
        assertEquals("", lanes.get(0).get("tmuxSessionName"));
        assertFalse((Boolean) lanes.get(0).get("transportAvailable"));
        assertFalse((Boolean) lanes.get(0).get("tmuxAvailable"));
        assertThrows(IllegalStateException.class,
                () -> service.queueDirectExecuteTicket("SR-1", "ACTOR-1"));
    }

    private void setField(String name, Object value) throws Exception {
        Field field = SrTicketWorkbenchServiceImpl.class.getDeclaredField(name);
        field.setAccessible(true);
        field.set(service, value);
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> executionLanes() throws Exception {
        Method method = SrTicketWorkbenchServiceImpl.class.getDeclaredMethod("buildExecutionLaneRows");
        method.setAccessible(true);
        return (List<Map<String, Object>>) method.invoke(service);
    }
}
