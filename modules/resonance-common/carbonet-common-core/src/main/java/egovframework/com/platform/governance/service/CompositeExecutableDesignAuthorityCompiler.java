package egovframework.com.platform.governance.service;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.stream.Collectors;

/**
 * Pure compiler for the eighteen executable design axes.  It has no database,
 * clock, transaction, or generator dependency, so every contradiction can be
 * mutation-tested before the service is allowed to write canonical SOURCE.
 */
final class CompositeExecutableDesignAuthorityCompiler {
    static final String AXIS_SCHEMA="carbonet.integrated-design-axis/v1";
    static final String AUTHORITY_SCHEMA="carbonet.composite-executable-design-authority/v1";
    static final String ACTIVATION_POLICY="SOURCE_IMMEDIATE_V1";
    static final List<String> DOCUMENT_TYPES=List.of(
        "REQUIREMENT","ACTOR_RACI","AUTHORITY","PROCESS","STATE","NAVIGATION",
        "ACTIVE_UI","DESIGN_ASSET","FIELD_DICTIONARY","DATA_HANDOFF","DATABASE","API",
        "BUSINESS_RULE","VALIDATION","NOTIFICATION","TEST","TASK_EVIDENCE","RELEASE_AUDIT");
    static final Set<String> READY_STATUSES=Set.of("READY","APPROVED","VERIFIED");
    static final Set<String> EXPECTED_TEST_STATUSES=Set.of(
        "SUCCESS","VALIDATION_ERROR","FORBIDDEN","CONFLICT","RECOVERY");
    static final Set<String> STEP_SHARED_TYPES=Set.of(
        "REQUIREMENT","PROCESS","STATE","API","BUSINESS_RULE",
        "VALIDATION","NOTIFICATION","TEST");

    private static final ObjectMapper JSON=new ObjectMapper()
        .enable(JsonParser.Feature.STRICT_DUPLICATE_DETECTION);
    private static final Set<String> ENVELOPE_KEYS=Set.of(
        "schemaVersion","documentType","axisVersion","identity","payload");
    private static final Set<String> IDENTITY_KEYS=Set.of(
        "contractId","processCode","stepCode","routePath","audience",
        "selectedBlueprintId","ownershipStrategy","ownershipJustification");
    private static final Map<String,Set<String>> PAYLOAD_KEYS=Map.ofEntries(
        Map.entry("REQUIREMENT",Set.of("workTypeCode","businessPurpose","entryCondition","exitCondition","kpis")),
        Map.entry("ACTOR_RACI",Set.of("actorCode","ownerActorCode","responsibleActorCodes","accountBindingMode","relayTestRequired")),
        Map.entry("AUTHORITY",Set.of("permissionCodes","securityContract","serverEnforced")),
        Map.entry("PROCESS",Set.of("stepOrder","commandCode","fromState","toState","completionRule","commands")),
        Map.entry("STATE",Set.of("states")),
        Map.entry("NAVIGATION",Set.of("routePath","audience","nextRoutes")),
        Map.entry("ACTIVE_UI",Set.of("sectionOrder","responsiveContract","accessibilityContract","responsiveVerified","accessibilityVerified")),
        Map.entry("DESIGN_ASSET",Set.of("layout","theme","sections","assetBindings","adoptMutationPolicy")),
        Map.entry("FIELD_DICTIONARY",Set.of("fields")),
        Map.entry("DATA_HANDOFF",Set.of("inputs","outputs")),
        Map.entry("DATABASE",Set.of("entities","verified","migrationMode","schemaFingerprint","schemaChanges")),
        Map.entry("API",Set.of("operations","verified")),
        Map.entry("BUSINESS_RULE",Set.of("rules")),
        Map.entry("VALIDATION",Set.of("rules","exceptionStatesVerified")),
        Map.entry("NOTIFICATION",Set.of("events")),
        Map.entry("TEST",Set.of("scenarios")),
        Map.entry("TASK_EVIDENCE",Set.of("evidence")),
        Map.entry("RELEASE_AUDIT",Set.of("auditEvidenceRef","rollbackPolicy")));
    private static final Map<String,Set<String>> ROW_KEYS=Map.ofEntries(
        Map.entry("REQUIREMENT.kpis",Set.of("kpiCode","description")),
        Map.entry("PROCESS.commands",Set.of("commandCode","actorCode","primary")),
        Map.entry("STATE.states",Set.of("fromState","commandCode","toState")),
        Map.entry("DESIGN_ASSET.sections",Set.of("sectionId","componentCodes")),
        Map.entry("DESIGN_ASSET.assetBindings",Set.of("assetType","assetCode")),
        Map.entry("FIELD_DICTIONARY.fields",Set.of("fieldCode","label","direction","dataSource",
            "dataType","required","componentCode")),
        Map.entry("DATA_HANDOFF.inputs",Set.of("fieldCode","contractPath")),
        Map.entry("DATA_HANDOFF.outputs",Set.of("fieldCode","contractPath")),
        Map.entry("DATABASE.entities",Set.of("entity","fields")),
        Map.entry("API.operations",Set.of("method","path","commandCode","requestFields","responseFields","permissionCodes")),
        Map.entry("BUSINESS_RULE.rules",Set.of("ruleCode","commandCode","fieldCode","operator","expectedValue","errorCode")),
        Map.entry("VALIDATION.rules",Set.of("ruleCode","commandCode","fieldCode","operator","expectedValue","errorCode")),
        Map.entry("NOTIFICATION.events",Set.of("eventCode","commandCode","channel","recipientActorCode","templateCode")),
        Map.entry("TEST.scenarios",Set.of("scenarioCode","commandCode","inputValues","expectedOutputFields","expectedStatus","assertionCodes")),
        Map.entry("TASK_EVIDENCE.evidence",Set.of("evidenceType","reference")));
    private static final Map<String,Set<String>> ROW_LIST_FIELDS=Map.ofEntries(
        Map.entry("DESIGN_ASSET.sections",Set.of("componentCodes")),
        Map.entry("DATABASE.entities",Set.of("fields")),
        Map.entry("API.operations",Set.of("requestFields","responseFields","permissionCodes")),
        Map.entry("TEST.scenarios",Set.of("expectedOutputFields","assertionCodes")));
    private static final Set<String> EMPTY_ROW_COLLECTIONS=Set.of(
        "FIELD_DICTIONARY.fields","DATA_HANDOFF.inputs","DATA_HANDOFF.outputs",
        "DATABASE.entities","BUSINESS_RULE.rules","VALIDATION.rules","NOTIFICATION.events");
    private static final Map<String,Set<String>> ROW_BOOLEAN_FIELDS=Map.of(
        "PROCESS.commands",Set.of("primary"),"FIELD_DICTIONARY.fields",Set.of("required"));
    private static final Map<String,Set<String>> ROW_OBJECT_FIELDS=Map.of(
        "TEST.scenarios",Set.of("inputValues"));

    record Compilation(long contractId,long selectedBlueprintId,String ownershipStrategy,
        boolean selectedAdopt,String documentSetHash,String authorityHash,
        Map<String,Object> projection,List<Map<String,Object>> evidence,
        Map<String,Object> executableDesign,String executableDesignHash,String sharedStepHash,
        Map<String,Object> artifactManifest,Map<String,Object> composite,
        Map<String,Object> resolvedClosure) {}
    record Selection(long contractId,long blueprintId,String audience,String actor,
        List<String> responsibleActors,List<String> permissionCodes,List<String> nextRoutes,
        List<Map<String,Object>> assetBindings) {}

    private CompositeExecutableDesignAuthorityCompiler() {}

    static Selection selection(String process,String step,String route,
            Map<String,Map<String,Object>> documentHeads){
        Map<String,Object> requirement=parseAxis(String.valueOf(
            documentHeads.get("REQUIREMENT").get("content")),"REQUIREMENT",process,step,route);
        Map<String,Object> identity=object(requirement.get("identity"),"REQUIREMENT.identity");
        Map<String,Object> authority=parseAxis(String.valueOf(
            documentHeads.get("AUTHORITY").get("content")),"AUTHORITY",process,step,route);
        Map<String,Object> raci=parseAxis(String.valueOf(
            documentHeads.get("ACTOR_RACI").get("content")),"ACTOR_RACI",process,step,route);
        Map<String,Object> assets=parseAxis(String.valueOf(
            documentHeads.get("DESIGN_ASSET").get("content")),"DESIGN_ASSET",process,step,route);
        Map<String,Object> navigation=parseAxis(String.valueOf(
            documentHeads.get("NAVIGATION").get("content")),"NAVIGATION",process,step,route);
        return new Selection(positive(identity,"contractId"),positive(identity,"selectedBlueprintId"),
            text(identity,"audience").toUpperCase(Locale.ROOT),text(axisPayload(raci),"actorCode"),
            strings(axisPayload(raci),"responsibleActorCodes"),
            strings(axisPayload(authority),"permissionCodes"),
            strings(axisPayload(navigation),"nextRoutes"),
            rows(axisPayload(assets),"assetBindings","DESIGN_ASSET.assetBindings"));
    }

