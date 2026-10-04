package egovframework.com.platform.governance.service;

import org.junit.jupiter.api.Test;
import java.nio.file.Files;
import java.nio.file.Path;
import static org.junit.jupiter.api.Assertions.*;

class ProcessDefinitionRevisionFoundationContractTest {
  private static final Path ROOT=Path.of("src/main/java/egovframework/com/platform/governance");
  private static final String SERVICE=read(ROOT.resolve("service/ActorProcessGovernanceService.java"));
  private static final String CONTROLLER=read(ROOT.resolve("web/ActorProcessGovernanceApiController.java"));
  private static final String MIGRATION=read(Path.of("/opt/Resonance/runtime/platform-data/dev-worktrees/certificate-verification/apps/carbonet-api/src/main/resources/db/migration/postgresql/V20260918120000__add_process_step_revision_audit.sql"));
  private static String read(Path p){try{return Files.readString(p);}catch(Exception e){throw new AssertionError(e);}}
  @Test void normalContractUpdatePath(){assertAll(()->assertTrue(CONTROLLER.contains("@PutMapping(\"/processes/{processCode}/steps/{stepCode}\")")),()->assertTrue(SERVICE.contains("updateStepContract")));}
  @Test void adminGuard(){assertTrue(CONTROLLER.contains("guardedDesignMutation"));}
  @Test void revisionReasonRequired(){assertTrue(SERVICE.contains("revisionReason"));}
  @Test void processMissingGuard(){assertTrue(SERVICE.contains("PROCESS_NOT_FOUND"));}
  @Test void stepMissingGuard(){assertTrue(SERVICE.contains("STEP_NOT_FOUND"));}
  @Test void staleGuard(){assertTrue(SERVICE.contains("STALE_PROCESS_VERSION")&&SERVICE.contains("STALE_PROCESS_STRUCTURE_HASH"));}
  @Test void beforeSnapshot(){assertTrue(SERVICE.contains("String before=snapshotProcessDefinition"));}
  @Test void afterSnapshot(){assertTrue(SERVICE.contains("String after=snapshotProcessDefinition"));}
  @Test void leaseWrapped(){assertTrue(SERVICE.contains("beginProcessDesignRevision(process,actor)"));}
  @Test void transactionRollback(){assertTrue(SERVICE.contains("@Transactional")&&SERVICE.contains("finalizeProcessDesignRevision"));}
  @Test void versionIncrementDelegated(){assertTrue(SERVICE.contains("framework_finalize_process_design_revision"));}
  @Test void allowedFieldsOnly(){assertTrue(SERVICE.contains("UNSUPPORTED_STEP_CONTRACT_FIELD"));}
  @Test void targetOnly(){assertTrue(SERVICE.contains("where process_code=? and step_code=?"));}
  @Test void processSpecificHardcodeAbsent(){assertFalse(SERVICE.contains("ACCOUNT_LOCK_RECOVERY"));}
  @Test void auditSnapshotSchema(){assertTrue(MIGRATION.contains("before_snapshot JSONB")&&MIGRATION.contains("after_snapshot JSONB")&&MIGRATION.contains("revision_reason"));}
}
