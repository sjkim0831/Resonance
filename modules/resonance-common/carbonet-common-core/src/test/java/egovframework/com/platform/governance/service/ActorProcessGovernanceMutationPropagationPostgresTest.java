package egovframework.com.platform.governance.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.platform.governance.web.ActorProcessControlPlaneBridgeController;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.TestInstance;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.transaction.support.TransactionTemplate;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assumptions.assumeTrue;

@TestInstance(TestInstance.Lifecycle.PER_CLASS)
class ActorProcessGovernanceMutationPropagationPostgresTest {
    private static final String MIGRATION=
        "apps/carbonet-api/src/main/resources/db/migration/postgresql/"+
        "V20260815121800__refresh_direct_process_execution_specs.sql";
    private static final String BLUEPRINT_ADOPTION_MIGRATION=
        "apps/carbonet-api/src/main/resources/db/migration/postgresql/"+
        "V20260714224500__adopt_existing_screens_into_blueprints.sql";
    private static final String BLUEPRINT_STRATEGY_MIGRATION=
        "apps/carbonet-api/src/main/resources/db/migration/postgresql/"+
        "V20260721101000__align_screen_blueprint_strategy_constraint.sql";
    private static final String LOCK_GUARD_MIGRATION=
        "apps/carbonet-api/src/main/resources/db/migration/postgresql/"+
        "V20260717090000__lock_implemented_process_definitions.sql";
    private static final String LEGACY_SOURCE_HASH_MIGRATION=
        "apps/carbonet-api/src/main/resources/db/migration/postgresql/"+
        "V20260806183000__normalize_step_handoff_contracts.sql";
    private static final String REVISION_MIGRATION=
        "apps/carbonet-api/src/main/resources/db/migration/postgresql/"+
        "V20260815121900__open_controlled_process_design_revisions.sql";
    private JdbcTemplate admin;
    private JdbcTemplate jdbc;
    private DriverManagerDataSource dataSource;
    private String schema;
    private TransactionTemplate transaction;
    private ActorProcessGovernanceService service;

    @BeforeAll
    void createDisposableSchema() throws Exception {
        String url=System.getenv("DIRECT_CODEGEN_PG_URL");
        assumeTrue(url!=null&&!url.isBlank(),"DIRECT_CODEGEN_PG_URL is required");
        String user=System.getenv().getOrDefault("DIRECT_CODEGEN_PG_USER","postgres");
        String password=System.getenv().getOrDefault("DIRECT_CODEGEN_PG_PASSWORD","");
        admin=new JdbcTemplate(new DriverManagerDataSource(url,user,password));
        schema="direct_mutation_"+UUID.randomUUID().toString().replace("-","");
        admin.execute("create schema "+schema);
        String separator=url.contains("?")?"&":"?";
        dataSource=new DriverManagerDataSource(
            url+separator+"currentSchema="+schema,user,password);
        jdbc=new JdbcTemplate(dataSource);
        transaction=new TransactionTemplate(new DataSourceTransactionManager(dataSource));
        service=new ActorProcessGovernanceService(jdbc,
            org.mockito.Mockito.mock(ScreenDevelopmentNoteService.class),
            org.mockito.Mockito.mock(egovframework.com.platform.codex.service.CodexProvisioningService.class),
            org.mockito.Mockito.mock(ScreenContractRuntimeService.class));
        createSchema();
        applyMigration(BLUEPRINT_ADOPTION_MIGRATION,false);
        applyMigration(BLUEPRINT_STRATEGY_MIGRATION,false);
        applyMigration(LOCK_GUARD_MIGRATION,false);
        applyMigration(LEGACY_SOURCE_HASH_MIGRATION,false);
        applyMigration(MIGRATION,true);
        applyMigration(REVISION_MIGRATION,true);
    }

    @AfterAll
    void dropDisposableSchema(){
        if(admin!=null&&schema!=null)admin.execute("drop schema if exists "+schema+" cascade");
    }

    @BeforeEach
    void seed(){
        jdbc.execute("drop trigger if exists reject_direct_job on framework_development_job");
        jdbc.execute("truncate framework_actor_process_design_release,framework_process_step_screen_binding,"+
            "framework_screen_blueprint,framework_screen_resource,comtnthemedefinition,"+
            "framework_account_actor_assignment,"+
            "framework_development_job_gate_result,framework_development_job,"+
            "framework_process_artifact,framework_step_execution_spec,framework_professional_screen_contract,"+
            "framework_page_design,framework_simulation_case,framework_step_schema_set,"+
            "framework_process_step,framework_process_definition,framework_actor_definition cascade");
        for(String code:new String[]{"PRIMARY_ACTOR","OWNER_ACTOR","ESCALATION_ACTOR","SEGREGATION_ACTOR"}){
            jdbc.update("""
                insert into framework_actor_definition(
                  actor_code,actor_name,actor_name_en,actor_type,purpose,capability_codes,
                  delegation_allowed,use_at,responsibility_text,accountability_text,
                  competency_requirements,conflict_actor_codes,max_concurrent_assignments,review_cycle_days)
                values(?,?,?,'BUSINESS',?,'READ,WRITE',true,'Y',?,?,?,'',5,365)
                """,code,code,code,code+" purpose",code+" responsibility",
                code+" accountability",code+" competency");
        }
        jdbc.update("""
            insert into framework_process_definition(
              process_code,process_name,domain_code,goal,start_condition,completion_condition,
              definition_locked,owner_actor_code,risk_level,sla_hours,regulation_refs)
            values('PROC','Process','DOMAIN','goal','start','complete',false,
              'OWNER_ACTOR','MEDIUM',24,'REGULATION')
            """);
        seedStep("STEP",1,"COMPLETE",true);
        for(String type:new String[]{"HAPPY_PATH","AUTHORITY","ISOLATION","EXCEPTION","RECOVERY"}){
            jdbc.update("""
                insert into framework_simulation_case(
                  case_code,process_code,case_name,case_type,preconditions,
                  steps_json,assertions_json,case_status)
                values(?, 'PROC', ?, ?, 'ready', '[]', '[]', 'READY')
                ""","CASE_"+type,type,type);
        }
        jdbc.update("""
            insert into framework_professional_screen_contract(
              process_code,step_code,audience,route_path,actor_code,
              command_contract,api_contract,updated_by)
            values('PROC','STEP','USER','/step','PRIMARY_ACTOR',
              '[{"commandCode":"SAVE"}]','[{"path":"/api/items"}]',
              'BACKSTAGE_REQUIREMENT_AUTOMATION')
            """);
        jdbc.update("""
            insert into framework_step_execution_spec(
              process_code,step_code,spec_version,actor_contract,business_contract,
              transition_contract,input_contract,output_contract,screen_contract,
              field_contract,command_contract,api_contract,persistence_contract,
              handoff_contract,test_contract,guide_contract,nonfunctional_contract,
              design_status,approval_status,generation_status,blocker_codes,source_hash,
              approved_by,approved_at)
            values('PROC','STEP',1,'{}','{}','{}','{}','{}',
              '[{"pageCode":"PROFESSIONAL"}]','{"fields":[{"fieldCode":"name"}]}',
              '[{"commandCode":"SAVE"}]','[{"path":"/api/items"}]','{}','{}','[]','{}','{}',
              'DESIGN_COMPLETE','APPROVED','READY','[]',?,'designer',current_timestamp)
            ""","a".repeat(64));
    }

    @Test
    void realActorAndProcessMutationsReuseOneCanonicalJobAndAdvanceTheProcessHead(){
        Long jobId=null;
        String previousHash=null;
        for(String actorCode:new String[]{
                "PRIMARY_ACTOR","OWNER_ACTOR","ESCALATION_ACTOR","SEGREGATION_ACTOR"}){
            Map<String,Object> result=transaction.execute(status->service.createActor(Map.of(
                "actorCode",actorCode,"actorName",actorCode,"purpose",actorCode+" revised"),
                "authenticated-admin"));
            assertEquals(1,result.get("affectedProcessCount"));
            assertEquals(1,result.get("queuedProcessCount"));
            long currentJob=((Number)((Map<?,?>)((List<?>)result.get("processResults")).get(0))
                .get("jobId")).longValue();
            String currentHash=jobHead();
            if(jobId!=null)assertEquals(jobId.longValue(),currentJob);
            if(previousHash!=null)assertNotEquals(previousHash,currentHash);
            jobId=currentJob;previousHash=currentHash;
            assertEquals(1,count("framework_development_job"));
        }

        Map<String,Object> processBody=processBody("changed goal");
        Map<String,Object> first=transaction.execute(status->
            service.createProcess(processBody,"authenticated-admin"));
        String processHash=String.valueOf(first.get("processInputHash"));
        assertEquals(jobId.longValue(),((Number)first.get("jobId")).longValue());
        Map<String,Object> second=transaction.execute(status->
            service.createProcess(processBody("changed goal again"),"authenticated-admin"));
        assertEquals(jobId.longValue(),((Number)second.get("jobId")).longValue());
        assertNotEquals(processHash,second.get("processInputHash"));
        assertEquals(1,count("framework_development_job"));
        assertEquals(0,jdbc.queryForObject("""
            select count(*) from framework_development_job
             where job_type in('DESIGN','API','BACKEND','FRONTEND_USER','FRONTEND_ADMIN')
            """,Integer.class));
    }

    @Test
    void realIncompleteAddStepCreatesNoJobThenCompleteRetryCreatesExactlyOne(){
        jdbc.execute("truncate framework_development_job_gate_result,"+
            "framework_development_job,framework_process_artifact restart identity");
        Map<String,Object> body=stepBody("STEP_TWO",2);

        Map<String,Object> skipped=transaction.execute(status->
            service.addStep(body,"authenticated-admin"));

        assertEquals("SKIPPED",skipped.get("status"));
        assertEquals(false,skipped.get("generationQueued"));
        assertEquals(0,skipped.get("jobCount"));
        assertEquals(0,count("framework_development_job"));
        assertEquals("OWNER_ACTOR,SEGREGATION_ACTOR",jdbc.queryForObject(
            "select segregation_actor_codes from framework_process_step where step_code='STEP_TWO'",
            String.class));

        jdbc.update("update framework_process_definition set definition_locked=true where process_code='PROC'");
        jdbc.update("""
            insert into framework_step_schema_set(
              process_code,step_code,schema_hash,input_schema,output_schema,field_schema,
              persistence_schema,handoff_schema,context_keys,completeness_status,blocker_codes)
            values('PROC','STEP_TWO',?,'{"input":"string"}','{"output":"string"}','[]',
              '{"entity":"item"}','[]','[]','COMPLETE','[]')
            ""","d".repeat(64));

        Map<String,Object> queued=transaction.execute(status->
            service.addStep(body,"authenticated-admin"));

        assertEquals("QUEUED",queued.get("status"));
        assertEquals(1,queued.get("jobCount"));
        assertEquals(1,count("framework_development_job"));
        assertEquals(0,jdbc.queryForObject("""
            select count(*) from framework_development_job
             where job_type<>'FULL_STACK_GENERATION'
            """,Integer.class));
    }

