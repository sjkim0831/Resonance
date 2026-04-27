package egovframework.com.platform.runtimecontrol.web;

import egovframework.com.platform.executiongate.support.OperationsConsoleGateSupport;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.io.File;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@ExtendWith(MockitoExtension.class)
class PlatformRuntimeGovernanceApiControllerTest {

    private MockMvc mockMvc;

    @Mock
    private OperationsConsoleGateSupport operationsConsoleGateSupport;

    @InjectMocks
    private PlatformRuntimeGovernanceApiController controller;

    private Path tempManifestFile;

    @BeforeEach
    void setUp() throws Exception {
        tempManifestFile = Files.createTempFile("test-manifest", ".json");
        String jsonContent = "{ \"projects\": { \"P001\": {} } }";
        Files.write(tempManifestFile, jsonContent.getBytes());

        ReflectionTestUtils.setField(controller, "MANIFEST_PATH", tempManifestFile.toAbsolutePath().toString());

        mockMvc = MockMvcBuilders.standaloneSetup(controller).build();
    }

    @Test
    void testListProjects() throws Exception {
        mockMvc.perform(get("/api/operations/governance/runtime/projects"))
               .andExpect(status().isOk());
    }

    @Test
    void testGetProjectDetail() throws Exception {
        mockMvc.perform(get("/api/operations/governance/runtime/projects/P001"))
               .andExpect(status().isOk());
    }

    @Test
    void testGetProjectDetailNotFound() throws Exception {
        mockMvc.perform(get("/api/operations/governance/runtime/projects/INVALID_ID"))
               .andExpect(status().isNotFound());
    }
}
