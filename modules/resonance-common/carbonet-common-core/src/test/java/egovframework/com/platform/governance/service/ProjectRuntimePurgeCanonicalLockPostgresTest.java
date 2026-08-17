package egovframework.com.platform.governance.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.SQLException;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ProjectRuntimePurgeCanonicalLockPostgresTest {
    private static final String PREREQUISITES=
        "ops/tests/fixtures/project-runtime-purge-composite-prerequisites.sql";
    private static final String PURGE_MIGRATION=
        "apps/carbonet-api/src/main/resources/db/migration/postgresql/"+
        "V20260816134500__install_project_runtime_purge_restore_contract.sql";
    private static final String RECEIPT="31000000-0000-0000-0000-000000000001";
    private static final String OPERATION="41000000-0000-0000-0000-000000000001";
    private static final String BLOCKED_RECEIPT="31000000-0000-0000-0000-000000000002";
    private static final String BLOCKED_OPERATION="41000000-0000-0000-0000-000000000002";
    private static final String PROJECT="RFP-LOCK-001";
    private static final String PROCESS="RFP_LOCK";
    private static final String CONTRACT="a".repeat(64);
    private static final String ACTOR="runtime.composite.admin";

    private final ObjectMapper mapper=new ObjectMapper();
    private JdbcTemplate admin;
    private JdbcTemplate jdbc;
    private String baseUrl;
    private String user;
    private String password;
    private String schema;
    private String auxiliarySchema;

    @BeforeAll
    void installRealPurgeContractInDisposableSchema() throws Exception {
        baseUrl=System.getenv("DIRECT_CODEGEN_PG_URL");
        assumeTrue(baseUrl!=null&&!baseUrl.isBlank(),"DIRECT_CODEGEN_PG_URL is required");
        user=System.getenv().getOrDefault("DIRECT_CODEGEN_PG_USER","postgres");
        password=System.getenv().getOrDefault("DIRECT_CODEGEN_PG_PASSWORD","");
        admin=new JdbcTemplate(new DriverManagerDataSource(baseUrl,user,password));
        schema="project_purge_lock_"+UUID.randomUUID().toString().replace("-","");
        auxiliarySchema=schema+"_aux";
        admin.execute("create schema "+schema);
        admin.execute("create schema "+auxiliarySchema);
        jdbc=new JdbcTemplate(dataSource("purge-lock-fixture"));

        String prerequisites=Files.readString(findRepositoryFile(PREREQUISITES),
            StandardCharsets.UTF_8)
            .replace("\\set ON_ERROR_STOP on","")
            .replace("CREATE ROLE carbonet_app NOLOGIN;","");
        jdbc.execute(prerequisites);
        jdbc.execute(qualifyMigration(Files.readString(findRepositoryFile(PURGE_MIGRATION),
            StandardCharsets.UTF_8)));
        installRuntimePreimage();
        installLiveSnapshotWitness();
    }

    @AfterAll
    void dropDisposableSchema(){
        if(admin!=null&&auxiliarySchema!=null)
            admin.execute("drop schema if exists "+auxiliarySchema+" cascade");
        if(admin!=null&&schema!=null)admin.execute("drop schema if exists "+schema+" cascade");
    }

    @Test
    void purgeAndRestoreFailFastBehindCanonicalPublisherThenRetryWithoutResidue()
            throws Exception {
        FailureState beforePreview=failureState();
        FailureAttempt blockedPreview;
        try(CanonicalLockHolder ignored=holdAdvisory(
                "CANONICAL_PROCESS_PUBLICATION_V1:"+PROCESS,
                "purge-lock-preview-holder",false)){
            blockedPreview=failFastPreview("purge-lock-preview-caller");
            assertEquals(beforePreview,failureState(),
                "failed preview must not create receipt, snapshot, audit, or runtime writes");
            assertAllUserTriggersEnabled();
        }
        assertRetry(blockedPreview,"preview");

        admin.execute("""
            create table __AUX__.stable_runtime_cascade_probe(
              child_id bigint primary key,
              parent_process_code varchar(80) not null references
                __MAIN__.framework_process_definition(process_code) on delete cascade);
            create trigger trg_stable_runtime_probe before insert or update
              on __AUX__.stable_runtime_cascade_probe for each row
              execute function __MAIN__.test_project_purge_noop_trigger();
            insert into __AUX__.stable_runtime_cascade_probe(child_id,parent_process_code)
            values(1,'RFP_LOCK')
            """.replace("__AUX__",auxiliarySchema).replace("__MAIN__",schema));
        JsonNode stableBlocked=preview(BLOCKED_RECEIPT,BLOCKED_OPERATION,
            "purge-lock-preview-stable-external-fk");
        assertEquals("BLOCKED",stableBlocked.path("status").asText(),stableBlocked.toString());
        assertEquals(false,stableBlocked.path("success").asBoolean(true));
        assertEquals(true,stableBlocked.path("blockers").path("blocked").asBoolean(false));
        assertEquals(1,stableBlocked.path("blockers")
            .path("externalFkDescendantRowCount").asInt(-1));
        assertEquals(1,admin.queryForObject(
            "select count(*) from "+auxiliarySchema+".stable_runtime_cascade_probe",
            Integer.class));
        assertEquals("O",admin.queryForObject("""
            select tgenabled::text from pg_trigger
             where tgrelid=?::regclass and tgname='trg_stable_runtime_probe'
            """,String.class,auxiliarySchema+".stable_runtime_cascade_probe"));
        admin.execute("drop table "+auxiliarySchema+".stable_runtime_cascade_probe");

        JsonNode preview=preview("purge-lock-preview-retry");
        assertEquals("PREVIEWED",preview.path("status").asText(),preview.toString());
        assertEquals(false,preview.path("blockers").path("blocked").asBoolean(true));
        String snapshot=preview.path("snapshotSha256").asText();
        assertTrue(snapshot.matches("[0-9a-f]{64}"));
        int captured=jdbc.queryForObject("""
            select count(*) from framework_project_runtime_purge_snapshot_row
             where receipt_id=?::uuid
            """,Integer.class,RECEIPT);
        assertTrue(captured>=8,"expected a nontrivial exact runtime preimage: "+captured);
        String originalContentHash=liveContentHash();
        assertEquals(captured,liveRows());

        FailureState beforeInversion=failureState();
        WriterInversionResult inversion=stageWriterInversion(snapshot);
        assertRetry(inversion.applyAttempt(),"writer table-lock inversion");
        assertEquals(1,inversion.writerRows(),"guarded writer must commit after purge retries");
        FailureState afterInversion=failureState();
        assertEquals(beforeInversion.inventoryHash(),afterInversion.inventoryHash());
        assertEquals(beforeInversion.purgeEvidenceHash(),afterInversion.purgeEvidenceHash());
        assertEquals(beforeInversion.auditSequence(),afterInversion.auditSequence());
        assertEquals(beforeInversion.triggerHash(),afterInversion.triggerHash());
        assertEquals(originalContentHash,liveContentHash(),
            "content-neutral guarded update must preserve the captured runtime payload");
        assertEquals(captured,liveRows());
        assertAllUserTriggersEnabled();

        jdbc.execute("""
            create table __AUX__.late_runtime_cascade_probe(
              child_id bigint primary key,
              parent_process_code varchar(80) not null references
                __MAIN__.framework_process_definition(process_code) on delete cascade);
            create trigger trg_late_zero_probe before insert or update
              on __AUX__.late_runtime_cascade_probe for each row
              execute function __MAIN__.test_project_purge_noop_trigger();
            insert into __AUX__.late_runtime_cascade_probe(child_id,parent_process_code)
            values(1,'RFP_LOCK')
            """.replace("__AUX__",auxiliarySchema).replace("__MAIN__",schema));
        FailureState beforeLateClosure=failureState();
        FailureAttempt lateClosure=failFastMutation(
            "framework_apply_project_runtime_purge",snapshot,"purge-lock-late-fk-caller");
        assertRetry(lateClosure,"late zero-row FK closure");
        assertEquals(beforeLateClosure,failureState(),
            "late FK closure denial must not cascade or mutate its snapshot");
        assertAllUserTriggersEnabled();
        assertEquals(1,admin.queryForObject("""
            select count(*) from pg_class relation join pg_namespace namespace
              on namespace.oid=relation.relnamespace
             where namespace.nspname=? and relation.relname='late_runtime_cascade_probe'
            """,Integer.class,auxiliarySchema));
        assertEquals(1,admin.queryForObject(
            "select count(*) from "+auxiliarySchema+".late_runtime_cascade_probe",Integer.class));
        assertEquals("O",admin.queryForObject("""
            select tgenabled::text from pg_trigger
             where tgrelid=?::regclass
               and tgname='trg_late_zero_probe'
            """,String.class,auxiliarySchema+".late_runtime_cascade_probe"));
        assertEquals(1,jdbc.queryForObject(
            "select count(*) from framework_process_definition where process_code=?",
            Integer.class,PROCESS));
        admin.execute("drop table "+auxiliarySchema+".late_runtime_cascade_probe");

        FailureState beforeApply=failureState();

        FailureAttempt blockedApply;
        try(CanonicalLockHolder ignored=holdAdvisory(
                "BACKSTAGE_DESIGN_RELEASE_V1:"+PROJECT,
                "purge-lock-apply-holder",false)){
            blockedApply=failFastMutation("framework_apply_project_runtime_purge",snapshot,
                "purge-lock-apply-caller");
            assertEquals(beforeApply,failureState(),"failed purge must be a write-zero rollback");
            assertAllUserTriggersEnabled();
        }
        assertRetry(blockedApply,"purge");

        FailureState beforeWorkerConflict=failureState();
        FailureAttempt blockedWorker;
        try(CanonicalLockHolder worker=holdAdvisory(
                "CANONICAL_PROCESS_PUBLICATION_V1:"+PROCESS,
                "purge-lock-worker-holder",true)){
            blockedWorker=failFastMutation("framework_apply_project_runtime_purge",snapshot,
                "purge-lock-worker-conflict-apply");
            assertEquals(beforeWorkerConflict,failureState(),
                "NOWAIT inventory conflict must roll back receipt, snapshot, and trigger DDL");
            assertAllUserTriggersEnabled();
        }
        assertRetry(blockedWorker,"worker table-lock conflict");
        JsonNode purged=invoke("framework_apply_project_runtime_purge",snapshot,
            "purge-lock-worker-release-retry");
        assertEquals("PURGED",purged.path("status").asText(),purged.toString());
        assertEquals(0,purged.path("postcondition").path("residualScopeCounts")
            .path("residualRows").asInt(-1));
        assertEquals(0,liveRows());
        assertTriggersEnabled();
        JsonNode purgeReplay=invoke("framework_apply_project_runtime_purge",snapshot,
            "purge-lock-apply-idempotent");
        assertEquals("PURGED",purgeReplay.path("status").asText());
        assertEquals(true,purgeReplay.path("idempotent").asBoolean(false));
        FailureState beforeRestore=failureState();

        FailureAttempt blockedRestore;
        try(CanonicalLockHolder ignored=holdAdvisory(
                "PROJECT_RUNTIME_PURGE_V1:"+PROJECT,
                "purge-lock-restore-holder",false)){
            blockedRestore=failFastMutation("framework_restore_project_runtime_purge",snapshot,
                "purge-lock-restore-caller");
            assertEquals(beforeRestore,failureState(),"failed restore must be a write-zero rollback");
            assertAllUserTriggersEnabled();
        }
        assertRetry(blockedRestore,"restore");

        JsonNode restored=invoke("framework_restore_project_runtime_purge",snapshot,
            "purge-lock-restore-retry");
        assertEquals("RESTORED",restored.path("status").asText(),restored.toString());
        assertEquals(true,restored.path("aToBToA").asBoolean(false));
        assertEquals(captured,liveRows());
        assertEquals(originalContentHash,liveContentHash());
        assertTriggersEnabled();

        jdbc.execute("""
            create table late_restore_cascade_probe(
              child_id bigint primary key,
              parent_process_code varchar(80) not null references
                framework_process_definition(process_code) on delete cascade);
            create trigger trg_late_restore_probe before insert or update
              on late_restore_cascade_probe for each row
              execute function test_project_purge_noop_trigger();
            insert into late_restore_cascade_probe(child_id,parent_process_code)
            values(1,'RFP_LOCK')
            """);
        FailureState beforeRestoreReplayClosure=failureState();
        FailureAttempt lateRestoreClosure=failFastMutation(
            "framework_restore_project_runtime_purge",snapshot,
            "purge-lock-restore-idempotent-late-fk");
        assertRetry(lateRestoreClosure,"idempotent restore late FK closure");
        assertEquals(beforeRestoreReplayClosure,failureState(),
            "idempotent restore FK-closure denial must be a write-zero rollback");
        assertAllUserTriggersEnabled();
        assertEquals(1,jdbc.queryForObject(
            "select count(*) from late_restore_cascade_probe",Integer.class));
        assertEquals(1,jdbc.queryForObject(
            "select count(*) from framework_process_definition where process_code=?",
            Integer.class,PROCESS));
        jdbc.execute("drop table late_restore_cascade_probe");
        JsonNode restoreReplay=invoke("framework_restore_project_runtime_purge",snapshot,
            "purge-lock-restore-idempotent-retry");
        assertEquals("RESTORED",restoreReplay.path("status").asText(),restoreReplay.toString());
        assertEquals(true,restoreReplay.path("idempotent").asBoolean(false));

        FailureState beforeBlockedWriter=failureState();
        FailureAttempt blockedWriter;
        try(CanonicalLockHolder ignored=holdAdvisory(
                "CANONICAL_PROCESS_PUBLICATION_V1:"+PROCESS,
                "purge-lock-writer-holder",false)){
            blockedWriter=failFastGuardWriter("purge-lock-writer-caller");
            assertEquals(beforeBlockedWriter,failureState(),
                "guard retry must roll back the ordinary writer exactly");
        }
        assertRetry(blockedWriter,"ordinary writer guard");
        assertEquals("O",jdbc.queryForObject("""
            select tgenabled::text from pg_trigger
             where tgrelid='unrelated_purge_trigger_probe'::regclass
               and tgname='trg_unrelated_purge_probe'
            """,String.class));
        assertEquals(1,jdbc.update("""
            update framework_process_definition set process_name='Purge lock retry complete'
             where process_code=?
            """,PROCESS),"normal writer must pass after every writer key is released");
        assertEquals(0,activeTestSessions());
        assertEquals(0,countSqlState(blockedPreview,"40P01")+
            countSqlState(inversion.applyAttempt(),"40P01")+
            countSqlState(lateClosure,"40P01")+countSqlState(blockedApply,"40P01")+
            countSqlState(blockedWorker,"40P01")+countSqlState(blockedRestore,"40P01")+
            countSqlState(lateRestoreClosure,"40P01")+countSqlState(blockedWriter,"40P01"));
        assertEquals(0,countSqlState(blockedPreview,"55P03")+
            countSqlState(inversion.applyAttempt(),"55P03")+
            countSqlState(lateClosure,"55P03")+countSqlState(blockedApply,"55P03")+
            countSqlState(blockedWorker,"55P03")+countSqlState(blockedRestore,"55P03")+
            countSqlState(lateRestoreClosure,"55P03")+countSqlState(blockedWriter,"55P03"));
    }

    private FailureAttempt failFastPreview(String applicationName){
        JdbcTemplate caller=new JdbcTemplate(dataSource(applicationName));
        TransactionTemplate transaction=new TransactionTemplate(
            new DataSourceTransactionManager(caller.getDataSource()));
        AtomicInteger pid=new AtomicInteger();
        long started=System.nanoTime();
        RuntimeException failure=assertThrows(RuntimeException.class,()->transaction.executeWithoutResult(
            status->{
                pid.set(caller.queryForObject("select pg_backend_pid()",Integer.class));
                caller.execute("set local lock_timeout='2s'");
                caller.execute("set local statement_timeout='5s'");
                caller.queryForObject("""
                    select framework_preview_project_runtime_purge(
                      ?::uuid,?::uuid,?,?,1,?,'EXACT_PROJECT',?)::text
                    """,String.class,RECEIPT,OPERATION,PROJECT,PROCESS,CONTRACT,ACTOR);
            }));
        long elapsed=TimeUnit.NANOSECONDS.toMillis(System.nanoTime()-started);
        String state=sqlState(failure);
        assertEquals("40001",state,"unexpected fail-fast SQLSTATE: "+failure);
        awaitBackendExit(pid.get());
        return new FailureAttempt(state,elapsed);
    }

    private FailureAttempt failFastMutation(
            String function,String snapshot,String applicationName){
        JdbcTemplate caller=new JdbcTemplate(dataSource(applicationName));
        TransactionTemplate transaction=new TransactionTemplate(
            new DataSourceTransactionManager(caller.getDataSource()));
        AtomicInteger pid=new AtomicInteger();
        long started=System.nanoTime();
        RuntimeException failure=assertThrows(RuntimeException.class,()->transaction.executeWithoutResult(
            status->{
                pid.set(caller.queryForObject("select pg_backend_pid()",Integer.class));
                caller.execute("set local lock_timeout='2s'");
                caller.execute("set local statement_timeout='5s'");
                caller.queryForObject("select "+function+"("+
                    "?::uuid,?,?,1,?,?,?)::text",String.class,
                    RECEIPT,PROJECT,PROCESS,CONTRACT,snapshot,ACTOR);
            }));
        long elapsed=TimeUnit.NANOSECONDS.toMillis(System.nanoTime()-started);
        String state=sqlState(failure);
        assertEquals("40001",state,"unexpected fail-fast SQLSTATE: "+failure);
        awaitBackendExit(pid.get());
        return new FailureAttempt(state,elapsed);
    }

    private FailureAttempt failFastGuardWriter(String applicationName){
        JdbcTemplate caller=new JdbcTemplate(dataSource(applicationName));
        TransactionTemplate transaction=new TransactionTemplate(
            new DataSourceTransactionManager(caller.getDataSource()));
        AtomicInteger pid=new AtomicInteger();
        long started=System.nanoTime();
        RuntimeException failure=assertThrows(RuntimeException.class,()->transaction.executeWithoutResult(
            status->{
                pid.set(caller.queryForObject("select pg_backend_pid()",Integer.class));
                caller.execute("set local lock_timeout='2s'");
                caller.execute("set local statement_timeout='5s'");
                caller.update("""
                    update framework_process_definition set process_name='must roll back'
                     where process_code=?
                    """,PROCESS);
            }));
        long elapsed=TimeUnit.NANOSECONDS.toMillis(System.nanoTime()-started);
        String state=sqlState(failure);
        assertEquals("40001",state,"unexpected writer-guard SQLSTATE: "+failure);
        awaitBackendExit(pid.get());
        return new FailureAttempt(state,elapsed);
    }

    private WriterInversionResult stageWriterInversion(String snapshot) throws Exception {
        JdbcTemplate writer=new JdbcTemplate(dataSource("purge-lock-inversion-writer"));
        JdbcTemplate apply=new JdbcTemplate(dataSource("purge-lock-inversion-apply"));
        TransactionTemplate writerTransaction=new TransactionTemplate(
            new DataSourceTransactionManager(writer.getDataSource()));
        TransactionTemplate applyTransaction=new TransactionTemplate(
            new DataSourceTransactionManager(apply.getDataSource()));
        CountDownLatch tableHeld=new CountDownLatch(1),applyEntered=new CountDownLatch(1),
            allowWriterUpdate=new CountDownLatch(1);
        AtomicInteger writerPid=new AtomicInteger(),applyPid=new AtomicInteger();
        var executor=Executors.newFixedThreadPool(2);
        Future<Integer> writerFuture=executor.submit(()->writerTransaction.execute(status->{
            writer.execute("set local lock_timeout='4s'");
            writer.execute("set local statement_timeout='8s'");
            writerPid.set(writer.queryForObject("select pg_backend_pid()",Integer.class));
            writer.execute("lock table framework_process_definition in row exclusive mode");
            tableHeld.countDown();
            try{
                if(!allowWriterUpdate.await(5,TimeUnit.SECONDS))
                    throw new IllegalStateException("WRITER_UPDATE_BARRIER_TIMEOUT");
            }catch(InterruptedException error){
                Thread.currentThread().interrupt();throw new IllegalStateException(error);
            }
            return writer.update("""
                update framework_process_definition set process_name=process_name
                 where process_code=?
                """,PROCESS);
        }));
        assertTrue(tableHeld.await(5,TimeUnit.SECONDS),
            "writer did not acquire ROW EXCLUSIVE before purge apply");
        Future<FailureAttempt> applyFuture=executor.submit(()->{
            long started=System.nanoTime();
            try{
                applyTransaction.executeWithoutResult(status->{
                    apply.execute("set local lock_timeout='4s'");
                    apply.execute("set local statement_timeout='8s'");
                    applyPid.set(apply.queryForObject("select pg_backend_pid()",Integer.class));
                    applyEntered.countDown();
                    apply.queryForObject("""
                        select framework_apply_project_runtime_purge(
                          ?::uuid,?,?,1,?,?,?)::text
                        """,String.class,RECEIPT,PROJECT,PROCESS,CONTRACT,snapshot,ACTOR);
                });
                return new FailureAttempt("",TimeUnit.NANOSECONDS.toMillis(
                    System.nanoTime()-started));
            }catch(RuntimeException failure){
                return new FailureAttempt(sqlState(failure),TimeUnit.NANOSECONDS.toMillis(
                    System.nanoTime()-started));
            }
        });
        assertTrue(applyEntered.await(5,TimeUnit.SECONDS),"purge apply did not enter its transaction");
        long barrierDeadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(2);
        boolean applyFailedOrWaiting=false;
        while(System.nanoTime()<barrierDeadline){
            if(applyFuture.isDone()||admin.queryForObject("""
                select count(*) from pg_locks
                 where pid=? and not granted and locktype in('relation','tuple')
                """,Integer.class,applyPid.get())>0){
                applyFailedOrWaiting=true;
                break;
            }
            Thread.sleep(20);
        }
        assertTrue(applyFailedOrWaiting,
            "purge neither failed NOWAIT nor reached the legacy ACCESS EXCLUSIVE wait");
        allowWriterUpdate.countDown();
        FailureAttempt applyAttempt;
        int writerRows;
        try{
            applyAttempt=applyFuture.get(10,TimeUnit.SECONDS);
            writerRows=writerFuture.get(10,TimeUnit.SECONDS);
        }finally{
            allowWriterUpdate.countDown();
            executor.shutdownNow();
        }
        awaitBackendExit(applyPid.get());
        awaitBackendExit(writerPid.get());
        assertEquals(0,activeTestSessions(),"inversion stage leaked a database session");
        return new WriterInversionResult(applyAttempt,writerRows);
    }

    private JsonNode preview(String applicationName) throws Exception {
        return preview(RECEIPT,OPERATION,applicationName);
    }

    private JsonNode preview(String receipt,String operation,String applicationName)
            throws Exception {
        JdbcTemplate caller=new JdbcTemplate(dataSource(applicationName));
        return json(caller.queryForObject("""
            select framework_preview_project_runtime_purge(
              ?::uuid,?::uuid,?,?,1,?,'EXACT_PROJECT',?)::text
            """,String.class,receipt,operation,PROJECT,PROCESS,CONTRACT,ACTOR));
    }

    private JsonNode invoke(String function,String snapshot,String applicationName) throws Exception {
        JdbcTemplate caller=new JdbcTemplate(dataSource(applicationName));
        TransactionTemplate transaction=new TransactionTemplate(
            new DataSourceTransactionManager(caller.getDataSource()));
        String result=transaction.execute(status->{
            caller.execute("set local lock_timeout='5s'");
            caller.execute("set local statement_timeout='20s'");
            return caller.queryForObject("select "+function+"("+
                "?::uuid,?,?,1,?,?,?)::text",String.class,
                RECEIPT,PROJECT,PROCESS,CONTRACT,snapshot,ACTOR);
        });
        return json(result);
    }

    private CanonicalLockHolder holdAdvisory(String key,String applicationName,
            boolean workerTableLocks) throws Exception {
        DriverManagerDataSource source=dataSource(applicationName);
        JdbcTemplate holderJdbc=new JdbcTemplate(source);
        TransactionTemplate holderTransaction=new TransactionTemplate(
            new DataSourceTransactionManager(source));
        CountDownLatch held=new CountDownLatch(1),release=new CountDownLatch(1);
        AtomicInteger pid=new AtomicInteger();
        var executor=Executors.newSingleThreadExecutor();
        Future<?> future=executor.submit(()->holderTransaction.executeWithoutResult(status->{
            holderJdbc.execute("set local statement_timeout='20s'");
            pid.set(holderJdbc.queryForObject("select pg_backend_pid()",Integer.class));
            if(workerTableLocks){
                holderJdbc.execute("lock table framework_process_definition in row exclusive mode");
                holderJdbc.query("""
                    select project_id from framework_actor_process_design_release
                     where project_id=? and design_version=1 for share
                    """,rs->{},PROJECT);
            }
            holderJdbc.query("select pg_advisory_xact_lock(hashtextextended(?,0))",
                rs->{},key);
            held.countDown();
            try{
                if(!release.await(15,TimeUnit.SECONDS))
                    throw new IllegalStateException("CANONICAL_HOLDER_RELEASE_TIMEOUT");
            }catch(InterruptedException error){
                Thread.currentThread().interrupt();throw new IllegalStateException(error);
            }
        }));
        assertTrue(held.await(5,TimeUnit.SECONDS),"canonical publisher did not acquire its lock");
        return new CanonicalLockHolder(release,future,executor,pid.get());
    }

    private FailureState failureState(){
        String evidence=jdbc.queryForObject("""
            select framework_project_runtime_purge_hash(jsonb_build_object(
              'receipts',(select coalesce(jsonb_agg(jsonb_build_object(
                 'row',to_jsonb(receipt),'xmin',xmin::text) order by receipt_id),'[]'::jsonb)
                 from framework_project_runtime_purge_receipt receipt),
              'snapshots',(select coalesce(jsonb_agg(jsonb_build_object(
                 'row',to_jsonb(snapshot),'xmin',xmin::text)
                 order by receipt_id,table_name collate "C",row_hash collate "C"),'[]'::jsonb)
                 from framework_project_runtime_purge_snapshot_row snapshot),
              'audits',(select coalesce(jsonb_agg(jsonb_build_object(
                 'row',to_jsonb(audit),'xmin',xmin::text) order by audit_id),'[]'::jsonb)
                 from framework_project_runtime_purge_audit audit)))
            """,String.class);
        String auditSequence=jdbc.queryForObject("""
            select last_value::text||':'||is_called::text
              from framework_project_runtime_purge_audit_audit_id_seq
            """,String.class);
        return new FailureState(
            jdbc.queryForObject("select test_project_runtime_catalog_witness()",String.class),
            inventoryHash(),evidence,auditSequence,globalTriggerHash());
    }

    private int liveRows(){
        return jdbc.queryForObject("select (test_project_purge_live_witness(?::uuid)->>'liveRows')::integer",
            Integer.class,RECEIPT);
    }

    private String liveContentHash(){
        return jdbc.queryForObject("select test_project_purge_live_witness(?::uuid)->>'contentHash'",
            String.class,RECEIPT);
    }

    private String inventoryHash(){
        return admin.queryForObject("""
            select encode(sha256(convert_to(jsonb_build_object(
              'relations',(select coalesce(jsonb_agg(jsonb_build_object(
                'name',relation.relname,'kind',relation.relkind)
                order by relation.relname collate "C"),'[]'::jsonb)
                from pg_class relation join pg_namespace namespace
                  on namespace.oid=relation.relnamespace
               where namespace.nspname=? and relation.relkind in('r','p')),
              'constraints',(select coalesce(jsonb_agg(jsonb_build_object(
                'table',relation.relname,'name',constraint_row.conname,
                'type',constraint_row.contype,
                'definition',pg_get_constraintdef(constraint_row.oid,true))
                order by relation.relname collate "C",constraint_row.conname collate "C"),
                '[]'::jsonb)
                from pg_constraint constraint_row join pg_class relation
                  on relation.oid=constraint_row.conrelid join pg_namespace namespace
                  on namespace.oid=relation.relnamespace where namespace.nspname=?),
              'triggers',(select coalesce(jsonb_agg(jsonb_build_object(
                'table',relation.relname,'name',trigger_row.tgname,
                'enabled',trigger_row.tgenabled)
                order by relation.relname collate "C",trigger_row.tgname collate "C"),
                '[]'::jsonb)
                from pg_trigger trigger_row join pg_class relation
                  on relation.oid=trigger_row.tgrelid join pg_namespace namespace
                  on namespace.oid=relation.relnamespace
               where namespace.nspname=? and not trigger_row.tgisinternal)
            )::text,'UTF8')),'hex')
            """,String.class,schema,schema,schema);
    }

    private String globalTriggerHash(){
        return admin.queryForObject("""
            select encode(sha256(convert_to(coalesce(jsonb_agg(jsonb_build_object(
              'table',relation.relname,'trigger',trigger_row.tgname,
              'enabled',trigger_row.tgenabled)
              order by relation.relname collate "C",trigger_row.tgname collate "C"),
              '[]'::jsonb)::text,'UTF8')),'hex')
              from pg_trigger trigger_row join pg_class relation
                on relation.oid=trigger_row.tgrelid join pg_namespace namespace
                on namespace.oid=relation.relnamespace
             where namespace.nspname=? and not trigger_row.tgisinternal
            """,String.class,schema);
    }

    private static void assertRetry(FailureAttempt attempt,String phase){
        assertEquals("40001",attempt.sqlState(),phase+" SQLSTATE");
        assertTrue(attempt.elapsedMillis()<4_000,
            phase+" waited instead of returning retry: "+attempt.elapsedMillis()+"ms");
    }

    private void assertTriggersEnabled(){
        assertEquals(0,jdbc.queryForObject("""
            select count(*) from pg_trigger trigger_row
             where not trigger_row.tgisinternal and trigger_row.tgenabled<>'O'
               and trigger_row.tgrelid in(select distinct table_oid
                 from framework_project_runtime_purge_snapshot_row where receipt_id=?::uuid)
            """,Integer.class,RECEIPT));
        assertTrue(jdbc.queryForObject("""
            select count(*) from pg_trigger trigger_row
             where not trigger_row.tgisinternal and trigger_row.tgenabled='O'
               and trigger_row.tgrelid in(select distinct table_oid
                 from framework_project_runtime_purge_snapshot_row where receipt_id=?::uuid)
            """,Integer.class,RECEIPT)>0);
    }

    private void assertAllUserTriggersEnabled(){
        assertEquals(0,admin.queryForObject("""
            select count(*) from pg_trigger trigger_row join pg_class relation
              on relation.oid=trigger_row.tgrelid join pg_namespace namespace
              on namespace.oid=relation.relnamespace
             where namespace.nspname=? and not trigger_row.tgisinternal
               and trigger_row.tgenabled<>'O'
            """,Integer.class,schema));
    }

    private int activeTestSessions(){
        return admin.queryForObject("""
            select count(*) from pg_stat_activity
             where application_name like 'purge-lock-%'
            """,Integer.class);
    }

    private void awaitBackendExit(int pid){
        if(pid<=0)return;
        long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(2);
        int active;
        do{
            active=admin.queryForObject("select count(*) from pg_stat_activity where pid=?",
                Integer.class,pid);
            if(active!=0)try{Thread.sleep(20);}
            catch(InterruptedException error){
                Thread.currentThread().interrupt();throw new IllegalStateException(error);
            }
        }while(active!=0&&System.nanoTime()<deadline);
        assertEquals(0,active,"test backend residue pid="+pid);
    }

    private void installRuntimePreimage(){
        jdbc.execute("""
            create function test_project_purge_noop_trigger()
            returns trigger language plpgsql as $$ begin return new; end $$;
            create table unrelated_purge_trigger_probe(probe_id bigint primary key);
            create trigger trg_unrelated_purge_probe before insert or update
              on unrelated_purge_trigger_probe for each row
              execute function test_project_purge_noop_trigger();
            insert into framework_actor_definition(actor_code,use_at) values('ACTOR_A','Y');
            insert into framework_process_definition(
              process_code,process_name,domain_code,owner_actor_code,process_version,goal,
              start_condition,completion_condition,process_status,lifecycle_status,
              definition_locked,definition_lock_reason)
            values('RFP_LOCK','Purge lock regression','TEST','ACTOR_A','1.0.0','goal',
              'start','done','ACTIVE','ACTIVE',false,null);
            insert into framework_process_step(
              process_code,step_code,step_order,actor_code,step_name,command_code,
              from_state,to_state,completion_rule,decision_rule,requires_notification,
              input_contract,output_contract,requires_user_page,requires_admin_page)
            values('RFP_LOCK','STEP_A',1,'ACTOR_A','Step A','SAVE','DRAFT','DONE',
              'saved','SOURCE:REQUIREMENT_DOCUMENT',false,'{}','{}',false,false);
            insert into framework_simulation_case(
              case_code,process_code,case_name,case_type,preconditions,steps_json,assertions_json)
            values('RFP_LOCK_HAPPY','RFP_LOCK','happy','HAPPY_PATH','{}','[]','[]');
            insert into framework_actor_process_design_release(
              project_id,design_version,contract_sha256,contract_payload,release_status)
            values('RFP-LOCK-001',1,repeat('a',64),
              '{"process":{"processCode":"RFP_LOCK"},"source":{"testOwned":true}}','APPLIED');
            insert into framework_process_execution(
              execution_id,project_id,process_code,current_step_code)
            values('51000000-0000-0000-0000-000000000001','RFP-LOCK-001','RFP_LOCK','STEP_A');
            insert into framework_process_execution_event(execution_id,result_json)
            values('51000000-0000-0000-0000-000000000001','{"ok":true}');
            insert into framework_process_work_draft(
              draft_id,project_id,process_code,step_code,payload_json,evidence_json)
            values('52000000-0000-0000-0000-000000000001','RFP-LOCK-001','RFP_LOCK','STEP_A',
              '{"value":"A"}','{"qaProvenance":"fixture"}');
            insert into framework_account_actor_assignment(project_id,account_id,actor_code)
            values('RFP-LOCK-001','runtime.composite.admin','ACTOR_A');
            insert into framework_project_actor_assignment(project_id,actor_code,user_id)
            values('RFP-LOCK-001','ACTOR_A','runtime.composite.admin');
            insert into framework_source_artifact(source_path,ownership_mode,metadata_json)
            values('/generated/rfp-lock.ts','GENERATED',
              '{"projectId":"RFP-LOCK-001","processCode":"RFP_LOCK"}');
            insert into framework_source_artifact_version(source_artifact_id,revision)
            select source_artifact_id,1 from framework_source_artifact;
            insert into framework_source_materialization_state(source_artifact_id,sync_status)
            select source_artifact_id,'DIRTY' from framework_source_artifact;
            insert into framework_runtime_resource(resource_kind,resource_key,contract_json)
            values('ENDPOINT','RFP_LOCK:STEP_A:SAVE',
              '{"projectId":"RFP-LOCK-001","processCode":"RFP_LOCK"}');
            insert into framework_runtime_generation_state(resource_id,sync_status)
            select resource_id,'DIRTY' from framework_runtime_resource;
            insert into framework_api_endpoint_registry(
              endpoint_key,http_method,route_path,implementation_ref)
            values('RFP_LOCK:STEP_A:SAVE','POST','/api/generated/rfp-lock/save',
              'GeneratedRfpLockController#save');
            """);
    }

    private void installLiveSnapshotWitness(){
        jdbc.execute("""
            create function test_project_purge_live_witness(requested_receipt uuid)
            returns jsonb language plpgsql set search_path=pg_catalog,__SCHEMA__ as $$
            declare captured record; exact_count integer; live_xmin text;
            declare content_rows jsonb:='[]'::jsonb; xmin_rows jsonb:='[]'::jsonb;
            declare live_count integer:=0;
            begin
              for captured in
                select * from framework_project_runtime_purge_snapshot_row
                 where receipt_id=requested_receipt
                 order by table_name collate "C",row_hash collate "C"
              loop
                execute format('select count(*)::integer,min(xmin::text) from %s row_value '
                  'where to_jsonb(row_value)=$1',captured.table_oid::regclass)
                  into exact_count,live_xmin using captured.row_payload;
                live_count:=live_count+exact_count;
                content_rows:=content_rows||jsonb_build_array(jsonb_build_object(
                  'table',captured.table_name,'rowHash',captured.row_hash,'present',exact_count));
                xmin_rows:=xmin_rows||jsonb_build_array(jsonb_build_object(
                  'table',captured.table_name,'rowHash',captured.row_hash,'xmin',live_xmin));
              end loop;
              return jsonb_build_object('liveRows',live_count,
                'contentHash',framework_project_runtime_purge_hash(content_rows),
                'xminHash',framework_project_runtime_purge_hash(xmin_rows));
            end $$
            """.replace("__SCHEMA__",schema));
        jdbc.execute("""
            create function test_project_runtime_catalog_witness()
            returns text language plpgsql set search_path=pg_catalog,__SCHEMA__ as $$
            declare table_row record; table_payload jsonb; catalog_payload jsonb:='[]'::jsonb;
            begin
              for table_row in
                select relation.oid,relation.relname
                  from pg_class relation join pg_namespace namespace
                    on namespace.oid=relation.relnamespace
                 where namespace.nspname='__SCHEMA__' and relation.relkind in('r','p')
                   and relation.relname not like 'framework_project_runtime_purge\\_%' escape '\\'
                 order by relation.relname collate "C",relation.oid
              loop
                execute format('select coalesce(jsonb_agg(jsonb_build_object('
                  '''row'',to_jsonb(row_value),''xmin'',xmin::text) '
                  'order by to_jsonb(row_value)::text),''[]''::jsonb) from %s row_value',
                  table_row.oid::regclass) into table_payload;
                catalog_payload:=catalog_payload||jsonb_build_array(jsonb_build_object(
                  'table',table_row.relname,'rows',table_payload));
              end loop;
              return framework_project_runtime_purge_hash(catalog_payload);
            end $$
            """.replace("__SCHEMA__",schema));
    }

    private DriverManagerDataSource dataSource(String applicationName){
        String separator=baseUrl.contains("?")?"&":"?";
        String scoped=baseUrl+separator+"currentSchema="+schema+
            "&ApplicationName="+applicationName;
        return new DriverManagerDataSource(scoped,user,password);
    }

    private String qualifyMigration(String sql){
        return sql.replace("public.",schema+".")
            .replace("'public'","'"+schema+"'")
            .replace("search_path=pg_catalog,public","search_path=pg_catalog,"+schema);
    }

    private JsonNode json(String value){
        try{return mapper.readTree(value);}
        catch(Exception error){throw new IllegalStateException(error);}
    }

    private static String sqlState(Throwable error){
        for(Throwable current=error;current!=null;current=current.getCause())
            if(current instanceof SQLException sql&&sql.getSQLState()!=null)
                return sql.getSQLState();
        return "";
    }

    private static int countSqlState(FailureAttempt attempt,String expected){
        return expected.equals(attempt.sqlState())?1:0;
    }

    private static Path findRepositoryFile(String relative){
        Path cursor=Path.of("").toAbsolutePath();
        for(int depth=0;cursor!=null&&depth<8;depth++,cursor=cursor.getParent()){
            Path candidate=cursor.resolve(relative);
            if(Files.isRegularFile(candidate))return candidate;
        }
        throw new IllegalStateException("repository file not found: "+relative);
    }

    private record FailureAttempt(String sqlState,long elapsedMillis){}
    private record WriterInversionResult(FailureAttempt applyAttempt,int writerRows){}
    private record FailureState(String runtimeCatalogHash,String inventoryHash,
        String purgeEvidenceHash,String auditSequence,String triggerHash){}

    private final class CanonicalLockHolder implements AutoCloseable {
        private final CountDownLatch release;
        private final Future<?> future;
        private final java.util.concurrent.ExecutorService executor;
        private final int pid;
        private boolean closed;

        private CanonicalLockHolder(CountDownLatch release,Future<?> future,
                java.util.concurrent.ExecutorService executor,int pid){
            this.release=release;this.future=future;this.executor=executor;this.pid=pid;
        }

        @Override public void close() throws Exception {
            if(closed)return;
            closed=true;
            release.countDown();
            try{future.get(5,TimeUnit.SECONDS);}
            finally{executor.shutdownNow();}
            awaitBackendExit(pid);
        }
    }
}