    private static Map<String,Object> axisPayload(Map<String,Object> axis){
        return object(axis.get("payload"),"payload");
    }

    static Map<String,Object> parseAxis(String content,String expectedType,
            String process,String step,String route){
        if(step.isBlank()||route.isBlank())throw fail("COMPOSITE_DESIGN_REQUIRES_STEP_AND_ROUTE");
        Map<String,Object> axis;
        try{
            @SuppressWarnings("unchecked") Map<String,Object> parsed=JSON.readValue(content,LinkedHashMap.class);
            axis=parsed;
        }catch(Exception error){throw fail("COMPOSITE_DESIGN_AXIS_MUST_BE_A_JSON_OBJECT: "+expectedType,error);}
        exactKeys(axis,ENVELOPE_KEYS,"COMPOSITE_DESIGN_AXIS_ENVELOPE_INVALID: "+expectedType);
        if(!AXIS_SCHEMA.equals(text(axis,"schemaVersion")))throw fail(
            "COMPOSITE_DESIGN_AXIS_SCHEMA_REQUIRED: "+expectedType+" / "+AXIS_SCHEMA);
        if(!expectedType.equals(text(axis,"documentType").toUpperCase(Locale.ROOT)))
            throw fail("COMPOSITE_DESIGN_AXIS_TYPE_MISMATCH: "+expectedType);
        if(!text(axis,"axisVersion").matches("^[1-9][0-9]*\\.[0-9]+\\.[0-9]+$"))
            throw fail("COMPOSITE_DESIGN_AXIS_VERSION_INVALID: "+expectedType);
        Map<String,Object> identity=object(axis.get("identity"),expectedType+".identity");
        exactKeys(identity,IDENTITY_KEYS,"COMPOSITE_DESIGN_AXIS_IDENTITY_INVALID: "+expectedType);
        if(!process.equals(text(identity,"processCode").toUpperCase(Locale.ROOT))
                ||!step.equals(text(identity,"stepCode").toUpperCase(Locale.ROOT))
                ||!route.equals(ScreenDevelopmentNoteService.cleanRoute(text(identity,"routePath"))))
            throw fail("COMPOSITE_DESIGN_AXIS_CONTEXT_MISMATCH: "+expectedType);
        if(!route.matches("^/[a-z0-9/_-]*$"))throw fail(
            "COMPOSITE_DESIGN_ROUTE_MUST_BE_NORMALIZED_ASCII: "+expectedType);
        if(!Set.of("USER","ADMIN").contains(text(identity,"audience").toUpperCase(Locale.ROOT)))
            throw fail("COMPOSITE_DESIGN_AXIS_AUDIENCE_INVALID: "+expectedType);
        positive(identity,"contractId");positive(identity,"selectedBlueprintId");
        if(!Set.of("EXACT_SINGLE","EXPLICIT_CONTRACT_LINK","PRESERVE_ADOPT","MANUAL_EXPLICIT")
                .contains(text(identity,"ownershipStrategy")))
            throw fail("COMPOSITE_DESIGN_OWNERSHIP_STRATEGY_INVALID: "+expectedType);
        if(text(identity,"ownershipJustification").length()<12)
            throw fail("COMPOSITE_DESIGN_OWNERSHIP_JUSTIFICATION_REQUIRED: "+expectedType);
        Map<String,Object> payload=object(axis.get("payload"),expectedType+".payload");
        exactKeys(payload,PAYLOAD_KEYS.get(expectedType),
            "COMPOSITE_DESIGN_AXIS_PAYLOAD_INVALID: "+expectedType);
        canonicalTree(axis,expectedType);return axis;
    }

    static Compilation compile(String process,String step,String route,String audience,
            Map<String,Map<String,Object>> documentHeads,Map<String,Object> source){
        Map<String,Map<String,Object>> axes=new LinkedHashMap<>();
        List<Map<String,Object>> manifest=new ArrayList<>();
        Map<String,Object> identity=null;
        for(String type:DOCUMENT_TYPES){
            Map<String,Object> row=documentHeads.get(type);
            if(row==null)throw fail("COMPOSITE_DESIGN_AXIS_REQUIRED: "+type);
            Map<String,Object> axis=parseAxis(String.valueOf(row.get("content")),type,process,step,route);
            Map<String,Object> next=object(axis.get("identity"),type+".identity");
            if(identity==null)identity=new LinkedHashMap<>(next);
            else if(!stable(identity).equals(stable(next)))
                throw new IllegalStateException("COMPOSITE_DESIGN_IDENTITY_CONTRADICTION: "+type);
            axes.put(type,axis);
            manifest.add(linked("documentType",type,"axisVersion",axis.get("axisVersion"),
                "documentRevision",row.get("revision"),"status",row.get("status"),
                "axisHash",hash(stable(axis))));
        }
        if(identity==null)throw new IllegalStateException("COMPOSITE_DESIGN_AXES_REQUIRED");
        long contractId=positive(identity,"contractId"),blueprintId=positive(identity,"selectedBlueprintId");
        if(!audience.equals(text(identity,"audience").toUpperCase(Locale.ROOT)))
            throw new IllegalStateException("COMPOSITE_DESIGN_AUDIENCE_CONTRADICTION");
        validateClosure(axes,source,process,step,route,audience);
        Ownership ownership=ownership(identity,source,contractId);
        Map<String,Object> projection=projection(axes);
        if(documentHeads.values().stream().allMatch(row->
                "LIVE_CONTRACT_BACKFILL".equals(String.valueOf(row.get("updatedBy")))))
            validateLosslessBackfill(axes,projection,source);
        if(ownership.adopt())validateAdopt(axis(axes,"DESIGN_ASSET"),axis(axes,"ACTOR_RACI"),source);
        List<Map<String,Object>> hashAxes=manifest.stream().map(row->linked(
            "documentType",row.get("documentType"),"axisVersion",row.get("axisVersion"),
            "axisHash",row.get("axisHash"))).toList();
        String documentSetHash=hash(stable(hashAxes));
        Map<String,Object> executableDesign=new LinkedHashMap<>();
        for(String type:DOCUMENT_TYPES)executableDesign.put(type,axis(axes,type));
        String executableDesignHash=hash(stable(executableDesign));
        Map<String,Object> sharedStepDesign=new LinkedHashMap<>();
        STEP_SHARED_TYPES.stream().sorted().forEach(type->sharedStepDesign.put(
            type,sharedStepPayload(type,axis(axes,type))));
        String sharedStepHash=hash(stable(sharedStepDesign));
        Map<String,Object> artifactManifest=artifactManifest(axes);
        Map<String,Object> closure=resolvedClosure(axes,source,process,step,route,audience,
            contractId,blueprintId,ownership.strategy());
        Map<String,Object> material=linked("schema",AUTHORITY_SCHEMA,
            "activationPolicy",ACTIVATION_POLICY,"authorityKey",String.join("|",process,step,audience,route),
            "documentSetHash",documentSetHash,"axes",hashAxes,"resolvedClosure",closure,
            "sourceProjection",projection,"executableDesignHash",executableDesignHash,
            "sharedStepHash",sharedStepHash,"executableDesign",executableDesign,
            "artifactManifest",artifactManifest);
        String authorityHash=hash(stable(material));
        Map<String,Object> composite=new LinkedHashMap<>(material);
        composite.put("axes",manifest);composite.put("authorityHash",authorityHash);
        List<Map<String,Object>> evidence=new ArrayList<>(objects(axis(axes,"TASK_EVIDENCE"),"evidence"));
        evidence.add(linked("markerType","COMPOSITE_EXECUTABLE_DESIGN_AUTHORITY",
            "schema",AUTHORITY_SCHEMA,"authorityHash",authorityHash,"documentSetHash",documentSetHash,
            "activationPolicy",ACTIVATION_POLICY,"selectedBlueprintId",blueprintId,"axisCount",18,
            "executableDesignHash",executableDesignHash,"sharedStepHash",sharedStepHash));
        return new Compilation(contractId,blueprintId,ownership.strategy(),ownership.adopt(),
            documentSetHash,authorityHash,projection,evidence,executableDesign,
            executableDesignHash,sharedStepHash,artifactManifest,composite,closure);
    }