    @Test
    void rejectedCanonicalJobRollsBackProcessAndSpecMutation(){
        jdbc.execute("truncate framework_development_job_gate_result,"+
            "framework_development_job,framework_process_artifact restart identity");
        jdbc.execute("""
            create or replace function reject_direct_job() returns trigger language plpgsql as $$
            begin raise exception 'REJECT_DIRECT_JOB'; end $$
            """);
        jdbc.execute("create trigger reject_direct_job before insert on framework_development_job "+
            "for each row execute function reject_direct_job()");
        String goal=jdbc.queryForObject(
            "select goal from framework_process_definition where process_code='PROC'",String.class);
        String specHash=text("source_hash");

        assertThrows(org.springframework.dao.DataAccessException.class,()->transaction.execute(status->
            service.createProcess(processBody("must roll back"),"authenticated-admin")));

        assertEquals(goal,jdbc.queryForObject(
            "select goal from framework_process_definition where process_code='PROC'",String.class));
        assertEquals(specHash,text("source_hash"));
        assertEquals(0,count("framework_development_job"));
        assertEquals(0,count("framework_process_artifact"));
    }

    @Test
    void inactiveOrMissingSegregationActorFailsBeforeStepMutationAndLegacyDriftFailsRefresh(){
        Map<String,Object> missing=new java.util.LinkedHashMap<>(stepBody("STEP_TWO",2));
        missing.put("segregationActorCodes","MISSING_ACTOR");
        assertThrows(IllegalArgumentException.class,()->transaction.execute(status->
            service.addStep(missing,"authenticated-admin")));
        assertEquals(0,jdbc.queryForObject(
            "select count(*) from framework_process_step where step_code='STEP_TWO'",Integer.class));

        jdbc.update("update framework_actor_definition set use_at='N' "+
            "where actor_code='SEGREGATION_ACTOR'");
        assertThrows(IllegalArgumentException.class,()->transaction.execute(status->
            service.addStep(stepBody("STEP_TWO",2),"authenticated-admin")));
        assertThrows(org.springframework.dao.DataAccessException.class,this::refresh);

        jdbc.update("update framework_actor_definition set use_at='Y' "+
            "where actor_code='SEGREGATION_ACTOR'");
        jdbc.update("update framework_actor_definition "+
            "set conflict_actor_codes='MISSING_CONFLICT' "+
            "where actor_code='PRIMARY_ACTOR'");
        assertThrows(org.springframework.dao.DataAccessException.class,this::refresh);
    }

    @Test
    void refreshProjectsAllFourteenContractsAndPreservesProfessionalAuthority(){
        assertEquals(Boolean.TRUE,jdbc.queryForObject("""
            select exists(select 1 from jsonb_array_elements(
              framework_try_jsonb(command_contract)) item
              where item->>'commandCode'='SAVE')
              from framework_professional_screen_contract
             where process_code='PROC' and step_code='STEP'
            """,Boolean.class));
        assertEquals(Boolean.TRUE,jdbc.queryForObject("""
            select exists(select 1 from jsonb_array_elements(
              framework_merge_primary_contract_marker(
                framework_try_jsonb(command_contract),'PRIMARY_STEP_COMMAND',
                jsonb_build_object('commandCode','EXECUTE_STEP'))) item
              where item->>'commandCode'='SAVE')
              from framework_professional_screen_contract
             where process_code='PROC' and step_code='STEP'
            """,Boolean.class));
        assertEquals(Boolean.TRUE,jdbc.queryForObject("""
            select exists(select 1 from jsonb_array_elements(value) item
              where item->>'commandCode'='SAVE')
              from (select (select coalesce(jsonb_agg(item.value order by
                source.audience,source.contract_id,item.ordinality),'[]'::jsonb)
                from framework_professional_screen_contract source
                cross join lateral jsonb_array_elements(
                  framework_try_jsonb(source.command_contract))
                  with ordinality item(value,ordinality)
                where source.process_code=contract.process_code
                  and source.step_code=contract.step_code) value
                from framework_professional_screen_contract contract
                where contract.process_code='PROC' and contract.step_code='STEP'
                group by contract.process_code,contract.step_code) aggregate_contract
            """,Boolean.class));
        Map<String,Object> result=refresh();

        assertEquals(1,number(result,"definedStepCount"));
        assertEquals(1,number(result,"generationReadyStepCount"));
        assertEquals("PRIMARY_ACTOR",text("actor_contract->>'actorCode'"));
        assertEquals("Y",text("actor_contract->>'useAt'"));
        assertEquals(4,jdbc.queryForObject(
            "select jsonb_array_length(actor_contract->'relatedActors') from framework_step_execution_spec",
            Integer.class));
        assertEquals("PROFESSIONAL",text("screen_contract->0->>'pageCode'"));
        assertEquals("name",text("field_contract->'fields'->0->>'fieldCode'"));
        assertEquals(Boolean.TRUE,jdbc.queryForObject("""
            select exists(select 1 from jsonb_array_elements(
              screen_contract->0->'commands') item
              where item->>'commandCode'='SAVE')
              from framework_step_execution_spec
            """,Boolean.class),text("screen_contract::text"));
        assertEquals(Boolean.TRUE,jdbc.queryForObject("""
            select exists(select 1 from jsonb_array_elements(command_contract) item
              where item->>'commandCode'='SAVE')
              from framework_step_execution_spec
            """,Boolean.class),text("command_contract::text"));
        assertEquals(1,jdbc.queryForObject("""
            select count(*) from framework_step_execution_spec spec
              cross join lateral jsonb_array_elements(spec.command_contract) item
             where item->>'markerType'='PRIMARY_STEP_COMMAND'
               and item->>'commandCode'='EXECUTE_STEP'
            """,Integer.class));
        assertEquals(Boolean.TRUE,jdbc.queryForObject("""
            select exists(select 1 from jsonb_array_elements(api_contract) item
              where item->>'path'='/api/items')
              from framework_step_execution_spec
            """,Boolean.class));
        assertEquals(14,jdbc.queryForObject("""
            select (actor_contract is not null)::int+(business_contract is not null)::int+
              (transition_contract is not null)::int+(input_contract is not null)::int+
              (output_contract is not null)::int+(screen_contract is not null)::int+
              (field_contract is not null)::int+(command_contract is not null)::int+
              (api_contract is not null)::int+(persistence_contract is not null)::int+
              (handoff_contract is not null)::int+(test_contract is not null)::int+
              (guide_contract is not null)::int+(nonfunctional_contract is not null)::int
              from framework_step_execution_spec
            """,Integer.class));
        assertEquals("APPROVED",text("approval_status"));
        assertEquals("READY",text("generation_status"));
        assertTrue(text("source_hash").matches("[0-9a-f]{64}"));
        String stableHash=text("source_hash");
        int stableVersion=jdbc.queryForObject(
            "select spec_version from framework_step_execution_spec",Integer.class);
        refresh();
        assertEquals(stableHash,text("source_hash"));
        assertEquals(stableVersion,jdbc.queryForObject(
            "select spec_version from framework_step_execution_spec",Integer.class));
    }

    @Test
    void routeCommandAndApiRevisionBlocksSplitAuthorityThenMergesOneStablePrimaryMarker(){
        refresh();
        long initialVersion=jdbc.queryForObject(
            "select spec_version from framework_step_execution_spec where step_code='STEP'",
            Long.class);

        jdbc.update("""
            update framework_process_step
               set user_path='/next',command_code='EXECUTE_NEXT',api_contract='PUT /api/next'
             where process_code='PROC' and step_code='STEP'
            """);
        refresh();
        assertTrue(Boolean.TRUE.equals(jdbc.queryForObject("""
            select blocker_codes ? 'PAGE_ROUTE_MISMATCH'
              from framework_step_execution_spec where step_code='STEP'
            """,Boolean.class)));
        assertEquals("DESIGN_BLOCKED",text("design_status"));
        assertEquals(Boolean.TRUE,jdbc.queryForObject("""
            select exists(select 1 from jsonb_array_elements(command_contract) item
              where item->>'commandCode'='SAVE')
              from framework_step_execution_spec
            """,Boolean.class));
        assertEquals(1,jdbc.queryForObject("""
            select count(*) from framework_step_execution_spec spec
              cross join lateral jsonb_array_elements(spec.command_contract) item
             where item->>'markerType'='PRIMARY_STEP_COMMAND'
               and item->>'commandCode'='EXECUTE_NEXT'
            """,Integer.class));
        assertEquals(1,jdbc.queryForObject("""
            select count(*) from framework_step_execution_spec spec
              cross join lateral jsonb_array_elements(spec.api_contract) item
             where item->>'markerType'='PRIMARY_STEP_API'
               and item->>'commandCode'='EXECUTE_NEXT'
               and item->>'declaredContract'='PUT /api/next'
            """,Integer.class));

        jdbc.update("""
            update framework_professional_screen_contract
               set route_path='/next'
             where process_code='PROC' and step_code='STEP' and audience='USER'
            """);
        refresh();
        assertEquals("DESIGN_COMPLETE",text("design_status"));
        assertEquals("/next",text("screen_contract->0->>'plannedRoute'"));
        long reconciledVersion=jdbc.queryForObject(
            "select spec_version from framework_step_execution_spec where step_code='STEP'",
            Long.class);
        assertTrue(reconciledVersion>initialVersion);
        String reconciledHash=text("source_hash");

        refresh();
        assertEquals(reconciledVersion,jdbc.queryForObject(
            "select spec_version from framework_step_execution_spec where step_code='STEP'",
            Long.class));
        assertEquals(reconciledHash,text("source_hash"));
        assertEquals(1,jdbc.queryForObject("""
            select count(*) from framework_step_execution_spec spec
              cross join lateral jsonb_array_elements(spec.command_contract) item
             where item->>'markerType'='PRIMARY_STEP_COMMAND'
            """,Integer.class));
        assertEquals(1,jdbc.queryForObject("""
            select count(*) from framework_step_execution_spec spec
              cross join lateral jsonb_array_elements(spec.screen_contract->0->'commands') item
             where item->>'markerType'='PRIMARY_STEP_COMMAND'
            """,Integer.class));
    }

