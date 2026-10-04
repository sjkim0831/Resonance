package egovframework.com.platform.governance.service;

import org.junit.jupiter.api.Test;
import org.mockito.InOrder;
import org.springframework.jdbc.core.JdbcTemplate;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class ProcessDefinitionRevisionFoundationServiceTest {
  private final JdbcTemplate jdbc=mock(JdbcTemplate.class);
  private final ScreenDevelopmentNoteService notes=mock(ScreenDevelopmentNoteService.class);
  private final egovframework.com.platform.codex.service.CodexProvisioningService codex=mock(egovframework.com.platform.codex.service.CodexProvisioningService.class);
  private final ScreenContractRuntimeService runtime=mock(ScreenContractRuntimeService.class);

  private ActorProcessGovernanceService service(){return new ActorProcessGovernanceService(jdbc,notes,codex,runtime);}
  private Map<String,Object> body(){return new LinkedHashMap<>(Map.of("inputContract","{}","revisionReason","fixture revision","expectedProcessVersion","1.0.0"));}
  private void successStubs(){
    when(jdbc.queryForMap(anyString(),any(Object[].class))).thenReturn(Map.of("process_version","1.0.0"));
    when(jdbc.queryForObject(contains("framework_process_structure_hash"),eq(String.class),any(Object[].class)))
      .thenReturn("hash-before","hash-after");
    when(jdbc.queryForObject(contains("count(*) from framework_process_step"),eq(Integer.class),any(Object[].class))).thenReturn(1);
    when(jdbc.queryForObject(contains("jsonb_build_object"),eq(String.class),any(Object[].class)))
      .thenReturn("{\"process\":{},\"steps\":[{}],\"executionSpecs\":[{}]}","{\"process\":{},\"steps\":[{\"input_contract\":{}}],\"executionSpecs\":[{}]}");
    when(jdbc.queryForObject(contains("framework_begin_process_design_revision"),eq(String.class),any(Object[].class))).thenReturn("{}");
    when(jdbc.queryForObject(contains("framework_finalize_process_design_revision"),eq(String.class),any(Object[].class))).thenReturn("{}");
    when(jdbc.queryForObject(contains("select process_version from framework_process_definition"),eq(String.class),any(Object[].class))).thenReturn("1.0.1");
    when(jdbc.update(anyString(),any(Object[].class))).thenReturn(1);
  }
  @Test void normalStepContractUpdate(){successStubs();assertTrue(service().updateStepContract("FIXTURE_PROCESS","S1",body(),"admin").containsKey("success"));}
  @Test void unauthorizedActor(){assertThrows(SecurityException.class,()->service().updateStepContract("FIXTURE_PROCESS","S1",body(),""));verifyNoInteractions(jdbc);}
  @Test void nullAndBlankReason(){Map<String,Object> n=body();n.put("revisionReason",null);assertThrows(IllegalArgumentException.class,()->service().updateStepContract("FIXTURE_PROCESS","S1",n,"admin"));Map<String,Object>b=body();b.put("revisionReason"," ");assertThrows(IllegalArgumentException.class,()->service().updateStepContract("FIXTURE_PROCESS","S1",b,"admin"));verifyNoInteractions(jdbc);}
  @Test void processMissing(){when(jdbc.queryForMap(anyString(),any(Object[].class))).thenReturn(Collections.emptyMap());assertThrows(IllegalArgumentException.class,()->service().updateStepContract("MISSING_PROCESS","S1",body(),"admin"));}
  @Test void stepMissing(){when(jdbc.queryForMap(anyString(),any(Object[].class))).thenReturn(Map.of("process_version","1.0.0"));when(jdbc.queryForObject(contains("framework_process_structure_hash"),eq(String.class),any(Object[].class))).thenReturn("hash");when(jdbc.queryForObject(contains("count(*) from framework_process_step"),eq(Integer.class),any(Object[].class))).thenReturn(0);assertThrows(IllegalArgumentException.class,()->service().updateStepContract("FIXTURE_PROCESS","MISSING",body(),"admin"));}
  @Test void staleVersion(){when(jdbc.queryForMap(anyString(),any(Object[].class))).thenReturn(Map.of("process_version","2.0.0"));assertThrows(IllegalStateException.class,()->service().updateStepContract("FIXTURE_PROCESS","S1",body(),"admin"));}
  @Test void staleHash(){Map<String,Object>b=body();b.remove("expectedProcessVersion");b.put("expectedStructureHash","wrong");when(jdbc.queryForMap(anyString(),any(Object[].class))).thenReturn(Map.of("process_version","1.0.0"));when(jdbc.queryForObject(contains("framework_process_structure_hash"),eq(String.class),any(Object[].class))).thenReturn("actual");assertThrows(IllegalStateException.class,()->service().updateStepContract("FIXTURE_PROCESS","S1",b,"admin"));}
  @Test void beforeSnapshotPrecedesUpdate(){successStubs();service().updateStepContract("FIXTURE_PROCESS","S1",body(),"admin");InOrder io=inOrder(jdbc);io.verify(jdbc).queryForObject(contains("jsonb_build_object"),eq(String.class),any(Object[].class));io.verify(jdbc).queryForObject(contains("framework_begin_process_design_revision"),eq(String.class),any(Object[].class));io.verify(jdbc).update(contains("update framework_process_step"),any(Object[].class));}
  @Test void afterSnapshotFollowsFinalize(){successStubs();service().updateStepContract("FIXTURE_PROCESS","S1",body(),"admin");InOrder io=inOrder(jdbc);io.verify(jdbc).queryForObject(contains("jsonb_build_object"),eq(String.class),any(Object[].class));io.verify(jdbc).queryForObject(contains("framework_begin_process_design_revision"),eq(String.class),any(Object[].class));io.verify(jdbc).queryForObject(contains("framework_finalize_process_design_revision"),eq(String.class),any(Object[].class));io.verify(jdbc).queryForObject(contains("jsonb_build_object"),eq(String.class),any(Object[].class));}
  @Test void validationFailureShortCircuitsFinalizeAndAudit(){successStubs();Map<String,Object>b=body();b.put("inputContract","[]");assertThrows(IllegalArgumentException.class,()->service().updateStepContract("FIXTURE_PROCESS","S1",b,"admin"));verify(jdbc,never()).update(contains("framework_process_step_revision_audit"),any(Object[].class));verify(jdbc,never()).queryForObject(contains("framework_finalize_process_design_revision"),eq(String.class),any(Object[].class));}
  @Test void unsupportedFieldRejected(){Map<String,Object>b=body();b.put("processStatus","ACTIVE");assertThrows(IllegalArgumentException.class,()->service().updateStepContract("FIXTURE_PROCESS","S1",b,"admin"));verifyNoInteractions(jdbc);}
  @Test void otherStepNotUpdated(){successStubs();service().updateStepContract("FIXTURE_PROCESS","S1",body(),"admin");verify(jdbc,never()).update(contains("step_code=? and step_code=S2"),any(Object[].class));}
  @Test void otherProcessNotUpdated(){successStubs();service().updateStepContract("FIXTURE_PROCESS","S1",body(),"admin");verify(jdbc,never()).update(contains("process_code=SOME_OTHER"),any(Object[].class));}
  @Test void concurrentRevisionConflict(){when(jdbc.queryForMap(anyString(),any(Object[].class))).thenReturn(Map.of("process_version","2.0.0"));assertThrows(IllegalStateException.class,()->service().updateStepContract("FIXTURE_PROCESS","S1",body(),"admin"));verify(jdbc,never()).queryForObject(contains("framework_begin_process_design_revision"),eq(String.class),any(Object[].class));}
  @Test void auditSavedAfterAfterSnapshot(){successStubs();service().updateStepContract("FIXTURE_PROCESS","S1",body(),"admin");InOrder io=inOrder(jdbc);io.verify(jdbc).queryForObject(contains("jsonb_build_object"),eq(String.class),any(Object[].class));io.verify(jdbc).update(contains("framework_process_step_revision_audit"),any(Object[].class));}
}