    private static Map<String,Object> artifactManifest(Map<String,Map<String,Object>> axes){
        return linked(
            "runtimePolicy",List.of("ACTOR_RACI","AUTHORITY","PROCESS","STATE","BUSINESS_RULE","VALIDATION","NOTIFICATION"),
            "frontendSdui",List.of("NAVIGATION","ACTIVE_UI","DESIGN_ASSET","FIELD_DICTIONARY","DATA_HANDOFF"),
            "backendData",List.of("DATABASE","API"),"testManifest",List.of("TEST","TASK_EVIDENCE"),
            "releasePolicy",List.of("RELEASE_AUDIT"),"payloadHash",hash(stable(axes.entrySet().stream()
                .collect(Collectors.toMap(Map.Entry::getKey,entry->axisPayload(entry.getValue()),
                    (left,right)->left,TreeMap::new)))));
    }

    private static Object sharedStepPayload(String type,Map<String,Object> payload){
        if(!"API".equals(type))return payload;
        List<Map<String,Object>> operations=new ArrayList<>();
        for(Map<String,Object> operation:rows(payload,"operations","API.operations")){
            Map<String,Object> structural=new LinkedHashMap<>(operation);
            structural.remove("permissionCodes");operations.add(structural);
        }
        return linked("operations",operations,"verified",payload.get("verified"));
    }

    private record Ownership(String strategy,boolean adopt) {}

    private static Ownership ownership(Map<String,Object> identity,Map<String,Object> source,long contractId){
        String strategy=text(identity,"ownershipStrategy");
        int candidates=integer(source,"candidateCount"),explicit=integer(source,"explicitCount");
        boolean selectedExplicit="CONTRACT_LINKED".equals(source.get("transitionStatus"))
            &&Set.of("professional_screen_contract:"+contractId,
                "framework_professional_screen_contract:"+contractId).contains(
                    String.valueOf(source.get("sourceReference")).trim().toLowerCase(Locale.ROOT));
        boolean adopt="ADOPT_EXISTING".equals(source.get("implementationStrategy"));
        if("MANUAL_EXPLICIT".equals(strategy))
            throw new IllegalStateException("MANUAL_BLUEPRINT_AUTHORITY_REVISION_REQUIRED");
        boolean valid=candidates==1&&((adopt&&"PRESERVE_ADOPT".equals(strategy))
                    ||(!adopt&&"EXACT_SINGLE".equals(strategy)))
            ||candidates>1&&explicit==1&&selectedExplicit&&"EXPLICIT_CONTRACT_LINK".equals(strategy);
        if(!valid)throw new IllegalStateException("COMPOSITE_DESIGN_BLUEPRINT_OWNERSHIP_AMBIGUOUS: candidates="
            +candidates+", explicit="+explicit+", adopt="+integer(source,"adoptCount"));
        return new Ownership(strategy,adopt);
    }

    private static void validateAdopt(Map<String,Object> assets,Map<String,Object> raci,
            Map<String,Object> source){
        if(!"PRESERVE".equals(text(assets,"adoptMutationPolicy"))
                ||!text(raci,"actorCode").equals(String.valueOf(source.get("blueprintActorCode")))
                ||!text(assets,"layout").equals(String.valueOf(source.get("currentLayout")))
                ||!text(assets,"theme").equals(String.valueOf(source.get("currentTheme")))
                ||!stable(objects(assets,"assetBindings")).equals(stable(
                    parseJson(source.get("currentAssetBindings"),"currentAssetBindings"))))
            throw new IllegalStateException("ADOPT_EXISTING_DESIGN_MUTATION_REQUIRES_EXPLICIT_REPLACEMENT");
    }

    private static Map<String,Object> projection(Map<String,Map<String,Object>> axes){
        Map<String,Object> requirement=axis(axes,"REQUIREMENT"),raci=axis(axes,"ACTOR_RACI");
        Map<String,Object> authority=axis(axes,"AUTHORITY");
        Map<String,Object> process=axis(axes,"PROCESS"),state=axis(axes,"STATE");
        Map<String,Object> ui=axis(axes,"ACTIVE_UI"),assets=axis(axes,"DESIGN_ASSET");
        Map<String,Object> fields=axis(axes,"FIELD_DICTIONARY"),db=axis(axes,"DATABASE");
        Map<String,Object> api=axis(axes,"API"),validation=axis(axes,"VALIDATION");
        Map<String,Object> release=axis(axes,"RELEASE_AUDIT");
        List<Map<String,Object>> fieldRows=rows(fields,"fields","FIELD_DICTIONARY.fields");
        Map<String,Object> stepInputs=new TreeMap<>(),stepOutputs=new TreeMap<>();
        for(Map<String,Object> field:fieldRows){
            String direction=text(field,"direction"),code=text(field,"fieldCode");
            String dataType=text(field,"dataType").toLowerCase(Locale.ROOT);
            if(!"OUTPUT".equals(direction))stepInputs.put(code,dataType);
            if(!"INPUT".equals(direction))stepOutputs.put(code,dataType);
        }
        String primary=text(process,"commandCode");
        String primaryApiPath=rows(api,"operations","API.operations").stream()
            .filter(operation->primary.equals(operation.get("commandCode")))
            .map(operation->text(operation,"path")).findFirst().orElseThrow(()->
                fail("PRIMARY_COMMAND_API_OPERATION_REQUIRED"));
        return linked("businessPurpose",text(requirement,"businessPurpose"),
            "entryCondition",text(requirement,"entryCondition"),"exitCondition",text(requirement,"exitCondition"),
            "kpiContract",objects(requirement,"kpis"),"sectionContract",objects(assets,"sections"),
            "fieldContract",fieldRows,
            "commandContract",objects(process,"commands"),
            "stateContract",objects(state,"states"),"apiContract",objects(api,"operations"),
            "dataContract",rows(db,"entities","DATABASE.entities"),
            "responsiveContract",text(ui,"responsiveContract"),
            "accessibilityContract",text(ui,"accessibilityContract"),
            "securityContract",text(authority,"securityContract"),
            "permissionCodes",strings(authority,"permissionCodes"),"apiVerified",bool(api,"verified"),
            "databaseVerified",bool(db,"verified"),"authorityVerified",bool(authority,"serverEnforced"),
            "responsiveVerified",bool(ui,"responsiveVerified"),
            "accessibilityVerified",bool(ui,"accessibilityVerified"),
            "exceptionStatesVerified",bool(validation,"exceptionStatesVerified"),
            "auditEvidenceRef",text(release,"auditEvidenceRef"),
            "workTypeCode",text(requirement,"workTypeCode"),
            "stepActorCode",text(raci,"actorCode"),
            "ownerActorCode",text(raci,"ownerActorCode"),
            "stepOrder",positive(process,"stepOrder"),
            "stepCommandCode",text(process,"commandCode"),
            "stepFromState",text(process,"fromState"),
            "stepToState",text(process,"toState"),
            "stepCompletionRule",text(process,"completionRule"),
            "stepInputContract",stepInputs,"stepOutputContract",stepOutputs,
            "stepApiContract",primaryApiPath,
            "requiresNotification",!rows(axis(axes,"NOTIFICATION"),"events","NOTIFICATION.events").isEmpty(),
            "layout",text(assets,"layout"),"theme",text(assets,"theme"),
            "assetBindings",objects(assets,"assetBindings"));
    }