    @Test
    void ordinaryStepRevisionPersistsPrimaryMarkersAndPreservesManualActionsInCanonicalSource(){
        String beforeSource=jdbc.queryForObject("""
            select encode(sha256(convert_to(command_contract||api_contract,'UTF8')),'hex')
              from framework_professional_screen_contract
             where process_code='PROC' and step_code='STEP'
            """,String.class);
        LinkedHashMap<String,Object> revised=new LinkedHashMap<>(stepBody("STEP",1));
        revised.put("commandCode","EXECUTE_NEW");
        revised.put("requiresUserPage",true);
        revised.put("userPath","/step");
        revised.put("apiContract","PUT /api/new");

        Map<String,Object> result=transaction.execute(status->
            service.addStep(revised,"authenticated-admin"));

        assertEquals("QUEUED",result.get("status"));
        assertEquals(Boolean.TRUE,result.get("generationQueued"));
        assertEquals(1,result.get("jobCount"));
        assertEquals(1,result.get("endpointExpected"));
        String afterSource=jdbc.queryForObject("""
            select encode(sha256(convert_to(command_contract||api_contract,'UTF8')),'hex')
              from framework_professional_screen_contract
             where process_code='PROC' and step_code='STEP'
            """,String.class);
        assertNotEquals(beforeSource,afterSource);
        assertEquals(1,jdbc.queryForObject("""
            select count(*) from framework_professional_screen_contract contract
              cross join lateral jsonb_array_elements(
                framework_try_jsonb(contract.command_contract)) item
             where contract.process_code='PROC' and contract.step_code='STEP'
               and item->>'markerType'='PRIMARY_STEP_COMMAND'
               and item->>'commandCode'='EXECUTE_NEW'
            """,Integer.class));
        assertEquals(Boolean.TRUE,jdbc.queryForObject("""
            select exists(select 1 from jsonb_array_elements(
              framework_try_jsonb(command_contract)) item
              where item->>'commandCode'='SAVE' and item->>'markerType' is null)
              from framework_professional_screen_contract
             where process_code='PROC' and step_code='STEP'
            """,Boolean.class));
        assertEquals(Boolean.TRUE,jdbc.queryForObject("""
            select exists(select 1 from jsonb_array_elements(
              framework_try_jsonb(api_contract)) item
              where item->>'path'='/api/items' and item->>'markerType' is null)
              from framework_professional_screen_contract
             where process_code='PROC' and step_code='STEP'
            """,Boolean.class));
        assertEquals(1,jdbc.queryForObject("""
            select count(*) from framework_professional_screen_contract contract
              cross join lateral jsonb_array_elements(
                framework_try_jsonb(contract.api_contract)) item
             where contract.process_code='PROC' and contract.step_code='STEP'
               and item->>'markerType'='PRIMARY_STEP_API'
               and item->>'commandCode'='EXECUTE_NEW'
               and item->>'declaredContract'='PUT /api/new'
            """,Integer.class));
        assertEquals(1,jdbc.queryForObject("""
            select count(*) from framework_step_execution_spec spec
              cross join lateral jsonb_array_elements(spec.command_contract) item
             where item->>'markerType'='PRIMARY_STEP_COMMAND'
               and item->>'commandCode'='EXECUTE_NEW'
            """,Integer.class));

        jdbc.update("""
            update framework_professional_screen_contract
               set command_contract='[{"commandCode":"MANUAL_ONLY"}]',
                   api_contract='[{"path":"/manual"}]',updated_by='HUMAN_DESIGNER'
             where process_code='PROC' and step_code='STEP'
            """);
        jdbc.update("""
            insert into framework_screen_blueprint(
              blueprint_code,process_code,step_code,actor_code,audience,page_id,page_name,
              route_path,screen_type,template_code,specification_json,traceability_json,
              validation_status,implementation_strategy,source_reference,transition_status,created_by)
            values('MANUAL_BP','PROC','STEP','PRIMARY_ACTOR','USER','MANUAL','Manual','/step',
              'WORKSPACE','KRDS_WORKSPACE','{}','{}','VALID','ADOPT_EXISTING',
              'MANUAL','CONTRACT_LINKED','HUMAN_DESIGNER')
            """);
        LinkedHashMap<String,Object> rejected=new LinkedHashMap<>(revised);
        rejected.put("commandCode","EXECUTE_REJECTED");
        assertThrows(IllegalStateException.class,()->transaction.execute(status->
            service.addStep(rejected,"authenticated-admin")));
        assertEquals("EXECUTE_NEW",jdbc.queryForObject("""
            select command_code from framework_process_step
             where process_code='PROC' and step_code='STEP'
            """,String.class));
        assertEquals("[{\"commandCode\":\"MANUAL_ONLY\"}]",jdbc.queryForObject("""
            select command_contract from framework_professional_screen_contract
             where process_code='PROC' and step_code='STEP'
            """,String.class));
    }

    @Test
    void distinctRequirementProcessOrderAllocationDoesNotHoldAGlobalTransactionLock()
            throws Exception {
        CountDownLatch firstAllocated=new CountDownLatch(1);
        CountDownLatch releaseFirst=new CountDownLatch(1);
        var executor=Executors.newFixedThreadPool(2);
        try{
            var first=executor.submit(()->transaction.execute(status->{
                Integer value=jdbc.queryForObject(
                    "select framework_allocate_requirement_process_sequence('PROC_A')",
                    Integer.class);
                firstAllocated.countDown();
                try{assertTrue(releaseFirst.await(5,TimeUnit.SECONDS));}
                catch(InterruptedException error){
                    Thread.currentThread().interrupt();
                    throw new IllegalStateException(error);
                }
                return value;
            }));
            assertTrue(firstAllocated.await(3,TimeUnit.SECONDS));
            var second=executor.submit(()->transaction.execute(status->jdbc.queryForObject(
                "select framework_allocate_requirement_process_sequence('PROC_B')",Integer.class)));
            Integer secondOrder=second.get(2,TimeUnit.SECONDS);
            releaseFirst.countDown();
            Integer firstOrder=first.get(3,TimeUnit.SECONDS);
            assertNotEquals(firstOrder,secondOrder);
            assertEquals(firstOrder,jdbc.queryForObject(
                "select framework_allocate_requirement_process_sequence('PROC_A')",Integer.class));
            assertEquals(2,jdbc.queryForObject(
                "select count(*) from framework_business_process_sequence where process_code in('PROC_A','PROC_B')",
                Integer.class));
        }finally{
            releaseFirst.countDown();
            executor.shutdownNow();
        }
    }

    @Test
    void oppositeRelatedRequirementImportsPrelockEveryProcessInCanonicalOrder()
            throws Exception {
        insertActor("CROSS_ACTOR_X");
        insertActor("CROSS_ACTOR_Y");
        jdbc.update("""
            insert into framework_process_definition(
              process_code,process_name,domain_code,goal,start_condition,
              completion_condition,owner_actor_code)
            values('CROSS_PROCESS_X','Cross X','DOMAIN','x','start','complete','CROSS_ACTOR_Y'),
                  ('CROSS_PROCESS_Y','Cross Y','DOMAIN','y','start','complete','CROSS_ACTOR_X')
            """);
        CountDownLatch firstLocked=new CountDownLatch(1);
        CountDownLatch releaseFirst=new CountDownLatch(1);
        CountDownLatch secondStarted=new CountDownLatch(1);
        var executor=Executors.newFixedThreadPool(2);
        try{
            var first=executor.submit(()->transaction.execute(status->{
                jdbc.execute("set local lock_timeout='3s'");
                List<String> locked=service.lockRequirementImportProcesses(
                    "CROSS_PROCESS_X",List.of("CROSS_ACTOR_X"));
                firstLocked.countDown();
                try{assertTrue(releaseFirst.await(5,TimeUnit.SECONDS));}
                catch(InterruptedException error){
                    Thread.currentThread().interrupt();throw new IllegalStateException(error);
                }
                return locked;
            }));
            assertTrue(firstLocked.await(3,TimeUnit.SECONDS));
            var second=executor.submit(()->transaction.execute(status->{
                jdbc.execute("set local lock_timeout='3s'");
                secondStarted.countDown();
                return service.lockRequirementImportProcesses(
                    "CROSS_PROCESS_Y",List.of("CROSS_ACTOR_Y"));
            }));
            assertTrue(secondStarted.await(3,TimeUnit.SECONDS));
            Thread.sleep(250);
            assertEquals(false,second.isDone());
            releaseFirst.countDown();
            assertEquals(List.of("CROSS_PROCESS_X","CROSS_PROCESS_Y"),
                first.get(3,TimeUnit.SECONDS));
            assertEquals(List.of("CROSS_PROCESS_X","CROSS_PROCESS_Y"),
                second.get(3,TimeUnit.SECONDS));
        }finally{
            releaseFirst.countDown();
            executor.shutdownNow();
        }
    }

    @Test
    void releaseReconciliationCasCannotOverwriteAConcurrentRepromotion() throws Exception {
        Map<String,Object> queued=transaction.execute(status->
            service.createProcess(processBody("release head"),"authenticated-admin"));
        String expectedHash=String.valueOf(queued.get("processInputHash"));
        long expectedJobId=((Number)queued.get("jobId")).longValue();
        jdbc.update("""
            update framework_development_job
               set job_status='COMPLETED',quality_status='VERIFIED',
                   evidence_ref='receipt://verified',completed_at=current_timestamp
             where process_code='PROC' and job_type='FULL_STACK_GENERATION'
            """);
        String originalChecksum="c".repeat(64);
        jdbc.update("""
            insert into framework_actor_process_design_release(
              project_id,design_version,contract_sha256,contract_payload,
              release_status,generation_result)
            values('PROJECT_A',1,?,
              jsonb_build_object('source',jsonb_build_object('type','REQUIREMENT_DOCUMENT'),
                'process',jsonb_build_object('processCode','PROC')),
              'QUEUED',jsonb_build_object(
                'status','PENDING',
                'expectedProcessHeads',jsonb_build_object('PROC',?),
                'expectedProcessReceipts',jsonb_build_object('PROC',
                  jsonb_build_object('processInputHash',?,'jobId',?))))
            """,originalChecksum,expectedHash,expectedHash,expectedJobId);
        CountDownLatch headRead=new CountDownLatch(1);
        CountDownLatch continueReconcile=new CountDownLatch(1);
        PausingJdbcTemplate pausingJdbc=new PausingJdbcTemplate(
            dataSource,headRead,continueReconcile);
        ActorProcessControlPlaneBridgeController bridge=
            new ActorProcessControlPlaneBridgeController(pausingJdbc,new ObjectMapper(),
                org.mockito.Mockito.mock(ActorProcessGovernanceService.class),"secret");
        var executor=Executors.newSingleThreadExecutor();
        try{
            var reconcile=executor.submit(()->{
                try{
                    var method=ActorProcessControlPlaneBridgeController.class.getDeclaredMethod(
                        "reconcileRequirementRelease",String.class,int.class,String.class);
                    method.setAccessible(true);
                    method.invoke(bridge,"PROJECT_A",1,"PROC");
                    return null;
                }catch(ReflectiveOperationException error){
                    throw new IllegalStateException(error);
                }
            });
            assertTrue(headRead.await(3,TimeUnit.SECONDS));
            jdbc.update("""
                update framework_actor_process_design_release
                   set generation_result=jsonb_build_object(
                     'status','APPLIED','reconcileVersion','CONCURRENT'),
                     release_status='APPLIED',applied_at=current_timestamp
                 where project_id='PROJECT_A' and design_version=1
                """);
            continueReconcile.countDown();
            reconcile.get(3,TimeUnit.SECONDS);
            assertEquals(originalChecksum,jdbc.queryForObject("""
                select contract_sha256 from framework_actor_process_design_release
                 where project_id='PROJECT_A' and design_version=1
                """,String.class));
            assertEquals("APPLIED",jdbc.queryForObject("""
                select release_status from framework_actor_process_design_release
                 where project_id='PROJECT_A' and design_version=1
                """,String.class));
            assertEquals("CONCURRENT",jdbc.queryForObject("""
                select generation_result->>'reconcileVersion'
                  from framework_actor_process_design_release
                 where project_id='PROJECT_A' and design_version=1
                """,String.class));
        }finally{
            continueReconcile.countDown();
            executor.shutdownNow();
            bridge.shutdownGenerationExecutor();
        }
    }

