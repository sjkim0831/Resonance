package egovframework.com.platform.governance.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

/** Exact multi-screen execution-spec and one-job package projection. */
final class CompositeExecutableDesignProjectionService {
    private static final ObjectMapper JSON=new ObjectMapper();
    private final JdbcTemplate jdbc;

    CompositeExecutableDesignProjectionService(JdbcTemplate jdbc){this.jdbc=jdbc;}

    Map<String,Object> projectCompositeExecutionSpecs(
            String process,List<Map<String,Object>> plans,String actor){
        Map<String,List<Map<String,Object>>> byStep=new TreeMap<>();
        for(Map<String,Object> plan:plans){
            CompositeExecutableDesignAuthorityCompiler.Compilation compilation=
                (CompositeExecutableDesignAuthorityCompiler.Compilation)plan.get("compilation");
            String step=String.valueOf(compilation.resolvedClosure().get("stepCode"));
            byStep.computeIfAbsent(step,ignored->new ArrayList<>()).add(plan);
        }
        int updated=0;Set<String> endpoints=new HashSet<>();
        for(Map.Entry<String,List<Map<String,Object>>> entry:byStep.entrySet()){
            String step=entry.getKey();List<Map<String,Object>> stepPlans=entry.getValue();
            Integer targetCount=jdbc.queryForObject("""
                select count(*) from framework_composite_design_target_identity
                 where process_code=? and step_code=?
                """,Integer.class,process,step);
            if(targetCount==null||targetCount!=stepPlans.size())throw new IllegalStateException(
                "COMPOSITE_EXECUTION_SPEC_TARGET_COVERAGE_NOT_EXACT: "+step);
            Map<String,Object> compatibility=stepPlans.stream().filter(plan->
                    Boolean.TRUE.equals(plan.get("primaryCompatibility"))).findFirst()
                .orElse(stepPlans.get(0));
            CompositeExecutableDesignAuthorityCompiler.Compilation primary=
                (CompositeExecutableDesignAuthorityCompiler.Compilation)compatibility.get("compilation");
            Map<String,Object> primaryDesign=primary.executableDesign();
            List<Map<String,Object>> screens=new ArrayList<>(),fields=new ArrayList<>(),commands=new ArrayList<>(),
                states=new ArrayList<>(),apis=new ArrayList<>(),tests=new ArrayList<>(),guides=new ArrayList<>(),
                persistence=new ArrayList<>(),handoffs=new ArrayList<>(),policies=new ArrayList<>();
            Set<String> commandRows=new HashSet<>(),stateRows=new HashSet<>(),apiRows=new HashSet<>();
            for(Map<String,Object> plan:stepPlans){
                CompositeExecutableDesignAuthorityCompiler.Compilation compilation=
                    (CompositeExecutableDesignAuthorityCompiler.Compilation)plan.get("compilation");
                Map<String,Object> design=compilation.executableDesign(),closure=compilation.resolvedClosure();
                Map<String,Object> identity=Map.of("routePath",closure.get("routePath"),
                    "audience",closure.get("audience"));
                screens.add(Map.ofEntries(Map.entry("identity",identity),
                    Map.entry("navigation",design.get("NAVIGATION")),
                    Map.entry("activeUi",design.get("ACTIVE_UI")),
                    Map.entry("designAsset",design.get("DESIGN_ASSET")),
                    Map.entry("fields",design.get("FIELD_DICTIONARY")),
                    Map.entry("actorRaci",design.get("ACTOR_RACI")),
                    Map.entry("authority",design.get("AUTHORITY"))));
                fields.add(Map.of("identity",identity,"contract",design.get("FIELD_DICTIONARY")));
                appendDistinct(commands,commandRows,
                    requireList(requireMap(design.get("PROCESS"),"PROCESS").get("commands"),"PROCESS.commands"));
                appendDistinct(states,stateRows,
                    requireList(requireMap(design.get("STATE"),"STATE").get("states"),"STATE.states"));
                List<?> operations=requireList(requireMap(design.get("API"),"API").get("operations"),"API.operations");
                appendDistinct(apis,apiRows,operations);
                for(Object raw:operations){Map<String,Object> operation=requireMap(raw,"API.operations[]");
                    endpoints.add(operation.get("method")+" "+operation.get("path"));}
                tests.add(Map.of("identity",identity,"contract",design.get("TEST")));
                guides.add(compilation.resolvedClosure());
                persistence.add(Map.of("identity",identity,"contract",design.get("DATABASE")));
                handoffs.add(Map.of("identity",identity,"contract",design.get("DATA_HANDOFF")));
                policies.add(Map.of("identity",identity,"businessRules",design.get("BUSINESS_RULE"),
                    "validation",design.get("VALIDATION"),"notification",design.get("NOTIFICATION")));
            }
            Map<String,Object> projection=new LinkedHashMap<>();
            projection.put("actor",Map.of("compatibility",primaryDesign.get("ACTOR_RACI"),
                "screenAuthorities",screens));
            projection.put("business",primaryDesign.get("REQUIREMENT"));
            projection.put("transition",Map.of("compatibility",primaryDesign.get("PROCESS"),
                "states",states));
            projection.put("input",primary.projection().get("stepInputContract"));
            projection.put("output",primary.projection().get("stepOutputContract"));
            projection.put("screens",screens);projection.put("fields",fields);
            projection.put("commands",commands);projection.put("apis",apis);
            projection.put("persistence",persistence);projection.put("handoffs",handoffs);
            projection.put("tests",tests);projection.put("guides",guides);
            projection.put("nonfunctional",Map.of("screenPolicies",policies,
                "sourceAuthority","COMPOSITE_EXECUTABLE_DESIGN_AUTHORITY_V1"));
            int writes=jdbc.update("""
                update framework_step_execution_spec set actor_contract=?::jsonb,
                       business_contract=?::jsonb,transition_contract=?::jsonb,
                       input_contract=?::jsonb,output_contract=?::jsonb,
                       screen_contract=?::jsonb,field_contract=?::jsonb,
                       command_contract=?::jsonb,api_contract=?::jsonb,
                       persistence_contract=?::jsonb,handoff_contract=?::jsonb,
                       test_contract=?::jsonb,guide_contract=?::jsonb,
                       nonfunctional_contract=?::jsonb,design_status='DESIGN_COMPLETE',
                       approval_status='APPROVED',generation_status='READY',
                       blocker_codes='[]'::jsonb,approved_by=?,approved_at=current_timestamp,
                       spec_version=spec_version+1,updated_at=current_timestamp
                 where process_code=? and step_code=? and (
                       actor_contract is distinct from ?::jsonb
                    or business_contract is distinct from ?::jsonb
                    or transition_contract is distinct from ?::jsonb
                    or input_contract is distinct from ?::jsonb
                    or output_contract is distinct from ?::jsonb
                    or screen_contract is distinct from ?::jsonb
                    or field_contract is distinct from ?::jsonb
                    or command_contract is distinct from ?::jsonb
                    or api_contract is distinct from ?::jsonb
                    or persistence_contract is distinct from ?::jsonb
                    or handoff_contract is distinct from ?::jsonb
                    or test_contract is distinct from ?::jsonb
                    or guide_contract is distinct from ?::jsonb
                    or nonfunctional_contract is distinct from ?::jsonb
                    or design_status<>'DESIGN_COMPLETE' or approval_status<>'APPROVED'
                    or generation_status not in('READY','GENERATED') or blocker_codes<>'[]'::jsonb)
                """,toJson(projection.get("actor")),toJson(projection.get("business")),
                toJson(projection.get("transition")),toJson(projection.get("input")),
                toJson(projection.get("output")),toJson(screens),toJson(fields),toJson(commands),
                toJson(apis),toJson(persistence),toJson(handoffs),toJson(tests),toJson(guides),
                toJson(projection.get("nonfunctional")),actor,process,step,
                toJson(projection.get("actor")),toJson(projection.get("business")),
                toJson(projection.get("transition")),toJson(projection.get("input")),
                toJson(projection.get("output")),toJson(screens),toJson(fields),toJson(commands),
                toJson(apis),toJson(persistence),toJson(handoffs),toJson(tests),toJson(guides),
                toJson(projection.get("nonfunctional")));
            if(writes>1)throw new IllegalStateException("COMPOSITE_EXECUTION_SPEC_WRITE_NOT_EXACT");
            updated+=writes;
        }
        return Map.of("updatedStepCount",updated,"endpointExpected",endpoints.size(),
            "targetScreenCount",plans.size());
    }