    private static Map<String,Object> resolvedClosure(Map<String,Map<String,Object>> axes,
            Map<String,Object> source,String process,String step,String route,String audience,
            long contractId,long blueprintId,String strategy){
        Map<String,Object> requirement=axis(axes,"REQUIREMENT"),raci=axis(axes,"ACTOR_RACI");
        Map<String,Object> commands=axis(axes,"PROCESS"),handoff=axis(axes,"DATA_HANDOFF");
        Map<String,Object> permissions=axis(axes,"AUTHORITY"),api=axis(axes,"API");
        List<Map<String,Object>> operations=objects(api,"operations");
        List<String> endpoints=operations.stream().map(op->text(op,"method")+" "+text(op,"path")).toList();
        Map<String,Object> closure=linked("workTypeCode",requirement.get("workTypeCode"),
            "processCode",process,"processVersion",source.get("processVersion"),
            "stepOrder",commands.get("stepOrder"),"stepCode",step,"actorCode",raci.get("actorCode"),
            "activeAccountCount",source.get("activeAccountCount"),"audience",audience,"routePath",route,
            "functions",objects(commands,"commands"),
            "inputs",rows(handoff,"inputs","DATA_HANDOFF.inputs"),
            "outputs",rows(handoff,"outputs","DATA_HANDOFF.outputs"),
            "permissionCodes",strings(permissions,"permissionCodes"),
            "endpoints",endpoints,"contractId",contractId,"selectedBlueprintId",blueprintId,
            "ownershipStrategy",strategy,"frontend","SDUI_JSON_FORM_KRDS",
            "backend","CANONICAL_API_RUNTIME","database","CANONICAL_DATA_CONTRACT",
            "codegen","CANONICAL_PROCESS_PUBLICATION_V1");
        closure.put("reviewText",String.join("\n",
            "1. 업무종류: "+requirement.get("workTypeCode"),"2. 프로세스: "+process,
            "3. 단계: "+commands.get("stepOrder")+" / "+step,"4. 액터/활성계정: "+raci.get("actorCode")+" / "+source.get("activeAccountCount"),
            "5. 화면: "+audience+" "+route,"6. 기능: "+objects(commands,"commands"),
            "7. 입력: "+rows(handoff,"inputs","DATA_HANDOFF.inputs"),
            "8. 출력: "+rows(handoff,"outputs","DATA_HANDOFF.outputs"),
            "9. 권한: "+strings(permissions,"permissionCodes"),"10. 엔드포인트: "+endpoints));
        return closure;
    }

    private static void validateClosure(Map<String,Map<String,Object>> axes,Map<String,Object> source,
            String process,String step,String route,String audience){
        Map<String,Object> requirement=axis(axes,"REQUIREMENT"),raci=axis(axes,"ACTOR_RACI");
        Map<String,Object> authority=axis(axes,"AUTHORITY"),processAxis=axis(axes,"PROCESS");
        if(!text(requirement,"workTypeCode").equals(source.get("workTypeCode")))
            throw new IllegalStateException("WORK_TYPE_PROCESS_CONTRADICTION");
        String actor=text(raci,"actorCode");
        String owner=text(raci,"ownerActorCode"),expected=String.valueOf(source.get("ownerActorCode"));
        if(expected.isBlank())expected=actor;
        if(!owner.equals(expected)||!strings(raci,"responsibleActorCodes").contains(actor))
            throw new IllegalStateException("ACTOR_RACI_CONTRADICTION");
        if(!"RUNTIME_AUTHORITY".equals(text(raci,"accountBindingMode")))throw fail("ACCOUNT_BINDING_MODE_INVALID");
        if(bool(raci,"relayTestRequired")&&integer(source,"activeAccountCount")<1)
            throw new IllegalStateException("ACTIVE_RELAY_ACCOUNT_REQUIRED");
        List<String> permissionCodes=strings(authority,"permissionCodes");
        if(permissionCodes.isEmpty()||new HashSet<>(permissionCodes).size()!=permissionCodes.size()
                ||permissionCodes.stream().anyMatch(code->!code.matches("^[A-Z][A-Z0-9_:-]{1,119}$")))
            throw fail("CANONICAL_PERMISSION_CODES_REQUIRED");
        if(integer(source,"permissionRequirementCount")!=permissionCodes.size()
                ||integer(source,"permissionMatchedCount")!=permissionCodes.size()
                ||integer(source,"permissionAllowCount")!=permissionCodes.size()
                ||integer(source,"permissionDenyCount")!=0
                ||integer(source,"permissionAmbiguityCount")!=0)
            throw new IllegalStateException("ACTOR_PERMISSION_CLOSURE_NOT_EXACT");
        if(longValue(source,"stepOrder")!=positive(processAxis,"stepOrder"))
            throw new IllegalStateException("PROCESS_STEP_ORDER_CONTRADICTION");
        rows(requirement,"kpis","REQUIREMENT.kpis");
        ProcessClosure processClosure=validateProcess(processAxis,axis(axes,"STATE"),actor);
        validateNavigationAndAssets(axes,source,route,audience);
        DataClosure data=validateData(axes,source);
        validateApiRulesAndTests(axes,processClosure.commands(),data,permissionCodes,source);
        validateRelease(axis(axes,"RELEASE_AUDIT"));
    }

    private record ProcessClosure(Set<String> commands) {}
    private record DataClosure(Set<String> fields,Set<String> inputs,Set<String> outputs) {}

    private static ProcessClosure validateProcess(Map<String,Object> process,Map<String,Object> state,
            String actor){
        List<Map<String,Object>> commands=rows(process,"commands","PROCESS.commands");
        for(Map<String,Object> command:commands)if(!actor.equals(text(command,"actorCode"))
                ||!(command.get("primary") instanceof Boolean))throw fail("PROCESS_COMMAND_INVALID");
        Set<String> codes=codes(commands,"commandCode","PROCESS.commands");
        List<Map<String,Object>> primary=commands.stream().filter(row->
            Boolean.TRUE.equals(row.get("primary"))).toList();
        String primaryCommand=text(process,"commandCode");
        if(!codes.contains(primaryCommand)||primary.size()!=1
                ||!text(primary.get(0),"commandCode").equals(primaryCommand))
            throw new IllegalStateException("PROCESS_PRIMARY_COMMAND_NOT_EXACT");
        List<Map<String,Object>> states=rows(state,"states","STATE.states");
        Set<String> stateCommands=codes(states,"commandCode","STATE.states");
        if(!stateCommands.equals(codes)||states.size()!=commands.size()
                ||states.stream().noneMatch(row->text(process,"fromState").equals(text(row,"fromState"))
                    &&text(process,"toState").equals(text(row,"toState"))
                    &&primaryCommand.equals(text(row,"commandCode"))))
            throw new IllegalStateException("STATE_TRANSITION_CONTRADICTION");
        return new ProcessClosure(codes);
    }

    private static void validateNavigationAndAssets(Map<String,Map<String,Object>> axes,
            Map<String,Object> source,String route,String audience){
        Map<String,Object> navigation=axis(axes,"NAVIGATION"),ui=axis(axes,"ACTIVE_UI"),assets=axis(axes,"DESIGN_ASSET");
        if(!route.equals(text(navigation,"routePath"))||!audience.equals(text(navigation,"audience")))
            throw new IllegalStateException("NAVIGATION_SCREEN_CONTRADICTION");
        for(String next:strings(navigation,"nextRoutes"))if(!next.startsWith("/"))throw fail("NAVIGATION_ROUTE_INVALID");
        List<Map<String,Object>> sections=rows(assets,"sections","DESIGN_ASSET.sections");
        Set<String> sectionCodes=codes(sections,"sectionId","DESIGN_ASSET.sections");
        Set<String> components=new HashSet<>();
        for(Map<String,Object> section:sections)components.addAll(strings(section,"componentCodes"));
        List<String> order=strings(ui,"sectionOrder");
        if(order.size()!=sectionCodes.size()||!new HashSet<>(order).equals(sectionCodes))
            throw new IllegalStateException("ACTIVE_UI_SECTION_ASSET_CONTRADICTION");
        List<Map<String,Object>> bindings=rows(assets,"assetBindings","DESIGN_ASSET.assetBindings");
        Set<String> boundSections=new HashSet<>(),boundComponents=new HashSet<>(),boundThemes=new HashSet<>();
        for(Map<String,Object> binding:bindings){
            String type=text(binding,"assetType"),code=text(binding,"assetCode");
            if(!Set.of("THEME","SECTION","COMPONENT").contains(type))throw fail("COMMON_DESIGN_ASSET_BINDING_INVALID");
            if("THEME".equals(type))boundThemes.add(code);else if("SECTION".equals(type))boundSections.add(code);else boundComponents.add(code);
        }
        if(bindings.size()!=boundThemes.size()+boundSections.size()+boundComponents.size()
                ||!boundThemes.equals(Set.of(text(assets,"theme")))
                ||!boundSections.equals(sectionCodes)||!boundComponents.equals(components))
            throw new IllegalStateException("KRDS_SDUI_ASSET_CLOSURE_NOT_EXACT");
        if(integer(source,"registeredAssetCount")!=integer(source,"requiredAssetCount"))
            throw new IllegalStateException("KRDS_SDUI_ASSET_REGISTRY_NOT_EXACT");
        if(!rows(axis(axes,"DATA_HANDOFF"),"inputs","DATA_HANDOFF.inputs").isEmpty()
                &&integer(source,"jsonFormAssetCount")<1)
            throw new IllegalStateException("SDUI_JSON_FORM_INPUT_COMPONENT_REQUIRED");
    }