    @Test
    void replacementCanonicalJobIdCannotSatisfyTheCapturedReleaseReceipt() throws Exception {
        Map<String,Object> queued=transaction.execute(status->
            service.createProcess(processBody("receipt head"),"authenticated-admin"));
        String expectedHash=String.valueOf(queued.get("processInputHash"));
        long expectedJobId=((Number)queued.get("jobId")).longValue();
        jdbc.update("""
            update framework_development_job
               set job_status='COMPLETED',quality_status='VERIFIED',
                   evidence_ref='receipt://replacement',completed_at=current_timestamp
             where job_id=?
            """,expectedJobId);
        jdbc.update("""
            insert into framework_actor_process_design_release(
              project_id,design_version,contract_sha256,contract_payload,
              release_status,generation_result)
            values('PROJECT_REPLACED',1,repeat('e',64),'{}',
              'QUEUED',jsonb_build_object(
                'status','PENDING',
                'expectedProcessHeads',jsonb_build_object('PROC',?),
                'expectedProcessReceipts',jsonb_build_object('PROC',
                  jsonb_build_object('processInputHash',?,'jobId',?))))
            """,expectedHash,expectedHash,expectedJobId);
        jdbc.update("update framework_development_job set job_id=job_id+1000 where job_id=?",
            expectedJobId);
        ActorProcessControlPlaneBridgeController bridge=
            new ActorProcessControlPlaneBridgeController(jdbc,new ObjectMapper(),
                org.mockito.Mockito.mock(ActorProcessGovernanceService.class),"secret");
        try{
            var method=ActorProcessControlPlaneBridgeController.class.getDeclaredMethod(
                "reconcileRequirementRelease",String.class,int.class,String.class);
            method.setAccessible(true);
            method.invoke(bridge,"PROJECT_REPLACED",1,"PROC");
            assertEquals("REVIEW_REQUIRED",jdbc.queryForObject("""
                select release_status from framework_actor_process_design_release
                 where project_id='PROJECT_REPLACED' and design_version=1
                """,String.class));
            assertEquals(String.valueOf(expectedJobId),jdbc.queryForObject("""
                select generation_result#>>'{processResults,0,expectedJobId}'
                  from framework_actor_process_design_release
                 where project_id='PROJECT_REPLACED' and design_version=1
                """,String.class));
            assertEquals("0",jdbc.queryForObject("""
                select generation_result#>>'{processResults,0,jobCount}'
                  from framework_actor_process_design_release
                 where project_id='PROJECT_REPLACED' and design_version=1
                """,String.class));
        }finally{
            bridge.shutdownGenerationExecutor();
        }
    }

    @Test
    void requirementOwnedRouteAndAudienceRemovalAreExactWhileManualIdentityFailsClosed(){
        jdbc.update("""
            update framework_professional_screen_contract
               set updated_by='BACKSTAGE_REQUIREMENT_AUTOMATION'
             where process_code='PROC' and step_code='STEP'
            """);
        jdbc.update("""
            update framework_process_step
               set user_path='/new-route',command_code='NEW_COMMAND',api_contract='PATCH /api/new'
             where process_code='PROC' and step_code='STEP'
            """);

        reconcileRequirementOwnedProfessionalContracts();

        assertEquals(0,jdbc.queryForObject("""
            select count(*) from framework_professional_screen_contract
             where process_code='PROC' and step_code='STEP' and route_path='/step'
            """,Integer.class));
        assertEquals(1,jdbc.queryForObject("""
            select count(*) from framework_professional_screen_contract contract
              cross join lateral jsonb_array_elements(
                framework_try_jsonb(contract.command_contract)) item
             where contract.process_code='PROC' and contract.step_code='STEP'
               and contract.route_path='/new-route'
               and item->>'markerType'='PRIMARY_STEP_COMMAND'
               and item->>'commandCode'='NEW_COMMAND'
            """,Integer.class));

        jdbc.update("""
            update framework_process_step set requires_user_page=false,user_path=null
             where process_code='PROC' and step_code='STEP'
            """);
        reconcileRequirementOwnedProfessionalContracts();
        assertEquals(0,jdbc.queryForObject("""
            select count(*) from framework_professional_screen_contract
             where process_code='PROC' and step_code='STEP'
            """,Integer.class));

        jdbc.update("""
            update framework_process_step set requires_user_page=true,user_path='/required'
             where process_code='PROC' and step_code='STEP'
            """);
        jdbc.update("""
            insert into framework_professional_screen_contract(
              process_code,step_code,audience,route_path,actor_code,updated_by)
            values('PROC','STEP','USER','/manual-route','PRIMARY_ACTOR','HUMAN_DESIGNER')
            """);
        assertThrows(IllegalStateException.class,
            this::reconcileRequirementOwnedProfessionalContracts);
        assertEquals(1,jdbc.queryForObject("""
            select count(*) from framework_professional_screen_contract
             where process_code='PROC' and step_code='STEP' and route_path='/manual-route'
            """,Integer.class));
    }

    @Test
    void requirementOwnedPageAndBlueprintIdentityIsReplacedRemovedAndManualAuthorityProtected(){
        assertEquals(Boolean.FALSE,jdbc.queryForObject("""
            select exists(select 1 from pg_constraint
              where conrelid='framework_screen_blueprint'::regclass
                and conname='framework_screen_blueprint_process_code_step_code_audience_key')
            """,Boolean.class));
        assertEquals(Boolean.TRUE,jdbc.queryForObject("""
            select exists(select 1 from pg_constraint
              where conrelid='framework_screen_blueprint'::regclass
                and conname='framework_screen_blueprint_audience_route_path_key')
            """,Boolean.class));
        jdbc.update("""
            update framework_professional_screen_contract
               set updated_by='BACKSTAGE_REQUIREMENT_AUTOMATION'
             where process_code='PROC' and step_code='STEP'
            """);
        jdbc.update("""
            update framework_process_step set user_path='/new-route'
             where process_code='PROC' and step_code='STEP'
            """);
        reconcileRequirementOwnedProfessionalContracts();
        jdbc.update("""
            insert into framework_page_design(
              process_code,step_code,audience,page_code,page_title,page_purpose,
              screen_type,planned_route_path,route_status,actor_code,updated_by)
            values('PROC','STEP','USER','PROC_STEP_USER','Page','Purpose','WORKSPACE',
              '/new-route','DESIGN_ONLY','PRIMARY_ACTOR','BACKSTAGE_REQUIREMENT_AUTOMATION')
            """);
        jdbc.update("""
            insert into framework_screen_resource(
              route_key,layout_type,source_kind) values('/new-route','RESPONSIVE_WORKSPACE','PAGE_DESIGN')
            """);
        jdbc.update("""
            insert into comtnthemedefinition(theme_id,use_at,is_active)
            values('KRDS_GOV_DEFAULT','Y','Y')
            """);
        jdbc.update("""
            insert into framework_screen_blueprint(
              blueprint_code,process_code,step_code,actor_code,audience,page_id,page_name,
              route_path,screen_type,template_code,specification_json,traceability_json,
              validation_status,implementation_strategy,source_reference,transition_status,created_by)
            values('REQ_BP_OLD','PROC','STEP','PRIMARY_ACTOR','USER','OLD','Old','/old-route',
              'WORKSPACE','KRDS_WORKSPACE','{}','{}','VALID','GENERATED_RUNTIME',
              'FRAMEWORK_PROFESSIONAL_SCREEN_CONTRACT:1','CONTRACT_LINKED',
              'BACKSTAGE_REQUIREMENT_AUTOMATION')
            """);

        reconcileRequirementOwnedBlueprints();

        assertEquals("/new-route",jdbc.queryForObject("""
            select route_path from framework_screen_blueprint
             where process_code='PROC' and step_code='STEP' and audience='USER'
            """,String.class));
        assertEquals("VALID",jdbc.queryForObject("""
            select validation_status from framework_screen_blueprint
             where process_code='PROC' and step_code='STEP' and audience='USER'
            """,String.class));

        jdbc.update("""
            update framework_process_step set requires_user_page=false,user_path=null
             where process_code='PROC' and step_code='STEP'
            """);
        reconcileRequirementOwnedProfessionalContracts();
        reconcileRequirementOwnedPageDesigns();
        reconcileRequirementOwnedBlueprints();
        assertEquals(0,jdbc.queryForObject(
            "select count(*) from framework_page_design where process_code='PROC'",Integer.class));
        assertEquals("INVALID",jdbc.queryForObject("""
            select validation_status from framework_screen_blueprint
             where process_code='PROC' and step_code='STEP' and audience='USER'
            """,String.class));

        jdbc.update("""
            update framework_process_step set requires_user_page=true,user_path='/required'
             where process_code='PROC' and step_code='STEP'
            """);
        jdbc.update("""
            update framework_screen_blueprint
               set implementation_strategy='ADOPT_EXISTING',created_by='HUMAN_DESIGNER',
                   route_path='/manual-route',validation_status='VALID'
             where process_code='PROC' and step_code='STEP' and audience='USER'
            """);
        assertThrows(IllegalStateException.class,this::reconcileRequirementOwnedBlueprints);
        jdbc.update("""
            insert into framework_page_design(
              process_code,step_code,audience,page_code,page_title,page_purpose,
              screen_type,planned_route_path,route_status,actor_code,updated_by)
            values('PROC','STEP','USER','MANUAL','Manual','Manual','WORKSPACE',
              '/manual-route','DESIGN_ONLY','PRIMARY_ACTOR','HUMAN_DESIGNER')
            """);
        assertThrows(IllegalStateException.class,this::reconcileRequirementOwnedPageDesigns);
    }

