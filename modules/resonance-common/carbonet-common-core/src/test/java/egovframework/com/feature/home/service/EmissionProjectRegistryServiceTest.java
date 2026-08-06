package egovframework.com.feature.home.service;

import egovframework.com.platform.governance.service.ActorProcessGovernanceService;
import org.junit.jupiter.api.Test;

import javax.sql.DataSource;
import java.util.LinkedHashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

class EmissionProjectRegistryServiceTest {

    @Test
    void enrichCompletionReadinessUsesProjectedTaskCodeWithoutReloadingDeletedTask() {
        DataSource dataSource = mock(DataSource.class);
        ActorProcessGovernanceService governanceService = mock(ActorProcessGovernanceService.class);
        EmissionProjectRegistryService service = new EmissionProjectRegistryService(dataSource, governanceService);
        Map<String, Object> projectedTask = new LinkedHashMap<>();
        projectedTask.put("id", 987654321L);
        projectedTask.put("projectId", "PRJ-ALREADY-CLEANED");
        projectedTask.put("taskCode", "EXTENSION_STEP");
        projectedTask.put("pendingPredecessors", "");
        projectedTask.put("actionable", true);

        assertDoesNotThrow(() -> service.enrichCompletionReadiness(projectedTask));

        assertEquals("EXTENSION_STEP", projectedTask.get("taskCode"));
        assertFalse((Boolean) projectedTask.get("completionSatisfied"));
        assertNotNull(projectedTask.get("completionEvidence"));
        assertTrue((Boolean) projectedTask.get("actionable"));
        verifyNoInteractions(dataSource);
    }
}
