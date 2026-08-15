package egovframework.com.platform.governance.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.platform.governance.service.ActorProcessGovernanceService;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ActorProcessControlPlaneBridgeAuthorizationTest {
    private final ActorProcessGovernanceService governance=mock(ActorProcessGovernanceService.class);
    private final ActorProcessControlPlaneBridgeController controller=
        new ActorProcessControlPlaneBridgeController(mock(JdbcTemplate.class),new ObjectMapper(),governance,"secret-token");
    private final Map<String,Object> command=Map.of(
        "command","screen.design.generate","routePath","/design/route");

    @AfterEach void close(){controller.shutdownGenerationExecutor();}

    @Test
    void invalidBridgeTokenReturns401WithoutMutation(){
        var response=controller.executeGovernanceCommand("wrong-token","BACKSTAGE","system-admin",command);

        assertEquals(401,response.getStatusCode().value());
        verify(governance,never()).saveDesignAndGenerate(any(),anyString());
    }

    @Test
    void authenticatedNonAdministratorReturns403WithoutMutation(){
        when(governance.isControlPlaneAdministrator("designer")).thenReturn(false);

        var response=controller.executeGovernanceCommand("secret-token","BACKSTAGE","designer",command);

        assertEquals(403,response.getStatusCode().value());
        verify(governance,never()).saveDesignAndGenerate(any(),anyString());
    }

    @Test
    void authenticatedAdministratorCanRunExactDesignMutation(){
        when(governance.isControlPlaneAdministrator("system-admin")).thenReturn(true);
        when(governance.saveDesignAndGenerate(any(),eq("system-admin")))
            .thenReturn(Map.of("success",true,"buildRequired",false));

        var response=controller.executeGovernanceCommand(
            "secret-token","BACKSTAGE","system-admin",command);

        assertEquals(200,response.getStatusCode().value());
        verify(governance).saveDesignAndGenerate(
            org.mockito.ArgumentMatchers.argThat(body->
                "screen.design.generate".equals(body.get("command"))
                    &&"system-admin".equals(body.get("requestingAccount"))),
            eq("system-admin"));
    }

    private static <T> T eq(T value){return org.mockito.ArgumentMatchers.eq(value);}
}