    private static void validateLosslessBackfill(Map<String,Map<String,Object>> axes,
            Map<String,Object> projection,Map<String,Object> source){
        Map<String,String> contracts=Map.of(
            "kpiContract","kpiContract","sectionContract","sectionContract",
            "fieldContract","fieldContract","commandContract","commandContract",
            "stateContract","stateContract","apiContract","apiContract");
        for(Map.Entry<String,String> entry:contracts.entrySet())
            if(!stable(projection.get(entry.getKey())).equals(
                    stable(parseJson(source.get(entry.getValue()),entry.getValue()))))
                throw new IllegalStateException("LEGACY_AXIS_MAPPING_INCOMPLETE: "+entry.getKey());
        Object sourceData=parseJson(source.get("dataContract"),"dataContract");
        if(sourceData instanceof Map<?,?>)sourceData=object(sourceData,"dataContract").get("entities");
        if(!stable(projection.get("dataContract")).equals(stable(sourceData)))throw new IllegalStateException(
            "LEGACY_AXIS_MAPPING_INCOMPLETE: dataContract");
        for(String field:List.of("businessPurpose","entryCondition","exitCondition"))
            if(!projection.get(field).equals(source.get(field)))
                throw new IllegalStateException("LEGACY_AXIS_MAPPING_INCOMPLETE: "+field);
        for(String field:List.of("workTypeCode","ownerActorCode","stepCompletionRule",
                "responsiveContract","accessibilityContract","securityContract"))
            if(!projection.get(field).equals(source.get(field)))
                throw new IllegalStateException("LEGACY_AXIS_MAPPING_INCOMPLETE: "+field);
        String designedActor=String.valueOf(projection.get("stepActorCode"));
        if(!designedActor.equals(String.valueOf(source.get("contractActorCode")))
                ||(Boolean.TRUE.equals(source.get("activeBinding"))
                   &&(integer(source,"bindingCount")!=1
                      ||integer(source,"bindingActorCount")!=1
                      ||!designedActor.equals(String.valueOf(source.get("bindingActorCode"))))))
            throw new IllegalStateException("LEGACY_AXIS_MAPPING_INCOMPLETE: route actor");
        if(longValue(source,"stepOrder")!=((Number)projection.get("stepOrder")).longValue()
                ||!projection.get("requiresNotification").equals(source.get("requiresNotification"))
                ||!stable(projection.get("permissionCodes")).equals(stable(
                    parseJson(source.get("permissionCodes"),"permissionCodes"))))
            throw new IllegalStateException("LEGACY_AXIS_MAPPING_INCOMPLETE: executable step contract");
        if(!stable(objects(axis(axes,"TASK_EVIDENCE"),"evidence")).equals(
                stable(withoutCompositeMarkers(parseJson(source.get("evidenceContract"),"evidenceContract"))))
                ||!stable(objects(axis(axes,"DESIGN_ASSET"),"assetBindings")).equals(
                    stable(parseJson(source.get("currentAssetBindings"),"currentAssetBindings")))
                ||!projection.get("layout").equals(source.get("currentLayout"))
                ||!projection.get("theme").equals(source.get("currentTheme")))
            throw new IllegalStateException("LEGACY_AXIS_MAPPING_INCOMPLETE: evidence/design assets");
    }

    private static Object withoutCompositeMarkers(Object raw){
        if(!(raw instanceof List<?> rows))return raw;
        return rows.stream().filter(row->!(row instanceof Map<?,?> map)
            ||!"COMPOSITE_EXECUTABLE_DESIGN_AUTHORITY".equals(map.get("markerType"))).toList();
    }

    private static DataClosure validateData(Map<String,Map<String,Object>> axes,Map<String,Object> source){
        List<Map<String,Object>> fields=rows(axis(axes,"FIELD_DICTIONARY"),"fields","FIELD_DICTIONARY.fields");
        Set<String> all=codes(fields,"fieldCode","FIELD_DICTIONARY.fields");
        Set<String> inputs=new HashSet<>(),outputs=new HashSet<>(),sources=new HashSet<>();
        for(Map<String,Object> field:fields){
            String direction=text(field,"direction");
            if(!Set.of("INPUT","OUTPUT","BOTH").contains(direction))throw fail("FIELD_DIRECTION_INVALID");
            if(!Set.of("STRING","NUMBER","INTEGER","BOOLEAN","DATE","DATETIME","OBJECT","ARRAY")
                    .contains(text(field,"dataType")))throw fail("FIELD_DATA_TYPE_INVALID");
            Set<String> boundComponents=rows(axis(axes,"DESIGN_ASSET"),"assetBindings",
                    "DESIGN_ASSET.assetBindings").stream()
                .filter(binding->"COMPONENT".equals(binding.get("assetType")))
                .map(binding->text(binding,"assetCode")).collect(Collectors.toSet());
            if(!boundComponents.contains(text(field,"componentCode")))throw new IllegalStateException(
                "FIELD_COMPONENT_BINDING_NOT_EXACT");
            if(!"OUTPUT".equals(direction))inputs.add(text(field,"fieldCode"));
            if(!"INPUT".equals(direction))outputs.add(text(field,"fieldCode"));
            sources.add(text(field,"dataSource"));
        }
        List<Map<String,Object>> inRows=rows(axis(axes,"DATA_HANDOFF"),"inputs","DATA_HANDOFF.inputs");
        List<Map<String,Object>> outRows=rows(axis(axes,"DATA_HANDOFF"),"outputs","DATA_HANDOFF.outputs");
        Set<String> handedInputs=codes(inRows,"fieldCode","DATA_HANDOFF.inputs");
        Set<String> handedOutputs=codes(outRows,"fieldCode","DATA_HANDOFF.outputs");
        if(!inputs.equals(handedInputs)||!outputs.equals(handedOutputs))
            throw new IllegalStateException("FIELD_INPUT_OUTPUT_HANDOFF_CONTRADICTION");
        List<Map<String,Object>> entities=rows(axis(axes,"DATABASE"),"entities","DATABASE.entities");
        Set<String> entityCodes=codes(entities,"entity","DATABASE.entities"),persisted=new HashSet<>();
        Map<String,Set<String>> entityFields=new LinkedHashMap<>();
        for(Map<String,Object> entity:entities){
            List<String> declared=strings(entity,"fields");Set<String> exact=new HashSet<>(declared);
            if(exact.size()!=declared.size())throw new IllegalStateException("DATABASE_FIELD_DUPLICATE");
            entityFields.put(text(entity,"entity"),exact);persisted.addAll(exact);
        }
        boolean placementExact=fields.stream().allMatch(field->entityFields.getOrDefault(
            text(field,"dataSource"),Set.of()).contains(text(field,"fieldCode")))
            &&all.stream().allMatch(field->entityFields.values().stream().filter(set->set.contains(field)).count()==1);
        if(!entityCodes.equals(sources)||!persisted.equals(all)||!placementExact)
            throw new IllegalStateException("DATABASE_FIELD_CLOSURE_NOT_EXACT");
        validateDatabasePlan(axis(axes,"DATABASE"));
        return new DataClosure(all,handedInputs,handedOutputs);
    }

