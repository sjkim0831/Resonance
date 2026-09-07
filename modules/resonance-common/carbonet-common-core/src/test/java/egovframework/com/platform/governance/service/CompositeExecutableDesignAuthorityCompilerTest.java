package egovframework.com.platform.governance.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class CompositeExecutableDesignAuthorityCompilerTest {
    private static final ObjectMapper JSON=new ObjectMapper();
    private static final String PROCESS="PROCESS_A",STEP="STEP_A",ROUTE="/work/a",AUDIENCE="USER";
    private static final List<String> TEST_STATUSES=List.of(
        "SUCCESS","VALIDATION_ERROR","FORBIDDEN","CONFLICT","RECOVERY");

    @Test
    void compilesAllEighteenAxesIntoOneReviewableHashAuthority(){
        var compiled=CompositeExecutableDesignAuthorityCompiler.compile(
            PROCESS,STEP,ROUTE,AUDIENCE,documents(),source());
        assertEquals(18,((List<?>)compiled.composite().get("axes")).size());
        assertTrue(compiled.authorityHash().matches("[0-9a-f]{64}"));
        assertTrue(compiled.documentSetHash().matches("[0-9a-f]{64}"));
        assertTrue(String.valueOf(compiled.resolvedClosure().get("reviewText")).contains(
            "10. 엔드포인트: [POST /api/work/{executionId}/a]"));
        assertEquals(List.of("PERM_SAVE"),compiled.resolvedClosure().get("permissionCodes"));
        assertEquals(2,compiled.evidence().size());
    }

    @Test
    void stableHashMatchesPythonForUtf16ControlKoreanLargeIntegerAndNegativeZero(){
        Map<String,Object> adversarial=new LinkedHashMap<>();
        adversarial.put("\ue000",-0.0d);
        adversarial.put("😀",9_007_199_254_740_991L);
        adversarial.put("ctrl\u0001","한글");
        assertEquals("f12d8564fa9d0eb632424e132f0cdb5b0c63d142dc7f98c3dc7a36a67b15415c",
            CompositeExecutableDesignAuthorityCompiler.hash(
                CompositeExecutableDesignAuthorityCompiler.stable(adversarial)));
        Map<String,Object> malformed=new LinkedHashMap<>();malformed.put("bad","\ud800");
        assertThrows(IllegalArgumentException.class,()->
            CompositeExecutableDesignAuthorityCompiler.stable(malformed));
    }

    @Test
    void losslesslyDerivedRuleValidationAndTestAxesAreExecutable(){
        Map<String,Map<String,Object>> inferred=documents();
        inferred.values().forEach(row->row.put("updatedBy","LIVE_CONTRACT_BACKFILL"));
        assertEquals(18,((List<?>)compile(inferred,source()).composite().get("axes")).size());
    }

    @Test
    void sameRouteUserAndAdminCompileToDistinctAudienceAuthorities(){
        var user=CompositeExecutableDesignAuthorityCompiler.compile(
            PROCESS,STEP,ROUTE,"USER",documents("USER"),source());
        var admin=CompositeExecutableDesignAuthorityCompiler.compile(
            PROCESS,STEP,ROUTE,"ADMIN",documents("ADMIN"),source());
        assertTrue(!user.authorityHash().equals(admin.authorityHash()));
        assertEquals("USER",user.resolvedClosure().get("audience"));
        assertEquals("ADMIN",admin.resolvedClosure().get("audience"));
    }

    @Test
    void everyAxisMutationFailsClosed(){
        for(String type:CompositeExecutableDesignAuthorityCompiler.DOCUMENT_TYPES){
            Map<String,Map<String,Object>> documents=documents();
            Map<String,Object> axis=read(String.valueOf(documents.get(type).get("content")));
            Map<String,Object> payload=map(axis.get("payload"));
            mutate(type,payload);
            documents.get(type).put("content",write(axis));
            RuntimeException failure=assertThrows(RuntimeException.class,()->
                CompositeExecutableDesignAuthorityCompiler.compile(
                    PROCESS,STEP,ROUTE,AUDIENCE,documents,source()),type);
            assertTrue(!failure.getMessage().isBlank(),type);
        }
    }

    @Test
    void duplicateUnknownAndUnregisteredComponentAreRejected(){
        String duplicate=String.valueOf(documents().get("REQUIREMENT").get("content"))
            .replace("\"workTypeCode\":\"WORK\"",
                "\"workTypeCode\":\"WORK\",\"workTypeCode\":\"WORK\"");
        assertThrows(IllegalArgumentException.class,()->
            CompositeExecutableDesignAuthorityCompiler.parseAxis(
                duplicate,"REQUIREMENT",PROCESS,STEP,ROUTE));
        Map<String,Map<String,Object>> unknown=documents();
        Map<String,Object> axis=read(String.valueOf(unknown.get("API").get("content")));
        map(axis.get("payload")).put("ignoredSilentField",true);
        unknown.get("API").put("content",write(axis));
        assertThrows(IllegalArgumentException.class,()->
            CompositeExecutableDesignAuthorityCompiler.compile(
                PROCESS,STEP,ROUTE,AUDIENCE,unknown,source()));
        Map<String,Object> unregistered=source();unregistered.put("registeredAssetCount",2);
        assertThrows(IllegalStateException.class,()->
            CompositeExecutableDesignAuthorityCompiler.compile(
                PROCESS,STEP,ROUTE,AUDIENCE,documents(),unregistered));
        Map<String,Object> fractional=read(String.valueOf(
            documents().get("REQUIREMENT").get("content")));
        map(fractional.get("identity")).put("contractId",1.5d);
        assertThrows(IllegalArgumentException.class,()->
            CompositeExecutableDesignAuthorityCompiler.parseAxis(
                write(fractional),"REQUIREMENT",PROCESS,STEP,ROUTE));
        Map<String,Map<String,Object>> nullable=documents();
        Map<String,Object> requirement=read(String.valueOf(nullable.get("REQUIREMENT").get("content")));
        map(((List<?>)map(requirement.get("payload")).get("kpis")).get(0)).put("description",null);
        nullable.get("REQUIREMENT").put("content",write(requirement));
        assertThrows(IllegalArgumentException.class,()->
            CompositeExecutableDesignAuthorityCompiler.compile(
                PROCESS,STEP,ROUTE,AUDIENCE,nullable,source()));
    }

    @Test
    void exactPermissionAdoptAssetStateDataApiTestAndJsonFormMutantsFailClosed(){
        Map<String,Object> permissionSubset=source();permissionSubset.put("permissionRequirementCount",2);
        assertThrows(IllegalStateException.class,()->compile(documents(),permissionSubset));

        Map<String,Object> noJsonForm=source();noJsonForm.put("jsonFormAssetCount",0);
        assertThrows(IllegalStateException.class,()->compile(documents(),noJsonForm));

        Map<String,Map<String,Object>> extraAsset=documents();Map<String,Object> assetAxis=axis(extraAsset,"DESIGN_ASSET");
        map(assetAxis.get("payload")).put("assetBindings",List.of(
            linked("assetType","THEME","assetCode","KRDS_GOV_DEFAULT"),
            linked("assetType","SECTION","assetCode","MAIN"),
            linked("assetType","COMPONENT","assetCode","FORM"),
            linked("assetType","COMPONENT","assetCode","UNUSED")));
        replaceAxis(extraAsset,"DESIGN_ASSET",assetAxis);
        assertThrows(IllegalStateException.class,()->compile(extraAsset,source()));

        Map<String,Map<String,Object>> extraState=documents();Map<String,Object> stateAxis=axis(extraState,"STATE");
        ((List<Object>)map(stateAxis.get("payload")).get("states")).add(
            linked("fromState","DONE","commandCode","UNKNOWN","toState","DONE"));
        replaceAxis(extraState,"STATE",stateAxis);
        assertThrows(IllegalStateException.class,()->compile(extraState,source()));

        Map<String,Map<String,Object>> crossedDb=documents();
        Map<String,Object> fieldsAxis=axis(crossedDb,"FIELD_DICTIONARY");
        List<?> fields=(List<?>)map(fieldsAxis.get("payload")).get("fields");
        map(fields.get(0)).put("dataSource","E1");map(fields.get(1)).put("dataSource","E2");
        replaceAxis(crossedDb,"FIELD_DICTIONARY",fieldsAxis);
        Map<String,Object> dbAxis=axis(crossedDb,"DATABASE");map(dbAxis.get("payload")).put("entities",List.of(
            linked("entity","E1","fields",List.of("id")),linked("entity","E2","fields",List.of("name"))));
        replaceAxis(crossedDb,"DATABASE",dbAxis);crossedDb.values().forEach(row->row.put("updatedBy","MANUAL"));
        assertThrows(IllegalStateException.class,()->compile(crossedDb,source()));

        Map<String,Map<String,Object>> crossedApi=documents();Map<String,Object> apiAxis=axis(crossedApi,"API");
        Map<String,Object> operation=map(((List<?>)map(apiAxis.get("payload")).get("operations")).get(0));
        operation.put("requestFields",List.of("id"));operation.put("responseFields",List.of("name"));
        replaceAxis(crossedApi,"API",apiAxis);crossedApi.values().forEach(row->row.put("updatedBy","MANUAL"));
        assertThrows(IllegalStateException.class,()->compile(crossedApi,source()));

        Map<String,Map<String,Object>> crossedTest=documents();Map<String,Object> testAxis=axis(crossedTest,"TEST");
        Map<String,Object> scenario=map(((List<?>)map(testAxis.get("payload")).get("scenarios")).get(0));
        scenario.put("inputValues",Map.of("id",1));scenario.put("expectedOutputFields",List.of("name"));
        replaceAxis(crossedTest,"TEST",testAxis);crossedTest.values().forEach(row->row.put("updatedBy","MANUAL"));
        assertThrows(IllegalStateException.class,()->compile(crossedTest,source()));

        Map<String,Map<String,Object>> adopt=documents();
        adopt.forEach((type,row)->{Map<String,Object> value=axis(adopt,type);
            map(value.get("identity")).put("ownershipStrategy","PRESERVE_ADOPT");replaceAxis(adopt,type,value);});
        Map<String,Object> adoptAsset=axis(adopt,"DESIGN_ASSET");
        map(adoptAsset.get("payload")).put("adoptMutationPolicy","PRESERVE");
        replaceAxis(adopt,"DESIGN_ASSET",adoptAsset);Map<String,Object> adoptSource=source();
        adoptSource.put("implementationStrategy","ADOPT_EXISTING");adoptSource.put("adoptCount",1);
        adoptSource.put("currentAssetBindings","[]");
        assertThrows(IllegalStateException.class,()->compile(adopt,adoptSource));

        Map<String,Map<String,Object>> nonPhysical=documents();
        Map<String,Object> nonPhysicalApi=axis(nonPhysical,"API");
        map(((List<?>)map(nonPhysicalApi.get("payload")).get("operations")).get(0))
            .put("path","/api/work/a");
        replaceAxis(nonPhysical,"API",nonPhysicalApi);
        assertThrows(IllegalArgumentException.class,()->compile(nonPhysical,source()));
    }

    @Test
    void distinctCommandInputOutputAndPermissionSubsetsCloseExactly(){
        Map<String,Map<String,Object>> documents=twoCommandDocuments();
        Map<String,Object> source=twoCommandSource(documents);
        var compiled=compile(documents,source);
        assertEquals(2,((List<?>)compiled.resolvedClosure().get("functions")).size());
        assertEquals(10,((List<?>)map(axis(documents,"TEST").get("payload")).get("scenarios")).size());

        Map<String,Map<String,Object>> swapped=twoCommandDocuments();
        Map<String,Object> api=axis(swapped,"API");
        List<?> operations=(List<?>)map(api.get("payload")).get("operations");
        map(operations.get(0)).put("requestFields",List.of("amount"));
        map(operations.get(0)).put("responseFields",List.of("status"));
        map(operations.get(1)).put("requestFields",List.of("name"));
        map(operations.get(1)).put("responseFields",List.of("id"));
        replaceAxis(swapped,"API",api);swapped.values().forEach(row->row.put("updatedBy","MANUAL"));
        assertThrows(RuntimeException.class,()->compile(swapped,twoCommandSource(swapped)));

        Map<String,Map<String,Object>> duplicate=twoCommandDocuments();
        Map<String,Object> duplicateApi=axis(duplicate,"API");
        map(((List<?>)map(duplicateApi.get("payload")).get("operations")).get(1)).put("commandCode","SAVE");
        replaceAxis(duplicate,"API",duplicateApi);duplicate.values().forEach(row->row.put("updatedBy","MANUAL"));
        assertThrows(IllegalStateException.class,()->compile(duplicate,twoCommandSource(duplicate)));
    }

    @Test
    void everyCommandRequiresEachExpectedTestStatusExactlyOnce(){
        Map<String,Map<String,Object>> positive=documents();
        assertEquals(5,((List<?>)map(axis(positive,"TEST").get("payload")).get("scenarios")).size());
        compile(positive,source());

        Map<String,Map<String,Object>> successOnly=documents();
        replacePayload(successOnly,"TEST","scenarios",List.of(
            testScenario("SAVE","SUCCESS",Map.of("name","sample"),List.of("id"))));
        IllegalStateException successFailure=assertThrows(IllegalStateException.class,
            ()->compile(successOnly,source()));
        assertTrue(successFailure.getMessage().contains("TEST_EXPECTED_STATUS_COVERAGE_NOT_EXACT"));

        Map<String,Map<String,Object>> missing=documents();
        List<Map<String,Object>> missingScenarios=new ArrayList<>(
            testScenarios("SAVE",Map.of("name","sample"),List.of("id")));
        missingScenarios.removeIf(row->"RECOVERY".equals(row.get("expectedStatus")));
        replacePayload(missing,"TEST","scenarios",missingScenarios);
        IllegalStateException missingFailure=assertThrows(IllegalStateException.class,
            ()->compile(missing,source()));
        assertTrue(missingFailure.getMessage().contains("TEST_EXPECTED_STATUS_COVERAGE_NOT_EXACT"));

        Map<String,Map<String,Object>> duplicate=documents();
        List<Map<String,Object>> duplicatedScenarios=new ArrayList<>(
            testScenarios("SAVE",Map.of("name","sample"),List.of("id")));
        Map<String,Object> duplicated=new LinkedHashMap<>(duplicatedScenarios.get(0));
        duplicated.put("scenarioCode","SAVE_SUCCESS_DUPLICATE");duplicatedScenarios.add(duplicated);
        replacePayload(duplicate,"TEST","scenarios",duplicatedScenarios);
        IllegalStateException duplicateFailure=assertThrows(IllegalStateException.class,
            ()->compile(duplicate,source()));
        assertTrue(duplicateFailure.getMessage().contains("TEST_EXPECTED_STATUS_DUPLICATE"));
    }

    @Test
    void zeroFieldScreenIsExecutableButNullValidationFieldFailsClosed(){
        Map<String,Map<String,Object>> zero=documents();
        replacePayload(zero,"FIELD_DICTIONARY","fields",List.of());
        replacePayload(zero,"DATA_HANDOFF","inputs",List.of());
        replacePayload(zero,"DATA_HANDOFF","outputs",List.of());
        replacePayload(zero,"DATABASE","entities",List.of());
        Map<String,Object> zeroDatabase=axis(zero,"DATABASE");
        map(zeroDatabase.get("payload")).put("migrationMode","NO_DATABASE");
        map(zeroDatabase.get("payload")).put("schemaChanges",List.of());
        map(zeroDatabase.get("payload")).put("schemaFingerprint",schemaHash(List.of()));
        replaceAxis(zero,"DATABASE",zeroDatabase);
        replacePayload(zero,"BUSINESS_RULE","rules",List.of());
        replacePayload(zero,"VALIDATION","rules",List.of());
        Map<String,Object> api=axis(zero,"API");
        map(api.get("payload")).put("operations",List.of(apiOperation(
            "/api/work/{executionId}/a","SAVE",List.of(),List.of(),List.of("PERM_SAVE"))));
        replaceAxis(zero,"API",api);
        replacePayload(zero,"TEST","scenarios",testScenarios("SAVE",Map.of(),List.of()));
        zero.values().forEach(row->row.put("updatedBy","MANUAL"));
        Map<String,Object> source=source();source.put("stepInputContract","{}");source.put("stepOutputContract","{}");
        RuntimeException zeroFailure=assertThrows(RuntimeException.class,
            ()->compile(zero,source));
        assertTrue(zeroFailure.getMessage().contains("TEST_VALIDATION_TRIGGER_NOT_EXACT"));

        Map<String,Map<String,Object>> nullable=documents();Map<String,Object> validation=axis(nullable,"VALIDATION");
        map(((List<?>)map(validation.get("payload")).get("rules")).get(0)).put("fieldCode",null);
        replaceAxis(nullable,"VALIDATION",validation);
        assertThrows(IllegalArgumentException.class,()->compile(nullable,source()));
    }

    @Test
    void duplicateDatabaseTableIsRejectedBeforeSourceProjection(){
        Map<String,Map<String,Object>> duplicate=documents();
        Map<String,Object> database=axis(duplicate,"DATABASE");
        Map<String,Object> payload=map(database.get("payload"));
        Map<String,Object> change=map(((List<?>)payload.get("schemaChanges")).get(0));
        List<Map<String,Object>> changes=List.of(change,new LinkedHashMap<>(change));
        payload.put("schemaChanges",changes);payload.put("schemaFingerprint",schemaHash(changes));
        replaceAxis(duplicate,"DATABASE",database);
        duplicate.values().forEach(row->row.put("updatedBy","MANUAL"));
        IllegalArgumentException failure=assertThrows(IllegalArgumentException.class,
            ()->compile(duplicate,source()));
        assertTrue(failure.getMessage().contains("DATABASE_TABLE_DUPLICATE"),failure.getMessage());
    }

    @Test
    void executableArtifactsBindNoteOnlyAxesAndStepScopeRejectsApiDrift(){
        var baseline=compile(documents(),source());
        Map<String,Map<String,Object>> rules=documents();Map<String,Object> ruleAxis=axis(rules,"BUSINESS_RULE");
        map(((List<?>)map(ruleAxis.get("payload")).get("rules")).get(0)).put("expectedValue","durably saved");
        replaceAxis(rules,"BUSINESS_RULE",ruleAxis);rules.values().forEach(row->row.put("updatedBy","MANUAL"));
        var changedRule=compile(rules,source());
        assertTrue(!baseline.executableDesignHash().equals(changedRule.executableDesignHash()));
        assertTrue(!baseline.authorityHash().equals(changedRule.authorityHash()));
        assertTrue(!baseline.artifactManifest().get("payloadHash").equals(
            changedRule.artifactManifest().get("payloadHash")));

        Map<String,Map<String,Object>> screenScoped=documents();
        Map<String,Object> authority=axis(screenScoped,"AUTHORITY");
        map(authority.get("payload")).put("permissionCodes",List.of("PERM_VIEW"));
        replaceAxis(screenScoped,"AUTHORITY",authority);
        Map<String,Object> permissionApi=axis(screenScoped,"API");
        map(((List<?>)map(permissionApi.get("payload")).get("operations")).get(0))
            .put("permissionCodes",List.of("PERM_VIEW"));
        replaceAxis(screenScoped,"API",permissionApi);
        screenScoped.values().forEach(row->row.put("updatedBy","MANUAL"));
        var screenVariant=compile(screenScoped,source());
        assertEquals(baseline.sharedStepHash(),screenVariant.sharedStepHash());

        Map<String,Map<String,Object>> apiDrift=documents();Map<String,Object> api=axis(apiDrift,"API");
        map(((List<?>)map(api.get("payload")).get("operations")).get(0)).put(
            "path","/api/work/{executionId}/b");
        replaceAxis(apiDrift,"API",api);apiDrift.values().forEach(row->row.put("updatedBy","MANUAL"));
        assertTrue(!baseline.sharedStepHash().equals(compile(apiDrift,source()).sharedStepHash()));
    }

    private static CompositeExecutableDesignAuthorityCompiler.Compilation compile(
            Map<String,Map<String,Object>> documents,Map<String,Object> source){
        return CompositeExecutableDesignAuthorityCompiler.compile(
            PROCESS,STEP,ROUTE,AUDIENCE,documents,source);
    }

    private static Map<String,Object> axis(Map<String,Map<String,Object>> documents,String type){
        return read(String.valueOf(documents.get(type).get("content")));
    }

    private static void replaceAxis(Map<String,Map<String,Object>> documents,String type,
            Map<String,Object> axis){documents.get(type).put("content",write(axis));}

    private static Map<String,Map<String,Object>> documents(){
        return documents(AUDIENCE);
    }

    private static Map<String,Map<String,Object>> documents(String audience){
        Map<String,Object> identity=linked("contractId",11,"processCode",PROCESS,"stepCode",STEP,
            "routePath",ROUTE,"audience",audience,"selectedBlueprintId",21,
            "ownershipStrategy","EXACT_SINGLE","ownershipJustification","exact generated source ownership");
        Map<String,Object> payloads=new LinkedHashMap<>();
        payloads.put("REQUIREMENT",linked("workTypeCode","WORK","businessPurpose","Complete work safely",
            "entryCondition","Draft exists","exitCondition","Saved record is returned",
            "kpis",List.of(linked("kpiCode","DONE","description","Completed"))));
        payloads.put("ACTOR_RACI",linked("actorCode","ACTOR","ownerActorCode","ACTOR",
            "responsibleActorCodes",List.of("ACTOR"),"accountBindingMode","RUNTIME_AUTHORITY","relayTestRequired",true));
        payloads.put("AUTHORITY",linked("permissionCodes",List.of("PERM_SAVE"),
            "securityContract","Server actor scope","serverEnforced",true));
        payloads.put("PROCESS",linked("stepOrder",1,"commandCode","SAVE","fromState","DRAFT",
            "toState","DONE","completionRule","record is saved","commands",
            List.of(linked("commandCode","SAVE","actorCode","ACTOR","primary",true))));
        payloads.put("STATE",linked("states",List.of(linked(
            "fromState","DRAFT","commandCode","SAVE","toState","DONE"))));
        payloads.put("NAVIGATION",linked("routePath",ROUTE,"audience",audience,"nextRoutes",List.of()));
        payloads.put("ACTIVE_UI",linked("sectionOrder",List.of("MAIN"),
            "responsiveContract","360 768 1280","accessibilityContract","KRDS WCAG AA",
            "responsiveVerified",true,"accessibilityVerified",true));
        List<Map<String,Object>> sections=List.of(linked("sectionId","MAIN","componentCodes",List.of("FORM")));
        List<Map<String,Object>> bindings=List.of(linked("assetType","THEME","assetCode","KRDS_GOV_DEFAULT"),
            linked("assetType","SECTION","assetCode","MAIN"),linked("assetType","COMPONENT","assetCode","FORM"));
        payloads.put("DESIGN_ASSET",linked("layout","KRDS_WORKSPACE","theme","KRDS_GOV_DEFAULT",
            "sections",sections,"assetBindings",bindings,"adoptMutationPolicy","NOT_APPLICABLE"));
        List<Map<String,Object>> fields=List.of(
            field("name","Name","INPUT","STRING",true),
            field("id","ID","OUTPUT","INTEGER",false));
        payloads.put("FIELD_DICTIONARY",linked("fields",fields));
        payloads.put("DATA_HANDOFF",linked("inputs",List.of(linked("fieldCode","name","contractPath","name")),
            "outputs",List.of(linked("fieldCode","id","contractPath","id"))));
        List<Map<String,Object>> entities=List.of(linked("entity","ITEM","fields",List.of("name","id")));
        List<Map<String,Object>> schemaChanges=List.of(schemaChange("item",List.of(
            column("name","text",false,false),column("id","integer",true,false))));
        payloads.put("DATABASE",linked("entities",entities,"verified",true,
            "migrationMode","SAFE_CREATE_TABLE","schemaFingerprint",schemaHash(schemaChanges),
            "schemaChanges",schemaChanges));
        List<Map<String,Object>> operations=List.of(apiOperation(
            "/api/work/{executionId}/a","SAVE",List.of("name"),List.of("id"),List.of("PERM_SAVE")));
        payloads.put("API",linked("operations",operations,"verified",true));
        payloads.put("BUSINESS_RULE",linked("rules",List.of(linked(
            "ruleCode","SAVE_RULE","commandCode","SAVE","fieldCode","name","operator","NE",
            "expectedValue","blocked","errorCode","SAVE_RULE_FAILED"))));
        payloads.put("VALIDATION",linked("rules",List.of(linked(
            "ruleCode","NAME_REQUIRED","commandCode","SAVE","fieldCode","name","operator","REQUIRED",
            "expectedValue","PRESENT","errorCode","NAME_REQUIRED")),
            "exceptionStatesVerified",true));
        payloads.put("NOTIFICATION",linked("events",List.of(linked(
            "eventCode","SAVED","commandCode","SAVE","channel","IN_APP",
            "recipientActorCode","ACTOR","templateCode","SAVED_TEMPLATE"))));
        payloads.put("TEST",linked("scenarios",
            testScenarios("SAVE",Map.of("name","sample"),List.of("id"))));
        List<Map<String,Object>> evidence=List.of(linked("evidenceType","E2E","reference","evidence://save"));
        payloads.put("TASK_EVIDENCE",linked("evidence",evidence));
        payloads.put("RELEASE_AUDIT",linked("auditEvidenceRef","audit://save","rollbackPolicy",
            linked("mode","TRANSACTION_ROLLBACK","preserveManual",true,"preserveAdopt",true)));
        Map<String,Map<String,Object>> documents=new LinkedHashMap<>();
        for(String type:CompositeExecutableDesignAuthorityCompiler.DOCUMENT_TYPES){
            Map<String,Object> axis=linked("schemaVersion",CompositeExecutableDesignAuthorityCompiler.AXIS_SCHEMA,
                "documentType",type,"axisVersion","1.0.0","identity",identity,"payload",payloads.get(type));
            documents.put(type,new LinkedHashMap<>(linked("content",write(axis),"revision",1,
                "status","READY","updatedBy","MANUAL")));
        }
        return documents;
    }

    private static Map<String,Object> source(){
        List<?> kpis=listPayload("REQUIREMENT","kpis"),sections=listPayload("DESIGN_ASSET","sections");
        List<?> fields=listPayload("FIELD_DICTIONARY","fields"),commands=listPayload("PROCESS","commands");
        List<?> states=listPayload("STATE","states"),apis=listPayload("API","operations");
        List<?> entities=listPayload("DATABASE","entities"),evidence=listPayload("TASK_EVIDENCE","evidence");
        return linked("workTypeCode","WORK","ownerActorCode","ACTOR","processVersion","1.0.0",
            "contractActorCode","ACTOR","stepActorCode","ACTOR","blueprintActorCode","ACTOR",
            "stepOrder",1,"stepCommandCode","SAVE","stepFromState","DRAFT","stepToState","DONE",
            "stepCompletionRule","record is saved","stepInputContract","{\"name\":\"string\"}",
            "stepOutputContract","{\"id\":\"integer\"}","stepApiContract","/api/work/{executionId}/a",
            "requiresNotification",true,
            "candidateCount",1,"explicitCount",0,
            "adoptCount",0,"implementationStrategy","GENERATED_RUNTIME","transitionStatus","GENERATED",
            "sourceReference","","activeAccountCount",1,"permissionRequirementCount",1,
            "permissionMatchedCount",1,"permissionAllowCount",1,"permissionDenyCount",0,
            "permissionAmbiguityCount",0,"requiredAssetCount",3,"registeredAssetCount",3,
            "jsonFormAssetCount",1,"registeredNotificationTemplates",
            "[\"APPROVED_TEMPLATE\",\"SAVED_TEMPLATE\"]",
            "currentLayout","KRDS_WORKSPACE","currentTheme","KRDS_GOV_DEFAULT",
            "currentAssetBindings",write(listPayload("DESIGN_ASSET","assetBindings")),
            "businessPurpose","Complete work safely","entryCondition","Draft exists",
            "exitCondition","Saved record is returned","kpiContract",write(kpis),
            "sectionContract",write(sections),"fieldContract",write(fields),"commandContract",write(commands),
            "stateContract",write(states),"apiContract",write(apis),"dataContract",write(entities),
            "permissionCodes","[\"PERM_SAVE\"]","responsiveContract","360 768 1280",
            "accessibilityContract","KRDS WCAG AA","securityContract","Server actor scope",
            "evidenceContract",write(evidence));
    }

    private static Map<String,Map<String,Object>> twoCommandDocuments(){
        Map<String,Map<String,Object>> documents=documents();
        replacePayload(documents,"AUTHORITY","permissionCodes",List.of("PERM_SAVE","PERM_APPROVE"));
        replacePayload(documents,"PROCESS","commands",List.of(
            linked("commandCode","SAVE","actorCode","ACTOR","primary",true),
            linked("commandCode","APPROVE","actorCode","ACTOR","primary",false)));
        replacePayload(documents,"STATE","states",List.of(
            linked("fromState","DRAFT","commandCode","SAVE","toState","DONE"),
            linked("fromState","DONE","commandCode","APPROVE","toState","APPROVED")));
        replacePayload(documents,"FIELD_DICTIONARY","fields",List.of(
            field("name","Name","INPUT","STRING",true),
            field("amount","Amount","INPUT","NUMBER",true),
            field("id","ID","OUTPUT","INTEGER",false),
            field("status","Status","OUTPUT","STRING",false)));
        replacePayload(documents,"DATA_HANDOFF","inputs",List.of(
            linked("fieldCode","name","contractPath","name"),
            linked("fieldCode","amount","contractPath","amount")));
        replacePayload(documents,"DATA_HANDOFF","outputs",List.of(
            linked("fieldCode","id","contractPath","id"),
            linked("fieldCode","status","contractPath","status")));
        replacePayload(documents,"DATABASE","entities",List.of(
            linked("entity","ITEM","fields",List.of("name","amount","id","status"))));
        Map<String,Object> database=axis(documents,"DATABASE");
        List<Map<String,Object>> changes=List.of(schemaChange("item",List.of(
            column("name","text",false,false),column("amount","numeric(18,2)",false,false),
            column("id","integer",true,false),column("status","text",false,false))));
        map(database.get("payload")).put("schemaChanges",changes);
        map(database.get("payload")).put("schemaFingerprint",schemaHash(changes));
        replaceAxis(documents,"DATABASE",database);
        replacePayload(documents,"API","operations",List.of(
            apiOperation("/api/work/{executionId}/save","SAVE",List.of("name"),
                List.of("id"),List.of("PERM_SAVE")),
            apiOperation("/api/work/{executionId}/approve","APPROVE",List.of("amount"),
                List.of("status"),List.of("PERM_APPROVE"))));
        replacePayload(documents,"BUSINESS_RULE","rules",List.of(
            linked("ruleCode","SAVE_RULE","commandCode","SAVE","fieldCode","name","operator","NE",
                "expectedValue","blocked","errorCode","SAVE_RULE_FAILED"),
            linked("ruleCode","APPROVE_RULE","commandCode","APPROVE","fieldCode","amount","operator","GT",
                "expectedValue","0","errorCode","APPROVE_RULE_FAILED")));
        replacePayload(documents,"VALIDATION","rules",List.of(
            linked("ruleCode","NAME_REQUIRED","commandCode","SAVE","fieldCode","name",
                "operator","REQUIRED","expectedValue","PRESENT","errorCode","NAME_REQUIRED"),
            linked("ruleCode","AMOUNT_REQUIRED","commandCode","APPROVE","fieldCode","amount",
                "operator","REQUIRED","expectedValue","PRESENT","errorCode","AMOUNT_REQUIRED")));
        replacePayload(documents,"NOTIFICATION","events",List.of(
            linked("eventCode","SAVED","commandCode","SAVE","channel","IN_APP",
                "recipientActorCode","ACTOR","templateCode","SAVED_TEMPLATE"),
            linked("eventCode","APPROVED","commandCode","APPROVE","channel","IN_APP",
                "recipientActorCode","ACTOR","templateCode","APPROVED_TEMPLATE")));
        List<Map<String,Object>> scenarios=new ArrayList<>(
            testScenarios("SAVE",Map.of("name","sample"),List.of("id")));
        scenarios.addAll(testScenarios("APPROVE",Map.of("amount",1),List.of("status")));
        replacePayload(documents,"TEST","scenarios",scenarios);
        documents.values().forEach(row->row.put("updatedBy","MANUAL"));return documents;
    }

    private static Map<String,Object> twoCommandSource(Map<String,Map<String,Object>> documents){
        Map<String,Object> source=source();
        source.put("stepInputContract","{\"name\":\"string\",\"amount\":\"number\"}");
        source.put("stepOutputContract","{\"id\":\"integer\",\"status\":\"string\"}");
        source.put("permissionRequirementCount",2);source.put("permissionMatchedCount",2);
        source.put("permissionAllowCount",2);
        for(String[] mapping:List.of(new String[]{"FIELD_DICTIONARY","fieldContract","fields"},
                new String[]{"PROCESS","commandContract","commands"},new String[]{"STATE","stateContract","states"},
                new String[]{"API","apiContract","operations"},new String[]{"DATABASE","dataContract","entities"}))
            source.put(mapping[1],write(map(axis(documents,mapping[0]).get("payload")).get(mapping[2])));
        return source;
    }

    private static List<Map<String,Object>> testScenarios(String command,
            Map<String,Object> inputValues,List<String> expectedOutputFields){
        List<Map<String,Object>> scenarios=new ArrayList<>();
        for(String status:TEST_STATUSES)
            scenarios.add(testScenario(command,status,inputValues,expectedOutputFields));
        return scenarios;
    }

    private static Map<String,Object> testScenario(String command,String status,
            Map<String,Object> successInput,List<String> businessOutputFields){
        Map<String,Object> inputValues=new LinkedHashMap<>(successInput);
        String inputField=inputValues.keySet().stream().findFirst().orElse("");
        String validationField=inputField.isEmpty()?"UNDECLARED":inputField;
        String successScenario=command+"_SUCCESS";
        if("VALIDATION_ERROR".equals(status)&&!inputField.isEmpty())inputValues.put(inputField,"");
        List<String> outputFields=new ArrayList<>();
        if(Set.of("VALIDATION_ERROR","FORBIDDEN","CONFLICT").contains(status))
            outputFields.addAll(List.of("success","code","message"));
        else{
            outputFields.addAll(List.of("success","idempotent","eventId","toState"));
            if("RECOVERY".equals(status))outputFields.add("recovered");
            outputFields.addAll(businessOutputFields.stream().sorted().toList());
        }
        Map<String,Object> outputValues=expectedOutputValues(status,businessOutputFields);
        Map<String,Object> trigger=switch(status){
            case "SUCCESS" -> linked("kind","NEW_COMMAND");
            case "VALIDATION_ERROR" -> linked("kind","DECLARED_VALIDATION_FAILURE",
                "fieldCode",validationField,"errorCode",validationError(command,validationField));
            case "FORBIDDEN" -> linked("kind","UNASSIGNED_ACTOR");
            case "CONFLICT" -> linked("kind","STALE_STATE","state",
                "APPROVE".equals(command)?"APPROVED":"DONE",
                "referenceScenarioCode",successScenario);
            case "RECOVERY" -> linked("kind","IDEMPOTENT_REPLAY",
                "referenceScenarioCode",successScenario);
            default -> throw new AssertionError(status);
        };
        return linked("scenarioCode",command+"_"+status,"commandCode",command,
            "inputValues",inputValues,"expectedOutputFields",outputFields,
            "expectedOutputValues",outputValues,"expectedStatus",status,
            "expectedHttpStatus",Map.of("SUCCESS",200,"VALIDATION_ERROR",400,
                "FORBIDDEN",403,"CONFLICT",409,"RECOVERY",200).get(status),
            "trigger",trigger,"assertionCodes",List.of("STATUS_MATCH","OUTPUT_FIELDS_MATCH"));
    }

    private static Map<String,Object> apiOperation(String path,String command,
            List<String> requestFields,List<String> responseFields,List<String> permissions){
        List<Map<String,Object>> projection=responseFields.stream().sorted().map(field->
            requestFields.contains(field)
                ?linked("fieldCode",field,"source","REQUEST","sourcePath",field)
                :linked("fieldCode",field,"source","RUNTIME_RESULT","sourcePath",
                    field.toLowerCase().contains("id")?"eventId":"toState")).toList();
        List<Map<String,Object>> statusResponses=new ArrayList<>();
        for(String status:TEST_STATUSES){
            List<String> body=new ArrayList<>();
            if(Set.of("VALIDATION_ERROR","FORBIDDEN","CONFLICT").contains(status))
                body.addAll(List.of("success","code","message"));
            else{body.addAll(List.of("success","idempotent","eventId","toState"));
                if("RECOVERY".equals(status))body.add("recovered");
                body.addAll(responseFields.stream().sorted().toList());}
            statusResponses.add(linked("statusCase",status,"httpStatus",Map.of(
                "SUCCESS",200,"VALIDATION_ERROR",400,"FORBIDDEN",403,
                "CONFLICT",409,"RECOVERY",200).get(status),"bodyFields",body));
        }
        return linked("method","POST","path",path,"commandCode",command,
            "requestFields",requestFields,"responseFields",responseFields,
            "permissionCodes",permissions,"responseProjection",projection,
            "statusResponses",statusResponses);
    }

    private static Map<String,Object> expectedOutputValues(
            String status,List<String> businessOutputFields){
        Map<String,Object> result=new LinkedHashMap<>();
        if(Set.of("VALIDATION_ERROR","FORBIDDEN","CONFLICT").contains(status)){
            Map<String,List<Object>> error=Map.of(
                "VALIDATION_ERROR",List.of(false,"INVALID_REQUEST","Request failed"),
                "FORBIDDEN",List.of(false,"ACCESS_DENIED","Access denied"),
                "CONFLICT",List.of(false,"CONFLICT","Request conflicts with the current state"));
            List<Object> values=error.get(status);
            for(int index=0;index<3;index++)result.put(List.of("success","code","message").get(index),
                linked("source","LITERAL","value",values.get(index)));
            return result;
        }
        boolean recovery="RECOVERY".equals(status);
        result.put("success",linked("source","LITERAL","value",true));
        result.put("idempotent",linked("source","LITERAL","value",recovery));
        result.put("eventId",linked("source",recovery?"REFERENCE_SCENARIO":"DATABASE_EVENT",
            "path","eventId"));
        result.put("toState",linked("source",recovery?"REFERENCE_SCENARIO":"DECLARED_STATE",
            "path","toState"));
        if(recovery)result.put("recovered",linked("source","LITERAL","value",true));
        for(String field:businessOutputFields.stream().sorted().toList())result.put(field,
            linked("source",recovery?"REFERENCE_SCENARIO":
                    (field.toLowerCase().contains("id")?"DATABASE_EVENT":"DECLARED_STATE"),
                "path",recovery?field:(field.toLowerCase().contains("id")?"eventId":"toState")));
        return result;
    }

    private static String validationError(String command,String field){
        if("SAVE".equals(command)&&"name".equals(field))return "NAME_REQUIRED";
        return field.toUpperCase()+"_REQUIRED";
    }

    private static void replacePayload(Map<String,Map<String,Object>> documents,String type,String key,Object value){
        Map<String,Object> axis=axis(documents,type);map(axis.get("payload")).put(key,value);replaceAxis(documents,type,axis);
    }

    private static List<?> listPayload(String type,String field){
        Map<String,Object> axis=read(String.valueOf(documents().get(type).get("content")));
        return (List<?>)map(axis.get("payload")).get(field);
    }

    private static void mutate(String type,Map<String,Object> payload){
        switch(type){
            case "REQUIREMENT" -> payload.put("workTypeCode","OTHER");
            case "ACTOR_RACI" -> payload.put("actorCode","OTHER_ACTOR");
            case "AUTHORITY" -> payload.put("permissionCodes",List.of("PERM_OTHER"));
            case "PROCESS" -> payload.put("commandCode","OTHER_COMMAND");
            case "STATE" -> map(((List<?>)payload.get("states")).get(0)).put("toState","OTHER");
            case "NAVIGATION" -> payload.put("routePath","/other");
            case "ACTIVE_UI" -> payload.put("sectionOrder",List.of("OTHER"));
            case "DESIGN_ASSET" -> payload.put("assetBindings",List.of(
                linked("assetType","THEME","assetCode","KRDS_GOV_DEFAULT")));
            case "FIELD_DICTIONARY" -> map(((List<?>)payload.get("fields")).get(0)).put("direction","OUTPUT");
            case "DATA_HANDOFF" -> map(((List<?>)payload.get("inputs")).get(0)).put("fieldCode","other");
            case "DATABASE" -> map(((List<?>)payload.get("entities")).get(0)).put("entity","OTHER");
            case "API" -> map(((List<?>)payload.get("operations")).get(0)).put("commandCode","OTHER");
            case "BUSINESS_RULE" -> map(((List<?>)payload.get("rules")).get(0)).put("commandCode","OTHER");
            case "VALIDATION" -> map(((List<?>)payload.get("rules")).get(0)).put("fieldCode","other");
            case "NOTIFICATION" -> map(((List<?>)payload.get("events")).get(0)).put("commandCode","OTHER");
            case "TEST" -> map(((List<?>)payload.get("scenarios")).get(0)).put("commandCode","OTHER");
            case "TASK_EVIDENCE" -> map(((List<?>)payload.get("evidence")).get(0)).put("reference",null);
            case "RELEASE_AUDIT" -> map(payload.get("rollbackPolicy")).put("preserveAdopt",false);
            default -> throw new AssertionError(type);
        }
    }

    private static Map<String,Object> linked(Object... values){
        Map<String,Object> map=new LinkedHashMap<>();for(int i=0;i<values.length;i+=2)map.put(String.valueOf(values[i]),values[i+1]);return map;
    }
    private static Map<String,Object> column(String name,String type,boolean primary,boolean nullable){
        return linked("name",name,"type",type,"primaryKey",primary,"nullable",nullable);
    }
    private static Map<String,Object> schemaChange(String table,List<Map<String,Object>> columns){
        return linked("operation","CREATE_TABLE","tableName",table,"columns",columns,
            "uniqueConstraints",List.of(),"indexes",List.of());
    }
    private static String schemaHash(List<Map<String,Object>> changes){
        return CompositeExecutableDesignAuthorityCompiler.hash(
            CompositeExecutableDesignAuthorityCompiler.stable(changes));
    }
    private static Map<String,Object> field(String code,String label,String direction,
            String type,boolean required){
        return linked("fieldCode",code,"label",label,"direction",direction,"dataSource","ITEM",
            "dataType",type,"required",required,"componentCode","FORM");
    }
    @SuppressWarnings("unchecked") private static Map<String,Object> map(Object value){return (Map<String,Object>)value;}
    private static Map<String,Object> read(String value){try{return JSON.readValue(value,new TypeReference<>(){});}catch(Exception error){throw new AssertionError(error);}}
    private static String write(Object value){try{return JSON.writeValueAsString(value);}catch(Exception error){throw new AssertionError(error);}}
}