    @Test
    void primaryOwnerEscalationAndSegregationActorMutationsEachAdvanceTheSpecVersion(){
        refresh();
        for(String code:new String[]{"PRIMARY_ACTOR","OWNER_ACTOR","ESCALATION_ACTOR","SEGREGATION_ACTOR"}){
            int before=jdbc.queryForObject(
                "select spec_version from framework_step_execution_spec",Integer.class);
            jdbc.update("update framework_actor_definition set purpose=purpose||'-changed' where actor_code=?",code);
            refresh();
            int after=jdbc.queryForObject(
                "select spec_version from framework_step_execution_spec",Integer.class);
            assertTrue(after>before,code);
            assertEquals(code+" purpose-changed",jdbc.queryForObject("""
                select related->>'purpose'
                  from framework_step_execution_spec spec
                  cross join lateral jsonb_array_elements(spec.actor_contract->'relatedActors') related
                 where related->>'actorCode'=?
                """,String.class,code));
        }
    }

    @Test
    void processMutationChangesBusinessContractAndIncompleteStepStaysBlocked(){
        refresh();
        int before=jdbc.queryForObject(
            "select spec_version from framework_step_execution_spec",Integer.class);
        jdbc.update("update framework_process_definition set goal='changed goal' where process_code='PROC'");
        refresh();
        assertTrue(jdbc.queryForObject(
            "select spec_version from framework_step_execution_spec",Integer.class)>before);
        assertEquals("changed goal",text("business_contract->>'goal'"));

        seedStep("INCOMPLETE",2,"BLOCKED",false);
        Map<String,Object> result=refresh();
        assertEquals(2,number(result,"definedStepCount"));
        assertEquals(1,number(result,"blockedStepCount"));
        assertEquals("DESIGN_BLOCKED",jdbc.queryForObject(
            "select design_status from framework_step_execution_spec where step_code='INCOMPLETE'",
            String.class));
        assertTrue(Boolean.TRUE.equals(jdbc.queryForObject("""
            select blocker_codes ? 'STEP_SCHEMA_INCOMPLETE'
              from framework_step_execution_spec where step_code='INCOMPLETE'
            """,Boolean.class)));
    }

    @Test
    void refreshFunctionIsNarrowSecurityDefinerWithPublicExecuteRevoked(){
        assertEquals(Boolean.FALSE,jdbc.queryForObject("""
            select has_function_privilege('public',
              ?||'.framework_refresh_process_execution_specs(text,text)','EXECUTE')
            """,Boolean.class,schema));
        assertEquals(Boolean.TRUE,jdbc.queryForObject("""
            select prosecdef and ?=any(proconfig)
              from pg_proc where oid=to_regprocedure(
                ?||'.framework_refresh_process_execution_specs(text,text)')
             """,Boolean.class,"search_path=pg_catalog, "+schema,schema));
    }

    @Test
    void completedSameHeadReplayKeepsGeneratedSpecVersionAndProcessHeadStable(){
        Map<String,Object> first=transaction.execute(status->
            service.createProcess(processBody("stable goal"),"authenticated-admin"));
        assertEquals("QUEUED",first.get("status"));
        jdbc.update("update framework_development_job set job_status='COMPLETED',"+
            "quality_status='VERIFIED',completed_at=current_timestamp");
        jdbc.update("update framework_step_execution_spec set generation_status='GENERATED'");
        String source=text("source_hash");
        int specVersion=jdbc.queryForObject(
            "select spec_version from framework_step_execution_spec",Integer.class);
        String processVersion=jdbc.queryForObject(
            "select process_version from framework_process_definition where process_code='PROC'",
            String.class);
        String target=jdbc.queryForObject(
            "select target_path from framework_development_job",String.class);

        Map<String,Object> replay=transaction.execute(status->
            service.createProcess(processBody("stable goal"),"authenticated-admin"));

        assertEquals("UNCHANGED",replay.get("status"));
        assertEquals(false,replay.get("generationQueued"));
        assertEquals(source,text("source_hash"));
        assertEquals(specVersion,jdbc.queryForObject(
            "select spec_version from framework_step_execution_spec",Integer.class));
        assertEquals("GENERATED",text("generation_status"));
        assertEquals(processVersion,jdbc.queryForObject(
            "select process_version from framework_process_definition where process_code='PROC'",
            String.class));
        assertEquals(target,jdbc.queryForObject(
            "select target_path from framework_development_job",String.class));
        assertTrue(source.matches("[0-9a-f]{64}"));
    }

    @Test
    void draftSafetyCasesAndMissingRequiredAudienceStayBlocked(){
        jdbc.update("update framework_simulation_case set case_status='DRAFT'");
        refresh();
        assertTrue(Boolean.TRUE.equals(jdbc.queryForObject("""
            select blocker_codes ? 'TEST_FAMILY_MISSING'
              from framework_step_execution_spec where step_code='STEP'
            """,Boolean.class)));

        jdbc.update("update framework_simulation_case set case_status='READY'");
        jdbc.update("update framework_process_step set requires_admin_page=true,admin_path='/admin/step' "+
            "where process_code='PROC' and step_code='STEP'");
        refresh();
        assertTrue(Boolean.TRUE.equals(jdbc.queryForObject("""
            select blocker_codes ? 'PAGE_DESIGN_MISSING'
              from framework_step_execution_spec where step_code='STEP'
            """,Boolean.class)));
        jdbc.update("insert into framework_professional_screen_contract("+
            "process_code,step_code,audience,route_path,actor_code) "+
            "values('PROC','STEP','ADMIN','/admin/step','PRIMARY_ACTOR')");
        refresh();
        assertEquals("DESIGN_COMPLETE",text("design_status"));
        assertEquals("[]",text("blocker_codes::text"));
    }

    @Test
    void actorCsvSetsAreCanonicalAndInvalidConflictReferencesRollBack(){
        Map<String,Object> first=transaction.execute(status->service.createActor(Map.of(
            "actorCode","PRIMARY_ACTOR","actorName","PRIMARY_ACTOR",
            "purpose","canonical actor","capabilityCodes","read,,WRITE,read",
            "conflictActorCodes","segregation_actor,OWNER_ACTOR"),
            "authenticated-admin"));
        assertEquals(1,first.get("affectedProcessCount"));
        assertEquals("READ,WRITE",jdbc.queryForObject("select capability_codes "+
            "from framework_actor_definition where actor_code='PRIMARY_ACTOR'",String.class));
        assertEquals("OWNER_ACTOR,SEGREGATION_ACTOR",jdbc.queryForObject(
            "select conflict_actor_codes from framework_actor_definition "+
                "where actor_code='PRIMARY_ACTOR'",String.class));
        String head=jobHead();
        int version=jdbc.queryForObject(
            "select spec_version from framework_step_execution_spec",Integer.class);

        transaction.execute(status->service.createActor(Map.of(
            "actorCode","PRIMARY_ACTOR","actorName","PRIMARY_ACTOR",
            "purpose","canonical actor","capabilityCodes","write,READ",
            "conflictActorCodes","owner_actor,SEGREGATION_ACTOR,owner_actor"),
            "authenticated-admin"));
        assertEquals(head,jobHead());
        assertEquals(version,jdbc.queryForObject(
            "select spec_version from framework_step_execution_spec",Integer.class));

        assertThrows(IllegalArgumentException.class,()->transaction.execute(status->
            service.createActor(Map.of("actorCode","PRIMARY_ACTOR",
                "actorName","PRIMARY_ACTOR","purpose","invalid",
                "conflictActorCodes","PRIMARY_ACTOR"),"authenticated-admin")));
        assertThrows(IllegalArgumentException.class,()->transaction.execute(status->
            service.createActor(Map.of("actorCode","PRIMARY_ACTOR",
                "actorName","PRIMARY_ACTOR","purpose","invalid",
                "conflictActorCodes","MISSING_ACTOR"),"authenticated-admin")));
        assertEquals("canonical actor",jdbc.queryForObject(
            "select purpose from framework_actor_definition where actor_code='PRIMARY_ACTOR'",
            String.class));
        assertEquals(1,count("framework_development_job"));
    }

    @Test
    void inactiveActorsCannotBeAssignedAndReactivationIsSerializedWithDeactivation() throws Exception {
        jdbc.update("""
            insert into framework_actor_definition(
              actor_code,actor_name,actor_name_en,actor_type,purpose,capability_codes,
              delegation_allowed,use_at,responsibility_text,accountability_text,
              competency_requirements,conflict_actor_codes,max_concurrent_assignments,review_cycle_days)
            values('TARGET_ACTOR','Target','Target','BUSINESS','target','','false','N',
              'target','target','target','',1,365)
            """);
        Map<String,Object> assignment=Map.of(
            "accountId","target-user","tenantId","TENANT_A","projectId","*",
            "actorCode","target_actor");

        SecurityException inactive=assertThrows(SecurityException.class,()->
            transaction.execute(status->{service.assignActor(assignment);return null;}));
        assertEquals("ACTIVE_ACTOR_NOT_FOUND",inactive.getMessage());
        assertEquals(0,count("framework_account_actor_assignment"));

        transaction.execute(status->service.createActor(Map.of(
            "actorCode","TARGET_ACTOR","actorName","Target","purpose","target","useAt","Y"),
            "authenticated-admin"));
        transaction.execute(status->{service.assignActor(assignment);return null;});
        assertEquals(1,count("framework_account_actor_assignment"));

        IllegalArgumentException assigned=assertThrows(IllegalArgumentException.class,()->
            transaction.execute(status->service.createActor(Map.of(
                "actorCode","TARGET_ACTOR","actorName","Target","purpose","target","useAt","N"),
                "authenticated-admin")));
        assertEquals("ACTIVE_ACTOR_ASSIGNMENTS_EXIST",assigned.getMessage());
        assertEquals("Y",jdbc.queryForObject(
            "select use_at from framework_actor_definition where actor_code='TARGET_ACTOR'",
            String.class));
    }