    private static void validateDatabasePlan(Map<String,Object> database){
        String mode=text(database,"migrationMode"),fingerprint=text(database,"schemaFingerprint");
        if(!Set.of("REGISTERED_EXISTING","SAFE_CREATE_TABLE","NO_DATABASE").contains(mode))throw fail(
            "DATABASE_MIGRATION_MODE_REVIEW_REQUIRED");
        if(!bool(database,"verified"))throw fail("DATABASE_PLAN_NOT_VERIFIED");
        if(!(database.get("schemaChanges") instanceof List<?> raw))throw fail("DATABASE_SCHEMA_CHANGES_REQUIRED");
        if("NO_DATABASE".equals(mode)){
            if(!raw.isEmpty()||!rows(database,"entities","DATABASE.entities").isEmpty()
                    ||!fingerprint.equals(hash(stable(List.of()))))throw fail("NO_DATABASE_CONTRACT_NOT_EXACT");
            return;
        }
        if(raw.isEmpty())throw fail("DATABASE_SCHEMA_CHANGES_REQUIRED");
        List<Map<String,Object>> changes=new ArrayList<>();Set<String> tableNames=new HashSet<>();
        for(Object value:raw){Map<String,Object> change=object(value,"DATABASE.schemaChanges[]");
            validateSchemaChange(change,mode);
            if(!tableNames.add(text(change,"tableName").toLowerCase(Locale.ROOT)))throw fail(
                "DATABASE_TABLE_DUPLICATE");
            changes.add(change);}
        if(!fingerprint.matches("^[0-9a-f]{64}$")||!fingerprint.equals(hash(stable(changes))))
            throw fail("DATABASE_SCHEMA_FINGERPRINT_NOT_EXACT");
        Map<String,Set<String>> entities=new TreeMap<>();
        for(Map<String,Object> entity:rows(database,"entities","DATABASE.entities"))entities.put(
            text(entity,"entity").toLowerCase(Locale.ROOT),new HashSet<>(strings(entity,"fields")));
        Map<String,Set<String>> tables=new TreeMap<>();
        for(Map<String,Object> change:changes){Set<String> columns=new HashSet<>();
            for(Object rawColumn:list(change.get("columns"),"DATABASE.columns"))columns.add(
                text(object(rawColumn,"DATABASE.columns[]"),"name"));
            tables.put(text(change,"tableName"),columns);}
        if(!entities.equals(tables))throw fail("DATABASE_ENTITY_SCHEMA_CHANGE_CLOSURE_NOT_EXACT");
    }

    private static void validateSchemaChange(Map<String,Object> change,String mode){
        exactKeys(change,Set.of("operation","tableName","columns","uniqueConstraints","indexes"),
            "DATABASE.schemaChanges[]");
        String expected="SAFE_CREATE_TABLE".equals(mode)?"CREATE_TABLE":"REGISTERED_TABLE";
        if(!expected.equals(text(change,"operation")))throw fail("DATABASE_SCHEMA_OPERATION_UNSAFE");
        identifier(text(change,"tableName"),"DATABASE.tableName");
        List<?> columns=list(change.get("columns"),"DATABASE.columns");
        if(columns.isEmpty())throw fail("DATABASE_COLUMNS_REQUIRED");Set<String> names=new HashSet<>();int pks=0;
        for(Object value:columns){Map<String,Object> column=object(value,"DATABASE.columns[]");
            Set<String> allowed=Set.of("name","type","primaryKey","nullable","default","references");
            if(!allowed.containsAll(column.keySet())||!column.keySet().containsAll(
                    Set.of("name","type","primaryKey","nullable")))throw fail("DATABASE_COLUMN_KEYS_INVALID");
            String name=text(column,"name");identifier(name,"DATABASE.column.name");
            if(!names.add(name))throw fail("DATABASE_COLUMN_DUPLICATE");
            if(!String.valueOf(column.get("type")).toLowerCase(Locale.ROOT).matches(
                    "^(uuid|bigint|bigserial|integer|boolean|text|jsonb|date|timestamp|timestamptz|varchar\\([1-9][0-9]{0,4}\\)|numeric\\([1-9][0-9]?,[0-9]{1,2}\\))$"))
                throw fail("DATABASE_COLUMN_TYPE_UNSUPPORTED");
            if(!(column.get("primaryKey") instanceof Boolean)||!(column.get("nullable") instanceof Boolean))
                throw fail("DATABASE_COLUMN_FLAGS_REQUIRED");
            if(Boolean.TRUE.equals(column.get("primaryKey")))pks++;
            if(column.containsKey("default")&&!(column.get("default") instanceof String))throw fail(
                "DATABASE_COLUMN_DEFAULT_INVALID");
            if(column.containsKey("references"))validateReference(column.get("references"));
        }
        if(pks<1)throw fail("DATABASE_PRIMARY_KEY_REQUIRED");
        validateUniqueConstraints(change.get("uniqueConstraints"),names);
        validateIndexes(change.get("indexes"),names);
    }

    private static void validateReference(Object value){
        Map<String,Object> reference=object(value,"DATABASE.column.references");
        exactKeys(reference,Set.of("table","column","onDelete"),"DATABASE.column.references");
        identifier(text(reference,"table"),"DATABASE.reference.table");
        identifier(text(reference,"column"),"DATABASE.reference.column");
        if(!Set.of("CASCADE","RESTRICT","SET NULL","NO ACTION").contains(text(reference,"onDelete")))
            throw fail("DATABASE_REFERENCE_DELETE_INVALID");
    }

    private static void validateUniqueConstraints(Object value,Set<String> names){
        List<?> constraints=list(value,"DATABASE.uniqueConstraints");
        for(Object raw:constraints){List<?> fields=list(raw,"DATABASE.uniqueConstraints[]");
            if(fields.isEmpty()||fields.stream().map(String::valueOf).anyMatch(field->!names.contains(field)))
                throw fail("DATABASE_UNIQUE_CONSTRAINT_INVALID");}
    }

    private static void validateIndexes(Object value,Set<String> names){
        List<?> indexes=list(value,"DATABASE.indexes");Set<String> indexNames=new HashSet<>();
        for(Object raw:indexes){Map<String,Object> index=object(raw,"DATABASE.indexes[]");
            exactKeys(index,Set.of("name","columns","unique"),"DATABASE.indexes[]");
            String name=text(index,"name");identifier(name,"DATABASE.index.name");
            if(!indexNames.add(name)||!(index.get("unique") instanceof Boolean))throw fail(
                "DATABASE_INDEX_INVALID");
            List<?> fields=list(index.get("columns"),"DATABASE.index.columns");
            if(fields.isEmpty()||fields.stream().map(String::valueOf).anyMatch(field->!names.contains(field)))
                throw fail("DATABASE_INDEX_COLUMNS_INVALID");}
    }

    private static void identifier(String value,String field){
        if(!value.matches("^[a-z][a-z0-9_]{0,62}$"))throw fail(field+"_INVALID");
    }

    private static List<?> list(Object value,String field){
        if(!(value instanceof List<?> result))throw fail(field+" must be an array");return result;
    }

