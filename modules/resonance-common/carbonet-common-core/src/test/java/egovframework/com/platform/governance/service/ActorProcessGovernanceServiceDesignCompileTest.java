package egovframework.com.platform.governance.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.platform.codex.service.CodexProvisioningService;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.lang.reflect.Method;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicInteger;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.spy;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ActorProcessGovernanceServiceDesignCompileTest {
    private static final ObjectMapper JSON=new ObjectMapper();
    private static final String ROUTE="/design/route";
    private static final String OLD_DESIGN="Professional carbon screen";
    private static final String NEW_DESIGN="Professional carbon screen!";
    private static final String FUNCTIONS="Validate input and persist evidence";
    private static final String ACCEPTANCE="DB reread and five QA scenarios pass";

    @Test
    void oneByteNoteCompilesIntoCanonicalSupportAndPublishesRuntime() throws Exception {
        Fixture fixture=fixture();
        Map<String,Object> compiled=compiled(NEW_DESIGN,"New title");
        Map<String,Object> before=bundle(null,"a".repeat(64));
        Map<String,Object> after=bundle(compiled,"b".repeat(64));
        fixture.canonical(before,after);
        fixture.identity(identity("[{\"professional\":\"preserved\"}]",
            "{\"assetBindings\":[{\"assetCode\":\"KRDS_FIELD\"}]}"));
        fixture.currentNote(note(OLD_DESIGN,"Old title"));
        fixture.writes(1,1);
        fixture.runtime(after);

        Map<String,Object> result=fixture.service.saveDesignAndGenerate(
            request("/Design/Route?preview=1",NEW_DESIGN,"New title"),"designer");

        assertEquals(true,result.get("success"));
        assertEquals(true,result.get("changed"));
        assertEquals(after.get("designHash"),result.get("designHash"));
        assertEquals(after.get("catalogHash"),result.get("catalogHash"));
        assertEquals(true,result.get("generationQueued"));
        assertEquals(1,result.get("jobCount"));
        assertEquals(2,result.get("endpointExpected"));
        assertEquals("c".repeat(64),result.get("sourceHash"));
        assertEquals(false,result.get("buildRequired"));
        assertEquals(ROUTE,result.get("routePath"));
        assertEquals(after.get("designHash"),
            ((Map<?,?>)result.get("runtimePublication")).get("designHash"));
        String support=JSON.writeValueAsString(result.get("support"));
        assertTrue(support.contains(NEW_DESIGN));
        assertTrue(support.contains(FUNCTIONS));
        assertTrue(support.contains(ACCEPTANCE));
        assertFalse(support.contains("\"text\":\""+OLD_DESIGN+"\""));
        verify(fixture.notes).save(any(),eq("designer"));
        verify(fixture.runtime).publishProfessionalContract(31L,"designer");
        var ordered=inOrder(fixture.jdbc,fixture.notes,fixture.service,fixture.runtime);
        ordered.verify(fixture.jdbc).query(
            argThat(sql->sql!=null&&sql.contains("pg_advisory_xact_lock")),
            any(org.springframework.jdbc.core.RowCallbackHandler.class),any(Object[].class));
        ordered.verify(fixture.jdbc).queryForList(
            argThat(sql->sql!=null&&sql.contains("for update of b,c")),any(Object[].class));
        ordered.verify(fixture.notes).find(ROUTE);
        ordered.verify(fixture.notes).save(any(),eq("designer"));
        ordered.verify(fixture.jdbc).update(argThat(sql->sql!=null&&sql.contains("next_contract")),any(Object[].class));
        ordered.verify(fixture.jdbc).update(argThat(sql->sql!=null&&sql.contains("next_blueprint")),any(Object[].class));
        ordered.verify(fixture.service).generateProfessionalDesignGraph("PROCESS_A","designer");
        ordered.verify(fixture.service).executeDesignDirectDevelopment(
            argThat(body->"STEP_A".equals(body.get("stepCode"))
                &&after.get("designHash").equals(body.get("designHash"))),eq("designer"));
        ordered.verify(fixture.runtime).publishProfessionalContract(31L,"designer");
    }

    @Test
    void unpublishedOrLegacyBlankCatalogStillPublishesByDesignHash() throws Exception {
        for(Object catalogHash:java.util.Arrays.asList(null,"  ")){
            Fixture fixture=fixture();
            Map<String,Object> compiled=compiled(NEW_DESIGN,"");
            Map<String,Object> before=bundle(null,catalogHash);
            Map<String,Object> after=bundle(compiled,catalogHash);
            fixture.canonical(before,after);
            fixture.identity(identity("[{\"stale\":true}]","{}"));
            fixture.currentNote(note(OLD_DESIGN,""));
            fixture.writes(1,1);
            fixture.runtime(after);

            Map<String,Object> result=fixture.service.saveDesignAndGenerate(
                request(ROUTE,NEW_DESIGN,""),"designer");

            assertEquals(true,result.get("changed"));
            assertEquals(after.get("designHash"),result.get("designHash"));
            assertTrue(result.containsKey("catalogHash"));
            assertEquals(catalogHash,result.get("catalogHash"));
            Map<?,?> publication=(Map<?,?>)result.get("runtimePublication");
            assertEquals(after.get("designHash"),publication.get("designHash"));
            assertTrue(publication.containsKey("catalogHash"));
            assertEquals(catalogHash,publication.get("catalogHash"));
            verify(fixture.notes).save(any(),eq("designer"));
            verify(fixture.runtime).publishProfessionalContract(31L,"designer");
        }
    }

    @Test
    void exactReplayIsNoOpAndDoesNotWriteOrPublish() throws Exception {
        Fixture fixture=fixture();
        Map<String,Object> compiled=compiled(NEW_DESIGN,"");
        Map<String,Object> stable=bundle(compiled,null);
        fixture.canonical(stable);
        fixture.identity(identity(JSON.writeValueAsString(List.of(compiled)),
            JSON.writeValueAsString(Map.of("extensions",Map.of("designAutomation",compiled),
                "assetBindings",List.of(Map.of("assetCode","KRDS_FIELD"))))));
        fixture.currentNote(note(NEW_DESIGN,""));

        Map<String,Object> result=fixture.service.saveDesignAndGenerate(
            request("/DESIGN/ROUTE",NEW_DESIGN,""),"designer");

        assertEquals(false,result.get("changed"));
        assertEquals("UNCHANGED",result.get("generationStatus"));
        assertEquals(stable.get("designHash"),result.get("designHash"));
        assertTrue(result.containsKey("catalogHash"));
        assertEquals(null,result.get("catalogHash"));
        Map<?,?> publication=(Map<?,?>)result.get("runtimePublication");
        assertEquals("UNCHANGED",publication.get("reason"));
        assertTrue(publication.containsKey("catalogHash"));
        assertEquals(null,publication.get("catalogHash"));
        assertEquals(false,result.get("buildRequired"));
        verify(fixture.notes,never()).save(any(),anyString());
        verify(fixture.jdbc,never()).update(anyString(),any(Object[].class));
        verify(fixture.runtime,never()).publishProfessionalContract(any(Long.class),anyString());
    }

    @Test
    void metadataOnlyChangeUpdatesCanonicalHashesAndPublishesRuntime() throws Exception {
        Fixture fixture=fixture();
        Map<String,Object> oldCompiled=compiled(NEW_DESIGN,"Old title");
        Map<String,Object> newCompiled=compiled(NEW_DESIGN,"New title");
        Map<String,Object> before=bundle(oldCompiled,"d".repeat(64));
        Map<String,Object> after=bundle(newCompiled,"f".repeat(64));
        fixture.canonical(before,after);
        fixture.identity(identity(JSON.writeValueAsString(List.of(oldCompiled)),
            JSON.writeValueAsString(Map.of("extensions",Map.of("designAutomation",oldCompiled),
                "assetBindings",List.of(Map.of("assetCode","KRDS_FIELD"))))));
        fixture.currentNote(note(NEW_DESIGN,"Old title"));
        fixture.writes(1,1);
        fixture.runtime(after);

        Map<String,Object> result=fixture.service.saveDesignAndGenerate(
            request(ROUTE,NEW_DESIGN,"New title"),"designer");

        Map<?,?> transition=(Map<?,?>)result.get("hashTransition");
        assertFalse(transition.get("beforeDesignHash").equals(transition.get("afterDesignHash")));
        assertFalse(transition.get("beforeCatalogHash").equals(transition.get("afterCatalogHash")));
        assertEquals(false,result.get("buildRequired"));
        verify(fixture.notes).save(any(),eq("designer"));
        verify(fixture.runtime).publishProfessionalContract(31L,"designer");
    }

    @Test
    void concurrentOtherRouteCatalogChangeDoesNotRollbackThisScreenPublication() throws Exception {
        Fixture fixture=fixture();
        Map<String,Object> compiled=compiled(NEW_DESIGN,"");
        Map<String,Object> before=bundle(null,"1".repeat(64));
        Map<String,Object> after=bundle(compiled,"2".repeat(64));
        fixture.canonical(before,after);
        fixture.identity(identity("[{\"stale\":true}]","{}"));
        fixture.currentNote(note(OLD_DESIGN,""));
        fixture.writes(1,1);
        when(fixture.runtime.publishProfessionalContract(31L,"designer")).thenReturn(Map.of(
            "published",true,"designHash",after.get("designHash"),
            "catalogHash","3".repeat(64),"buildRequired",false));

        Map<String,Object> result=fixture.service.saveDesignAndGenerate(
            request(ROUTE,NEW_DESIGN,""),"designer");

        assertEquals(after.get("designHash"),result.get("designHash"));
        assertEquals(after.get("catalogHash"),result.get("catalogHash"));
        assertEquals("3".repeat(64),
            ((Map<?,?>)result.get("runtimePublication")).get("catalogHash"));
        assertEquals(false,result.get("buildRequired"));
    }

    @Test
    void malformedOrNonExactIdentityFailsBeforeEveryWrite() {
        for(List<Map<String,Object>> rows:List.of(
                List.<Map<String,Object>>of(),
                List.of(identity("[]","{}"),identity("[]","{}")),
                List.of(identity("not-json","{}")))){
            Fixture fixture=fixture();
            fixture.identity(rows);
            assertThrows(RuntimeException.class,()->fixture.service.saveDesignAndGenerate(
                request(ROUTE,NEW_DESIGN,""),"designer"));
            verify(fixture.notes,never()).save(any(),anyString());
            verify(fixture.jdbc,never()).update(anyString(),any(Object[].class));
            verify(fixture.runtime,never()).publishProfessionalContract(any(Long.class),anyString());
        }
    }

    @Test
    void malformedOrNonStringCatalogHashFailsBeforeEveryWrite() throws Exception {
        for(Object invalidCatalogHash:List.of(
                "not-a-sha256",new java.math.BigInteger("1".repeat(64)))){
            Fixture fixture=fixture();
            fixture.canonical(bundle(null,invalidCatalogHash));
            fixture.identity(identity("[]","{}"));

            IllegalStateException error=assertThrows(IllegalStateException.class,
                ()->fixture.service.saveDesignAndGenerate(
                    request(ROUTE,NEW_DESIGN,""),"designer"));

            assertTrue(error.getMessage().contains("CANONICAL_BUNDLE_HASH_INVALID"));
            verify(fixture.notes,never()).find(anyString());
            verify(fixture.notes,never()).save(any(),anyString());
            verify(fixture.jdbc,never()).update(anyString(),any(Object[].class));
            verify(fixture.runtime,never()).publishProfessionalContract(
                any(Long.class),anyString());
        }
    }

    @Test
    void unchangedHashAfterCanonicalSourceWriteFailsForTransactionRollback() throws Exception {
        Fixture fixture=fixture();
        Map<String,Object> compiled=compiled(NEW_DESIGN,"");
        Map<String,Object> unchanged=bundle(compiled,"e".repeat(64));
        fixture.canonical(unchanged,unchanged);
        fixture.identity(identity("[{\"stale\":true}]","{}"));
        fixture.currentNote(note(NEW_DESIGN,""));
        fixture.writes(1,1);

        IllegalStateException error=assertThrows(IllegalStateException.class,
            ()->fixture.service.saveDesignAndGenerate(request(ROUTE,NEW_DESIGN,""),"designer"));
        assertTrue(error.getMessage().contains("CANONICAL_DESIGN_HASH_INVARIANT"));
        verify(fixture.runtime,never()).publishProfessionalContract(any(Long.class),anyString());
        Method method=ActorProcessGovernanceService.class.getMethod(
            "saveDesignAndGenerate",Map.class,String.class);
        assertNotNull(method.getAnnotation(Transactional.class));
    }

    @Test
    void queueFailureHappensBeforeRuntimePublicationForTransactionRollback() throws Exception {
        Fixture fixture=fixture();
        Map<String,Object> compiled=compiled(NEW_DESIGN,"");
        Map<String,Object> before=bundle(null,"1".repeat(64));
        Map<String,Object> after=bundle(compiled,"2".repeat(64));
        fixture.canonical(before,after);
        fixture.identity(identity("[{\"stale\":true}]","{}"));
        fixture.currentNote(note(OLD_DESIGN,""));
        fixture.writes(1,1);
        doThrow(new IllegalStateException("STRUCTURED_GENERATION_SPEC_NOT_EXACT"))
            .when(fixture.service).executeDesignDirectDevelopment(
                argThat(body->"STEP_A".equals(body.get("stepCode"))),eq("designer"));

        IllegalStateException error=assertThrows(IllegalStateException.class,
            ()->fixture.service.saveDesignAndGenerate(
                request(ROUTE,NEW_DESIGN,""),"designer"));

        assertTrue(error.getMessage().contains("STRUCTURED_GENERATION_SPEC_NOT_EXACT"));
        verify(fixture.runtime,never()).publishProfessionalContract(any(Long.class),anyString());
        Method method=ActorProcessGovernanceService.class.getMethod(
            "saveDesignAndGenerate",Map.class,String.class);
        assertNotNull(method.getAnnotation(Transactional.class));
    }

    private static Fixture fixture(){
        JdbcTemplate jdbc=mock(JdbcTemplate.class);
        ScreenDevelopmentNoteService notes=mock(ScreenDevelopmentNoteService.class);
        ScreenContractRuntimeService runtime=mock(ScreenContractRuntimeService.class);
        ActorProcessGovernanceService service=spy(new ActorProcessGovernanceService(
            jdbc,notes,mock(CodexProvisioningService.class),runtime));
        doReturn(Map.of("success",true)).when(service)
            .generateProfessionalDesignGraph(eq("PROCESS_A"),anyString());
        doReturn(Map.of(
            "success",true,"status","QUEUED","generationQueued",true,"jobCount",1,
            "jobId",91L,"designHash","d".repeat(64),"sourceHash","c".repeat(64),
            "endpointExpected",2,"publishCount",0)).when(service)
            .executeDesignDirectDevelopment(
                argThat(body->body!=null&&"STEP_A".equals(body.get("stepCode"))),anyString());
        when(jdbc.queryForMap(argThat(sql->sql!=null&&sql.contains("count(*) as step_count")),any(Object[].class)))
            .thenReturn(Map.of("step_count",0,"incomplete_step_count",0,
                "missing_user_contract_count",0,"missing_admin_contract_count",0));
        when(jdbc.queryForObject(argThat(sql->sql!=null&&sql.contains("framework_simulation_case")),
            eq(Integer.class),any(Object[].class))).thenReturn(0);
        when(jdbc.queryForObject(argThat(sql->sql!=null&&sql.contains("count(distinct case_type)")),
            eq(Integer.class),any(Object[].class))).thenReturn(5);
        when(jdbc.queryForObject(argThat(sql->sql!=null&&sql.contains("framework_design_self_healing_run")),
            eq(UUID.class),any(Object[].class))).thenReturn(UUID.randomUUID());
        return new Fixture(jdbc,notes,runtime,service);
    }

    private record Fixture(JdbcTemplate jdbc,ScreenDevelopmentNoteService notes,
            ScreenContractRuntimeService runtime,ActorProcessGovernanceService service){
        void identity(Map<String,Object> row){identity(List.of(row));}
        void identity(List<Map<String,Object>> rows){
            when(jdbc.queryForList(argThat(sql->sql!=null&&sql.contains("for update of b,c")),any(Object[].class)))
                .thenReturn(rows);
            when(jdbc.queryForList(argThat(sql->sql!=null&&sql.contains("validation_message as \"validationMessage\"")),
                any(Object[].class))).thenReturn(List.of(Map.of("validationStatus","VALID")));
        }
        void currentNote(Map<String,Object> row){when(notes.find(ROUTE)).thenReturn(row);when(notes.save(any(),anyString())).thenReturn(row);}
        void canonical(Map<String,Object>... bundles) throws Exception {
            AtomicInteger index=new AtomicInteger();
            when(jdbc.queryForObject(argThat(sql->sql!=null&&sql.contains("framework_canonical_screen_bundle")),
                eq(String.class),any(Object[].class))).thenAnswer(call->
                    JSON.writeValueAsString(bundles[Math.min(index.getAndIncrement(),bundles.length-1)]));
        }
        void writes(int contract,int blueprint){
            when(jdbc.update(argThat(sql->sql!=null&&sql.contains("next_contract")),any(Object[].class))).thenReturn(contract);
            when(jdbc.update(argThat(sql->sql!=null&&sql.contains("next_blueprint")),any(Object[].class))).thenReturn(blueprint);
        }
        void runtime(Map<String,Object> bundle){
            Map<String,Object> publication=new LinkedHashMap<>();
            publication.put("published",true);
            publication.put("designHash",bundle.get("designHash"));
            publication.put("catalogHash",bundle.get("catalogHash"));
            publication.put("buildRequired",false);
            when(runtime.publishProfessionalContract(31L,"designer"))
                .thenReturn(publication);
        }
    }

    private static Map<String,Object> request(String route,String design,String title){
        Map<String,Object> body=new LinkedHashMap<>();
        body.put("routePath",route);body.put("pageId","");body.put("pageTitle",title);
        body.put("designNote",design);body.put("functionNote",FUNCTIONS);
        body.put("acceptanceNote",ACCEPTANCE);body.put("status","READY");return body;
    }

    private static Map<String,Object> note(String design,String title){
        Map<String,Object> value=new LinkedHashMap<>();value.put("routePath",ROUTE);
        value.put("pageId","");value.put("pageTitle",title);value.put("designNote",design);
        value.put("functionNote",FUNCTIONS);value.put("acceptanceNote",ACCEPTANCE);
        value.put("status","READY");value.put("version",2);return value;
    }

    private static Map<String,Object> identity(String evidence,String specification){
        Map<String,Object> row=new LinkedHashMap<>();row.put("blueprintId",41L);row.put("contractId",31L);
        row.put("processCode","PROCESS_A");row.put("stepCode","STEP_A");row.put("audience","USER");
        row.put("routePath",ROUTE);row.put("sectionContract","[{\"id\":\"summary\"}]");
        row.put("fieldContract","[{\"id\":\"amount\"}]");row.put("commandContract","[\"SAVE\"]");
        row.put("stateContract","[\"READY\"]");row.put("apiContract","[{\"method\":\"POST\"}]");
        row.put("dataContract","[{\"table\":\"record\"}]");row.put("evidenceContract",evidence);
        row.put("specificationJson",specification);row.put("traceabilityJson","{}");return row;
    }

    private static Map<String,Object> compiled(String design,String title) throws Exception {
        Map<String,Object> value=new LinkedHashMap<>();value.put("schema","carbonet.design-note/v1");
        value.put("namespace","CARBONET_DESIGN_AUTOMATION_V1");value.put("routePath",ROUTE);
        value.put("design",typed("DESIGN_REQUIREMENT",design));
        value.put("functions",typed("FUNCTION_REQUIREMENT",FUNCTIONS));
        value.put("acceptance",typed("ACCEPTANCE_RULE",ACCEPTANCE));
        Map<String,Object> page=new LinkedHashMap<>();page.put("pageId","");
        page.put("pageTitle",title);page.put("status","READY");value.put("page",page);
        value.put("noteHash",sha(JSON.writeValueAsString(value)));return value;
    }

    private static Map<String,Object> typed(String type,String text){
        Map<String,Object> value=new LinkedHashMap<>();value.put("type",type);value.put("text",text);return value;
    }

    private static Map<String,Object> bundle(Map<String,Object> compiled,Object catalogHash) throws Exception {
        List<Object> evidence=compiled==null?List.of("professional-evidence"):List.of("professional-evidence",compiled);
        Map<String,Object> specification=new LinkedHashMap<>();
        specification.put("assetBindings",List.of(Map.of("assetCode","KRDS_FIELD")));
        if(compiled!=null)specification.put("extensions",Map.of("designAutomation",compiled));
        Map<String,Object> lanes=new LinkedHashMap<>();
        lanes.put("HELP",Map.of("evidence",evidence,"items",List.of(Map.of("id","summary"))));
        lanes.put("WORK_GUIDE",Map.of("steps",List.of(Map.of("code","STEP_A")),"nextAction",Map.of("routePath",ROUTE)));
        lanes.put("QA",Map.of("evidence",evidence,"checks",List.of(Map.of("code","QA"))));
        lanes.put("DESIGN_CARD",Map.of("specification",specification,
            "assetBindings",List.of(Map.of("assetCode","KRDS_FIELD"))));
        lanes.put("FRONTEND",Map.of("routePath",ROUTE));
        lanes.put("API",List.of(Map.of("method","POST")));
        lanes.put("DATABASE",List.of(Map.of("table","record")));
        Map<String,Object> design=new LinkedHashMap<>();design.put("identity",Map.of("routePath",ROUTE));
        design.put("process",Map.of("processCode","PROCESS_A"));design.put("step",Map.of("stepCode","STEP_A"));
        design.put("lanes",lanes);String canonicalText=JSON.writeValueAsString(design);
        Map<String,Object> bundle=new LinkedHashMap<>();bundle.put("schema","carbonet.canonical-design/v1");
        bundle.put("catalogHash",catalogHash);bundle.put("designHash",sha(canonicalText));
        bundle.put("canonicalText",canonicalText);bundle.put("canonicalDesign",design);return bundle;
    }

    private static String sha(String text) throws Exception {
        return java.util.HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
            .digest(text.getBytes(StandardCharsets.UTF_8)));
    }
}
