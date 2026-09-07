package egovframework.com.platform.governance.service;

import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verifyNoInteractions;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ActorProcessGovernanceServicePostgresContractTest {
    private static final String CANONICAL_JOB_MIGRATION=
        "apps/carbonet-api/src/main/resources/db/migration/postgresql/"+
        "V20260815121600__enforce_one_canonical_generation_job.sql";
    private String schema;
    private JdbcTemplate admin;
    private JdbcTemplate jdbc;
    private TransactionTemplate transaction;
    private ActorProcessGovernanceService service;
    private ScreenContractRuntimeService runtime;
    private long contractId;

    @BeforeAll
    void createDisposableSchema(){
        String url=System.getenv("DIRECT_CODEGEN_PG_URL");
        assumeTrue(url!=null&&!url.isBlank(),"DIRECT_CODEGEN_PG_URL is required for the PostgreSQL contract suite");
        String user=System.getenv().getOrDefault("DIRECT_CODEGEN_PG_USER","postgres");
        String password=System.getenv().getOrDefault("DIRECT_CODEGEN_PG_PASSWORD","");
        DriverManagerDataSource adminDataSource=new DriverManagerDataSource(url,user,password);
        admin=new JdbcTemplate(adminDataSource);
        schema="direct_codegen_"+UUID.randomUUID().toString().replace("-","");
        admin.execute("create schema "+schema);
        String separator=url.contains("?")?"&":"?";
        DriverManagerDataSource testDataSource=new DriverManagerDataSource(
            url+separator+"currentSchema="+schema,user,password);
        jdbc=new JdbcTemplate(testDataSource);
        transaction=new TransactionTemplate(new DataSourceTransactionManager(testDataSource));
        runtime=mock(ScreenContractRuntimeService.class);
        service=new ActorProcessGovernanceService(jdbc,mock(ScreenDevelopmentNoteService.class),
            mock(egovframework.com.platform.codex.service.CodexProvisioningService.class),runtime);
        createSchema();
    }

    @AfterAll
    void dropDisposableSchema(){
        if(admin!=null&&schema!=null)admin.execute("drop schema if exists "+schema+" cascade");
    }

    @BeforeEach
    void seed(){
        jdbc.execute("drop trigger if exists reject_generation_job on framework_development_job");
        jdbc.execute("truncate framework_development_job_event,framework_development_job_gate_result,framework_development_job,"+
            "framework_process_artifact,"+
            "framework_permission_grant_v1,framework_permission_requirement_v1,framework_step_execution_spec,"+
            "framework_screen_blueprint,framework_professional_screen_contract,"+
            "framework_process_step,framework_screen_resource,comtnthemedefinition restart identity cascade");
        jdbc.update("insert into framework_screen_resource(route_key,layout_type) values('/screen','REGISTERED_LAYOUT')");
        jdbc.update("""
            insert into comtnthemedefinition(theme_id,use_at,is_active)
            values('REGISTERED_THEME','Y','Y'),('KRDS_GOV_DEFAULT','Y','Y')
            """);
        jdbc.update("""
            insert into framework_process_step(
              process_code,step_code,step_order,actor_code,command_code,from_state,to_state,
              requires_api,api_contract,user_path)
            values('PROC','STEP',1,'ACTOR','SAVE','READY','DONE',true,
              'POST /api/items','/screen')
            """);
        contractId=jdbc.queryForObject("""
            insert into framework_professional_screen_contract(
              process_code,step_code,audience,route_path,screen_name,actor_code,permission_codes,business_purpose,
              entry_condition,exit_condition,section_contract,field_contract,command_contract,
              state_contract,api_contract,data_contract,evidence_contract,responsive_contract,
              accessibility_contract,security_contract)
            values('PROC','STEP','USER','/screen','Screen','ACTOR','[]','purpose','entry','exit',
              '[{"sectionId":"WORK"}]','[{"fieldCode":"name"}]',
              '[{"commandCode":"SAVE"}]','[{"state":"READY"}]',
              '[{"method":"POST","path":"/api/items"}]','[{"entity":"item"}]',
              '[{"evidence":"audit"}]','responsive','accessible','security')
            returning contract_id
            """,Long.class);
        jdbc.update("""
            insert into framework_screen_blueprint(
              process_code,step_code,actor_code,audience,route_path,page_id,page_name,screen_type,
              template_code,specification_json,source_reference,transition_status,validation_status)
            values('PROC','STEP','ACTOR','USER','/screen','PAGE','Screen','FORM','KRDS_FORM',
              '{"layout":"REGISTERED_LAYOUT","theme":"REGISTERED_THEME"}',?,
              'CONTRACT_LINKED','VALID')
            ""","framework_professional_screen_contract:"+contractId);
        jdbc.update("""
            insert into framework_permission_requirement_v1(
              process_code,step_code,permission_code,scope_type,resource_contract,guard_contract,use_at)
            values('PROC','STEP','ITEM_WRITE','PROJECT','{"resource":"item"}',
              '{"actor":"ACTOR"}','Y')
            """);
        jdbc.update("""
            insert into framework_step_execution_spec(
              process_code,step_code,actor_contract,business_contract,transition_contract,
              input_contract,output_contract,screen_contract,field_contract,command_contract,
              api_contract,persistence_contract,handoff_contract,test_contract,guide_contract,
              nonfunctional_contract,design_status,approval_status,generation_status,blocker_codes,
              source_hash,spec_version)
            values('PROC','STEP','{"actor":"ACTOR"}','{}','{}','{}','{}','[]',
              '{}','[]','[]','{}','{}','{}','{}','{}','DRAFT','PENDING','BLOCKED','[]',?,1)
            ""","a".repeat(64));
    }

    @Test
    void structuredDesignRefreshesExactSpecChangesHashAndQueuesOneStableJob(){
        String oldHash=sourceHash();
        Map<String,Object> first=direct();

        assertTrue(Boolean.TRUE.equals(first.get("generationQueued")));
        assertEquals(1,number(first,"jobCount"));
        assertEquals(1,number(first,"endpointExpected"));
        assertEquals(2,jdbc.queryForObject(
            "select jsonb_array_length(api_contract) from framework_step_execution_spec",
            Integer.class));
        assertEquals(1,jdbc.queryForObject("""
            select jsonb_array_length(
              framework_canonical_endpoint_catalog(5000,'PROC')->'endpoints')
            """,Integer.class));
        assertEquals(0,number(first,"publishCount"));
        assertNotEquals(oldHash,first.get("sourceHash"));
        assertEquals(first.get("sourceHash"),sourceHash());
        assertEquals(1,count("framework_development_job"));
        assertEquals(1,count("framework_process_artifact"));
        assertEquals("REGISTERED_LAYOUT",jdbc.queryForObject(
            "select screen_contract->0->>'layout' from framework_step_execution_spec",String.class));
        assertEquals("REGISTERED_THEME",jdbc.queryForObject(
            "select screen_contract->0->>'theme' from framework_step_execution_spec",String.class));
        assertEquals("KRDS_FORM",jdbc.queryForObject(
            "select screen_contract->0->>'templateCode' from framework_step_execution_spec",String.class));
        assertEquals("WORK",jdbc.queryForObject(
            "select screen_contract->0->'sections'->0->>'sectionId' from framework_step_execution_spec",String.class));
        assertEquals("SAVE",jdbc.queryForObject(
            "select command_contract->0->>'commandCode' from framework_step_execution_spec",String.class));
        assertEquals("ITEM_WRITE",jdbc.queryForObject(
            "select actor_contract->'permissions'->0->>'permissionCode' from framework_step_execution_spec",String.class));

        String stableHash=sourceHash();
        Map<String,Object> replay=direct();
        assertEquals(stableHash,replay.get("sourceHash"));
        assertEquals(1,count("framework_development_job"));
        assertEquals(1,count("framework_process_artifact"));
        verifyNoInteractions(runtime);
    }

    @Test
    void runtimePermissionGuardRequiresExactActiveAllowAndDenyWins(){
        SecurityException missing=assertThrows(SecurityException.class,
            ()->service.requireStepPermissionGrants("PROC","STEP","ACTOR"));
        assertTrue(missing.getMessage().contains("STEP_PERMISSION_DENIED"));

        jdbc.update("""
            insert into framework_permission_grant_v1(actor_code,permission_code,scope_type,effect,use_at)
            values('OTHER_ACTOR','ITEM_WRITE','PROJECT','ALLOW','Y')
            """);
        SecurityException wrongActor=assertThrows(SecurityException.class,
            ()->service.requireStepPermissionGrants("PROC","STEP","ACTOR"));
        assertTrue(wrongActor.getMessage().contains("STEP_PERMISSION_DENIED"));

        jdbc.update("""
            insert into framework_permission_grant_v1(actor_code,permission_code,scope_type,effect,use_at)
            values('ACTOR','ITEM_WRITE','PROJECT','ALLOW','Y')
            """);
        service.requireStepPermissionGrants("PROC","STEP","ACTOR");

        jdbc.update("""
            update framework_permission_grant_v1 set effect='DENY'
             where actor_code='ACTOR' and permission_code='ITEM_WRITE' and scope_type='PROJECT'
            """);
        SecurityException denied=assertThrows(SecurityException.class,
            ()->service.requireStepPermissionGrants("PROC","STEP","ACTOR"));
        assertTrue(denied.getMessage().contains("STEP_PERMISSION_DENIED"));

        jdbc.update("delete from framework_permission_requirement_v1");
        service.requireStepPermissionGrants("PROC","STEP","ACTOR");
    }

    @Test
    void malformedStructuredContractWritesNoSpecOrJob(){
        jdbc.update("update framework_professional_screen_contract set field_contract='not-json' where contract_id=?",contractId);
        String oldHash=sourceHash();
        assertThrows(DataAccessException.class,this::direct);
        assertEquals(oldHash,sourceHash());
        assertEquals(0,count("framework_development_job"));
        assertEquals(0,count("framework_process_artifact"));
    }

    @Test
    void nonObjectStructuredElementWritesNoSpecOrJob(){
        jdbc.update("update framework_professional_screen_contract set state_contract='[\"READY\"]' where contract_id=?",contractId);
        String oldHash=sourceHash();

        assertThrows(IllegalStateException.class,this::direct);

        assertEquals(oldHash,sourceHash());
        assertEquals(0,count("framework_development_job"));
        assertEquals(0,count("framework_process_artifact"));
    }

    @Test
    void unregisteredLayoutOrThemeCodeFailsClosed(){
        jdbc.update("""
            update framework_screen_blueprint
               set specification_json='{"layout":"body{display:none}","theme":"REGISTERED_THEME"}'
            """);
        String oldHash=sourceHash();

        assertThrows(IllegalStateException.class,this::direct);

        assertEquals(oldHash,sourceHash());
        assertEquals(0,count("framework_development_job"));
        assertEquals(0,count("framework_process_artifact"));
    }

    @Test
    void registeredButUngovernedLayoutCodeFailsClosed(){
        jdbc.update("insert into framework_screen_resource(route_key,layout_type) values('/lower','lower-layout')");
        jdbc.update("""
            update framework_screen_blueprint
               set specification_json='{"layout":"lower-layout","theme":"REGISTERED_THEME"}'
            """);
        String oldHash=sourceHash();

        assertThrows(IllegalStateException.class,this::direct);

        assertEquals(oldHash,sourceHash());
        assertEquals(0,count("framework_development_job"));
        assertEquals(0,count("framework_process_artifact"));
    }

    @Test
    void missingCodesUseExactRouteLayoutAndActiveKrdsDefaultTheme(){
        jdbc.update("update framework_screen_blueprint set specification_json='{}'");

        direct();

        assertEquals("REGISTERED_LAYOUT",jdbc.queryForObject(
            "select screen_contract->0->>'layout' from framework_step_execution_spec",String.class));
        assertEquals("KRDS_GOV_DEFAULT",jdbc.queryForObject(
            "select screen_contract->0->>'theme' from framework_step_execution_spec",String.class));
        assertEquals(1,count("framework_development_job"));
    }

    @Test
    void layoutOnlySaveChangesBothHeadsProjectsLayoutAndQueuesExactlyOneJob(){
        jdbc.update("insert into framework_screen_resource(route_key,layout_type) values('/alternate','ALT_REGISTERED_LAYOUT')");
        String beforeDesignHash=designHash();
        String beforeSourceHash=sourceHash();

        Map<String,Object> update=updateDesign(Map.of("layout","ALT_REGISTERED_LAYOUT"));
        String afterDesignHash=designHash();
        Map<String,Object> generation=direct();

        assertTrue(Boolean.TRUE.equals(update.get("changed")));
        assertEquals("ALT_REGISTERED_LAYOUT",update.get("layout"));
        assertEquals("REGISTERED_THEME",update.get("theme"));
        assertNotEquals(beforeDesignHash,afterDesignHash);
        assertEquals(afterDesignHash,generation.get("designHash"));
        assertNotEquals(beforeSourceHash,generation.get("sourceHash"));
        assertEquals("ALT_REGISTERED_LAYOUT",jdbc.queryForObject(
            "select screen_contract->0->>'layout' from framework_step_execution_spec",String.class));
        assertEquals("REGISTERED_THEME",jdbc.queryForObject(
            "select screen_contract->0->>'theme' from framework_step_execution_spec",String.class));
        assertEquals(1,count("framework_development_job"));
    }

    @Test
    void themeOnlySaveChangesBothHeadsProjectsThemeAndQueuesExactlyOneJob(){
        jdbc.update("insert into comtnthemedefinition(theme_id,use_at,is_active) values('ALT_REGISTERED_THEME','Y','Y')");
        String beforeDesignHash=designHash();
        String beforeSourceHash=sourceHash();

        Map<String,Object> update=updateDesign(Map.of("theme","ALT_REGISTERED_THEME"));
        String afterDesignHash=designHash();
        Map<String,Object> generation=direct();

        assertTrue(Boolean.TRUE.equals(update.get("changed")));
        assertEquals("REGISTERED_LAYOUT",update.get("layout"));
        assertEquals("ALT_REGISTERED_THEME",update.get("theme"));
        assertNotEquals(beforeDesignHash,afterDesignHash);
        assertEquals(afterDesignHash,generation.get("designHash"));
        assertNotEquals(beforeSourceHash,generation.get("sourceHash"));
        assertEquals("REGISTERED_LAYOUT",jdbc.queryForObject(
            "select screen_contract->0->>'layout' from framework_step_execution_spec",String.class));
        assertEquals("ALT_REGISTERED_THEME",jdbc.queryForObject(
            "select screen_contract->0->>'theme' from framework_step_execution_spec",String.class));
        assertEquals(1,count("framework_development_job"));
    }

    @Test
    void permissionOnlyRevisionChangesBothHeadsAndReusesOneJob(){
        Map<String,Object> first=direct();
        long jobId=((Number)first.get("jobId")).longValue();
        String oldDesignHash=String.valueOf(first.get("designHash"));
        String oldSourceHash=String.valueOf(first.get("sourceHash"));

        jdbc.update("update framework_professional_screen_contract set permission_codes='[\"SCREEN_WRITE\"]'::jsonb where contract_id=?",contractId);
        String newDesignHash=designHash();
        Map<String,Object> revision=direct();

        assertNotEquals(oldDesignHash,newDesignHash);
        assertEquals(newDesignHash,revision.get("designHash"));
        assertNotEquals(oldSourceHash,revision.get("sourceHash"));
        assertEquals(jobId,((Number)revision.get("jobId")).longValue());
        assertEquals(1,number(revision,"jobCount"));
        assertEquals(1,jdbc.queryForObject("""
            select count(*) from framework_step_execution_spec spec
            cross join lateral jsonb_array_elements(spec.actor_contract->'permissions') permission
            where permission->>'permissionCode'='SCREEN_WRITE'
              and permission->'guard'->>'actorCode'='ACTOR'
              and permission->'resource'->>'routePath'='/screen'
            """,Integer.class));
    }

    @Test
    void concurrentSameSavePreservesRunningLeaseAndOneJob(){
        direct();
        jdbc.update("""
            update framework_development_job set job_status='RUNNING',worker_id='worker-1',
              lease_token='lease-1',lease_until=current_timestamp+interval '5 minutes'
            """);
        jdbc.update("""
            update framework_process_artifact
               set delivery_status='IN_PROGRESS',evidence_ref='worker:lease-1'
            """);
        String sourceHash=sourceHash();

        Map<String,Object> replay=direct();

        assertTrue(Boolean.TRUE.equals(replay.get("generationQueued")));
        assertEquals(sourceHash,replay.get("sourceHash"));
        assertEquals(1,count("framework_development_job"));
        assertEquals("RUNNING",jdbc.queryForObject(
            "select job_status from framework_development_job",String.class));
        assertEquals("worker-1",jdbc.queryForObject(
            "select worker_id from framework_development_job",String.class));
        assertEquals("lease-1",jdbc.queryForObject(
            "select lease_token from framework_development_job",String.class));
        assertEquals("IN_PROGRESS",jdbc.queryForObject(
            "select delivery_status from framework_process_artifact",String.class));
        assertEquals("worker:lease-1",jdbc.queryForObject(
            "select evidence_ref from framework_process_artifact",String.class));
    }

    @Test
    void consecutiveLayoutAndThemeRevisionsReuseOneRowAndInvalidateOldLease(){
        jdbc.update("insert into framework_screen_resource(route_key,layout_type) values('/alternate','ALT_REGISTERED_LAYOUT')");
        jdbc.update("insert into comtnthemedefinition(theme_id,use_at,is_active) values('ALT_REGISTERED_THEME','Y','Y')");
        updateDesign(Map.of("layout","ALT_REGISTERED_LAYOUT"));
        Map<String,Object> revisionOne=direct();
        long jobId=((Number)revisionOne.get("jobId")).longValue();
        String oldSourceHash=String.valueOf(revisionOne.get("sourceHash"));
        String oldDesignHash=String.valueOf(revisionOne.get("designHash"));
        String oldSpecification=jdbc.queryForObject(
            "select specification_json from framework_development_job where job_id=?",String.class,jobId);
        jdbc.update("""
            update framework_development_job set job_status='RUNNING',worker_id='old-worker',
              lease_token='old-lease',lease_until=current_timestamp+interval '5 minutes',
              attempt_count=2,started_at=current_timestamp,result_json='{"old":true}',
              evidence_ref='old-evidence',rollback_ref='old-rollback',quality_report='{"old":true}'
             where job_id=?
            """,jobId);
        jdbc.update("""
            insert into framework_development_job_gate_result(job_id,gate_code,result)
            values(?,'OLD_GATE','PASSED')
            """,jobId);

        updateDesign(Map.of("theme","ALT_REGISTERED_THEME"));
        Map<String,Object> revisionTwo=direct();

        assertEquals(jobId,((Number)revisionTwo.get("jobId")).longValue());
        assertEquals(1,number(revisionTwo,"jobCount"));
        assertEquals(count("framework_development_job"),number(revisionTwo,"jobCount"));
        assertNotEquals(oldSourceHash,revisionTwo.get("sourceHash"));
        assertNotEquals(oldDesignHash,revisionTwo.get("designHash"));
        assertNotEquals(oldSpecification,jdbc.queryForObject(
            "select specification_json from framework_development_job where job_id=?",String.class,jobId));
        assertEquals(revisionTwo.get("sourceHash"),jdbc.queryForObject(
            "select specification_json::jsonb->>'sourceHash' from framework_development_job where job_id=?",
            String.class,jobId));
        assertEquals(revisionTwo.get("designHash"),jdbc.queryForObject(
            "select specification_json::jsonb->>'designHash' from framework_development_job where job_id=?",
            String.class,jobId));
        assertEquals("PLANNED",jdbc.queryForObject(
            "select job_status from framework_development_job where job_id=?",String.class,jobId));
        assertEquals(0,jdbc.queryForObject(
            "select count(*) from framework_development_job where job_id=? and lease_token='old-lease'",
            Integer.class,jobId));
        assertEquals(0,jdbc.queryForObject(
            "select count(*) from framework_development_job_gate_result where job_id=?",Integer.class,jobId));
        assertThrows(IllegalArgumentException.class,()->service.completeDevelopmentJob(Map.of(
            "jobId",jobId,"leaseToken","old-lease","result","VERIFIED"),"old-worker"));
        assertEquals("PLANNED",jdbc.queryForObject(
            "select job_status from framework_development_job where job_id=?",String.class,jobId));
    }

    @Test
    void sameCompletedRevisionIsUnchangedAndKeepsOneActualRow(){
        Map<String,Object> first=direct();
        long jobId=((Number)first.get("jobId")).longValue();
        jdbc.update("update framework_development_job set job_status='COMPLETED',quality_status='VERIFIED' where job_id=?",jobId);

        Map<String,Object> replay=direct();

        assertEquals("UNCHANGED",replay.get("status"));
        assertEquals(false,replay.get("generationQueued"));
        assertEquals(1,number(replay,"jobCount"));
        assertEquals(count("framework_development_job"),number(replay,"jobCount"));
        assertEquals("COMPLETED",jdbc.queryForObject(
            "select job_status from framework_development_job where job_id=?",String.class,jobId));
    }

    @Test
    void sameHeadExhaustedFailureOrBlockResetsOneJobAndWorkerClaimsExactNewAttempt(){
        Map<String,Object> first=direct();
        long jobId=((Number)first.get("jobId")).longValue();
        jdbc.update("""
            update framework_development_job
               set job_status='FAILED',quality_status='FAILED',attempt_count=max_attempts,
                   completed_at=current_timestamp,result_json='{"failed":true}',
                   evidence_ref='failed-evidence',last_error='worker failed'
             where job_id=?
            """,jobId);
        jdbc.update("""
            insert into framework_development_job_gate_result(job_id,gate_code,result)
            values(?,'FAILED_GATE','FAILED')
            """,jobId);

        Map<String,Object> recovered=direct();

        assertEquals("QUEUED",recovered.get("status"));
        assertEquals(true,recovered.get("recoveryReset"));
        assertEquals(true,recovered.get("workerCanProgress"));
        assertEquals(0,number(recovered,"jobAttemptCount"));
        assertEquals(1,count("framework_development_job"));
        assertEquals(0,jdbc.queryForObject(
            "select count(*) from framework_development_job_gate_result where job_id=?",
            Integer.class,jobId));
        assertEquals("PLANNED",jdbc.queryForObject(
            "select job_status from framework_development_job where job_id=?",String.class,jobId));
        assertEquals(0,jdbc.queryForObject(
            "select attempt_count from framework_development_job where job_id=?",Integer.class,jobId));

        Map<String,Object> claim=transaction.execute(status->
            service.claimDevelopmentJob("retry-worker"));
        assertEquals(true,claim.get("available"));
        assertEquals(jobId,((Number)claim.get("jobId")).longValue());
        assertEquals(1,((Number)claim.get("attemptCount")).intValue());
        assertEquals("RUNNING",claim.get("jobStatus"));
        assertEquals(1,jdbc.queryForObject(
            "select attempt_count from framework_development_job where job_id=?",Integer.class,jobId));

        jdbc.update("""
            update framework_development_job
               set job_status='BLOCKED',quality_status='FAILED',attempt_count=max_attempts,
                   lease_token=null,lease_until=null,last_error='quality gate blocked'
             where job_id=?
            """,jobId);
        Map<String,Object> recoveredBlock=direct();
        assertEquals("QUEUED",recoveredBlock.get("status"));
        assertEquals(true,recoveredBlock.get("recoveryReset"));
        assertEquals(true,recoveredBlock.get("workerCanProgress"));
        assertEquals("PLANNED",jdbc.queryForObject(
            "select job_status from framework_development_job where job_id=?",String.class,jobId));
        assertEquals(0,jdbc.queryForObject(
            "select attempt_count from framework_development_job where job_id=?",Integer.class,jobId));
    }

    @Test
    void completedJobIsReopenedInPlaceForANewDesignRevision(){
        jdbc.update("insert into comtnthemedefinition(theme_id,use_at,is_active) values('ALT_REGISTERED_THEME','Y','Y')");
        Map<String,Object> first=direct();
        long jobId=((Number)first.get("jobId")).longValue();
        String oldSourceHash=String.valueOf(first.get("sourceHash"));
        jdbc.update("update framework_development_job set job_status='COMPLETED',quality_status='VERIFIED' where job_id=?",jobId);

        updateDesign(Map.of("theme","ALT_REGISTERED_THEME"));
        Map<String,Object> revision=direct();

        assertEquals(jobId,((Number)revision.get("jobId")).longValue());
        assertNotEquals(oldSourceHash,revision.get("sourceHash"));
        assertEquals(true,revision.get("generationQueued"));
        assertEquals(1,number(revision,"jobCount"));
        assertEquals(count("framework_development_job"),number(revision,"jobCount"));
        assertEquals("PLANNED",jdbc.queryForObject(
            "select job_status from framework_development_job where job_id=?",String.class,jobId));
        assertEquals("PENDING",jdbc.queryForObject(
            "select quality_status from framework_development_job where job_id=?",String.class,jobId));
    }

    @Test
    void twoStepProcessUsesOneCoordinatorJobAndOneInputHashAcrossRevisions(){
        long secondContract=seedSecondStep();

        Map<String,Object> first=direct();
        assertEquals("SKIPPED",first.get("status"));
        assertEquals(false,first.get("generationQueued"));
        assertEquals(2,number(first,"processStepCount"));
        assertEquals(1,number(first,"generationReadyStepCount"));
        assertEquals(1,number(first,"skippedStepCount"));
        assertEquals(0,count("framework_development_job"));

        Map<String,Object> second=direct("STEP_B","/screen-b");
        long jobId=((Number)second.get("jobId")).longValue();
        String secondHash=String.valueOf(second.get("processInputHash"));
        assertEquals(2,number(second,"generationReadyStepCount"));
        assertEquals(2,number(second,"endpointExpected"));
        assertEquals(1,count("framework_development_job"));
        assertEquals(1,jdbc.queryForObject(
            "select count(distinct source_hash) from framework_step_execution_spec",Integer.class));
        assertEquals(secondHash,jdbc.queryForObject(
            "select min(source_hash) from framework_step_execution_spec",String.class));

        jdbc.update("insert into comtnthemedefinition(theme_id,use_at,is_active) values('STEP_B_THEME','Y','Y')");
        jdbc.update("""
            update framework_screen_blueprint
               set specification_json='{"layout":"REGISTERED_LAYOUT","theme":"STEP_B_THEME"}'
             where step_code='STEP_B'
            """);
        Map<String,Object> third=direct("STEP_B","/screen-b");

        assertEquals(jobId,((Number)third.get("jobId")).longValue());
        assertNotEquals(secondHash,third.get("processInputHash"));
        assertEquals(1,number(third,"jobCount"));
        assertEquals(1,count("framework_development_job"));
        assertEquals("STEP",jdbc.queryForObject(
            "select step_code from framework_development_job",String.class));
        assertEquals(2,jdbc.queryForObject("""
            select count(*) from framework_step_execution_spec
             where source_hash=(select specification_json::jsonb->>'processInputHash'
                                  from framework_development_job)
            """,Integer.class));
        assertEquals("STEP_B_THEME",jdbc.queryForObject("""
            select screen_contract->0->>'theme' from framework_step_execution_spec
             where step_code='STEP_B'
            """,String.class));
        assertEquals(secondContract,jdbc.queryForObject(
            "select contract_id from framework_professional_screen_contract where step_code='STEP_B'",
            Long.class));
    }

    @Test
    void processInputExcludesVolatileTimestampsAndBindsCatalogHashes(){
        direct();
        long started=System.nanoTime();
        String plan=transaction.execute(status->{
            jdbc.execute("set local statement_timeout='5s'");
            return jdbc.queryForObject("""
                explain (analyze,buffers,format json)
                select framework_process_generation_input('PROC')
                """,String.class);
        });
        long elapsedMillis=(System.nanoTime()-started)/1_000_000L;
        assertTrue(elapsedMillis<5_000,"process input exceeded 5 seconds: "+elapsedMillis);
        assertTrue(plan!=null&&!plan.matches(
            "(?s).*\\\"Temp (?:Read|Written) Blocks\\\": [1-9][0-9]*.*"),plan);
        Map<String,Object> before=jdbc.queryForMap("""
            select head->>'processInputHash' as "processInputHash",
                   head->>'designCatalogHash' as "designCatalogHash",
                   head->>'endpointCatalogHash' as "endpointCatalogHash"
              from (select framework_process_generation_input('PROC') head) input
            """);

        jdbc.update("update framework_process_definition set updated_at=current_timestamp+interval '1 day'");
        jdbc.update("update framework_step_execution_spec set updated_at=current_timestamp+interval '1 day'");
        Map<String,Object> timestampOnly=jdbc.queryForMap("""
            select head->>'processInputHash' as "processInputHash"
              from (select framework_process_generation_input('PROC') head) input
            """);
        assertEquals(before.get("processInputHash"),timestampOnly.get("processInputHash"));

        jdbc.update("update framework_professional_screen_contract set api_contract='[{\"method\":\"PUT\",\"path\":\"/api/items/{id}\"}]' where contract_id=?",contractId);
        Map<String,Object> after=direct();
        assertNotEquals(before.get("processInputHash"),after.get("processInputHash"));
        assertNotEquals(before.get("designCatalogHash"),after.get("designCatalogHash"));
        assertNotEquals(before.get("endpointCatalogHash"),after.get("endpointCatalogHash"));
    }

    @Test
    void duplicateBlueprintRequiresExactlyOneExplicitAuthority(){
        jdbc.update("""
            insert into framework_screen_blueprint(
              process_code,step_code,actor_code,audience,route_path,page_id,page_name,screen_type,
              template_code,specification_json,source_reference,transition_status,validation_status)
            select process_code,step_code,actor_code,audience,route_path,'DUP',page_name,screen_type,
              template_code,specification_json,null,'CONTRACT_LINKED',validation_status
              from framework_screen_blueprint where page_id='PAGE'
            """);
        direct();
        assertEquals(1,count("framework_development_job"));

        resetGenerationState();
        jdbc.update("update framework_screen_blueprint set source_reference=null");
        assertThrows(DataAccessException.class,this::direct);
        assertEquals("a".repeat(64),sourceHash());
        assertEquals(0,count("framework_development_job"));

        jdbc.update("update framework_screen_blueprint set source_reference=?,transition_status='CONTRACT_LINKED'",
            "PROFESSIONAL_SCREEN_CONTRACT:"+contractId);
        assertThrows(DataAccessException.class,this::direct);
        assertEquals("a".repeat(64),sourceHash());
        assertEquals(0,count("framework_development_job"));
    }

    @Test
    void downstreamJobFailureRollsBackSpecAndPublishesNothing(){
        jdbc.execute("""
            create or replace function reject_generation_job() returns trigger language plpgsql as $$
            begin raise exception 'TEST_JOB_REJECTED'; end $$
            """);
        jdbc.execute("create trigger reject_generation_job before insert on framework_development_job for each row execute function reject_generation_job()");
        String oldHash=sourceHash();

        assertThrows(DataAccessException.class,this::direct);

        assertEquals(oldHash,sourceHash());
        assertEquals("DRAFT",jdbc.queryForObject(
            "select design_status from framework_step_execution_spec",String.class));
        assertEquals(0,count("framework_development_job"));
        assertEquals(0,count("framework_process_artifact"));
        verifyNoInteractions(runtime);
    }

    private Map<String,Object> direct(){
        return direct("STEP","/screen");
    }

    private Map<String,Object> direct(String step,String route){
        return transaction.execute(status->service.executeDesignDirectDevelopment(Map.of(
            "processCode","PROC","stepCode",step,"audience","USER",
            "routePath",route,"designHash",designHash(step,route)),"ADMIN"));
    }

    private Map<String,Object> updateDesign(Map<String,Object> values){
        return transaction.execute(status->service.updateProfessionalBlueprintDesign(contractId,values));
    }

    private String designHash(){
        return designHash("STEP","/screen");
    }

    private String designHash(String step,String route){
        return jdbc.queryForObject(
            "select framework_canonical_screen_bundle('PROC',?,'USER',?)->>'designHash'",
            String.class,step,route);
    }

    private long seedSecondStep(){
        jdbc.update("insert into framework_screen_resource(route_key,layout_type) values('/screen-b','REGISTERED_LAYOUT')");
        jdbc.update("""
            insert into framework_process_step(
              process_code,step_code,step_order,actor_code,command_code,from_state,to_state,
              requires_api,api_contract,user_path)
            values('PROC','STEP_B',2,'ACTOR','SAVE_B','READY','DONE',true,
              'POST /api/items-b','/screen-b')
            """);
        long secondContract=jdbc.queryForObject("""
            insert into framework_professional_screen_contract(
              process_code,step_code,audience,route_path,screen_name,actor_code,permission_codes,business_purpose,
              entry_condition,exit_condition,section_contract,field_contract,command_contract,
              state_contract,api_contract,data_contract,evidence_contract,responsive_contract,
              accessibility_contract,security_contract)
            values('PROC','STEP_B','USER','/screen-b','Screen B','ACTOR','[]','purpose B','entry','exit',
              '[{"sectionId":"WORK_B"}]','[{"fieldCode":"nameB"}]',
              '[{"commandCode":"SAVE_B"}]','[{"state":"READY"}]',
              '[{"method":"POST","path":"/api/items-b"}]','[{"entity":"itemB"}]',
              '[{"evidence":"audit"}]','responsive','accessible','security') returning contract_id
            """,Long.class);
        jdbc.update("""
            insert into framework_screen_blueprint(
              process_code,step_code,actor_code,audience,route_path,page_id,page_name,screen_type,
              template_code,specification_json,source_reference,transition_status,validation_status)
            values('PROC','STEP_B','ACTOR','USER','/screen-b','PAGE_B','Screen B','FORM','KRDS_FORM',
              '{"layout":"REGISTERED_LAYOUT","theme":"REGISTERED_THEME"}',?,
              'CONTRACT_LINKED','VALID')
            ""","framework_professional_screen_contract:"+secondContract);
        jdbc.update("""
            insert into framework_step_execution_spec(
              process_code,step_code,actor_contract,business_contract,transition_contract,
              input_contract,output_contract,screen_contract,field_contract,command_contract,
              api_contract,persistence_contract,handoff_contract,test_contract,guide_contract,
              nonfunctional_contract,design_status,approval_status,generation_status,blocker_codes,
              source_hash,spec_version)
            values('PROC','STEP_B','{"actor":"ACTOR"}','{}','{}','{}','{}','[]',
              '{}','[]','[]','{}','{}','{}','{}','{}','DRAFT','PENDING','BLOCKED','[]',?,1)
            ""","b".repeat(64));
        return secondContract;
    }

    private void resetGenerationState(){
        jdbc.execute("truncate framework_development_job_event,framework_development_job_gate_result,"+
            "framework_development_job,framework_process_artifact restart identity");
        jdbc.update("""
            update framework_step_execution_spec set screen_contract='[]',field_contract='{}',
              command_contract='[]',api_contract='[]',actor_contract='{"actor":"ACTOR"}',
              design_status='DRAFT',approval_status='PENDING',generation_status='BLOCKED',
              source_hash=?,spec_version=1
            ""","a".repeat(64));
    }

    private String sourceHash(){
        return jdbc.queryForObject("select source_hash from framework_step_execution_spec",String.class);
    }

    private int count(String table){
        return jdbc.queryForObject("select count(*) from "+table,Integer.class);
    }

    private static int number(Map<String,Object> row,String key){
        return ((Number)row.get(key)).intValue();
    }

    private void createSchema(){
        jdbc.execute("""
            create table framework_professional_screen_contract(
              contract_id bigserial primary key,process_code text not null,step_code text not null,
              audience text not null,route_path text not null,screen_name text,actor_code text not null,
              permission_codes jsonb not null default '[]',business_purpose text,
              entry_condition text,exit_condition text,section_contract text,field_contract text,
              command_contract text,state_contract text,api_contract text,data_contract text,
              evidence_contract text,responsive_contract text,accessibility_contract text,
              security_contract text)
            """);
        jdbc.execute("""
            create table framework_screen_blueprint(
              blueprint_id bigserial primary key,process_code text not null,step_code text not null,
              actor_code text not null,audience text not null,route_path text not null,page_id text,page_name text,
              screen_type text,template_code text,specification_json text,source_reference text,
              transition_status text,validation_status text,
              updated_at timestamp default current_timestamp)
            """);
        jdbc.execute("create table framework_screen_resource(route_key text primary key,layout_type text not null)");
        jdbc.execute("create table comtnthemedefinition(theme_id text primary key,use_at char(1),is_active char(1))");
        jdbc.execute("""
            create table framework_permission_requirement_v1(
              process_code text,step_code text,permission_code text,scope_type text,
              resource_contract jsonb,guard_contract jsonb,use_at char(1))
            """);
        jdbc.execute("""
            create table framework_permission_grant_v1(
              actor_code text,permission_code text,scope_type text,effect text,use_at char(1),
              primary key(actor_code,permission_code,scope_type))
            """);
        jdbc.execute("""
            create function framework_step_permission_requirements(requested_process text,requested_step text)
            returns jsonb language sql stable as $$
              with requirements as (
                select 0 source_order,permission_code,scope_type,
                       resource_contract resource_value,guard_contract guard_value
                  from framework_permission_requirement_v1
                 where process_code=requested_process and step_code=requested_step and use_at='Y'
                union all
                select 1,upper(permission.value),'PROJECT',
                       jsonb_build_object('routePath',lower(split_part(route_path,'?',1)),
                         'audience',upper(audience),'contractId',contract_id),
                       jsonb_build_object('actorCode',upper(actor_code),
                         'source','PROFESSIONAL_SCREEN_CONTRACT')
                  from framework_professional_screen_contract contract
                  cross join lateral jsonb_array_elements_text(permission_codes) permission(value)
                 where process_code=requested_process and step_code=requested_step
                   and not exists(select 1 from framework_permission_requirement_v1 normalized
                     where normalized.process_code=requested_process
                       and normalized.step_code=requested_step
                       and normalized.permission_code=upper(permission.value)
                       and normalized.scope_type='PROJECT' and normalized.use_at='Y')
              )
              select coalesce(jsonb_agg(jsonb_build_object(
                'permissionCode',permission_code,'scope',scope_type,
                'resource',resource_value,'guard',guard_value)
                order by source_order,permission_code,scope_type),'[]'::jsonb)
                from requirements
            $$
            """);
        jdbc.execute("""
            create function framework_authorize_step_permissions(
              requested_process text,requested_step text,requested_actor text,
              requested_route text,requested_audience text)
            returns boolean language sql stable as $$
              select not exists(
                select 1 from framework_permission_requirement_v1 requirement
                 where requirement.process_code=requested_process
                   and requirement.step_code=requested_step and requirement.use_at='Y'
                   and (exists(select 1 from framework_permission_grant_v1 denied_grant
                     where denied_grant.actor_code=requested_actor
                       and denied_grant.permission_code=requirement.permission_code
                       and denied_grant.scope_type=requirement.scope_type
                       and denied_grant.effect='DENY' and denied_grant.use_at='Y')
                     or not exists(select 1 from framework_permission_grant_v1 allowed_grant
                     where allowed_grant.actor_code=requested_actor
                       and allowed_grant.permission_code=requirement.permission_code
                       and allowed_grant.scope_type=requirement.scope_type
                       and allowed_grant.effect='ALLOW' and allowed_grant.use_at='Y')))
                and not exists(
                  select 1 from framework_professional_screen_contract contract
                  cross join lateral jsonb_array_elements_text(permission_codes) permission(value)
                 where contract.process_code=requested_process
                   and contract.step_code=requested_step
                   and not exists(select 1 from framework_permission_requirement_v1 normalized
                     where normalized.process_code=requested_process
                       and normalized.step_code=requested_step
                       and normalized.permission_code=upper(permission.value)
                       and normalized.scope_type='PROJECT' and normalized.use_at='Y')
                   and (requested_route='' or (
                     lower(split_part(contract.route_path,'?',1))=lower(split_part(requested_route,'?',1))
                     and upper(contract.audience)=upper(requested_audience)))
                   and (exists(select 1 from framework_permission_grant_v1 denied_grant
                     where denied_grant.actor_code=requested_actor
                       and denied_grant.permission_code=upper(permission.value)
                       and denied_grant.scope_type='PROJECT'
                       and denied_grant.effect='DENY' and denied_grant.use_at='Y')
                     or (upper(contract.actor_code)<>requested_actor
                       and not exists(select 1 from framework_permission_grant_v1 allowed_grant
                         where allowed_grant.actor_code=requested_actor
                           and allowed_grant.permission_code=upper(permission.value)
                           and allowed_grant.scope_type='PROJECT'
                           and allowed_grant.effect='ALLOW' and allowed_grant.use_at='Y'))))
            $$
            """);
        jdbc.execute("""
            create function framework_authorize_step_permissions(
              requested_process text,requested_step text,requested_actor text)
            returns boolean language sql stable as $$
              select framework_authorize_step_permissions(
                requested_process,requested_step,requested_actor,'','')
            $$
            """);
        jdbc.execute("""
            create table framework_process_definition(
              process_code text primary key,process_name text not null,goal text not null,
              definition_locked boolean not null default true,
              created_at timestamp default current_timestamp,updated_at timestamp default current_timestamp)
            """);
        jdbc.update("insert into framework_process_definition(process_code,process_name,goal) values('PROC','Process','goal')");
        jdbc.execute("""
            create table framework_process_step(
              process_code text,step_code text,step_order integer not null,actor_code text,
              command_code text,from_state text,to_state text,
              requires_api boolean not null default false,api_contract text,
              user_path text,admin_path text,
              requires_user_page boolean not null default true,
              requires_admin_page boolean not null default false,
              primary key(process_code,step_code))
            """);
        jdbc.execute("""
            create table framework_step_execution_spec(
              process_code text,step_code text,actor_contract jsonb,business_contract jsonb,
              transition_contract jsonb,input_contract jsonb,output_contract jsonb,screen_contract jsonb,
              field_contract jsonb,command_contract jsonb,api_contract jsonb,persistence_contract jsonb,
              handoff_contract jsonb,test_contract jsonb,guide_contract jsonb,nonfunctional_contract jsonb,
              design_status text,approval_status text,generation_status text,blocker_codes jsonb,
              approved_by text,approved_at timestamp,updated_at timestamp default current_timestamp,
              source_hash text,spec_version integer,primary key(process_code,step_code))
            """);
        jdbc.execute("""
            create table framework_development_job(
              job_id bigserial primary key,process_code text,step_code text,job_type text,job_name text,
              target_path text,specification_json text,job_status text,approval_status text,
              execution_mode text,job_group_code text,required boolean,progress_weight integer,
              max_attempts integer,quality_status text,created_by text,worker_id text,lease_token text,
              lease_until timestamp,attempt_count integer not null default 0,started_at timestamp,
              completed_at timestamp,result_json text not null default '{}',evidence_ref text,
              rollback_ref text,last_error text,quality_report text not null default '{}',
              updated_at timestamp default current_timestamp)
            """);
        jdbc.execute("""
            create table framework_development_job_event(
              event_id bigserial primary key,
              job_id bigint not null references framework_development_job(job_id) on delete cascade,
              event_type text not null,from_status text,to_status text not null,
              worker_id text,detail_json text not null default '{}',
              created_at timestamp not null default current_timestamp)
            """);
        jdbc.execute("""
            create table framework_development_phase(
              job_type text primary key,phase_order integer,active_yn text)
            """);
        jdbc.execute("""
            create table framework_development_job_dependency(
              job_id bigint,depends_on_job_id bigint,dependency_type text)
            """);
        jdbc.execute("""
            create table framework_development_job_gate_result(
              result_id bigserial primary key,job_id bigint not null references framework_development_job(job_id),
              gate_code text not null,result text not null)
            """);
        try{
            String migration=Files.readString(findRepositoryFile(CANONICAL_JOB_MIGRATION))
                .replace("public.",schema+".")
                .replace("search_path = pg_catalog, public","search_path = pg_catalog, "+schema);
            jdbc.execute(migration);
        }catch(java.io.IOException error){
            throw new IllegalStateException("canonical job migration cannot be read",error);
        }
        jdbc.execute("""
            create table framework_process_artifact(
              artifact_id bigserial primary key,process_code text,step_code text,artifact_code text,
              artifact_type text,artifact_name text,target_path text,contract_ref text,required boolean,
              delivery_status text,owner_actor_code text,acceptance_criteria text,notes text,
              evidence_ref text,updated_at timestamp default current_timestamp)
            """);
        jdbc.execute("""
            create or replace function framework_try_jsonb(value text) returns jsonb
            language plpgsql immutable as $$
            begin return value::jsonb; exception when others then return null; end $$
            """);
        jdbc.execute("""
            create or replace function framework_merge_primary_contract_marker(
              existing_contract jsonb,requested_marker_type text,requested_marker jsonb)
            returns jsonb language plpgsql immutable as $$
            declare source_contract jsonb:=coalesce(existing_contract,'[]'::jsonb);
            declare retained_contract jsonb;
            begin
              if requested_marker_type is null
                 or requested_marker_type<>btrim(requested_marker_type)
                 or requested_marker_type!~'^[A-Z][A-Z0-9_]{1,79}$'
                 or jsonb_typeof(source_contract)<>'array'
                 or (requested_marker is not null
                   and jsonb_typeof(requested_marker)<>'object') then
                raise exception 'invalid canonical contract marker' using errcode='22023';
              end if;
              select coalesce(jsonb_agg(item.value order by item.ordinality),'[]'::jsonb)
                into retained_contract
                from jsonb_array_elements(source_contract)
                  with ordinality item(value,ordinality)
               where (jsonb_typeof(item.value)='object'
                 and item.value->>'markerType'=requested_marker_type) is not true;
              if requested_marker is null then return retained_contract; end if;
              return retained_contract||jsonb_build_array(requested_marker||
                jsonb_build_object('markerType',requested_marker_type,'primary',true));
            end $$
            """);
        jdbc.execute("""
            create or replace function framework_strict_jsonb_array(value text) returns jsonb
            language plpgsql immutable as $$
            declare parsed jsonb;
            begin
              parsed:=value::jsonb;
              if jsonb_typeof(parsed)<>'array' then raise exception 'JSON_ARRAY_REQUIRED'; end if;
              return parsed;
            end $$
            """);
        jdbc.execute("""
            create or replace function framework_canonical_screen_bundle(
              requested_process text,requested_step text,requested_audience text,requested_route text)
            returns jsonb language plpgsql stable as $$
            declare selected_id bigint; selected_count integer; design_hash text;
            begin
              with candidates as materialized (
                select b.blueprint_id,c.contract_id,
                       (b.transition_status='CONTRACT_LINKED' and lower(b.source_reference) in(
                         'framework_professional_screen_contract:'||c.contract_id,
                         'professional_screen_contract:'||c.contract_id)) explicit_link,
                       count(*) over(partition by c.contract_id) candidate_count,
                       count(*) filter(where b.transition_status='CONTRACT_LINKED'
                         and lower(b.source_reference) in(
                           'framework_professional_screen_contract:'||c.contract_id,
                           'professional_screen_contract:'||c.contract_id))
                         over(partition by c.contract_id) explicit_count
                  from framework_screen_blueprint b
                  join framework_professional_screen_contract c
                    on c.process_code=b.process_code and c.step_code=b.step_code
                   and upper(c.audience)=upper(b.audience)
                   and lower(split_part(c.route_path,'?',1))=lower(split_part(b.route_path,'?',1))
                 where b.process_code=requested_process and b.step_code=requested_step
                   and upper(b.audience)=upper(requested_audience)
                   and lower(split_part(b.route_path,'?',1))=lower(split_part(requested_route,'?',1))
                   and b.validation_status='VALID'
              ), authority as (
                select blueprint_id from candidates
                 where (explicit_count=1 and explicit_link)
                    or (explicit_count=0 and candidate_count=1)
              )
              select count(*),min(blueprint_id) into selected_count,selected_id from authority;
              if selected_count<>1 then raise exception 'CANONICAL_SCREEN_IDENTITY_NOT_EXACT'; end if;
              select encode(sha256(convert_to(concat_ws('|',b.blueprint_id,b.template_code,
                       b.specification_json,c.section_contract,c.field_contract,c.command_contract,
                       c.state_contract,c.api_contract,c.data_contract,c.evidence_contract,
                       c.actor_code,c.permission_codes::text),'UTF8')),'hex')
                into design_hash
                from framework_screen_blueprint b
                join framework_professional_screen_contract c
                  on c.process_code=b.process_code and c.step_code=b.step_code
                 and upper(c.audience)=upper(b.audience)
                 and lower(split_part(c.route_path,'?',1))=lower(split_part(b.route_path,'?',1))
               where b.blueprint_id=selected_id;
              return jsonb_build_object('designHash',design_hash);
            end $$
            """);
        jdbc.execute("""
            create function framework_canonical_design_catalog(requested_limit integer,requested_process text)
            returns jsonb language sql stable as $$
              with screens as materialized (
                select c.step_code,upper(c.audience) audience,
                       lower(split_part(c.route_path,'?',1)) route_path,
                       upper(c.process_code)||'|'||upper(c.step_code)||'|'||upper(c.audience)||'|'||
                         lower(split_part(c.route_path,'?',1)) screen_key,
                       framework_canonical_screen_bundle(c.process_code,c.step_code,c.audience,c.route_path)
                         ->>'designHash' design_hash
                  from framework_professional_screen_contract c
                 where c.process_code=requested_process
              ), aggregate as (
                select encode(sha256(convert_to(string_agg(
                         screen_key||E'\\x1f'||design_hash,E'\\n' order by screen_key),'UTF8')),'hex') catalog_hash,
                       jsonb_agg(jsonb_build_object('screenKey',screen_key,'stepCode',step_code,
                         'audience',audience,'routePath',route_path,'designHash',design_hash)
                         order by screen_key) screens
                  from screens
              )
              select jsonb_build_object('schema','carbonet.canonical-design/v1',
                       'catalogHash',catalog_hash,'screens',screens) from aggregate
            $$
            """);
        jdbc.execute("""
            create function framework_canonical_endpoint_readiness(requested_limit integer,requested_process text)
            returns jsonb language sql stable as $$
              select jsonb_build_object('schema','carbonet.canonical-endpoint-readiness/v1',
                'status','COMPLETE')
            $$
            """);
        jdbc.execute("""
            create function framework_canonical_endpoint_catalog(requested_limit integer,requested_process text)
            returns jsonb language sql stable as $$
              with endpoints as materialized (
                select upper(c.process_code)||'|'||upper(c.step_code)||'|'||upper(c.audience)||'|'||
                         lower(split_part(c.route_path,'?',1)) screen_key,
                       encode(sha256(convert_to(
                         framework_canonical_screen_bundle(c.process_code,c.step_code,c.audience,c.route_path)
                           ->>'designHash'||E'\\x1f'||c.api_contract,'UTF8')),'hex') endpoint_hash
                  from framework_professional_screen_contract c
                 where c.process_code=requested_process
              ), aggregate as (
                select encode(sha256(convert_to(string_agg(
                         screen_key||E'\\x1f'||endpoint_hash,E'\\n' order by screen_key),'UTF8')),'hex') catalog_hash,
                       jsonb_agg(jsonb_build_object('screenKey',screen_key,'endpointHash',endpoint_hash)
                         order by screen_key) endpoints
                  from endpoints
              )
              select jsonb_build_object('schema','carbonet.canonical-endpoint-catalog/v1',
                       'catalogHash',catalog_hash,'endpoints',endpoints) from aggregate
            $$
            """);
        jdbc.execute("""
            create function framework_source_canonical_design_catalog(
              requested_limit integer,requested_process text)
            returns jsonb language sql stable as $$
              select framework_canonical_design_catalog(requested_limit,requested_process)
            $$
            """);
        jdbc.execute("""
            create function framework_source_canonical_endpoint_readiness(
              requested_limit integer,requested_process text)
            returns jsonb language sql stable as $$
              select framework_canonical_endpoint_readiness(requested_limit,requested_process)
            $$
            """);
        jdbc.execute("""
            create function framework_source_canonical_endpoint_catalog(
              requested_limit integer,requested_process text)
            returns jsonb language sql stable as $$
              select framework_canonical_endpoint_catalog(requested_limit,requested_process)
            $$
            """);
        jdbc.execute("""
            create function framework_refresh_process_execution_specs(
              requested_process text,requested_actor text)
            returns jsonb language sql as $$
              select jsonb_build_object('processCode',requested_process,
                'refreshedStepCount',(select count(*) from framework_step_execution_spec
                  where process_code=requested_process),
                'refreshedBy',requested_actor)
            $$
            """);
    }

    private static Path findRepositoryFile(String relative){
        Path cursor=Path.of("").toAbsolutePath();
        for(int depth=0;cursor!=null&&depth<8;depth++,cursor=cursor.getParent()){
            Path candidate=cursor.resolve(relative);
            if(Files.isRegularFile(candidate))return candidate;
        }
        throw new IllegalStateException("repository file not found: "+relative);
    }
}
