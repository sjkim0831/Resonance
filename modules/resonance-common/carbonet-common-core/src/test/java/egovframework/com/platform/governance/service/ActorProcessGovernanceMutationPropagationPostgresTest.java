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
import java.nio.charset.StandardCharsets;
import java.nio.file.LinkOption;
import java.nio.file.attribute.PosixFileAttributeView;
import java.nio.file.attribute.PosixFilePermission;
import java.security.MessageDigest;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.HexFormat;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicInteger;

import javax.imageio.ImageIO;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
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
    private static final String COMMON_DESIGN_STATE_MIGRATION=
        "apps/carbonet-api/src/main/resources/db/migration/postgresql/"+
        "V20260816133000__create_global_common_design_source_state.sql";
    private static final String INTEGRATED_DESIGN_REGISTRY_MIGRATION=
        "apps/carbonet-api/src/main/resources/db/migration/postgresql/"+
        "V20260728170000__create_integrated_design_document_registry.sql";
    private static final String COMPOSITE_DESIGN_MIGRATION=
        "apps/carbonet-api/src/main/resources/db/migration/postgresql/"+
        "V20260816154000__compile_composite_executable_design_authority.sql";
    private JdbcTemplate admin;
    private JdbcTemplate jdbc;
    private DriverManagerDataSource dataSource;
    private String schema;
    private TransactionTemplate transaction;
    private ActorProcessGovernanceService service;
    private Path lastLiveSmokeRoot;

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
        applyMigration(COMMON_DESIGN_STATE_MIGRATION,false);
        applyMigration(BLUEPRINT_ADOPTION_MIGRATION,false);
        applyMigration(BLUEPRINT_STRATEGY_MIGRATION,false);
        applyMigration(LOCK_GUARD_MIGRATION,false);
        applyMigration(LEGACY_SOURCE_HASH_MIGRATION,false);
        applyMigration(MIGRATION,true);
        applyMigration(REVISION_MIGRATION,true);
        applyMigration(INTEGRATED_DESIGN_REGISTRY_MIGRATION,false);
        installProjectRuntimeWriteFenceFixture();
        applyMigration(COMPOSITE_DESIGN_MIGRATION,false);
    }

    @AfterAll
    void dropDisposableSchema(){
        System.clearProperty("resonance.composite-live-smoke.evidence-root");
        if(admin!=null&&schema!=null)admin.execute("drop schema if exists "+schema+" cascade");
    }

    @BeforeEach
    void seed(){
        lastLiveSmokeRoot=null;
        System.clearProperty("resonance.composite-live-smoke.evidence-root");
        jdbc.execute("drop trigger if exists reject_direct_job on framework_development_job");
        jdbc.execute("drop table if exists item,approval,ticket cascade");
        jdbc.update("update comtnemplyrinfo set emplyr_sttus_code='P' "+
            "where emplyr_id='system-admin'");
        jdbc.update("""
            insert into framework_runtime_release_state(
              release_key,source_commit,deployment_namespace,deployment_name,deployment_uid,
              deployment_generation,observed_generation,desired_replicas,image_ref,image_id,
              health_status,recorded_by)
            values('CARBONET_RUNTIME',repeat('a',40),'carbonet-production','carbonet-runtime',
              'runtime-test-uid',1,1,2,'carbonet-runtime:test','sha256:'||repeat('b',64),
              'UP','POSTGRES_TEST')
            on conflict(release_key) do update set source_commit=excluded.source_commit,
              deployment_namespace=excluded.deployment_namespace,
              deployment_name=excluded.deployment_name,deployment_uid=excluded.deployment_uid,
              deployment_generation=excluded.deployment_generation,
              observed_generation=excluded.observed_generation,
              desired_replicas=excluded.desired_replicas,image_ref=excluded.image_ref,
              image_id=excluded.image_id,health_status=excluded.health_status,
              recorded_by=excluded.recorded_by,recorded_at=clock_timestamp()
            """);
        jdbc.execute("truncate integrated_design_notification_inbox,integrated_design_notification_outbox,"+
            "integrated_design_notification_template,integrated_design_autocompletion_receipt,"+
            "integrated_design_live_smoke_dispatch,"+
            "framework_process_execution_event,framework_process_execution,"+
            "framework_actor_process_design_release,framework_process_step_screen_binding,"+
            "framework_page_design_assurance,framework_screen_blueprint,framework_screen_resource,"+
            "framework_common_design_write_probe,framework_common_design_source_receipt,"+
            "framework_common_design_asset_source_state,"+
            "ui_page_component_map,ui_component_registry,ui_section_registry,ui_page_manifest,"+
            "comtnthemedefinition,"+
            "framework_project_actor_assignment,framework_account_actor_assignment,"+
            "integrated_design_live_smoke_evidence,integrated_design_scope_binding,"+
            "integrated_design_authority_version,"+
            "integrated_design_authority,integrated_design_document_version,integrated_design_document,"+
            "framework_permission_grant_v1,framework_permission_requirement_v1,"+
            "framework_development_job_event,framework_development_job_gate_result,framework_development_job,"+
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
    void globalCommonDesignCasAllowsOneCrossProjectWinnerAndZeroWriteLoser()
            throws Exception {
        Map<String,Object> base=themeAsset("GLOBAL_THEME","Global theme","#005ea8",List.of());
        seedCommonDesignAsset(base);
        Map<String,Object> proposalA=themeAsset(
            "GLOBAL_THEME","Global theme A","#1351b4",List.of());
        Map<String,Object> proposalB=themeAsset(
            "GLOBAL_THEME","Global theme B","#8a1c7c",List.of());
        CountDownLatch ready=new CountDownLatch(2),start=new CountDownLatch(1);
        var executor=Executors.newFixedThreadPool(2);
        java.util.concurrent.Callable<Object> left=()->{
            ready.countDown();start.await(5,TimeUnit.SECONDS);
            try{return transaction.execute(status->service.applyCommonDesignAssetSource(
                commonDesignSourceBody("PROJECT_A",base,proposalA),"system-admin"));}
            catch(RuntimeException error){return error;}
        };
        java.util.concurrent.Callable<Object> right=()->{
            ready.countDown();start.await(5,TimeUnit.SECONDS);
            try{return transaction.execute(status->service.applyCommonDesignAssetSource(
                commonDesignSourceBody("PROJECT_B",base,proposalB),"system-admin"));}
            catch(RuntimeException error){return error;}
        };
        var leftResult=executor.submit(left);var rightResult=executor.submit(right);
        assertTrue(ready.await(5,TimeUnit.SECONDS));start.countDown();
        Object first=leftResult.get(20,TimeUnit.SECONDS);
        Object second=rightResult.get(20,TimeUnit.SECONDS);
        executor.shutdownNow();

        List<Object> outcomes=List.of(first,second);
        assertEquals(1,outcomes.stream().filter(Map.class::isInstance).count());
        assertEquals(1,outcomes.stream().filter(Throwable.class::isInstance).count());
        Throwable loser=(Throwable)outcomes.stream().filter(Throwable.class::isInstance)
            .findFirst().orElseThrow();
        assertTrue(String.valueOf(loser.getMessage()).contains(
            "DESIGN_ASSET_GLOBAL_FINGERPRINT_CHANGED"));
        @SuppressWarnings("unchecked")
        Map<String,Object> winner=(Map<String,Object>)outcomes.stream()
            .filter(Map.class::isInstance).findFirst().orElseThrow();
        String winnerFingerprint=String.valueOf(winner.get("assetFingerprint"));
        assertEquals(winnerFingerprint,jdbc.queryForObject("""
            select trim(asset_fingerprint) from framework_common_design_asset_source_state
             where asset_type='THEME' and asset_id='GLOBAL_THEME'
            """,String.class));
        assertEquals(1,count("framework_common_design_write_probe"));
        assertEquals(1,count("framework_common_design_asset_source_state"));
        assertTrue(List.of("Global theme A","Global theme B").contains(
            jdbc.queryForObject("select theme_nm from comtnthemedefinition "+
                "where theme_id='GLOBAL_THEME'",String.class)));
    }

    @Test
    void commonDesignDependenciesRequireExactLockedShaForAllFourTypes(){
        Map<String,Object> theme=themeAsset("DEP_THEME","Theme dependency","#246beb",List.of());
        Map<String,Object> section=sectionAsset("DEP_SECTION","Section dependency");
        Map<String,Object> component=componentAsset("DEP_COMPONENT","Component dependency");
        Map<String,Object> screen=screenAsset("DEP_SCREEN","Screen dependency","/dep-screen");
        for(Map<String,Object> dependency:List.of(theme,section,component,screen))
            seedCommonDesignAsset(dependency);
        List<Map<String,Object>> dependencies=List.of(theme,section,component,screen).stream()
            .map(asset->Map.<String,Object>of(
                "assetType",asset.get("assetType"),"assetId",asset.get("assetId"),
                "fingerprint",ActorProcessGovernanceService.commonDesignAssetFingerprint(asset)))
            .toList();
        Map<String,Object> base=themeAsset(
            "TARGET_THEME","Target theme","#005ea8",dependencies);
        seedCommonDesignAsset(base);
        Map<String,Object> proposed=themeAsset(
            "TARGET_THEME","Target theme revised","#003b76",dependencies);
        List<Map<String,Object>> sourceHeads=transaction.execute(status->
            service.commonDesignAssetSourceHeads(
                "THEME","TARGET_THEME","",1));
        assertEquals(1,sourceHeads.size());
        assertEquals(ActorProcessGovernanceService.commonDesignAssetFingerprint(base),
            sourceHeads.get(0).get("fingerprint"));

        for(int index=0;index<dependencies.size();index++){
            List<Map<String,Object>> forged=new java.util.ArrayList<>(dependencies);
            Map<String,Object> original=dependencies.get(index);
            String wrong="f".repeat(64);
            assertNotEquals(original.get("fingerprint"),wrong);
            forged.set(index,Map.of(
                "assetType",original.get("assetType"),
                "assetId",original.get("assetId"),"fingerprint",wrong));
            Map<String,Object> forgedProposal=themeAsset(
                "TARGET_THEME","Target theme forged","#d50136",forged);
            IllegalStateException rejected=assertThrows(IllegalStateException.class,()->
                transaction.execute(status->service.applyCommonDesignAssetSource(
                    commonDesignSourceBody("PROJECT_A",base,forgedProposal),
                    "system-admin")));
            assertTrue(rejected.getMessage().contains(
                "DESIGN_ASSET_DEPENDENCY_FINGERPRINT_CHANGED"));
            assertEquals(0,count("framework_common_design_write_probe"));
            assertEquals(0,count("framework_development_job"));
            assertEquals("Target theme",jdbc.queryForObject(
                "select theme_nm from comtnthemedefinition where theme_id='TARGET_THEME'",
                String.class));
        }
        jdbc.update("""
            update framework_common_design_asset_source_state
               set asset_fingerprint=null
             where asset_type='THEME' and asset_id='TARGET_THEME'
            """);

        Map<String,Object> result=transaction.execute(status->
            service.applyCommonDesignAssetSource(
                commonDesignSourceBody("PROJECT_A",base,proposed),"system-admin"));

        assertEquals("APPLIED",result.get("status"));
        assertEquals(1,result.get("registryWrites"));
        assertEquals(1,result.get("sourceStateWrites"));
        assertEquals(5,count("framework_common_design_asset_source_state"));
        assertEquals(4,dependencies.stream().filter(dependency->{
            String actual=jdbc.queryForObject("""
                select trim(asset_fingerprint)
                  from framework_common_design_asset_source_state
                 where asset_type=? and asset_id=?
                """,String.class,dependency.get("assetType"),dependency.get("assetId"));
            return dependency.get("fingerprint").equals(actual);
        }).count());
    }

    @Test
    void screenSourceMaterializesExactCompositionFansOutAndRestoresRemovedEntries(){
        Map<String,Object> theme=themeAsset("DEP_THEME","Theme dependency","#246beb",List.of());
        Map<String,Object> primarySection=sectionAsset("DEP_SECTION","Primary section");
        Map<String,Object> secondarySection=sectionAsset("ALT_SECTION","Secondary section");
        Map<String,Object> primaryComponent=componentAsset("DEP_COMPONENT","Primary component");
        Map<String,Object> secondaryComponent=componentAsset("ALT_COMPONENT","Secondary component");
        for(Map<String,Object> dependency:List.of(theme,primarySection,secondarySection,
                primaryComponent,secondaryComponent))seedCommonDesignAsset(dependency);
        List<Map<String,Object>> dependencies=List.of(theme,primarySection,secondarySection,
                primaryComponent,secondaryComponent).stream().map(asset->Map.<String,Object>of(
                    "assetType",asset.get("assetType"),"assetId",asset.get("assetId"),
                    "fingerprint",ActorProcessGovernanceService.commonDesignAssetFingerprint(asset)))
            .toList();
        List<Map<String,Object>> baseSections=List.of(
            Map.of("sectionId","DEP_SECTION","zone","main-zone","displayOrder",10,
                "props",Map.of("width","wide")),
            Map.of("sectionId","ALT_SECTION","zone","aside-zone","displayOrder",20,
                "props",Map.of("width","narrow")));
        List<Map<String,Object>> baseComponents=List.of(
            Map.of("componentId","DEP_COMPONENT","sectionId","DEP_SECTION",
                "instanceKey","primary-form","displayOrder",10,
                "props",Map.of("dense",false),"condition","always"),
            Map.of("componentId","ALT_COMPONENT","sectionId","ALT_SECTION",
                "instanceKey","secondary-card","displayOrder",20,
                "props",Map.of("tone","quiet"),"condition","actor == 'PRIMARY_ACTOR'"));
        Map<String,Object> base=composedScreenAsset("PROC_STEP_USER","Step","/step",
            "v1","KRDS_WORKSPACE","DEP_THEME",baseSections,baseComponents,dependencies);
        seedCommonDesignAsset(base);
        seedGeneratedScreenIdentity("/step","PRIMARY_ACTOR");
        String baselineManifest=jdbc.queryForObject(
            "select component_schema from ui_page_manifest where page_id='PROC_STEP_USER'",
            String.class);
        Map<String,Object> proposed=composedScreenAsset("PROC_STEP_USER","Step revised","/step",
            "v2","KRDS_DETAIL_WORKSPACE","DEP_THEME",
            List.of(Map.of("sectionId","DEP_SECTION","zone","workspace-zone",
                "displayOrder",10,"props",Map.of("width","fluid","gap",24))),
            List.of(Map.of("componentId","DEP_COMPONENT","sectionId","DEP_SECTION",
                "instanceKey","primary-form","displayOrder",10,
                "props",Map.of("dense",true,"mode","edit"),
                "condition","permission == 'STEP_EDIT'")),dependencies);

        Map<String,Object> changed=transaction.execute(status->
            service.applyCommonDesignAssetSource(
                commonDesignSourceBody("PROJECT_A",base,proposed),"system-admin"));

        assertEquals(true,changed.get("sourceCommitted"));
        assertEquals(1,changed.get("affectedScreenCount"));
        assertEquals(1,changed.get("affectedProcessCount"));
        assertEquals(1,changed.get("canonicalWrites"));
        assertTrue(((Number)changed.get("compositionWrites")).intValue()>=3);
        assertEquals(1,changed.get("jobCount"));
        assertEquals(1,changed.get("endpointExpected"));
        assertEquals(1,jdbc.queryForObject(
            "select count(*) from ui_page_component_map where page_id='PROC_STEP_USER'",
            Integer.class));
        assertEquals(0,jdbc.queryForObject(
            "select count(*) from ui_page_component_map where page_id='PROC_STEP_USER' "+
                "and (component_id='ALT_COMPONENT' or instance_key='secondary-card')",
            Integer.class));
        assertEquals("workspace-zone",jdbc.queryForObject(
            "select layout_zone from ui_page_component_map where page_id='PROC_STEP_USER'",
            String.class));
        assertEquals(true,jdbc.queryForObject(
            "select instance_props::jsonb=cast(? as jsonb) from ui_page_component_map "+
                "where page_id='PROC_STEP_USER'",Boolean.class,
            json(Map.of("dense",true,"mode","edit"))));
        assertEquals("KRDS_DETAIL_WORKSPACE",jdbc.queryForObject(
            "select layout_version from ui_page_manifest where page_id='PROC_STEP_USER'",
            String.class));
        assertEquals(true,jdbc.queryForObject(
            "select component_schema::jsonb->'sections'=cast(? as jsonb) "+
                "from ui_page_manifest where page_id='PROC_STEP_USER'",Boolean.class,
            json(((Map<?,?>)proposed.get("payload")).get("sections"))));
        assertEquals(true,jdbc.queryForObject(
            "select specification_json::jsonb->'components'=cast(? as jsonb) "+
                "from framework_screen_blueprint where page_id='PROC_STEP_USER'",Boolean.class,
            json(((Map<?,?>)proposed.get("payload")).get("components"))));
        assertEquals(ActorProcessGovernanceService.commonDesignAssetFingerprint(proposed),
            jdbc.queryForObject("select trim(asset_fingerprint) "+
                "from framework_common_design_asset_source_state "+
                "where asset_type='SCREEN' and asset_id='PROC_STEP_USER'",String.class));

        Map<String,Object> changedDependency=componentAsset(
            "DEP_COMPONENT","Dependency changed after commit");
        jdbc.update("update ui_component_registry set component_name=? where component_id=?",
            changedDependency.get("assetName"),changedDependency.get("assetId"));
        jdbc.update("""
            update framework_common_design_asset_source_state
               set canonical_asset=cast(? as jsonb),asset_fingerprint=?
             where asset_type='COMPONENT' and asset_id='DEP_COMPONENT'
            """,json(changedDependency),
            ActorProcessGovernanceService.commonDesignAssetFingerprint(changedDependency));
        Map<String,Object> replay=transaction.execute(status->
            service.applyCommonDesignAssetSource(
                commonDesignSourceBody("PROJECT_A",base,proposed),"system-admin"));
        assertEquals(true,replay.get("idempotent"));
        assertEquals(true,replay.get("sourceCommitted"));
        assertEquals(0,replay.get("sourceStateWrites"));
        jdbc.update("update ui_component_registry set component_name=? where component_id=?",
            primaryComponent.get("assetName"),primaryComponent.get("assetId"));
        jdbc.update("""
            update framework_common_design_asset_source_state
               set canonical_asset=cast(? as jsonb),asset_fingerprint=?
             where asset_type='COMPONENT' and asset_id='DEP_COMPONENT'
            """,json(primaryComponent),
            ActorProcessGovernanceService.commonDesignAssetFingerprint(primaryComponent));

        Map<String,Object> restored=transaction.execute(status->
            service.applyCommonDesignAssetSource(
                commonDesignSourceBody("PROJECT_A",proposed,base),"system-admin"));

        assertEquals(true,restored.get("sourceCommitted"));
        assertEquals(2,jdbc.queryForObject(
            "select count(*) from ui_page_component_map where page_id='PROC_STEP_USER'",
            Integer.class));
        assertEquals(1,jdbc.queryForObject(
            "select count(*) from ui_page_component_map where page_id='PROC_STEP_USER' "+
                "and component_id='ALT_COMPONENT' and instance_key='secondary-card'",
            Integer.class));
        assertEquals(true,jdbc.queryForObject(
            "select component_schema::jsonb=cast(? as jsonb) from ui_page_manifest "+
                "where page_id='PROC_STEP_USER'",Boolean.class,baselineManifest));
        assertEquals(1,count("framework_development_job"));
    }

    @Test
    void declaredDependencyFansOutWhenItsComponentIsNotMaterializedOnTheScreen(){
        Map<String,Object> theme=themeAsset("DEP_THEME","Theme dependency","#246beb",List.of());
        Map<String,Object> section=sectionAsset("DEP_SECTION","Primary section");
        Map<String,Object> target=componentAsset("DEP_COMPONENT","Declared only component");
        Map<String,Object> visible=componentAsset("ALT_COMPONENT","Visible component");
        for(Map<String,Object> dependency:List.of(theme,section,target,visible))
            seedCommonDesignAsset(dependency);
        List<Map<String,Object>> dependencies=List.of(theme,section,target,visible).stream()
            .map(asset->Map.<String,Object>of(
                "assetType",asset.get("assetType"),"assetId",asset.get("assetId"),
                "fingerprint",ActorProcessGovernanceService.commonDesignAssetFingerprint(asset)))
            .toList();
        Map<String,Object> screen=composedScreenAsset("PROC_STEP_USER","Step","/step",
            "v1","KRDS_WORKSPACE","DEP_THEME",
            List.of(Map.of("sectionId","DEP_SECTION","zone","main-zone",
                "displayOrder",10,"props",Map.of())),
            List.of(Map.of("componentId","ALT_COMPONENT","sectionId","DEP_SECTION",
                "instanceKey","visible-card","displayOrder",10,"props",Map.of(),
                "condition","always")),dependencies);
        seedCommonDesignAsset(screen);
        seedGeneratedScreenIdentity("/step","PRIMARY_ACTOR");
        assertEquals(0,jdbc.queryForObject(
            "select count(*) from ui_page_component_map where component_id='DEP_COMPONENT'",
            Integer.class));
        Map<String,Object> proposal=componentAsset("DEP_COMPONENT","Declared component revised");
        @SuppressWarnings("unchecked")
        Map<String,Object> proposalPayload=new LinkedHashMap<>(
            (Map<String,Object>)proposal.get("payload"));
        proposalPayload.put("defaultProps",Map.of("dense",true,"revision",2));
        Map<String,Object> revisedProposal=new LinkedHashMap<>(proposal);
        revisedProposal.put("version","v2");
        revisedProposal.put("payload",proposalPayload);
        String screenFingerprintBefore=jdbc.queryForObject("""
            select trim(asset_fingerprint) from framework_common_design_asset_source_state
             where asset_type='SCREEN' and asset_id='PROC_STEP_USER'
            """,String.class);

        Map<String,Object> result=transaction.execute(status->
            service.applyCommonDesignAssetSource(
                commonDesignSourceBody("PROJECT_A",target,revisedProposal),"system-admin"));

        assertEquals(true,result.get("sourceCommitted"));
        assertEquals(1,result.get("affectedScreenCount"));
        assertEquals(1,result.get("affectedProcessCount"));
        assertEquals(1,result.get("canonicalWrites"));
        assertEquals(1,result.get("jobCount"));
        assertEquals(1,result.get("endpointExpected"));
        assertEquals(2,result.get("sourceStateWrites"));
        @SuppressWarnings("unchecked")
        List<Map<String,Object>> sourceSnapshots=
            (List<Map<String,Object>>)result.get("sourceSnapshots");
        assertEquals(2,sourceSnapshots.size());
        assertEquals(0,jdbc.queryForObject(
            "select count(*) from ui_page_component_map where component_id='DEP_COMPONENT'",
            Integer.class));
        assertEquals(1,jdbc.queryForObject(
            "select count(*) from framework_screen_blueprint "+
            "where specification_json::jsonb#>>'{sourceImmediateAssets,COMPONENT:DEP_COMPONENT,assetFingerprint}'=?",
            Integer.class,result.get("assetFingerprint")));
        Map<String,Object> screenHead=transaction.execute(status->
            service.commonDesignAssetSourceHeads("SCREEN","PROC_STEP_USER","",2).get(0));
        String screenFingerprintAfter=String.valueOf(screenHead.remove("fingerprint"));
        screenHead.remove("syncedAt");
        assertNotEquals(screenFingerprintBefore,screenFingerprintAfter);
        assertEquals(result.get("assetFingerprint"),jdbc.queryForObject("""
            select dependency->>'fingerprint'
              from framework_common_design_asset_source_state source
              cross join lateral jsonb_array_elements(
                source.canonical_asset#>'{payload,dependencies}') dependency
             where source.asset_type='SCREEN' and source.asset_id='PROC_STEP_USER'
               and dependency->>'assetType'='COMPONENT'
               and dependency->>'assetId'='DEP_COMPONENT'
            """,String.class));
        @SuppressWarnings("unchecked")
        Map<String,Object> editablePayload=new LinkedHashMap<>(
            (Map<String,Object>)screenHead.get("payload"));
        editablePayload.put("pageName","Step after dependency cascade");
        Map<String,Object> editableScreen=new LinkedHashMap<>(screenHead);
        editableScreen.put("assetName","Step after dependency cascade");
        editableScreen.put("version","v2");editableScreen.put("payload",editablePayload);
        Map<String,Object> edited=transaction.execute(status->
            service.applyCommonDesignAssetSource(commonDesignSourceBody(
                "PROJECT_A",screenHead,editableScreen),"system-admin"));
        assertEquals(true,edited.get("sourceCommitted"));
        assertEquals(1,edited.get("sourceStateWrites"));
    }

    @Test
    void retiredAlternateWritersReturn410AndPerformZeroRegistryOrPageWrites(){
        Map<String,Object> preflight=transaction.execute(status->
            service.runDesignPreflight(Map.of(
                "pageId","FORBIDDEN_PAGE","routePath","/forbidden",
                "pageName","Forbidden","sectionId","FORBIDDEN_SECTION",
                "componentName","Forbidden","componentType","FORM"),
                "project-approver"));
        DynamicPageRuntimeService dynamicPages=new DynamicPageRuntimeService(jdbc);
        Map<String,Object> compile=transaction.execute(status->dynamicPages.compile(
            List.of(Map.of("pageId","FORBIDDEN_PAGE","title","Forbidden",
                "components",List.of(Map.of("type","FORM")))),"project-approver"));

        assertEquals(410,preflight.get("httpStatus"));
        assertEquals(410,compile.get("httpStatus"));
        assertEquals("RETIRED",preflight.get("status"));
        assertEquals("RETIRED",compile.get("status"));
        assertEquals(0,count("ui_page_manifest"));
        assertEquals(0,count("ui_page_component_map"));
        assertEquals(0,count("ui_component_registry"));
        assertEquals(0,count("ui_section_registry"));
        assertEquals(0,count("framework_common_design_asset_source_state"));
        assertEquals(0,count("framework_development_job"));
    }

    @Test
    void runtimeAccountWithoutLockedSystemMasterAuthorityPerformsZeroWrites(){
        Map<String,Object> base=themeAsset("GLOBAL_THEME","Global theme","#005ea8",List.of());
        seedCommonDesignAsset(base);
        Map<String,Object> proposed=themeAsset(
            "GLOBAL_THEME","Unauthorized revision","#d50136",List.of());

        SecurityException rejected=assertThrows(SecurityException.class,()->
            transaction.execute(status->service.applyCommonDesignAssetSource(
                commonDesignSourceBody("PROJECT_ATTACKER",base,proposed),
                "project-owner")));

        assertTrue(rejected.getMessage().contains(
            "SYSTEM_ADMIN_ACCOUNT_AUTHORITY_REQUIRED"));
        assertEquals(0,count("framework_common_design_write_probe"));
        assertEquals("Global theme",jdbc.queryForObject(
            "select theme_nm from comtnthemedefinition where theme_id='GLOBAL_THEME'",
            String.class));
        assertEquals(ActorProcessGovernanceService.commonDesignAssetFingerprint(base),
            jdbc.queryForObject("select trim(asset_fingerprint) "+
                "from framework_common_design_asset_source_state "+
                "where asset_type='THEME' and asset_id='GLOBAL_THEME'",String.class));
        assertEquals(0,count("framework_development_job"));
    }

    @Test
    void runtimeAccountDeactivationRaceIsLockedAndPerformsZeroWrites() throws Exception {
        Map<String,Object> base=themeAsset("GLOBAL_THEME","Global theme","#005ea8",List.of());
        seedCommonDesignAsset(base);
        Map<String,Object> proposed=themeAsset(
            "GLOBAL_THEME","Forbidden inactive revision","#d50136",List.of());
        var deactivator=dataSource.getConnection();
        var executor=Executors.newSingleThreadExecutor();
        try {
            deactivator.setAutoCommit(false);
            try(var statement=deactivator.prepareStatement(
                    "update comtnemplyrinfo set emplyr_sttus_code='D' where emplyr_id=?")){
                statement.setString(1,"system-admin");
                assertEquals(1,statement.executeUpdate());
            }
            var attempted=executor.submit(()->{
                try {
                    return transaction.execute(status->service.applyCommonDesignAssetSource(
                        commonDesignSourceBody("PROJECT_A",base,proposed),"system-admin"));
                } catch(RuntimeException error){
                    return error;
                }
            });
            Thread.sleep(250);
            assertEquals(false,attempted.isDone());
            deactivator.commit();
            Object result=attempted.get(5,TimeUnit.SECONDS);
            assertTrue(result instanceof SecurityException);
            assertTrue(String.valueOf(((Throwable)result).getMessage()).contains(
                "SYSTEM_ADMIN_ACCOUNT_AUTHORITY_REQUIRED"));
        } finally {
            deactivator.rollback();
            deactivator.close();
            executor.shutdownNow();
        }
        assertEquals(0,count("framework_common_design_write_probe"));
        assertEquals("Global theme",jdbc.queryForObject(
            "select theme_nm from comtnthemedefinition where theme_id='GLOBAL_THEME'",
            String.class));
        assertEquals(0,count("framework_development_job"));
    }

    @Test
    void canonicalRouteContractAmbiguityRollsBackBeforeBlueprintFanout(){
        Map<String,Object> base=themeAsset("GLOBAL_THEME","Global theme","#005ea8",List.of());
        seedCommonDesignAsset(base);
        seedGeneratedScreenIdentity("/step","PRIMARY_ACTOR");
        jdbc.update("""
            update framework_screen_blueprint
               set specification_json=jsonb_set(specification_json::jsonb,
                   '{theme}',to_jsonb('GLOBAL_THEME'::text))::text
             where blueprint_code='REQ_BP_DIRECT'
            """);
        jdbc.update("""
            insert into framework_professional_screen_contract(
              process_code,step_code,audience,route_path,actor_code,
              command_contract,api_contract,updated_by)
            values('PROC','STEP','USER','/step?variant=secondary','PRIMARY_ACTOR',
              '[{"commandCode":"SAVE"}]','[{"path":"/api/items"}]',
              'BACKSTAGE_REQUIREMENT_AUTOMATION')
            """);
        Map<String,Object> proposed=themeAsset(
            "GLOBAL_THEME","Ambiguous revision","#d50136",List.of());

        IllegalStateException rejected=assertThrows(IllegalStateException.class,()->
            transaction.execute(status->service.applyCommonDesignAssetSource(
                commonDesignSourceBody("PROJECT_A",base,proposed),"system-admin")));

        assertTrue(rejected.getMessage().contains(
            "COMMON_DESIGN_SCREEN_AUTHORITY_NOT_EXACT"));
        assertEquals(0,count("framework_common_design_write_probe"));
        assertEquals("Global theme",jdbc.queryForObject(
            "select theme_nm from comtnthemedefinition where theme_id='GLOBAL_THEME'",
            String.class));
        assertEquals(0,count("framework_development_job"));
    }

    @Test
    void migrationBackfillPreservesRealScreenLayoutThemeCompositionAndFingerprints()
            throws Exception {
        jdbc.update("""
            insert into comtnthemedefinition(
              theme_id,theme_nm,theme_dc,theme_type,color_config,typography_config,
              spacing_config,border_config,shadow_config,class_prefix,is_default,use_at,is_active)
            values('MIG_THEME',' Migration theme ',null,'SYSTEM','{}','{}',
              '{}','{}','{}',null,'N','Y','Y')
            """);
        jdbc.update("""
            insert into ui_section_registry(
              section_id,section_name,section_type,layout_contract,responsive_contract,
              accessibility_contract,design_reference,active_yn)
            values('MIG_SECTION','Migration section','WORKSPACE','KRDS_GRID',
              'MOBILE_FIRST','KRDS_A11Y',null,'Y')
            """);
        jdbc.update("""
            insert into ui_component_registry(
              component_id,component_name,component_type,owner_domain,props_schema_json,
              design_reference,default_props,category,active_yn)
            values('MIG_COMPONENT','Migration component','JSON_FORM','COMMON',
              '{"type":"object"}'::jsonb,null,'{"dense":false}'::jsonb,
              'COMMON','Y')
            """);
        List<Map<String,Object>> sections=List.of(Map.of(
            "sectionId","MIG_SECTION","zone","real-zone","displayOrder",17,
            "props",Map.of("columns",12,"title","실제 구성")));
        List<Map<String,Object>> components=List.of(Map.of(
            "componentId","MIG_COMPONENT","sectionId","MIG_SECTION",
            "instanceKey","migration-form","displayOrder",29,
            "props",Map.of("dense",false,"mode","review"),
            "condition","permission == 'MIG_VIEW'"));
        Map<String,Object> composition=Map.ofEntries(
            Map.entry("schema","carbonet.screen-composition/v1"),
            Map.entry("layout","KRDS_REAL_LAYOUT"),Map.entry("theme","MIG_THEME"),
            Map.entry("sections",sections),Map.entry("components",components));
        jdbc.update("""
            insert into ui_page_manifest(
              page_id,page_name,route_path,layout_version,design_token_version,
              component_schema,version_id,active_yn)
            values('MIG_SCREEN','Migration screen','/migration-screen',
              'KRDS_REAL_LAYOUT','MIG_THEME',?,'v9','Y')
            """,json(composition));
        jdbc.update("""
            insert into ui_page_component_map(
              map_id,page_id,layout_zone,component_id,instance_key,display_order,
              conditional_rule_summary,instance_props)
            values('MIG_MAP','MIG_SCREEN','drift-zone','MIG_COMPONENT',
              'migration-form',99,'never',?)
            """,json(Map.of("drift",true)));
        jdbc.update("""
            insert into ui_page_manifest(
              page_id,page_name,route_path,layout_version,design_token_version,
              component_schema,version_id,active_yn)
            values('LEGACY_SCREEN','Legacy screen',
              '/runtime/page?pageId=LEGACY_SCREEN','KRDS_LEGACY_LAYOUT','MIG_THEME',
              '{"layout":"OLD_LAYOUT","theme":"OLD_THEME","sections":[],"components":["bad"]}',
              'v3','Y')
            """);
        jdbc.update("""
            insert into ui_page_component_map(
              map_id,page_id,layout_zone,component_id,instance_key,display_order,
              conditional_rule_summary,instance_props)
            values('LEGACY_MAP','LEGACY_SCREEN','header','MIG_COMPONENT',
              'legacy-form',10,'always','{"mode":"legacy"}')
            """);
        Map<String,Object> incompleteComposition=Map.ofEntries(
            Map.entry("schema","carbonet.screen-composition/v1"),
            Map.entry("layout","KRDS_MISSING_DEP_LAYOUT"),
            Map.entry("theme","MISSING_THEME"),
            Map.entry("sections",sections),Map.entry("components",components));
        jdbc.update("""
            insert into ui_page_manifest(
              page_id,page_name,route_path,layout_version,design_token_version,
              component_schema,version_id,active_yn)
            values('INCOMPLETE_SCREEN','Incomplete screen','/incomplete-screen',
              'UNCHANGED_LAYOUT','UNCHANGED_THEME',?,'v1','Y')
            """,json(incompleteComposition));
        jdbc.update("""
            insert into ui_page_component_map(
              map_id,page_id,layout_zone,component_id,instance_key,display_order,
              conditional_rule_summary,instance_props)
            values('INCOMPLETE_MAP','INCOMPLETE_SCREEN','unchanged-zone','MIG_COMPONENT',
              'migration-form',88,'always','{"untouched":true}')
            """);

        applyMigration(COMMON_DESIGN_STATE_MIGRATION,false);

        @SuppressWarnings("unchecked")
        Map<String,Object> whitespaceComposition=new LinkedHashMap<>(composition);
        whitespaceComposition.put("components",List.of(Map.of(
            "componentId","MIG_COMPONENT","sectionId","MIG_SECTION",
            "instanceKey","migration-form","displayOrder",29,
            "props",Map.of("dense",false,"mode","review"),
            "condition"," permission == 'MIG_VIEW' ")));
        assertEquals(false,jdbc.queryForObject(
            "select framework_common_design_screen_composition_exact(cast(? as jsonb))",
            Boolean.class,json(whitespaceComposition)));
        assertEquals(1,transaction.execute(status->service.commonDesignAssetSourceHeads(
            "THEME","MIG_THEME","",2)).size());
        assertEquals(1,transaction.execute(status->service.commonDesignAssetSourceHeads(
            "SECTION","MIG_SECTION","",2)).size());
        assertEquals(1,transaction.execute(status->service.commonDesignAssetSourceHeads(
            "COMPONENT","MIG_COMPONENT","",2)).size());

        String canonicalText=jdbc.queryForObject("""
            select canonical_asset::text
              from framework_common_design_asset_source_state
             where asset_type='SCREEN' and asset_id='MIG_SCREEN'
            """,String.class);
        @SuppressWarnings("unchecked")
        Map<String,Object> canonical;
        try{canonical=new ObjectMapper().readValue(canonicalText,Map.class);}
        catch(Exception error){throw new IllegalStateException(error);}
        @SuppressWarnings("unchecked")
        Map<String,Object> payload=(Map<String,Object>)canonical.get("payload");
        assertEquals("v9",canonical.get("version"));
        assertEquals("KRDS_REAL_LAYOUT",payload.get("layout"));
        assertEquals("MIG_THEME",payload.get("theme"));
        assertEquals(sections,payload.get("sections"));
        assertEquals(components,payload.get("components"));
        assertEquals("real-zone",jdbc.queryForObject(
            "select layout_zone from ui_page_component_map where page_id='MIG_SCREEN'",
            String.class));
        assertEquals(29,jdbc.queryForObject(
            "select display_order from ui_page_component_map where page_id='MIG_SCREEN'",
            Integer.class));
        assertEquals(true,jdbc.queryForObject(
            "select instance_props::jsonb=cast(? as jsonb) from ui_page_component_map "+
                "where page_id='MIG_SCREEN'",Boolean.class,
            json(Map.of("dense",false,"mode","review"))));
        assertEquals(3,((List<?>)payload.get("dependencies")).size());
        assertTrue(((List<?>)payload.get("dependencies")).stream().allMatch(item->
            String.valueOf(((Map<?,?>)item).get("fingerprint")).matches("[0-9a-f]{64}")));
        assertEquals(ActorProcessGovernanceService.commonDesignAssetFingerprint(canonical),
            jdbc.queryForObject("""
                select trim(asset_fingerprint)
                  from framework_common_design_asset_source_state
                 where asset_type='SCREEN' and asset_id='MIG_SCREEN'
                """,String.class));
        String legacyText=jdbc.queryForObject("""
            select canonical_asset::text from framework_common_design_asset_source_state
             where asset_type='SCREEN' and asset_id='LEGACY_SCREEN'
            """,String.class);
        @SuppressWarnings("unchecked")
        Map<String,Object> legacy;
        try{legacy=new ObjectMapper().readValue(legacyText,Map.class);}
        catch(Exception error){throw new IllegalStateException(error);}
        @SuppressWarnings("unchecked")
        Map<String,Object> legacyPayload=(Map<String,Object>)legacy.get("payload");
        @SuppressWarnings("unchecked")
        List<Map<String,Object>> legacySections=
            (List<Map<String,Object>>)legacyPayload.get("sections");
        @SuppressWarnings("unchecked")
        List<Map<String,Object>> legacyComponents=
            (List<Map<String,Object>>)legacyPayload.get("components");
        assertEquals("/runtime/page",legacy.get("routePath"));
        assertEquals("KRDS_LEGACY_LAYOUT",legacyPayload.get("layout"));
        assertEquals("MIG_THEME",legacyPayload.get("theme"));
        assertEquals("header",legacySections.get(0).get("zone"));
        assertTrue(String.valueOf(legacySections.get(0).get("sectionId"))
            .matches("MIG_ZONE_[0-9A-F]{32}"));
        assertEquals(legacySections.get(0).get("sectionId"),
            legacyComponents.get(0).get("sectionId"));
        assertEquals(3,((List<?>)legacyPayload.get("dependencies")).size());
        assertEquals(1,transaction.execute(status->service.commonDesignAssetSourceHeads(
            "SCREEN","LEGACY_SCREEN","",2)).size());
        assertEquals("/runtime/page?pageId=LEGACY_SCREEN",jdbc.queryForObject(
            "select route_path from ui_page_manifest where page_id='LEGACY_SCREEN'",
            String.class));
        assertEquals("UNCHANGED_LAYOUT",jdbc.queryForObject(
            "select layout_version from ui_page_manifest where page_id='INCOMPLETE_SCREEN'",
            String.class));
        assertEquals("UNCHANGED_THEME",jdbc.queryForObject(
            "select design_token_version from ui_page_manifest where page_id='INCOMPLETE_SCREEN'",
            String.class));
        assertEquals("unchanged-zone",jdbc.queryForObject(
            "select layout_zone from ui_page_component_map where page_id='INCOMPLETE_SCREEN'",
            String.class));
        assertEquals(0,jdbc.queryForObject("""
            select count(*) from framework_common_design_asset_source_state
             where asset_type='SCREEN' and asset_id='INCOMPLETE_SCREEN'
            """,Integer.class));
        assertEquals(6,count("framework_common_design_asset_source_state"));
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
    void requirementActorReferencePreservesExistingDefinitionAndCreatesOnlyMissingActor(){
        jdbc.update("""
            insert into framework_account_actor_assignment(
              account_id,tenant_id,project_id,actor_code,data_scope)
            values('existing-user','TENANT','PROJECT','PRIMARY_ACTOR','*')
            """);
        String before=jdbc.queryForObject("""
            select row_to_json(actor)::text from framework_actor_definition actor
             where actor_code='PRIMARY_ACTOR'
            """,String.class);
        String beforeXmin=jdbc.queryForObject("""
            select xmin::text from framework_actor_definition
             where actor_code='PRIMARY_ACTOR'
            """,String.class);
        Map<String,Object> existing=transaction.execute(status->
            service.createActorForRequirementImport(Map.of(
                "actorCode","PRIMARY_ACTOR","actorName","Synthetic",
                "purpose","synthetic replacement","capabilityCodes","REQUIREMENT_AUTOMATION",
                "delegationAllowed",false,"useAt","Y"),
                "BACKSTAGE_REQUIREMENT_AUTOMATION"));
        assertEquals(false,existing.get("definitionChanged"));
        assertEquals(before,jdbc.queryForObject("""
            select row_to_json(actor)::text from framework_actor_definition actor
             where actor_code='PRIMARY_ACTOR'
            """,String.class));
        assertEquals(beforeXmin,jdbc.queryForObject("""
            select xmin::text from framework_actor_definition
             where actor_code='PRIMARY_ACTOR'
            """,String.class));
        assertEquals(1,jdbc.queryForObject("""
            select count(*) from framework_account_actor_assignment
             where account_id='existing-user' and actor_code='PRIMARY_ACTOR'
            """,Integer.class));

        Map<String,Object> missing=transaction.execute(status->
            service.createActorForRequirementImport(Map.of(
                "actorCode","MISSING_SYNTHETIC","actorName","Synthetic",
                "purpose","requirement actor","capabilityCodes","REQUIREMENT_AUTOMATION",
                "delegationAllowed",false,"useAt","Y"),
                "BACKSTAGE_REQUIREMENT_AUTOMATION"));
        assertEquals(true,missing.get("definitionChanged"));
        assertEquals("REQUIREMENT_AUTOMATION",jdbc.queryForObject("""
            select capability_codes from framework_actor_definition
             where actor_code='MISSING_SYNTHETIC'
            """,String.class));

        jdbc.update("update framework_actor_definition set use_at='N' "+
            "where actor_code='MISSING_SYNTHETIC'");
        assertThrows(IllegalArgumentException.class,()->transaction.execute(status->
            service.createActorForRequirementImport(Map.of(
                "actorCode","MISSING_SYNTHETIC","actorName","Synthetic",
                "purpose","reactivation forbidden","capabilityCodes","REQUIREMENT_AUTOMATION",
                "delegationAllowed",false,"useAt","Y"),
                "BACKSTAGE_REQUIREMENT_AUTOMATION")));
        assertEquals("N",jdbc.queryForObject("""
            select use_at from framework_actor_definition
             where actor_code='MISSING_SYNTHETIC'
            """,String.class));
    }

    @Test
    void realIncompleteAddStepCreatesNoJobThenCompleteRetryCreatesExactlyOne(){
        jdbc.execute("truncate integrated_design_scope_binding,integrated_design_authority_version,"+
            "integrated_design_authority,framework_development_job_gate_result,"+
            "framework_development_job,framework_process_artifact restart identity cascade");
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
        jdbc.execute("truncate integrated_design_scope_binding,integrated_design_authority_version,"+
            "integrated_design_authority,framework_development_job_gate_result,"+
            "framework_development_job,framework_process_artifact restart identity cascade");
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

        String stableHead=jobHead();
        LinkedHashMap<String,Object> rejectedRoute=new LinkedHashMap<>(revised);
        rejectedRoute.put("userPath","/manual-new-route");
        assertThrows(IllegalStateException.class,()->transaction.execute(status->
            service.addStep(rejectedRoute,"authenticated-admin")));
        assertEquals("/step",jdbc.queryForObject("""
            select user_path from framework_process_step
             where process_code='PROC' and step_code='STEP'
            """,String.class));
        assertEquals(stableHead,jobHead());
        assertEquals(1,count("framework_development_job"));
    }

    @Test
    void structuredRequirementDesignProjectsEveryCodegenFieldAndPreservesManualItems(){
        seedGeneratedScreenIdentity("/step","PRIMARY_ACTOR");
        jdbc.update("insert into framework_screen_resource(route_key,layout_type,source_kind) "+
            "values('/registered-layout','KRDS_REQUIREMENT_WORKSPACE','COMMON_DESIGN')");
        jdbc.update("insert into comtnthemedefinition(theme_id,use_at,is_active) "+
            "values('KRDS_REQUIREMENT_THEME','Y','Y')");
        jdbc.update("""
            update framework_process_step set command_code='SUBMIT_REQUIREMENT',
                   from_state='DRAFT',to_state='DONE',
                   api_contract='{"method":"POST","path":"/api/items"}'
             where process_code='PROC' and step_code='STEP'
            """);
        String beforeHead=jdbc.queryForObject(
            "select framework_process_generation_input('PROC')->>'processInputHash'",String.class);
        Map<String,Object> contract=requirementProjectionContract(
            "KRDS_REQUIREMENT_WORKSPACE","KRDS_REQUIREMENT_THEME",
            "SUBMIT_REQUIREMENT","EXECUTE_REQUIREMENT","d".repeat(64));

        Map<String,Object> projected=transaction.execute(status->
            service.applyRequirementProcessDesignProjection(
                "PROC",contract,"BACKSTAGE_REQUIREMENT_AUTOMATION"));

        assertEquals(true,projected.get("success"));
        assertEquals(1,projected.get("screenCount"));
        assertEquals("KRDS_REQUIREMENT_WORKSPACE",jdbc.queryForObject(
            "select layout_type from framework_screen_resource where route_key='/step'",String.class));
        assertEquals("EXECUTE_REQUIREMENT",jdbc.queryForObject("""
            select permission_codes->>0 from framework_professional_screen_contract
             where process_code='PROC' and step_code='STEP'
            """,String.class));
        assertEquals("PRIMARY_TASK",jdbc.queryForObject("""
            select section_contract::jsonb->0->>'sectionCode'
              from framework_professional_screen_contract
             where process_code='PROC' and step_code='STEP'
            """,String.class));
        assertEquals("amount",jdbc.queryForObject("""
            select field_contract::jsonb->0->>'fieldCode'
              from framework_professional_screen_contract
             where process_code='PROC' and step_code='STEP'
            """,String.class));
        assertEquals(Boolean.TRUE,jdbc.queryForObject("""
            select exists(select 1 from jsonb_array_elements(command_contract::jsonb) item
              where item->>'commandCode'='SAVE' and item->>'markerType' is null)
              from framework_professional_screen_contract
             where process_code='PROC' and step_code='STEP'
            """,Boolean.class));
        assertEquals(1,jdbc.queryForObject("""
            select count(*) from framework_professional_screen_contract contract
              cross join lateral jsonb_array_elements(contract.command_contract::jsonb) item
             where contract.process_code='PROC' and item->>'markerType'='PRIMARY_STEP_COMMAND'
               and item->>'commandCode'='SUBMIT_REQUIREMENT'
            """,Integer.class));
        assertEquals("KRDS_REQUIREMENT_THEME",jdbc.queryForObject("""
            select specification_json::jsonb->>'theme' from framework_screen_blueprint
             where process_code='PROC' and validation_status='VALID'
            """,String.class));
        assertEquals("d".repeat(64),jdbc.queryForObject("""
            select specification_json::jsonb#>>'{requirementContract,contentSha256}'
              from framework_screen_blueprint where process_code='PROC' and validation_status='VALID'
            """,String.class));
        assertEquals("PRIMARY_WORKSPACE",jdbc.queryForObject("""
            select specification_json::jsonb#>>'{requirementContract,workspaces,0,id}'
              from framework_screen_blueprint where process_code='PROC' and validation_status='VALID'
            """,String.class));
        Map<String,Object> publication=transaction.execute(status->
            service.finalizeAndQueueProcessDesign("PROC","BACKSTAGE_REQUIREMENT_AUTOMATION",
                "REQUIREMENT_PROCESS_CONTRACT"));
        assertEquals("QUEUED",publication.get("status"));
        assertEquals(1,publication.get("jobCount"));
        assertEquals(1,publication.get("endpointExpected"));
        assertEquals("SOURCE_IMMEDIATE_V1",publication.get("activationPolicy"));
        assertEquals("SOURCE_IMMEDIATE_V1",jdbc.queryForObject("""
            select specification_json::jsonb->>'activationPolicy'
              from framework_development_job where process_code='PROC'
            """,String.class));
        String afterHead=jdbc.queryForObject(
            "select framework_process_generation_input('PROC')->>'processInputHash'",String.class);
        assertNotEquals(beforeHead,afterHead);

        String professionalXmin=jdbc.queryForObject("""
            select xmin::text from framework_professional_screen_contract
             where process_code='PROC' and step_code='STEP'
            """,String.class);
        String blueprintXmin=jdbc.queryForObject("""
            select xmin::text from framework_screen_blueprint where process_code='PROC'
            """,String.class);
        Map<String,Object> replay=transaction.execute(status->
            service.applyRequirementProcessDesignProjection(
                "PROC",contract,"BACKSTAGE_REQUIREMENT_AUTOMATION"));
        assertEquals(0,replay.get("professionalUpdates"));
        assertEquals(0,replay.get("blueprintUpdates"));
        assertEquals(professionalXmin,jdbc.queryForObject("""
            select xmin::text from framework_professional_screen_contract
             where process_code='PROC' and step_code='STEP'
            """,String.class));
        assertEquals(blueprintXmin,jdbc.queryForObject("""
            select xmin::text from framework_screen_blueprint where process_code='PROC'
            """,String.class));

        jdbc.update("update framework_screen_blueprint set implementation_strategy='ADOPT_EXISTING',"+
            "created_by='HUMAN_DESIGNER' where process_code='PROC'");
        Map<String,Object> rejected=requirementProjectionContract(
            "RESPONSIVE_WORKSPACE","KRDS_REQUIREMENT_THEME",
            "SUBMIT_REQUIREMENT","EXECUTE_CHANGED","e".repeat(64));
        assertThrows(IllegalStateException.class,()->transaction.execute(status->
            service.applyRequirementProcessDesignProjection(
                "PROC",rejected,"BACKSTAGE_REQUIREMENT_AUTOMATION")));
        assertEquals("KRDS_REQUIREMENT_WORKSPACE",jdbc.queryForObject(
            "select layout_type from framework_screen_resource where route_key='/step'",String.class));
        assertEquals("d".repeat(64),jdbc.queryForObject("""
            select specification_json::jsonb#>>'{requirementContract,contentSha256}'
              from framework_screen_blueprint where process_code='PROC'
            """,String.class));
    }

    @Test
    void directStepRouteActorAndPageRemovalReconcileOneGeneratedCanonicalIdentity(){
        seedGeneratedScreenIdentity("/step","PRIMARY_ACTOR");
        jdbc.update("insert into framework_screen_resource(route_key,layout_type,source_kind) "+
            "values('/new-route','RESPONSIVE_WORKSPACE','PAGE_DESIGN')");
        LinkedHashMap<String,Object> routeRevision=new LinkedHashMap<>(stepBody("STEP",1));
        routeRevision.put("requiresUserPage",true);
        routeRevision.put("userPath","/new-route");
        routeRevision.put("commandCode","EXECUTE_ROUTE");

        Map<String,Object> routeResult=transaction.execute(status->
            service.addStep(routeRevision,"authenticated-admin"));

        assertEquals("QUEUED",routeResult.get("status"));
        assertEquals(1,routeResult.get("jobCount"));
        assertEquals(1,routeResult.get("endpointExpected"));
        assertGeneratedIdentity("/new-route","PRIMARY_ACTOR","EXECUTE_ROUTE",1);
        assertEquals(0,jdbc.queryForObject("""
            select count(*) from framework_professional_screen_contract
             where process_code='PROC' and step_code='STEP' and route_path='/step'
            """,Integer.class));
        String routeHead=String.valueOf(routeResult.get("processInputHash"));

        insertActor("NEXT_ACTOR");
        LinkedHashMap<String,Object> actorRevision=new LinkedHashMap<>(routeRevision);
        actorRevision.put("actorCode","NEXT_ACTOR");
        actorRevision.put("commandCode","EXECUTE_ACTOR");
        Map<String,Object> actorResult=transaction.execute(status->
            service.addStep(actorRevision,"authenticated-admin"));

        assertEquals("QUEUED",actorResult.get("status"));
        assertEquals(1,actorResult.get("jobCount"));
        assertNotEquals(routeHead,actorResult.get("processInputHash"));
        assertGeneratedIdentity("/new-route","NEXT_ACTOR","EXECUTE_ACTOR",1);

        LinkedHashMap<String,Object> removed=new LinkedHashMap<>(actorRevision);
        removed.put("requiresUserPage",false);
        removed.put("userPath","");
        Map<String,Object> removedResult=transaction.execute(status->
            service.addStep(removed,"authenticated-admin"));

        assertEquals("QUEUED",removedResult.get("status"));
        assertEquals(1,removedResult.get("jobCount"));
        assertEquals(0,removedResult.get("endpointExpected"));
        assertEquals(0,jdbc.queryForObject("""
            select count(*) from framework_professional_screen_contract
             where process_code='PROC' and step_code='STEP'
            """,Integer.class));
        assertEquals(0,jdbc.queryForObject("""
            select count(*) from framework_page_design
             where process_code='PROC' and step_code='STEP'
            """,Integer.class));
        assertEquals(0,jdbc.queryForObject("""
            select count(*) from framework_screen_blueprint
             where process_code='PROC' and step_code='STEP' and validation_status='VALID'
            """,Integer.class));
        assertEquals(1,count("framework_development_job"));
    }

    @Test
    void blueprintCompileDryRunAndAdoptConflictPreserveManualBytesAndXmin(){
        jdbc.update("""
            insert into ui_page_manifest(page_id,route_path,active_yn)
            values('MANUAL_PAGE','/step','Y')
            """);
        jdbc.update("""
            insert into framework_design_asset_registry(
              design_asset_id,route_path,source_path,active_yn)
            values('MANUAL_ASSET','/step','src/manual/Step.tsx','Y')
            """);
        jdbc.update("""
            insert into framework_screen_blueprint(
              blueprint_code,process_code,step_code,actor_code,audience,page_id,page_name,
              route_path,screen_type,template_code,specification_json,traceability_json,
              validation_status,validation_message,implementation_strategy,transition_status,created_by)
            values('MANUAL_ADOPT','PROC','STEP','PRIMARY_ACTOR','USER','MANUAL_PAGE','Manual',
              '/step','WORKSPACE','MANUAL_TEMPLATE','{"manual":true}','{"owner":"human"}',
              'VALID',null,'ADOPT_EXISTING','CONTRACT_LINKED','HUMAN_DESIGNER')
            """);
        String before=jdbc.queryForObject("""
            select row_to_json(blueprint)::text from framework_screen_blueprint blueprint
             where blueprint_code='MANUAL_ADOPT'
            """,String.class);
        String beforeXmin=jdbc.queryForObject("""
            select xmin::text from framework_screen_blueprint
             where blueprint_code='MANUAL_ADOPT'
            """,String.class);

        Map<String,Object> dryRun=transaction.execute(status->
            service.compileScreenBlueprints(Map.of(
                "processCode","PROC","maxScreens",10,"dryRun",true),"system-admin"));
        assertEquals(true,dryRun.get("dryRun"));
        assertEquals(1,dryRun.get("compiled"));
        assertEquals(0,count("framework_screen_generation_batch"));
        assertEquals(before,jdbc.queryForObject("""
            select row_to_json(blueprint)::text from framework_screen_blueprint blueprint
             where blueprint_code='MANUAL_ADOPT'
            """,String.class));
        assertEquals(beforeXmin,jdbc.queryForObject("""
            select xmin::text from framework_screen_blueprint
             where blueprint_code='MANUAL_ADOPT'
            """,String.class));

        assertThrows(IllegalStateException.class,()->transaction.execute(status->
            service.compileScreenBlueprints(Map.of(
                "processCode","PROC","maxScreens",10,"dryRun",false),"system-admin")));
        assertEquals(0,count("framework_screen_generation_batch"));
        assertEquals(before,jdbc.queryForObject("""
            select row_to_json(blueprint)::text from framework_screen_blueprint blueprint
             where blueprint_code='MANUAL_ADOPT'
            """,String.class));
        assertEquals(beforeXmin,jdbc.queryForObject("""
            select xmin::text from framework_screen_blueprint
             where blueprint_code='MANUAL_ADOPT'
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
    void actorMutationLockAlwaysPrecedesItsAffectedProcessPublicationLock()
            throws Exception {
        CountDownLatch actorLocked=new CountDownLatch(1);
        CountDownLatch allowProcessLock=new CountDownLatch(1);
        var executor=Executors.newFixedThreadPool(2);
        try{
            var ordinary=executor.submit(()->transaction.execute(status->{
                jdbc.execute("set local lock_timeout='3s'");
                jdbc.query("select pg_advisory_xact_lock(hashtextextended("+
                    "'CANONICAL_ACTOR_MUTATION_V1:PRIMARY_ACTOR',0))",rs->{});
                actorLocked.countDown();
                try{assertTrue(allowProcessLock.await(5,TimeUnit.SECONDS));}
                catch(InterruptedException error){
                    Thread.currentThread().interrupt();throw new IllegalStateException(error);
                }
                jdbc.query("select pg_advisory_xact_lock(hashtextextended("+
                    "'CANONICAL_PROCESS_PUBLICATION_V1:PROC',0))",rs->{});
                return true;
            }));
            assertTrue(actorLocked.await(3,TimeUnit.SECONDS));
            var requirement=executor.submit(()->transaction.execute(status->{
                jdbc.execute("set local lock_timeout='3s'");
                return service.lockRequirementImportProcesses(
                    "PROC",List.of("PRIMARY_ACTOR"));
            }));
            Thread.sleep(250);
            assertEquals(false,requirement.isDone());
            allowProcessLock.countDown();
            assertEquals(true,ordinary.get(3,TimeUnit.SECONDS));
            assertEquals(List.of("PROC"),requirement.get(3,TimeUnit.SECONDS));
        }finally{
            allowProcessLock.countDown();
            executor.shutdownNow();
        }
    }

    @Test
    void compositeRelayReadinessShareLocksSerializeEveryRevocationAxis() throws Exception {
        jdbc.update("insert into comtnemplyrinfo values('relay-user','RELAY_ESNTL','P')");
        jdbc.update("insert into comtnemplyrscrtyestbs values('RELAY_ESNTL','ROLE_RELAY')");
        jdbc.update("""
            insert into framework_account_actor_assignment(
              account_id,tenant_id,project_id,actor_code,data_scope)
            values('relay-user','TENANT','PROJECT_A','PRIMARY_ACTOR','*')
            """);
        jdbc.update("""
            insert into framework_project_actor_assignment(project_id,actor_code,user_id,active_yn)
            values('PROJECT_A','PRIMARY_ACTOR','relay-user','Y')
            """);
        for(String mutation:List.of(
                "update framework_account_actor_assignment set assignment_status='INACTIVE' where account_id='relay-user'",
                "update comtnemplyrinfo set emplyr_sttus_code='D' where emplyr_id='relay-user'",
                "update comtnemplyrscrtyestbs set author_code='' where scrty_dtrmn_trget_id='RELAY_ESNTL'",
                "update framework_project_actor_assignment set active_yn='N' where project_id='PROJECT_A'")){
            jdbc.update("update framework_account_actor_assignment set assignment_status='ACTIVE' where account_id='relay-user'");
            jdbc.update("update comtnemplyrinfo set emplyr_sttus_code='P' where emplyr_id='relay-user'");
            jdbc.update("update comtnemplyrscrtyestbs set author_code='ROLE_RELAY' where scrty_dtrmn_trget_id='RELAY_ESNTL'");
            jdbc.update("update framework_project_actor_assignment set active_yn='Y' where project_id='PROJECT_A'");
            assertRelayRevocationWaits(mutation);
        }
    }

    @Test
    void compositeThreeScreensCompileToOneFinalJobAndReplayWritesZero(){
        seedCompositeThreeScreens();
        Map<String,Object> first=compileComposite(
            Map.of("processCode","PROC","previewOnly",false,"scopeType","GLOBAL"));
        assertEquals("SOURCE_APPLIED_PHYSICAL_QUEUED",first.get("status"));
        assertEquals(3,number(first,"screenCount"));assertEquals(54,number(first,"documentCount"));
        assertEquals(3,number(first,"authorityCount"));assertEquals(1,number(first,"jobCount"));
        assertEquals(3,number(first,"endpointExpected"));
        assertEquals(1,number(first,"refreshInvocationCount"));
        assertEquals(3,jdbc.queryForObject("select count(*) from integrated_design_authority",
            Integer.class));
        assertEquals(1,jdbc.queryForObject("select count(distinct job_id) from integrated_design_authority",
            Integer.class));
        assertEquals(3,jdbc.queryForObject("select count(*) from framework_composite_design_target_identity "+
            "where process_code='PROC' and step_code='STEP'",Integer.class));
        assertEquals(3,jdbc.queryForObject("""
            select count(*) from integrated_design_authority authority
             join framework_professional_screen_contract contract
               on contract.contract_id=authority.contract_id
             join framework_process_step_screen_binding binding
               on binding.process_code=authority.process_code and binding.step_code=authority.step_code
              and binding.audience=authority.audience
             join framework_screen_resource resource
               on resource.screen_resource_id=binding.screen_resource_id
              and resource.route_key=authority.route_path
            where authority.process_code='PROC' and contract.actor_code=binding.actor_code
              and authority.composite_json#>>'{generatedSurfaceOutputs,WORK_GUIDE,actorCode}'=
                  contract.actor_code
              and authority.composite_json#>>'{generatedSurfaceOutputs,NEXT_TASK,commandCode}'=
                  framework_try_jsonb(contract.command_contract)->0->>'commandCode'
            """,Integer.class));
        assertEquals("PRIMARY_ACTOR",jdbc.queryForObject("select actor_code from framework_process_step "+
            "where process_code='PROC' and step_code='STEP'",String.class));
        assertEquals(1,jdbc.queryForObject("select count(*) from framework_permission_requirement_v1 "+
            "where process_code='PROC' and step_code='STEP' and permission_code='PERM_SAVE'",Integer.class));
        assertEquals(3,jdbc.queryForObject("""
            select jsonb_array_length(framework_try_jsonb(specification_json)->'compositeAuthorities')
              from framework_development_job where process_code='PROC'
               and job_group_code='PROC_CANONICAL_PUBLICATION'
            """,Integer.class));
        installCompositeGeneratedTables();
        Map<String,Object> before=jdbc.queryForMap("""
            select string_agg(authority_id||':'||authority_revision||':'||xmin::text,','
                     order by authority_id) as authorities,
                   (select string_agg(document_id||':'||revision||':'||xmin::text,','
                     order by document_id) from integrated_design_document) as documents,
                   (select string_agg(job_id||':'||xmin::text,',' order by job_id)
                     from framework_development_job) as jobs
              from integrated_design_authority
            """);
        Map<String,Object> replay=compileComposite(
            Map.of("processCode","PROC","previewOnly",false,"scopeType","GLOBAL"));
        assertEquals("SOURCE_APPLIED_PHYSICAL_QUEUED",replay.get("status"));
        assertEquals(0,number(replay,"refreshInvocationCount"));
        assertEquals(before,jdbc.queryForMap("""
            select string_agg(authority_id||':'||authority_revision||':'||xmin::text,','
                     order by authority_id) as authorities,
                   (select string_agg(document_id||':'||revision||':'||xmin::text,','
                     order by document_id) from integrated_design_document) as documents,
                   (select string_agg(job_id||':'||xmin::text,',' order by job_id)
                     from framework_development_job) as jobs
              from integrated_design_authority
            """));
    }

    @Test
    void durableLiveSmokeDispatchSurvivesCrashPartialResumeDeadLetterAndRevisionSupersede(){
        seedCompositeThreeScreens();
        Map<String,Object> compiled=compileComposite(
            Map.of("processCode","PROC","previewOnly",false,"scopeType","GLOBAL"));
        long jobId=((Number)((Map<?,?>)((List<?>)compiled.get("receipts")).get(0)).get("jobId")).longValue();
        String revisionHash=jdbc.queryForObject(
            "select framework_composite_authority_revision_set_hash(?)",String.class,jobId);
        String processSource=jdbc.queryForObject("select framework_try_jsonb(specification_json)->>'sourceHash' "+
            "from framework_development_job where job_id=?",String.class,jobId);
        int expected=jdbc.queryForObject("""
            select sum(jsonb_array_length(composite_json#>'{executableDesign,TEST,scenarios}')*3)::integer
              from integrated_design_authority where job_id=?
            """,Integer.class,jobId);
        long dispatchId=jdbc.queryForObject("""
            insert into integrated_design_live_smoke_dispatch(job_id,process_code,project_id,
              runtime_commit,runtime_identity_hash,canary_attempt,
              authority_revision_set_hash,artifact_manifest_hash,process_source_hash,
              expected_evidence_count,status)
            values(?,'PROC','*',repeat('a',40),?,0,?,repeat('a',64),?,?,'QUEUED')
            returning dispatch_id
            """,Long.class,jobId,currentRuntimeIdentityHash(),revisionHash,processSource,expected);
        jdbc.update("""
            insert into integrated_design_autocompletion_receipt(process_code,completion_status,
              job_id,dependency_fingerprint,receipt_json,started_at)
            values('PROC','SOURCE_APPLIED_PHYSICAL_QUEUED',?,
              framework_composite_dependency_fingerprint('PROC'),'{}'::jsonb,clock_timestamp())
            on conflict(process_code) do update set
              completion_status=excluded.completion_status,job_id=excluded.job_id,
              dependency_fingerprint=excluded.dependency_fingerprint,
              receipt_json=excluded.receipt_json,started_at=excluded.started_at
            """,jobId);
        UUID firstToken=UUID.randomUUID(),staleToken=UUID.randomUUID();
        assertEquals(1,jdbc.update("""
            with candidate as (select dispatch_id from integrated_design_live_smoke_dispatch
              where dispatch_id=? and status='QUEUED' for update skip locked)
            update integrated_design_live_smoke_dispatch dispatch
               set status='RUNNING',attempt_count=attempt_count+1,lease_token=?,
                   lease_until=clock_timestamp()+interval '10 milliseconds',started_at=clock_timestamp()
              from candidate where dispatch.dispatch_id=candidate.dispatch_id
            """,dispatchId,firstToken));
        assertEquals(0,jdbc.update("""
            update integrated_design_live_smoke_dispatch set status='RETRY_WAIT',lease_token=null,
              lease_until=null,next_attempt_at=clock_timestamp()
             where dispatch_id=? and status='RUNNING' and lease_token=?
            """,dispatchId,staleToken));
        jdbc.queryForObject("select pg_sleep(0.03)::text",String.class);
        assertEquals(1,jdbc.update("""
            update integrated_design_live_smoke_dispatch set status='RETRY_WAIT',lease_token=null,
              lease_until=null,next_attempt_at=clock_timestamp(),last_error_code='STALE_LEASE_EXPIRED',
              last_error_hash=repeat('b',64)
             where dispatch_id=? and status='RUNNING' and lease_token=? and lease_until<clock_timestamp()
            """,dispatchId,firstToken));
        assertEquals(1,insertPartialLiveSmokeEvidence(jobId));
        UUID secondToken=UUID.randomUUID();
        assertEquals(1,jdbc.update("""
            update integrated_design_live_smoke_dispatch set status='RUNNING',
              attempt_count=attempt_count+1,lease_token=?,lease_until=clock_timestamp()+interval '1 minute'
             where dispatch_id=? and status='RETRY_WAIT'
            """,secondToken,dispatchId));
        assertEquals(1,jdbc.queryForObject(
            "select count(*) from integrated_design_live_smoke_evidence where job_id=?",Integer.class,jobId));
        assertEquals(Map.of("dispatchWrites",1,"receiptWrites",1,"status","RETRY_WAIT"),
            jdbc.queryForMap("""
                with failed as (
                  update integrated_design_live_smoke_dispatch dispatch
                     set status='RETRY_WAIT',lease_token=null,lease_until=null,
                         next_attempt_at=clock_timestamp(),completed_at=null,
                         last_error_code='TRANSIENT_HTTP_FAILURE',last_error_hash=repeat('c',64)
                   where dispatch_id=? and status='RUNNING' and lease_token=?
                     and authority_revision_set_hash=
                         framework_composite_authority_revision_set_hash(job_id)
                  returning *
                ), receipt_update as (
                  update integrated_design_autocompletion_receipt receipt
                     set receipt_json=receipt.receipt_json||jsonb_build_object(
                           'liveSmokeDispatchId',failed.dispatch_id,
                           'liveSmokeDispatchStatus',failed.status,
                           'liveSmokeLastErrorCode',failed.last_error_code,
                           'liveSmokeLastErrorHash',failed.last_error_hash),
                         updated_at=clock_timestamp()
                    from failed where receipt.job_id=failed.job_id
                     and receipt.process_code=failed.process_code
                  returning receipt.process_code
                )
                select (select count(*)::integer from failed) as "dispatchWrites",
                       (select count(*)::integer from receipt_update) as "receiptWrites",
                       (select status from failed) as status
                """,dispatchId,secondToken));
        UUID thirdToken=UUID.randomUUID();
        assertEquals(1,jdbc.update("""
            update integrated_design_live_smoke_dispatch set status='RUNNING',
              attempt_count=attempt_count+1,lease_token=?,lease_until=clock_timestamp()+interval '1 minute'
             where dispatch_id=? and status='RETRY_WAIT'
            """,thirdToken,dispatchId));
        assertEquals(Map.of("dispatchWrites",1,"receiptWrites",1,"status","DEAD_LETTER"),
            jdbc.queryForMap("""
                with failed as (
                  update integrated_design_live_smoke_dispatch dispatch
                     set status='DEAD_LETTER',lease_token=null,lease_until=null,
                         next_attempt_at=clock_timestamp(),completed_at=clock_timestamp(),
                         last_error_code='RETRY_EXHAUSTED',last_error_hash=repeat('d',64)
                   where dispatch_id=? and status='RUNNING' and lease_token=? and attempt_count=3
                     and authority_revision_set_hash=
                         framework_composite_authority_revision_set_hash(job_id)
                  returning *
                ), receipt_update as (
                  update integrated_design_autocompletion_receipt receipt
                     set receipt_json=receipt.receipt_json||jsonb_build_object(
                           'liveSmokeDispatchId',failed.dispatch_id,
                           'liveSmokeDispatchStatus',failed.status,
                           'liveSmokeLastErrorCode',failed.last_error_code,
                           'liveSmokeLastErrorHash',failed.last_error_hash),
                         updated_at=clock_timestamp()
                    from failed where receipt.job_id=failed.job_id
                     and receipt.process_code=failed.process_code
                  returning receipt.process_code
                )
                select (select count(*)::integer from failed) as "dispatchWrites",
                       (select count(*)::integer from receipt_update) as "receiptWrites",
                       (select status from failed) as status
                """,dispatchId,thirdToken));
        assertEquals(Map.of("status","DEAD_LETTER","code","RETRY_EXHAUSTED"),
            jdbc.queryForMap("""
                select receipt_json->>'liveSmokeDispatchStatus' status,
                       receipt_json->>'liveSmokeLastErrorCode' code
                  from integrated_design_autocompletion_receipt where process_code='PROC'
                """));
        assertEquals(Map.of("status","DEAD_LETTER","attemptCount",3,"evidenceCount",1),
            jdbc.queryForMap("""
                select status,attempt_count as "attemptCount",
                  (select count(*)::integer from integrated_design_live_smoke_evidence
                    where job_id=dispatch.job_id) as "evidenceCount"
                  from integrated_design_live_smoke_dispatch dispatch where dispatch_id=?
                """,dispatchId));
        assertThrows(RuntimeException.class,()->jdbc.update(
            "delete from integrated_design_live_smoke_dispatch where dispatch_id=?",dispatchId));
        jdbc.update("""
            update integrated_design_authority set authority_revision=authority_revision+1,
              source_hash=repeat('e',64),authority_hash=repeat('f',64)
             where authority_id=(select min(authority_id) from integrated_design_authority where job_id=?)
            """,jobId);
        String nextRevisionHash=jdbc.queryForObject(
            "select framework_composite_authority_revision_set_hash(?)",String.class,jobId);
        assertNotEquals(revisionHash,nextRevisionHash);
        assertEquals(1,jdbc.update("""
            update integrated_design_live_smoke_dispatch set status='SUPERSEDED',
              completed_at=coalesce(completed_at,clock_timestamp()),
              last_error_code='AUTHORITY_REVISION_SUPERSEDED',last_error_hash=repeat('1',64)
             where dispatch_id=? and authority_revision_set_hash<>?
            """,dispatchId,nextRevisionHash));
        long nextDispatch=jdbc.queryForObject("""
            insert into integrated_design_live_smoke_dispatch(job_id,process_code,project_id,
              runtime_commit,runtime_identity_hash,canary_attempt,
              authority_revision_set_hash,artifact_manifest_hash,process_source_hash,
              expected_evidence_count,status)
            values(?,'PROC','*',repeat('a',40),?,0,?,repeat('a',64),?,?,'QUEUED')
            returning dispatch_id
            """,Long.class,jobId,currentRuntimeIdentityHash(),nextRevisionHash,processSource,expected);
        assertTrue(nextDispatch>dispatchId);
        assertEquals(List.of("QUEUED","SUPERSEDED"),jdbc.queryForList(
            "select status from integrated_design_live_smoke_dispatch where job_id=? order by status",String.class,jobId));
        assertEquals(0,jdbc.update("""
            update integrated_design_live_smoke_dispatch set status='EVIDENCE_SUBMITTED',
              lease_token=null,lease_until=null where dispatch_id=? and lease_token=?
            """,dispatchId,firstToken));
    }

    @Test
    void rawBackfillTestsRemainInReviewAndCannotPublishWithoutDeclaredCases(){
        seedCompositeThreeScreens();
        transaction.executeWithoutResult(status->
            jdbc.queryForMap("select * from refresh_integrated_design_axis_documents('PROC',true)"));
        assertEquals(Map.of("testCount",3,"inReviewCount",3,"emptyScenarioCount",3),
            jdbc.queryForMap("""
                select count(*)::integer as "testCount",
                       count(*) filter(where status='IN_REVIEW')::integer as "inReviewCount",
                       count(*) filter(where framework_try_jsonb(content)#>'{payload,scenarios}'=
                         '[]'::jsonb)::integer as "emptyScenarioCount"
                  from integrated_design_document
                 where process_code='PROC' and document_type='TEST'
                """));
        assertEquals(0,count("integrated_design_authority"));
        assertEquals(0,count("framework_development_job"));

        Object attempt;
        try{
            attempt=transaction.execute(status->{
                try{return service.compileIntegratedDesignProcess(Map.of(
                    "processCode","PROC","previewOnly",false,"scopeType","GLOBAL"),"system-admin");}
                finally{status.setRollbackOnly();}
            });
        }catch(RuntimeException blocked){attempt=blocked;}
        assertTrue(attempt instanceof RuntimeException
            ||attempt instanceof Map<?,?> result&&"BLOCKED".equals(result.get("status")),
            "raw TEST backfill must be blocked, actual="+attempt);
        assertEquals(0,count("integrated_design_authority"));
        assertEquals(0,count("framework_development_job"));
        assertEquals(Map.of("inReviewCount",3,"emptyScenarioCount",3),jdbc.queryForMap("""
            select count(*) filter(where status='IN_REVIEW')::integer as "inReviewCount",
                   count(*) filter(where framework_try_jsonb(content)#>'{payload,scenarios}'=
                     '[]'::jsonb)::integer as "emptyScenarioCount"
              from integrated_design_document
             where process_code='PROC' and document_type='TEST'
            """));
    }

    @Test
    void safeCreateExistingSchemaRequiresExactMarkerAndReplaysWithoutSourceWrites(){
        seedCompositeThreeScreens();
        jdbc.execute("create table item(name text not null,id integer primary key)");
        jdbc.execute("comment on table item is 'design-schema-hash:"+schemaFingerprint("/work-a")+"'");
        jdbc.execute("create table approval(reason text not null,approval_id bigint primary key)");
        IllegalStateException mismatch=assertThrows(IllegalStateException.class,()->compileComposite(
            Map.of("processCode","PROC","previewOnly",false,"scopeType","GLOBAL")));
        assertTrue(mismatch.getMessage().contains("DATABASE_REGISTERED_COLUMN_NOT_EXACT"));
        assertEquals(0,count("integrated_design_document"));assertEquals(0,count("integrated_design_authority"));
        assertEquals(0,count("framework_development_job"));
    }

    @Test
    void identicalCrossScreenDatabasePlanDeduplicatesAndConflictingPlanRollsBack(){
        seedCompositeThreeScreens();
        String itemData=jdbc.queryForObject("select data_contract from framework_professional_screen_contract "+
            "where process_code='PROC' and route_path='/work-a'",String.class);
        jdbc.update("""
            update framework_professional_screen_contract set
              field_contract='[{"fieldCode":"name","label":"Input","direction":"INPUT","dataSource":"ITEM","dataType":"STRING","required":true,"componentCode":"JSON_FORM"},{"fieldCode":"id","label":"Output","direction":"OUTPUT","dataSource":"ITEM","dataType":"INTEGER","required":false,"componentCode":"JSON_FORM"}]',
              api_contract='[{"method":"POST","path":"/api/items/{executionId}/escalate","commandCode":"ESCALATE","requestFields":["name"],"responseFields":["id"],"permissionCodes":["PERM_ESCALATE"]}]',
              data_contract=? where process_code='PROC' and route_path='/work-b'
            """,itemData);
        Map<String,Object> compiled=compileComposite(
            Map.of("processCode","PROC","previewOnly",false,"scopeType","GLOBAL"));
        assertEquals("SOURCE_APPLIED_PHYSICAL_QUEUED",compiled.get("status"));
        assertEquals(3,number(compiled,"authorityCount"));
        assertEquals(2,jdbc.queryForObject("""
            select count(distinct change->>'tableName') from framework_development_job job
              cross join lateral jsonb_array_elements(
                framework_try_jsonb(job.specification_json)->'compositeAuthorities') authority
              cross join lateral jsonb_array_elements(
                authority->'executableDesign'->'DATABASE'->'schemaChanges') change
             where job.process_code='PROC'
            """,Integer.class));

        seed();seedCompositeThreeScreens();
        Map<String,Object> conflictPlan=new LinkedHashMap<>();
        List<Map<String,Object>> changes=List.of(Map.of(
            "operation","CREATE_TABLE","tableName","item","columns",List.of(
                Map.of("name","note","type","text","primaryKey",false,"nullable",false),
                Map.of("name","ticket_id","type","bigint","primaryKey",true,"nullable",false)),
            "uniqueConstraints",List.of(),"indexes",List.of()));
        conflictPlan.put("entities",List.of(Map.of("entity","ITEM","fields",List.of("note","ticket_id"))));
        conflictPlan.put("migrationMode","SAFE_CREATE_TABLE");
        conflictPlan.put("schemaFingerprint",CompositeExecutableDesignAuthorityCompiler.hash(
            CompositeExecutableDesignAuthorityCompiler.stable(changes)));
        conflictPlan.put("schemaChanges",changes);
        jdbc.update("update framework_professional_screen_contract set data_contract=?, "+
            "field_contract=replace(field_contract,'TICKET','ITEM') where "+
            "process_code='PROC' and route_path='/work-b'",json(conflictPlan));
        IllegalStateException conflict=assertThrows(IllegalStateException.class,()->compileComposite(
            Map.of("processCode","PROC","previewOnly",false,"scopeType","GLOBAL")));
        assertTrue(conflict.getMessage().contains("COMPOSITE_CROSS_SCREEN_DATABASE_CONTRADICTION"),
            conflict.getMessage());
        assertEquals(0,count("integrated_design_document"));assertEquals(0,count("integrated_design_authority"));
        assertEquals(0,count("framework_development_job"));
    }

    @Test
    void generatedTwoTableMigrationUsesLocalMarkersAndReplayWritesZero() throws Exception{
        seedCompositeThreeScreens();
        jdbc.update("""
            delete from framework_process_step_screen_binding binding
             using framework_screen_resource resource
             where binding.screen_resource_id=resource.screen_resource_id
               and resource.route_key='/work-b'
            """);
        Map<String,Object> compiled=compileComposite(
            Map.of("processCode","PROC","previewOnly",false,"scopeType","GLOBAL"));
        assertEquals(2,number(compiled,"authorityCount"));
        List<Map<String,Object>> changes=new ArrayList<>();
        for(String encoded:jdbc.queryForList("""
            select (authority.composite_json#>'{executableDesign,DATABASE,schemaChanges}')::text
              from integrated_design_authority authority
             where authority.process_code='PROC'
             order by authority.composite_json#>>'{executableDesign,DATABASE,schemaChanges,0,tableName}' collate "C"
            """,String.class))
            changes.addAll(new ObjectMapper().readValue(encoded,List.class));
        String sql=renderSafeMigrationSql(changes);
        for(Map<String,Object> change:changes){String expected=
            "COMMENT ON TABLE "+change.get("tableName")+" IS 'design-schema-hash:"+
                CompositeDatabasePlanService.tableSchemaFingerprint(change)+"';";
            assertTrue(sql.contains(expected),"expected="+expected+"\nSQL="+sql);}
        jdbc.execute(sql);
        Map<String,Object> before=compositePublicationXmins();
        Map<String,Object> replay=compileComposite(
            Map.of("processCode","PROC","previewOnly",false,"scopeType","GLOBAL"));
        assertEquals("SOURCE_APPLIED_PHYSICAL_QUEUED",replay.get("status"));
        assertEquals(0,number(replay,"refreshInvocationCount"));
        assertEquals(before,compositePublicationXmins());

        jdbc.execute("comment on table approval is 'design-schema-hash:"+"f".repeat(64)+"'");
        IllegalStateException forged=assertThrows(IllegalStateException.class,()->compileComposite(
            Map.of("processCode","PROC","previewOnly",false,"scopeType","GLOBAL")));
        assertTrue(forged.getMessage().contains("DATABASE_SAFE_CREATE_SCHEMA_MARKER_NOT_EXACT"),
            forged.getMessage());
        assertEquals(before,compositePublicationXmins());
    }

    @Test
    void sameStepRouteTransitionOrEndpointConflictRollsBackAllCompositeWrites(){
        seedCompositeThreeScreens();
        jdbc.update("""
            update framework_professional_screen_contract
               set command_contract='[{"commandCode":"SAVE","actorCode":"OWNER_ACTOR","primary":true}]',
                   state_contract='[{"fromState":"DRAFT","commandCode":"SAVE","toState":"BLOCKED"}]',
                   api_contract='[{"method":"POST","path":"/api/admin/items/{executionId}/approve","commandCode":"SAVE","requestFields":["reason"],"responseFields":["approval_id"],"permissionCodes":["PERM_APPROVE"]}]'
             where process_code='PROC' and route_path='/work-admin'
            """);
        IllegalStateException transition=assertThrows(IllegalStateException.class,()->compileComposite(
            Map.of("processCode","PROC","previewOnly",false,"scopeType","GLOBAL")));
        assertTrue(transition.getMessage().contains("COMPOSITE_CROSS_SCREEN_STATE_CONTRADICTION"));
        assertEquals(0,count("integrated_design_document"));assertEquals(0,count("integrated_design_authority"));
        assertEquals(0,count("framework_development_job"));

        jdbc.update("""
            update framework_professional_screen_contract
               set command_contract='[{"commandCode":"APPROVE","actorCode":"OWNER_ACTOR","primary":true}]',
                   state_contract='[{"fromState":"DRAFT","commandCode":"APPROVE","toState":"DONE"}]',
                   api_contract='[{"method":"POST","path":"/api/items/{executionId}","commandCode":"APPROVE","requestFields":["reason"],"responseFields":["approval_id"],"permissionCodes":["PERM_APPROVE"]}]'
             where process_code='PROC' and route_path='/work-admin'
            """);
        IllegalStateException endpoint=assertThrows(IllegalStateException.class,()->compileComposite(
            Map.of("processCode","PROC","previewOnly",false,"scopeType","GLOBAL")));
        assertTrue(endpoint.getMessage().contains("COMPOSITE_CROSS_SCREEN_API_CONTRADICTION"));
        assertEquals(0,count("integrated_design_document"));assertEquals(0,count("integrated_design_authority"));
        assertEquals(0,count("framework_development_job"));
    }

    @Test
    void compositeAutocompletionInspectIsSelectOnlyAndReportsTargetProcessesAndScreens(){
        seedCompositeThreeScreens();
        CompositeDesignOperationalWorker worker=new CompositeDesignOperationalWorker(
            jdbc,new ObjectMapper(),service,new DataSourceTransactionManager(dataSource),
            false,8,25,false);
        try{
            Map<String,Object> report=worker.inspect();
            assertEquals(true,report.get("dryRun"));assertEquals(1,number(report,"totalProcessCount"));
            assertEquals(3,number(report,"screenIdentityCount"));
            assertEquals(0,count("integrated_design_autocompletion_receipt"));
            assertEquals(0,count("integrated_design_document"));assertEquals(0,count("framework_development_job"));
        }finally{worker.close();}
    }

    @Test
    void compositeCompilerReadinessChecksOneHundredEightProcessesReadOnlyWithinFifteenSeconds(){
        seedCompositeThreeScreens();
        cloneCompositeBenchmarkProcesses(2,108);
        prepareCompositeReadinessBenchmarkDocuments();
        assertEquals(108,jdbc.queryForObject(
            "select count(distinct process_code) from framework_composite_design_target_identity",
            Integer.class));
        assertEquals(324,jdbc.queryForObject(
            "select count(*) from framework_composite_design_target_identity",Integer.class));
        assertEquals(5832,jdbc.queryForObject(
            "select count(*) from integrated_design_document where active_yn='Y'",Integer.class));
        assertEquals(108,jdbc.queryForObject("select count(*) from ("+
            CompositeAutocompletionReadinessService.COMPILER_READY_PROCESS_SQL+") ready",
            Integer.class));

        installCompositeReadinessWriteProbe();
        CompositeAutocompletionReadinessService readiness=null;
        try{
            TransactionTemplate rollbackOnly=new TransactionTemplate(
                new DataSourceTransactionManager(dataSource));
            rollbackOnly.setTimeout(15);
            rollbackOnly.setReadOnly(true);
            ActorProcessGovernanceService rollbackGovernance=org.mockito.Mockito.mock(
                ActorProcessGovernanceService.class);
            org.mockito.Mockito.when(rollbackGovernance.inspectCompositeCompilerReadiness(
                org.mockito.ArgumentMatchers.anyString())).thenAnswer(invocation->
                    rollbackOnly.execute(status->{
                        int writesBefore=count("framework_readiness_benchmark_write_probe");
                        try{
                            Map<String,Object> result=service.inspectCompositeCompilerReadiness(
                                invocation.getArgument(0));
                            int writesAfter=count("framework_readiness_benchmark_write_probe");
                            if(writesAfter!=writesBefore)throw new IllegalStateException(
                                "COMPILER_READINESS_WROTE_ROWS: "+(writesAfter-writesBefore));
                            return result;
                        }
                        finally{status.setRollbackOnly();}
                    }));
            long threeStarted=System.nanoTime();
            for(String process:List.of("PROC","BENCH_002","BENCH_003")){
                Map<String,Object> report=rollbackGovernance.inspectCompositeCompilerReadiness(process);
                assertEquals(true,report.get("success"));
                assertEquals("PASS",report.get("compilerClosure"));
                assertEquals(3,number(report,"identityCount"));
                assertEquals(54,number(report,"documentCount"));
                assertEquals(54,number(report,"requiredDocumentCount"));
            }
            long threeMillis=TimeUnit.NANOSECONDS.toMillis(System.nanoTime()-threeStarted);
            assertTrue(threeMillis<15_000,"three-process compiler readiness took "+threeMillis+"ms");
            assertEquals(0,count("framework_readiness_benchmark_write_probe"));

            readiness=new CompositeAutocompletionReadinessService(
                jdbc,rollbackGovernance,new DataSourceTransactionManager(dataSource),8,8,1,
                "","","",8,14_000,0);
            long bulkStarted=System.nanoTime();
            Map<String,Object> report=readiness.inspect(false,0);
            long bulkMillis=TimeUnit.NANOSECONDS.toMillis(System.nanoTime()-bulkStarted);

            assertTrue(bulkMillis<15_000,"108-process readiness took "+bulkMillis+"ms");
            assertTrue(((Number)report.get("preflightLatencyMs")).longValue()<15_000,
                "compiler preflight exceeded 15 seconds: "+report.get("preflightLatencyMs"));
            assertEquals(108,number(report,"preflightCandidateCount"));
            assertEquals(108,number(report,"preflightCheckedCount"));
            assertEquals(0,number(report,"preflightFailureCount"));
            assertEquals(0,number(report,"preflightTimedOutCount"));
            assertEquals(true,report.get("preflightComplete"));
            assertEquals(108,number(report,"readyProcessCount"));
            assertEquals(324,number(report,"readyIdentityCount"));
            assertEquals(0,count("framework_readiness_benchmark_write_probe"));
        }finally{
            if(readiness!=null)readiness.close();
            removeCompositeReadinessWriteProbe();
        }
    }

    @Test
    void compilerOutputAdvancesFinalH1WithoutChangingPreparedSourceH0(){
        seedCompositeThreeScreens();
        prepareMachineOwnedCompositeReadinessDocuments();
        assertEquals(51,jdbc.queryForObject("select count(*) from integrated_design_document "+
            "where process_code='PROC' and updated_by='LIVE_CONTRACT_BACKFILL'",Integer.class));
        assertEquals(3,jdbc.queryForObject("select count(*) from integrated_design_document "+
            "where process_code='PROC' and document_type='TEST' "+
            "and updated_by='MANUAL_LIVE_SMOKE_FIXTURE'",Integer.class));
        jdbc.update("update framework_professional_screen_contract set "+
            "business_purpose='STALE_COMPATIBILITY_ROW_MUST_NOT_REGENERATE_H0' "+
            "where process_code='PROC'");
        String sourceH0=jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class);
        List<Map<String,Object>> sourceMaterial=jdbc.queryForList(
            "select * from framework_composite_dependency_material('PROC') "+
                "order by kind collate \"C\",identity collate \"C\",payload collate \"C\"");
        String beforeFinalH1=jdbc.queryForObject(
            "select framework_composite_final_authority_fingerprint('PROC')",String.class);

        Map<String,Object> compiled=transaction.execute(status->
            service.compileIntegratedDesignProcess(
                Map.of("processCode","PROC","previewOnly",false,"scopeType","GLOBAL"),
                "system-admin"));
        assertEquals("SOURCE_APPLIED_PHYSICAL_QUEUED",compiled.get("status"));
        List<Map<String,Object>> afterMaterial=jdbc.queryForList(
            "select * from framework_composite_dependency_material('PROC') "+
                "order by kind collate \"C\",identity collate \"C\",payload collate \"C\"");
        assertEquals(sourceMaterial,afterMaterial,()->"self-drift kinds: before="+
            sourceMaterial.stream().collect(java.util.stream.Collectors.groupingBy(
                row->String.valueOf(row.get("kind")),java.util.stream.Collectors.counting()))+
            ", after="+afterMaterial.stream().collect(java.util.stream.Collectors.groupingBy(
                row->String.valueOf(row.get("kind")),java.util.stream.Collectors.counting()))+
            ", documentOwners="+jdbc.queryForList("select updated_by,count(*) from "+
                "integrated_design_document where process_code='PROC' group by updated_by"));
        assertEquals(sourceH0,jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class));
        String afterFinalH1=jdbc.queryForObject(
            "select framework_composite_final_authority_fingerprint('PROC')",String.class);
        assertNotEquals(beforeFinalH1,afterFinalH1);
        assertEquals(3,jdbc.queryForObject("select count(*) from framework_screen_blueprint "+
            "where process_code='PROC' and framework_try_jsonb(specification_json) "+
            "#> '{extensions,compositeAuthority}' is not null",Integer.class));
        jdbc.update("update integrated_design_document set content=jsonb_set("+
            "content::jsonb,'{payload,businessPurpose}',to_jsonb('externally changed'::text))::text "+
            "where process_code='PROC' and document_type='REQUIREMENT'");
        assertNotEquals(sourceH0,jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class));
    }

    @Test
    void disabledBulkWorkerRejectsForgedCompletionThenAcceptsExactCanonicalEvidence(){
        seedCompositeThreeScreens();
        Map<String,Object> compiled=compileComposite(
            Map.of("processCode","PROC","previewOnly",false,"scopeType","GLOBAL"));
        long jobId=((Number)((Map<?,?>)((List<?>)compiled.get("receipts")).get(0)).get("jobId")).longValue();
        String fingerprint=jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class);
        jdbc.update("""
            insert into integrated_design_autocompletion_receipt(
              process_code,completion_status,dependency_fingerprint,job_id,started_at)
            values('PROC','SOURCE_APPLIED_PHYSICAL_QUEUED',?,?,current_timestamp)
            """,fingerprint,jobId);
        jdbc.update("update framework_development_job set job_status='VERIFIED',quality_status='VERIFIED',"+
            "evidence_ref='evidence://forged',result_json='{}' where job_id=?",jobId);
        jdbc.update("update framework_process_artifact set delivery_status='VERIFIED',"+
            "evidence_ref='evidence://forged' where process_code='PROC' "+
            "and contract_ref='AUTO:FULL_STACK_GENERATION'");
        CompositeDesignOperationalWorker worker=new CompositeDesignOperationalWorker(
            jdbc,new ObjectMapper(),service,new DataSourceTransactionManager(dataSource),
            false,8,25,false);
        try{worker.runScheduledBatch();
            assertEquals("PENDING",jdbc.queryForObject(
                "select completion_status from integrated_design_autocompletion_receipt where process_code='PROC'",
                String.class));
            assertEquals("CANONICAL_PHYSICAL_EVIDENCE_INVALID",jdbc.queryForObject(
                "select blocker_code from integrated_design_autocompletion_receipt where process_code='PROC'",
                String.class));
            jdbc.update("""
                update integrated_design_autocompletion_receipt
                   set completion_status='SOURCE_APPLIED_PHYSICAL_QUEUED',attempt_count=1,
                       job_id=?,dependency_fingerprint=framework_composite_dependency_fingerprint('PROC'),
                       started_at=current_timestamp-interval '2 seconds',blocker_code=null
                 where process_code='PROC'
                """,jobId);
            installExactCanonicalPhysicalEvidence(jobId);
            String canonicalSetHash=jdbc.queryForObject("""
                select framework_try_jsonb(specification_json)->>'compositeAuthoritySetHash'
                  from framework_development_job where job_id=?
                """,String.class,jobId);
            String forgedSetHash="f".repeat(64);
            assertNotEquals(canonicalSetHash,forgedSetHash);
            jdbc.update("""
                update framework_development_job
                   set specification_json=jsonb_set(framework_try_jsonb(specification_json),
                         '{compositeAuthoritySetHash}',to_jsonb(?::text))::text,
                       result_json=jsonb_set(framework_try_jsonb(result_json),
                         '{canonicalGeneration,compositeAuthoritySetHash}',to_jsonb(?::text))::text
                 where job_id=?
                """,forgedSetHash,forgedSetHash,jobId);
            jdbc.update("""
                update framework_development_job_event
                   set detail_json=jsonb_set(framework_try_jsonb(detail_json),
                         '{compositeAuthoritySetHash}',to_jsonb(?::text))::text
                 where job_id=? and event_type='CANONICAL_RELEASE_FINALIZED'
                """,forgedSetHash,jobId);
            worker.runScheduledBatch();
            assertEquals("PENDING",jdbc.queryForObject(
                "select completion_status from integrated_design_autocompletion_receipt where process_code='PROC'",
                String.class));
            assertEquals("CANONICAL_PHYSICAL_EVIDENCE_INVALID",jdbc.queryForObject(
                "select blocker_code from integrated_design_autocompletion_receipt where process_code='PROC'",
                String.class));
            jdbc.update("""
                update integrated_design_autocompletion_receipt
                   set completion_status='SOURCE_APPLIED_PHYSICAL_QUEUED',attempt_count=2,
                       job_id=?,dependency_fingerprint=framework_composite_dependency_fingerprint('PROC'),
                       started_at=current_timestamp-interval '2 seconds',blocker_code=null
                 where process_code='PROC'
                """,jobId);
            jdbc.update("""
                update framework_development_job
                   set specification_json=jsonb_set(framework_try_jsonb(specification_json),
                         '{compositeAuthoritySetHash}',to_jsonb(?::text))::text
                 where job_id=?
            """,canonicalSetHash,jobId);
            installExactCanonicalPhysicalEvidence(jobId);
            worker.runScheduledBatch();
            assertEquals("SOURCE_APPLIED_PHYSICAL_QUEUED",jdbc.queryForObject(
                "select completion_status from integrated_design_autocompletion_receipt where process_code='PROC'",
                String.class));
            assertEquals("TEST_PENDING",jdbc.queryForObject(
                "select blocker_code from integrated_design_autocompletion_receipt where process_code='PROC'",
                String.class));
            assertEquals(true,jdbc.queryForObject("""
                select receipt_json->>'generationStatus'='PHYSICAL_QUEUED'
                   and receipt_json->>'testStatus'='TEST_PENDING'
                   and receipt_json->'liveSmokeVerified'='false'::jsonb
                  from integrated_design_autocompletion_receipt where process_code='PROC'
                """,Boolean.class));
            String pendingXmin=jdbc.queryForObject(
                "select xmin::text from integrated_design_autocompletion_receipt where process_code='PROC'",
                String.class);
            worker.runScheduledBatch();
            assertEquals(pendingXmin,jdbc.queryForObject(
                "select xmin::text from integrated_design_autocompletion_receipt where process_code='PROC'",
                String.class));
            assertEquals(44,installExactLiveSmokeEvidence(jobId,true));
            worker.runScheduledBatch();
            assertEquals("SOURCE_APPLIED_PHYSICAL_QUEUED",jdbc.queryForObject(
                "select completion_status from integrated_design_autocompletion_receipt where process_code='PROC'",
                String.class));
            assertEquals("TEST_PENDING",jdbc.queryForObject(
                "select blocker_code from integrated_design_autocompletion_receipt where process_code='PROC'",
                String.class));
            assertThrows(RuntimeException.class,()->jdbc.update("""
                update integrated_design_live_smoke_evidence set status_hash=repeat('f',64)
                 where live_evidence_id=(select min(live_evidence_id)
                   from integrated_design_live_smoke_evidence)
                """));
            assertEquals(1,installExactLiveSmokeEvidence(jobId,false));
            markDispatchEvidenceSubmitted(jobId);
            assertFinalizerRejectsReplacedBrowserArtifact(jobId,worker);
            assertEquals(CompositePhysicalEvidenceService.Verdict.EXACT,
                physicalEvidence().assess(jobId,"PROC"),
                ()->String.valueOf(jdbc.queryForMap("""
                    select status,expected_evidence_count,submitted_evidence_count,
                           authority_revision_set_hash,
                           framework_composite_authority_revision_set_hash(job_id) current_hash
                      from integrated_design_live_smoke_dispatch where job_id=?
                    """,jobId))+" evidence="+String.valueOf(jdbc.queryForMap("""
                    select count(*)::integer as "evidenceCount",
                           count(*) filter(where evidence.observed_at<job.completed_at)::integer
                             as "beforeCompletion",
                           count(*) filter(where evidence.observed_at>evidence.recorded_at)::integer
                             as "afterRecording",
                           min(extract(epoch from(evidence.observed_at-job.completed_at)))
                             as "minAfterCompletionSeconds",
                           min(extract(epoch from(evidence.recorded_at-evidence.observed_at)))
                             as "minBeforeRecordingSeconds"
                      from integrated_design_live_smoke_evidence evidence
                      join framework_development_job job on job.job_id=evidence.job_id
                     where evidence.job_id=? group by job.completed_at
                    """,jobId)));
            worker.runScheduledBatch();
            assertEquals("PHYSICAL_GENERATED_VERIFIED",jdbc.queryForObject(
                "select completion_status from integrated_design_autocompletion_receipt where process_code='PROC'",
                String.class));
            assertEquals(true,jdbc.queryForObject("""
                select receipt.receipt_json->'canonicalGeneration'=
                         framework_try_jsonb(job.result_json)->'canonicalGeneration'
                        and receipt.receipt_json->>'jobEvidenceRef'=job.evidence_ref
                       and receipt.receipt_json->'liveSmokeVerified'='true'::jsonb
                       and receipt.receipt_json->>'testStatus'='VERIFIED'
                       and (receipt.receipt_json->>'liveSmokeEvidenceCount')::integer=45
                  from integrated_design_autocompletion_receipt receipt
                  join framework_development_job job on job.job_id=receipt.job_id
                 where receipt.process_code='PROC'
                """,Boolean.class));
            String verifiedXmin=jdbc.queryForObject(
                "select xmin::text from integrated_design_autocompletion_receipt where process_code='PROC'",
                String.class);
            worker.runScheduledBatch();
            assertEquals(verifiedXmin,jdbc.queryForObject(
                "select xmin::text from integrated_design_autocompletion_receipt where process_code='PROC'",
                String.class));
            assertEquals(1,count("integrated_design_autocompletion_receipt"));
            jdbc.update("update framework_permission_grant_v1 set use_at='N' "+
                "where actor_code='PRIMARY_ACTOR'");
            assertNotEquals(fingerprint,jdbc.queryForObject(
                "select framework_composite_dependency_fingerprint('PROC')",String.class));
            worker.runScheduledBatch();
            assertEquals(Map.of("completionStatus","PENDING","attemptCount",0,"jobCount",0),
                jdbc.queryForMap("""
                    select completion_status as "completionStatus",attempt_count as "attemptCount",
                           count(job_id)::integer as "jobCount"
                      from integrated_design_autocompletion_receipt where process_code='PROC'
                     group by completion_status,attempt_count
                    """));
        }finally{worker.close();}
    }

    @Test
    void twoCommandAuthorityRequiresThirtyExactLaneCaseRowsBeforePhysicalPromotion(){
        seedCompositeThreeScreens();
        String apiContract=json(List.of(
            executableApiOperation("POST","/api/items/{executionId}","SAVE",
                "name","id","PERM_SAVE"),
            executableApiOperation("POST","/api/items/{executionId}/submit","SUBMIT",
                "name","id","PERM_SAVE")));
        jdbc.update("""
            update framework_professional_screen_contract
               set command_contract='[{"commandCode":"SAVE","actorCode":"PRIMARY_ACTOR","primary":true},{"commandCode":"SUBMIT","actorCode":"PRIMARY_ACTOR","primary":false}]',
                   state_contract='[{"fromState":"DRAFT","commandCode":"SAVE","toState":"DONE"},{"fromState":"DRAFT","commandCode":"SUBMIT","toState":"DONE"}]',
                   api_contract=?
             where process_code='PROC' and route_path='/work-a'
            """,apiContract);
        Map<String,Object> compiled=compileComposite(
            Map.of("processCode","PROC","previewOnly",false,"scopeType","GLOBAL"));
        long jobId=((Number)((Map<?,?>)((List<?>)compiled.get("receipts")).get(0)).get("jobId")).longValue();
        String fingerprint=jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class);
        jdbc.update("""
            insert into integrated_design_autocompletion_receipt(
              process_code,completion_status,dependency_fingerprint,job_id,started_at)
            values('PROC','SOURCE_APPLIED_PHYSICAL_QUEUED',?,?,current_timestamp)
            """,fingerprint,jobId);
        installExactCanonicalPhysicalEvidence(jobId);
        assertEquals(10,jdbc.queryForObject("""
            select jsonb_array_length(composite_json#>'{executableDesign,TEST,scenarios}')
              from integrated_design_authority where route_path='/work-a'
            """,Integer.class));
        CompositeDesignOperationalWorker worker=new CompositeDesignOperationalWorker(
            jdbc,new ObjectMapper(),service,new DataSourceTransactionManager(dataSource),
            false,2,25,false);
        try{
            worker.reconcilePhysicalCompletion();
            assertEquals("TEST_PENDING",jdbc.queryForObject(
                "select blocker_code from integrated_design_autocompletion_receipt where process_code='PROC'",
                String.class));
            assertEquals(60,installExactLiveSmokeEvidence(jobId,false));
            markDispatchEvidenceSubmitted(jobId);
            worker.reconcilePhysicalCompletion();
            assertEquals("PHYSICAL_GENERATED_VERIFIED",jdbc.queryForObject(
                "select completion_status from integrated_design_autocompletion_receipt where process_code='PROC'",
                String.class),()->String.valueOf(jdbc.queryForMap("""
                    select receipt.completion_status as "completionStatus",
                           receipt.blocker_code as "blockerCode",
                           receipt.dependency_fingerprint as "receiptFingerprint",
                           framework_composite_dependency_fingerprint('PROC') as "currentFingerprint",
                           dispatch.status as "dispatchStatus",
                           dispatch.expected_evidence_count as "expectedEvidenceCount",
                           dispatch.submitted_evidence_count as "submittedEvidenceCount"
                      from integrated_design_autocompletion_receipt receipt
                      left join integrated_design_live_smoke_dispatch dispatch
                        on dispatch.job_id=receipt.job_id
                       and dispatch.authority_revision_set_hash=
                           framework_composite_authority_revision_set_hash(dispatch.job_id)
                     where receipt.process_code='PROC'
                    """)));
            assertEquals(60,jdbc.queryForObject(
                "select count(*) from integrated_design_live_smoke_evidence where job_id=?",
                Integer.class,jobId));
        }finally{worker.close();}
    }

    @Test
    void oneLaneOutputHashDriftCannotPromotePhysicalCompletion(){
        seedCompositeThreeScreens();
        Map<String,Object> compiled=compileComposite(
            Map.of("processCode","PROC","previewOnly",false,"scopeType","GLOBAL"));
        long jobId=((Number)((Map<?,?>)((List<?>)compiled.get("receipts")).get(0)).get("jobId")).longValue();
        String fingerprint=jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class);
        jdbc.update("""
            insert into integrated_design_autocompletion_receipt(
              process_code,completion_status,dependency_fingerprint,job_id,started_at)
            values('PROC','SOURCE_APPLIED_PHYSICAL_QUEUED',?,?,current_timestamp)
            """,fingerprint,jobId);
        installExactCanonicalPhysicalEvidence(jobId);
        int before=count("integrated_design_live_smoke_evidence");
        IllegalArgumentException rejected=assertThrows(IllegalArgumentException.class,
            ()->installExactLiveSmokeEvidence(jobId,false,true,true));
        assertTrue(rejected.getMessage().contains("LIVE_SMOKE_OUTPUT_VALUES_NOT_DECLARED"));
        assertEquals(before,count("integrated_design_live_smoke_evidence"));
        assertEquals(CompositePhysicalEvidenceService.Verdict.LIVE_SMOKE_TEST_PENDING,
            physicalEvidence().assess(jobId,"PROC"));
        assertEquals(0,jdbc.queryForObject(
            "select count(*) from integrated_design_live_smoke_evidence where job_id=?",
            Integer.class,jobId));
    }

    @Test
    void currentRevisionEvidenceAppendsOnReusedJobAndIgnoresRetainedPriorRevision(){
        seedCompositeThreeScreens();
        Map<String,Object> first=compileComposite(
            Map.of("processCode","PROC","previewOnly",false,"scopeType","GLOBAL"));
        long jobId=((Number)((Map<?,?>)((List<?>)first.get("receipts")).get(0)).get("jobId")).longValue();
        String fingerprint=jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class);
        jdbc.update("""
            insert into integrated_design_autocompletion_receipt(
              process_code,completion_status,dependency_fingerprint,job_id,started_at)
            values('PROC','SOURCE_APPLIED_PHYSICAL_QUEUED',?,?,current_timestamp)
            """,fingerprint,jobId);
        installExactCanonicalPhysicalEvidence(jobId);
        assertEquals(45,installExactLiveSmokeEvidence(jobId,false));
        markDispatchEvidenceSubmitted(jobId);
        assertEquals(CompositePhysicalEvidenceService.Verdict.EXACT,
            physicalEvidence().assess(jobId,"PROC"),
            ()->String.valueOf(jdbc.queryForMap("""
                select count(*)::integer as "evidenceCount",
                       count(*) filter(where evidence.observed_at<job.completed_at)::integer
                         as "beforeCompletion",
                       count(*) filter(where evidence.observed_at>evidence.recorded_at)::integer
                         as "afterRecording",
                       min(extract(epoch from(evidence.observed_at-job.completed_at)))
                         as "minAfterCompletionSeconds",
                       min(extract(epoch from(evidence.recorded_at-evidence.observed_at)))
                         as "minBeforeRecordingSeconds",
                       count(*) filter(where evidence.authority_revision<>
                         authority.authority_revision)::integer as "revisionInvalid",
                       count(*) filter(where evidence.project_id<>'*')::integer as "projectInvalid",
                       count(*) filter(where evidence.lane_evidence->>'artifactHash'<>
                         framework_try_jsonb(job.result_json)#>>
                           '{canonicalGeneration,compositeArtifactManifestHash}')::integer
                         as "artifactInvalid",
                       (select count(*)::integer from(select authority_id,command_code,scenario_code,
                              status_case from integrated_design_live_smoke_evidence where job_id=?
                              group by authority_id,command_code,scenario_code,status_case
                             having count(distinct account_hash)>1 or count(distinct command_hash)>1
                                 or count(distinct input_hash)>1 or count(distinct output_hash)>1
                                 or count(distinct state_hash)>1 or count(distinct status_hash)>1) drift)
                         as "crossLaneDrift"
                  from integrated_design_live_smoke_evidence evidence
                  join framework_development_job job on job.job_id=evidence.job_id
                  join integrated_design_authority authority
                    on authority.authority_id=evidence.authority_id
                 where evidence.job_id=? group by job.result_json
                """,jobId,jobId)));
        long priorRevision=jdbc.queryForObject(
            "select min(authority_revision) from integrated_design_authority",Long.class);

        jdbc.update("""
            update framework_professional_screen_contract
               set business_purpose=business_purpose||' revision two'
             where process_code='PROC' and route_path='/work-a'
            """);
        Map<String,Object> next=compileComposite(
            Map.of("processCode","PROC","previewOnly",false,"scopeType","GLOBAL"));
        long reusedJobId=((Number)((Map<?,?>)((List<?>)next.get("receipts")).get(0)).get("jobId")).longValue();
        assertEquals(jobId,reusedJobId);
        jdbc.update("""
            update integrated_design_autocompletion_receipt
               set dependency_fingerprint=framework_composite_dependency_fingerprint('PROC'),
                   receipt_json=receipt_json||jsonb_build_object(
                     'sourceInputDependencyHash',
                       framework_composite_dependency_fingerprint('PROC'))
             where process_code='PROC' and job_id=?
            """,jobId);
        assertTrue(jdbc.queryForObject(
            "select max(authority_revision) from integrated_design_authority",Long.class)>priorRevision);
        assertEquals(45,jdbc.queryForObject(
            "select count(*) from integrated_design_live_smoke_evidence where job_id=?",
            Integer.class,jobId));
        installExactCanonicalPhysicalEvidence(jobId);
        assertEquals(CompositePhysicalEvidenceService.Verdict.LIVE_SMOKE_TEST_PENDING,
            physicalEvidence().assess(jobId,"PROC"),
            "retained rows from the wrong authority revision must not verify the new revision");
        int retainedPriorRevision=jdbc.queryForObject("""
            select count(*) from integrated_design_live_smoke_evidence evidence
             where evidence.job_id=? and not exists(
               select 1 from integrated_design_authority authority
                where authority.authority_id=evidence.authority_id
                  and authority.authority_revision=evidence.authority_revision
                  and authority.job_id=evidence.job_id
                  and authority.source_hash=evidence.source_hash
                  and authority.authority_hash=evidence.authority_hash)
            """,Integer.class,jobId);
        assertTrue(retainedPriorRevision>0);

        int appended=installExactLiveSmokeEvidence(jobId,false);
        assertTrue(appended>0);
        String beforeReplay=jdbc.queryForObject("""
            select string_agg(live_evidence_id||':'||xmin::text,',' order by live_evidence_id)
              from integrated_design_live_smoke_evidence where job_id=?
            """,String.class,jobId);
        assertEquals(0,installExactLiveSmokeEvidence(jobId,false));
        assertEquals(beforeReplay,jdbc.queryForObject("""
            select string_agg(live_evidence_id||':'||xmin::text,',' order by live_evidence_id)
              from integrated_design_live_smoke_evidence where job_id=?
            """,String.class,jobId));
        markDispatchEvidenceSubmitted(jobId);
        assertEquals(45+appended,jdbc.queryForObject(
            "select count(*) from integrated_design_live_smoke_evidence where job_id=?",
            Integer.class,jobId));
        assertEquals(retainedPriorRevision,jdbc.queryForObject("""
            select count(*) from integrated_design_live_smoke_evidence evidence
             where evidence.job_id=? and not exists(
               select 1 from integrated_design_authority authority
                where authority.authority_id=evidence.authority_id
                  and authority.authority_revision=evidence.authority_revision
                  and authority.job_id=evidence.job_id
                  and authority.source_hash=evidence.source_hash
                  and authority.authority_hash=evidence.authority_hash)
            """,Integer.class,jobId));
        assertEquals(45,jdbc.queryForObject("""
            select count(*) from integrated_design_live_smoke_evidence evidence
              join integrated_design_authority authority
                on authority.authority_id=evidence.authority_id
               and authority.authority_revision=evidence.authority_revision
               and authority.job_id=evidence.job_id
               and authority.source_hash=evidence.source_hash
               and authority.authority_hash=evidence.authority_hash
             where evidence.job_id=? and evidence.process_code='PROC'
            """,Integer.class,jobId));
        assertEquals(CompositePhysicalEvidenceService.Verdict.EXACT,
            physicalEvidence().assess(jobId,"PROC"),
            ()->String.valueOf(jdbc.queryForMap("""
                select count(*)::integer as "evidenceCount",
                       count(*) filter(where evidence.observed_at<job.completed_at)::integer
                         as "beforeCompletion",
                       count(*) filter(where evidence.observed_at>evidence.recorded_at)::integer
                         as "afterRecording",
                       min(extract(epoch from(evidence.observed_at-job.completed_at)))
                         as "minAfterCompletionSeconds",
                       min(extract(epoch from(evidence.recorded_at-evidence.observed_at)))
                         as "minBeforeRecordingSeconds",
                       count(*) filter(where evidence.authority_revision<>
                         authority.authority_revision)::integer as "revisionInvalid"
                  from integrated_design_live_smoke_evidence evidence
                  join framework_development_job job on job.job_id=evidence.job_id
                  join integrated_design_authority authority
                    on authority.authority_id=evidence.authority_id
                   and authority.authority_revision=evidence.authority_revision
                 where evidence.job_id=? group by job.completed_at
                """,jobId)));
    }

    @Test
    void dependencyDriftRequeuesEveryTerminalOrPhysicalStateAndDiscardsStaleJobs(){
        for(String status:List.of("SOURCE_APPLIED_GENERATION_QUEUED","SOURCE_APPLIED_UNCHANGED",
                "SOURCE_APPLIED_PHYSICAL_QUEUED",
                "PHYSICAL_GENERATED_VERIFIED","PHYSICAL_FAILED","BLOCKED")){
            String process="DRIFT_"+status;
            jdbc.update("""
                insert into integrated_design_autocompletion_receipt(
                  process_code,completion_status,attempt_count,dependency_fingerprint,job_id,
                  started_at,completed_at,duration_ms)
                values(?,?,4,repeat('f',64),900,current_timestamp-interval '1 minute',
                  current_timestamp,60000)
                """,process,status);
        }
        CompositeDesignOperationalWorker worker=new CompositeDesignOperationalWorker(
            jdbc,new ObjectMapper(),service,new DataSourceTransactionManager(dataSource),
            false,2,25,false);
        try{worker.reconcilePhysicalCompletion();
            assertEquals(6,jdbc.queryForObject("""
                select count(*) from integrated_design_autocompletion_receipt
                 where process_code like 'DRIFT_%' and completion_status='PENDING'
                   and attempt_count=0 and job_id is null
                   and started_at<current_timestamp-interval '30 seconds'
                   and completed_at is null and duration_ms is null
                   and receipt_json->>'generationStatus'='DEPENDENCY_CHANGED_REQUEUE'
                """,Integer.class));
        }finally{worker.close();}
    }

    @Test
    void dependencyFingerprintUsesDesignDocumentsAndRelayReadinessOnly(){
        seedCompositeThreeScreens();
        compileComposite(Map.of(
            "processCode","PROC","previewOnly",false,"scopeType","GLOBAL"));
        String original=jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class);
        jdbc.update("update framework_screen_resource set layout_type='KRDS_ALTERNATE' "+
            "where route_key='/work-a'");
        String layoutChanged=jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class);
        assertEquals(original,layoutChanged);
        jdbc.execute("create table item(name text not null,id integer primary key)");
        String catalogChanged=jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class);
        assertEquals(layoutChanged,catalogChanged);
        jdbc.execute("comment on table item is 'design-schema-hash:forged'");
        String commentChanged=jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class);
        assertEquals(catalogChanged,commentChanged);
        jdbc.update("update framework_account_actor_assignment set valid_until=current_date-1 "+
            "where actor_code='PRIMARY_ACTOR'");
        assertNotEquals(commentChanged,jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class));
    }

    @Test
    void dependencyFingerprintIncludesExplicitProcessVersion(){
        seedCompositeThreeScreens();
        prepareMachineOwnedCompositeReadinessDocuments();
        String original=jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class);

        jdbc.update("update framework_process_definition set process_version='2.0.0' "+
            "where process_code='PROC'");
        String changed=jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class);
        assertNotEquals(original,changed);

        jdbc.update("update framework_process_definition set process_version='1.0.0' "+
            "where process_code='PROC'");
        assertEquals(original,jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class));
    }

    @Test
    void dependencyFingerprintUsesExactTargetIdentityAndTracksDocumentlessLifecycle(){
        seedCompositeThreeScreens();
        prepareMachineOwnedCompositeReadinessDocuments();
        assertEquals(54,jdbc.queryForObject("select count(*) from integrated_design_document "+
            "where process_code='PROC' and active_yn='Y'",Integer.class));
        String original=jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class);
        assertEquals(List.of("audience","contractId","processCode","routePath","stepCode"),
            jdbc.queryForList("""
                select distinct key collate "C" as key
                  from framework_composite_dependency_material('PROC') material
                  cross join lateral jsonb_object_keys(material.payload::jsonb) keys(key)
                 where material.kind='TARGET_IDENTITY'
                 order by key
                """,String.class));

        long workResource=jdbc.queryForObject(
            "select screen_resource_id from framework_screen_resource where route_key='/work-a'",
            Long.class);
        jdbc.update("""
            insert into framework_process_step_screen_binding(
              process_code,step_code,screen_resource_id,actor_code,audience,binding_status)
            values('PROC','STEP',?,'ESCALATION_ACTOR','USER','ACTIVE')
            """,workResource);
        assertEquals(2,jdbc.queryForObject("""
            select binding_count from framework_composite_design_target_identity
             where process_code='PROC' and step_code='STEP'
               and route_path='/work-a' and audience='USER'
            """,Integer.class));
        assertEquals(original,jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class),
            "binding diagnostics are mutable target projections, not source identity");

        seedStep("NO_DOC_STEP",2,"COMPLETE",true);
        assertEquals(0,jdbc.queryForObject("""
            select count(*) from integrated_design_document
             where process_code='PROC' and step_code='NO_DOC_STEP'
            """,Integer.class));
        assertEquals(1,jdbc.queryForObject("""
            select count(*) from framework_composite_design_target_identity
             where process_code='PROC' and step_code='NO_DOC_STEP'
            """,Integer.class));
        String added=jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class);
        assertNotEquals(original,added,
            "a target must enter H0 immediately, before its eighteen documents exist");

        jdbc.update("update framework_process_step set user_path='/documentless-v2' "+
            "where process_code='PROC' and step_code='NO_DOC_STEP'");
        String routeChanged=jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class);
        assertNotEquals(added,routeChanged);
        jdbc.update("update framework_process_step set user_path='/no_doc_step' "+
            "where process_code='PROC' and step_code='NO_DOC_STEP'");
        assertEquals(added,jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class));

        jdbc.update("update framework_process_step set step_code='NO_DOC_RENAMED' "+
            "where process_code='PROC' and step_code='NO_DOC_STEP'");
        assertNotEquals(added,jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class));
        jdbc.update("update framework_process_step set step_code='NO_DOC_STEP' "+
            "where process_code='PROC' and step_code='NO_DOC_RENAMED'");
        assertEquals(added,jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class));

        jdbc.update("""
            update framework_process_step
               set requires_user_page=false,requires_admin_page=true,admin_path=user_path
             where process_code='PROC' and step_code='NO_DOC_STEP'
            """);
        String audienceChanged=jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class);
        assertNotEquals(added,audienceChanged);
        jdbc.update("""
            update framework_process_step
               set requires_user_page=true,requires_admin_page=false,admin_path=null
             where process_code='PROC' and step_code='NO_DOC_STEP'
            """);
        assertEquals(added,jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class));

        jdbc.update("""
            insert into framework_professional_screen_contract(
              process_code,step_code,audience,route_path,actor_code,updated_by)
            values('PROC','NO_DOC_STEP','USER','/no_doc_step','PRIMARY_ACTOR','HUMAN_DESIGNER')
            """);
        assertTrue(jdbc.queryForObject("""
            select contract_id is not null from framework_composite_design_target_identity
             where process_code='PROC' and step_code='NO_DOC_STEP'
               and route_path='/no_doc_step' and audience='USER'
            """,Boolean.class));
        assertNotEquals(added,jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class));
        jdbc.update("delete from framework_professional_screen_contract "+
            "where process_code='PROC' and step_code='NO_DOC_STEP'");
        assertEquals(added,jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class));

        jdbc.update("update framework_process_step set requires_user_page=false "+
            "where process_code='PROC' and step_code='NO_DOC_STEP'");
        assertEquals(0,jdbc.queryForObject("""
            select count(*) from framework_composite_design_target_identity
             where process_code='PROC' and step_code='NO_DOC_STEP'
            """,Integer.class));
        assertEquals(original,jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class),
            "removing the documentless target must restore the exact prior H0");
    }

    @Test
    void physicalP95RequiresVerifiedSamplesAndExcludesFastBlockers(){
        seedCompositeThreeScreens();
        PhysicalRearmCampaign campaign=installDispatchablePhysicalRearmCampaign();
        jdbc.update("""
            insert into integrated_design_autocompletion_receipt(
              process_code,completion_status,dependency_fingerprint,duration_ms)
            values('SLA_BLOCKED','BLOCKED',
              framework_composite_dependency_fingerprint('SLA_BLOCKED'),1)
            """);
        CompositeAutocompletionReadinessService readiness=
            new CompositeAutocompletionReadinessService(jdbc,service,
                new DataSourceTransactionManager(dataSource),2,2,1,
                campaign.newCommit(),"","");
        CompositeDesignOperationalWorker worker=new CompositeDesignOperationalWorker(
            jdbc,new ObjectMapper(),service,readiness,new DataSourceTransactionManager(dataSource),
            false,2,25,false,600,30);
        try{Map<String,Object> empty=worker.inspect();
            assertEquals("MEASUREMENT_REQUIRED",empty.get("tenMinuteTarget"));
            assertEquals(0,number(empty,"physicalSampleCount"));
            assertEquals(0L,((Number)empty.get("p95CompileMs")).longValue());
            assertEquals(2,number(empty,"liveSmokeParallelism"));
            assertNull(empty.get("estimatedPhysicalTotalSeconds"));
            int rearmed=transaction.execute(status->{
                readiness.acquireGlobalDispatchLock(910_881_003L);
                return readiness.rearmPhysicalCanary(UUID.randomUUID().toString(),
                    campaign.newCommit(),campaign.sourceHash(),1).size();
            });
            assertEquals(1,rearmed);
            worker.reconcilePhysicalCompletion();
            assertEquals(45,installExactLiveSmokeEvidence(campaign.jobId(),false));
            markDispatchEvidenceSubmitted(campaign.jobId());
            worker.reconcilePhysicalCompletion();
            assertEquals(1,jdbc.update("""
                update integrated_design_autocompletion_receipt set duration_ms=1234
                 where process_code='PROC'
                   and receipt_json#>>'{canary,status}'='VERIFIED'
                """));
            Map<String,Object> measured=worker.inspect();
            assertEquals(1,number(measured,"physicalSampleCount"));
            assertEquals(1234L,((Number)measured.get("p95CompileMs")).longValue());
            assertEquals(1234L,((Number)measured.get("p95PhysicalMs")).longValue());
            assertEquals(2,number(measured,"liveSmokeParallelism"));
        }finally{
            worker.close();resetAutocompletionGate();
            jdbc.update("delete from framework_postdeploy_release_attempt where candidate_id=?",
                campaign.candidateId());
        }
    }

    @Test
    void disabledManualDispatchDrainsRequestedBatchAndPreservesFirstStart() throws Exception {
        seedCompositeThreeScreens();
        cloneCompositeBenchmarkProcesses(2,7);
        prepareCompositeReadinessBenchmarkDocuments();
        List<String> processes=jdbc.queryForList("""
            select process_code from (
              select distinct process_code from framework_composite_design_target_identity
            ) target
             order by process_code collate "C"
            """,String.class);
        assertEquals(7,processes.size());
        for(String process:processes)jdbc.update("""
            insert into integrated_design_autocompletion_receipt(
              process_code,completion_status,dependency_fingerprint,started_at)
            values(?,'PENDING',framework_composite_dependency_fingerprint(?),
              current_timestamp-interval '2 minutes')
            """,process,process);
        ActorProcessGovernanceService fake=org.mockito.Mockito.mock(
            ActorProcessGovernanceService.class);
        org.mockito.Mockito.when(fake.inspectCompositeCompilerReadiness(
            org.mockito.ArgumentMatchers.anyString())).thenReturn(Map.of(
                "success",true,"compilerClosure","PASS","identityCount",3,"documentCount",54));
        org.mockito.Mockito.when(fake.compileIntegratedDesignProcess(
            org.mockito.ArgumentMatchers.anyMap(),org.mockito.ArgumentMatchers.anyString()))
            .thenAnswer(invocation->{
                @SuppressWarnings("unchecked") Map<String,Object> request=invocation.getArgument(0);
                String process=String.valueOf(request.get("processCode"));
                return Map.ofEntries(Map.entry("status","SOURCE_APPLIED_PHYSICAL_QUEUED"),
                    Map.entry("screenCount",1),Map.entry("documentCount",18),
                    Map.entry("authorityCount",1),Map.entry("receipts",
                        List.of(Map.of("jobId",Math.abs((long)process.hashCode())+1L))));
            });
        CompositeDesignOperationalWorker worker=new CompositeDesignOperationalWorker(
            jdbc,new ObjectMapper(),fake,new DataSourceTransactionManager(dataSource),
            false,2,25,false){
                @Override Map<String,Object> scopeForProcess(String ignored){
                    return Map.of("scopeType","GLOBAL");
                }
            };
        try{Map<String,Object> accepted=worker.dispatch(5);
            assertEquals(true,accepted.get("manualDrain"));
            assertTrue(String.valueOf(accepted.get("manualRunToken"))
                .matches("[0-9a-f-]{36}"));
            long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(5);
            int completed;
            do{completed=jdbc.queryForObject("""
                    select count(*) from integrated_design_autocompletion_receipt
                     where completion_status='SOURCE_APPLIED_PHYSICAL_QUEUED'
                    """,Integer.class);
                if(completed<5)Thread.sleep(20);
            }while(completed<5&&System.nanoTime()<deadline);
            assertEquals(5,completed);
            assertEquals(2,jdbc.queryForObject("""
                select count(*) from integrated_design_autocompletion_receipt
                 where completion_status='PENDING'
                """,Integer.class));
            assertEquals(5,jdbc.queryForObject("""
                select count(*) from integrated_design_autocompletion_receipt
                 where completion_status='SOURCE_APPLIED_PHYSICAL_QUEUED'
                   and started_at<current_timestamp-interval '90 seconds'
                """,Integer.class));
        }finally{worker.close();}
    }

    @Test
    void workerSerializationRetryRollsBackWholePostgresTransactionTwiceThenPublishesOnce()
            throws Exception {
        seedCompositeThreeScreens();
        prepareCompositeReadinessBenchmarkDocuments();
        jdbc.update("delete from framework_design_asset_registry "+
            "where design_asset_id='SERIALIZATION_RETRY_REGISTRY'");
        String baselineFingerprint=jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class);
        assertEquals(1,jdbc.update("""
            insert into integrated_design_autocompletion_receipt(
              process_code,completion_status,dependency_fingerprint,receipt_json)
            values('PROC','PENDING',?,jsonb_build_object('requestedScope',
              jsonb_build_object('scopeType','GLOBAL','source','MIGRATION_GLOBAL_TARGET')))
            """,baselineFingerprint));

        AtomicInteger attempts=new AtomicInteger();
        List<String> claimedProcesses=java.util.Collections.synchronizedList(new ArrayList<>());
        CountDownLatch[] entered={new CountDownLatch(1),new CountDownLatch(1)};
        CountDownLatch[] releaseFailure={new CountDownLatch(1),new CountDownLatch(1)};
        ActorProcessGovernanceService faulting=org.mockito.Mockito.spy(service);
        org.mockito.Mockito.doAnswer(invocation->{
            @SuppressWarnings("unchecked") Map<String,Object> request=invocation.getArgument(0);
            String process=String.valueOf(request.get("processCode"));
            claimedProcesses.add(process);
            if(!"PROC".equals(process)||!Boolean.FALSE.equals(request.get("previewOnly"))
                    ||!"GLOBAL".equals(request.get("scopeType")))
                throw new IllegalStateException("SERIALIZATION_RETRY_SOURCE_CLAIM_INVALID: "+request);
            int attempt=attempts.incrementAndGet();
            if(attempt>3)throw new IllegalStateException(
                "SERIALIZATION_RETRY_SOURCE_CLAIM_DUPLICATED: "+attempt);
            if(jdbc.update("""
                insert into framework_process_artifact(
                  process_code,step_code,artifact_code,artifact_type,artifact_name,target_path,
                  contract_ref,required,delivery_status,owner_actor_code)
                values('PROC','STEP','SERIALIZATION_RETRY_SOURCE','SOURCE',
                  'Serialization retry source','/generated/serialization-retry-source',
                  'AUTO:SERIALIZATION_RETRY',true,'PLANNED','OWNER_ACTOR')
                """)!=1)throw new IllegalStateException("SERIALIZATION_RETRY_SOURCE_WRITE_NOT_EXACT");
            if(jdbc.update("""
                insert into framework_design_asset_registry(
                  design_asset_id,route_path,source_path,active_yn)
                values('SERIALIZATION_RETRY_REGISTRY','/serialization-retry-source',
                  '/generated/serialization-retry-source','Y')
                """)!=1)throw new IllegalStateException("SERIALIZATION_RETRY_REGISTRY_WRITE_NOT_EXACT");
            long jobId=jdbc.queryForObject("""
                insert into framework_development_job(
                  process_code,step_code,job_type,job_name,target_path,specification_json,
                  job_status,approval_status,execution_mode,job_group_code,required,
                  progress_weight,max_attempts,quality_status,created_by,result_json)
                values('PROC','STEP','FULL_STACK_GENERATION','Serialization retry job',
                  '/generated/serialization-retry-source','{}','PLANNED','APPROVED','AUTOMATED',
                  'PROC_CANONICAL_PUBLICATION',true,1,3,'PENDING','POSTGRES_TEST','{}')
                returning job_id
                """,Long.class);
            if(attempt<=2){
                entered[attempt-1].countDown();
                try{
                    if(!releaseFailure[attempt-1].await(15,TimeUnit.SECONDS))
                        throw new IllegalStateException(
                            "SERIALIZATION_RETRY_FAILURE_RELEASE_TIMEOUT: "+attempt);
                }catch(InterruptedException error){
                    Thread.currentThread().interrupt();throw new IllegalStateException(error);
                }
                throw new IllegalStateException("SERIALIZATION_RETRY_FIXTURE_"+attempt,
                    new java.sql.SQLException("serialization retry fixture","40001"));
            }
            return Map.ofEntries(
                Map.entry("status","SOURCE_APPLIED_PHYSICAL_QUEUED"),
                Map.entry("screenCount",3),Map.entry("documentCount",54),
                Map.entry("authorityCount",3),
                Map.entry("receipts",List.of(Map.of("jobId",jobId))));
        }).when(faulting).compileIntegratedDesignProcess(
            org.mockito.ArgumentMatchers.anyMap(),org.mockito.ArgumentMatchers.anyString());

        CompositeDesignOperationalWorker worker=new CompositeDesignOperationalWorker(
            jdbc,new ObjectMapper(),faulting,new DataSourceTransactionManager(dataSource),
            false,1,1,false);
        PostgresAdvisoryTransaction firstHolder=null,secondHolder=null;
        try{
            Map<String,Object> accepted=worker.dispatch(1);
            assertEquals(1,number(accepted,"claimedCount"));
            assertEquals(List.of("PROC"),accepted.get("processCodes"));
            assertTrue(entered[0].await(10,TimeUnit.SECONDS),"first compile attempt entered");
            firstHolder=holdPostgresAdvisoryTransaction(0x434f4d504155544fL);
            releaseFailure[0].countDown();
            assertSerializationRetryWait(1,1,50,baselineFingerprint,10);
            awaitWorkerIdle(worker,5);
            firstHolder.close();firstHolder=null;

            assertTrue(entered[1].await(10,TimeUnit.SECONDS),"second compile attempt entered");
            secondHolder=holdPostgresAdvisoryTransaction(0x434f4d504155544fL);
            releaseFailure[1].countDown();
            assertSerializationRetryWait(2,2,100,baselineFingerprint,10);
            awaitWorkerIdle(worker,5);
            secondHolder.close();secondHolder=null;

            awaitReceiptCompletion("SOURCE_APPLIED_PHYSICAL_QUEUED",20);
            awaitWorkerIdle(worker,5);
            assertEquals(3,attempts.get());
            assertEquals(List.of("PROC","PROC","PROC"),claimedProcesses);
            Map<String,Object> completed=jdbc.queryForMap("""
                select completion_status as "completionStatus",attempt_count as "attemptCount",
                       blocker_code as "blockerCode",lease_token::text as "leaseToken",
                       lease_until as "leaseUntil",job_id as "jobId",
                       receipt_json?'serializationRetryAttempt' as "hasRetryAttempt",
                       receipt_json?'serializationRetryContext' as "hasRetryContext",
                       receipt_json->>'generationStatus' as "generationStatus",
                       dependency_fingerprint as "dependencyFingerprint",
                       framework_composite_dependency_fingerprint('PROC') as "currentFingerprint"
                  from integrated_design_autocompletion_receipt where process_code='PROC'
                """);
            assertEquals("SOURCE_APPLIED_PHYSICAL_QUEUED",completed.get("completionStatus"));
            assertEquals(3,((Number)completed.get("attemptCount")).intValue());
            assertNull(completed.get("blockerCode"));assertNull(completed.get("leaseToken"));
            assertNull(completed.get("leaseUntil"));
            assertEquals(false,completed.get("hasRetryAttempt"));
            assertEquals(false,completed.get("hasRetryContext"));
            assertEquals("PHYSICAL_EVIDENCE_RECHECK_QUEUED",completed.get("generationStatus"));
            assertEquals(completed.get("currentFingerprint"),completed.get("dependencyFingerprint"));
            assertEquals(1,serializationRetrySourceCount());
            assertEquals(1,serializationRetryRegistryCount());
            assertEquals(1,serializationRetryJobCount());
            assertEquals(1,jdbc.queryForObject("""
                select count(*) from integrated_design_autocompletion_receipt receipt
                  join framework_development_job job on job.job_id=receipt.job_id
                 where receipt.process_code='PROC'
                   and job.job_name='Serialization retry job'
                """,Integer.class));
        }finally{
            releaseFailure[0].countDown();releaseFailure[1].countDown();
            if(firstHolder!=null)firstHolder.close();
            if(secondHolder!=null)secondHolder.close();
            worker.close();
            jdbc.update("delete from framework_design_asset_registry "+
                "where design_asset_id='SERIALIZATION_RETRY_REGISTRY'");
            jdbc.update("delete from framework_process_artifact "+
                "where artifact_code='SERIALIZATION_RETRY_SOURCE'");
            jdbc.update("delete from framework_development_job "+
                "where job_name='Serialization retry job'");
        }
    }

    private Map<String,Object> compileComposite(Map<String,Object> request){
        return transaction.execute(status->{
            jdbc.queryForMap("select * from refresh_integrated_design_axis_documents('PROC',true)");
            for(Map<String,Object> row:jdbc.queryForList("""
                select test.document_id as "documentId",api.document_id as "apiDocumentId",
                       test.content as "testContent",api.content as "apiContent",
                       state.content as "stateContent",
                       validation.content as "validationContent"
                  from integrated_design_document test
                  join integrated_design_document api using(process_code,step_code,route_path,audience)
                  join integrated_design_document state using(process_code,step_code,route_path,audience)
                  join integrated_design_document validation using(process_code,step_code,route_path,audience)
                 where test.process_code='PROC' and test.document_type='TEST'
                   and api.document_type='API' and state.document_type='STATE'
                   and validation.document_type='VALIDATION'
                   and framework_try_jsonb(test.content)#>'{payload,scenarios}'='[]'::jsonb
                """)){
                Map<String,Object> test=readMap(String.valueOf(row.get("testContent")));
                Map<String,Object> api=readMap(String.valueOf(row.get("apiContent")));
                Map<String,Object> state=readMap(String.valueOf(row.get("stateContent")));
                Map<String,Object> validation=readMap(String.valueOf(row.get("validationContent")));
                ((Map<String,Object>)test.get("payload")).put("scenarios",
                    derivedLiveSmokeScenarios(api,state,validation));
                jdbc.update("update integrated_design_document set content=?,status='READY',"+
                    "updated_by='MANUAL_LIVE_SMOKE_FIXTURE' where document_id=?",
                    json(api),row.get("apiDocumentId"));
                jdbc.update("update integrated_design_document set content=?,status='READY',"+
                    "updated_by='MANUAL_LIVE_SMOKE_FIXTURE' where document_id=?",
                    json(test),row.get("documentId"));
            }
            return service.compileIntegratedDesignProcess(request,"system-admin");
        });
    }

    @SuppressWarnings("unchecked")
    private static List<Map<String,Object>> derivedLiveSmokeScenarios(
            Map<String,Object> api,Map<String,Object> state,Map<String,Object> validation){
        List<Map<String,Object>> operations=(List<Map<String,Object>>)
            ((Map<String,Object>)api.get("payload")).get("operations");
        List<Map<String,Object>> transitions=(List<Map<String,Object>>)
            ((Map<String,Object>)state.get("payload")).get("states");
        List<Map<String,Object>> rules=(List<Map<String,Object>>)
            ((Map<String,Object>)validation.get("payload")).get("rules");
        List<Map<String,Object>> scenarios=new ArrayList<>();
        for(Map<String,Object> rawOperation:operations){
            Map<String,Object> operation=rawOperation;
            String command=String.valueOf(operation.get("commandCode"));
            if(!(operation.get("statusResponses") instanceof List<?>)){
                List<?> requestFields=(List<?>)operation.get("requestFields");
                List<?> responseFields=(List<?>)operation.get("responseFields");
                List<?> permissions=(List<?>)operation.get("permissionCodes");
                Map<String,Object> normalized=executableApiOperation(
                    String.valueOf(operation.get("method")),
                    String.valueOf(operation.get("path")),command,
                    String.valueOf(requestFields.get(0)),String.valueOf(responseFields.get(0)),
                    String.valueOf(permissions.get(0)));
                rawOperation.clear();rawOperation.putAll(normalized);operation=rawOperation;
            }
            Map<String,Object> transition=transitions.stream().filter(row->
                command.equals(row.get("commandCode"))).findFirst().orElseThrow();
            Map<String,Object> rule=rules.stream().filter(row->
                command.equals(row.get("commandCode"))).findFirst().orElseThrow();
            List<Map<String,Object>> responses=(List<Map<String,Object>>)operation.get("statusResponses");
            for(Map<String,Object> response:responses){
                String status=String.valueOf(response.get("statusCase"));
                Map<String,Object> input=new LinkedHashMap<>();
                for(Object field:(List<?>)operation.get("requestFields"))
                    input.put(String.valueOf(field),"fixture-"+String.valueOf(field).toLowerCase());
                if("VALIDATION_ERROR".equals(status))input.put(
                    String.valueOf(rule.get("fieldCode")),"");
                String successScenario=command+"_SUCCESS";
                Map<String,Object> trigger=switch(status){
                    case "SUCCESS"->Map.of("kind","NEW_COMMAND");
                    case "VALIDATION_ERROR"->Map.of("kind","DECLARED_VALIDATION_FAILURE",
                        "fieldCode",rule.get("fieldCode"),"errorCode",rule.get("errorCode"));
                    case "FORBIDDEN"->Map.of("kind","UNASSIGNED_ACTOR");
                    case "CONFLICT"->Map.of("kind","STALE_STATE","state",transition.get("toState"),
                        "referenceScenarioCode",successScenario);
                    case "RECOVERY"->Map.of("kind","IDEMPOTENT_REPLAY",
                        "referenceScenarioCode",successScenario);
                    default->throw new IllegalStateException(status);
                };
                scenarios.add(Map.of("scenarioCode",command+"_"+status,"commandCode",command,
                    "inputValues",input,"expectedOutputFields",response.get("bodyFields"),
                    "expectedOutputValues",derivedLiveSmokeOutput(operation,status),
                    "expectedStatus",status,"expectedHttpStatus",response.get("httpStatus"),
                    "trigger",trigger,"assertionCodes",List.of("STATUS_MATCH","OUTPUT_FIELDS_MATCH")));
            }
        }
        return scenarios;
    }

    private static Map<String,Object> executableApiOperation(String method,String path,
            String command,String input,String output,String permission){
        List<String> runtime=List.of("success","idempotent","eventId","toState");
        List<String> success=new ArrayList<>(runtime);success.add(output);
        List<String> recovery=new ArrayList<>(runtime);recovery.add("recovered");recovery.add(output);
        List<String> errors=List.of("success","code","message");
        Map<String,Object> operation=new LinkedHashMap<>();
        operation.put("method",method);operation.put("path",path);
        operation.put("commandCode",command);operation.put("requestFields",List.of(input));
        operation.put("responseFields",List.of(output));operation.put("permissionCodes",List.of(permission));
        operation.put("responseProjection",List.of(Map.of(
            "fieldCode",output,"source","RUNTIME_RESULT","sourcePath","eventId")));
        operation.put("statusResponses",List.of(
            Map.of("statusCase","SUCCESS","httpStatus",200,"bodyFields",success),
            Map.of("statusCase","VALIDATION_ERROR","httpStatus",400,"bodyFields",errors),
            Map.of("statusCase","FORBIDDEN","httpStatus",403,"bodyFields",errors),
            Map.of("statusCase","CONFLICT","httpStatus",409,"bodyFields",errors),
            Map.of("statusCase","RECOVERY","httpStatus",200,"bodyFields",recovery)));
        return operation;
    }

    @SuppressWarnings("unchecked")
    private static Map<String,Object> derivedLiveSmokeOutput(Map<String,Object> operation,String status){
        Map<String,Object> result=new LinkedHashMap<>();
        if(List.of("VALIDATION_ERROR","FORBIDDEN","CONFLICT").contains(status)){
            List<Object> values=switch(status){
                case "VALIDATION_ERROR"->List.of(false,"INVALID_REQUEST","Request failed");
                case "FORBIDDEN"->List.of(false,"ACCESS_DENIED","Access denied");
                default->List.of(false,"CONFLICT","Request conflicts with the current state");
            };
            for(int index=0;index<3;index++)result.put(List.of("success","code","message").get(index),
                Map.of("source","LITERAL","value",values.get(index)));
            return result;
        }
        boolean recovery="RECOVERY".equals(status);
        result.put("success",Map.of("source","LITERAL","value",true));
        result.put("idempotent",Map.of("source","LITERAL","value",recovery));
        result.put("eventId",Map.of("source",recovery?"REFERENCE_SCENARIO":"DATABASE_EVENT","path","eventId"));
        result.put("toState",Map.of("source",recovery?"REFERENCE_SCENARIO":"DECLARED_STATE","path","toState"));
        if(recovery)result.put("recovered",Map.of("source","LITERAL","value",true));
        for(Map<String,Object> projection:(List<Map<String,Object>>)operation.get("responseProjection")){
            String field=String.valueOf(projection.get("fieldCode"));
            String source=String.valueOf(projection.get("source"));
            String path=String.valueOf(projection.get("sourcePath"));
            if(recovery)result.put(field,Map.of("source","REFERENCE_SCENARIO","path",field));
            else if("REQUEST".equals(source))result.put(field,Map.of("source","REQUEST","path",path));
            else if("eventId".equals(path))result.put(field,Map.of("source","DATABASE_EVENT","path","eventId"));
            else if("toState".equals(path))result.put(field,Map.of("source","DECLARED_STATE","path","toState"));
            else result.put(field,Map.of("source","LITERAL","value",!"idempotent".equals(path)));
        }
        return result;
    }

    @SuppressWarnings("unchecked")
    private static Map<String,Object> readMap(String value){
        try{return new ObjectMapper().readValue(value,Map.class);}
        catch(Exception error){throw new IllegalStateException(error);}
    }

    private static String writeLiveSmokeArtifact(Path root,String reference,byte[] bytes){
        try{
            Path target=root.resolve(reference);Files.createDirectories(target.getParent());
            if(Files.exists(target,LinkOption.NOFOLLOW_LINKS)){
                if(!Files.isRegularFile(target,LinkOption.NOFOLLOW_LINKS)
                        ||!MessageDigest.isEqual(Files.readAllBytes(target),bytes))
                    throw new IllegalStateException("TEST_LIVE_SMOKE_ARTIFACT_REPLAY_NOT_EXACT");
            }else{
                Files.write(target,bytes);
                if(Files.getFileAttributeView(target,PosixFileAttributeView.class,
                        LinkOption.NOFOLLOW_LINKS)!=null)
                    Files.setPosixFilePermissions(target,Set.of(PosixFilePermission.OWNER_READ,
                        PosixFilePermission.GROUP_READ));
            }
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));
        }catch(Exception error){throw new IllegalStateException("TEST_LIVE_SMOKE_ARTIFACT_WRITE_FAILED",error);}
    }
    private static String liveSmokeBytesHash(byte[] bytes){
        try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(bytes));}
        catch(Exception error){throw new IllegalStateException("TEST_LIVE_SMOKE_ARTIFACT_HASH_FAILED",error);}
    }

    private void assertFinalizerRejectsReplacedBrowserArtifact(long jobId,
            CompositeDesignOperationalWorker worker){
        String reference=jdbc.queryForObject("""
            select lane_evidence->>'screenshotArtifactRef'
              from integrated_design_live_smoke_evidence
             where job_id=? and lane='BROWSER'
             order by live_evidence_id limit 1
            """,String.class,jobId);
        Path target=lastLiveSmokeRoot.resolve(reference);String receiptStatus=jdbc.queryForObject(
            "select completion_status from integrated_design_autocompletion_receipt where job_id=?",
            String.class,jobId);
        String receiptXmin=jdbc.queryForObject(
            "select xmin::text from integrated_design_autocompletion_receipt where job_id=?",
            String.class,jobId);
        try{
            byte[] original=Files.readAllBytes(target);
            if(Files.getFileAttributeView(target,PosixFileAttributeView.class,LinkOption.NOFOLLOW_LINKS)!=null)
                Files.setPosixFilePermissions(target,Set.of(PosixFilePermission.OWNER_READ,
                    PosixFilePermission.OWNER_WRITE));
            Files.write(target,liveSmokePng("22222222-2222-4222-8222-222222222222"));
            if(Files.getFileAttributeView(target,PosixFileAttributeView.class,LinkOption.NOFOLLOW_LINKS)!=null)
                Files.setPosixFilePermissions(target,Set.of(PosixFilePermission.OWNER_READ,
                    PosixFilePermission.GROUP_READ));
            assertEquals(CompositePhysicalEvidenceService.Verdict.LIVE_SMOKE_TEST_PENDING,
                physicalEvidence().assess(jobId,"PROC"));
            assertEquals(receiptStatus,jdbc.queryForObject(
                "select completion_status from integrated_design_autocompletion_receipt where job_id=?",
                String.class,jobId));
            worker.runScheduledBatch();
            assertEquals(receiptXmin,jdbc.queryForObject(
                "select xmin::text from integrated_design_autocompletion_receipt where job_id=?",
                String.class,jobId),"replaced browser artifact must produce write0");
            if(Files.getFileAttributeView(target,PosixFileAttributeView.class,LinkOption.NOFOLLOW_LINKS)!=null)
                Files.setPosixFilePermissions(target,Set.of(PosixFilePermission.OWNER_READ,
                    PosixFilePermission.OWNER_WRITE));
            Files.write(target,original);
            if(Files.getFileAttributeView(target,PosixFileAttributeView.class,LinkOption.NOFOLLOW_LINKS)!=null)
                Files.setPosixFilePermissions(target,Set.of(PosixFilePermission.OWNER_READ,
                    PosixFilePermission.GROUP_READ));
        }catch(Exception error){throw new IllegalStateException("TEST_FINALIZER_ARTIFACT_MUTANT_FAILED",error);}
    }

    private static byte[] liveSmokePng(String runId){
        try{
            BufferedImage image=new BufferedImage(256,128,BufferedImage.TYPE_INT_ARGB);
            for(int y=0;y<image.getHeight();y++)for(int x=0;x<image.getWidth();x++)
                image.setRGB(x,y,x<128?0xff64748b:0xffe2e8f0);
            int[] bits=CompositeLiveSmokeEvidenceService.watermarkBits(runId);
            for(int index=0;index<bits.length;index++)for(int y=0;y<4;y++)for(int x=0;x<4;x++)
                image.setRGB((index%32)*4+x,(index/32)*4+y,
                    bits[index]==1?0xff246beb:0xff052b57);
            ByteArrayOutputStream bytes=new ByteArrayOutputStream();
            if(!ImageIO.write(image,"png",bytes))throw new IllegalStateException("PNG_WRITER_MISSING");
            return bytes.toByteArray();
        }catch(Exception error){throw new IllegalStateException("TEST_LIVE_SMOKE_PNG_FAILED",error);}
    }

    private static byte[] liveSmokeDom(String command,String status,int http,
            Map<String,Object> output,String idempotencyKey,
            CompositeLiveSmokeEvidenceService.BrowserArtifactContext context){
        String outputJson=json(output).replace("&","&amp;").replace("\"","&quot;")
            .replace("<","&lt;").replace(">","&gt;");
        boolean denied="FORBIDDEN".equals(status);
        StringBuilder watermarkCells=new StringBuilder();
        for(int bit:CompositeLiveSmokeEvidenceService.watermarkBits(context.runId()))
            watermarkCells.append("<span data-watermark-bit=\"").append(bit).append("\"></span>");
        return ("<html><body><main data-process-code=\""+context.processCode()+
            "\" data-step-code=\""+context.stepCode()+"\" data-route-path=\""+context.routePath()+
            "\" data-audience=\""+context.audience()+"\" data-tenant-id=\""+context.tenantId()+
            "\" data-project-id=\""+context.projectId()+"\" data-execution-id=\""+context.executionId()+
            "\" data-current-state=\""+context.currentState()+"\" data-live-smoke-run-id=\""+context.runId()+
            "\" data-last-command-code=\""+command+
            "\" data-last-http-status=\""+http+"\" data-last-status-case=\""+status+
            "\" data-last-output-json=\""+outputJson+"\" data-last-idempotency-key=\""+
            idempotencyKey+"\" data-runtime-observed=\""+(!denied)+
            "\" data-access-denied=\""+denied+"\"></main><button data-command-code=\""+
            command+"\">run</button><section data-live-smoke-result=\"true\">result</section>"+
            "<div data-live-smoke-watermark=\""+context.runId()+"\">"+watermarkCells+
            "</div></body></html>")
            .getBytes(StandardCharsets.UTF_8);
    }

    private record TestLiveSmokeDispatch(long id,String leaseToken){}

    private TestLiveSmokeDispatch ensureRunningLiveSmokeDispatch(long jobId,String canonicalArtifact){
        String revisionHash=jdbc.queryForObject(
            "select framework_composite_authority_revision_set_hash(?)",String.class,jobId);
        String runtimeIdentity=currentRuntimeIdentityHash();
        int canaryAttempt=jdbc.queryForObject("""
            select coalesce(nullif(receipt_json#>>'{canary,attemptNumber}','')::integer,0)
              from integrated_design_autocompletion_receipt
             where process_code='PROC' and job_id=?
            """,Integer.class,jobId);
        String processSource=jdbc.queryForObject(
            "select framework_try_jsonb(specification_json)->>'sourceHash' from framework_development_job where job_id=?",
            String.class,jobId);
        int expected=jdbc.queryForObject("""
            select sum(jsonb_array_length(composite_json#>'{executableDesign,TEST,scenarios}')*3)::integer
              from integrated_design_authority where job_id=?
            """,Integer.class,jobId);
        jdbc.update("""
            update integrated_design_live_smoke_dispatch dispatch
               set status='SUPERSEDED',lease_token=null,lease_until=null,
                   completed_at=coalesce(completed_at,clock_timestamp()),
                   last_error_code='AUTHORITY_REVISION_SUPERSEDED',last_error_hash=repeat('e',64)
             where dispatch.job_id=? and dispatch.authority_revision_set_hash<>?
               and dispatch.status<>'SUPERSEDED'
            """,jobId,revisionHash);
        jdbc.update("""
            insert into integrated_design_live_smoke_dispatch(job_id,process_code,project_id,
              runtime_commit,runtime_identity_hash,canary_attempt,
              authority_revision_set_hash,artifact_manifest_hash,process_source_hash,
              expected_evidence_count,status)
            values(?,'PROC','*',?, ?,?, ?,?,?,?,'QUEUED')
            on conflict(job_id,authority_revision_set_hash,runtime_identity_hash,canary_attempt)
              do nothing
            """,jobId,jdbc.queryForObject("""
                select source_commit from framework_runtime_release_state
                 where release_key='CARBONET_RUNTIME'
                """,String.class),runtimeIdentity,canaryAttempt,revisionHash,canonicalArtifact,
            processSource,expected);
        long dispatchId=jdbc.queryForObject("""
            select dispatch_id from integrated_design_live_smoke_dispatch
             where job_id=? and authority_revision_set_hash=? and runtime_identity_hash=?
               and canary_attempt=?
            """,Long.class,jobId,revisionHash,runtimeIdentity,canaryAttempt);
        jdbc.update("""
            update integrated_design_live_smoke_dispatch
               set status='RUNNING',attempt_count=attempt_count+1,lease_token=gen_random_uuid(),
                   lease_until=clock_timestamp()+interval '5 minutes',
                   started_at=coalesce(started_at,clock_timestamp())
             where dispatch_id=? and status in('QUEUED','RETRY_WAIT')
            """,dispatchId);
        Map<String,Object> claimed=jdbc.queryForMap(
            "select status,lease_token::text lease_token from integrated_design_live_smoke_dispatch where dispatch_id=?",
            dispatchId);
        if(!"RUNNING".equals(claimed.get("status"))
                ||!String.valueOf(claimed.get("lease_token")).matches(
                    "[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}"))
            throw new IllegalStateException("TEST_LIVE_SMOKE_DISPATCH_NOT_RUNNING");
        jdbc.update("""
            update integrated_design_autocompletion_receipt
               set receipt_json=receipt_json||jsonb_build_object('liveSmokeDispatchId',?::bigint)
             where process_code='PROC' and job_id=?
            """,dispatchId,jobId);
        return new TestLiveSmokeDispatch(dispatchId,String.valueOf(claimed.get("lease_token")));
    }

    @SuppressWarnings("unchecked")
    private void installExactCanonicalPhysicalEvidence(long jobId){
        installExactCanonicalPhysicalEvidence(jobId,true);
    }

    private void installExactCanonicalPhysicalEvidenceAtCurrentRuntime(long jobId){
        installExactCanonicalPhysicalEvidence(jobId,false);
    }

    @SuppressWarnings("unchecked")
    private void installExactCanonicalPhysicalEvidence(long jobId,boolean replaceRuntime){
        Map<String,Object> job=jdbc.queryForMap("""
            select process_code as "processCode",step_code as "stepCode",target_path as "targetPath",
                   specification_json as "specificationJson"
              from framework_development_job where job_id=?
            """,jobId);
        Map<String,Object> specification;
        try{specification=new ObjectMapper().readValue(
            String.valueOf(job.get("specificationJson")),Map.class);}
        catch(Exception error){throw new IllegalStateException(error);}
        String releaseHash="c".repeat(64),commit=replaceRuntime?"d".repeat(40):
            jdbc.queryForObject("""
                select source_commit from framework_runtime_release_state
                 where release_key='CARBONET_RUNTIME'
                """,String.class),rollback="e".repeat(40);
        Map<String,Object> evidence=new LinkedHashMap<>();
        evidence.put("schema","carbonet.canonical-generation-evidence/v1");
        evidence.put("activationPolicy","SOURCE_IMMEDIATE_V1");
        evidence.put("processCode",job.get("processCode"));
        evidence.put("stepCode",job.get("stepCode"));
        evidence.put("sourceHash",specification.get("sourceHash"));
        evidence.put("packageHash","b".repeat(64));
        evidence.put("designCatalogHash",specification.get("designCatalogHash"));
        evidence.put("endpointCatalogHash",specification.get("endpointCatalogHash"));
        evidence.put("releaseHash",releaseHash);
        evidence.put("compositeAuthoritySetHash",specification.get("compositeAuthoritySetHash"));
        evidence.put("compositeArtifactManifestHash","a".repeat(64));
        String evidenceRef="git:"+commit+";release:"+releaseHash+";log:/tmp/canonical.log";
        if(replaceRuntime)jdbc.update("""
                update framework_runtime_release_state
                   set source_commit=?,image_ref='carbonet-runtime:'||?,
                       deployment_generation=deployment_generation+1,
                       observed_generation=observed_generation+1,health_status='UP',
                       recorded_at=clock_timestamp()
                 where release_key='CARBONET_RUNTIME'
                """,commit,commit.substring(0,12));
        jdbc.update("""
            update framework_development_job
               set job_status='VERIFIED',quality_status='VERIFIED',
                   result_json=?,evidence_ref=?,rollback_ref=?,
                    completed_at=clock_timestamp()-interval '10 seconds',
                   lease_token=null,lease_until=null
             where job_id=?
            """,json(Map.of("commit",commit,"canonicalGeneration",evidence)),
            evidenceRef,rollback,jobId);
        jdbc.update("""
            update framework_step_execution_spec set generation_status='GENERATED'
             where process_code=? and step_code=? and source_hash=?
            """,job.get("processCode"),job.get("stepCode"),specification.get("sourceHash"));
        jdbc.update("""
            update framework_process_artifact
               set step_code=?,target_path=?,delivery_status='VERIFIED',evidence_ref=?
             where process_code=? and contract_ref='AUTO:FULL_STACK_GENERATION'
            """,job.get("stepCode"),job.get("targetPath"),evidenceRef,job.get("processCode"));
        jdbc.update("delete from framework_development_job_event where job_id=? "+
            "and event_type='CANONICAL_RELEASE_FINALIZED'",jobId);
        jdbc.update("""
            insert into framework_development_job_event(
              job_id,event_type,from_status,to_status,worker_id,detail_json)
            values(?,'CANONICAL_RELEASE_FINALIZED','RUNNING','VERIFIED','test-worker',?)
            """,jobId,json(evidence));
    }

    @SuppressWarnings("unchecked")
    private int installExactLiveSmokeEvidence(long jobId,boolean omitOne){
        return installExactLiveSmokeEvidence(jobId,omitOne,false,false);
    }

    private int installExactLiveSmokeEvidence(long jobId,boolean omitOne,
            boolean forgeOneLaneOutput,boolean exerciseWriterMutants){
        jdbc.update("""
            insert into comtnemplyrinfo(emplyr_id,esntl_id,emplyr_sttus_code)
            values('denied-live-user','DENIED_LIVE_ESNTL','P')
            on conflict(emplyr_id) do update set emplyr_sttus_code='P'
            """);
        jdbc.update("""
            insert into comtnemplyrscrtyestbs(scrty_dtrmn_trget_id,author_code)
            values('DENIED_LIVE_ESNTL','ROLE_LIVE_SMOKE_DENIED')
            on conflict(scrty_dtrmn_trget_id) do update set author_code=excluded.author_code
            """);
        Path liveSmokeRoot=Path.of("build","test-live-smoke-evidence",schema,String.valueOf(jobId))
            .toAbsolutePath().normalize();
        lastLiveSmokeRoot=liveSmokeRoot;
        System.setProperty("resonance.composite-live-smoke.evidence-root",liveSmokeRoot.toString());
        try{Files.createDirectories(liveSmokeRoot);}catch(Exception error){throw new IllegalStateException(error);}
        CompositeLiveSmokeEvidenceService writer=new CompositeLiveSmokeEvidenceService(
            jdbc,new ObjectMapper(),liveSmokeRoot);
        String canonicalArtifact=jdbc.queryForObject("""
            select framework_try_jsonb(result_json)#>>
                     '{canonicalGeneration,compositeArtifactManifestHash}'
              from framework_development_job where job_id=?
            """,String.class,jobId);
        TestLiveSmokeDispatch dispatch=ensureRunningLiveSmokeDispatch(jobId,canonicalArtifact);
        long dispatchId=dispatch.id();
        awaitDispatchEvidenceClockWindow(dispatchId);
        int writes=0;boolean omitted=false,forgedOutput=false,mutantsExercised=false;
        boolean browserMutantsExercised=false;
        for(Map<String,Object> authority:jdbc.queryForList("""
            select authority_id as "authorityId",authority_revision as "authorityRevision",
                   process_code as "processCode",step_code as "stepCode",route_path as "routePath",
                   audience as "audience",
                   composite_json::text as "composite"
              from integrated_design_authority where job_id=? order by authority_id
            """,jobId)){
            Map<String,Object> composite;
            try{composite=new ObjectMapper().readValue(String.valueOf(authority.get("composite")),Map.class);}
            catch(Exception error){throw new IllegalStateException(error);}
            Map<String,Object> design=(Map<String,Object>)composite.get("executableDesign");
            List<Map<String,Object>> scenarios=(List<Map<String,Object>>)((Map<String,Object>)
                design.get("TEST")).get("scenarios");
            List<Map<String,Object>> transitions=(List<Map<String,Object>>)((Map<String,Object>)
                design.get("STATE")).get("states");
            List<Map<String,Object>> operations=(List<Map<String,Object>>)((Map<String,Object>)
                design.get("API")).get("operations");
            List<Map<String,Object>> entities=(List<Map<String,Object>>)((Map<String,Object>)
                design.get("DATABASE")).get("entities");
            Map<String,UUID> successExecutions=new LinkedHashMap<>();
            Map<String,String> successKeys=new LinkedHashMap<>();
            Map<String,Long> successEvents=new LinkedHashMap<>();
            Map<String,Map<String,Object>> successOutputs=new LinkedHashMap<>();
            for(Map<String,Object> operation:operations){
                String command=String.valueOf(operation.get("commandCode"));
                Map<String,Object> transition=transitions.stream().filter(row->
                    command.equals(row.get("commandCode"))).findFirst().orElseThrow();
                Map<String,Object> scenario=scenarios.stream().filter(row->command.equals(
                    row.get("commandCode"))&&"SUCCESS".equals(row.get("expectedStatus")))
                    .findFirst().orElseThrow();
                String identity=jobId+"|"+authority.get("authorityId")+"|"+command;
                UUID executionId=UUID.nameUUIDFromBytes((identity+"|execution")
                    .getBytes(StandardCharsets.UTF_8));
                String idempotencyKey="live-"+CompositeExecutableDesignAuthorityCompiler.hash(
                    identity+"|success");
                installLiveSmokeExecution(executionId,String.valueOf(authority.get("authorityId")),
                    command,transition,idempotencyKey,String.valueOf(
                        ((List<Map<String,Object>>)((Map<String,Object>)design.get("PROCESS"))
                            .get("commands")).stream().filter(row->command.equals(
                                row.get("commandCode"))).findFirst().orElseThrow().get("actorCode")));
                long eventId=jdbc.queryForObject("""
                    select event_id from framework_process_execution_event
                     where execution_id=? and idempotency_key=?
                    """,Long.class,executionId,idempotencyKey);
                Map<String,Object> output=materializeLiveSmokeOutput(scenario,
                    (Map<String,Object>)scenario.get("inputValues"),transition,
                    Map.of("eventId",eventId,"toState",transition.get("toState")),Map.of());
                successExecutions.put(command,executionId);successKeys.put(command,idempotencyKey);
                successEvents.put(command,eventId);successOutputs.put(command,output);
            }
            for(Map<String,Object> scenario:scenarios){
                String command=String.valueOf(scenario.get("commandCode"));
                String status=String.valueOf(scenario.get("expectedStatus"));
                Map<String,Object> transition=transitions.stream().filter(row->
                    command.equals(row.get("commandCode"))).findFirst().orElseThrow();
                Map<String,Object> operation=operations.stream().filter(row->
                    command.equals(row.get("commandCode"))).findFirst().orElseThrow();
                UUID executionId=successExecutions.get(command);
                String idempotencyKey=successKeys.get(command);
                if(!Set.of("SUCCESS","CONFLICT","RECOVERY").contains(status)){
                    String identity=jobId+"|"+authority.get("authorityId")+"|"+command+"|"+status;
                    executionId=UUID.nameUUIDFromBytes((identity+"|execution")
                        .getBytes(StandardCharsets.UTF_8));
                    idempotencyKey="live-"+CompositeExecutableDesignAuthorityCompiler.hash(identity);
                    installLiveSmokeExecution(executionId,String.valueOf(authority.get("authorityId")),
                        command,transition,null,String.valueOf(
                            ((List<Map<String,Object>>)((Map<String,Object>)design.get("PROCESS"))
                                .get("commands")).stream().filter(row->command.equals(
                                    row.get("commandCode"))).findFirst().orElseThrow().get("actorCode")));
                }else if("CONFLICT".equals(status)){
                    idempotencyKey="live-"+CompositeExecutableDesignAuthorityCompiler.hash(
                        jobId+"|"+authority.get("authorityId")+"|"+command+"|conflict");
                }
                Map<String,Object> output=materializeLiveSmokeOutput(scenario,
                    (Map<String,Object>)scenario.get("inputValues"),transition,
                    "SUCCESS".equals(status)?Map.of("eventId",successEvents.get(command),
                        "toState",transition.get("toState")):Map.of(),
                    successOutputs.get(command));
                for(String lane:List.of("API","DATABASE","BROWSER")){
                    if(omitOne&&!omitted&&"RECOVERY".equals(status)&&"BROWSER".equals(lane)){
                        omitted=true;continue;
                    }
                    String target=switch(lane){case "API"->operation.get("method")+" "+operation.get("path");
                        case "DATABASE"->"entity:framework_process_execution";
                        default->String.valueOf(authority.get("routePath"));};
                    String identity=jobId+"|"+authority.get("authorityId")+"|"+command+"|"+
                        scenario.get("scenarioCode")+"|"+lane;
                    String proofHash=CompositeExecutableDesignAuthorityCompiler.hash(identity);
                    String runId=CompositeLiveSmokeEvidenceService.deterministicRunId(dispatchId,
                        ((Number)authority.get("authorityId")).longValue(),
                        ((Number)authority.get("authorityRevision")).longValue(),command,
                        String.valueOf(scenario.get("scenarioCode")),status);
                    String domHash="",screenshotHash="",domRef="",screenshotRef="";
                    String observedState=String.valueOf(Set.of("SUCCESS","CONFLICT","RECOVERY").contains(status)
                        ?transition.get("toState"):transition.get("fromState"));
                    var browserContext=new CompositeLiveSmokeEvidenceService.BrowserArtifactContext(runId,
                        String.valueOf(authority.get("processCode")),String.valueOf(authority.get("stepCode")),
                        String.valueOf(authority.get("routePath")),String.valueOf(authority.get("audience")),
                        "TENANT","PROJECT",executionId.toString(),observedState);
                    if("BROWSER".equals(lane)){
                        byte[] dom=liveSmokeDom(command,status,
                            ((Number)scenario.get("expectedHttpStatus")).intValue(),output,idempotencyKey,
                            browserContext);
                        byte[] screenshot=liveSmokePng(runId);
                        domHash=liveSmokeBytesHash(dom);screenshotHash=liveSmokeBytesHash(screenshot);
                        domRef=dispatchId+"/"+runId+"/"+domHash+".dom.html";
                        screenshotRef=dispatchId+"/"+runId+"/"+screenshotHash+".screenshot.png";
                        writeLiveSmokeArtifact(liveSmokeRoot,domRef,dom);
                        writeLiveSmokeArtifact(liveSmokeRoot,screenshotRef,screenshot);
                    }
                    Map<String,Object> details=switch(lane){
                        case "API"->Map.of("transportHash",proofHash,"httpStatus",
                            ((Number)scenario.get("expectedHttpStatus")).intValue());
                        case "DATABASE"->Map.of("rereadHash",proofHash,"transactionHash",
                            CompositeExecutableDesignAuthorityCompiler.hash(identity+"|tx"));
                        default->Map.of("domHash",domHash,"screenshotHash",screenshotHash,
                            "domArtifactRef",domRef,"screenshotArtifactRef",screenshotRef,"rendered",true,
                            "runtimeObserved",!"FORBIDDEN".equals(status),
                            "accessDenied","FORBIDDEN".equals(status));
                    };
                    Map<String,Object> laneOutput=output;
                    if(forgeOneLaneOutput&&!forgedOutput&&"SUCCESS".equals(status)
                            &&"API".equals(lane)){
                        laneOutput=new LinkedHashMap<>(output);
                        String firstField=laneOutput.keySet().stream().findFirst().orElseThrow();
                        laneOutput.put(firstField,999999);forgedOutput=true;
                    }
                    Map<String,Object> body=new LinkedHashMap<>();
                    body.put("dispatchId",dispatchId);body.put("leaseToken",dispatch.leaseToken());
                    body.put("jobId",jobId);
                    body.put("authorityId",authority.get("authorityId"));
                    body.put("lane",lane);body.put("statusCase",status);
                    body.put("scenarioCode",scenario.get("scenarioCode"));body.put("tenantId","TENANT");
                    body.put("projectId","PROJECT");body.put("input",scenario.get("inputValues"));
                    body.put("output",laneOutput);body.put("observedState",observedState);
                    body.put("targetRef",target);body.put("laneDetails",details);
                    body.put("runId",runId);
                    body.put("executionId",executionId.toString());body.put("idempotencyKey",idempotencyKey);
                    body.put("observedHttpStatus",scenario.get("expectedHttpStatus"));
                    body.put("artifactHash",canonicalArtifact);
                    String observedAt=jdbc.queryForObject("""
                        select (started_at+interval '1 millisecond')::timestamptz::text
                          from integrated_design_live_smoke_dispatch where dispatch_id=?
                        """,String.class,dispatchId).replace(' ','T');
                    body.put("observedAt",observedAt);
                    String account="FORBIDDEN".equals(status)?"denied-live-user":"system-admin";
                    if(!browserMutantsExercised&&"BROWSER".equals(lane)){
                        int before=count("integrated_design_live_smoke_evidence");
                        Map<String,Object> wrongDispatch=new LinkedHashMap<>(body);
                        wrongDispatch.put("dispatchId",dispatchId+999_999);
                        assertThrows(RuntimeException.class,()->writer.record(wrongDispatch,account));
                        Map<String,Object> wrongRun=new LinkedHashMap<>(body);
                        wrongRun.put("runId","22222222-2222-4222-8222-222222222222");
                        assertThrows(IllegalArgumentException.class,()->writer.record(wrongRun,account));
                        Map<String,Object> wrongLease=new LinkedHashMap<>(body);
                        wrongLease.put("leaseToken","22222222-2222-4222-8222-222222222222");
                        assertThrows(RuntimeException.class,()->writer.record(wrongLease,account));

                        byte[] fakeDom="<html><body>synthetic</body></html>"
                            .getBytes(StandardCharsets.UTF_8);
                        String fakeDomHash=liveSmokeBytesHash(fakeDom);
                        String fakeDomRef=dispatchId+"/"+runId+"/"+fakeDomHash+".dom.html";
                        writeLiveSmokeArtifact(liveSmokeRoot,fakeDomRef,fakeDom);
                        Map<String,Object> fakeDomDetails=new LinkedHashMap<>(details);
                        fakeDomDetails.put("domHash",fakeDomHash);
                        fakeDomDetails.put("domArtifactRef",fakeDomRef);
                        Map<String,Object> fakeDomBody=new LinkedHashMap<>(body);
                        fakeDomBody.put("laneDetails",fakeDomDetails);
                        assertThrows(IllegalArgumentException.class,()->writer.record(fakeDomBody,account));

                        var wrongContext=new CompositeLiveSmokeEvidenceService.BrowserArtifactContext(runId,
                            browserContext.processCode(),browserContext.stepCode(),"/forged",
                            browserContext.audience(),browserContext.tenantId(),browserContext.projectId(),
                            browserContext.executionId(),browserContext.currentState());
                        byte[] contextDom=liveSmokeDom(command,status,
                            ((Number)scenario.get("expectedHttpStatus")).intValue(),output,idempotencyKey,
                            wrongContext);
                        String contextDomHash=liveSmokeBytesHash(contextDom);
                        String contextDomRef=dispatchId+"/"+runId+"/"+contextDomHash+".dom.html";
                        writeLiveSmokeArtifact(liveSmokeRoot,contextDomRef,contextDom);
                        Map<String,Object> contextDetails=new LinkedHashMap<>(details);
                        contextDetails.put("domHash",contextDomHash);contextDetails.put("domArtifactRef",contextDomRef);
                        Map<String,Object> contextBody=new LinkedHashMap<>(body);contextBody.put("laneDetails",contextDetails);
                        assertThrows(IllegalArgumentException.class,()->writer.record(contextBody,account));

                        byte[] fakePng="PNG_BYTES".getBytes(StandardCharsets.UTF_8);
                        String fakePngHash=liveSmokeBytesHash(fakePng);
                        String fakePngRef=dispatchId+"/"+runId+"/"+fakePngHash+".screenshot.png";
                        writeLiveSmokeArtifact(liveSmokeRoot,fakePngRef,fakePng);
                        Map<String,Object> fakePngDetails=new LinkedHashMap<>(details);
                        fakePngDetails.put("screenshotHash",fakePngHash);
                        fakePngDetails.put("screenshotArtifactRef",fakePngRef);
                        Map<String,Object> fakePngBody=new LinkedHashMap<>(body);
                        fakePngBody.put("laneDetails",fakePngDetails);
                        assertThrows(IllegalArgumentException.class,()->writer.record(fakePngBody,account));

                        byte[] wrongWatermark=liveSmokePng("22222222-2222-4222-8222-222222222222");
                        String wrongWatermarkHash=liveSmokeBytesHash(wrongWatermark);
                        String wrongWatermarkRef=dispatchId+"/"+runId+"/"+wrongWatermarkHash+".screenshot.png";
                        writeLiveSmokeArtifact(liveSmokeRoot,wrongWatermarkRef,wrongWatermark);
                        Map<String,Object> watermarkDetails=new LinkedHashMap<>(details);
                        watermarkDetails.put("screenshotHash",wrongWatermarkHash);
                        watermarkDetails.put("screenshotArtifactRef",wrongWatermarkRef);
                        Map<String,Object> watermarkBody=new LinkedHashMap<>(body);
                        watermarkBody.put("laneDetails",watermarkDetails);
                        assertThrows(IllegalArgumentException.class,()->writer.record(watermarkBody,account));
                        assertEquals(before,count("integrated_design_live_smoke_evidence"));
                        browserMutantsExercised=true;
                    }
                    if(exerciseWriterMutants&&!mutantsExercised){
                        int before=count("integrated_design_live_smoke_evidence");
                        Map<String,Object> fractional=new LinkedHashMap<>(body);
                        fractional.put("jobId",1.5d);
                        assertThrows(IllegalArgumentException.class,()->writer.record(fractional,account));
                        Map<String,Object> beforeDispatch=new LinkedHashMap<>(body);
                        beforeDispatch.put("observedAt",jdbc.queryForObject("""
                            select (started_at-interval '1 millisecond')::timestamptz::text
                              from integrated_design_live_smoke_dispatch where dispatch_id=?
                            """,String.class,dispatchId).replace(' ','T'));
                        IllegalArgumentException beforeDispatchRejected=assertThrows(
                            IllegalArgumentException.class,
                            ()->writer.record(beforeDispatch,account));
                        assertEquals("LIVE_SMOKE_OBSERVED_AFTER_DEPLOY_REQUIRED",
                            beforeDispatchRejected.getMessage());
                        assertEquals(before,count("integrated_design_live_smoke_evidence"));
                        Map<String,Object> future=new LinkedHashMap<>(body);
                        future.put("observedAt",jdbc.queryForObject("""
                            select (clock_timestamp()+interval '1 minute')::timestamptz::text
                            """,String.class).replace(' ','T'));
                        IllegalArgumentException futureRejected=assertThrows(
                            IllegalArgumentException.class,()->writer.record(future,account));
                        assertEquals("LIVE_SMOKE_OBSERVED_AFTER_DEPLOY_REQUIRED",
                            futureRejected.getMessage());
                        assertEquals(before,count("integrated_design_live_smoke_evidence"));
                        Map<String,Object> wrongArtifact=new LinkedHashMap<>(body);
                        wrongArtifact.put("artifactHash","f".repeat(64));
                        assertThrows(IllegalArgumentException.class,()->writer.record(wrongArtifact,account));
                        assertEquals(before,count("integrated_design_live_smoke_evidence"));
                        mutantsExercised=true;
                    }
                    try{
                        writes+=((Number)writer.record(body,account).get("writeCount")).intValue();
                    }catch(IllegalArgumentException error){
                        if(!"LIVE_SMOKE_OBSERVED_AFTER_DEPLOY_REQUIRED".equals(error.getMessage()))throw error;
                        throw new IllegalArgumentException(error.getMessage()+" "+jdbc.queryForMap("""
                            select ?::timestamptz as "observedAt",completed_at as "completedAt",
                                   clock_timestamp() as "databaseNow",
                                   ?::timestamptz>=completed_at as "afterCompletion",
                                   ?::timestamptz<=clock_timestamp() as "beforeNow"
                              from framework_development_job where job_id=?
                            """,observedAt,observedAt,observedAt,jobId),error);
                    }
                }
            }
        }
        assertEquals(0,jdbc.queryForObject("""
            select count(*) from integrated_design_live_smoke_evidence
             where job_id=? and (position(? in lane_evidence::text)>0
               or position(? in evidence_ref)>0)
            """,Integer.class,jobId,dispatch.leaseToken(),dispatch.leaseToken()));
        return writes;
    }

    private void awaitDispatchEvidenceClockWindow(long dispatchId){
        long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(5);
        boolean ready;
        do{
            ready=Boolean.TRUE.equals(jdbc.queryForObject("""
                select clock_timestamp()>=started_at+interval '2 seconds'
                  from integrated_design_live_smoke_dispatch where dispatch_id=?
                """,Boolean.class,dispatchId));
            if(!ready)try{Thread.sleep(20);}
            catch(InterruptedException error){
                Thread.currentThread().interrupt();throw new IllegalStateException(error);
            }
        }while(!ready&&System.nanoTime()<deadline);
        assertTrue(ready,"database clock must advance beyond authoritative dispatch start");
    }

    private void installLiveSmokeExecution(UUID executionId,String authorityId,String command,
            Map<String,Object> transition,String idempotencyKey,String actor){
        String state=idempotencyKey==null?String.valueOf(transition.get("fromState")):
            String.valueOf(transition.get("toState"));
        jdbc.update("""
            insert into framework_process_execution(
              execution_id,tenant_id,project_id,process_code,current_step_code,execution_status,
              current_state,initiated_by_actor,initiated_by,completed_at)
            values(?,'TENANT','PROJECT','PROC','STEP','COMPLETED',?,?,?,clock_timestamp())
            on conflict(execution_id) do update set current_state=excluded.current_state
            """,executionId,state,actor,"live-smoke-"+authorityId);
        if(idempotencyKey!=null)jdbc.update("""
            insert into framework_process_execution_event(
              execution_id,step_code,actor_code,command_code,from_state,to_state,
              idempotency_key,request_json,result_json,executed_by)
            values(?,'STEP',?,?,?,?,?,'{}','{}','system-admin')
            on conflict(execution_id,idempotency_key) do nothing
            """,executionId,actor,command,transition.get("fromState"),transition.get("toState"),
            idempotencyKey);
    }

    @SuppressWarnings("unchecked")
    private static Map<String,Object> materializeLiveSmokeOutput(Map<String,Object> scenario,
            Map<String,Object> input,Map<String,Object> transition,Map<String,Object> event,
            Map<String,Object> reference){
        Map<String,Object> descriptors=(Map<String,Object>)scenario.get("expectedOutputValues");
        Map<String,Object> result=new LinkedHashMap<>();
        for(Object rawField:(List<?>)scenario.get("expectedOutputFields")){
            String field=String.valueOf(rawField);
            Map<String,Object> descriptor=(Map<String,Object>)descriptors.get(field);
            String source=String.valueOf(descriptor.get("source"));Object value;
            if("LITERAL".equals(source))value=descriptor.get("value");
            else{
                String path=String.valueOf(descriptor.get("path"));
                Map<String,Object> origin=switch(source){
                    case "REQUEST"->input;case "DATABASE_EVENT"->event;
                    case "DECLARED_STATE"->transition;case "REFERENCE_SCENARIO"->reference;
                    default->throw new IllegalStateException("TEST_OUTPUT_SOURCE_UNSUPPORTED: "+source);
                };
                value=origin.get(path);
            }
            if(value==null)throw new IllegalStateException("TEST_OUTPUT_VALUE_UNRESOLVED: "+field);
            result.put(field,value);
        }
        return result;
    }

    @SuppressWarnings("unchecked")
    private int insertPartialLiveSmokeEvidence(long jobId){
        long dispatchId=jdbc.queryForObject("""
            select dispatch_id from integrated_design_live_smoke_dispatch
             where job_id=? and status in('QUEUED','RUNNING','RETRY_WAIT')
             order by dispatch_id desc limit 1
            """,Long.class,jobId);
        Map<String,Object> authority=jdbc.queryForMap("""
            select authority_id as "authorityId",authority_revision as "authorityRevision",
                   process_code as "processCode",step_code as "stepCode",route_path as "routePath",
                   audience,source_hash as "sourceHash",authority_hash as "authorityHash",
                   composite_json::text as composite
              from integrated_design_authority where job_id=? order by authority_id limit 1
            """,jobId);
        Map<String,Object> composite=readMap(String.valueOf(authority.get("composite")));
        Map<String,Object> design=(Map<String,Object>)composite.get("executableDesign");
        List<Map<String,Object>> scenarios=(List<Map<String,Object>>)((Map<String,Object>)
            design.get("TEST")).get("scenarios");
        Map<String,Object> scenario=scenarios.stream().filter(row->
            "SUCCESS".equals(row.get("expectedStatus"))).findFirst().orElseThrow();
        String command=String.valueOf(scenario.get("commandCode"));
        Map<String,Object> transition=((List<Map<String,Object>>)((Map<String,Object>)
            design.get("STATE")).get("states")).stream().filter(row->
                command.equals(row.get("commandCode"))).findFirst().orElseThrow();
        Map<String,Object> operation=((List<Map<String,Object>>)((Map<String,Object>)
            design.get("API")).get("operations")).stream().filter(row->
                command.equals(row.get("commandCode"))).findFirst().orElseThrow();
        Map<String,Object> commandRow=((List<Map<String,Object>>)((Map<String,Object>)
            design.get("PROCESS")).get("commands")).stream().filter(row->
                command.equals(row.get("commandCode"))).findFirst().orElseThrow();
        String account="system-admin",tenant="TENANT",project="PROJECT",actor=String.valueOf(commandRow.get("actorCode"));
        Map<String,Object> input=(Map<String,Object>)scenario.get("inputValues");
        Map<String,Object> output=Map.of("success",true);
        Map<String,Object> laneEvidence=Map.of("transportHash","2".repeat(64),"httpStatus",200,
            "executionId",UUID.randomUUID().toString(),"idempotencyKey",UUID.randomUUID().toString(),
            "observedHttpStatus",200);
        String accountHash=liveSmokeHash(Map.of("accountId",account,"tenantId",tenant,
            "projectId",project,"actorCode",actor));
        String commandHash=liveSmokeHash(Map.of("commandCode",command));
        String inputHash=liveSmokeHash(input),outputHash=liveSmokeHash(output);
        String stateHash=liveSmokeHash(Map.of("fromState",transition.get("fromState"),
            "toState",transition.get("toState"),"observedState",transition.get("toState")));
        String statusHash=liveSmokeHash(Map.of("expectedStatus","SUCCESS","observedStatus","SUCCESS"));
        String laneHash=liveSmokeHash(laneEvidence),evidenceRef="inline://dispatch-partial-resume";
        Map<String,Object> identity=new LinkedHashMap<>();
        identity.put("schema","carbonet.composite-live-smoke-evidence/v1");
        identity.put("dispatchId",dispatchId);identity.put("jobId",jobId);
        identity.put("authorityId",authority.get("authorityId"));identity.put("authorityRevision",authority.get("authorityRevision"));
        identity.put("processCode",authority.get("processCode"));identity.put("stepCode",authority.get("stepCode"));
        identity.put("routePath",authority.get("routePath"));identity.put("audience",authority.get("audience"));
        identity.put("lane","API");identity.put("statusCase","SUCCESS");
        identity.put("scenarioCode",scenario.get("scenarioCode"));identity.put("accountHash",accountHash);
        identity.put("commandHash",commandHash);identity.put("inputHash",inputHash);identity.put("outputHash",outputHash);
        identity.put("stateHash",stateHash);identity.put("statusHash",statusHash);
        identity.put("sourceHash",authority.get("sourceHash"));identity.put("authorityHash",authority.get("authorityHash"));
        identity.put("targetRef",operation.get("method")+" "+operation.get("path"));identity.put("laneEvidenceHash",laneHash);
        identity.put("evidenceRef",evidenceRef);
        String evidenceHash=liveSmokeHash(identity);
        return jdbc.update("""
            insert into integrated_design_live_smoke_evidence(dispatch_id,job_id,authority_id,authority_revision,
              process_code,step_code,route_path,audience,lane,status_case,scenario_code,account_id,
              tenant_id,project_id,actor_code,command_code,input_json,output_json,from_state,to_state,
              observed_state,expected_status,observed_status,source_hash,authority_hash,target_ref,
              lane_evidence,account_hash,command_hash,input_hash,output_hash,state_hash,status_hash,
              lane_evidence_hash,evidence_hash,evidence_ref,recorded_by,observed_at)
            values(?,?,?,?,?,?,?,?,'API','SUCCESS',?,?,?,?,?,?,?::jsonb,?::jsonb,?,?,?,
              'SUCCESS','SUCCESS',?,?,?,?::jsonb,?,?,?,?,?,?,?,?,?,'dispatch-test',clock_timestamp())
            """,dispatchId,jobId,authority.get("authorityId"),authority.get("authorityRevision"),authority.get("processCode"),
            authority.get("stepCode"),authority.get("routePath"),authority.get("audience"),scenario.get("scenarioCode"),
            account,tenant,project,actor,command,json(input),json(output),transition.get("fromState"),transition.get("toState"),
            transition.get("toState"),authority.get("sourceHash"),authority.get("authorityHash"),
            operation.get("method")+" "+operation.get("path"),json(laneEvidence),accountHash,commandHash,inputHash,
            outputHash,stateHash,statusHash,laneHash,evidenceHash,evidenceRef);
    }

    private String liveSmokeHash(Object value){
        return jdbc.queryForObject("select framework_composite_live_smoke_hash(?::jsonb)",
            String.class,json(value));
    }

    private CompositePhysicalEvidenceService physicalEvidence(){
        return lastLiveSmokeRoot==null?new CompositePhysicalEvidenceService(jdbc):
            new CompositePhysicalEvidenceService(jdbc,lastLiveSmokeRoot);
    }

    private void markDispatchEvidenceSubmitted(long jobId){
        long dispatchId=jdbc.queryForObject("""
            select (receipt_json->>'liveSmokeDispatchId')::bigint
              from integrated_design_autocompletion_receipt
             where process_code='PROC' and job_id=?
               and receipt_json->>'liveSmokeDispatchId'~'^[0-9]+$'
            """,Long.class,jobId);
        UUID leaseToken=jdbc.query("""
            select lease_token from integrated_design_live_smoke_dispatch
             where dispatch_id=? and job_id=? and authority_revision_set_hash=
                   framework_composite_authority_revision_set_hash(job_id)
               and status='RUNNING'
            """,result->result.next()?(UUID)result.getObject(1):null,dispatchId,jobId);
        if(leaseToken==null){
            leaseToken=UUID.randomUUID();
            assertEquals(1,jdbc.update("""
            update integrated_design_live_smoke_dispatch dispatch
               set status='RUNNING',attempt_count=attempt_count+1,
                   lease_token=?,lease_until=clock_timestamp()+interval '5 minutes',
                   started_at=coalesce(started_at,clock_timestamp())
             where dispatch.dispatch_id=? and dispatch.job_id=?
               and dispatch.authority_revision_set_hash=
                   framework_composite_authority_revision_set_hash(dispatch.job_id)
               and dispatch.status in('QUEUED','RETRY_WAIT')
            """,leaseToken,dispatchId,jobId));
        }
        assertEquals(1,jdbc.update("""
            with current_evidence as materialized (
              select count(*)::integer evidence_count,
                     framework_composite_live_smoke_hash(coalesce(jsonb_agg(
                       evidence.evidence_hash order by evidence.authority_id,
                       evidence.authority_revision,evidence.command_code collate "C",
                       evidence.scenario_code collate "C",evidence.status_case collate "C",
                       evidence.lane collate "C"),'[]'::jsonb)) evidence_set_hash
                from integrated_design_live_smoke_evidence evidence
                join integrated_design_authority authority
                  on authority.authority_id=evidence.authority_id
                 and authority.authority_revision=evidence.authority_revision
                 and authority.job_id=evidence.job_id
                 and authority.source_hash=evidence.source_hash
                 and authority.authority_hash=evidence.authority_hash
               where evidence.dispatch_id=? and evidence.job_id=?
            )
            update integrated_design_live_smoke_dispatch dispatch
               set status='EVIDENCE_SUBMITTED',lease_token=null,lease_until=null,
                   submitted_evidence_count=summary.evidence_count,
                   evidence_summary=jsonb_build_object(
                     'runnerSchema','carbonet.composite-live-smoke-runner/v1',
                     'evidenceSetHash',summary.evidence_set_hash,
                     'evidenceDirectoryHash',framework_composite_live_smoke_hash(
                       jsonb_build_object('evidenceSetHash',summary.evidence_set_hash,
                         'evidenceCount',summary.evidence_count)))
              from current_evidence summary
             where dispatch.dispatch_id=? and dispatch.job_id=? and dispatch.status='RUNNING'
               and dispatch.lease_token=?
               and dispatch.authority_revision_set_hash=
                   framework_composite_authority_revision_set_hash(dispatch.job_id)
               and summary.evidence_count=dispatch.expected_evidence_count
            """,dispatchId,jobId,dispatchId,jobId,leaseToken));
    }

    private long replaceDispatchWithAdversarialOldEvidence(long jobId){
        long priorDispatchId=jdbc.queryForObject("""
            select (receipt_json->>'liveSmokeDispatchId')::bigint
              from integrated_design_autocompletion_receipt
             where process_code='PROC' and job_id=?
            """,Long.class,jobId);
        assertEquals(1,jdbc.update("""
            update integrated_design_live_smoke_dispatch
               set status='SUPERSEDED',completed_at=clock_timestamp(),
                   last_error_code='TEMPORAL_FIXTURE_SUPERSEDED',
                   last_error_hash=framework_composite_live_smoke_hash(
                     jsonb_build_object('dispatchId',dispatch_id,'fixture','TEMPORAL'))
             where dispatch_id=? and status='EVIDENCE_SUBMITTED'
            """,priorDispatchId));
        long dispatchId=jdbc.queryForObject("""
            insert into integrated_design_live_smoke_dispatch(
              job_id,process_code,project_id,runtime_commit,runtime_identity_hash,
              canary_attempt,authority_revision_set_hash,artifact_manifest_hash,
              process_source_hash,expected_evidence_count,status)
            select job_id,process_code,project_id,runtime_commit,runtime_identity_hash,
                   3,authority_revision_set_hash,artifact_manifest_hash,
                   process_source_hash,expected_evidence_count,'QUEUED'
              from integrated_design_live_smoke_dispatch where dispatch_id=?
            returning dispatch_id
            """,Long.class,priorDispatchId);
        UUID leaseToken=UUID.randomUUID();
        assertEquals(1,jdbc.update("""
            update integrated_design_live_smoke_dispatch
               set status='RUNNING',attempt_count=attempt_count+1,lease_token=?,
                   lease_until=clock_timestamp()+interval '5 minutes'
             where dispatch_id=? and status='QUEUED'
            """,leaseToken,dispatchId));
        int copied=jdbc.update("""
            insert into integrated_design_live_smoke_evidence(
              dispatch_id,job_id,authority_id,authority_revision,process_code,step_code,
              route_path,audience,lane,status_case,scenario_code,account_id,tenant_id,
              project_id,actor_code,command_code,input_json,output_json,from_state,to_state,
              observed_state,expected_status,observed_status,source_hash,authority_hash,
              target_ref,lane_evidence,account_hash,command_hash,input_hash,output_hash,
              state_hash,status_hash,lane_evidence_hash,evidence_hash,evidence_ref,
              recorded_by,observed_at,recorded_at)
            select target.dispatch_id,evidence.job_id,evidence.authority_id,
                   evidence.authority_revision,evidence.process_code,evidence.step_code,
                   evidence.route_path,evidence.audience,evidence.lane,evidence.status_case,
                   evidence.scenario_code,evidence.account_id,evidence.tenant_id,
                   evidence.project_id,evidence.actor_code,evidence.command_code,
                   evidence.input_json,evidence.output_json,evidence.from_state,evidence.to_state,
                   evidence.observed_state,evidence.expected_status,evidence.observed_status,
                   evidence.source_hash,evidence.authority_hash,evidence.target_ref,
                   evidence.lane_evidence,evidence.account_hash,evidence.command_hash,
                   evidence.input_hash,evidence.output_hash,evidence.state_hash,
                   evidence.status_hash,evidence.lane_evidence_hash,
                   framework_composite_live_smoke_hash(jsonb_build_object(
                     'schema','carbonet.composite-live-smoke-evidence/v1',
                     'dispatchId',target.dispatch_id,'jobId',evidence.job_id,
                     'authorityId',evidence.authority_id,
                     'authorityRevision',evidence.authority_revision,
                     'processCode',evidence.process_code,'stepCode',evidence.step_code,
                     'routePath',evidence.route_path,'audience',evidence.audience,
                     'lane',evidence.lane,'statusCase',evidence.status_case,
                     'scenarioCode',evidence.scenario_code,
                     'accountHash',evidence.account_hash,'commandHash',evidence.command_hash,
                     'inputHash',evidence.input_hash,'outputHash',evidence.output_hash,
                     'stateHash',evidence.state_hash,'statusHash',evidence.status_hash,
                     'sourceHash',evidence.source_hash,'authorityHash',evidence.authority_hash,
                     'targetRef',evidence.target_ref,
                     'laneEvidenceHash',evidence.lane_evidence_hash,
                     'evidenceRef',evidence.evidence_ref)),evidence.evidence_ref,
                   'adversarial-temporal-fixture',dispatch.started_at-interval '1 millisecond',
                   clock_timestamp()
              from integrated_design_live_smoke_evidence evidence
              cross join (select ?::bigint dispatch_id) target
              join integrated_design_live_smoke_dispatch dispatch
                on dispatch.dispatch_id=target.dispatch_id
             where evidence.dispatch_id=?
            """,dispatchId,priorDispatchId);
        assertEquals(45,copied);
        assertEquals(1,jdbc.update("""
            update integrated_design_autocompletion_receipt
               set receipt_json=receipt_json||jsonb_build_object(
                 'liveSmokeDispatchId',?::bigint,'liveSmokeDispatchStatus','RUNNING')
             where process_code='PROC' and job_id=?
            """,dispatchId,jobId));
        return dispatchId;
    }

    @Test
    void workerLocksAndReusesExactCurrentProjectScope(){
        seedCompositeThreeScreens();String sha="f".repeat(64),nextSha="e".repeat(64);
        compileComposite(Map.of(
            "processCode","PROC","previewOnly",false,"scopeType","PROJECT",
            "projectId","PROJECT_A","designVersion",7,"contractSha256",sha));
        compileComposite(Map.of(
            "processCode","PROC","previewOnly",false,"scopeType","PROJECT",
            "projectId","PROJECT_A","designVersion",8,"contractSha256",nextSha));
        CompositeDesignOperationalWorker worker=new CompositeDesignOperationalWorker(
            jdbc,new ObjectMapper(),service,new DataSourceTransactionManager(dataSource),
            false,8,25,false);
        try{Map<String,Object> scope=transaction.execute(status->worker.scopeForProcess("PROC"));
            assertEquals(Map.of("scopeType","PROJECT","projectId","PROJECT_A",
                "designVersion",8,"contractSha256",nextSha),scope);
            jdbc.update("""
                insert into integrated_design_scope_binding(
                  authority_id,authority_revision,scope_type,project_id,design_version,
                  contract_sha256,process_code,step_code,route_path,audience,
                  document_set_hash,authority_hash,provenance_hash,bound_by)
                select authority_id,authority_revision,'PROJECT','PROJECT_A',9,repeat('d',64),
                       'FORGED_SCOPE',step_code,route_path,audience,document_set_hash,
                       authority_hash,repeat('c',64),'forged-test'
                  from integrated_design_authority where process_code='PROC'
                 order by authority_id limit 1
                """);
            assertThrows(IllegalStateException.class,()->worker.scopeForProcess("PROC"));
        }finally{worker.close();}
    }

    @Test
    void runtimeUsesExactProjectIdentityAndRejectsForgedCurrentBinding(){
        seedCompositeThreeScreens();String sha="f".repeat(64);
        compileComposite(Map.of(
            "processCode","PROC","previewOnly",false,"scopeType","PROJECT",
            "projectId","PROJECT_A","designVersion",7,"contractSha256",sha));
        CompositeRuntimePolicyService runtime=new CompositeRuntimePolicyService(jdbc);
        assertEquals("PRIMARY_ACTOR",runtime.resolveActor(
            "PROJECT_A","PROC","STEP","/work-a","USER"));
        assertEquals("OWNER_ACTOR",runtime.resolveActor(
            "PROJECT_A","PROC","STEP","/work-admin","ADMIN"));
        assertThrows(SecurityException.class,()->runtime.resolveActor(
            "PROJECT_B","PROC","STEP","/work-a","USER"));
        jdbc.update("""
            update integrated_design_scope_binding binding set provenance_hash=repeat('0',64)
              from integrated_design_authority authority
             where authority.authority_id=binding.authority_id
               and authority.authority_revision=binding.authority_revision
               and authority.process_code='PROC' and authority.route_path='/work-a'
            """);
        assertThrows(SecurityException.class,()->runtime.resolveActor(
            "PROJECT_A","PROC","STEP","/work-a","USER"));
    }

    @Test
    void workerZeroAuthorityRequiresExactMigrationGlobalScopeMarker(){
        jdbc.update("""
            insert into integrated_design_autocompletion_receipt(
              process_code,completion_status,dependency_fingerprint)
            values('UNBOUND_SCOPE','PENDING',
              framework_composite_dependency_fingerprint('UNBOUND_SCOPE'))
            """);
        CompositeDesignOperationalWorker worker=new CompositeDesignOperationalWorker(
            jdbc,new ObjectMapper(),service,new DataSourceTransactionManager(dataSource),
            false,8,25,false);
        try{
            assertThrows(IllegalStateException.class,()->worker.scopeForProcess("UNBOUND_SCOPE"));
            jdbc.update("""
                update integrated_design_autocompletion_receipt
                   set receipt_json=jsonb_build_object('requestedScope',jsonb_build_object(
                     'scopeType','GLOBAL','source','MIGRATION_GLOBAL_TARGET'))
                 where process_code='UNBOUND_SCOPE'
                """);
            assertEquals(Map.of("scopeType","GLOBAL"),worker.scopeForProcess("UNBOUND_SCOPE"));
            jdbc.update("""
                update integrated_design_autocompletion_receipt
                   set receipt_json=jsonb_set(receipt_json,'{requestedScope,source}',
                     to_jsonb('UNTRUSTED'::text)) where process_code='UNBOUND_SCOPE'
                """);
            assertThrows(IllegalStateException.class,()->worker.scopeForProcess("UNBOUND_SCOPE"));
        }finally{worker.close();}
    }

    @Test
    void appliedRequirementReleaseIsTerminalAcrossLaterProcessHeads(){
        Map<String,Object> queued=transaction.execute(status->
            service.createProcess(processBody("terminal release"),"authenticated-admin"));
        String expectedHash=String.valueOf(queued.get("processInputHash"));
        long expectedJobId=((Number)queued.get("jobId")).longValue();
        String appliedResult="{\"status\":\"APPLIED\",\"receipt\":\"immutable\","+
            "\"expectedProcessReceipts\":{\"PROC\":{\"processInputHash\":\""+
            expectedHash+"\",\"jobId\":"+expectedJobId+"}}}";
        jdbc.update("""
            insert into framework_actor_process_design_release(
              project_id,design_version,contract_sha256,contract_payload,
              release_status,applied_at,generation_result)
            values('PROJECT_TERMINAL',1,?,'{}','APPLIED',current_timestamp,cast(? as jsonb))
            ""","e".repeat(64),appliedResult);
        transaction.execute(status->
            service.createProcess(processBody("later head"),"authenticated-admin"));
        String beforeResult=jdbc.queryForObject("""
            select generation_result::text from framework_actor_process_design_release
             where project_id='PROJECT_TERMINAL' and design_version=1
            """,String.class);
        java.sql.Timestamp beforeApplied=jdbc.queryForObject("""
            select applied_at from framework_actor_process_design_release
             where project_id='PROJECT_TERMINAL' and design_version=1
            """,java.sql.Timestamp.class);
        ActorProcessControlPlaneBridgeController bridge=
            new ActorProcessControlPlaneBridgeController(jdbc,new ObjectMapper(),service,"token");
        try{
            invokeRequirementReleaseReconciler(
                bridge,"PROJECT_TERMINAL",1,"PROC");
        }finally{
            bridge.shutdownGenerationExecutor();
        }
        assertEquals("APPLIED",jdbc.queryForObject("""
            select release_status from framework_actor_process_design_release
             where project_id='PROJECT_TERMINAL' and design_version=1
            """,String.class));
        assertEquals(beforeResult,jdbc.queryForObject("""
            select generation_result::text from framework_actor_process_design_release
             where project_id='PROJECT_TERMINAL' and design_version=1
            """,String.class));
        assertEquals(beforeApplied,jdbc.queryForObject("""
            select applied_at from framework_actor_process_design_release
             where project_id='PROJECT_TERMINAL' and design_version=1
            """,java.sql.Timestamp.class));
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
    void completedSameHeadWithoutExactEvidenceRequeuesAndKeepsProcessHeadStable(){
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

        assertEquals("QUEUED",replay.get("status"));
        assertEquals(true,replay.get("generationQueued"));
        assertEquals(source,text("source_hash"));
        assertEquals(specVersion,jdbc.queryForObject(
            "select spec_version from framework_step_execution_spec",Integer.class));
        assertEquals("GENERATED",text("generation_status"));
        assertEquals(processVersion,jdbc.queryForObject(
            "select process_version from framework_process_definition where process_code='PROC'",
            String.class));
        assertEquals(target,jdbc.queryForObject(
            "select target_path from framework_development_job",String.class));
        assertEquals(Map.of("jobStatus","PLANNED","qualityStatus","PENDING"),
            jdbc.queryForMap("""
                select job_status as "jobStatus",quality_status as "qualityStatus"
                  from framework_development_job
                """));
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
    void stolenGenerationLeaseFencesBothWorkersBeforeAnyGenerationSideEffect(){
        String firstWorker=UUID.randomUUID().toString();
        String takeoverWorker=UUID.randomUUID().toString();
        jdbc.update("""
            insert into framework_actor_process_design_release(
              project_id,design_version,contract_sha256,contract_payload,
              release_status,received_at,generation_result)
            values('PROJECT_LEASE',1,repeat('f',64),'{}','RUNNING',
              current_timestamp,jsonb_build_object('claimToken',?,'retryAttempt',1))
            """,firstWorker);
        assertEquals(1,jdbc.update("""
            update framework_actor_process_design_release
               set generation_result=jsonb_set(generation_result,'{claimToken}',to_jsonb(?::text))
             where project_id='PROJECT_LEASE' and design_version=1
               and generation_result->>'claimToken'=?
            """,takeoverWorker,firstWorker));
        List<String> sideEffectTables=List.of(
            "framework_simulation_case","framework_professional_screen_contract",
            "framework_page_design","framework_screen_blueprint",
            "framework_screen_generation_batch","framework_development_job");
        Map<String,Integer> before=new LinkedHashMap<>();
        sideEffectTables.forEach(table->before.put(table,count(table)));

        Map<String,Object> staleRetry=transaction.execute(status->
            service.recoverRequirementProcessesForGenerationClaim(
                "PROJECT_LEASE",1,firstWorker,List.of("PROC"),
                "REQUIREMENT_SELF_HEALER"));
        Map<String,Object> staleCompile=transaction.execute(status->
            service.compileAndQueueScreensForGenerationClaim(
                "PROJECT_LEASE",1,firstWorker,
                Map.of("processCode","","maxScreens",1000),
                "BACKSTAGE_CONTROL_PLANE"));

        assertEquals("CLAIM_LOST",staleRetry.get("status"));
        assertEquals(0,staleRetry.get("sideEffectCount"));
        assertEquals("CLAIM_LOST",staleCompile.get("status"));
        assertEquals(0,staleCompile.get("sideEffectCount"));
        sideEffectTables.forEach(table->assertEquals(before.get(table),count(table),table));
        assertEquals(takeoverWorker,jdbc.queryForObject("""
            select generation_result->>'claimToken'
              from framework_actor_process_design_release
             where project_id='PROJECT_LEASE' and design_version=1
            """,String.class));
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

    @Test
    void physicalOnlyCanaryRearmOnNewRuntimePreservesJobAndWritesNoSource(){
        seedCompositeThreeScreens();
        PhysicalRearmCampaign campaign=installPhysicalRearmCampaign(
            "a".repeat(40),"c".repeat(40),"PHYSICAL_GENERATED_VERIFIED");
        CompositeAutocompletionReadinessService readiness=
            new CompositeAutocompletionReadinessService(jdbc,service,
                new DataSourceTransactionManager(dataSource),8,8,2,campaign.newCommit(),"","");
        String jobXmin=jdbc.queryForObject(
            "select xmin::text from framework_development_job where job_id=?",
            String.class,campaign.jobId());
        int jobCount=count("framework_development_job");
        int eventCount=count("framework_development_job_event");
        int sourceDocumentVersionCount=count("integrated_design_document_version");
        try{
            List<Map<String,Object>> rearmed=transaction.execute(status->{
                readiness.acquireGlobalDispatchLock(910_881_003L);
                return readiness.rearmPhysicalCanary(UUID.randomUUID().toString(),
                    campaign.newCommit(),campaign.sourceHash(),1);
            });
            assertEquals(1,rearmed.size());
            assertEquals("PROC",rearmed.get(0).get("processCode"));
            assertEquals(campaign.jobId(),((Number)rearmed.get(0).get("jobId")).longValue());
            assertEquals(true,rearmed.get(0).get("physicalRevalidation"));
            assertEquals(true,rearmed.get(0).get("sourceReused"));
            assertEquals("SOURCE_APPLIED_PHYSICAL_QUEUED",jdbc.queryForObject("""
                select completion_status from integrated_design_autocompletion_receipt
                 where process_code='PROC'
                """,String.class));
            assertEquals(campaign.jobId(),jdbc.queryForObject("""
                select job_id from integrated_design_autocompletion_receipt
                 where process_code='PROC'
                """,Long.class));
            assertEquals(7,jdbc.queryForObject("""
                select attempt_count from integrated_design_autocompletion_receipt
                 where process_code='PROC'
                """,Integer.class));
            assertEquals("true",jdbc.queryForObject("""
                select receipt_json->>'sourceReused'
                  from integrated_design_autocompletion_receipt where process_code='PROC'
                """,String.class));
            assertEquals("0",jdbc.queryForObject("""
                select receipt_json->>'sourceWriteCount'
                  from integrated_design_autocompletion_receipt where process_code='PROC'
                """,String.class));
            assertEquals(campaign.newCommit(),jdbc.queryForObject("""
                select receipt_json#>>'{canary,runtimeCommit}'
                  from integrated_design_autocompletion_receipt where process_code='PROC'
                """,String.class));
            assertEquals("1",jdbc.queryForObject("""
                select receipt_json#>>'{canary,attemptNumber}'
                  from integrated_design_autocompletion_receipt where process_code='PROC'
                """,String.class));
            assertEquals(jobXmin,jdbc.queryForObject(
                "select xmin::text from framework_development_job where job_id=?",
                String.class,campaign.jobId()));
            assertEquals(jobCount,count("framework_development_job"));
            assertEquals(eventCount,count("framework_development_job_event"));
            assertEquals(sourceDocumentVersionCount,count("integrated_design_document_version"));
            assertEquals(campaign.sourceHash(),currentCompositeSourceAuthorityHash());
        }finally{
            readiness.close();clearPhysicalRearmCampaign(campaign);
        }
    }

    @Test
    void physicalOnlyCanaryInvalidatesBeforeDispatchWhenRuntimeIdentityChangesAtSameCommit(){
        seedCompositeThreeScreens();
        PhysicalRearmCampaign campaign=installPhysicalRearmCampaign(
            "a".repeat(40),"c".repeat(40),"PHYSICAL_GENERATED_VERIFIED");
        CompositeAutocompletionReadinessService readiness=readinessFor(campaign);
        CompositeDesignOperationalWorker worker=new CompositeDesignOperationalWorker(
            jdbc,new ObjectMapper(),service,readiness,new DataSourceTransactionManager(dataSource),
            false,2,25,false,600,30);
        String sourceXmin=jdbc.queryForObject(
            "select xmin::text from framework_process_definition where process_code='PROC'",
            String.class);
        String jobXmin=jdbc.queryForObject(
            "select xmin::text from framework_development_job where job_id=?",
            String.class,campaign.jobId());
        int jobCount=count("framework_development_job");
        int eventCount=count("framework_development_job_event");
        int documentVersionCount=count("integrated_design_document_version");
        try{
            String requestedIdentity=currentRuntimeIdentityHash();
            List<Map<String,Object>> rearmed=transaction.execute(status->{
                readiness.acquireGlobalDispatchLock(910_881_003L);
                return readiness.rearmPhysicalCanary(UUID.randomUUID().toString(),
                    campaign.newCommit(),campaign.sourceHash(),1);
            });
            assertEquals(1,rearmed.size());
            assertEquals(requestedIdentity,jdbc.queryForObject("""
                select receipt_json#>>'{canary,requestedRuntimeIdentityHash}'
                  from integrated_design_autocompletion_receipt where process_code='PROC'
                """,String.class));
            assertEquals(0,jdbc.queryForObject("""
                select count(*) from integrated_design_live_smoke_dispatch where job_id=?
                """,Integer.class,campaign.jobId()));
            assertNull(jdbc.queryForObject("""
                select receipt_json->>'liveSmokeDispatchId'
                  from integrated_design_autocompletion_receipt where process_code='PROC'
                """,String.class));
            String previousCanary=jdbc.queryForObject("""
                select (receipt_json->'previousCanary')::text
                  from integrated_design_autocompletion_receipt where process_code='PROC'
                """,String.class);
            String attempt=jdbc.queryForObject("""
                select receipt_json#>>'{canary,attemptNumber}'
                  from integrated_design_autocompletion_receipt where process_code='PROC'
                """,String.class);
            assertEquals("VERIFIED",jdbc.queryForObject("""
                select receipt_json#>>'{previousCanary,status}'
                  from integrated_design_autocompletion_receipt where process_code='PROC'
                """,String.class));
            assertEquals("1",jdbc.queryForObject("""
                select receipt_json#>>'{previousCanary,attemptNumber}'
                  from integrated_design_autocompletion_receipt where process_code='PROC'
                """,String.class));

            String changedIdentity=transaction.execute(status->{
                assertEquals(1,jdbc.update("""
                    update framework_runtime_release_state
                       set deployment_uid=?,deployment_generation=deployment_generation+1,
                           observed_generation=observed_generation+1,
                           recorded_at=clock_timestamp()
                     where release_key='CARBONET_RUNTIME' and source_commit=?
                    ""","runtime-i2-"+UUID.randomUUID(),campaign.newCommit()));
                return currentRuntimeIdentityHash();
            });
            assertNotEquals(requestedIdentity,changedIdentity);
            assertEquals(campaign.newCommit(),jdbc.queryForObject("""
                select source_commit from framework_runtime_release_state
                 where release_key='CARBONET_RUNTIME'
                """,String.class));

            worker.reconcilePhysicalCompletion();
            assertEquals("INVALIDATED",jdbc.queryForObject("""
                select receipt_json#>>'{canary,status}'
                  from integrated_design_autocompletion_receipt where process_code='PROC'
                """,String.class));
            assertEquals("PHYSICAL_GENERATED_VERIFIED",jdbc.queryForObject("""
                select completion_status from integrated_design_autocompletion_receipt
                 where process_code='PROC'
                """,String.class));
            assertEquals("RUNTIME_OR_SOURCE_SUPERSEDED",jdbc.queryForObject("""
                select receipt_json#>>'{canary,failureCode}'
                  from integrated_design_autocompletion_receipt where process_code='PROC'
                """,String.class));
            assertEquals(0,jdbc.queryForObject("""
                select count(*) from integrated_design_live_smoke_dispatch where job_id=?
                """,Integer.class,campaign.jobId()));
            assertEquals(previousCanary,jdbc.queryForObject("""
                select (receipt_json->'previousCanary')::text
                  from integrated_design_autocompletion_receipt where process_code='PROC'
                """,String.class));
            assertEquals(attempt,jdbc.queryForObject("""
                select receipt_json#>>'{canary,attemptNumber}'
                  from integrated_design_autocompletion_receipt where process_code='PROC'
                """,String.class));
            assertEquals("0",jdbc.queryForObject("""
                select receipt_json->>'sourceWriteCount'
                  from integrated_design_autocompletion_receipt where process_code='PROC'
                """,String.class));
            assertEquals(campaign.jobId(),jdbc.queryForObject("""
                select job_id from integrated_design_autocompletion_receipt
                 where process_code='PROC'
                """,Long.class));
            assertEquals(sourceXmin,jdbc.queryForObject(
                "select xmin::text from framework_process_definition where process_code='PROC'",
                String.class));
            assertEquals(jobXmin,jdbc.queryForObject(
                "select xmin::text from framework_development_job where job_id=?",
                String.class,campaign.jobId()));
            assertEquals(jobCount,count("framework_development_job"));
            assertEquals(eventCount,count("framework_development_job_event"));
            assertEquals(documentVersionCount,count("integrated_design_document_version"));
        }finally{
            worker.close();clearPhysicalRearmCampaign(campaign);
        }
    }

    @Test
    void physicalOnlyCanarySameRuntimeIdentityCreatesExactlyOneBoundDispatch(){
        seedCompositeThreeScreens();
        PhysicalRearmCampaign campaign=installDispatchablePhysicalRearmCampaign();
        DataSourceTransactionManager manager=new DataSourceTransactionManager(dataSource);
        CompositeAutocompletionReadinessService readiness=
            new CompositeAutocompletionReadinessService(jdbc,service,manager,
                8,8,2,campaign.newCommit(),"","");
        CompositeDesignOperationalWorker worker=new CompositeDesignOperationalWorker(
            jdbc,new ObjectMapper(),service,readiness,manager,false,2,25,false,600,30);
        try{
            String requestedIdentity=currentRuntimeIdentityHash();
            List<Map<String,Object>> rearmed=transaction.execute(status->{
                readiness.acquireGlobalDispatchLock(910_881_003L);
                return readiness.rearmPhysicalCanary(UUID.randomUUID().toString(),
                    campaign.newCommit(),campaign.sourceHash(),1);
            });
            assertEquals(1,rearmed.size());
            assertEquals(requestedIdentity,jdbc.queryForObject("""
                select receipt_json#>>'{canary,requestedRuntimeIdentityHash}'
                  from integrated_design_autocompletion_receipt where process_code='PROC'
                """,String.class));
            assertEquals(0,jdbc.queryForObject("""
                select count(*) from integrated_design_live_smoke_dispatch where job_id=?
                """,Integer.class,campaign.jobId()));

            int invalidated=transaction.execute(
                status->readiness.invalidateStalePhysicalRevalidations());
            assertEquals(0,invalidated);
            assertEquals("ACTIVE",jdbc.queryForObject("""
                select receipt_json#>>'{canary,status}'
                  from integrated_design_autocompletion_receipt where process_code='PROC'
                """,String.class));
            worker.reconcilePhysicalCompletion();

            Map<String,Object> dispatch=jdbc.queryForMap("""
                select dispatch_id as "dispatchId",runtime_commit as "runtimeCommit",
                       runtime_identity_hash as "runtimeIdentityHash",
                       canary_attempt as "canaryAttempt",status
                  from integrated_design_live_smoke_dispatch where job_id=?
                """,campaign.jobId());
            assertEquals(1,jdbc.queryForObject("""
                select count(*) from integrated_design_live_smoke_dispatch where job_id=?
                """,Integer.class,campaign.jobId()));
            assertEquals(campaign.newCommit(),dispatch.get("runtimeCommit"));
            assertEquals(requestedIdentity,dispatch.get("runtimeIdentityHash"));
            assertEquals(1,((Number)dispatch.get("canaryAttempt")).intValue());
            assertEquals("QUEUED",dispatch.get("status"));
            assertEquals("ACTIVE",jdbc.queryForObject("""
                select receipt_json#>>'{canary,status}'
                  from integrated_design_autocompletion_receipt where process_code='PROC'
                """,String.class));
            assertEquals(requestedIdentity,jdbc.queryForObject("""
                select receipt_json#>>'{canary,requestedRuntimeIdentityHash}'
                  from integrated_design_autocompletion_receipt where process_code='PROC'
                """,String.class));
            assertEquals(String.valueOf(dispatch.get("dispatchId")),jdbc.queryForObject("""
                select receipt_json->>'liveSmokeDispatchId'
                  from integrated_design_autocompletion_receipt where process_code='PROC'
                """,String.class));
        }finally{
            worker.close();resetAutocompletionGate();
            jdbc.update("delete from framework_postdeploy_release_attempt where candidate_id=?",
                campaign.candidateId());
        }
    }

    @Test
    void verifiedPhysicalCanaryRequiresCurrentRuntimeIdentityForGateAndFreshAcceptance(){
        seedCompositeThreeScreens();
        PhysicalRearmCampaign campaign=installDispatchablePhysicalRearmCampaign();
        String staleCandidate="postdeploy:verified-h1:"+
            UUID.randomUUID().toString().replace("-","");
        String freshCandidate="postdeploy:verified-h2:"+
            UUID.randomUUID().toString().replace("-","");
        DataSourceTransactionManager manager=new DataSourceTransactionManager(dataSource);
        CompositeAutocompletionReadinessService readiness=
            new CompositeAutocompletionReadinessService(jdbc,service,manager,
                8,8,2,campaign.newCommit(),"","");
        CompositeDesignOperationalWorker worker=new CompositeDesignOperationalWorker(
            jdbc,new ObjectMapper(),service,readiness,manager,false,2,25,false,600,30);
        try{
            String identityH1=currentRuntimeIdentityHash();
            List<Map<String,Object>> first=transaction.execute(status->{
                readiness.acquireGlobalDispatchLock(910_881_003L);
                return readiness.rearmPhysicalCanary(UUID.randomUUID().toString(),
                    campaign.newCommit(),campaign.sourceHash(),1);
            });
            assertEquals(1,first.size());
            worker.reconcilePhysicalCompletion();
            assertEquals(45,installExactLiveSmokeEvidence(campaign.jobId(),false));
            markDispatchEvidenceSubmitted(campaign.jobId());
            worker.reconcilePhysicalCompletion();
            assertEquals("VERIFIED",jdbc.queryForObject("""
                select receipt_json#>>'{canary,status}'
                  from integrated_design_autocompletion_receipt where process_code='PROC'
                """,String.class));
            assertEquals(identityH1,jdbc.queryForObject("""
                select receipt_json#>>'{canary,requestedRuntimeIdentityHash}'
                  from integrated_design_autocompletion_receipt where process_code='PROC'
                """,String.class));
            assertEquals(1,jdbc.queryForObject("""
                select count(*) from integrated_design_live_smoke_dispatch
                 where job_id=? and runtime_identity_hash=? and status='COMPLETED'
                """,Integer.class,campaign.jobId(),identityH1));

            Map<String,Object> h1Report=readiness.inspect(true,0);
            assertEquals(1,number(h1Report,"currentVerifiedCanaryCount"));
            assertEquals(true,h1Report.get("enablementPrerequisitesMet"));
            stagePostdeployCandidate(staleCandidate,campaign.newCommit());
            Map<String,Object> h1Prepared=readiness.prepare(
                ((Number)h1Report.get("gateRevision")).longValue(),campaign.newCommit(),
                String.valueOf(h1Report.get("currentFinalAuthoritySetHash")),staleCandidate,
                "postgres-test",true,0);
            assertEquals("PREPARED",h1Prepared.get("approvalStatus"));
            promotePostdeployCandidate(staleCandidate,campaign.newCommit(),identityH1);

            String identityH2=transaction.execute(status->{
                assertEquals(1,jdbc.update("""
                    update framework_runtime_release_state
                       set deployment_uid=?,deployment_generation=deployment_generation+1,
                           observed_generation=observed_generation+1,
                           recorded_at=clock_timestamp()
                     where release_key='CARBONET_RUNTIME' and source_commit=?
                    ""","runtime-h2-"+UUID.randomUUID(),campaign.newCommit()));
                return currentRuntimeIdentityHash();
            });
            assertNotEquals(identityH1,identityH2);
            Map<String,Object> staleReport=readiness.inspect(true,0);
            assertEquals(0,number(staleReport,"currentVerifiedCanaryCount"));
            assertEquals(false,staleReport.get("enablementPrerequisitesMet"));
            assertEquals(false,staleReport.get("preparedBindingCurrent"));

            Map<String,Object> gateBeforeReject=jdbc.queryForMap("""
                select revision,approval_status as "approvalStatus",xmin::text as xmin
                  from integrated_design_autocompletion_gate where gate_key='GLOBAL'
                """);
            String receiptBeforeReject=jdbc.queryForObject("""
                select xmin::text from integrated_design_autocompletion_receipt
                 where process_code='PROC'
                """,String.class);
            int jobCount=count("framework_development_job");
            int eventCount=count("framework_development_job_event");
            int documentVersionCount=count("integrated_design_document_version");
            int dispatchCount=count("integrated_design_live_smoke_dispatch");
            int evidenceCount=count("integrated_design_live_smoke_evidence");
            int postdeployCount=count("framework_postdeploy_release_attempt");
            IllegalStateException activateRejected=assertThrows(IllegalStateException.class,()->
                readiness.activate(((Number)h1Prepared.get("revision")).longValue(),
                    campaign.newCommit(),campaign.sourceHash(),staleCandidate,
                    "postgres-test",true,0));
            assertEquals("AUTOCOMPLETION_ACTIVATION_PREFLIGHT_STALE",
                activateRejected.getMessage());
            IllegalStateException prepareRejected=assertThrows(IllegalStateException.class,()->
                readiness.prepare(((Number)h1Prepared.get("revision")).longValue(),
                    campaign.newCommit(),
                    String.valueOf(staleReport.get("currentFinalAuthoritySetHash")),
                    staleCandidate,"postgres-test",true,0));
            assertEquals("AUTOCOMPLETION_APPROVAL_PREFLIGHT_STALE",
                prepareRejected.getMessage());
            assertEquals(gateBeforeReject,jdbc.queryForMap("""
                select revision,approval_status as "approvalStatus",xmin::text as xmin
                  from integrated_design_autocompletion_gate where gate_key='GLOBAL'
                """));
            assertEquals(receiptBeforeReject,jdbc.queryForObject("""
                select xmin::text from integrated_design_autocompletion_receipt
                 where process_code='PROC'
                """,String.class));
            assertEquals(jobCount,count("framework_development_job"));
            assertEquals(eventCount,count("framework_development_job_event"));
            assertEquals(documentVersionCount,count("integrated_design_document_version"));
            assertEquals(dispatchCount,count("integrated_design_live_smoke_dispatch"));
            assertEquals(evidenceCount,count("integrated_design_live_smoke_evidence"));
            assertEquals(postdeployCount,count("framework_postdeploy_release_attempt"));

            worker.reconcilePhysicalCompletion();
            assertEquals("INVALIDATED",jdbc.queryForObject("""
                select receipt_json#>>'{canary,status}'
                  from integrated_design_autocompletion_receipt where process_code='PROC'
                """,String.class));
            assertEquals(1,jdbc.queryForObject("""
                select count(*) from integrated_design_live_smoke_dispatch
                 where job_id=? and runtime_identity_hash=? and status='SUPERSEDED'
                """,Integer.class,campaign.jobId(),identityH1));

            restorePhysicalRearmGate(campaign);
            int secondAttempt=transaction.execute(status->{
                readiness.acquireGlobalDispatchLock(910_881_003L);
                return readiness.nextCanaryAttempt(campaign.newCommit(),campaign.sourceHash());
            });
            assertEquals(2,secondAttempt);
            List<Map<String,Object>> second=transaction.execute(status->{
                readiness.acquireGlobalDispatchLock(910_881_003L);
                return readiness.rearmPhysicalCanary(UUID.randomUUID().toString(),
                    campaign.newCommit(),campaign.sourceHash(),secondAttempt);
            });
            assertEquals(1,second.size());
            assertEquals(identityH2,jdbc.queryForObject("""
                select receipt_json#>>'{canary,requestedRuntimeIdentityHash}'
                  from integrated_design_autocompletion_receipt where process_code='PROC'
                """,String.class));
            assertEquals(0,jdbc.queryForObject("""
                select count(*) from integrated_design_live_smoke_dispatch
                 where job_id=? and runtime_identity_hash=?
                """,Integer.class,campaign.jobId(),identityH2));
            worker.reconcilePhysicalCompletion();
            assertEquals(45,installExactLiveSmokeEvidence(campaign.jobId(),false));
            markDispatchEvidenceSubmitted(campaign.jobId());
            worker.reconcilePhysicalCompletion();
            assertEquals(1,jdbc.queryForObject("""
                select count(*) from integrated_design_live_smoke_dispatch
                 where job_id=? and runtime_identity_hash=? and canary_attempt=2
                   and status='COMPLETED'
                """,Integer.class,campaign.jobId(),identityH2));
            assertEquals("VERIFIED",jdbc.queryForObject("""
                select receipt_json#>>'{canary,status}'
                  from integrated_design_autocompletion_receipt where process_code='PROC'
                """,String.class));
            assertEquals("2",jdbc.queryForObject("""
                select receipt_json#>>'{canary,attemptNumber}'
                  from integrated_design_autocompletion_receipt where process_code='PROC'
                """,String.class));

            Map<String,Object> h2Report=readiness.inspect(true,0);
            assertEquals(1,number(h2Report,"currentVerifiedCanaryCount"));
            assertEquals(true,h2Report.get("enablementPrerequisitesMet"));
            stagePostdeployCandidate(freshCandidate,campaign.newCommit());
            Map<String,Object> h2Prepared=readiness.prepare(
                ((Number)h2Report.get("gateRevision")).longValue(),campaign.newCommit(),
                String.valueOf(h2Report.get("currentFinalAuthoritySetHash")),freshCandidate,
                "postgres-test",true,0);
            promotePostdeployCandidate(freshCandidate,campaign.newCommit(),identityH2);
            Map<String,Object> activated=readiness.activate(
                ((Number)h2Prepared.get("revision")).longValue(),campaign.newCommit(),
                campaign.sourceHash(),freshCandidate,"postgres-test",true,0);
            assertEquals("ACTIVE",activated.get("approvalStatus"));
            Map<String,Object> accepted=readiness.inspect(true,0);
            assertEquals(1,number(accepted,"currentVerifiedCanaryCount"));
            assertEquals(true,accepted.get("approvalBindingCurrent"));
            assertEquals(true,accepted.get("automaticEnablementAllowed"));
        }finally{
            worker.close();resetAutocompletionGate();
            jdbc.update("delete from framework_postdeploy_evidence_promotion where candidate_id in(?,?)",
                staleCandidate,freshCandidate);
            jdbc.update("delete from framework_postdeploy_release_attempt where candidate_id in(?,?,?)",
                campaign.candidateId(),staleCandidate,freshCandidate);
        }
    }

    @Test
    void liveSmokeEvidenceRequiresDispatchTemporalWindowForWriterAssessorAndFinalizer(){
        seedCompositeThreeScreens();
        PhysicalRearmCampaign campaign=installDispatchablePhysicalRearmCampaign();
        DataSourceTransactionManager manager=new DataSourceTransactionManager(dataSource);
        CompositeAutocompletionReadinessService readiness=
            new CompositeAutocompletionReadinessService(jdbc,service,manager,
                8,8,2,campaign.newCommit(),"","");
        CompositeDesignOperationalWorker worker=new CompositeDesignOperationalWorker(
            jdbc,new ObjectMapper(),service,readiness,manager,false,2,25,false,600,30);
        try{
            List<Map<String,Object>> rearmed=transaction.execute(status->{
                readiness.acquireGlobalDispatchLock(910_881_003L);
                return readiness.rearmPhysicalCanary(UUID.randomUUID().toString(),
                    campaign.newCommit(),campaign.sourceHash(),1);
            });
            assertEquals(1,rearmed.size());
            worker.reconcilePhysicalCompletion();
            assertEquals(45,installExactLiveSmokeEvidence(
                campaign.jobId(),false,false,true));
            long dispatchId=jdbc.queryForObject("""
                select dispatch_id from integrated_design_live_smoke_dispatch
                 where job_id=? and runtime_identity_hash=?
                """,Long.class,campaign.jobId(),currentRuntimeIdentityHash());
            assertEquals(45,jdbc.queryForObject("""
                select count(*) from integrated_design_live_smoke_evidence
                 where dispatch_id=? and observed_at>=
                   (select started_at from integrated_design_live_smoke_dispatch where dispatch_id=?)
                   and observed_at<=recorded_at
                """,Integer.class,dispatchId,dispatchId));
            markDispatchEvidenceSubmitted(campaign.jobId());
            CompositePhysicalEvidenceService physical=new CompositePhysicalEvidenceService(jdbc);
            assertEquals(CompositePhysicalEvidenceService.Verdict.EXACT,
                physical.assess(campaign.jobId(),"PROC"));

            dispatchId=replaceDispatchWithAdversarialOldEvidence(campaign.jobId());
            assertEquals(45,jdbc.queryForObject("""
                select count(*) from integrated_design_live_smoke_evidence evidence
                  join integrated_design_live_smoke_dispatch dispatch
                    on dispatch.dispatch_id=evidence.dispatch_id
                 where evidence.dispatch_id=? and evidence.observed_at<dispatch.started_at
                """,Integer.class,dispatchId));
            markDispatchEvidenceSubmitted(campaign.jobId());
            assertEquals(CompositePhysicalEvidenceService.Verdict.LIVE_SMOKE_TEST_PENDING,
                physical.assess(campaign.jobId(),"PROC"));
            worker.reconcilePhysicalCompletion();
            assertEquals("SOURCE_APPLIED_PHYSICAL_QUEUED",jdbc.queryForObject("""
                select completion_status from integrated_design_autocompletion_receipt
                 where process_code='PROC'
                """,String.class));
            assertEquals("ACTIVE",jdbc.queryForObject("""
                select receipt_json#>>'{canary,status}'
                  from integrated_design_autocompletion_receipt where process_code='PROC'
                """,String.class));
            assertEquals("EVIDENCE_SUBMITTED",jdbc.queryForObject("""
                select status from integrated_design_live_smoke_dispatch where dispatch_id=?
                """,String.class,dispatchId));
            assertEquals(0,jdbc.queryForObject("""
                select count(*) from integrated_design_live_smoke_dispatch
                 where dispatch_id=? and status='COMPLETED'
                """,Integer.class,dispatchId));
        }finally{
            worker.close();resetAutocompletionGate();
            jdbc.update("delete from framework_postdeploy_release_attempt where candidate_id=?",
                campaign.candidateId());
        }
    }

    @Test
    void verifiedSourceCanaryRuntimeIdentityDriftRearmsPhysicalAttemptTwoWithoutSourceWrites(){
        seedCompositeThreeScreens();
        prepareCompositeReadinessBenchmarkDocuments();
        String commit="c".repeat(40);
        assertEquals(1,jdbc.update("""
            update framework_runtime_release_state
               set source_commit=?,deployment_uid=?,deployment_generation=2,
                   observed_generation=2,image_ref='carbonet-runtime:source-h1',
                   health_status='UP',recorded_at=clock_timestamp()
             where release_key='CARBONET_RUNTIME'
            """,commit,"runtime-source-h1-"+UUID.randomUUID()));
        DataSourceTransactionManager manager=new DataSourceTransactionManager(dataSource);
        CompositeAutocompletionReadinessService readiness=
            new CompositeAutocompletionReadinessService(jdbc,service,manager,
                8,8,2,commit,"","");
        CompositeDesignOperationalWorker worker=new CompositeDesignOperationalWorker(
            jdbc,new ObjectMapper(),service,readiness,manager,true,2,25,false,600,30);
        String retryCandidate="postdeploy:source-runtime-retry:"+
            UUID.randomUUID().toString().replace("-","");
        try{
            String identityH1=currentRuntimeIdentityHash();
            Map<String,Object> first=worker.dispatchCanary();
            assertEquals(1,number(first,"claimedCount"));
            assertEquals(1,number(first,"canaryAttempt"));
            assertEquals(1,number(first,"activeWorkerCount"));
            awaitReceiptCompletion("SOURCE_APPLIED_PHYSICAL_QUEUED",30);
            awaitWorkerIdle(worker,5);
            long jobId=jdbc.queryForObject("""
                select job_id from integrated_design_autocompletion_receipt
                 where process_code='PROC'
                """,Long.class);
            installExactCanonicalPhysicalEvidenceAtCurrentRuntime(jobId);
            assertEquals("false",jdbc.queryForObject("""
                select coalesce(receipt_json#>>'{canary,physicalRevalidation}','false')
                  from integrated_design_autocompletion_receipt where process_code='PROC'
                """,String.class));
            assertEquals(identityH1,jdbc.queryForObject("""
                select receipt_json#>>'{canary,requestedRuntimeIdentityHash}'
                  from integrated_design_autocompletion_receipt where process_code='PROC'
                """,String.class));
            assertEquals(45,installExactLiveSmokeEvidence(jobId,false));
            markDispatchEvidenceSubmitted(jobId);
            worker.reconcilePhysicalCompletion();
            assertEquals("VERIFIED",jdbc.queryForObject("""
                select receipt_json#>>'{canary,status}'
                  from integrated_design_autocompletion_receipt where process_code='PROC'
                """,String.class));
            assertEquals(1,jdbc.queryForObject("""
                select count(*) from integrated_design_live_smoke_dispatch
                 where job_id=? and runtime_identity_hash=? and canary_attempt=1
                   and status='COMPLETED'
                """,Integer.class,jobId,identityH1));
            activateLegacyGateForPhysicalRetry("b".repeat(40),
                currentCompositeSourceAuthorityHash(),jobId,retryCandidate);

            String identityH2=transaction.execute(status->{
                assertEquals(1,jdbc.update("""
                    update framework_runtime_release_state
                       set deployment_uid=?,deployment_generation=deployment_generation+1,
                           observed_generation=observed_generation+1,
                           image_ref='carbonet-runtime:source-h2',recorded_at=clock_timestamp()
                     where release_key='CARBONET_RUNTIME' and source_commit=?
                    ""","runtime-source-h2-"+UUID.randomUUID(),commit));
                return currentRuntimeIdentityHash();
            });
            assertNotEquals(identityH1,identityH2);
            worker.reconcilePhysicalCompletion();
            assertEquals("INVALIDATED",jdbc.queryForObject("""
                select receipt_json#>>'{canary,status}'
                  from integrated_design_autocompletion_receipt where process_code='PROC'
                """,String.class));
            assertEquals(1,jdbc.queryForObject("""
                select count(*) from integrated_design_live_smoke_dispatch
                 where job_id=? and runtime_identity_hash=? and status='SUPERSEDED'
                """,Integer.class,jobId,identityH1));
            String invalidatedCanary=jdbc.queryForObject("""
                select receipt_json->'canary' from integrated_design_autocompletion_receipt
                 where process_code='PROC'
                """,String.class);

            Map<String,Object> publicationBefore=compositePublicationXmins();
            Map<String,Object> sourceBefore=sourceWitnessXmins();
            int jobCount=count("framework_development_job");
            int eventCount=count("framework_development_job_event");
            int documentCount=count("integrated_design_document");
            int versionCount=count("integrated_design_document_version");
            int authorityCount=count("integrated_design_authority");
            Map<String,Object> second=worker.dispatchCanary();
            assertEquals(1,number(second,"claimedCount"));
            assertEquals(2,number(second,"canaryAttempt"));
            assertEquals(0,number(second,"activeWorkerCount"));
            Map<String,Object> rearmed=jdbc.queryForMap("""
                select job_id as "jobId",receipt_json#>>'{canary,status}' as "canaryStatus",
                       receipt_json#>>'{canary,attemptNumber}' as "canaryAttempt",
                       receipt_json#>>'{canary,physicalRevalidation}' as "physicalRevalidation",
                       receipt_json#>>'{canary,sourceWriteCount}' as "sourceWriteCount",
                       receipt_json#>>'{canary,requestedRuntimeIdentityHash}' as "runtimeIdentity",
                       receipt_json->'previousCanary' as "previousCanary"
                  from integrated_design_autocompletion_receipt where process_code='PROC'
                """);
            assertEquals(jobId,((Number)rearmed.get("jobId")).longValue());
            assertEquals("ACTIVE",rearmed.get("canaryStatus"));
            assertEquals("2",rearmed.get("canaryAttempt"));
            assertEquals("true",rearmed.get("physicalRevalidation"));
            assertEquals("0",rearmed.get("sourceWriteCount"));
            assertEquals(identityH2,rearmed.get("runtimeIdentity"));
            assertEquals(invalidatedCanary,String.valueOf(rearmed.get("previousCanary")));
            assertEquals(publicationBefore,compositePublicationXmins());
            assertEquals(sourceBefore,sourceWitnessXmins());
            assertEquals(jobCount,count("framework_development_job"));
            assertEquals(eventCount,count("framework_development_job_event"));
            assertEquals(documentCount,count("integrated_design_document"));
            assertEquals(versionCount,count("integrated_design_document_version"));
            assertEquals(authorityCount,count("integrated_design_authority"));
            assertEquals(1,jdbc.queryForObject("""
                select count(*) from integrated_design_live_smoke_dispatch
                 where job_id=? and runtime_identity_hash=? and canary_attempt=2
                   and status='QUEUED'
                """,Integer.class,jobId,identityH2));

            assertEquals(45,installExactLiveSmokeEvidence(jobId,false));
            markDispatchEvidenceSubmitted(jobId);
            worker.reconcilePhysicalCompletion();
            assertEquals("VERIFIED",jdbc.queryForObject("""
                select receipt_json#>>'{canary,status}'
                  from integrated_design_autocompletion_receipt where process_code='PROC'
                """,String.class));
            assertEquals("2",jdbc.queryForObject("""
                select receipt_json#>>'{canary,attemptNumber}'
                  from integrated_design_autocompletion_receipt where process_code='PROC'
                """,String.class));
        }finally{
            worker.close();resetAutocompletionGate();
            jdbc.update("delete from framework_postdeploy_release_attempt where candidate_id=?",
                retryCandidate);
        }
    }

    @Test
    void verifiedCanariesWithMissingOrMismatchedDispatchBindingsInvalidateAndRetry(){
        seedCompositeThreeScreens();
        cloneCompositeBenchmarkProcesses(2,12);
        prepareCompositeReadinessBenchmarkDocuments();
        String oldCommit="b".repeat(40),commit="c".repeat(40);
        assertEquals(1,jdbc.update("""
            update framework_runtime_release_state
               set source_commit=?,deployment_uid=?,deployment_generation=2,
                   observed_generation=2,image_ref='carbonet-runtime:binding-h1',
                   health_status='UP',recorded_at=clock_timestamp()
             where release_key='CARBONET_RUNTIME'
            """,commit,"runtime-binding-h1-"+UUID.randomUUID()));
        String runtimeIdentity=currentRuntimeIdentityHash();
        String globalHash=currentCompositeSourceAuthorityHash();
        List<String> processes=jdbc.queryForList("""
            select process_code from (
              select distinct upper(process_code) process_code
                from framework_composite_design_target_identity) target
             order by process_code collate "C"
            """,String.class);
        assertEquals(12,processes.size());
        Map<String,Long> jobs=new LinkedHashMap<>();
        for(String process:processes)jobs.put(process,insertVerifiedCanaryBindingJob(process));
        long wrongJob=insertVerifiedCanaryBindingJob("WRONG_JOB_OWNER");
        List<String> variants=List.of(
            "MISSING","STATUS","JOB","PROCESS","COMMIT","IDENTITY","ATTEMPT",
            "REVISION","ARTIFACT","SOURCE","TEMPORAL","SET_HASH");
        for(int index=0;index<processes.size();index++){
            String process=processes.get(index),variant=variants.get(index);
            long jobId=jobs.get(process),dispatchId=900_000_000_000L+index;
            if(!"MISSING".equals(variant))dispatchId=insertMismatchedVerifiedDispatch(
                jobId,wrongJob,process,variant,commit,oldCommit,runtimeIdentity);
            String processHash=jdbc.queryForObject(
                "select framework_composite_dependency_fingerprint(?)",String.class,process);
            assertEquals(1,jdbc.update("""
                insert into integrated_design_autocompletion_receipt(
                  process_code,completion_status,dependency_fingerprint,job_id,duration_ms,
                  receipt_json,started_at,completed_at)
                values(?,'PHYSICAL_GENERATED_VERIFIED',?,?,1000,jsonb_build_object(
                  'sourceInputDependencyHash',?,'liveSmokeDispatchId',?::bigint,
                  'liveSmokeEvidenceCount',1,'liveSmokeEvidenceSetHash',repeat('d',64),
                  'generationStatus','PHYSICAL_GENERATED_VERIFIED','physicalVerified',true,
                  'canary',jsonb_build_object('canaryId',?,'status','VERIFIED',
                    'attemptNumber',1,'runtimeCommit',?,
                    'requestedRuntimeIdentityHash',?,
                    'requestedSourceAuthorityHash',?,
                    'requestedSourceDependencyHash',?,'physicalRevalidation',false,
                    'verifiedFinalAuthorityHash',repeat('f',64),
                    'physicalVerifiedAt',clock_timestamp())),
                  clock_timestamp()-interval '1 second',clock_timestamp())
                """,process,processHash,jobId,processHash,dispatchId,
                UUID.randomUUID().toString(),commit,runtimeIdentity,globalHash,processHash));
        }
        String retryCandidate="postdeploy:binding-retry:"+
            UUID.randomUUID().toString().replace("-","");
        activateLegacyGateForPhysicalRetry(
            oldCommit,globalHash,jobs.get("PROC"),retryCandidate);
        DataSourceTransactionManager manager=new DataSourceTransactionManager(dataSource);
        CompositeAutocompletionReadinessService readiness=
            new CompositeAutocompletionReadinessService(jdbc,service,manager,
                8,8,2,commit,"","");
        CompositeDesignOperationalWorker worker=new CompositeDesignOperationalWorker(
            jdbc,new ObjectMapper(),service,readiness,manager,true,8,25,false,600,30);
        try{
            Map<String,Object> rejected=readiness.inspect(true,0);
            assertEquals(0,number(rejected,"currentVerifiedCanaryCount"));
            assertEquals(false,rejected.get("enablementPrerequisitesMet"));
            Map<String,Object> publicationBefore=compositePublicationXmins();
            int jobCount=count("framework_development_job");
            worker.reconcilePhysicalCompletion();
            assertEquals(12,jdbc.queryForObject("""
                select count(*) from integrated_design_autocompletion_receipt
                 where receipt_json#>>'{canary,status}'='INVALIDATED'
                   and receipt_json#>>'{canary,attemptNumber}'='1'
                """,Integer.class));
            assertEquals(12,jdbc.queryForObject("""
                select count(*) from integrated_design_autocompletion_receipt
                 where completion_status='PHYSICAL_GENERATED_VERIFIED'
                   and job_id is not null and lease_token is null and lease_until is null
                """,Integer.class));
            assertEquals(publicationBefore,compositePublicationXmins());
            assertEquals(jobCount,count("framework_development_job"));

            Map<String,Object> retry=worker.dispatchCanary();
            assertEquals(1,number(retry,"claimedCount"));
            assertEquals(2,number(retry,"canaryAttempt"));
            assertEquals(0,number(retry,"activeWorkerCount"));
            assertEquals(jobCount,count("framework_development_job"));
            assertEquals(1,jdbc.queryForObject("""
                select count(*) from integrated_design_autocompletion_receipt
                 where receipt_json#>>'{canary,status}'='FAILED'
                   and receipt_json#>>'{canary,attemptNumber}'='2'
                   and receipt_json#>>'{canary,physicalRevalidation}'='true'
                   and receipt_json#>>'{canary,sourceWriteCount}'='0'
                   and completion_status='PHYSICAL_GENERATED_VERIFIED'
                   and job_id is not null
                """,Integer.class));
        }finally{
            worker.close();resetAutocompletionGate();
            jdbc.update("delete from framework_postdeploy_release_attempt where candidate_id=?",
                retryCandidate);
        }
    }

    @Test
    void queuedDispatchSpoofedStartIsReplacedAtClaimBeforeAnyEvidenceWrite(){
        seedCompositeThreeScreens();
        PhysicalRearmCampaign campaign=installDispatchablePhysicalRearmCampaign();
        CompositeAutocompletionReadinessService readiness=readinessFor(campaign);
        try{
            List<Map<String,Object>> rearmed=transaction.execute(status->{
                readiness.acquireGlobalDispatchLock(910_881_003L);
                return readiness.rearmPhysicalCanary(UUID.randomUUID().toString(),
                    campaign.newCommit(),campaign.sourceHash(),1);
            });
            assertEquals(1,rearmed.size());
            String canonicalArtifact=jdbc.queryForObject("""
                select framework_try_jsonb(result_json)#>>
                         '{canonicalGeneration,compositeArtifactManifestHash}'
                  from framework_development_job where job_id=?
                """,String.class,campaign.jobId());
            String revisionHash=jdbc.queryForObject(
                "select framework_composite_authority_revision_set_hash(?)",String.class,
                campaign.jobId());
            String processSource=jdbc.queryForObject("""
                select framework_try_jsonb(specification_json)->>'sourceHash'
                  from framework_development_job where job_id=?
                """,String.class,campaign.jobId());
            int expected=jdbc.queryForObject("""
                select sum(jsonb_array_length(
                  composite_json#>'{executableDesign,TEST,scenarios}')*3)::integer
                  from integrated_design_authority where job_id=?
                """,Integer.class,campaign.jobId());
            String spoofed=jdbc.queryForObject("""
                select (clock_timestamp()-interval '1 day')::timestamptz::text
                """,String.class);
            long dispatchId=jdbc.queryForObject("""
                insert into integrated_design_live_smoke_dispatch(
                  job_id,process_code,project_id,runtime_commit,runtime_identity_hash,
                  canary_attempt,authority_revision_set_hash,artifact_manifest_hash,
                  process_source_hash,expected_evidence_count,status,started_at)
                values(?,'PROC','*',?,?,1,?,?,?,?, 'QUEUED',?::timestamptz)
                returning dispatch_id
                """,Long.class,campaign.jobId(),campaign.newCommit(),
                currentRuntimeIdentityHash(),revisionHash,canonicalArtifact,processSource,
                expected,spoofed);
            assertEquals(0,jdbc.queryForObject("""
                select count(*) from integrated_design_live_smoke_evidence
                 where dispatch_id=?
                """,Integer.class,dispatchId));
            assertEquals(dispatchId,ensureRunningLiveSmokeDispatch(
                campaign.jobId(),canonicalArtifact).id());
            assertEquals("RUNNING",jdbc.queryForObject("""
                select status from integrated_design_live_smoke_dispatch where dispatch_id=?
                """,String.class,dispatchId));
            assertEquals(true,jdbc.queryForObject("""
                select started_at>?::timestamptz+interval '23 hours'
                  from integrated_design_live_smoke_dispatch where dispatch_id=?
                """,Boolean.class,spoofed,dispatchId));
            assertEquals(0,jdbc.queryForObject("""
                select count(*) from integrated_design_live_smoke_evidence
                 where dispatch_id=?
                """,Integer.class,dispatchId));
            assertEquals(45,installExactLiveSmokeEvidence(
                campaign.jobId(),false,false,true));
            assertEquals(45,jdbc.queryForObject("""
                select count(*) from integrated_design_live_smoke_evidence evidence
                  join integrated_design_live_smoke_dispatch dispatch
                    on dispatch.dispatch_id=evidence.dispatch_id
                 where evidence.dispatch_id=? and evidence.observed_at>=dispatch.started_at
                   and evidence.observed_at<=evidence.recorded_at
                """,Integer.class,dispatchId));
        }finally{
            readiness.close();resetAutocompletionGate();
        }
    }

    @Test
    void claimedSourceCanaryBindingTamperInvalidatesBeforeCompilerWrites() throws Exception {
        int index=0;
        for(String variant:List.of(
                "EXPIRED_LEASE","ROOT_HASH","DEPENDENCY","ATTEMPT","JOB_ID")){
            if(index++>0)seed();
            seedCompositeThreeScreens();prepareCompositeReadinessBenchmarkDocuments();
            assertClaimedCanaryBindingTamperInvalidatesBeforeCompilerWrites(variant);
        }
    }

    private void assertClaimedCanaryBindingTamperInvalidatesBeforeCompilerWrites(
            String variant) throws Exception {
        String commit="c".repeat(40);
        assertEquals(1,jdbc.update("""
            update framework_runtime_release_state
               set source_commit=?,deployment_uid=?,deployment_generation=2,
                   observed_generation=2,image_ref='carbonet-runtime:expired-claim',
                   health_status='UP',recorded_at=clock_timestamp()
             where release_key='CARBONET_RUNTIME'
            """,commit,"runtime-expired-claim-"+UUID.randomUUID()));
        DataSourceTransactionManager manager=new DataSourceTransactionManager(dataSource);
        CompositeAutocompletionReadinessService readiness=
            new CompositeAutocompletionReadinessService(jdbc,service,manager,
                8,8,2,commit,"","");
        CompositeDesignOperationalWorker worker=new CompositeDesignOperationalWorker(
            jdbc,new ObjectMapper(),service,readiness,manager,true,2,25,false,600,30);
        JdbcTemplate lockJdbc=new JdbcTemplate(dataSource);
        TransactionTemplate lockTransaction=
            new TransactionTemplate(new DataSourceTransactionManager(dataSource));
        CountDownLatch locksHeld=new CountDownLatch(1),releaseLocks=new CountDownLatch(1);
        var executor=Executors.newSingleThreadExecutor();
        var lockFuture=executor.submit(()->lockTransaction.executeWithoutResult(status->{
            lockJdbc.queryForList("select pg_advisory_xact_lock(?)",0x434f4d50534c4f50L);
            lockJdbc.queryForList("select pg_advisory_xact_lock(?)",0x434f4d50534c4f51L);
            locksHeld.countDown();
            try{
                if(!releaseLocks.await(20,TimeUnit.SECONDS))
                    throw new IllegalStateException("CANARY_EXPIRED_LEASE_RELEASE_TIMEOUT");
            }catch(InterruptedException error){
                Thread.currentThread().interrupt();throw new IllegalStateException(error);
            }
        }));
        try{
            assertTrue(locksHeld.await(5,TimeUnit.SECONDS));
            Map<String,Object> first=worker.dispatchCanary();
            assertEquals(1,number(first,"claimedCount"));
            assertEquals(1,number(first,"activeWorkerCount"));
            Map<String,Object> claimed=jdbc.queryForMap("""
                select lease_token::text as "leaseToken",
                       receipt_json#>>'{canary,canaryId}' as "canaryId"
                  from integrated_design_autocompletion_receipt
                 where process_code='PROC' and completion_status='RUNNING'
                """);
            assertNotEquals(null,claimed.get("leaseToken"));
            int mutated=switch(variant){
                case "EXPIRED_LEASE"->jdbc.update("""
                    update integrated_design_autocompletion_receipt
                       set lease_until=clock_timestamp()-interval '1 second'
                     where process_code='PROC' and lease_token=?::uuid
                    """,claimed.get("leaseToken"));
                case "ROOT_HASH"->jdbc.update("""
                    update integrated_design_autocompletion_receipt
                       set receipt_json=jsonb_set(receipt_json,
                         '{sourceInputDependencyHash}',to_jsonb(repeat('e',64)))
                     where process_code='PROC' and lease_token=?::uuid
                    """,claimed.get("leaseToken"));
                case "DEPENDENCY"->jdbc.update("""
                    update integrated_design_autocompletion_receipt
                       set dependency_fingerprint=repeat('e',64)
                     where process_code='PROC' and lease_token=?::uuid
                    """,claimed.get("leaseToken"));
                case "ATTEMPT"->jdbc.update("""
                    update integrated_design_autocompletion_receipt
                       set receipt_json=jsonb_set(receipt_json,
                         '{canary,attemptNumber}','2'::jsonb)
                     where process_code='PROC' and lease_token=?::uuid
                    """,claimed.get("leaseToken"));
                case "JOB_ID"->jdbc.update("""
                    update integrated_design_autocompletion_receipt set job_id=?
                     where process_code='PROC' and lease_token=?::uuid
                    """,insertVerifiedCanaryBindingJob("PROC"),claimed.get("leaseToken"));
                default->throw new IllegalArgumentException(variant);
            };
            assertEquals(1,mutated,variant);
            Map<String,Object> sourceBefore=sourceWitnessXmins();
            Map<String,Object> publicationBefore=compositePublicationXmins();
            int jobsBefore=count("framework_development_job");
            int eventsBefore=count("framework_development_job_event");
            int documentsBefore=count("integrated_design_document");
            int versionsBefore=count("integrated_design_document_version");

            releaseLocks.countDown();lockFuture.get(5,TimeUnit.SECONDS);
            awaitReceiptCompletion("PENDING",10);awaitWorkerIdle(worker,5);
            Map<String,Object> invalidated=jdbc.queryForMap("""
                select job_id as "jobId",lease_token::text as "leaseToken",
                       lease_until as "leaseUntil",
                       receipt_json->>'generationStatus' as "generationStatus",
                       receipt_json->>'sourceCommitted' as "sourceCommitted",
                       receipt_json->>'jobCount' as "jobCount",
                       receipt_json#>>'{canary,canaryId}' as "canaryId",
                       receipt_json#>>'{canary,status}' as "canaryStatus",
                       receipt_json#>>'{canary,failureCode}' as "failureCode"
                  from integrated_design_autocompletion_receipt where process_code='PROC'
                """);
            assertNull(invalidated.get("jobId"));
            assertNull(invalidated.get("leaseToken"));
            assertNull(invalidated.get("leaseUntil"));
            assertEquals("CANARY_SOURCE_BINDING_CHANGED_REQUEUE",
                invalidated.get("generationStatus"));
            assertEquals("false",invalidated.get("sourceCommitted"));
            assertEquals("0",invalidated.get("jobCount"));
            assertEquals(claimed.get("canaryId"),invalidated.get("canaryId"));
            assertEquals("INVALIDATED",invalidated.get("canaryStatus"));
            assertEquals("SOURCE_OR_RUNTIME_BINDING_CHANGED",invalidated.get("failureCode"));
            assertEquals(sourceBefore,sourceWitnessXmins(),variant);
            assertEquals(publicationBefore,compositePublicationXmins(),variant);
            assertEquals(jobsBefore,count("framework_development_job"),variant);
            assertEquals(eventsBefore,count("framework_development_job_event"),variant);
            assertEquals(documentsBefore,count("integrated_design_document"),variant);
            assertEquals(versionsBefore,count("integrated_design_document_version"),variant);
        }finally{
            releaseLocks.countDown();
            if(!lockFuture.isDone())lockFuture.cancel(true);
            executor.shutdownNow();worker.close();resetAutocompletionGate();
        }
    }

    @Test
    void workerCompletionRegistryShareLockBlocksDirectDmlUntilSourceCommit()
            throws Exception {
        seedCompositeThreeScreens();
        prepareCompositeReadinessBenchmarkDocuments();
        String commit="c".repeat(40);
        assertEquals(1,jdbc.update("""
            update framework_runtime_release_state
               set source_commit=?,deployment_uid=?,deployment_generation=2,
                   observed_generation=2,image_ref='carbonet-runtime:registry-lock',
                   health_status='UP',recorded_at=clock_timestamp()
             where release_key='CARBONET_RUNTIME'
            """,commit,"runtime-registry-lock-"+UUID.randomUUID()));
        String baselineProcess=jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class);
        String baselineGlobal=currentCompositeSourceAuthorityHash();
        CountDownLatch registryLocksHeld=new CountDownLatch(1),releaseWorker=new CountDownLatch(1);
        JdbcTemplate pausingJdbc=new RegistryLockPausingJdbcTemplate(
            dataSource,registryLocksHeld,releaseWorker);
        DataSourceTransactionManager manager=new DataSourceTransactionManager(dataSource);
        CompositeAutocompletionReadinessService readiness=
            new CompositeAutocompletionReadinessService(pausingJdbc,service,manager,
                8,8,2,commit,"","");
        CompositeDesignOperationalWorker worker=new CompositeDesignOperationalWorker(
            pausingJdbc,new ObjectMapper(),service,readiness,manager,true,2,25,false,600,30);
        JdbcTemplate updateJdbc=new JdbcTemplate(dataSource),insertJdbc=new JdbcTemplate(dataSource);
        TransactionTemplate updateTx=new TransactionTemplate(
            new DataSourceTransactionManager(dataSource));
        TransactionTemplate insertTx=new TransactionTemplate(
            new DataSourceTransactionManager(dataSource));
        CountDownLatch mutationsStarted=new CountDownLatch(2);
        var executor=Executors.newFixedThreadPool(2);
        java.util.concurrent.Future<Integer> updateFuture=null,insertFuture=null;
        try{
            Map<String,Object> claimed=worker.dispatchCanary();
            assertEquals(1,number(claimed,"claimedCount"));
            assertTrue(registryLocksHeld.await(10,TimeUnit.SECONDS));
            updateFuture=executor.submit(()->updateTx.execute(status->{
                updateJdbc.execute("set local application_name='registry_lock_update'");
                mutationsStarted.countDown();
                return updateJdbc.update("""
                    update ui_component_registry set active_yn='N',updated_at=clock_timestamp()
                     where component_id='JSON_FORM' and active_yn='Y'
                    """);
            }));
            insertFuture=executor.submit(()->insertTx.execute(status->{
                insertJdbc.execute("set local application_name='registry_lock_insert'");
                mutationsStarted.countDown();
                return insertJdbc.update("""
                    insert into ui_component_registry(
                      component_id,component_name,component_type,owner_domain,
                      props_schema_json,default_props,category,active_yn)
                    values('UNRELATED_LOCK_WITNESS','Unrelated lock witness','DISPLAY',
                      'TEST','{}','{}','COMMON','Y')
                    """);
            }));
            assertTrue(mutationsStarted.await(5,TimeUnit.SECONDS));
            long waitDeadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(5);
            int blocked;
            do{
                blocked=jdbc.queryForObject("""
                    select count(*)::integer from pg_stat_activity
                     where application_name in('registry_lock_update','registry_lock_insert')
                       and wait_event_type='Lock'
                    """,Integer.class);
                if(blocked!=2)Thread.sleep(20);
            }while(blocked!=2&&System.nanoTime()<waitDeadline);
            assertEquals(2,blocked,"both direct registry DML transactions wait on worker SHARE locks");

            releaseWorker.countDown();
            assertEquals(1,updateFuture.get(20,TimeUnit.SECONDS));
            assertEquals(1,insertFuture.get(20,TimeUnit.SECONDS));
            awaitReceiptCompletion("SOURCE_APPLIED_PHYSICAL_QUEUED",30);
            awaitWorkerIdle(worker,5);
            long jobId=jdbc.queryForObject("""
                select job_id from integrated_design_autocompletion_receipt
                 where process_code='PROC'
                """,Long.class);
            assertEquals(baselineProcess,jdbc.queryForObject("""
                select dependency_fingerprint from integrated_design_autocompletion_receipt
                 where process_code='PROC' and job_id=?
                """,String.class,jobId));
            assertNotEquals(baselineProcess,jdbc.queryForObject(
                "select framework_composite_dependency_fingerprint('PROC')",String.class));
            assertNotEquals(baselineGlobal,currentCompositeSourceAuthorityHash());
            assertEquals(1,jdbc.update("""
                update ui_component_registry set active_yn='Y',updated_at=clock_timestamp()
                 where component_id='JSON_FORM' and active_yn='N'
                """));
            assertEquals(jdbc.queryForObject(
                "select framework_process_generation_input('PROC')->>'processInputHash'",
                String.class),jdbc.queryForObject("""
                select framework_try_jsonb(specification_json)->>'sourceHash'
                  from framework_development_job where job_id=?
                """,String.class,jobId));
            assertEquals(baselineProcess,jdbc.queryForObject(
                "select framework_composite_dependency_fingerprint('PROC')",String.class));
            assertEquals(baselineGlobal,currentCompositeSourceAuthorityHash(),
                "unreferenced concurrent insert does not change H0");
        }finally{
            releaseWorker.countDown();
            if(updateFuture!=null&&!updateFuture.isDone())updateFuture.cancel(true);
            if(insertFuture!=null&&!insertFuture.isDone())insertFuture.cancel(true);
            executor.shutdownNow();worker.close();resetAutocompletionGate();
        }
    }

    @Test
    void claimedSourceCanaryInvalidatesBeforeCompileOnProcessVersionH0Drift() throws Exception {
        seedCompositeThreeScreens();
        prepareCompositeReadinessBenchmarkDocuments();
        String originalVersion=jdbc.queryForObject("""
            select process_version from framework_process_definition where process_code='PROC'
            """,String.class);
        assertClaimedCanaryH0DriftInvalidatesWithoutCompilerWrites("PROCESS_VERSION",
            ()->assertEquals(1,jdbc.update("""
                update framework_process_definition set process_version='1.0.1'
                 where process_code='PROC'
                """)),
            ()->assertEquals(1,jdbc.update("""
                update framework_process_definition set process_version=?
                 where process_code='PROC'
                """,originalVersion)));
    }

    @Test
    void claimedSourceCanaryInvalidatesBeforeCompileOnReferencedRegistryH0Drift()
            throws Exception {
        seedCompositeThreeScreens();
        prepareCompositeReadinessBenchmarkDocuments();
        assertClaimedCanaryH0DriftInvalidatesWithoutCompilerWrites("JSON_FORM_REGISTRY",
            ()->assertEquals(1,jdbc.update("""
                update ui_component_registry set active_yn='N'
                 where component_id='JSON_FORM' and active_yn='Y'
                """)),
            ()->assertEquals(1,jdbc.update("""
                update ui_component_registry set active_yn='Y'
                 where component_id='JSON_FORM' and active_yn='N'
                """)));
    }

    @Test
    void compositeH0TracksOnlyReferencedRegistrySemanticAndActiveState(){
        seedCompositeThreeScreens();
        prepareMachineOwnedCompositeReadinessDocuments();
        assertEquals(1,jdbc.update("""
            insert into integrated_design_notification_template(
              template_code,title_template,message_template,active_yn,updated_by)
            values('PROC_NOTICE','Process notice','Process notice body','Y','POSTGRES_TEST')
            """));
        assertEquals(1,jdbc.update("""
            update integrated_design_document
               set content=jsonb_set(content::jsonb,'{payload,events}',
                 '[{"eventCode":"PROC_NOTICE","templateCode":"PROC_NOTICE"}]'::jsonb)::text
             where document_id=(select document_id from integrated_design_document
               where process_code='PROC' and document_type='NOTIFICATION'
               order by document_id limit 1)
            """));
        String baseline=jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class);
        assertEquals(1,jdbc.update("""
            update comtnthemedefinition
               set updt_pnttm=clock_timestamp(),updt_user_id='AUDIT_ONLY'
             where theme_id='KRDS_GOV_DEFAULT'
            """));
        assertEquals(1,jdbc.update("""
            update ui_section_registry set updated_at=clock_timestamp()
             where section_id='MAIN'
            """));
        assertEquals(1,jdbc.update("""
            update ui_component_registry set updated_at=clock_timestamp()
             where component_id='JSON_FORM'
            """));
        assertEquals(1,jdbc.update("""
            update integrated_design_notification_template
               set updated_at=clock_timestamp(),updated_by='AUDIT_ONLY'
             where template_code='PROC_NOTICE'
            """));
        assertEquals(baseline,jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class),
            "referenced registry audit metadata is outside H0 semantics");
        assertEquals(1,jdbc.update("""
            insert into comtnthemedefinition(theme_id,theme_nm,use_at,is_active)
            values('UNUSED_THEME','Unused theme','Y','Y')
            """));
        assertEquals(1,jdbc.update("""
            insert into ui_section_registry(section_id,section_name,section_type,
              layout_contract,responsive_contract,accessibility_contract,active_yn)
            values('UNUSED_SECTION','Unused section','FORM','{}','{}','{}','Y')
            """));
        assertEquals(1,jdbc.update("""
            insert into ui_component_registry(
              component_id,component_name,component_type,owner_domain,active_yn)
            values('UNUSED_COMPONENT','Unused component','BUTTON','UNRELATED','Y')
            """));
        assertEquals(1,jdbc.update("""
            insert into integrated_design_notification_template(
              template_code,title_template,message_template,active_yn,updated_by)
            values('UNUSED_NOTICE','Unused notice','Unused body','Y','POSTGRES_TEST')
            """));
        assertEquals(baseline,jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class));
        assertEquals(1,jdbc.update("""
            update comtnthemedefinition
               set theme_nm='Unused theme changed',is_active='N'
             where theme_id='UNUSED_THEME'
            """));
        assertEquals(1,jdbc.update("""
            update ui_section_registry
               set section_name='Unused section changed',active_yn='N'
             where section_id='UNUSED_SECTION'
            """));
        assertEquals(1,jdbc.update("""
            update ui_component_registry
               set component_name='Unused component changed',active_yn='N'
             where component_id='UNUSED_COMPONENT'
            """));
        assertEquals(1,jdbc.update("""
            update integrated_design_notification_template
               set title_template='Unused notice changed',active_yn='N'
             where template_code='UNUSED_NOTICE'
            """));
        assertEquals(baseline,jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class));

        assertEquals(1,jdbc.update("""
            update comtnthemedefinition set theme_nm='KRDS semantic revision'
             where theme_id='KRDS_GOV_DEFAULT'
            """));
        assertNotEquals(baseline,jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class));
        assertEquals(1,jdbc.update("""
            update comtnthemedefinition set theme_nm='KRDS'
             where theme_id='KRDS_GOV_DEFAULT'
            """));
        assertEquals(baseline,jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class));
        assertEquals(1,jdbc.update("""
            update comtnthemedefinition set is_active='N'
             where theme_id='KRDS_GOV_DEFAULT'
            """));
        assertNotEquals(baseline,jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class));
        assertEquals(1,jdbc.update("""
            update comtnthemedefinition set is_active='Y'
             where theme_id='KRDS_GOV_DEFAULT'
            """));
        assertEquals(baseline,jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class));

        assertEquals(1,jdbc.update("""
            update ui_section_registry set section_name='Main semantic revision'
             where section_id='MAIN'
            """));
        assertNotEquals(baseline,jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class));
        assertEquals(1,jdbc.update("""
            update ui_section_registry set section_name='Main' where section_id='MAIN'
            """));
        assertEquals(baseline,jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class));
        assertEquals(1,jdbc.update("""
            update ui_section_registry set active_yn='N' where section_id='MAIN'
            """));
        assertNotEquals(baseline,jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class));
        assertEquals(1,jdbc.update("""
            update ui_section_registry set active_yn='Y' where section_id='MAIN'
            """));
        assertEquals(baseline,jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class));

        assertEquals(1,jdbc.update("""
            update ui_component_registry set component_name='JSON Form semantic revision'
             where component_id='JSON_FORM'
            """));
        assertNotEquals(baseline,jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class));
        assertEquals(1,jdbc.update("""
            update ui_component_registry set component_name='JSON Form'
             where component_id='JSON_FORM'
            """));
        assertEquals(baseline,jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class));
        assertEquals(1,jdbc.update("""
            update ui_component_registry set active_yn='N' where component_id='JSON_FORM'
            """));
        assertNotEquals(baseline,jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class));
        assertEquals(1,jdbc.update("""
            update ui_component_registry set active_yn='Y' where component_id='JSON_FORM'
            """));
        assertEquals(baseline,jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class));

        assertEquals(1,jdbc.update("""
            update integrated_design_notification_template
               set title_template='Process notice semantic revision'
             where template_code='PROC_NOTICE'
            """));
        assertNotEquals(baseline,jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class));
        assertEquals(1,jdbc.update("""
            update integrated_design_notification_template
               set title_template='Process notice'
             where template_code='PROC_NOTICE'
            """));
        assertEquals(baseline,jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class));
        assertEquals(1,jdbc.update("""
            update integrated_design_notification_template set active_yn='N'
             where template_code='PROC_NOTICE'
            """));
        assertNotEquals(baseline,jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class));
        assertEquals(1,jdbc.update("""
            update integrated_design_notification_template set active_yn='Y'
             where template_code='PROC_NOTICE'
            """));
        assertEquals(baseline,jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class));
    }

    @Test
    void physicalOnlyCanaryRearmRejectsSameCommitPartialTerminalAndH0Drift(){
        seedCompositeThreeScreens();
        try{
            PhysicalRearmCampaign sameCommit=installPhysicalRearmCampaign(
                "a".repeat(40),"a".repeat(40),"PHYSICAL_GENERATED_VERIFIED");
            assertEquals(0,rearmPhysicalCampaign(sameCommit).size(),"same runtime commit");
            assertEquals("PHYSICAL_GENERATED_VERIFIED",jdbc.queryForObject("""
                select completion_status from integrated_design_autocompletion_receipt
                 where process_code='PROC'
                """,String.class));
            clearPhysicalRearmCampaign(sameCommit);

            PhysicalRearmCampaign partial=installPhysicalRearmCampaign(
                "a".repeat(40),"c".repeat(40),"BLOCKED");
            assertEquals(0,rearmPhysicalCampaign(partial).size(),"partial terminal campaign");
            assertEquals("BLOCKED",jdbc.queryForObject("""
                select completion_status from integrated_design_autocompletion_receipt
                 where process_code='PROC'
                """,String.class));
            clearPhysicalRearmCampaign(partial);

            PhysicalRearmCampaign drifted=installPhysicalRearmCampaign(
                "a".repeat(40),"c".repeat(40),"PHYSICAL_GENERATED_VERIFIED");
            jdbc.update("update framework_process_definition set process_version='1.0.1' "+
                "where process_code='PROC'");
            String changed=currentCompositeSourceAuthorityHash();
            assertNotEquals(drifted.sourceHash(),changed);
            CompositeAutocompletionReadinessService readiness=readinessFor(drifted);
            try{
                assertEquals(0,transaction.execute(status->readiness.rearmPhysicalCanary(
                    UUID.randomUUID().toString(),drifted.newCommit(),changed,1)).size(),"H0 drift");
            }finally{readiness.close();}
            assertEquals("PHYSICAL_GENERATED_VERIFIED",jdbc.queryForObject("""
                select completion_status from integrated_design_autocompletion_receipt
                 where process_code='PROC'
                """,String.class));
            clearPhysicalRearmCampaign(drifted);
        }finally{resetAutocompletionGate();}
    }

    @Test
    void physicalOnlyCanaryActualPostgresRetriesExactlyThreeTimesWithOneJob(){
        seedCompositeThreeScreens();
        PhysicalRearmCampaign campaign=installPhysicalRearmCampaign(
            "a".repeat(40),"c".repeat(40),"PHYSICAL_GENERATED_VERIFIED");
        CompositeAutocompletionReadinessService readiness=readinessFor(campaign);
        String jobXmin=jdbc.queryForObject(
            "select xmin::text from framework_development_job where job_id=?",
            String.class,campaign.jobId());
        try{
            for(int expectedAttempt=1;expectedAttempt<=3;expectedAttempt++){
                int attempt=transaction.execute(status->{
                    readiness.acquireGlobalDispatchLock(910_881_003L);
                    return readiness.nextCanaryAttempt(
                        campaign.newCommit(),campaign.sourceHash());
                });
                assertEquals(expectedAttempt,attempt);
                List<Map<String,Object>> rearmed=transaction.execute(status->{
                    readiness.acquireGlobalDispatchLock(910_881_003L);
                    return readiness.rearmPhysicalCanary(UUID.randomUUID().toString(),
                        campaign.newCommit(),campaign.sourceHash(),attempt);
                });
                assertEquals(1,rearmed.size());
                assertEquals(campaign.jobId(),((Number)rearmed.get(0).get("jobId")).longValue());
                assertEquals("0",jdbc.queryForObject("""
                    select receipt_json#>>'{canary,sourceWriteCount}'
                      from integrated_design_autocompletion_receipt where process_code='PROC'
                    """,String.class));
                if(expectedAttempt<3)jdbc.update("""
                    update integrated_design_autocompletion_receipt
                       set started_at=current_timestamp-interval '1 day'
                     where process_code='PROC'
                    """);
            }
            jdbc.update("""
                update integrated_design_autocompletion_receipt
                   set started_at=current_timestamp-interval '1 day'
                 where process_code='PROC'
                """);
            assertThrows(IllegalStateException.class,()->transaction.execute(status->{
                readiness.acquireGlobalDispatchLock(910_881_003L);
                return readiness.nextCanaryAttempt(
                    campaign.newCommit(),campaign.sourceHash());
            }));
            assertEquals("3",jdbc.queryForObject("""
                select receipt_json#>>'{canary,attemptNumber}'
                  from integrated_design_autocompletion_receipt where process_code='PROC'
                """,String.class));
            assertEquals(campaign.jobId(),jdbc.queryForObject("""
                select job_id from integrated_design_autocompletion_receipt
                 where process_code='PROC'
                """,Long.class));
            assertEquals(7,jdbc.queryForObject("""
                select attempt_count from integrated_design_autocompletion_receipt
                 where process_code='PROC'
                """,Integer.class));
            assertEquals(jobXmin,jdbc.queryForObject(
                "select xmin::text from framework_development_job where job_id=?",
                String.class,campaign.jobId()));
        }finally{
            readiness.close();clearPhysicalRearmCampaign(campaign);
        }
    }

    @Test
    void twoPostgresTransactionsRearmExactlyOnePhysicalCanary() throws Exception {
        seedCompositeThreeScreens();
        PhysicalRearmCampaign campaign=installPhysicalRearmCampaign(
            "a".repeat(40),"c".repeat(40),"PHYSICAL_GENERATED_VERIFIED");
        JdbcTemplate leftJdbc=new JdbcTemplate(dataSource);
        JdbcTemplate rightJdbc=new JdbcTemplate(dataSource);
        DataSourceTransactionManager leftManager=new DataSourceTransactionManager(dataSource);
        DataSourceTransactionManager rightManager=new DataSourceTransactionManager(dataSource);
        TransactionTemplate leftTransaction=new TransactionTemplate(leftManager);
        TransactionTemplate rightTransaction=new TransactionTemplate(rightManager);
        CompositeAutocompletionReadinessService left=
            new CompositeAutocompletionReadinessService(leftJdbc,service,leftManager,
                8,8,2,campaign.newCommit(),"","");
        CompositeAutocompletionReadinessService right=
            new CompositeAutocompletionReadinessService(rightJdbc,service,rightManager,
                8,8,2,campaign.newCommit(),"","");
        CountDownLatch ready=new CountDownLatch(2),start=new CountDownLatch(1);
        var callers=Executors.newFixedThreadPool(2);
        try{
            var first=callers.submit(()->{
                ready.countDown();start.await(5,TimeUnit.SECONDS);
                try{return leftTransaction.execute(status->{
                    left.acquireGlobalDispatchLock(0x434f4d504155544fL);
                    int attempt=left.nextCanaryAttempt(
                        campaign.newCommit(),campaign.sourceHash());
                    return left.rearmPhysicalCanary(UUID.randomUUID().toString(),
                        campaign.newCommit(),campaign.sourceHash(),attempt).size();
                });}catch(IllegalStateException duplicate){return 0;}
            });
            var second=callers.submit(()->{
                ready.countDown();start.await(5,TimeUnit.SECONDS);
                try{return rightTransaction.execute(status->{
                    right.acquireGlobalDispatchLock(0x434f4d504155544fL);
                    int attempt=right.nextCanaryAttempt(
                        campaign.newCommit(),campaign.sourceHash());
                    return right.rearmPhysicalCanary(UUID.randomUUID().toString(),
                        campaign.newCommit(),campaign.sourceHash(),attempt).size();
                });}catch(IllegalStateException duplicate){return 0;}
            });
            assertTrue(ready.await(5,TimeUnit.SECONDS));start.countDown();
            assertEquals(1,first.get(20,TimeUnit.SECONDS)+second.get(20,TimeUnit.SECONDS));
            assertEquals(1,jdbc.queryForObject("""
                select count(*) from integrated_design_autocompletion_receipt
                 where receipt_json#>>'{canary,status}'='ACTIVE'
                   and receipt_json#>>'{canary,runtimeCommit}'=?
                """,Integer.class,campaign.newCommit()));
            assertEquals("0",jdbc.queryForObject("""
                select receipt_json->>'sourceWriteCount'
                  from integrated_design_autocompletion_receipt where process_code='PROC'
                """,String.class));
            assertEquals(campaign.jobId(),jdbc.queryForObject("""
                select job_id from integrated_design_autocompletion_receipt
                 where process_code='PROC'
                """,Long.class));
        }finally{
            callers.shutdownNow();left.close();right.close();
            clearPhysicalRearmCampaign(campaign);
        }
    }

    private List<Map<String,Object>> rearmPhysicalCampaign(PhysicalRearmCampaign campaign){
        CompositeAutocompletionReadinessService readiness=readinessFor(campaign);
        try{return transaction.execute(status->{
            readiness.acquireGlobalDispatchLock(910_881_003L);
            return readiness.rearmPhysicalCanary(UUID.randomUUID().toString(),
                campaign.newCommit(),campaign.sourceHash(),1);
        });}finally{readiness.close();}
    }

    private void awaitReceiptCompletion(String expected,int seconds){
        long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(seconds);
        String completion;
        do{
            completion=jdbc.queryForObject("""
                select completion_status from integrated_design_autocompletion_receipt
                 where process_code='PROC'
                """,String.class);
            if(!expected.equals(completion))try{Thread.sleep(25);}
            catch(InterruptedException error){
                Thread.currentThread().interrupt();throw new IllegalStateException(error);
            }
        }while(!expected.equals(completion)&&System.nanoTime()<deadline);
        assertEquals(expected,completion);
    }

    private void assertSerializationRetryWait(int expectedRetryAttempt,int expectedClaimAttempt,
            int expectedDelayMs,String expectedFingerprint,int seconds){
        long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(seconds);
        Map<String,Object> receipt;
        do{
            receipt=jdbc.queryForMap("""
                select completion_status as "completionStatus",attempt_count as "attemptCount",
                       blocker_code as "blockerCode",lease_token::text as "leaseToken",
                       lease_until as "leaseUntil",job_id as "jobId",
                       receipt_json->>'sourceCommitted' as "sourceCommitted",
                       receipt_json->>'jobCount' as "jobCount",
                       receipt_json->>'blocker' as "jsonBlocker",
                       receipt_json->>'generationStatus' as "generationStatus",
                       receipt_json->>'serializationRetryAttempt' as "retryAttempt",
                       receipt_json->>'serializationRetryLimit' as "retryLimit",
                       receipt_json#>>'{serializationRetryContext,mode}' as "retryMode",
                       receipt_json->>'retryDelayMs' as "retryDelayMs",
                       receipt_json->>'retryNotBeforeEpochMs' as "retryNotBeforeEpochMs",
                       dependency_fingerprint as "dependencyFingerprint"
                  from integrated_design_autocompletion_receipt where process_code='PROC'
                """);
            if(!("PENDING".equals(receipt.get("completionStatus"))
                    &&Integer.toString(expectedRetryAttempt).equals(receipt.get("retryAttempt"))))
                try{Thread.sleep(20);}
                catch(InterruptedException error){
                    Thread.currentThread().interrupt();throw new IllegalStateException(error);
                }
        }while(!("PENDING".equals(receipt.get("completionStatus"))
                &&Integer.toString(expectedRetryAttempt).equals(receipt.get("retryAttempt")))
                &&System.nanoTime()<deadline);
        assertEquals("PENDING",receipt.get("completionStatus"));
        assertEquals(expectedClaimAttempt,((Number)receipt.get("attemptCount")).intValue());
        assertEquals("RETRY_WAIT",receipt.get("blockerCode"));
        assertNull(receipt.get("leaseToken"));assertNull(receipt.get("leaseUntil"));
        assertNull(receipt.get("jobId"));
        assertEquals("false",receipt.get("sourceCommitted"));
        assertEquals("0",receipt.get("jobCount"));
        assertEquals("SERIALIZATION_RETRY",receipt.get("jsonBlocker"));
        assertEquals("SERIALIZATION_RETRY_WAIT",receipt.get("generationStatus"));
        assertEquals(Integer.toString(expectedRetryAttempt),receipt.get("retryAttempt"));
        assertEquals("3",receipt.get("retryLimit"));
        assertEquals("MANUAL",receipt.get("retryMode"));
        assertEquals(Integer.toString(expectedDelayMs),receipt.get("retryDelayMs"));
        assertTrue(String.valueOf(receipt.get("retryNotBeforeEpochMs")).matches("[0-9]{10,20}"));
        assertEquals(expectedFingerprint,receipt.get("dependencyFingerprint"));
        assertEquals(expectedFingerprint,jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class));
        assertEquals(0,serializationRetrySourceCount());
        assertEquals(0,serializationRetryRegistryCount());
        assertEquals(0,serializationRetryJobCount());
    }

    private int serializationRetrySourceCount(){
        return jdbc.queryForObject("""
            select count(*) from framework_process_artifact
             where process_code='PROC' and artifact_code='SERIALIZATION_RETRY_SOURCE'
            """,Integer.class);
    }

    private int serializationRetryRegistryCount(){
        return jdbc.queryForObject("""
            select count(*) from framework_design_asset_registry
             where design_asset_id='SERIALIZATION_RETRY_REGISTRY'
            """,Integer.class);
    }

    private int serializationRetryJobCount(){
        return jdbc.queryForObject("""
            select count(*) from framework_development_job
             where process_code='PROC' and job_name='Serialization retry job'
            """,Integer.class);
    }

    private PostgresAdvisoryTransaction holdPostgresAdvisoryTransaction(long key)
            throws Exception {
        java.sql.Connection connection=dataSource.getConnection();
        try{
            connection.setAutoCommit(false);
            int backendPid;
            try(java.sql.PreparedStatement statement=connection.prepareStatement(
                    "select pg_backend_pid()")){
                try(java.sql.ResultSet rows=statement.executeQuery()){
                    if(!rows.next())throw new IllegalStateException("POSTGRES_BACKEND_PID_MISSING");
                    backendPid=rows.getInt(1);
                }
            }
            try(java.sql.PreparedStatement statement=connection.prepareStatement(
                    "select pg_advisory_xact_lock(?)")){
                statement.setLong(1,key);statement.execute();
            }
            return new PostgresAdvisoryTransaction(connection,backendPid);
        }catch(Exception error){
            try{connection.rollback();}finally{connection.close();}
            throw error;
        }
    }

    private final class PostgresAdvisoryTransaction implements AutoCloseable {
        private java.sql.Connection connection;
        private final int backendPid;

        private PostgresAdvisoryTransaction(java.sql.Connection connection,int backendPid){
            this.connection=connection;this.backendPid=backendPid;
        }

        @Override public void close() throws Exception {
            if(connection==null)return;
            java.sql.Connection open=connection;connection=null;
            try{open.rollback();}finally{open.close();}
            long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(2);
            int sessions;
            do{
                sessions=admin.queryForObject(
                    "select count(*) from pg_stat_activity where pid=?",Integer.class,backendPid);
                if(sessions!=0)Thread.sleep(10);
            }while(sessions!=0&&System.nanoTime()<deadline);
            assertEquals(0,sessions,"advisory holder backend residue: "+backendPid);
        }
    }

    private void awaitWorkerIdle(CompositeDesignOperationalWorker worker,int seconds){
        long deadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(seconds);
        int active;
        do{
            active=number(worker.inspect(),"activeWorkerCount");
            if(active!=0)try{Thread.sleep(25);}
            catch(InterruptedException error){
                Thread.currentThread().interrupt();throw new IllegalStateException(error);
            }
        }while(active!=0&&System.nanoTime()<deadline);
        assertEquals(0,active);
    }

    private long insertVerifiedCanaryBindingJob(String process){
        return jdbc.queryForObject("""
            insert into framework_development_job(
              process_code,step_code,job_type,job_name,target_path,specification_json,
              job_status,approval_status,execution_mode,job_group_code,required,
              progress_weight,max_attempts,quality_status,created_by,result_json,
              completed_at)
            values(?,'STEP','FULL_STACK_GENERATION','Verified dispatch binding fixture',
              '/tmp/verified-dispatch-binding',jsonb_build_object('processInputHash',
                framework_composite_dependency_fingerprint(?))::text,
              'VERIFIED','APPROVED','AUTOMATED',
              ?||'_CANONICAL_PUBLICATION',true,1,3,'VERIFIED','POSTGRES_TEST','{}',
              clock_timestamp())
            returning job_id
            """,Long.class,process,process,process);
    }

    private void activateLegacyGateForPhysicalRetry(String commit,String sourceHash,
            long jobId,String candidate){
        resetAutocompletionGate();
        jdbc.update("""
            insert into framework_postdeploy_release_attempt(
              candidate_id,source_commit,attempt_status,terminal_reason,terminal_at)
            values(?,?,'PROMOTED','PROMOTION_COMMITTED',clock_timestamp())
            """,candidate,commit);
        assertEquals(1,jdbc.update("""
            update integrated_design_autocompletion_gate
               set approval_status='ACTIVE',runtime_commit=?,postdeploy_candidate_id=?,
                   source_input_authority_hash=?,final_authority_hash=repeat('f',64),
                   canary_process_code='PROC',canary_job_id=?,revision=revision+1,
                   approved_by='POSTGRES_TEST',
                   approved_at=clock_timestamp()-interval '1 second',
                   activated_by='POSTGRES_TEST',activated_at=clock_timestamp(),
                   revoked_by=null,revoked_at=null,revoke_reason=null,
                   updated_at=clock_timestamp()
             where gate_key='GLOBAL'
            """,commit,candidate,sourceHash,jobId));
    }

    private long insertMismatchedVerifiedDispatch(long correctJob,long wrongJob,
            String process,String variant,String commit,String oldCommit,
            String runtimeIdentity){
        long dispatchJob="JOB".equals(variant)?wrongJob:correctJob;
        String dispatchProcess="PROCESS".equals(variant)?"WRONG_PROCESS":process;
        String dispatchCommit="COMMIT".equals(variant)?oldCommit:commit;
        String identity="IDENTITY".equals(variant)?"e".repeat(64):runtimeIdentity;
        String status="STATUS".equals(variant)?"SUPERSEDED":"COMPLETED";
        int attempt="ATTEMPT".equals(variant)?2:1;
        String revision="REVISION".equals(variant)?"e".repeat(64):
            jdbc.queryForObject("select framework_composite_authority_revision_set_hash(?)",
                String.class,dispatchJob);
        String artifact="ARTIFACT".equals(variant)?"e".repeat(64):"d".repeat(64);
        String source="SOURCE".equals(variant)?"e".repeat(64):
            jdbc.queryForObject("select framework_composite_dependency_fingerprint(?)",
                String.class,process);
        jdbc.update("""
            update framework_development_job
               set result_json=jsonb_build_object('canonicalGeneration',jsonb_build_object(
                 'compositeArtifactManifestHash',repeat('d',64)))::text
             where job_id=?
            """,dispatchJob);
        return jdbc.queryForObject("""
            insert into integrated_design_live_smoke_dispatch(
              job_id,process_code,project_id,runtime_commit,runtime_identity_hash,
              canary_attempt,authority_revision_set_hash,artifact_manifest_hash,
              process_source_hash,expected_evidence_count,submitted_evidence_count,
              status,attempt_count,completed_at)
            values(?,?,'*',?,?,?,?,
              ?,?,1,1,?,0,
              clock_timestamp())
            returning dispatch_id
            """,Long.class,dispatchJob,dispatchProcess,dispatchCommit,identity,attempt,
            revision,artifact,source,status);
    }

    private void assertClaimedCanaryH0DriftInvalidatesWithoutCompilerWrites(
            String witness,Runnable drift,Runnable restore) throws Exception {
        String commit="c".repeat(40);
        assertEquals(1,jdbc.update("""
            update framework_runtime_release_state
               set source_commit=?,deployment_uid=?,deployment_generation=2,
                   observed_generation=2,image_ref='carbonet-runtime:canary-race',
                   health_status='UP',recorded_at=clock_timestamp()
             where release_key='CARBONET_RUNTIME'
            """,commit,"runtime-canary-race-"+UUID.randomUUID()));
        String baselineProcessHash=jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class);
        String baselineGlobalHash=currentCompositeSourceAuthorityHash();
        DataSourceTransactionManager manager=new DataSourceTransactionManager(dataSource);
        CompositeAutocompletionReadinessService readiness=
            new CompositeAutocompletionReadinessService(jdbc,service,manager,
                8,8,2,commit,"","");
        CompositeDesignOperationalWorker worker=new CompositeDesignOperationalWorker(
            jdbc,new ObjectMapper(),service,readiness,manager,true,2,25,false,600,30);
        JdbcTemplate lockJdbc=new JdbcTemplate(dataSource);
        TransactionTemplate lockTransaction=
            new TransactionTemplate(new DataSourceTransactionManager(dataSource));
        CountDownLatch locksHeld=new CountDownLatch(1),releaseLocks=new CountDownLatch(1);
        var executor=Executors.newSingleThreadExecutor();
        var lockFuture=executor.submit(()->lockTransaction.executeWithoutResult(status->{
            lockJdbc.queryForList("select pg_advisory_xact_lock(?)",0x434f4d50534c4f50L);
            lockJdbc.queryForList("select pg_advisory_xact_lock(?)",0x434f4d50534c4f51L);
            locksHeld.countDown();
            try{
                if(!releaseLocks.await(20,TimeUnit.SECONDS))
                    throw new IllegalStateException("CANARY_SOURCE_SLOT_RELEASE_TIMEOUT");
            }catch(InterruptedException error){
                Thread.currentThread().interrupt();
                throw new IllegalStateException(error);
            }
        }));
        try{
            assertTrue(locksHeld.await(5,TimeUnit.SECONDS),witness+" source slots held");
            CompositeAutocompletionReadinessService.Snapshot initial=
                readiness.snapshot(true,0);
            assertEquals(Set.of("PROC"),initial.readyProcesses().keySet(),
                witness+" compiler-ready candidates: "+initial.report());
            Map<String,Object> first=worker.dispatchCanary();
            assertEquals(1,number(first,"claimedCount"),witness+" first claim");
            assertEquals(1,number(first,"activeWorkerCount"),witness+" worker paused");
            assertEquals(1,number(first,"canaryAttempt"),witness+" first attempt");
            Map<String,Object> claimed=jdbc.queryForMap("""
                select completion_status as "completionStatus",attempt_count as "attemptCount",
                       lease_token::text as "leaseToken",
                       receipt_json#>>'{canary,canaryId}' as "canaryId",
                       receipt_json#>>'{canary,attemptNumber}' as "canaryAttempt",
                       receipt_json#>>'{canary,requestedSourceAuthorityHash}' as "globalHash",
                       receipt_json#>>'{canary,requestedSourceDependencyHash}' as "processHash"
                  from integrated_design_autocompletion_receipt where process_code='PROC'
                """);
            assertEquals("RUNNING",claimed.get("completionStatus"));
            assertNotEquals(null,claimed.get("leaseToken"));
            assertEquals("1",claimed.get("canaryAttempt"));
            assertEquals(baselineGlobalHash,claimed.get("globalHash"));
            assertEquals(baselineProcessHash,claimed.get("processHash"));

            transaction.executeWithoutResult(status->drift.run());
            String driftedHash=jdbc.queryForObject(
                "select framework_composite_dependency_fingerprint('PROC')",String.class);
            assertNotEquals(baselineProcessHash,driftedHash,witness+" changes H0");
            Map<String,Object> sourceAfterDrift=sourceWitnessXmins();
            Map<String,Object> publicationAfterDrift=compositePublicationXmins();
            int jobsAfterDrift=count("framework_development_job");
            int eventsAfterDrift=count("framework_development_job_event");
            int documentsAfterDrift=count("integrated_design_document");
            int versionsAfterDrift=count("integrated_design_document_version");
            int artifactsAfterDrift=count("framework_process_artifact");

            releaseLocks.countDown();
            lockFuture.get(5,TimeUnit.SECONDS);
            long invalidationDeadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(10);
            String completion;
            do{
                completion=jdbc.queryForObject("""
                    select completion_status from integrated_design_autocompletion_receipt
                     where process_code='PROC'
                    """,String.class);
                if(!"PENDING".equals(completion))Thread.sleep(20);
            }while(!"PENDING".equals(completion)&&System.nanoTime()<invalidationDeadline);
            assertEquals("PENDING",completion,witness+" requeued before compiler");
            Map<String,Object> invalidated=jdbc.queryForMap("""
                select completion_status as "completionStatus",job_id as "jobId",
                       lease_token::text as "leaseToken",lease_until as "leaseUntil",
                       receipt_json->>'generationStatus' as "generationStatus",
                       receipt_json->>'sourceCommitted' as "sourceCommitted",
                       receipt_json->>'jobCount' as "jobCount",
                       receipt_json#>>'{canary,canaryId}' as "canaryId",
                       receipt_json#>>'{canary,status}' as "canaryStatus",
                       receipt_json#>>'{canary,attemptNumber}' as "canaryAttempt",
                       receipt_json#>>'{canary,failureCode}' as "failureCode"
                  from integrated_design_autocompletion_receipt where process_code='PROC'
                """);
            assertNull(invalidated.get("jobId"));
            assertNull(invalidated.get("leaseToken"));
            assertNull(invalidated.get("leaseUntil"));
            assertEquals("CANARY_SOURCE_BINDING_CHANGED_REQUEUE",
                invalidated.get("generationStatus"));
            assertEquals("false",invalidated.get("sourceCommitted"));
            assertEquals("0",invalidated.get("jobCount"));
            assertEquals(claimed.get("canaryId"),invalidated.get("canaryId"));
            assertEquals("INVALIDATED",invalidated.get("canaryStatus"));
            assertEquals("1",invalidated.get("canaryAttempt"));
            assertEquals("SOURCE_OR_RUNTIME_BINDING_CHANGED",invalidated.get("failureCode"));
            assertEquals(sourceAfterDrift,sourceWitnessXmins(),witness+" source xmin write zero");
            assertEquals(publicationAfterDrift,compositePublicationXmins(),
                witness+" compiler publication xmin write zero");
            assertEquals(jobsAfterDrift,count("framework_development_job"));
            assertEquals(eventsAfterDrift,count("framework_development_job_event"));
            assertEquals(documentsAfterDrift,count("integrated_design_document"));
            assertEquals(versionsAfterDrift,count("integrated_design_document_version"));
            assertEquals(artifactsAfterDrift,count("framework_process_artifact"));

            long idleDeadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(5);
            while(number(worker.inspect(),"activeWorkerCount")!=0
                    &&System.nanoTime()<idleDeadline)Thread.sleep(20);
            assertEquals(0,number(worker.inspect(),"activeWorkerCount"));
            transaction.executeWithoutResult(status->restore.run());
            assertEquals(baselineProcessHash,jdbc.queryForObject(
                "select framework_composite_dependency_fingerprint('PROC')",String.class));
            assertEquals(baselineGlobalHash,currentCompositeSourceAuthorityHash());

            Map<String,Object> retried=worker.dispatchCanary();
            assertEquals(1,number(retried,"claimedCount"),witness+" retry claim");
            assertEquals(2,number(retried,"canaryAttempt"),witness+" retry attempt");
            long compileDeadline=System.nanoTime()+TimeUnit.SECONDS.toNanos(30);
            do{
                completion=jdbc.queryForObject("""
                    select completion_status from integrated_design_autocompletion_receipt
                     where process_code='PROC'
                    """,String.class);
                if(!"SOURCE_APPLIED_PHYSICAL_QUEUED".equals(completion))Thread.sleep(25);
            }while(!"SOURCE_APPLIED_PHYSICAL_QUEUED".equals(completion)
                &&System.nanoTime()<compileDeadline);
            assertEquals("SOURCE_APPLIED_PHYSICAL_QUEUED",completion,
                witness+" restored H0 compiles on next attempt");
            Map<String,Object> compiled=jdbc.queryForMap("""
                select job_id as "jobId",lease_token::text as "leaseToken",
                       lease_until as "leaseUntil",
                       receipt_json#>>'{canary,status}' as "canaryStatus",
                       receipt_json#>>'{canary,attemptNumber}' as "canaryAttempt"
                  from integrated_design_autocompletion_receipt where process_code='PROC'
                """);
            assertNotEquals(null,compiled.get("jobId"));
            assertNull(compiled.get("leaseToken"));
            assertNull(compiled.get("leaseUntil"));
            assertEquals("ACTIVE",compiled.get("canaryStatus"));
            assertEquals("2",compiled.get("canaryAttempt"));
            assertEquals(jobsAfterDrift+1,count("framework_development_job"));
        }finally{
            releaseLocks.countDown();
            if(!lockFuture.isDone())lockFuture.cancel(true);
            executor.shutdownNow();
            worker.close();
        }
    }

    private Map<String,Object> sourceWitnessXmins(){
        return jdbc.queryForMap("""
            select (select xmin::text from framework_process_definition
                     where process_code='PROC') as process,
                   (select xmin::text from ui_component_registry
                     where component_id='JSON_FORM') as component,
                   (select xmin::text from framework_step_execution_spec
                     where process_code='PROC' and step_code='STEP') as execution_spec
            """);
    }

    private CompositeAutocompletionReadinessService readinessFor(
            PhysicalRearmCampaign campaign){
        return new CompositeAutocompletionReadinessService(jdbc,service,
            new DataSourceTransactionManager(dataSource),8,8,2,campaign.newCommit(),"","");
    }

    private PhysicalRearmCampaign installPhysicalRearmCampaign(
            String oldCommit,String newCommit,String receiptStatus){
        resetAutocompletionGate();
        String sourceHash=currentCompositeSourceAuthorityHash();
        String processHash=jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class);
        long jobId=jdbc.queryForObject("""
            insert into framework_development_job(
              process_code,step_code,job_type,job_name,target_path,specification_json,
              job_status,approval_status,execution_mode,job_group_code,required,
              progress_weight,max_attempts,quality_status,created_by,result_json)
            values('PROC','STEP','FULL_STACK_GENERATION','Physical revalidation fixture',
              '/tmp/physical-revalidation','{}','VERIFIED','APPROVED','AUTOMATED',
              'PROC_CANONICAL_PUBLICATION',true,1,3,'VERIFIED','POSTGRES_TEST','{}')
            returning job_id
            """,Long.class);
        String candidate="postdeploy:physical:"+
            UUID.randomUUID().toString().replace("-","");
        jdbc.update("""
            insert into framework_postdeploy_release_attempt(
              candidate_id,source_commit,attempt_status,terminal_reason,terminal_at)
            values(?,?,'PROMOTED','PROMOTION_COMMITTED',clock_timestamp())
            """,candidate,oldCommit);
        jdbc.update("""
            update framework_runtime_release_state
               set source_commit=?,deployment_generation=deployment_generation+1,
                   observed_generation=observed_generation+1,
                   image_ref='carbonet-runtime:'||?,image_id='sha256:'||repeat('c',64),
                   health_status='UP',recorded_at=clock_timestamp()
             where release_key='CARBONET_RUNTIME'
            """,newCommit,newCommit.substring(0,12));
        jdbc.update("""
            insert into integrated_design_autocompletion_receipt(
              process_code,completion_status,attempt_count,job_id,receipt_json,
              dependency_fingerprint,started_at,completed_at,duration_ms)
            values('PROC',?,7,?,jsonb_build_object(
              'sourceInputDependencyHash',?,'generationStatus','PHYSICAL_GENERATED_VERIFIED',
              'physicalVerified',true,'sourceWriteCount',1,
              'canary',jsonb_build_object('canaryId',?,'status','VERIFIED',
                'attemptNumber',1,'runtimeCommit',?,
                'requestedSourceAuthorityHash',?,
                'requestedSourceDependencyHash',?,
                'verifiedFinalAuthorityHash',repeat('f',64),
                'physicalVerifiedAt',clock_timestamp())),?,
              current_timestamp-interval '1 minute',current_timestamp,60000)
            """,receiptStatus,jobId,processHash,UUID.randomUUID().toString(),oldCommit,
            sourceHash,processHash,processHash);
        jdbc.update("""
            update integrated_design_autocompletion_gate
               set approval_status='ACTIVE',runtime_commit=?,postdeploy_candidate_id=?,
                   source_input_authority_hash=?,final_authority_hash=repeat('f',64),
                   canary_process_code='PROC',canary_job_id=?,revision=revision+1,
                   approved_by='POSTGRES_TEST',approved_at=current_timestamp-interval '1 minute',
                   activated_by='POSTGRES_TEST',activated_at=current_timestamp,
                   revoked_by=null,revoked_at=null,revoke_reason=null,updated_at=current_timestamp
             where gate_key='GLOBAL'
            """,oldCommit,candidate,sourceHash,jobId);
        return new PhysicalRearmCampaign(jobId,sourceHash,oldCommit,newCommit,candidate);
    }

    private PhysicalRearmCampaign installDispatchablePhysicalRearmCampaign(){
        resetAutocompletionGate();
        Map<String,Object> compiled=compileComposite(
            Map.of("processCode","PROC","previewOnly",false,"scopeType","GLOBAL"));
        long jobId=((Number)((Map<?,?>)((List<?>)compiled.get("receipts")).get(0))
            .get("jobId")).longValue();
        installExactCanonicalPhysicalEvidence(jobId);
        String oldCommit="d".repeat(40),newCommit="c".repeat(40);
        String sourceHash=currentCompositeSourceAuthorityHash();
        String processHash=jdbc.queryForObject(
            "select framework_composite_dependency_fingerprint('PROC')",String.class);
        String candidate="postdeploy:physical-dispatch:"+
            UUID.randomUUID().toString().replace("-","");
        jdbc.update("""
            insert into framework_postdeploy_release_attempt(
              candidate_id,source_commit,attempt_status,terminal_reason,terminal_at)
            values(?,?,'PROMOTED','PROMOTION_COMMITTED',clock_timestamp())
            """,candidate,oldCommit);
        jdbc.update("""
            insert into integrated_design_autocompletion_receipt(
              process_code,completion_status,attempt_count,job_id,receipt_json,
              dependency_fingerprint,started_at,completed_at,duration_ms)
            values('PROC','PHYSICAL_GENERATED_VERIFIED',7,?,jsonb_build_object(
              'sourceInputDependencyHash',?,'generationStatus','PHYSICAL_GENERATED_VERIFIED',
              'physicalVerified',true,'sourceWriteCount',1,
              'canary',jsonb_build_object('canaryId',?,'status','VERIFIED',
                'attemptNumber',1,'runtimeCommit',?,
                'requestedSourceAuthorityHash',?,
                'requestedSourceDependencyHash',?,
                'verifiedFinalAuthorityHash',repeat('f',64),
                'physicalVerifiedAt',clock_timestamp())),?,
              current_timestamp-interval '1 minute',current_timestamp,60000)
            """,jobId,processHash,UUID.randomUUID().toString(),oldCommit,
            sourceHash,processHash,processHash);
        jdbc.update("""
            update integrated_design_autocompletion_gate
               set approval_status='ACTIVE',runtime_commit=?,postdeploy_candidate_id=?,
                   source_input_authority_hash=?,final_authority_hash=repeat('f',64),
                   canary_process_code='PROC',canary_job_id=?,revision=revision+1,
                   approved_by='POSTGRES_TEST',approved_at=current_timestamp-interval '1 minute',
                   activated_by='POSTGRES_TEST',activated_at=current_timestamp,
                   revoked_by=null,revoked_at=null,revoke_reason=null,updated_at=current_timestamp
             where gate_key='GLOBAL'
            """,oldCommit,candidate,sourceHash,jobId);
        jdbc.update("""
            update framework_runtime_release_state
               set source_commit=?,deployment_uid=?,
                   deployment_generation=deployment_generation+1,
                   observed_generation=observed_generation+1,
                   image_ref='carbonet-runtime:'||?,health_status='UP',
                   recorded_at=clock_timestamp()
             where release_key='CARBONET_RUNTIME'
            """,newCommit,"runtime-i1-"+UUID.randomUUID(),newCommit.substring(0,12));
        return new PhysicalRearmCampaign(jobId,sourceHash,oldCommit,newCommit,candidate);
    }

    private void stagePostdeployCandidate(String candidate,String commit){
        jdbc.update("""
            insert into framework_postdeploy_release_attempt(
              candidate_id,source_commit,attempt_status,staged_at)
            values(?,?,'STAGED',clock_timestamp())
            """,candidate,commit);
    }

    private void promotePostdeployCandidate(String candidate,String commit,String runtimeIdentity){
        long promotionId=jdbc.queryForObject(
            "select coalesce(max(promotion_id),0)+1 from framework_postdeploy_evidence_promotion",
            Long.class);
        jdbc.update("""
            insert into framework_postdeploy_evidence_promotion(
              promotion_id,candidate_id,source_commit,runtime_identity_hash)
            values(?,?,?,?)
            """,promotionId,candidate,commit,runtimeIdentity);
        assertEquals(1,jdbc.update("""
            update framework_postdeploy_release_attempt
               set attempt_status='PROMOTED',terminal_reason='PROMOTION_COMMITTED',
                   runtime_identity_hash=?,promotion_id=?,terminal_at=clock_timestamp()
             where candidate_id=? and source_commit=? and attempt_status='STAGED'
            """,runtimeIdentity,promotionId,candidate,commit));
    }

    private void restorePhysicalRearmGate(PhysicalRearmCampaign campaign){
        assertEquals(1,jdbc.update("""
            update integrated_design_autocompletion_gate
               set approval_status='ACTIVE',runtime_commit=?,postdeploy_candidate_id=?,
                   source_input_authority_hash=?,final_authority_hash=repeat('f',64),
                   canary_process_code='PROC',canary_job_id=?,revision=revision+1,
                   approved_by='POSTGRES_TEST',approved_at=current_timestamp-interval '1 minute',
                   activated_by='POSTGRES_TEST',activated_at=current_timestamp,
                   revoked_by=null,revoked_at=null,revoke_reason=null,updated_at=current_timestamp
             where gate_key='GLOBAL'
            """,campaign.oldCommit(),campaign.candidateId(),campaign.sourceHash(),campaign.jobId()));
    }

    private void clearPhysicalRearmCampaign(PhysicalRearmCampaign campaign){
        resetAutocompletionGate();
        jdbc.update("delete from integrated_design_autocompletion_receipt where process_code='PROC'");
        jdbc.update("delete from framework_development_job where job_id=?",campaign.jobId());
        jdbc.update("delete from framework_postdeploy_release_attempt where candidate_id=?",
            campaign.candidateId());
    }

    private void resetAutocompletionGate(){
        jdbc.update("""
            update integrated_design_autocompletion_gate
               set approval_status='DISABLED',runtime_commit=null,postdeploy_candidate_id=null,
                   source_input_authority_hash=null,final_authority_hash=null,
                   canary_process_code=null,canary_job_id=null,revision=revision+1,
                   approved_by=null,approved_at=null,activated_by=null,activated_at=null,
                   revoked_by=null,revoked_at=null,revoke_reason=null,updated_at=current_timestamp
             where gate_key='GLOBAL'
            """);
    }

    private String currentCompositeSourceAuthorityHash(){
        return jdbc.queryForObject("""
            select framework_composite_live_smoke_hash(coalesce(jsonb_agg(
                     jsonb_build_object('processCode',process_code,
                       'dependencyFingerprint',framework_composite_dependency_fingerprint(process_code))
                     order by process_code collate "C"),'[]'::jsonb))
              from (select distinct upper(process_code) process_code
                      from framework_composite_design_target_identity) target
            """,String.class);
    }

    private record PhysicalRearmCampaign(long jobId,String sourceHash,String oldCommit,
        String newCommit,String candidateId){}

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

    private Map<String,Object> requirementProjectionContract(
            String layout,String theme,String command,String permission,String contentSha){
        List<Map<String,Object>> sections=List.of(Map.of(
            "sectionCode","PRIMARY_TASK","order",1,"componentType","JSON_FORM"));
        Map<String,Object> endpoint=Map.of("method","POST","path","/api/items");
        Map<String,Object> step=Map.ofEntries(
            Map.entry("requirementId","REQ_STEP"),Map.entry("stepCode","STEP"),
            Map.entry("stepOrder",1),Map.entry("actorCode","PRIMARY_ACTOR"),
            Map.entry("screenName","Structured requirement screen"),
            Map.entry("description","Execute the structured requirement"),
            Map.entry("routePath","/step"),Map.entry("layoutCode",layout),
            Map.entry("themeCode",theme),Map.entry("sections",sections),
            Map.entry("permissionCodes",List.of(permission)),Map.entry("commandCode",command),
            Map.entry("fromState","DRAFT"),Map.entry("toState","DONE"),
            Map.entry("endpoint",endpoint),Map.entry("apiContract",endpoint),
            Map.entry("fields",List.of(Map.of("fieldCode","amount","fieldName","Amount",
                "dataType","DECIMAL","controlType","NUMBER","required",true))),
            Map.entry("acceptanceCriteria",List.of("Persist and reread the amount.")));
        LinkedHashMap<String,Object> contract=new LinkedHashMap<>();
        contract.put("schemaVersion","3.0.0");
        contract.put("projectId","PROJECT_A");contract.put("tenantId","TENANT_A");
        contract.put("contentSha256",contentSha);
        contract.put("identity",Map.of("strategy","STABLE_DOCUMENT_KEY",
            "stableKey","PROJECT_A:REQUIREMENTS","processCode","PROC"));
        contract.put("contextFields",List.of("projectId","tenantId","designVersion",
            "actorCode","processCode","stepCode"));
        contract.put("workspaces",List.of(Map.of("id","PRIMARY_WORKSPACE","tabs",List.of(
            Map.of("id","TASK","label","Task","sections",sections)))));
        contract.put("actorDefinitions",List.of(Map.of(
            "actorCode","PRIMARY_ACTOR","actorName","Primary actor",
            "description","Executes the requirement","permissionCodes",List.of(permission))));
        contract.put("process",Map.of("processCode","PROC","startState","DRAFT",
            "endState","DONE","steps",List.of(step)));
        contract.put("generation",Map.of("commonLayout",layout,"commonTheme",theme));
        contract.put("reconciliation",Map.of("mode","EXACT_SET"));
        contract.put("qualityGates",List.of("DATABASE_REREAD"));
        return contract;
    }

    private Map<String,Object> commonDesignSourceBody(String projectId,
            Map<String,Object> base,Map<String,Object> proposed){
        @SuppressWarnings("unchecked")
        Map<String,Object> payload=(Map<String,Object>)proposed.get("payload");
        LinkedHashMap<String,Object> body=new LinkedHashMap<>();
        body.put("activationPolicy","SOURCE_IMMEDIATE_V1");
        body.put("authorityMode","SOURCE");body.put("projectId",projectId);
        for(String field:List.of("assetType","assetId","assetName","routePath",
                "version","active","payload"))body.put(field,proposed.get(field));
        body.put("dependencies",payload.getOrDefault("dependencies",List.of()));
        body.put("baseAsset",base);
        body.put("baseFingerprint",
            ActorProcessGovernanceService.commonDesignAssetFingerprint(base));
        body.put("assetFingerprint",
            ActorProcessGovernanceService.commonDesignAssetFingerprint(proposed));
        body.put("sourceReceiptId",ActorProcessGovernanceService.commonDesignAssetFingerprint(
            Map.of("projectId",projectId,"assetType",proposed.get("assetType"),
                "assetId",proposed.get("assetId"),"base",body.get("baseFingerprint"),
                "after",body.get("assetFingerprint"))));
        return body;
    }

    private static Map<String,Object> themeAsset(String id,String name,String primary,
            List<Map<String,Object>> dependencies){
        return Map.ofEntries(
            Map.entry("assetType","THEME"),Map.entry("assetId",id),
            Map.entry("assetName",name),Map.entry("routePath",""),
            Map.entry("version","v1"),Map.entry("active",true),
            Map.entry("payload",Map.ofEntries(
                Map.entry("schemaVersion","1.0.0"),Map.entry("themeName",name),
                Map.entry("description",name+" description"),Map.entry("themeType","SYSTEM"),
                Map.entry("colorConfig",Map.of("primary",primary)),
                Map.entry("typographyConfig",Map.of("family","Pretendard")),
                Map.entry("spacingConfig",Map.of("unit",4)),
                Map.entry("borderConfig",Map.of("radius",8)),
                Map.entry("shadowConfig",Map.of("panel","none")),
                Map.entry("classPrefix","krds-"),Map.entry("isDefault",false),
                Map.entry("dependencies",dependencies))));
    }

    private static Map<String,Object> sectionAsset(String id,String name){
        return Map.ofEntries(
            Map.entry("assetType","SECTION"),Map.entry("assetId",id),
            Map.entry("assetName",name),Map.entry("routePath",""),
            Map.entry("version","v1"),Map.entry("active",true),
            Map.entry("payload",Map.ofEntries(
                Map.entry("schemaVersion","1.0.0"),Map.entry("sectionName",name),
                Map.entry("sectionType","SUMMARY"),
                Map.entry("layoutContract","RESPONSIVE_GRID"),
                Map.entry("responsiveContract","MOBILE_FIRST"),
                Map.entry("accessibilityContract","KRDS_A11Y"),
                Map.entry("designReference","DEP_THEME"),
                Map.entry("dependencies",List.of()))));
    }

    private static Map<String,Object> componentAsset(String id,String name){
        return Map.ofEntries(
            Map.entry("assetType","COMPONENT"),Map.entry("assetId",id),
            Map.entry("assetName",name),Map.entry("routePath",""),
            Map.entry("version","v1"),Map.entry("active",true),
            Map.entry("payload",Map.ofEntries(
                Map.entry("schemaVersion","1.0.0"),Map.entry("componentName",name),
                Map.entry("componentType","JSON_FORM"),Map.entry("ownerDomain","COMMON"),
                Map.entry("propsSchema",Map.of("type","object")),
                Map.entry("designReference","DEP_THEME"),
                Map.entry("defaultProps",Map.of("dense",false)),
                Map.entry("category","COMMON"),Map.entry("dependencies",List.of()))));
    }

    private static Map<String,Object> screenAsset(String id,String name,String route){
        Map<String,Object> theme=themeAsset("DEP_THEME","Theme dependency","#246beb",List.of());
        Map<String,Object> section=sectionAsset("DEP_SECTION","Section dependency");
        Map<String,Object> component=componentAsset("DEP_COMPONENT","Component dependency");
        List<Map<String,Object>> dependencies=List.of(theme,section,component).stream()
            .map(asset->Map.<String,Object>of(
                "assetType",asset.get("assetType"),"assetId",asset.get("assetId"),
                "fingerprint",ActorProcessGovernanceService.commonDesignAssetFingerprint(asset)))
            .toList();
        return composedScreenAsset(id,name,route,"v1","KRDS_WORKSPACE","DEP_THEME",
            List.of(Map.of("sectionId","DEP_SECTION",
                "zone","main-zone","displayOrder",10,"props",Map.of())),
            List.of(Map.of("componentId","DEP_COMPONENT",
                "sectionId","DEP_SECTION","instanceKey","primary-form",
                "displayOrder",10,"props",Map.of("dense",false),
                "condition","always")),dependencies);
    }

    private static Map<String,Object> composedScreenAsset(
            String id,String name,String route,String version,String layout,String theme,
            List<Map<String,Object>> sections,List<Map<String,Object>> components,
            List<Map<String,Object>> dependencies){
        return Map.ofEntries(
            Map.entry("assetType","SCREEN"),Map.entry("assetId",id),
            Map.entry("assetName",name),Map.entry("routePath",route),
            Map.entry("version",version),Map.entry("active",true),
            Map.entry("payload",Map.ofEntries(
                Map.entry("schemaVersion","1.0.0"),Map.entry("pageName",name),
                Map.entry("layout",layout),Map.entry("theme",theme),
                Map.entry("sections",sections),Map.entry("components",components),
                Map.entry("dependencies",dependencies))));
    }

    @SuppressWarnings("unchecked")
    private void seedCommonDesignAsset(Map<String,Object> asset){
        String type=String.valueOf(asset.get("assetType"));
        String id=String.valueOf(asset.get("assetId"));
        String name=String.valueOf(asset.get("assetName"));
        String route=String.valueOf(asset.get("routePath"));
        String version=String.valueOf(asset.get("version"));
        Map<String,Object> payload=(Map<String,Object>)asset.get("payload");
        if("THEME".equals(type))jdbc.update("""
            insert into comtnthemedefinition(
              theme_id,theme_nm,theme_dc,theme_type,color_config,typography_config,
              spacing_config,border_config,shadow_config,class_prefix,is_default,use_at,is_active)
            values(?,?,?,?,?,?,?,?,?,?,?,'Y','Y')
            """,id,name,payload.get("description"),payload.get("themeType"),
            json(payload.get("colorConfig")),json(payload.get("typographyConfig")),
            json(payload.get("spacingConfig")),json(payload.get("borderConfig")),
            json(payload.get("shadowConfig")),payload.get("classPrefix"),
            Boolean.TRUE.equals(payload.get("isDefault"))?"Y":"N");
        else if("SECTION".equals(type))jdbc.update("""
            insert into ui_section_registry(
              section_id,section_name,section_type,layout_contract,responsive_contract,
              accessibility_contract,design_reference,active_yn)
            values(?,?,?,?,?,?,?,'Y')
            """,id,name,payload.get("sectionType"),payload.get("layoutContract"),
            payload.get("responsiveContract"),payload.get("accessibilityContract"),
            payload.get("designReference"));
        else if("COMPONENT".equals(type))jdbc.update("""
            insert into ui_component_registry(
              component_id,component_name,component_type,owner_domain,props_schema_json,
              design_reference,default_props,category,active_yn)
            values(?,?,?,?,cast(? as jsonb),?,cast(? as jsonb),?,'Y')
            """,id,name,payload.get("componentType"),payload.get("ownerDomain"),
            json(payload.get("propsSchema")),payload.get("designReference"),
            json(payload.get("defaultProps")),payload.get("category"));
        else {
            Map<String,Object> composition=Map.ofEntries(
                Map.entry("schema","carbonet.screen-composition/v1"),
                Map.entry("layout",payload.get("layout")),
                Map.entry("theme",payload.get("theme")),
                Map.entry("sections",payload.get("sections")),
                Map.entry("components",payload.get("components")));
            jdbc.update("""
            insert into ui_page_manifest(
              page_id,page_name,route_path,layout_version,design_token_version,
              component_schema,version_id,active_yn)
            values(?,?,?,?,?,?,?,'Y')
            """,id,name,route,payload.get("layout"),payload.get("theme"),
                json(composition),version);
            @SuppressWarnings("unchecked")
            List<Map<String,Object>> sections=(List<Map<String,Object>>)payload.get("sections");
            @SuppressWarnings("unchecked")
            List<Map<String,Object>> components=(List<Map<String,Object>>)payload.get("components");
            for(Map<String,Object> component:components){
                Map<String,Object> section=sections.stream().filter(item->
                    item.get("sectionId").equals(component.get("sectionId")))
                    .findFirst().orElseThrow();
                jdbc.update("""
                    insert into ui_page_component_map(
                      map_id,page_id,layout_zone,component_id,instance_key,
                      display_order,conditional_rule_summary,instance_props)
                    values(?,?,?,?,?,?,?,?)
                    ""","MAP_"+component.get("instanceKey"),id,section.get("zone"),
                    component.get("componentId"),component.get("instanceKey"),
                    component.get("displayOrder"),component.get("condition"),
                    json(component.get("props")));
            }
        }
        jdbc.update("""
            insert into framework_common_design_asset_source_state(
              asset_type,asset_id,canonical_asset,asset_fingerprint,updated_by)
            values(?,?,cast(? as jsonb),?,'test-seed')
            """,type,id,json(asset),
            ActorProcessGovernanceService.commonDesignAssetFingerprint(asset));
    }

    private static String json(Object value){
        try{return new ObjectMapper().writeValueAsString(value);}
        catch(Exception error){throw new IllegalStateException(error);}
    }

    private void seedGeneratedScreenIdentity(String route,String actorCode){
        jdbc.update("insert into comtnthemedefinition(theme_id,use_at,is_active) "+
            "values('KRDS_GOV_DEFAULT','Y','Y') on conflict(theme_id) do nothing");
        jdbc.update("insert into framework_screen_resource(route_key,layout_type,source_kind) "+
            "values(?,'RESPONSIVE_WORKSPACE','PAGE_DESIGN') on conflict(route_key) do nothing",route);
        jdbc.update("""
            insert into framework_page_design(
              process_code,step_code,audience,page_code,page_title,page_purpose,
              screen_type,planned_route_path,route_status,actor_code,updated_by)
            values('PROC','STEP','USER','PROC_STEP_USER','Step','Purpose','WORKSPACE',?,
              'DESIGN_ONLY',?,'BACKSTAGE_REQUIREMENT_AUTOMATION')
            """,route,actorCode);
        Long contractId=jdbc.queryForObject("""
            select contract_id from framework_professional_screen_contract
             where process_code='PROC' and step_code='STEP' and audience='USER'
            """,Long.class);
        jdbc.update("""
            insert into framework_screen_blueprint(
              blueprint_code,process_code,step_code,actor_code,audience,page_id,page_name,
              route_path,screen_type,template_code,specification_json,traceability_json,
              validation_status,implementation_strategy,source_reference,transition_status,created_by)
            values('REQ_BP_DIRECT','PROC','STEP',?,'USER','PROC_STEP_USER','Step',?,
              'WORKSPACE','KRDS_WORKSPACE',jsonb_build_object(
                'actorCode',?,'commandCode','EXECUTE_STEP','fromState','DRAFT','toState','DONE',
                'layout','RESPONSIVE_WORKSPACE','theme','KRDS_GOV_DEFAULT')::text,
              '{}','VALID','GENERATED_RUNTIME',?,'CONTRACT_LINKED',
              'BACKSTAGE_REQUIREMENT_AUTOMATION')
            """,actorCode,route,actorCode,
            "FRAMEWORK_PROFESSIONAL_SCREEN_CONTRACT:"+contractId);
    }

    private void assertGeneratedIdentity(
            String route,String actorCode,String commandCode,int endpoints){
        assertEquals(1,jdbc.queryForObject("""
            select count(*) from framework_professional_screen_contract
             where process_code='PROC' and step_code='STEP' and audience='USER'
               and route_path=? and actor_code=?
            """,Integer.class,route,actorCode));
        assertEquals(1,jdbc.queryForObject("""
            select count(*) from framework_page_design
             where process_code='PROC' and step_code='STEP' and audience='USER'
               and planned_route_path=? and actor_code=?
            """,Integer.class,route,actorCode));
        assertEquals(1,jdbc.queryForObject("""
            select count(*) from framework_screen_blueprint
             where process_code='PROC' and step_code='STEP' and audience='USER'
               and route_path=? and actor_code=? and validation_status='VALID'
               and specification_json::jsonb->>'actorCode'=?
               and specification_json::jsonb->>'commandCode'=?
            """,Integer.class,route,actorCode,actorCode,commandCode));
        assertEquals(1,jdbc.queryForObject("""
            select count(*) from framework_screen_blueprint
             where process_code='PROC' and step_code='STEP' and validation_status='VALID'
            """,Integer.class));
        assertEquals(endpoints,jdbc.queryForObject("""
            select (framework_process_generation_input('PROC')->>'processEndpointExpected')::integer
            """,Integer.class));
    }

    private void installCompositeGeneratedTables(){
        jdbc.execute("create table item(name text not null,id integer primary key)");
        jdbc.execute("comment on table item is 'design-schema-hash:"+schemaFingerprint("/work-a")+"'");
        jdbc.execute("create table approval(reason text not null,approval_id integer primary key)");
        jdbc.execute("comment on table approval is 'design-schema-hash:"+schemaFingerprint("/work-admin")+"'");
        jdbc.execute("create table ticket(note text not null,ticket_id integer primary key)");
        jdbc.execute("comment on table ticket is 'design-schema-hash:"+schemaFingerprint("/work-b")+"'");
    }

    private String schemaFingerprint(String route){
        String encoded=jdbc.queryForObject("""
            select coalesce((authority.composite_json#>'{executableDesign,DATABASE,schemaChanges}'
                              ->0)::text,
                            (framework_try_jsonb(contract.data_contract)->'schemaChanges'->0)::text)
              from framework_professional_screen_contract contract
              left join integrated_design_authority authority on authority.contract_id=contract.contract_id
             where contract.process_code='PROC' and contract.route_path=?
            """,
            String.class,route);
        try{return CompositeDatabasePlanService.tableSchemaFingerprint(
            new ObjectMapper().readValue(encoded,Map.class));}
        catch(Exception error){throw new IllegalStateException(error);}
    }

    private void seedCompositeThreeScreens(){
        jdbc.update("delete from framework_professional_screen_contract where process_code='PROC'");
        jdbc.update("""
            update framework_process_step set actor_code='PRIMARY_ACTOR',command_code='SAVE',
              from_state='DRAFT',to_state='DONE',completion_rule='record saved',
              input_contract='{"name":"string"}',output_contract='{"id":"integer"}',
              api_contract='/api/items',requires_notification=false,requires_api=true,
              requires_user_page=true,requires_admin_page=true,
              user_path='/work-a',admin_path='/work-admin'
              where process_code='PROC' and step_code='STEP'
            """);
        jdbc.update("""
            update framework_step_schema_set set input_schema='{"name":"string"}',
              output_schema='{"id":"integer"}',field_schema='[]',
              persistence_schema='{"entity":"ITEM"}',handoff_schema='[]',
              context_keys='[]',completeness_status='COMPLETE',blocker_codes='[]'
             where process_code='PROC'
            """);
        jdbc.update("""
            insert into framework_account_actor_assignment(
              account_id,tenant_id,project_id,actor_code,data_scope)
            values('system-admin','TENANT','*','PRIMARY_ACTOR','*'),
                  ('system-admin','TENANT','*','OWNER_ACTOR','*'),
                  ('system-admin','TENANT','*','ESCALATION_ACTOR','*')
            """);
        jdbc.update("""
            insert into framework_permission_grant_v1(
              actor_code,permission_code,scope_type,effect,use_at)
            values('PRIMARY_ACTOR','PERM_SAVE','PROCESS','ALLOW','Y'),
                  ('OWNER_ACTOR','PERM_APPROVE','PROCESS','ALLOW','Y'),
                  ('ESCALATION_ACTOR','PERM_ESCALATE','PROCESS','ALLOW','Y')
            """);
        jdbc.update("""
            insert into framework_permission_requirement_v1(
              process_code,step_code,permission_code,scope_type)
            values('PROC','STEP','PERM_SAVE','PROCESS')
            """);
        jdbc.update("""
            insert into comtnthemedefinition(theme_id,theme_nm,use_at,is_active)
            values('KRDS_GOV_DEFAULT','KRDS','Y','Y')
            """);
        jdbc.update("""
            insert into ui_section_registry(section_id,section_name,section_type,
              layout_contract,responsive_contract,accessibility_contract,active_yn)
            values('MAIN','Main','FORM','{}','{}','{}','Y')
            """);
        jdbc.update("""
            insert into ui_component_registry(component_id,component_name,component_type,
              owner_domain,active_yn) values('JSON_FORM','JSON Form','JSON_FORM','DOMAIN','Y')
            """);
        String sections="[{\"sectionId\":\"MAIN\",\"componentCodes\":[\"JSON_FORM\"]}]";
        String blueprintSpec="{\"layout\":\"KRDS_WORKSPACE\",\"theme\":\"KRDS_GOV_DEFAULT\","+
            "\"assetBindings\":[{\"assetType\":\"THEME\",\"assetCode\":\"KRDS_GOV_DEFAULT\"},"+
            "{\"assetType\":\"SECTION\",\"assetCode\":\"MAIN\"},"+
            "{\"assetType\":\"COMPONENT\",\"assetCode\":\"JSON_FORM\"}]}";
        List<String[]> identities=List.of(
            new String[]{"STEP","USER","/work-a","PRIMARY_ACTOR","SAVE","PERM_SAVE",
                "name","id","ITEM","/api/items/{executionId}"},
            new String[]{"STEP","ADMIN","/work-admin","OWNER_ACTOR","APPROVE","PERM_APPROVE",
                "reason","approval_id","APPROVAL","/api/admin/items/{executionId}/approve"},
            new String[]{"STEP","USER","/work-b","ESCALATION_ACTOR","ESCALATE","PERM_ESCALATE",
                "note","ticket_id","TICKET","/api/items/{executionId}/escalate"});
        int index=0;for(String[] identity:identities){index++;
            String actorCode=identity[3],commandCode=identity[4],permissionCode=identity[5];
            String inputField=identity[6],outputField=identity[7],entity=identity[8],apiPath=identity[9];
            String fields="[{\"fieldCode\":\""+inputField+"\",\"label\":\"Input\",\"direction\":\"INPUT\","+
                "\"dataSource\":\""+entity+"\",\"dataType\":\"STRING\",\"required\":true,"+
                "\"componentCode\":\"JSON_FORM\"},{\"fieldCode\":\""+outputField+"\",\"label\":\"Output\","+
                "\"direction\":\"OUTPUT\",\"dataSource\":\""+entity+"\",\"dataType\":\"INTEGER\","+
                "\"required\":false,\"componentCode\":\"JSON_FORM\"}]";
            String commands="[{\"commandCode\":\""+commandCode+"\",\"actorCode\":\""+actorCode+
                "\",\"primary\":true}]";
            String states="[{\"fromState\":\"DRAFT\",\"commandCode\":\""+commandCode+
                "\",\"toState\":\"DONE\"}]";
            String api="[{\"method\":\"POST\",\"path\":\""+apiPath+"\",\"commandCode\":\""+
                commandCode+"\",\"requestFields\":[\""+inputField+"\"],\"responseFields\":[\""+
                outputField+"\"],\"permissionCodes\":[\""+permissionCode+"\"],"+
                "\"responseProjection\":[{\"fieldCode\":\""+outputField+"\",\"source\":"+
                "\"RUNTIME_RESULT\",\"sourcePath\":\"eventId\"}],\"statusResponses\":["+
                "{\"statusCase\":\"SUCCESS\",\"httpStatus\":200,\"bodyFields\":[\"success\",\"idempotent\",\"eventId\",\"toState\",\""+outputField+"\"]},"+
                "{\"statusCase\":\"VALIDATION_ERROR\",\"httpStatus\":400,\"bodyFields\":[\"success\",\"code\",\"message\"]},"+
                "{\"statusCase\":\"FORBIDDEN\",\"httpStatus\":403,\"bodyFields\":[\"success\",\"code\",\"message\"]},"+
                "{\"statusCase\":\"CONFLICT\",\"httpStatus\":409,\"bodyFields\":[\"success\",\"code\",\"message\"]},"+
                "{\"statusCase\":\"RECOVERY\",\"httpStatus\":200,\"bodyFields\":[\"success\",\"idempotent\",\"eventId\",\"toState\",\"recovered\",\""+outputField+"\"]}]}]";
            List<Map<String,Object>> schemaChanges=List.of(Map.of(
                "operation","CREATE_TABLE","tableName",entity.toLowerCase(),"columns",List.of(
                    Map.of("name",inputField,"type","text","primaryKey",false,"nullable",false),
                    Map.of("name",outputField,"type","integer","primaryKey",true,"nullable",false)),
                "uniqueConstraints",List.of(),"indexes",List.of()));
            String data=json(Map.of("entities",List.of(Map.of("entity",entity,
                    "fields",List.of(inputField,outputField))),"migrationMode","SAFE_CREATE_TABLE",
                "schemaFingerprint",CompositeExecutableDesignAuthorityCompiler.hash(
                    CompositeExecutableDesignAuthorityCompiler.stable(schemaChanges)),
                "schemaChanges",schemaChanges));
            jdbc.update("""
                insert into framework_professional_screen_contract(
                  process_code,step_code,audience,route_path,screen_name,actor_code,
                  business_purpose,entry_condition,exit_condition,kpi_contract,section_contract,
                  field_contract,command_contract,state_contract,api_contract,data_contract,
                  evidence_contract,responsive_contract,accessibility_contract,security_contract,
                  permission_codes,api_verified,database_verified,authority_verified,
                  responsive_verified,accessibility_verified,exception_states_verified,
                  audit_evidence_ref,contract_status,updated_by)
                values('PROC',?,?,?,?,?,'Complete work','Draft exists',
                  'Saved record returned','[{"kpiCode":"DONE","description":"Completed"}]',
                  ?,?,?,?,?,?,'[{"evidenceType":"E2E","reference":"evidence://save"}]',
                  '360 768 1280','KRDS WCAG AA','Server actor scope',?::jsonb,
                  true,true,true,true,true,true,'audit://save','DESIGN_COMPLETE','LIVE_CONTRACT_BACKFILL')
                """,identity[0],identity[1],identity[2],"Screen "+index,actorCode,
                sections,fields,commands,states,api,data,"[\""+permissionCode+"\"]");
            jdbc.update("""
                insert into framework_screen_resource(route_key,layout_type,source_kind)
                values(?,'KRDS_WORKSPACE','GENERATED') on conflict(route_key) do nothing
                """,identity[2]);
            jdbc.update("""
                insert into framework_screen_blueprint(blueprint_code,process_code,step_code,
                  actor_code,audience,page_id,page_name,route_path,screen_type,template_code,
                  specification_json,traceability_json,validation_status,validation_message,
                  implementation_strategy,source_reference,transition_status,created_by)
                values(?,'PROC',?,?,?,?,?,?,'FORM','KRDS_FORM',?,'{}',
                  'VALID','ready','GENERATED_RUNTIME','','GENERATED','test')
                ""","BP_"+index,identity[0],actorCode,identity[1],"PAGE_"+index,
                "Screen "+index,identity[2],blueprintSpec);
        }
        jdbc.update("""
            insert into framework_page_design_assurance(screen_resource_id,actor_passed,
              process_passed,lineage_passed,transition_passed,admin_counterpart_passed,test_passed)
            select screen_resource_id,true,true,true,true,true,true from framework_screen_resource
            """);
        jdbc.update("""
            insert into framework_process_step_screen_binding(process_code,step_code,
              screen_resource_id,actor_code,audience,binding_status)
            select blueprint.process_code,blueprint.step_code,resource.screen_resource_id,
                   blueprint.actor_code,blueprint.audience,'ACTIVE'
              from framework_screen_blueprint blueprint join framework_screen_resource resource
                on resource.route_key=blueprint.route_path
            """);
        jdbc.execute("""
            create or replace function framework_canonical_screen_bundle(
              requested_process varchar,requested_step varchar,
              requested_audience varchar,requested_route varchar)
            returns jsonb language sql stable as $$
              with source as (
                select contract.*,step.command_code,blueprint.specification_json
                  from framework_professional_screen_contract contract
                  join framework_process_step step using(process_code,step_code)
                  join framework_screen_blueprint blueprint
                    on blueprint.process_code=contract.process_code
                   and blueprint.step_code=contract.step_code
                   and upper(blueprint.audience)=upper(contract.audience)
                   and lower(blueprint.route_path)=lower(contract.route_path)
                 where contract.process_code=requested_process and contract.step_code=requested_step
                   and upper(contract.audience)=upper(requested_audience)
                   and lower(contract.route_path)=lower(requested_route)
              ), canonical as (
                select jsonb_build_object('processCode',requested_process,'stepCode',requested_step,
                  'audience',upper(requested_audience),'routePath',lower(requested_route),
                  'process',jsonb_build_object('processCode',requested_process),
                  'lanes',jsonb_build_object(
                    'HELP',jsonb_build_object('summary',business_purpose,
                      'evidence',framework_try_jsonb(evidence_contract)),
                    'WORK_GUIDE',jsonb_build_object('processCode',requested_process,
                      'stepCode',requested_step,'actorCode',actor_code,
                      'nextAction',jsonb_build_object('routePath',lower(route_path),
                        'commandCode',command_code)),
                    'QA',jsonb_build_object('evidence',framework_try_jsonb(evidence_contract)),
                    'DESIGN_CARD',jsonb_build_object('sections',framework_try_jsonb(section_contract),
                      'specification',framework_try_jsonb(specification_json)),
                    'FRONTEND',jsonb_build_object('routePath',lower(route_path),
                      'fields',framework_try_jsonb(field_contract),
                      'actions',framework_try_jsonb(command_contract)),
                    'API',coalesce(framework_try_jsonb(api_contract),'[]'::jsonb),
                    'DATABASE',coalesce(framework_try_jsonb(data_contract)->'schemaChanges',
                      '[]'::jsonb))) design from source
              ), encoded as (select design,design::text canonical_text from canonical)
              select jsonb_build_object('schema','carbonet.canonical-design/v1','catalogHash',null,
                'designHash',encode(sha256(convert_to(canonical_text,'UTF8')),'hex'),
                'canonicalText',canonical_text,'canonicalDesign',design) from encoded
            $$
            """);
        jdbc.execute("""
            create or replace function framework_generate_professional_design_graph(
              requested_process varchar,requested_actor varchar)
            returns jsonb language plpgsql as $$
            begin
              update framework_step_execution_spec
                 set design_status='DESIGN_COMPLETE',approval_status='APPROVED',
                     generation_status='READY',blocker_codes='[]'::jsonb,
                     approved_by=requested_actor,approved_at=current_timestamp,
                     updated_at=current_timestamp
               where process_code=requested_process;
              return jsonb_build_object('processCode',requested_process,'ready',true);
            end
            $$
            """);
    }

    private void cloneCompositeBenchmarkProcesses(int first,int last){
        jdbc.update("""
            insert into framework_process_definition
            select (jsonb_populate_record(null::framework_process_definition,
              to_jsonb(source)||jsonb_build_object(
                'process_code',format('BENCH_%s',lpad(series.value::text,3,'0')),
                'process_name',format('Readiness benchmark %s',series.value)))).*
              from generate_series(?,?) series(value)
              cross join lateral (select * from framework_process_definition
                 where process_code='PROC') source
            """,first,last);
        jdbc.update("""
            insert into framework_process_step
            select (jsonb_populate_record(null::framework_process_step,
              to_jsonb(source)||jsonb_build_object(
                'process_code',format('BENCH_%s',lpad(series.value::text,3,'0')),
                'user_path',format('/benchmark/%s/a',lpad(series.value::text,3,'0')),
                'admin_path',format('/benchmark/%s/admin',lpad(series.value::text,3,'0'))))).*
              from generate_series(?,?) series(value)
              cross join lateral (select * from framework_process_step
                 where process_code='PROC') source
            """,first,last);
        jdbc.update("""
            insert into framework_step_schema_set
            select (jsonb_populate_record(null::framework_step_schema_set,
              to_jsonb(source)||jsonb_build_object(
                'process_code',format('BENCH_%s',lpad(series.value::text,3,'0'))))).*
              from generate_series(?,?) series(value)
              cross join lateral (select * from framework_step_schema_set
                 where process_code='PROC') source
            """,first,last);
        jdbc.update("""
            insert into framework_step_execution_spec
            select (jsonb_populate_record(null::framework_step_execution_spec,
              to_jsonb(source)||jsonb_build_object(
                'process_code',format('BENCH_%s',lpad(series.value::text,3,'0'))))).*
              from generate_series(?,?) series(value)
              cross join lateral (select * from framework_step_execution_spec
                 where process_code='PROC') source
            """,first,last);
        jdbc.update("""
            insert into framework_permission_requirement_v1
            select (jsonb_populate_record(null::framework_permission_requirement_v1,
              to_jsonb(source)||jsonb_build_object(
                'process_code',format('BENCH_%s',lpad(series.value::text,3,'0'))))).*
              from generate_series(?,?) series(value)
              cross join lateral (select * from framework_permission_requirement_v1
                 where process_code='PROC') source
            """,first,last);
        jdbc.update("""
            insert into framework_simulation_case
            select (jsonb_populate_record(null::framework_simulation_case,
              to_jsonb(source)||jsonb_build_object(
                'case_code',format('BENCH_%s_%s',lpad(series.value::text,3,'0'),source.case_code),
                'process_code',format('BENCH_%s',lpad(series.value::text,3,'0'))))).*
              from generate_series(?,?) series(value)
              cross join lateral (select * from framework_simulation_case
                 where process_code='PROC') source
            """,first,last);
        jdbc.update("""
            insert into framework_screen_resource(route_key,layout_type,source_kind)
            select format('/benchmark/%s%s',lpad(series.value::text,3,'0'),route.suffix),
                   source.layout_type,source.source_kind
              from generate_series(?,?) series(value)
              cross join (values('/a','/work-a'),('/admin','/work-admin'),('/b','/work-b'))
                route(suffix,source_route)
              join framework_screen_resource source on source.route_key=route.source_route
            """,first,last);
        jdbc.update("""
            insert into framework_page_design_assurance(screen_resource_id,actor_passed,
              process_passed,lineage_passed,transition_passed,admin_counterpart_passed,test_passed)
            select target.screen_resource_id,assurance.actor_passed,assurance.process_passed,
                   assurance.lineage_passed,assurance.transition_passed,
                   assurance.admin_counterpart_passed,assurance.test_passed
              from generate_series(?,?) series(value)
              cross join (values('/a','/work-a'),('/admin','/work-admin'),('/b','/work-b'))
                route(suffix,source_route)
              join framework_screen_resource source on source.route_key=route.source_route
              join framework_page_design_assurance assurance
                on assurance.screen_resource_id=source.screen_resource_id
              join framework_screen_resource target on target.route_key=
                format('/benchmark/%s%s',lpad(series.value::text,3,'0'),route.suffix)
            """,first,last);
        jdbc.update("""
            insert into framework_professional_screen_contract(
              process_code,step_code,audience,route_path,screen_name,actor_code,
              business_purpose,entry_condition,exit_condition,kpi_contract,section_contract,
              field_contract,command_contract,state_contract,api_contract,data_contract,
              evidence_contract,responsive_contract,accessibility_contract,security_contract,
              permission_codes,api_verified,database_verified,authority_verified,
              responsive_verified,accessibility_verified,exception_states_verified,
              audit_evidence_ref,contract_status,menu_verified,updated_by)
            select format('BENCH_%s',lpad(series.value::text,3,'0')),source.step_code,
                   source.audience,
                   format('/benchmark/%s%s',lpad(series.value::text,3,'0'),
                     case source.route_path when '/work-a' then '/a'
                       when '/work-admin' then '/admin' when '/work-b' then '/b' end),
                   source.screen_name,source.actor_code,source.business_purpose,
                   source.entry_condition,source.exit_condition,source.kpi_contract,
                   source.section_contract,source.field_contract,source.command_contract,
                   source.state_contract,source.api_contract,source.data_contract,
                   source.evidence_contract,source.responsive_contract,
                   source.accessibility_contract,source.security_contract,
                   source.permission_codes,source.api_verified,source.database_verified,
                   source.authority_verified,source.responsive_verified,
                   source.accessibility_verified,source.exception_states_verified,
                   source.audit_evidence_ref,source.contract_status,source.menu_verified,
                   source.updated_by
              from generate_series(?,?) series(value)
              cross join lateral (select * from framework_professional_screen_contract
                 where process_code='PROC') source
            """,first,last);
        jdbc.update("""
            insert into framework_screen_blueprint(
              blueprint_code,process_code,step_code,actor_code,audience,page_id,page_name,
              route_path,screen_type,template_code,specification_json,traceability_json,
              validation_status,validation_message,implementation_strategy,source_reference,
              transition_status,created_by)
            select format('BENCH_%s_%s',lpad(series.value::text,3,'0'),source.blueprint_code),
                   format('BENCH_%s',lpad(series.value::text,3,'0')),source.step_code,
                   source.actor_code,source.audience,
                   format('BENCH_%s_%s',lpad(series.value::text,3,'0'),source.page_id),
                   source.page_name,
                   format('/benchmark/%s%s',lpad(series.value::text,3,'0'),
                     case source.route_path when '/work-a' then '/a'
                       when '/work-admin' then '/admin' when '/work-b' then '/b' end),
                   source.screen_type,source.template_code,source.specification_json,
                   source.traceability_json,source.validation_status,source.validation_message,
                   source.implementation_strategy,source.source_reference,
                   source.transition_status,source.created_by
              from generate_series(?,?) series(value)
              cross join lateral (select * from framework_screen_blueprint
                 where process_code='PROC') source
            """,first,last);
        jdbc.update("""
            insert into framework_process_step_screen_binding(process_code,step_code,
              screen_resource_id,actor_code,audience,binding_status)
            select format('BENCH_%s',lpad(series.value::text,3,'0')),binding.step_code,
                   target.screen_resource_id,binding.actor_code,binding.audience,
                   binding.binding_status
              from generate_series(?,?) series(value)
              join framework_process_step_screen_binding binding
                on binding.process_code='PROC'
              join framework_screen_resource source
                on source.screen_resource_id=binding.screen_resource_id
              join framework_screen_resource target on target.route_key=
                format('/benchmark/%s%s',lpad(series.value::text,3,'0'),
                  case source.route_key when '/work-a' then '/a'
                    when '/work-admin' then '/admin' when '/work-b' then '/b' end)
            """,first,last);
    }

    private void prepareCompositeReadinessBenchmarkDocuments(){
        prepareCompositeReadinessDocuments(true);
    }

    private void prepareMachineOwnedCompositeReadinessDocuments(){
        prepareCompositeReadinessDocuments(false);
    }

    private void prepareCompositeReadinessDocuments(boolean manualBenchmark){
        Map<String,Object> generated=jdbc.queryForMap(
            "select * from refresh_integrated_design_axis_documents(null,true)");
        assertEquals(0,number(generated,"ambiguous_count"));
        for(Map<String,Object> row:jdbc.queryForList("""
            select test.document_id as "documentId",test.content as "testContent",
                   api.content as "apiContent",state.content as "stateContent",
                   validation.content as "validationContent"
              from integrated_design_document test
              join integrated_design_document api using(process_code,step_code,route_path,audience)
              join integrated_design_document state using(process_code,step_code,route_path,audience)
              join integrated_design_document validation using(process_code,step_code,route_path,audience)
             where test.document_type='TEST' and api.document_type='API'
               and state.document_type='STATE' and validation.document_type='VALIDATION'
            """)){
            Map<String,Object> test=readMap(String.valueOf(row.get("testContent")));
            Map<String,Object> api=readMap(String.valueOf(row.get("apiContent")));
            Map<String,Object> state=readMap(String.valueOf(row.get("stateContent")));
            Map<String,Object> validation=readMap(String.valueOf(row.get("validationContent")));
            ((Map<String,Object>)test.get("payload")).put("scenarios",
                derivedLiveSmokeScenarios(api,state,validation));
            jdbc.update("update integrated_design_document set content=? where document_id=?",
                json(test),row.get("documentId"));
        }
        jdbc.update("""
            update integrated_design_document
               set status='READY',updated_by=case when ? then 'MANUAL_READINESS_BENCHMARK'
                 else 'LIVE_CONTRACT_BACKFILL' end
             where active_yn='Y'
            """,manualBenchmark);
        if(!manualBenchmark)jdbc.update("""
            update integrated_design_document set updated_by='MANUAL_LIVE_SMOKE_FIXTURE'
             where active_yn='Y' and document_type='TEST'
            """);
        if(manualBenchmark)jdbc.update("""
            update framework_professional_screen_contract
               set data_contract=(framework_try_jsonb(data_contract)->'entities')::text
             where process_code='PROC' or process_code like 'BENCH\\_%' escape '\\'
            """);
    }

    private void installCompositeReadinessWriteProbe(){
        jdbc.execute("""
            create table framework_readiness_benchmark_write_probe(
              table_name text not null,operation text not null,
              observed_at timestamp not null default current_timestamp)
            """);
        jdbc.execute("""
            create function framework_capture_readiness_benchmark_write()
            returns trigger language plpgsql as $$
            begin
              insert into framework_readiness_benchmark_write_probe(table_name,operation)
              values(TG_TABLE_NAME,TG_OP);
              return null;
            end
            $$
            """);
        jdbc.execute("""
            do $$
            declare target record;
            begin
              for target in
                select namespace.nspname,relation.relname
                  from pg_class relation join pg_namespace namespace
                    on namespace.oid=relation.relnamespace
                 where namespace.nspname=current_schema() and relation.relkind='r'
                   and relation.relname<>'framework_readiness_benchmark_write_probe'
                 order by relation.relname collate "C"
              loop
                execute format('create trigger trg_readiness_benchmark_write_probe '
                  'after insert or update or delete or truncate on %I.%I '
                  'for each statement execute function '
                  'framework_capture_readiness_benchmark_write()',
                  target.nspname,target.relname);
              end loop;
            end
            $$
            """);
    }

    private void removeCompositeReadinessWriteProbe(){
        jdbc.execute("drop function if exists framework_capture_readiness_benchmark_write() cascade");
        jdbc.execute("drop table if exists framework_readiness_benchmark_write_probe");
    }

    private String currentRuntimeIdentityHash(){
        return jdbc.queryForObject("""
            select encode(sha256(convert_to(concat_ws('|',source_commit,
              deployment_namespace,deployment_name,deployment_uid,deployment_generation,
              observed_generation,desired_replicas,image_ref,image_id,health_status
            ),'UTF8')),'hex')
              from framework_runtime_release_state where release_key='CARBONET_RUNTIME'
            """,String.class);
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

    private void lockCompositeRelayAccounts(String actor){
        try{
            var method=CompositeExecutableDesignAuthorityStore.class.getDeclaredMethod(
                "lockActiveRelayAccounts",List.class);
            method.setAccessible(true);
            var store=new CompositeExecutableDesignAuthorityStore(jdbc,service,
                new CompositeExecutableDesignProjectionService(jdbc));
            method.invoke(store,List.of(actor));
        }catch(java.lang.reflect.InvocationTargetException error){
            if(error.getCause() instanceof RuntimeException runtime)throw runtime;
            throw new IllegalStateException(error.getCause());
        }catch(ReflectiveOperationException error){throw new IllegalStateException(error);}
    }

    private void assertRelayRevocationWaits(String mutation) throws Exception {
        CountDownLatch locked=new CountDownLatch(1),release=new CountDownLatch(1);
        var executor=Executors.newFixedThreadPool(2);
        try{
            var compiler=executor.submit(()->transaction.execute(status->{
                jdbc.execute("set local lock_timeout='3s'");lockCompositeRelayAccounts("PRIMARY_ACTOR");
                locked.countDown();try{assertTrue(release.await(5,TimeUnit.SECONDS));}
                catch(InterruptedException error){Thread.currentThread().interrupt();throw new IllegalStateException(error);}
                return true;
            }));
            assertTrue(locked.await(3,TimeUnit.SECONDS));
            var revoker=executor.submit(()->transaction.execute(status->{
                jdbc.execute("set local lock_timeout='3s'");return jdbc.update(mutation);
            }));
            Thread.sleep(250);assertEquals(false,revoker.isDone());release.countDown();
            assertEquals(true,compiler.get(3,TimeUnit.SECONDS));assertEquals(1,revoker.get(3,TimeUnit.SECONDS));
        }finally{release.countDown();executor.shutdownNow();}
    }

    private void invokeRequirementReleaseReconciler(
            ActorProcessControlPlaneBridgeController bridge,
            String projectId,int version,String process){
        try{
            var method=ActorProcessControlPlaneBridgeController.class.getDeclaredMethod(
                "reconcileRequirementRelease",String.class,int.class,String.class);
            method.setAccessible(true);
            method.invoke(bridge,projectId,version,process);
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
            create table framework_runtime_release_state(
              release_key text primary key,source_commit text not null,
              deployment_namespace text not null,deployment_name text not null,
              deployment_uid text not null,deployment_generation bigint not null,
              observed_generation bigint not null,desired_replicas integer not null,
              image_ref text not null,image_id text not null,health_status text not null,
              recorded_by text not null,recorded_at timestamptz default current_timestamp)
            """);
        jdbc.execute("""
            create table framework_postdeploy_release_attempt(
              candidate_id text primary key,source_commit text not null,attempt_status text not null,
              terminal_reason text,runtime_identity_hash text,promotion_id bigint unique,
              staged_at timestamptz default current_timestamp,terminal_at timestamptz,
              unique(candidate_id,source_commit))
            """);
        jdbc.execute("""
            create table framework_postdeploy_evidence_promotion(
              promotion_id bigint primary key,candidate_id text not null,source_commit text not null,
              runtime_identity_hash text not null)
            """);
        jdbc.execute("create table comtnemplyrinfo(emplyr_id text primary key,esntl_id text unique,"+
            "emplyr_sttus_code text not null default 'P')");
        jdbc.execute("create table comtnentrprsmber(entrprs_mber_id text primary key,esntl_id text unique,"+
            "entrprs_mber_sttus text not null default 'A')");
        jdbc.execute("create table comtnemplyrscrtyestbs(scrty_dtrmn_trget_id text primary key,author_code text not null)");
        jdbc.update("insert into comtnemplyrinfo(emplyr_id,esntl_id) values('system-admin','SYSTEM_ADMIN_ESNTL')");
        jdbc.update("insert into comtnemplyrscrtyestbs(scrty_dtrmn_trget_id,author_code) values('SYSTEM_ADMIN_ESNTL','ROLE_SYSTEM_MASTER')");
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
            create table framework_project_actor_assignment(
              project_id text not null,actor_code text not null,user_id text not null,
              active_yn char(1) not null default 'Y',primary key(project_id,actor_code,user_id))
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
            create table framework_process_execution(
              execution_id uuid primary key,tenant_id varchar(80) not null,
              project_id varchar(100) not null,process_code varchar(80) not null
                references framework_process_definition(process_code),
              current_step_code varchar(80) not null,execution_status varchar(30) not null default 'RUNNING',
              current_state varchar(80) not null,initiated_by_actor varchar(60) not null
                references framework_actor_definition(actor_code),
              initiated_by varchar(100) not null,started_at timestamp not null default current_timestamp,
              completed_at timestamp,updated_at timestamp not null default current_timestamp)
            """);
        jdbc.execute("""
            create table framework_process_execution_event(
              event_id bigserial primary key,execution_id uuid not null
                references framework_process_execution(execution_id) on delete cascade,
              step_code varchar(80) not null,actor_code varchar(60) not null
                references framework_actor_definition(actor_code),
              command_code varchar(100) not null,from_state varchar(80) not null,to_state varchar(80) not null,
              idempotency_key varchar(160) not null,request_json text not null default '{}',
              result_json text not null default '{}',executed_by varchar(100) not null,
              executed_at timestamp not null default current_timestamp,
              unique(execution_id,idempotency_key))
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
              updated_at timestamp default current_timestamp,
              unique(process_code,step_code,audience))
            """);
        jdbc.execute("""
            create table comtnthemedefinition(
              theme_id text primary key,theme_nm text not null default '',theme_dc text default '',
              theme_type text default 'CUSTOM',color_config text default '{}',
              typography_config text default '{}',spacing_config text default '{}',
              border_config text default '{}',shadow_config text default '{}',
              class_prefix text default 'theme',is_default char(1) default 'N',
              use_at char(1),is_active char(1),updt_pnttm timestamp,
              updt_user_id text)
            """);
        jdbc.execute("""
            create table framework_screen_resource(
              screen_resource_id bigserial primary key,route_key text unique,
              layout_type text,source_kind text)
            """);
        jdbc.execute("""
            create table framework_page_design_assurance(
              screen_resource_id bigint primary key,actor_passed boolean not null,
              process_passed boolean not null,lineage_passed boolean not null,
              transition_passed boolean not null,admin_counterpart_passed boolean not null,
              test_passed boolean not null,design_gate_status text default 'PASSED',
              design_gate_issues text[] default '{}')
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
              unique(audience,route_path))
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
              security_contract text not null default '',permission_codes jsonb not null default '[]'::jsonb,
              api_verified boolean not null default false,database_verified boolean not null default false,
              authority_verified boolean not null default false,responsive_verified boolean not null default false,
              accessibility_verified boolean not null default false,
              exception_states_verified boolean not null default false,
              audit_evidence_ref text not null default '',contract_status text not null default 'REVIEW_REQUIRED',
              menu_verified boolean not null default true,
              updated_by text not null default 'SYSTEM',
              updated_at timestamp default current_timestamp,
              unique(process_code,step_code,audience,route_path))
            """);
        jdbc.execute("""
            create table framework_permission_requirement_v1(
              process_code text not null,step_code text not null,permission_code text not null,
              scope_type text not null,resource_contract jsonb not null default '{}'::jsonb,
              guard_contract jsonb not null default '{}'::jsonb,use_at char(1) not null default 'Y',
              updated_at timestamp default current_timestamp,
              unique(process_code,step_code,permission_code,scope_type))
            """);
        jdbc.execute("""
            create table framework_permission_grant_v1(
              actor_code text not null,permission_code text not null,scope_type text not null,
              effect text not null,use_at char(1) not null default 'Y')
            """);
        jdbc.execute("""
            create view framework_professional_screen_design_readiness as
            select contract.*,100::integer design_readiness_score
              from framework_professional_screen_contract contract
            """);
        jdbc.execute("""
            create table ui_section_registry(
              section_id text primary key,section_name text not null,section_type text not null,
              layout_contract text not null,responsive_contract text not null,
              accessibility_contract text not null,design_reference text,
              asset_fingerprint text,active_yn char(1) not null default 'Y',
              updated_at timestamp default current_timestamp)
            """);
        jdbc.execute("""
            create table ui_component_registry(
              component_id text primary key,component_name text not null,
              component_type text not null,owner_domain text not null,
              props_schema_json jsonb not null default '{}'::jsonb,
              design_reference text,default_props jsonb not null default '{}'::jsonb,
              category text default 'COMMON',asset_fingerprint text,
              active_yn char(1) not null default 'Y',updated_at timestamp default current_timestamp)
            """);
        jdbc.execute("""
            create table ui_page_manifest(
              page_id text primary key,page_name text not null default '',route_path text not null,
              layout_version text not null default 'v1',
              design_token_version text not null default 'KRDS_GOV_DEFAULT',
              component_schema text not null default '{}',version_id text,
              active_yn char(1) not null,updated_at timestamp default current_timestamp)
            """);
        jdbc.execute("""
            create table ui_page_component_map(
              map_id text primary key,page_id text not null,layout_zone text not null,
              component_id text not null,instance_key text not null,
              display_order integer not null default 0,
              conditional_rule_summary text not null default 'always',
              instance_props text not null default '{}',
              created_at timestamp default current_timestamp,
              updated_at timestamp default current_timestamp)
            """);
        jdbc.execute("""
            create table framework_common_design_asset_source_state(
              asset_type text not null,asset_id text not null,canonical_asset jsonb not null,
              asset_fingerprint char(64),updated_by text not null,
              created_at timestamptz default current_timestamp,
              updated_at timestamptz default current_timestamp,
              primary key(asset_type,asset_id))
            """);
        jdbc.execute("create table framework_common_design_write_probe(write_id bigserial primary key)");
        jdbc.execute("""
            create function framework_probe_common_design_write() returns trigger language plpgsql as $$
            begin insert into framework_common_design_write_probe default values; return new; end $$
            """);
        jdbc.execute("""
            create trigger probe_common_design_write after update on comtnthemedefinition
            for each row execute function framework_probe_common_design_write()
            """);
        jdbc.execute("""
            create table framework_design_asset_registry(
              design_asset_id text primary key,route_path text not null,
              source_path text not null,active_yn char(1) not null)
            """);
        jdbc.execute("""
            create table framework_screen_generation_batch(
              batch_id bigserial primary key,batch_code text unique,batch_name text,
              process_code text,requested_count integer,dry_run boolean,requested_by text,
              compiled_count integer default 0,valid_count integer default 0,
              invalid_count integer default 0,batch_status text default 'RUNNING',
              summary_json text,completed_at timestamp)
            """);
        jdbc.execute("""
            create table framework_screen_generation_batch_item(
              batch_id bigint,blueprint_id bigint,item_order integer,item_status text,
              validation_message text,unique(batch_id,blueprint_id))
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
            create table framework_development_job_event(
              event_id bigserial primary key,job_id bigint not null,event_type text not null,
              from_status text,to_status text,worker_id text,detail_json text,
              created_at timestamp default current_timestamp)
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
            create function framework_try_jsonb(value text,fallback jsonb)
            returns jsonb language plpgsql immutable as $$
            begin return value::jsonb; exception when others then return fallback; end $$
            """);
        jdbc.execute("""
            create function framework_canonical_screen_bundle(
              requested_process varchar,requested_step varchar,
              requested_audience varchar,requested_route varchar)
            returns jsonb language sql stable as $$
              with canonical as (
                select jsonb_build_object(
                  'processCode',requested_process,
                  'stepCode',requested_step,
                  'audience',upper(requested_audience),
                  'routePath',lower(split_part(requested_route,'?',1)),
                  'lanes',jsonb_build_object(
                    'HELP','{}'::jsonb,
                    'WORK_GUIDE','{}'::jsonb,
                    'QA','{}'::jsonb,
                    'DESIGN_CARD',jsonb_build_object(
                      'specification',coalesce((select framework_try_jsonb(specification_json)
                        from framework_screen_blueprint
                       where process_code=requested_process and step_code=requested_step
                         and upper(audience)=upper(requested_audience)
                         and lower(split_part(route_path,'?',1))=
                             lower(split_part(requested_route,'?',1)) limit 1),'{}'::jsonb)),
                    'FRONTEND',jsonb_build_object(
                      'manifest',coalesce((select to_jsonb(page)
                        from ui_page_manifest page
                       where page.page_id=(select page_id from framework_screen_blueprint
                         where process_code=requested_process and step_code=requested_step
                           and upper(audience)=upper(requested_audience)
                           and lower(split_part(route_path,'?',1))=
                               lower(split_part(requested_route,'?',1)) limit 1)),'{}'::jsonb),
                      'components',coalesce((select jsonb_agg(to_jsonb(mapping)
                          order by mapping.display_order,mapping.map_id)
                        from ui_page_component_map mapping
                       where mapping.page_id=(select page_id from framework_screen_blueprint
                         where process_code=requested_process and step_code=requested_step
                           and upper(audience)=upper(requested_audience)
                           and lower(split_part(route_path,'?',1))=
                               lower(split_part(requested_route,'?',1)) limit 1)),'[]'::jsonb)),
                    'API','[]'::jsonb,
                    'DATABASE','[]'::jsonb)) design
              ), encoded as (
                select design,design::text canonical_text from canonical
              )
              select jsonb_build_object(
                'schema','carbonet.canonical-design/v1',
                'catalogHash',null,
                'designHash',encode(sha256(convert_to(canonical_text,'UTF8')),'hex'),
                'canonicalText',canonical_text,
                'canonicalDesign',design)
                from encoded
            $$
            """);
        jdbc.execute("""
            create function framework_generate_professional_design_graph(
              requested_process varchar,requested_actor varchar)
            returns jsonb language sql as $$ select '{}'::jsonb $$
            """);
        jdbc.execute("""
            create function framework_refresh_process_flow_edges(requested_process varchar)
            returns jsonb language sql as $$ select '{}'::jsonb $$
            """);
        jdbc.execute("""
            create view framework_professional_design_graph_summary as
            select 1::bigint process_count,1::bigint step_count,
                   1::bigint ready_step_count,0::bigint blocked_step_count,
                   1::bigint screen_binding_count,0::bigint capability_binding_count,
                   0::bigint test_binding_count
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

    private void installProjectRuntimeWriteFenceFixture(){
        jdbc.execute("""
            CREATE TABLE framework_project_runtime_purge_receipt (
              receipt_id uuid PRIMARY KEY,
              operation_key uuid NOT NULL,
              project_id varchar(64) NOT NULL,
              process_code varchar(80) NOT NULL,
              design_version integer NOT NULL CHECK(design_version>0),
              contract_sha256 varchar(64) NOT NULL
                CHECK(contract_sha256 ~ '^[0-9a-f]{64}$'),
              scope_mode varchar(24) NOT NULL
                CHECK(scope_mode IN ('TEST_OWNED','QA_PROVENANCE','EXACT_PROJECT')),
              receipt_status varchar(16) NOT NULL
                CHECK(receipt_status IN (
                  'PREVIEWED','BLOCKED','PURGING','PURGED','RESTORING','RESTORED'
                )),
              snapshot_sha256 varchar(64) NOT NULL
                CHECK(snapshot_sha256 ~ '^[0-9a-f]{64}$'),
              impact_json jsonb NOT NULL CHECK(jsonb_typeof(impact_json)='object'),
              blocker_json jsonb NOT NULL CHECK(jsonb_typeof(blocker_json)='object'),
              postcondition_json jsonb NOT NULL DEFAULT '{}'::jsonb
                CHECK(jsonb_typeof(postcondition_json)='object'),
              requested_by varchar(120) NOT NULL,
              previewed_at timestamptz NOT NULL DEFAULT clock_timestamp(),
              purged_at timestamptz,
              restored_at timestamptz,
              updated_at timestamptz NOT NULL DEFAULT clock_timestamp(),
              UNIQUE(project_id,operation_key),
              CHECK(project_id=btrim(project_id)
                    AND project_id ~ '^[A-Z][A-Z0-9_-]{2,63}$'),
              CHECK(process_code=btrim(process_code)
                    AND process_code ~ '^[A-Z][A-Z0-9_:-]{1,79}$'),
              CHECK(requested_by=btrim(requested_by)
                    AND requested_by ~ '^[A-Za-z0-9._@-]{2,120}$')
            );
            """);
        jdbc.execute("""
            create function framework_guard_project_runtime_write_fence()
            returns trigger language plpgsql as $$ begin return new; end $$
            """);
        jdbc.execute("""
            create function framework_install_project_runtime_write_fences()
            returns integer language plpgsql as $$
            declare table_row record; installed integer:=0;
            begin
              for table_row in
                select relation.oid,namespace.nspname,relation.relname
                  from pg_class relation join pg_namespace namespace
                    on namespace.oid=relation.relnamespace
                 where namespace.nspname=current_schema()
                   and relation.relkind in('r','p') and not relation.relispartition
                   and relation.relname like 'integrated_design\\_%' escape '\\'
                   and exists(select 1 from pg_attribute attribute
                     where attribute.attrelid=relation.oid
                       and attribute.attname in('project_id','process_code')
                       and attribute.attnum>0 and not attribute.attisdropped)
                 order by relation.relname collate "C",relation.oid
              loop
                if not exists(select 1 from pg_trigger trigger_row
                  where trigger_row.tgrelid=table_row.oid
                    and trigger_row.tgname='trg_project_runtime_write_fence'
                    and not trigger_row.tgisinternal) then
                  execute format('create trigger trg_project_runtime_write_fence '
                    'before insert or update on %I.%I for each row '
                    'execute function framework_guard_project_runtime_write_fence()',
                    table_row.nspname,table_row.relname);
                  installed:=installed+1;
                end if;
              end loop;
              return installed;
            end $$
            """);
        jdbc.execute("select framework_install_project_runtime_write_fences()");
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

    private static final class RegistryLockPausingJdbcTemplate extends JdbcTemplate {
        private final CountDownLatch locksHeld;
        private final CountDownLatch continueWorker;

        private RegistryLockPausingJdbcTemplate(DriverManagerDataSource source,
                CountDownLatch locksHeld,CountDownLatch continueWorker){
            super(source);this.locksHeld=locksHeld;this.continueWorker=continueWorker;
        }

        @Override public void execute(String sql){
            super.execute(sql);
            if(sql.contains("lock table comtnthemedefinition")
                    &&sql.contains("ui_section_registry in share mode")){
                locksHeld.countDown();
                try{
                    if(!continueWorker.await(20,TimeUnit.SECONDS))
                        throw new IllegalStateException("REGISTRY_LOCK_WORKER_RELEASE_TIMEOUT");
                }catch(InterruptedException error){
                    Thread.currentThread().interrupt();throw new IllegalStateException(error);
                }
            }
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

    private String renderSafeMigrationSql(List<Map<String,Object>> changes) throws Exception{
        Path script=findRepositoryFile("ops/scripts/generate-safe-migrations-from-design.py");
        Path root=script.getParent().getParent().getParent();
        Path directory=Files.createTempDirectory("composite-marker-generator-");
        Path input=directory.resolve("PROC--STEP.json"),output=directory.resolve("migration.sql");
        try{
            Files.writeString(input,json(Map.of("process",Map.of("code","PROC"),
                "step",Map.of("code","STEP"),"database",Map.of(
                    "autoGenerateMigration",true,"schemaChanges",changes))),StandardCharsets.UTF_8);
            String python=System.getenv().getOrDefault("DIRECT_CODEGEN_PYTHON","python3");
            Process process=new ProcessBuilder(python,script.toString(),input.toString(),
                "--root",root.toString(),"--render-sql",output.toString())
                .redirectErrorStream(true).start();
            String log=new String(process.getInputStream().readAllBytes(),StandardCharsets.UTF_8);
            if(!process.waitFor(30,TimeUnit.SECONDS)){process.destroyForcibly();throw new IllegalStateException(
                "safe migration generator timed out");}
            if(process.exitValue()!=0)throw new IllegalStateException(
                "safe migration generator failed: "+log);
            return Files.readString(output,StandardCharsets.UTF_8);
        }finally{
            Files.deleteIfExists(output);Files.deleteIfExists(input);Files.deleteIfExists(directory);
        }
    }

    private Map<String,Object> compositePublicationXmins(){
        return jdbc.queryForMap("""
            select string_agg(authority_id||':'||authority_revision||':'||xmin::text,','
                     order by authority_id) as authorities,
                   (select string_agg(document_id||':'||revision||':'||xmin::text,','
                     order by document_id) from integrated_design_document) as documents,
                   (select string_agg(document_id||':'||revision||':'||xmin::text,','
                     order by document_id,revision)
                      from integrated_design_document_version) as document_versions,
                   (select string_agg(process_code||':'||step_code||':'||xmin::text,','
                     order by process_code,step_code)
                      from framework_step_execution_spec) as execution_specs,
                   (select string_agg(job_id||':'||xmin::text,',' order by job_id)
                     from framework_development_job) as jobs
              from integrated_design_authority
            """);
    }
}