    private static void appendDistinct(List<Map<String,Object>> target,Set<String> hashes,List<?> rows){
        for(Object raw:rows){Map<String,Object> row=requireMap(raw,"composite row");
            String hash=CompositeExecutableDesignAuthorityCompiler.stable(row);
            if(hashes.add(hash))target.add(row);
        }
    }

    void bindCompositeProcessPackage(String process,List<Map<String,Object>> plans,
            List<Map<String,Object>> receipts,Map<String,Object> canonicalReceipt,String actor){
        if(plans.size()!=receipts.size())throw new IllegalStateException(
            "COMPOSITE_PROCESS_PACKAGE_COVERAGE_NOT_EXACT");
        List<Map<String,Object>> bindings=new ArrayList<>();
        for(int index=0;index<plans.size();index++){
            CompositeExecutableDesignAuthorityCompiler.Compilation compilation=
                (CompositeExecutableDesignAuthorityCompiler.Compilation)plans.get(index).get("compilation");
            Map<String,Object> receipt=receipts.get(index),closure=compilation.resolvedClosure();
            bindings.add(new LinkedHashMap<>(Map.ofEntries(
                Map.entry("stepCode",closure.get("stepCode")),Map.entry("routePath",closure.get("routePath")),
                Map.entry("audience",closure.get("audience")),Map.entry("authorityHash",compilation.authorityHash()),
                Map.entry("documentSetHash",compilation.documentSetHash()),
                Map.entry("executableDesignHash",compilation.executableDesignHash()),
                Map.entry("sharedStepHash",compilation.sharedStepHash()),
                Map.entry("executableDesign",compilation.executableDesign()),
                Map.entry("artifactManifest",compilation.artifactManifest()),
                Map.entry("resolvedClosure",closure),
                Map.entry("generatedSurfaceBindings",receipt.get("generatedSurfaceBindings")),
                Map.entry("generatedSurfaceSetHash",receipt.get("generatedSurfaceSetHash")),
                Map.entry("sourceHash",receipt.get("sourceHash")),
                Map.entry("designSetHash",receipt.get("designSetHash")),
                Map.entry("designCatalogHash",receipt.get("designCatalogHash")),
                Map.entry("endpointCatalogHash",receipt.get("endpointCatalogHash")),
                Map.entry("packageBindingHash",receipt.get("packageBindingHash")),
                Map.entry("jobId",receipt.get("jobId")))));
        }
        bindings.sort(java.util.Comparator.comparing(value->String.join("\u001f",
            String.valueOf(value.get("stepCode")),String.valueOf(value.get("routePath")),
            String.valueOf(value.get("audience")))));
        String setHash=CompositeExecutableDesignAuthorityCompiler.hash(
            CompositeExecutableDesignAuthorityCompiler.stable(bindings));
        List<Map<String,Object>> jobs=jdbc.queryForList("""
            select job_id as "jobId",specification_json as "specificationJson"
              from framework_development_job where job_id=? and process_code=?
               and job_type='FULL_STACK_GENERATION'
               and job_group_code=?||'_CANONICAL_PUBLICATION' for update
            """,canonicalReceipt.get("jobId"),process,process);
        if(jobs.size()!=1)throw new IllegalStateException("COMPOSITE_PROCESS_PACKAGE_JOB_NOT_EXACT");
        Map<String,Object> specification=jsonMap(String.valueOf(jobs.get(0).get("specificationJson")));
        specification.put("compositeAuthoritySchema",
            CompositeExecutableDesignAuthorityCompiler.AUTHORITY_SCHEMA);
        specification.put("compositeAuthorities",bindings);
        specification.put("compositeAuthoritySetHash",setHash);
        specification.put("compositeArtifactOutputMode","SDUI_API_DB_TEST_SUPPORT_SURFACES_V1");
        Object exactProjection=canonicalReceipt.get("exactProjection");
        if(exactProjection instanceof Map<?,?> exact
                &&exact.get("endpointExpected") instanceof Number endpoints)
            specification.put("endpointExpected",endpoints.intValue());
        int updated=jdbc.update("""
            update framework_development_job set specification_json=?::jsonb::text,
                   updated_at=current_timestamp
             where job_id=? and specification_json::jsonb is distinct from ?::jsonb
            """,toJson(specification),jobs.get(0).get("jobId"),toJson(specification));
        if(updated!=1)throw new IllegalStateException("COMPOSITE_PROCESS_PACKAGE_WRITE_NOT_EXACT");
    }

