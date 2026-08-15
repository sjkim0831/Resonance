package egovframework.com.platform.governance.service;

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
import java.util.List;
import java.util.Map;
import java.util.UUID;

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
    private JdbcTemplate admin;
    private JdbcTemplate jdbc;
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
        DriverManagerDataSource dataSource=new DriverManagerDataSource(
            url+separator+"currentSchema="+schema,user,password);
        jdbc=new JdbcTemplate(dataSource);
        transaction=new TransactionTemplate(new DataSourceTransactionManager(dataSource));
        service=new ActorProcessGovernanceService(jdbc,
            org.mockito.Mockito.mock(ScreenDevelopmentNoteService.class),
            org.mockito.Mockito.mock(egovframework.com.platform.codex.service.CodexProvisioningService.class),
            org.mockito.Mockito.mock(ScreenContractRuntimeService.class));
        createSchema();
        String migration=Files.readString(findRepositoryFile(MIGRATION))
            .replace("public.",schema+".")
            .replace("search_path = pg_catalog, public","search_path = pg_catalog, "+schema);
        jdbc.execute(migration);
    }

    @AfterAll
    void dropDisposableSchema(){
        if(admin!=null&&schema!=null)admin.execute("drop schema if exists "+schema+" cascade");
    }

    @BeforeEach
    void seed(){
        jdbc.execute("drop trigger if exists reject_direct_job on framework_development_job");
        jdbc.execute("truncate framework_development_job_gate_result,framework_development_job,"+
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
            insert into framework_professional_screen_contract(process_code,step_code)
            values('PROC','STEP')
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
    }

    @Test
    void refreshProjectsAllFourteenContractsAndPreservesProfessionalAuthority(){
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
        assertEquals("SAVE",text("command_contract->0->>'commandCode'"));
        assertEquals("/api/items",text("api_contract->0->>'path'"));
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
    void primaryOwnerEscalationAndSegregationActorMutationsEachChangeTheSpecHash(){
        refresh();
        for(String code:new String[]{"PRIMARY_ACTOR","OWNER_ACTOR","ESCALATION_ACTOR","SEGREGATION_ACTOR"}){
            String before=text("source_hash");
            jdbc.update("update framework_actor_definition set purpose=purpose||'-changed' where actor_code=?",code);
            refresh();
            String after=text("source_hash");
            assertNotEquals(before,after,code);
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
        String before=text("source_hash");
        jdbc.update("update framework_process_definition set goal='changed goal' where process_code='PROC'");
        refresh();
        assertNotEquals(before,text("source_hash"));
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
            "work_type_code text primary key,use_at char(1) not null)");
        jdbc.update("insert into framework_business_work_type values('DOMAIN','Y')");
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
              responsive_contract jsonb,accessibility_contract jsonb,security_contract jsonb,
              exception_contract jsonb)
            """);
        jdbc.execute("create table framework_professional_screen_contract(process_code text,step_code text)");
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
                       coalesce(sum(jsonb_array_length(api_contract))
                         filter(where eligible),0)::integer endpoints
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

    private static Path findRepositoryFile(String relative){
        Path cursor=Path.of("").toAbsolutePath();
        for(int depth=0;cursor!=null&&depth<8;depth++,cursor=cursor.getParent()){
            Path candidate=cursor.resolve(relative);
            if(Files.isRegularFile(candidate))return candidate;
        }
        throw new IllegalStateException("repository file not found: "+relative);
    }
}