    @Test
    void concurrentAssignmentCompletesBeforeActorDeactivationCanCommit() throws Exception {
        jdbc.update("""
            insert into framework_actor_definition(
              actor_code,actor_name,actor_name_en,actor_type,purpose,capability_codes,
              delegation_allowed,use_at,responsibility_text,accountability_text,
              competency_requirements,conflict_actor_codes,max_concurrent_assignments,review_cycle_days)
            values('RACE_ACTOR','Race','Race','BUSINESS','race','','false','Y',
              'race','race','race','',1,365)
            """);
        var assigned=new java.util.concurrent.CountDownLatch(1);
        var releaseAssignment=new java.util.concurrent.CountDownLatch(1);
        var executor=Executors.newFixedThreadPool(2);
        try {
            var assignmentFuture=executor.submit(()->transaction.execute(status->{
                service.assignActor(Map.of(
                    "accountId","race-user","tenantId","TENANT_A","projectId","*",
                    "actorCode","RACE_ACTOR"));
                assigned.countDown();
                try { assertTrue(releaseAssignment.await(5,TimeUnit.SECONDS)); }
                catch(InterruptedException interrupted){
                    Thread.currentThread().interrupt();throw new IllegalStateException(interrupted);
                }
                return true;
            }));
            assertTrue(assigned.await(5,TimeUnit.SECONDS));
            var deactivateFuture=executor.submit(()->assertThrows(IllegalArgumentException.class,()->
                transaction.execute(status->service.createActor(Map.of(
                    "actorCode","RACE_ACTOR","actorName","Race","purpose","race","useAt","N"),
                    "authenticated-admin"))));
            Thread.sleep(250);
            assertEquals(false,deactivateFuture.isDone());
            releaseAssignment.countDown();
            assertTrue(assignmentFuture.get(5,TimeUnit.SECONDS));
            assertEquals("ACTIVE_ACTOR_ASSIGNMENTS_EXIST",
                deactivateFuture.get(5,TimeUnit.SECONDS).getMessage());
            assertEquals("Y",jdbc.queryForObject(
                "select use_at from framework_actor_definition where actor_code='RACE_ACTOR'",
                String.class));
            assertEquals(1,count("framework_account_actor_assignment"));
        } finally {
            releaseAssignment.countDown();
            executor.shutdownNow();
        }
    }

    @Test
    void processOwnerReferenceCommitsBeforeConcurrentActorDeactivationRefreshesIt()
            throws Exception {
        insertActor("RACE_OWNER");
        LinkedHashMap<String,Object> body=new LinkedHashMap<>(processBody("race owner"));
        body.put("processCode","RACE_PROCESS");
        body.put("processName","Race process");
        body.put("ownerActorCode","RACE_OWNER");
        var referenceSaved=new java.util.concurrent.CountDownLatch(1);
        var releaseReference=new java.util.concurrent.CountDownLatch(1);
        var executor=Executors.newFixedThreadPool(2);
        try {
            var processFuture=executor.submit(()->transaction.execute(status->{
                Map<String,Object> saved=service.createProcess(body,"authenticated-admin");
                referenceSaved.countDown();
                try { assertTrue(releaseReference.await(5,TimeUnit.SECONDS)); }
                catch(InterruptedException interrupted){
                    Thread.currentThread().interrupt();throw new IllegalStateException(interrupted);
                }
                return saved;
            }));
            assertTrue(referenceSaved.await(5,TimeUnit.SECONDS));
            var deactivateFuture=executor.submit(()->assertThrows(
                org.springframework.dao.DataAccessException.class,()->
                transaction.execute(status->service.createActor(Map.of(
                    "actorCode","RACE_OWNER","actorName","Race owner",
                    "purpose","race owner","useAt","N"),"authenticated-admin"))));
            Thread.sleep(250);
            assertEquals(false,deactivateFuture.isDone());
            releaseReference.countDown();
            processFuture.get(5,TimeUnit.SECONDS);
            assertTrue(deactivateFuture.get(5,TimeUnit.SECONDS).getMessage()
                .contains("process actor reference is not exact"));
            assertEquals("Y",jdbc.queryForObject(
                "select use_at from framework_actor_definition where actor_code='RACE_OWNER'",
                String.class));
            assertEquals("RACE_OWNER",jdbc.queryForObject(
                "select owner_actor_code from framework_process_definition "+
                    "where process_code='RACE_PROCESS'",String.class));
        } finally {
            releaseReference.countDown();
            executor.shutdownNow();
        }
    }

    @Test
    void stepActorReferenceCommitsBeforeConcurrentActorDeactivationRefreshesIt()
            throws Exception {
        insertActor("RACE_STEP_ACTOR");
        LinkedHashMap<String,Object> body=new LinkedHashMap<>(stepBody("RACE_STEP",2));
        body.put("actorCode","RACE_STEP_ACTOR");
        var referenceSaved=new java.util.concurrent.CountDownLatch(1);
        var releaseReference=new java.util.concurrent.CountDownLatch(1);
        var executor=Executors.newFixedThreadPool(2);
        try {
            var stepFuture=executor.submit(()->transaction.execute(status->{
                Map<String,Object> saved=service.addStep(body,"authenticated-admin");
                referenceSaved.countDown();
                try { assertTrue(releaseReference.await(5,TimeUnit.SECONDS)); }
                catch(InterruptedException interrupted){
                    Thread.currentThread().interrupt();throw new IllegalStateException(interrupted);
                }
                return saved;
            }));
            assertTrue(referenceSaved.await(5,TimeUnit.SECONDS));
            var deactivateFuture=executor.submit(()->assertThrows(
                org.springframework.dao.DataAccessException.class,()->
                transaction.execute(status->service.createActor(Map.of(
                    "actorCode","RACE_STEP_ACTOR","actorName","Race step actor",
                    "purpose","race step","useAt","N"),"authenticated-admin"))));
            Thread.sleep(250);
            assertEquals(false,deactivateFuture.isDone());
            releaseReference.countDown();
            stepFuture.get(5,TimeUnit.SECONDS);
            assertTrue(deactivateFuture.get(5,TimeUnit.SECONDS).getMessage()
                .contains("process actor reference is not exact"));
            assertEquals("Y",jdbc.queryForObject(
                "select use_at from framework_actor_definition "+
                    "where actor_code='RACE_STEP_ACTOR'",String.class));
            assertEquals("RACE_STEP_ACTOR",jdbc.queryForObject(
                "select actor_code from framework_process_step "+
                    "where process_code='PROC' and step_code='RACE_STEP'",String.class));
        } finally {
            releaseReference.countDown();
            executor.shutdownNow();
        }
    }

    @Test
    void conflictActorReferenceCommitsBeforeConcurrentDeactivationIsRejected()
            throws Exception {
        insertActor("RACE_CONFLICT");
        var referenceSaved=new java.util.concurrent.CountDownLatch(1);
        var releaseReference=new java.util.concurrent.CountDownLatch(1);
        var executor=Executors.newFixedThreadPool(2);
        try {
            var conflictFuture=executor.submit(()->transaction.execute(status->{
                Map<String,Object> saved=service.createActor(Map.of(
                    "actorCode","RACE_SOURCE","actorName","Race source",
                    "purpose","race source","useAt","Y",
                    "conflictActorCodes","RACE_CONFLICT"),"authenticated-admin");
                referenceSaved.countDown();
                try { assertTrue(releaseReference.await(5,TimeUnit.SECONDS)); }
                catch(InterruptedException interrupted){
                    Thread.currentThread().interrupt();throw new IllegalStateException(interrupted);
                }
                return saved;
            }));
            assertTrue(referenceSaved.await(5,TimeUnit.SECONDS));
            var deactivateFuture=executor.submit(()->assertThrows(
                IllegalArgumentException.class,()->transaction.execute(status->
                    service.createActor(Map.of(
                        "actorCode","RACE_CONFLICT","actorName","Race conflict",
                        "purpose","race conflict","useAt","N"),
                        "authenticated-admin"))));
            Thread.sleep(250);
            assertEquals(false,deactivateFuture.isDone());
            releaseReference.countDown();
            conflictFuture.get(5,TimeUnit.SECONDS);
            assertTrue(deactivateFuture.get(5,TimeUnit.SECONDS).getMessage()
                .contains("ACTIVE_ACTOR_CONFLICT_REFERENCES_EXIST"));
            assertEquals("Y",jdbc.queryForObject(
                "select use_at from framework_actor_definition "+
                    "where actor_code='RACE_CONFLICT'",String.class));
            assertEquals("RACE_CONFLICT",jdbc.queryForObject(
                "select conflict_actor_codes from framework_actor_definition "+
                    "where actor_code='RACE_SOURCE'",String.class));
        } finally {
            releaseReference.countDown();
            executor.shutdownNow();
        }
    }

    @Test
    void requirementOwnedOmittedStepIsRemovedButManualStepOmissionRollsBack(){
        Map<String,Object> result=transaction.execute(status->{
            service.createProcessForRequirementImport(
                processBody("requirement revision"),"requirement-importer");
            LinkedHashMap<String,Object> generated=new LinkedHashMap<>(stepBody("OLD_STEP",2));
            generated.put("decisionRule","SOURCE:REQUIREMENT_DOCUMENT");
            service.addStepForRequirementImport(generated,"requirement-importer");
            Map<String,Object> reconciled=service.reconcileRequirementImportSteps(
                "PROC",java.util.Set.of("STEP"),"requirement-importer");
            Map<String,Object> publication=service.finalizeAndQueueProcessDesign(
                "PROC","requirement-importer","REQUIREMENT_PROCESS_CONTRACT");
            return Map.of("reconciled",reconciled,"publication",publication);
        });
        assertEquals(1,((Map<?,?>)result.get("reconciled")).get("removedStepCount"));
        assertEquals(1,jdbc.queryForObject(
            "select count(*) from framework_process_step where process_code='PROC'",Integer.class));
        assertEquals("QUEUED",((Map<?,?>)result.get("publication")).get("status"));
        assertEquals(1,count("framework_development_job"));

        IllegalStateException manual=assertThrows(IllegalStateException.class,()->
            transaction.execute(status->{
                service.createProcessForRequirementImport(
                    processBody("forged omission"),"requirement-importer");
                return service.reconcileRequirementImportSteps(
                    "PROC",java.util.Set.of("OTHER_STEP"),"requirement-importer");
            }));
        assertTrue(manual.getMessage().contains("MANUAL_PROCESS_STEP_OMISSION_FORBIDDEN"));
        assertEquals("requirement revision",jdbc.queryForObject(
            "select goal from framework_process_definition where process_code='PROC'",String.class));
        assertEquals(1,jdbc.queryForObject(
            "select count(*) from framework_process_step where process_code='PROC'",Integer.class));
        assertEquals(1,count("framework_development_job"));
    }