    Map<String,Object> bindGeneratedCompositeSurfaces(String process,String step,
            String audience,String route,
            CompositeExecutableDesignAuthorityCompiler.Compilation compilation,
            Map<String,Object> receipt){
        Map<String,Object> bundle=jsonMap(jdbc.queryForObject(
            "select framework_canonical_screen_bundle(?,?,?,?)::text",String.class,
            process,step,audience,route));
        Map<String,Object> design=requireMap(bundle.get("canonicalDesign"),"canonicalDesign");
        Map<String,Object> lanes=requireMap(design.get("lanes"),"canonicalDesign.lanes");
        Map<String,Object> guide=requireMap(lanes.get("WORK_GUIDE"),"WORK_GUIDE");
        Map<String,Object> help=requireMap(lanes.get("HELP"),"HELP");
        Map<String,Object> qa=requireMap(lanes.get("QA"),"QA");
        Map<String,Object> card=requireMap(lanes.get("DESIGN_CARD"),"DESIGN_CARD");
        Map<String,Object> frontend=requireMap(lanes.get("FRONTEND"),"FRONTEND");
        Map<String,Object> processOutput=requireMap(design.get("process"),"process");
        Map<String,Object> closure=compilation.resolvedClosure(),projection=compilation.projection();
        Map<String,Object> processAxis=requireMap(compilation.executableDesign().get("PROCESS"),"PROCESS");
        guide.put("actorCode",closure.get("actorCode"));guide.put("commandCode",processAxis.get("commandCode"));
        guide.put("fromState",processAxis.get("fromState"));guide.put("toState",processAxis.get("toState"));
        guide.put("completionRule",processAxis.get("completionRule"));
        guide.put("inputContract",projection.get("stepInputContract"));
        guide.put("outputContract",projection.get("stepOutputContract"));
        Map<String,Object> next=new LinkedHashMap<>();next.put("commandCode",processAxis.get("commandCode"));
        next.put("label",processAxis.get("commandCode"));next.put("toState",processAxis.get("toState"));
        next.put("completionRule",processAxis.get("completionRule"));next.put("routePath",route);
        guide.put("nextAction",next);
        if(!projection.get("businessPurpose").equals(help.get("summary"))
                ||!process.equals(String.valueOf(guide.get("processCode")))
                ||!step.equals(String.valueOf(guide.get("stepCode")))
                ||!closure.get("actorCode").equals(guide.get("actorCode"))
                ||!process.equals(String.valueOf(processOutput.get("processCode")))
                ||!route.equals(String.valueOf(frontend.get("routePath")))
                ||!projection.get("sectionContract").equals(card.get("sections"))
                ||!projection.get("fieldContract").equals(frontend.get("fields"))
                ||!projection.get("commandContract").equals(frontend.get("actions")))
            throw new IllegalStateException("COMPOSITE_GENERATED_SURFACE_PROJECTION_MISMATCH");
        if(!route.equals(String.valueOf(next.get("routePath")))
                ||!String.valueOf(closure.get("functions")).contains(String.valueOf(next.get("commandCode"))))
            throw new IllegalStateException("COMPOSITE_NEXT_TASK_SURFACE_MISMATCH");
        if(!containsMarker(help.get("evidence"),compilation.authorityHash())
                ||!containsMarker(qa.get("evidence"),compilation.authorityHash()))
            throw new IllegalStateException("COMPOSITE_HELP_QA_MARKER_NOT_PROPAGATED");
        if(!compilation.selectedAdopt()){
            Map<String,Object> specification=requireMap(card.get("specification"),"DESIGN_CARD.specification");
            Map<String,Object> extensions=requireMap(specification.get("extensions"),"DESIGN_CARD.specification.extensions");
            Map<String,Object> marker=requireMap(extensions.get("compositeAuthority"),"compositeAuthority");
            if(!compilation.authorityHash().equals(marker.get("authorityHash")))throw new IllegalStateException(
                "COMPOSITE_SCREEN_DESIGN_MARKER_NOT_PROPAGATED");
        }
        Map<String,Object> surfaces=new LinkedHashMap<>();surfaces.put("HELP",help);
        surfaces.put("WORK_GUIDE",guide);surfaces.put("ALL_WORK_OVERVIEW",processOutput);
        surfaces.put("QA",qa);surfaces.put("SCREEN_DESIGN",Map.of("card",card,"frontend",frontend));
        surfaces.put("NEXT_TASK",next);List<Map<String,Object>> bindings=new ArrayList<>();
        surfaces.forEach((name,output)->{Map<String,Object> binding=new LinkedHashMap<>();
            binding.put("surface",name);binding.put("authorityHash",compilation.authorityHash());
            binding.put("sourceHash",String.valueOf(receipt.get("sourceHash")));
            binding.put("outputHash",CompositeExecutableDesignAuthorityCompiler.hash(
                CompositeExecutableDesignAuthorityCompiler.stable(output)));
            binding.put("markerHash",CompositeExecutableDesignAuthorityCompiler.hash(
                CompositeExecutableDesignAuthorityCompiler.stable(binding)));bindings.add(binding);});
        String setHash=CompositeExecutableDesignAuthorityCompiler.hash(
            CompositeExecutableDesignAuthorityCompiler.stable(bindings));
        return Map.of("bindings",bindings,"surfaceSetHash",setHash,"outputs",surfaces);
    }