    private static void validateApiRulesAndTests(Map<String,Map<String,Object>> axes,
            Set<String> commands,DataClosure data,List<String> permissions,Map<String,Object> source){
        List<Map<String,Object>> operations=rows(axis(axes,"API"),"operations","API.operations");
        Set<String> apiInputs=new HashSet<>(),apiOutputs=new HashSet<>(),apiPermissions=new HashSet<>();
        Set<String> authorityPermissions=new HashSet<>(permissions);
        Map<String,Set<String>> commandInputs=new LinkedHashMap<>(),commandOutputs=new LinkedHashMap<>();
        for(Map<String,Object> operation:operations){
            if(!"POST".equals(text(operation,"method"))
                    ||!physicalCommandPath(text(operation,"path")))throw fail(
                "API_OPERATION_NOT_PHYSICALLY_GENERATABLE");
            String command=text(operation,"commandCode");
            if(!commands.contains(command))throw new IllegalStateException("API_COMMAND_CONTRADICTION");
            Set<String> request=new HashSet<>(strings(operation,"requestFields"));
            Set<String> response=new HashSet<>(strings(operation,"responseFields"));
            Set<String> operationPermissions=new HashSet<>(strings(operation,"permissionCodes"));
            if(!data.inputs().containsAll(request)||!data.outputs().containsAll(response)
                    ||!authorityPermissions.containsAll(operationPermissions))
                throw new IllegalStateException("API_COMMAND_INPUT_OUTPUT_PERMISSION_NOT_EXACT: "+command);
            if(commandInputs.putIfAbsent(command,request)!=null)
                throw new IllegalStateException("API_COMMAND_DUPLICATE: "+command);
            commandOutputs.put(command,response);apiInputs.addAll(request);apiOutputs.addAll(response);
            apiPermissions.addAll(operationPermissions);
        }
        if(!commandInputs.keySet().equals(commands)||!apiInputs.equals(data.inputs())
                ||!apiOutputs.equals(data.outputs())||!apiPermissions.equals(authorityPermissions))
            throw new IllegalStateException("API_INPUT_OUTPUT_PERMISSION_CLOSURE_NOT_EXACT");
        Set<String> businessFields=new HashSet<>(data.inputs());businessFields.add("CURRENT_STATE");
        validatePredicateRules(rows(axis(axes,"BUSINESS_RULE"),"rules","BUSINESS_RULE.rules"),
            commands,businessFields,"BUSINESS_RULE");
        validatePredicateRules(rows(axis(axes,"VALIDATION"),"rules","VALIDATION.rules"),
            commands,data.inputs(),"VALIDATION");
        List<Map<String,Object>> notifications=rows(axis(axes,"NOTIFICATION"),"events","NOTIFICATION.events");
        Set<String> responsible=new HashSet<>(strings(axis(axes,"ACTOR_RACI"),"responsibleActorCodes"));
        Set<String> registeredTemplates=jsonStringSet(source.get("registeredNotificationTemplates"),
            "registeredNotificationTemplates");
        for(Map<String,Object> event:notifications){
            if(!commands.contains(text(event,"commandCode")))throw new IllegalStateException(
                "NOTIFICATION_COMMAND_CONTRADICTION");
            if(!Set.of("IN_APP").contains(text(event,"channel")))
                throw fail("NOTIFICATION_CHANNEL_NOT_EXECUTABLE");
            if(!responsible.contains(text(event,"recipientActorCode")))throw new IllegalStateException(
                "NOTIFICATION_RECIPIENT_ACTOR_CONTRADICTION");
            if(!registeredTemplates.contains(text(event,"templateCode")))throw new IllegalStateException(
                "NOTIFICATION_TEMPLATE_NOT_REGISTERED");
        }
        codes(notifications,"eventCode","NOTIFICATION.events");
        List<Map<String,Object>> scenarios=rows(axis(axes,"TEST"),"scenarios","TEST.scenarios");
        references(scenarios,"commandCode",commands,"TEST_COMMAND_CONTRADICTION");
        codes(scenarios,"scenarioCode","TEST.scenarios");
        Set<String> testedCommands=scenarios.stream().map(row->text(row,"commandCode"))
            .collect(Collectors.toSet());
        Map<String,Set<String>> statusesByCommand=new TreeMap<>();
        if(!testedCommands.equals(commands))
            throw new IllegalStateException("TEST_COMMAND_COVERAGE_NOT_EXACT");
        for(Map<String,Object> scenario:scenarios){
            String command=text(scenario,"commandCode");
            Map<String,Object> inputValues=object(scenario.get("inputValues"),"TEST.inputValues");
            if(!inputValues.keySet().equals(commandInputs.get(command))
                    ||!new HashSet<>(strings(scenario,"expectedOutputFields")).equals(commandOutputs.get(command)))
                throw new IllegalStateException("TEST_COMMAND_INPUT_OUTPUT_NOT_EXACT: "+command);
            for(Map.Entry<String,Object> input:inputValues.entrySet())if(input.getKey().isBlank()
                    ||!input.getKey().equals(input.getKey().trim())||input.getValue()==null
                    ||!(input.getValue() instanceof String||input.getValue() instanceof Number
                        ||input.getValue() instanceof Boolean))throw fail("TEST_INPUT_VALUE_NOT_EXECUTABLE");
            String expectedStatus=text(scenario,"expectedStatus");
            if(!EXPECTED_TEST_STATUSES.contains(expectedStatus))
                throw fail("TEST_EXPECTED_STATUS_INVALID");
            if(!statusesByCommand.computeIfAbsent(command,ignored->new HashSet<>()).add(expectedStatus))
                throw new IllegalStateException("TEST_EXPECTED_STATUS_DUPLICATE: "+command+"/"+expectedStatus);
            List<String> assertions=strings(scenario,"assertionCodes");
            if(!new HashSet<>(assertions).containsAll(Set.of("STATUS_MATCH","OUTPUT_FIELDS_MATCH"))
                    ||assertions.stream().anyMatch(code->!Set.of("STATUS_MATCH","OUTPUT_FIELDS_MATCH",
                        "RULES_PASS","VALIDATION_PASS","NOTIFICATION_QUEUED","RELAY_READY").contains(code)))
                throw fail("TEST_ASSERTION_CONTRACT_NOT_EXECUTABLE");
        }
        for(String command:commands)if(!EXPECTED_TEST_STATUSES.equals(statusesByCommand.get(command)))
            throw new IllegalStateException("TEST_EXPECTED_STATUS_COVERAGE_NOT_EXACT: "+command);
        rows(axis(axes,"TASK_EVIDENCE"),"evidence","TASK_EVIDENCE.evidence");
    }

    private static boolean physicalCommandPath(String path){
        String placeholder="{executionId}";
        return path.matches("^/[A-Za-z0-9_{}./-]+$")&&!path.equals("/")&&!path.endsWith("/")
            &&!path.contains("//")&&!path.matches(".*(^|/)\\.{1,2}(/|$).*")
            &&path.indexOf(placeholder)>0&&path.indexOf(placeholder)==path.lastIndexOf(placeholder)
            &&!path.replace(placeholder,"").contains("{")&&!path.replace(placeholder,"").contains("}");
    }

    private static void validatePredicateRules(List<Map<String,Object>> rules,
            Set<String> commands,Set<String> inputs,String owner){
        Set<String> codes=new HashSet<>();
        for(Map<String,Object> rule:rules){
            if(!codes.add(text(rule,"ruleCode")))throw fail(owner+" contains duplicate ruleCode");
            if(!commands.contains(text(rule,"commandCode")))throw new IllegalStateException(
                owner+"_COMMAND_CONTRADICTION");
            if(!inputs.contains(text(rule,"fieldCode")))throw new IllegalStateException(
                owner+"_FIELD_CONTRADICTION");
            String operator=text(rule,"operator"),expected=text(rule,"expectedValue");
            if(!Set.of("REQUIRED","EQ","NE","GT","GTE","LT","LTE").contains(operator))
                throw fail(owner+"_PREDICATE_OPERATOR_UNSUPPORTED");
            if("REQUIRED".equals(operator)&&!"PRESENT".equals(expected))throw fail(
                owner+"_REQUIRED_PREDICATE_VALUE_INVALID");
        }
    }

    private static void validateRelease(Map<String,Object> release){
        Map<String,Object> rollback=object(release.get("rollbackPolicy"),"RELEASE_AUDIT.rollbackPolicy");
        exactKeys(rollback,Set.of("mode","preserveManual","preserveAdopt"),"RELEASE_ROLLBACK_POLICY_REQUIRED");
        if(!"TRANSACTION_ROLLBACK".equals(text(rollback,"mode"))
                ||!(rollback.get("preserveManual") instanceof Boolean)
                ||!(rollback.get("preserveAdopt") instanceof Boolean)
                ||!Boolean.TRUE.equals(rollback.get("preserveManual"))
                ||!Boolean.TRUE.equals(rollback.get("preserveAdopt")))throw fail("RELEASE_ROLLBACK_POLICY_REQUIRED");
    }