    @Test
    void directRefreshBlocksBehindTheCanonicalProcessPublicationLock() throws Exception {
        var lockConnection=dataSource.getConnection();
        var executor=Executors.newSingleThreadExecutor();
        try {
            lockConnection.setAutoCommit(false);
            lockConnection.createStatement().execute("select pg_advisory_lock("+
                "hashtextextended('CANONICAL_PROCESS_PUBLICATION_V1:PROC',0))");
            JdbcTemplate contenderJdbc=new JdbcTemplate(dataSource);
            TransactionTemplate contenderTransaction=new TransactionTemplate(
                new DataSourceTransactionManager(dataSource));
            var future=executor.submit(()->contenderTransaction.execute(status->
                contenderJdbc.queryForObject("select "+schema+
                    ".framework_refresh_process_execution_specs('PROC','worker')::text",
                    String.class)));
            Thread.sleep(250);
            assertEquals(false,future.isDone());
            lockConnection.createStatement().execute("select pg_advisory_unlock("+
                "hashtextextended('CANONICAL_PROCESS_PUBLICATION_V1:PROC',0))");
            lockConnection.commit();
            assertTrue(future.get(5,TimeUnit.SECONDS).contains("\"processCode\": \"PROC\""));
        } finally {
            executor.shutdownNow();
            lockConnection.close();
        }
    }

    @Test
    void lockedGuardRejectsForgedGucButControlledServiceRevisionQueuesOneJob(){
        jdbc.update("update framework_process_definition set definition_locked=true "+
            "where process_code='PROC'");
        assertThrows(org.springframework.dao.DataAccessException.class,()->
            transaction.execute(status->{
                jdbc.queryForObject("select set_config("+
                    "'carbonet.process_design_revision','PROC',true)",String.class);
                jdbc.update("update framework_process_step set step_name='forged' "+
                    "where process_code='PROC' and step_code='STEP'");
                return null;
            }));
        assertEquals("STEP",jdbc.queryForObject(
            "select step_name from framework_process_step where step_code='STEP'",String.class));

        Map<String,Object> changed=transaction.execute(status->
            service.createProcess(processBody("guarded revision"),"authenticated-admin"));
        assertEquals("QUEUED",changed.get("status"));
        assertEquals(1,changed.get("jobCount"));
        assertEquals(Boolean.TRUE,jdbc.queryForObject(
            "select definition_locked from framework_process_definition where process_code='PROC'",
            Boolean.class));
        assertEquals("1.0.1",jdbc.queryForObject(
            "select process_version from framework_process_definition where process_code='PROC'",
            String.class));
    }

    private static Map<String,Object> processBody(String goal){
        return Map.ofEntries(
            Map.entry("processCode","PROC"),Map.entry("processName","Process"),
            Map.entry("domainCode","DOMAIN"),Map.entry("version","1.0.0"),
            Map.entry("goal",goal),Map.entry("startCondition","start"),
            Map.entry("completionCondition","complete"),
            Map.entry("ownerActorCode","OWNER_ACTOR"),
            Map.entry("processStatus","DEVELOPMENT_READY"),
            Map.entry("lifecycleStatus","VALIDATED"));
    }

    private static Map<String,Object> stepBody(String step,int order){
        return Map.ofEntries(
            Map.entry("processCode","PROC"),Map.entry("stepCode",step),
            Map.entry("stepOrder",order),Map.entry("stepName",step),
            Map.entry("actorCode","PRIMARY_ACTOR"),Map.entry("fromState","DRAFT"),
            Map.entry("commandCode","EXECUTE_"+step),Map.entry("toState","DONE"),
            Map.entry("completionRule","complete"),Map.entry("requirementText","requirement"),
            Map.entry("inputContract","{\"input\":\"string\"}"),
            Map.entry("outputContract","{\"output\":\"string\"}"),
            Map.entry("requiresApi",true),Map.entry("apiContract","POST /api/items"),
            Map.entry("escalationActorCode","ESCALATION_ACTOR"),
            Map.entry("segregationActorCodes","segregation_actor, OWNER_ACTOR,segregation_actor"));
    }

    private String jobHead(){
        return jdbc.queryForObject(
            "select specification_json::jsonb->>'processInputHash' from framework_development_job",
            String.class);
    }

    private int count(String table){
        return jdbc.queryForObject("select count(*) from "+table,Integer.class);
    }

    private void insertActor(String actorCode){
        jdbc.update("""
            insert into framework_actor_definition(
              actor_code,actor_name,actor_name_en,actor_type,purpose,capability_codes,
              delegation_allowed,use_at,responsibility_text,accountability_text,
              competency_requirements,conflict_actor_codes,max_concurrent_assignments,
              review_cycle_days)
            values(?,?,?,'BUSINESS',?,'',false,'Y',?,?,?,'',1,365)
            """,actorCode,actorCode,actorCode,actorCode+" purpose",
            actorCode+" responsibility",actorCode+" accountability",
            actorCode+" competency");
    }

    private void seedStep(String step,int order,String completeness,boolean professional){
        jdbc.update("""
            insert into framework_process_step(
              process_code,step_order,step_code,step_name,step_type,actor_code,
              from_state,command_code,to_state,completion_rule,requirement_text,
              input_contract,output_contract,requires_user_page,requires_admin_page,
              requires_api,user_path,api_contract,escalation_actor_code,
              segregation_actor_codes)
            values('PROC',?,?,?,'TASK','PRIMARY_ACTOR','DRAFT',?,'DONE','complete','requirement',
              '{"input":"string"}','{"output":"string"}',true,false,true,?,
              'POST /api/items','ESCALATION_ACTOR','SEGREGATION_ACTOR')
            """,order,step,step,"EXECUTE_"+step,"/"+step.toLowerCase());
        jdbc.update("""
            insert into framework_step_schema_set(
              process_code,step_code,schema_hash,input_schema,output_schema,field_schema,
              persistence_schema,handoff_schema,context_keys,completeness_status,blocker_codes)
            values('PROC',?,?,'{"input":"string"}','{"output":"string"}','[]',
              '{"entity":"item"}','[]','[]',?,case when ?='COMPLETE' then '[]'::jsonb
                else '["STEP_SCHEMA_INCOMPLETE"]'::jsonb end)
            """,step,(professional?"b":"c").repeat(64),completeness,completeness);
    }

    @SuppressWarnings("unchecked")
    private Map<String,Object> refresh(){
        String json=jdbc.queryForObject(
            "select framework_refresh_process_execution_specs('PROC','system-admin')::text",
            String.class);
        try{return new com.fasterxml.jackson.databind.ObjectMapper().readValue(json,Map.class);}
        catch(Exception error){throw new IllegalStateException(error);}
    }

    private void reconcileRequirementOwnedProfessionalContracts(){
        invokeRequirementReconciler("reconcileRequirementOwnedProfessionalContracts",
            new Class<?>[]{String.class,String.class},"PROC","BACKSTAGE_REQUIREMENT_AUTOMATION");
    }

    private void reconcileRequirementOwnedPageDesigns(){
        invokeRequirementReconciler("reconcileRequirementOwnedPageDesigns",
            new Class<?>[]{String.class},"PROC");
    }

    private void reconcileRequirementOwnedBlueprints(){
        invokeRequirementReconciler("reconcileRequirementOwnedBlueprints",
            new Class<?>[]{String.class,String.class},"PROC","BACKSTAGE_REQUIREMENT_AUTOMATION");
    }

    private void invokeRequirementReconciler(String name,Class<?>[] types,Object... args){
        try{
            var method=ActorProcessGovernanceService.class.getDeclaredMethod(name,types);
            method.setAccessible(true);
            method.invoke(service,args);
        }catch(java.lang.reflect.InvocationTargetException error){
            if(error.getCause() instanceof RuntimeException runtime)throw runtime;
            throw new IllegalStateException(error.getCause());
        }catch(ReflectiveOperationException error){
            throw new IllegalStateException(error);
        }
    }

    private String text(String expression){
        return jdbc.queryForObject("select "+expression+" from framework_step_execution_spec "+
            "where process_code='PROC' and step_code='STEP'",String.class);
    }

    private static int number(Map<String,Object> row,String key){
        return ((Number)row.get(key)).intValue();
    }