    private static boolean containsMarker(Object raw,String authorityHash){
        if(!(raw instanceof List<?> rows))return false;
        return rows.stream().filter(Map.class::isInstance).map(Map.class::cast).anyMatch(row->
            "COMPOSITE_EXECUTABLE_DESIGN_AUTHORITY".equals(row.get("markerType"))
                &&authorityHash.equals(row.get("authorityHash")));
    }


    private static String toJson(Object value){
        try{return JSON.writeValueAsString(value);}
        catch(JsonProcessingException error){throw new IllegalStateException("JSON_SERIALIZATION_FAILED",error);}
    }
    @SuppressWarnings("unchecked")
    private static Map<String,Object> jsonMap(String value){
        try{return JSON.readValue(value,LinkedHashMap.class);}
        catch(Exception error){throw new IllegalStateException("JSON_OBJECT_REQUIRED",error);}
    }
    @SuppressWarnings("unchecked")
    private static Map<String,Object> castMap(Object value){
        if(!(value instanceof Map<?,?> map))return new LinkedHashMap<>();
        return new LinkedHashMap<>((Map<String,Object>)map);
    }
    @SuppressWarnings("unchecked")
    private static Map<String,Object> requireMap(Object value,String field){
        if(!(value instanceof Map<?,?> map))throw new IllegalStateException(field+" must be an object");
        return new LinkedHashMap<>((Map<String,Object>)map);
    }
    private static List<?> requireList(Object value,String field){
        if(!(value instanceof List<?> list))throw new IllegalStateException(field+" must be an array");
        return list;
    }
}