    private static Map<String,Object> axis(Map<String,Map<String,Object>> axes,String type){
        return object(axes.get(type).get("payload"),type+".payload");
    }
    private static List<Map<String,Object>> rows(Map<String,Object> source,String field,String owner){
        if(!(source.get(field) instanceof List<?> raw)
                ||(raw.isEmpty()&&!EMPTY_ROW_COLLECTIONS.contains(owner)))
            throw fail(field+" must be "+(EMPTY_ROW_COLLECTIONS.contains(owner)?"an":"a non-empty")+" array");
        List<Map<String,Object>> result=new ArrayList<>();
        for(Object value:raw)result.add(object(value,field+"[]"));
        Set<String> keys=ROW_KEYS.get(owner);
        for(Map<String,Object> row:result){
            exactKeys(row,keys,owner+" row keys invalid");
            Set<String> lists=ROW_LIST_FIELDS.getOrDefault(owner,Set.of());
            Set<String> booleans=ROW_BOOLEAN_FIELDS.getOrDefault(owner,Set.of());
            Set<String> objects=ROW_OBJECT_FIELDS.getOrDefault(owner,Set.of());
            for(String key:keys){
                if(lists.contains(key))strings(row,key);
                else if(booleans.contains(key))bool(row,key);
                else if(objects.contains(key))object(row.get(key),owner+"."+key);
                else{
                    String value=text(row,key);
                    if(value.length()>4096)throw fail(owner+"."+key+" is too long");
                    if((key.endsWith("Code")||key.endsWith("Id")||Set.of("entity","assetType","assetCode","evidenceType","method").contains(key))
                            &&(value.length()>120||!value.matches("^[A-Za-z][A-Za-z0-9_.:-]*$")))
                        throw fail(owner+"."+key+" must be a bounded canonical code");
                }
            }
        }
        Set<String> unique=new HashSet<>();
        for(Map<String,Object> row:result)if(!unique.add(stable(row)))throw fail(owner+" contains duplicate rows");
        return result;
    }
    @SuppressWarnings("unchecked") private static List<Map<String,Object>> objects(Map<String,Object> source,String field){
        if(!(source.get(field) instanceof List<?> list)||list.isEmpty())throw fail(field+" must be a non-empty array");
        List<Map<String,Object>> result=new ArrayList<>();for(Object value:list)result.add(object(value,field+"[]"));return result;
    }
    private static List<String> strings(Map<String,Object> source,String field){
        if(!(source.get(field) instanceof List<?> list))throw fail(field+" must be an array");
        List<String> values=new ArrayList<>();
        for(Object value:list)if(!(value instanceof String text)||text.isBlank()||!text.equals(text.trim()))throw fail(field+" must contain canonical strings");else values.add(text);
        if(new HashSet<>(values).size()!=values.size())throw fail(field+" contains duplicates");return values;
    }
    private static Set<String> codes(List<Map<String,Object>> rows,String field,String owner){
        Set<String> values=new HashSet<>();for(Map<String,Object> row:rows){String value=text(row,field);if(!values.add(value))throw fail(owner+" contains duplicate "+value);}return values;
    }
    private static Set<String> paths(List<Map<String,Object>> rows){
        Set<String> values=new HashSet<>();for(Map<String,Object> row:rows)if(!values.add(text(row,"contractPath")))throw fail("DATA_HANDOFF contractPath contains duplicate");return values;
    }
    private static Set<String> jsonKeys(String value,String field){
        try{JsonNode node=JSON.readTree(value);if(!node.isObject())throw fail(field+" must be a JSON object");Set<String> keys=new HashSet<>();node.fieldNames().forEachRemaining(keys::add);return keys;}
        catch(IllegalArgumentException error){throw error;}catch(Exception error){throw fail(field+" must be valid JSON",error);}
    }
    private static Set<String> jsonStringSet(Object raw,String field){
        Object parsed=parseJson(raw,field);
        if(!(parsed instanceof List<?> list))throw fail(field+" must be a JSON array");
        Set<String> values=new HashSet<>();
        for(Object item:list)if(!(item instanceof String text)||text.isBlank()
                ||!text.equals(text.trim())||!values.add(text))throw fail(
            field+" must contain unique canonical strings");
        return values;
    }
    private static Object parseJson(Object raw,String field){
        try{return JSON.readValue(String.valueOf(raw),Object.class);}
        catch(Exception error){throw fail(field+" must be valid JSON",error);}
    }
    private static void references(List<Map<String,Object>> rows,String field,Set<String> expected,String error){
        for(Map<String,Object> row:rows)if(!expected.contains(text(row,field)))throw new IllegalStateException(error+": "+row.get(field));
    }
    private static void exactKeys(Map<String,Object> value,Set<String> expected,String error){
        if(expected==null||!value.keySet().equals(expected))throw fail(error+" required="+expected);
    }
    private static void canonicalTree(Object value,String owner){
        if(value instanceof Map<?,?> map){for(Map.Entry<?,?> entry:map.entrySet()){String key=String.valueOf(entry.getKey());if(key.isBlank()||!key.equals(key.trim())||containsSurrogate(key))throw fail(owner+" contains a non-canonical key");canonicalTree(entry.getValue(),owner+"."+key);}}
        else if(value instanceof List<?> list)for(Object item:list)canonicalTree(item,owner+"[]");
        else if(value instanceof String text&&(text.isBlank()||!text.equals(text.trim())||containsSurrogate(text)))throw fail(owner+" contains a non-canonical string");
        else if(!(value==null||value instanceof String||value instanceof Number||value instanceof Boolean))throw fail(owner+" contains a non-JSON value");
    }
    @SuppressWarnings("unchecked") private static Map<String,Object> object(Object value,String field){
        if(!(value instanceof Map<?,?> map))throw fail(field+" must be an object");Map<String,Object> copy=new LinkedHashMap<>();map.forEach((key,item)->copy.put(String.valueOf(key),item));return copy;
    }
    private static String text(Map<String,Object> source,String field){
        Object value=source.get(field);if(!(value instanceof String text)||text.isBlank()||!text.equals(text.trim()))throw fail(field+" must be a canonical non-empty string");return text;
    }
    private static boolean bool(Map<String,Object> source,String field){if(!(source.get(field) instanceof Boolean value))throw fail(field+" must be boolean");return value;}
    private static long positive(Map<String,Object> source,String field){long value=longValue(source,field);if(value<1)throw fail(field+" must be a positive integer");return value;}
    private static long longValue(Map<String,Object> source,String field){
        Object value=source.get(field);
        try{
            if(value instanceof Double number&&!Double.isFinite(number))throw new ArithmeticException();
            if(value instanceof Float number&&!Float.isFinite(number))throw new ArithmeticException();
            return new BigDecimal(String.valueOf(value)).longValueExact();
        }catch(Exception error){throw fail(field+" must be an exact finite integer",error);}
    }
    private static int integer(Map<String,Object> source,String field){long value=longValue(source,field);if(value<Integer.MIN_VALUE||value>Integer.MAX_VALUE)throw fail(field+" is outside integer range");return (int)value;}
    private static Map<String,Object> linked(Object... values){Map<String,Object> result=new LinkedHashMap<>();for(int i=0;i<values.length;i+=2)result.put(String.valueOf(values[i]),values[i+1]);return result;}
    static String json(Object value){try{return JSON.writeValueAsString(value);}catch(Exception error){throw fail("value must be JSON serializable",error);}}
    static String hash(String value){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));}catch(NoSuchAlgorithmException impossible){throw new IllegalStateException(impossible);}}
    static String stable(Object value){
        if(value==null)return "null";
        if(value instanceof Map<?,?> raw){Map<String,Object> sorted=new TreeMap<>();raw.forEach((key,item)->sorted.put(String.valueOf(key),item));return sorted.entrySet().stream().map(entry->quoted(entry.getKey())+":"+stable(entry.getValue())).collect(Collectors.joining(",","{","}"));}
        if(value instanceof List<?> list)return list.stream().map(CompositeExecutableDesignAuthorityCompiler::stable).collect(Collectors.joining(",","[","]"));
        if(value instanceof Number number){double normalized=number.doubleValue();if(!Double.isFinite(normalized))throw fail("COMPOSITE_NONFINITE_NUMBER");return String.format(Locale.ROOT,"@%016x",Double.doubleToLongBits(normalized==0d?0d:normalized));}
        if(value instanceof String text)return quoted(text);if(value instanceof Boolean bool)return bool?"true":"false";throw fail("COMPOSITE_NON_JSON_VALUE");
    }
    private static String quoted(String value){if(containsSurrogate(value))throw fail("COMPOSITE_UNPAIRED_SURROGATE");byte[] bytes=value.getBytes(StandardCharsets.UTF_8);StringBuilder encoded=new StringBuilder(bytes.length*2+2).append('"');for(byte item:bytes)encoded.append(String.format(Locale.ROOT,"%02x",item&0xff));return encoded.append('"').toString();}
    private static boolean containsSurrogate(String value){
        for(int index=0;index<value.length();index++){
            char item=value.charAt(index);
            if(Character.isHighSurrogate(item)){
                if(index+1>=value.length()||!Character.isLowSurrogate(value.charAt(++index)))return true;
            }else if(Character.isLowSurrogate(item))return true;
        }
        return false;
    }
    private static IllegalArgumentException fail(String message){return new IllegalArgumentException(message);}
    private static IllegalArgumentException fail(String message,Throwable error){return new IllegalArgumentException(message,error);}
}
