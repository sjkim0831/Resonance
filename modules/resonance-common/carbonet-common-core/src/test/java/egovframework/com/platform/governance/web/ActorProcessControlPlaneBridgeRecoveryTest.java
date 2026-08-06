package egovframework.com.platform.governance.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.platform.governance.service.ActorProcessGovernanceService;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.mockito.ArgumentMatchers.contains;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoMoreInteractions;
import static org.mockito.Mockito.when;

class ActorProcessControlPlaneBridgeRecoveryTest {
    @Test
    void onlyOneRuntimePodRunsRequirementDesignSelfHealing() {
        JdbcTemplate jdbc = mock(JdbcTemplate.class);
        when(jdbc.queryForObject(contains("pg_try_advisory_xact_lock"),
                org.mockito.ArgumentMatchers.eq(Boolean.class))).thenReturn(false);
        var controller = new ActorProcessControlPlaneBridgeController(
                jdbc,
                new ObjectMapper(),
                mock(ActorProcessGovernanceService.class),
                "");

        controller.recoverQueuedDesignGeneration();

        verify(jdbc).queryForObject(contains("pg_try_advisory_xact_lock"),
                org.mockito.ArgumentMatchers.eq(Boolean.class));
        verifyNoMoreInteractions(jdbc);
        controller.shutdownGenerationExecutor();
    }
}