    private void createSchema(){
        jdbc.execute("""
            create table framework_actor_definition(
              actor_code text primary key,actor_name text not null,actor_name_en text,
              actor_type text not null,purpose text not null,capability_codes text not null,
              delegation_allowed boolean not null,use_at char(1) not null,
              responsibility_text text not null,accountability_text text not null,
              competency_requirements text not null,conflict_actor_codes text not null,
              max_concurrent_assignments integer not null,review_cycle_days integer not null,
              created_at timestamp default current_timestamp,updated_at timestamp default current_timestamp)
            """);
        jdbc.execute("""
            create table framework_account_actor_assignment(
              assignment_id bigserial primary key,account_id text not null,tenant_id text not null,
              project_id text not null,actor_code text not null,data_scope text not null default '*',
              valid_from date default current_date,valid_until date,
              assignment_status text not null default 'ACTIVE',
              unique(account_id,tenant_id,project_id,actor_code))
            """);
        jdbc.execute("""
            create table framework_process_definition(
              process_code text primary key,process_name text not null,domain_code text not null,
              process_version text not null default '1.0.0',goal text not null,start_condition text not null,
              completion_condition text not null,definition_locked boolean not null default false,
              owner_actor_code text,risk_level text,sla_hours integer,regulation_refs text,
              parent_process_code text,process_level integer default 1,
              automation_mode text default 'ASSISTED',development_order integer default 0,
              prerequisite_codes text default '',process_status text default 'DRAFT',
              review_cycle_days integer default 365,lifecycle_status text default 'DRAFT',
              effective_from date,effective_until date,
              created_at timestamp default current_timestamp,updated_at timestamp default current_timestamp)
            """);
        jdbc.execute("create table framework_business_work_type("+
            "work_type_code text primary key,work_type_name text not null,"+
            "work_type_name_en text not null default '',description text not null default '',"+
            "sort_order integer not null default 100,use_at char(1) not null,"+
            "created_at timestamp default current_timestamp,"+
            "updated_at timestamp default current_timestamp)");
        jdbc.update("insert into framework_business_work_type("+
            "work_type_code,work_type_name,use_at) values('DOMAIN','Domain','Y')");
        jdbc.execute("""
            create table framework_business_process_sequence(
              work_type_code text not null,process_code text primary key,
              workflow_order integer not null,workflow_phase text not null,
              process_role text not null,prerequisite_process_codes text,
              next_process_code text,sequence_status text not null,
              updated_at timestamp default current_timestamp,
              unique(work_type_code,workflow_order))
            """);
        jdbc.execute("""
            create table framework_process_step(
              process_code text,step_order integer,step_code text,step_name text,parent_step_code text,
              step_type text,actor_code text,from_state text,command_code text,to_state text,
              completion_rule text,requirement_text text,input_contract text,output_contract text,
              requires_user_page boolean,requires_admin_page boolean,requires_api boolean,
              requires_database boolean default false,requires_notification boolean default false,
              user_path text,admin_path text,api_contract text,escalation_actor_code text,
              automation_status text default 'PLANNED',sla_hours integer default 0,
              evidence_required boolean default true,evidence_types text default '',
              segregation_actor_codes text,rollback_command_code text default '',
              decision_rule text default '',created_at timestamp default current_timestamp,
              updated_at timestamp default current_timestamp,primary key(process_code,step_code))
            """);
        jdbc.execute("""
            create table framework_step_schema_set(
              process_code text,step_code text,schema_hash text,input_schema jsonb,output_schema jsonb,
              field_schema jsonb,persistence_schema jsonb,handoff_schema jsonb,context_keys jsonb,
              completeness_status text,blocker_codes jsonb,primary key(process_code,step_code))
            """);
        jdbc.execute("""
            create table framework_simulation_case(
              case_code text primary key,process_code text,case_name text,case_type text,
              preconditions text,steps_json text,assertions_json text,case_status text)
            """);
        jdbc.execute("""
            create table framework_page_design(
              page_design_id bigserial primary key,process_code text,step_code text,audience text,
              page_code text,page_title text,page_purpose text,screen_type text,
              planned_route_path text,actual_route_path text,route_status text,primary_entity text,
              actor_code text,upstream_step_code text,downstream_step_code text,
              entry_condition text,exit_condition text,
              responsive_contract jsonb,accessibility_contract jsonb,security_contract jsonb,
              exception_contract jsonb,design_status text default 'DESIGN_COMPLETE',
              updated_by text default 'PAGE_FIELD_DESIGN_FACTORY',
              updated_at timestamp default current_timestamp)
            """);
        jdbc.execute("""
            create table comtnthemedefinition(
              theme_id text primary key,use_at char(1),is_active char(1))
            """);
        jdbc.execute("""
            create table framework_screen_resource(
              screen_resource_id bigserial primary key,route_key text unique,
              layout_type text,source_kind text)
            """);
        jdbc.execute("""
            create table framework_screen_blueprint(
              blueprint_id bigserial primary key,blueprint_code text unique,
              process_code text,step_code text,
              actor_code text,audience text,page_id text,page_name text,route_path text,
              screen_type text,template_code text,specification_json text,traceability_json text,
              validation_status text,validation_message text,implementation_strategy text,
              source_reference text,transition_status text,created_by text,
              updated_at timestamp default current_timestamp,
              unique(process_code,step_code,audience),unique(audience,route_path))
            """);
        jdbc.execute("""
            create table framework_process_step_screen_binding(
              binding_id bigserial primary key,process_code text,step_code text,
              screen_resource_id bigint,actor_code text,audience text,binding_status text,
              updated_at timestamp default current_timestamp)
            """);
        jdbc.execute("""
            create table framework_professional_screen_contract(
              contract_id bigserial primary key,process_code text,step_code text,audience text,
              route_path text not null default '/step',screen_name text not null default 'Screen',
              actor_code text not null default 'PRIMARY_ACTOR',
              business_purpose text not null default 'Business purpose',
              entry_condition text not null default 'Entry',exit_condition text not null default 'Exit',
              kpi_contract text not null default '[]',section_contract text not null default '[]',
              field_contract text not null default '[]',command_contract text not null default '[]',
              state_contract text not null default '[]',api_contract text not null default '[]',
              data_contract text not null default '[]',evidence_contract text not null default '[]',
              responsive_contract text not null default '',accessibility_contract text not null default '',
              security_contract text not null default '',updated_by text not null default 'SYSTEM',
              updated_at timestamp default current_timestamp,
              unique(process_code,step_code,audience,route_path))
            """);
        jdbc.execute("""
            create table framework_step_execution_spec(
              process_code text,step_code text,spec_version integer,actor_contract jsonb,
              business_contract jsonb,transition_contract jsonb,input_contract jsonb,
              output_contract jsonb,screen_contract jsonb,field_contract jsonb,
              command_contract jsonb,api_contract jsonb,persistence_contract jsonb,
              handoff_contract jsonb,test_contract jsonb,guide_contract jsonb,
              nonfunctional_contract jsonb,design_status text,approval_status text,
              generation_status text,blocker_codes jsonb,source_hash text,approved_by text,
              approved_at timestamp,created_at timestamp default current_timestamp,
              updated_at timestamp default current_timestamp,primary key(process_code,step_code))
            """);
        jdbc.execute("""
            create table framework_development_job(
              job_id bigserial primary key,process_code text,step_code text,job_type text,job_name text,
              target_path text,specification_json text,job_status text,approval_status text,
              execution_mode text,job_group_code text,required boolean,progress_weight integer,
              max_attempts integer,quality_status text,created_by text,worker_id text,lease_token text,
              lease_until timestamp,attempt_count integer default 0,started_at timestamp,
              completed_at timestamp,result_json text default '{}',evidence_ref text,rollback_ref text,
              last_error text,quality_report text default '{}',updated_at timestamp default current_timestamp)
            """);
        jdbc.execute("""
            create table framework_actor_process_design_release(
              release_id bigserial primary key,project_id text not null,
              design_version integer not null,contract_sha256 text not null,
              contract_payload jsonb not null,source_system text default 'BACKSTAGE',
              release_status text not null,received_at timestamp default current_timestamp,
              applied_at timestamp,generation_result jsonb,
              unique(project_id,design_version))
            """);
        jdbc.execute("""
            create table framework_development_job_gate_result(
              result_id bigserial primary key,job_id bigint,gate_code text,result text)
            """);
        jdbc.execute("""
            create table framework_process_artifact(
              artifact_id bigserial primary key,process_code text,step_code text,artifact_code text,
              artifact_type text,artifact_name text,target_path text,contract_ref text,required boolean,
              delivery_status text,owner_actor_code text,acceptance_criteria text,notes text,
              evidence_ref text,updated_at timestamp default current_timestamp)
            """);
        jdbc.execute("""
            create function framework_try_jsonb(value text) returns jsonb language plpgsql immutable as $$
            begin return value::jsonb; exception when others then return null; end $$
            """);
        jdbc.execute("""
            create function framework_design_causality_csv_set(value text)
            returns jsonb language sql immutable as $$
              select coalesce(jsonb_agg(item order by item collate "C"),'[]'::jsonb)
                from (select distinct upper(btrim(part)) item
                        from regexp_split_to_table(coalesce(value,''),',') part
                       where btrim(part)<>'') normalized
            $$
            """);
        jdbc.execute("""
            create function framework_step_permission_requirements(process text,step text)
            returns jsonb language sql stable as $$ select '[]'::jsonb $$
            """);
        jdbc.execute("""
            create function framework_refresh_step_schema_set(
              process text,step text,reason text,enqueue boolean)
            returns jsonb language sql as $$ select jsonb_build_object('success',true) $$
            """);
        jdbc.execute("""
            create function framework_process_generation_input(requested_process text)
            returns jsonb language sql stable as $$
              with ordered as (
                select step.step_order,spec.*,
                       spec.design_status='DESIGN_COMPLETE'
                         and spec.approval_status='APPROVED'
                         and spec.generation_status in('READY','GENERATED') eligible
                  from framework_process_step step
                  join framework_step_execution_spec spec using(process_code,step_code)
                 where step.process_code=requested_process
              ), payload as (
                select coalesce(jsonb_agg(to_jsonb(ordered)-'created_at'-'updated_at'-
                         'source_hash'-'spec_version'-'eligible'-'generation_status'
                         order by step_order,step_code),'[]'::jsonb) value,
                       count(*)::integer step_count,
                       count(*) filter(where eligible)::integer ready_count,
                       (array_agg(step_code order by step_order,step_code)
                         filter(where eligible))[1] coordinator,
                       (select count(*)::integer
                          from framework_professional_screen_contract contract
                          join ordered eligible_step
                            on eligible_step.process_code=contract.process_code
                           and eligible_step.step_code=contract.step_code
                           and eligible_step.eligible) endpoints
                  from ordered
              ), head as (
                select encode(sha256(convert_to(
                         (select (to_jsonb(process)-'created_at'-'updated_at')::text
                            from framework_process_definition process
                           where process.process_code=requested_process)||payload.value::text,
                         'UTF8')),'hex') input_hash,payload.* from payload
              )
              select jsonb_build_object(
                'processInputHash',input_hash,'designSetHash',repeat('1',64),
                'designCatalogHash',repeat('2',64),'designCatalogTextHash',repeat('3',64),
                'endpointCatalogHash',repeat('4',64),'endpointCatalogTextHash',repeat('5',64),
                'coordinatorStep',coordinator,'processStepCount',step_count,
                'generationReadyStepCount',ready_count,'processEndpointExpected',endpoints,
                'screenCount',1) from head
            $$
            """);
    }

    private void applyMigration(String relative,boolean qualifyPublic) throws Exception {
        String migration=Files.readString(findRepositoryFile(relative));
        if(qualifyPublic)migration=migration
            .replace("public.",schema+".")
            .replace("search_path = pg_catalog, public","search_path = pg_catalog, "+schema);
        jdbc.execute(migration);
    }

    private static final class PausingJdbcTemplate extends JdbcTemplate {
        private final CountDownLatch headRead;
        private final CountDownLatch continueReconcile;

        private PausingJdbcTemplate(DriverManagerDataSource source,
                CountDownLatch headRead,CountDownLatch continueReconcile){
            super(source);
            this.headRead=headRead;
            this.continueReconcile=continueReconcile;
        }

        @Override public List<Map<String,Object>> queryForList(String sql,Object... args){
            List<Map<String,Object>> rows=super.queryForList(sql,args);
            if(sql.contains("with release as (")&&sql.contains("left join framework_development_job")){
                headRead.countDown();
                try{
                    if(!continueReconcile.await(5,TimeUnit.SECONDS))
                        throw new IllegalStateException("release CAS test timed out");
                }catch(InterruptedException error){
                    Thread.currentThread().interrupt();
                    throw new IllegalStateException(error);
                }
            }
            return rows;
        }
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
