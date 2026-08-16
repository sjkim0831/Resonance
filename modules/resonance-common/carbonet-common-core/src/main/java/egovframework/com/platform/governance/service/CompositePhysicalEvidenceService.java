package egovframework.com.platform.governance.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;

/** Exact current SOURCE, package, event, and artifact proof for physical completion. */
final class CompositePhysicalEvidenceService {
    private static final ObjectMapper JSON=new ObjectMapper();
    private static final Set<String> STATUS_CASES=Set.of(
        "SUCCESS","VALIDATION_ERROR","FORBIDDEN","CONFLICT","RECOVERY");
    private static final List<String> LIVE_LANES=List.of("API","DATABASE","BROWSER");
    private final JdbcTemplate jdbc;

    CompositePhysicalEvidenceService(JdbcTemplate jdbc){this.jdbc=jdbc;}

    enum Verdict { EXACT, LIVE_SMOKE_TEST_PENDING, CANONICAL_INVALID }

    boolean isExact(long jobId,String process){return assess(jobId,process)==Verdict.EXACT;}

    Verdict assess(long jobId,String process){
        List<Map<String,Object>> rows=jdbc.queryForList("""
            select job.job_status as "jobStatus",job.quality_status as "qualityStatus",
                   job.step_code as "stepCode",job.evidence_ref as "evidenceRef",
                   job.rollback_ref as "rollbackRef",proof.specification::text as "specification",
                   proof.result::text as "result",proof.evidence::text as "evidence",
                   (select count(*) from framework_process_artifact artifact
                     where artifact.process_code=job.process_code and artifact.step_code=job.step_code
                       and artifact.target_path=job.target_path
                       and artifact.contract_ref='AUTO:FULL_STACK_GENERATION' and artifact.required
                       and artifact.delivery_status='VERIFIED'
                       and artifact.evidence_ref=job.evidence_ref)::integer as "artifactCount",
                   (select count(*) from framework_development_job_event event
                     where event.job_id=job.job_id and event.event_type='CANONICAL_RELEASE_FINALIZED'
                       and framework_try_jsonb(event.detail_json)=proof.evidence)::integer as "eventCount",
                   (select count(*) from framework_step_execution_spec execution
                     where execution.process_code=job.process_code and execution.step_code=job.step_code
                       and execution.source_hash=proof.evidence->>'sourceHash'
                       and execution.generation_status='GENERATED')::integer as "executionCount",
                   (select count(*) from integrated_design_authority authority
                     where authority.process_code=job.process_code)::integer as "authorityCount",
                   (select count(*) from integrated_design_authority authority
                     where authority.process_code=job.process_code and(
                       authority.job_id is distinct from job.job_id
                       or authority.source_hash is distinct from proof.evidence->>'sourceHash'
                       or authority.design_set_hash is distinct from proof.specification->>'designSetHash'
                       or authority.design_catalog_hash is distinct from proof.evidence->>'designCatalogHash'
                       or authority.endpoint_catalog_hash is distinct from proof.evidence->>'endpointCatalogHash'
                       or 1<>(select count(*) from jsonb_array_elements(case when jsonb_typeof(
                         proof.specification->'compositeAuthorities')='array'
                         then proof.specification->'compositeAuthorities' else '[]'::jsonb end) binding
                         where binding->>'stepCode'=authority.step_code
                           and binding->>'routePath'=authority.route_path
                           and binding->>'audience'=authority.audience
                           and binding->>'authorityHash'=authority.authority_hash
                           and binding->>'documentSetHash'=authority.document_set_hash
                           and binding->>'sourceHash'=authority.source_hash
                           and binding->>'designSetHash'=authority.design_set_hash
                           and binding->>'designCatalogHash'=authority.design_catalog_hash
                           and binding->>'endpointCatalogHash'=authority.endpoint_catalog_hash
                           and binding->>'packageBindingHash'=authority.package_binding_hash)
                       or not exists(select 1 from integrated_design_scope_binding binding
                         where binding.authority_id=authority.authority_id
                           and binding.authority_revision=authority.authority_revision
                           and binding.process_code=authority.process_code
                           and binding.step_code=authority.step_code
                           and binding.route_path=authority.route_path
                           and binding.audience=authority.audience
                           and binding.document_set_hash=authority.document_set_hash
                           and binding.authority_hash=authority.authority_hash)
                       or exists(select 1 from integrated_design_scope_binding binding
                         where binding.authority_id=authority.authority_id
                           and binding.authority_revision=authority.authority_revision and(
                             binding.process_code is distinct from authority.process_code
                             or binding.step_code is distinct from authority.step_code
                             or binding.route_path is distinct from authority.route_path
                             or binding.audience is distinct from authority.audience
                             or binding.document_set_hash is distinct from authority.document_set_hash
                             or binding.authority_hash is distinct from authority.authority_hash))))::integer
                     as "authorityMismatchCount",
                   (select count(distinct binding.scope_type) from integrated_design_authority authority
                     join integrated_design_scope_binding binding
                       on binding.authority_id=authority.authority_id
                      and binding.authority_revision=authority.authority_revision
                    where authority.process_code=job.process_code)::integer as "scopeTypeCount",
                   (select count(distinct binding.project_id) filter(where binding.scope_type='PROJECT')
                      from integrated_design_authority authority
                      join integrated_design_scope_binding binding
                        on binding.authority_id=authority.authority_id
                       and binding.authority_revision=authority.authority_revision
                     where authority.process_code=job.process_code)::integer as "projectCount"
              from framework_development_job job cross join lateral(select
                    framework_try_jsonb(job.specification_json) specification,
                    framework_try_jsonb(job.result_json) result,
                    framework_try_jsonb(job.result_json)->'canonicalGeneration' evidence) proof
             where job.job_id=? and job.process_code=? and job.job_type='FULL_STACK_GENERATION'
               and job.job_group_code=?||'_CANONICAL_PUBLICATION'
            """,jobId,process,process);
        if(rows.size()!=1)return Verdict.CANONICAL_INVALID;Map<String,Object> row=rows.get(0);
        Map<String,Object> specification=jsonMap(row.get("specification"));
        Map<String,Object> result=jsonMap(row.get("result"));Map<String,Object> evidence=jsonMap(row.get("evidence"));
        if(!Set.of("VERIFIED","COMPLETED").contains(String.valueOf(row.get("jobStatus")))
                ||!"VERIFIED".equals(row.get("qualityStatus"))||count(row,"artifactCount")!=1
                ||count(row,"eventCount")!=1||count(row,"executionCount")!=1
                ||count(row,"authorityCount")<1||count(row,"authorityMismatchCount")!=0
                ||count(row,"scopeTypeCount")!=1||count(row,"projectCount")>1)
            return Verdict.CANONICAL_INVALID;
        if(!(specification.get("compositeAuthorities") instanceof List<?> authorities)
                ||authorities.size()!=count(row,"authorityCount"))return Verdict.CANONICAL_INVALID;
        String setHash=CompositeExecutableDesignAuthorityCompiler.hash(
            CompositeExecutableDesignAuthorityCompiler.stable(authorities));
        if(!setHash.equals(specification.get("compositeAuthoritySetHash"))
                ||!setHash.equals(evidence.get("compositeAuthoritySetHash")))
            return Verdict.CANONICAL_INVALID;
        boolean canonical="carbonet.canonical-generation-evidence/v1".equals(evidence.get("schema"))
            &&"SOURCE_IMMEDIATE_V1".equals(evidence.get("activationPolicy"))
            &&"SOURCE_IMMEDIATE_V1".equals(specification.get("activationPolicy"))
            &&process.equals(evidence.get("processCode"))&&row.get("stepCode").equals(evidence.get("stepCode"))
            &&same(evidence,specification,"sourceHash")&&same(evidence,specification,"designCatalogHash")
            &&same(evidence,specification,"endpointCatalogHash")
            &&evidence.get("sourceHash").equals(specification.get("processInputHash"))
            &&hash(evidence,"sourceHash")&&hash(specification,"designSetHash")
            &&hash(evidence,"designCatalogHash")&&hash(evidence,"endpointCatalogHash")
            &&hash(evidence,"packageHash")&&hash(evidence,"releaseHash")
            &&hash(evidence,"compositeArtifactManifestHash")
            &&String.valueOf(result.get("commit")).matches("[0-9a-f]{40}")
            &&String.valueOf(row.get("rollbackRef")).matches("[0-9a-f]{40}")
            &&evidenceRefExact(row,result,evidence);
        if(!canonical)return Verdict.CANONICAL_INVALID;
        return liveSmokeExact(jobId,process)?Verdict.EXACT:Verdict.LIVE_SMOKE_TEST_PENDING;
    }

    private boolean liveSmokeExact(long jobId,String process){
        List<Map<String,Object>> authorities=jdbc.queryForList("""
            select authority.authority_id as "authorityId",
                   authority.authority_revision as "authorityRevision",
                   authority.process_code as "processCode",authority.step_code as "stepCode",
                   authority.route_path as "routePath",authority.audience as "audience",
                   authority.source_hash as "sourceHash",authority.authority_hash as "authorityHash",
                   authority.composite_json::text as "composite",
                   binding.scope_type as "scopeType",binding.project_id as "boundProjectId",
                   framework_try_jsonb(job.result_json)#>>
                     '{canonicalGeneration,compositeArtifactManifestHash}' as "artifactHash"
              from integrated_design_authority authority
              join framework_development_job job on job.job_id=authority.job_id
              join lateral(select candidate.* from integrated_design_scope_binding candidate
                where candidate.authority_id=authority.authority_id
                  and candidate.authority_revision=authority.authority_revision
                  and candidate.process_code=authority.process_code
                  and candidate.step_code=authority.step_code
                  and candidate.route_path=authority.route_path
                  and candidate.audience=authority.audience
                  and candidate.document_set_hash=authority.document_set_hash
                  and candidate.authority_hash=authority.authority_hash
                order by candidate.bound_at desc,candidate.design_version desc nulls last
                limit 1) binding on true
             where authority.process_code=? and authority.job_id=?
               and not exists(select 1 from integrated_design_scope_binding conflicting
                 where conflicting.authority_id=authority.authority_id
                   and conflicting.authority_revision=authority.authority_revision
                   and conflicting.process_code=authority.process_code
                   and conflicting.step_code=authority.step_code
                   and conflicting.route_path=authority.route_path
                   and conflicting.audience=authority.audience
                   and conflicting.document_set_hash=authority.document_set_hash
                   and conflicting.authority_hash=authority.authority_hash
                   and (conflicting.scope_type<>binding.scope_type
                     or coalesce(conflicting.project_id,'')<>coalesce(binding.project_id,'')))
             order by authority.step_code collate "C",authority.route_path collate "C",
                      authority.audience collate "C"
            """,process,jobId);
        if(authorities.isEmpty())return false;
        Map<SmokeKey,ExpectedSmoke> expected=new HashMap<>();
        for(Map<String,Object> authority:authorities)
            if(!declareExpected(authority,expected))return false;
        List<Map<String,Object>> actual=jdbc.queryForList("""
            select evidence.authority_id as "authorityId",
                   evidence.authority_revision as "authorityRevision",
                   evidence.process_code as "processCode",evidence.step_code as "stepCode",
                   evidence.route_path as "routePath",evidence.audience as "audience",
                   evidence.lane as "lane",evidence.status_case as "statusCase",
                   evidence.scenario_code as "scenarioCode",evidence.account_id as "accountId",
                   evidence.tenant_id as "tenantId",evidence.project_id as "projectId",
                   evidence.actor_code as "actorCode",evidence.command_code as "commandCode",
                   evidence.input_json::text as "input",evidence.output_json::text as "output",
                   evidence.from_state as "fromState",evidence.to_state as "toState",
                   evidence.observed_state as "observedState",
                   evidence.expected_status as "expectedStatus",
                   evidence.observed_status as "observedStatus",
                   evidence.source_hash as "sourceHash",evidence.authority_hash as "authorityHash",
                   evidence.target_ref as "targetRef",
                   evidence.lane_evidence::text as "laneEvidence",
                   evidence.account_hash as "accountHash",evidence.command_hash as "commandHash",
                   evidence.input_hash as "inputHash",evidence.output_hash as "outputHash",
                   evidence.state_hash as "stateHash",evidence.status_hash as "statusHash",
                   evidence.lane_evidence_hash as "laneEvidenceHash",
                   evidence.evidence_hash as "evidenceHash",evidence.evidence_ref as "evidenceRef",
                   (job.completed_at is not null and evidence.observed_at>=job.completed_at
                    and evidence.observed_at<=evidence.recorded_at) as "temporalExact",
                   (exists(select 1 from comtnemplyrinfo account
                      join comtnemplyrscrtyestbs security
                        on security.scrty_dtrmn_trget_id=account.esntl_id
                       and nullif(btrim(security.author_code),'') is not null
                     where lower(account.emplyr_id)=lower(evidence.account_id)
                       and account.emplyr_sttus_code in('P','A'))
                    or exists(select 1 from comtnentrprsmber account
                      join comtnemplyrscrtyestbs security
                        on security.scrty_dtrmn_trget_id=account.esntl_id
                       and nullif(btrim(security.author_code),'') is not null
                     where lower(account.entrprs_mber_id)=lower(evidence.account_id)
                       and account.entrprs_mber_sttus in('P','A'))) as "accountActive",
                   (select count(*) from framework_account_actor_assignment assignment
                     join framework_actor_definition actor on actor.actor_code=assignment.actor_code
                       and actor.use_at='Y'
                     where lower(assignment.account_id)=lower(evidence.account_id)
                       and assignment.tenant_id=evidence.tenant_id
                       and (assignment.project_id='*' or (assignment.project_id=evidence.project_id
                         and exists(select 1 from framework_project_actor_assignment project_actor
                           where project_actor.project_id=evidence.project_id
                             and project_actor.actor_code=evidence.actor_code
                             and lower(project_actor.user_id)=lower(evidence.account_id)
                             and project_actor.active_yn='Y')))
                       and assignment.actor_code=evidence.actor_code
                       and assignment.assignment_status='ACTIVE'
                       and assignment.valid_from<=current_date
                       and (assignment.valid_until is null or assignment.valid_until>=current_date)
                   )::integer as "assignmentCount"
               from integrated_design_live_smoke_evidence evidence
               join framework_development_job job on job.job_id=evidence.job_id
               join integrated_design_authority authority
                 on authority.authority_id=evidence.authority_id
                and authority.authority_revision=evidence.authority_revision
                and authority.job_id=evidence.job_id
                and authority.source_hash=evidence.source_hash
                and authority.authority_hash=evidence.authority_hash
              where evidence.job_id=? and evidence.process_code=?
             order by evidence.authority_id,evidence.status_case collate "C",evidence.lane collate "C"
            """,jobId,process);
        if(actual.size()!=expected.size())return false;
        Set<SmokeKey> seen=new TreeSet<>();
        Map<SmokeKey,Map<String,Object>> actualByKey=new HashMap<>();
        for(Map<String,Object> row:actual){
            SmokeKey key=new SmokeKey(longValue(row,"authorityId"),String.valueOf(row.get("statusCase")),
                String.valueOf(row.get("commandCode")),String.valueOf(row.get("scenarioCode")),
                String.valueOf(row.get("lane")));
            if(actualByKey.putIfAbsent(key,row)!=null)return false;
        }
        Map<SmokeCaseKey,SmokeHashes> caseHashes=new HashMap<>();
        for(Map<String,Object> row:actual){
            SmokeKey key=new SmokeKey(longValue(row,"authorityId"),String.valueOf(row.get("statusCase")),
                String.valueOf(row.get("commandCode")),String.valueOf(row.get("scenarioCode")),
                String.valueOf(row.get("lane")));
            ExpectedSmoke declaration=expected.get(key);
            if(declaration==null||!seen.add(key)||!actualExact(row,declaration,actualByKey))return false;
            Map<String,Object> proof=jsonMap(row.get("laneEvidence"));
            SmokeCaseKey caseKey=new SmokeCaseKey(key.authorityId(),key.status(),key.command(),key.scenario());
            SmokeHashes hashes=new SmokeHashes(String.valueOf(row.get("accountHash")),
                String.valueOf(row.get("commandHash")),String.valueOf(row.get("inputHash")),
                String.valueOf(row.get("outputHash")),String.valueOf(row.get("stateHash")),
                String.valueOf(row.get("statusHash")),String.valueOf(proof.get("executionId")),
                String.valueOf(proof.get("idempotencyKeyHash")),String.valueOf(proof.get("observedHttpStatus")));
            SmokeHashes prior=caseHashes.putIfAbsent(caseKey,hashes);
            if(prior!=null&&!prior.equals(hashes))return false;
        }
        return seen.equals(expected.keySet())&&referenceExecutionsExact(expected,actualByKey);
    }

    private boolean declareExpected(Map<String,Object> authority,Map<SmokeKey,ExpectedSmoke> expected){
        Map<String,Object> composite=jsonMap(authority.get("composite"));
        Map<String,Object> design=map(composite.get("executableDesign"));
        Map<String,Object> test=map(design.get("TEST"));
        List<Map<String,Object>> scenarios=maps(test.get("scenarios"));
        Map<String,Object> process=map(design.get("PROCESS"));
        List<Map<String,Object>> commands=maps(process.get("commands"));
        if(commands.isEmpty()||scenarios.size()!=commands.size()*STATUS_CASES.size())return false;
        Map<String,Map<String,Map<String,Object>>> byCommand=new HashMap<>();
        for(Map<String,Object> scenario:scenarios){
            String command=String.valueOf(scenario.get("commandCode"));
            String status=String.valueOf(scenario.get("expectedStatus"));
            if(!STATUS_CASES.contains(status)||byCommand.computeIfAbsent(command,ignored->new HashMap<>())
                    .putIfAbsent(status,scenario)!=null)return false;
        }
        if(!byCommand.keySet().equals(commands.stream().map(row->String.valueOf(
                row.get("commandCode"))).collect(java.util.stream.Collectors.toSet()))
                ||byCommand.values().stream().anyMatch(rows->!rows.keySet().equals(STATUS_CASES)))return false;
        Map<String,Object> raci=map(design.get("ACTOR_RACI"));
        Map<String,Object> state=map(design.get("STATE"));
        Map<String,Object> api=map(design.get("API"));
        String primaryActor=String.valueOf(raci.get("actorCode"));
        long authorityId=longValue(authority,"authorityId");
        String scopeType=String.valueOf(authority.get("scopeType"));
        String project="GLOBAL".equals(scopeType)?"":String.valueOf(authority.get("boundProjectId"));
        String artifact=String.valueOf(authority.get("artifactHash"));
        if(!Set.of("GLOBAL","PROJECT").contains(scopeType)
                ||("PROJECT".equals(scopeType)&&!project.matches("^[A-Z][A-Z0-9_-]{2,63}$"))
                ||!hashValue(artifact))return false;
        for(Map<String,Object> commandRow:commands){
            String command=String.valueOf(commandRow.get("commandCode"));
            String actor=String.valueOf(commandRow.get("actorCode"));
            if(actor.isBlank()||(!actor.equals(primaryActor)&&!strings(
                    raci.get("responsibleActorCodes")).contains(actor)))return false;
            List<Map<String,Object>> transitions=maps(state.get("states")).stream()
                .filter(row->command.equals(row.get("commandCode"))).toList();
            List<Map<String,Object>> operations=maps(api.get("operations")).stream()
                .filter(row->command.equals(row.get("commandCode"))).toList();
            if(transitions.size()!=1||operations.size()!=1)return false;
            Map<String,Object> transition=transitions.get(0),operation=operations.get(0);
            String from=String.valueOf(transition.get("fromState"));
            String to=String.valueOf(transition.get("toState"));
            for(Map.Entry<String,Map<String,Object>> entry:byCommand.get(command).entrySet()){
                Map<String,Object> scenario=entry.getValue();String status=entry.getKey();
                Map<String,Object> input=map(scenario.get("inputValues"));
                Set<String> outputFields=new TreeSet<>(strings(scenario.get("expectedOutputFields")));
                Map<String,Object> expectedOutputValues=map(scenario.get("expectedOutputValues"));
                int expectedHttpStatus=scenario.get("expectedHttpStatus") instanceof Number number
                    ?number.intValue():-1;
                Map<String,Object> trigger=map(scenario.get("trigger"));
                if(!expectedOutputValues.keySet().equals(outputFields)||expectedHttpStatus<100
                        ||expectedHttpStatus>599||trigger.isEmpty())return false;
                String observed=Set.of("SUCCESS","CONFLICT","RECOVERY").contains(status)?to:from;
                for(String lane:LIVE_LANES){
                    String target=switch(lane){
                        case "API" -> operation.get("method")+" "+operation.get("path");
                        case "DATABASE" -> "entity:framework_process_execution";
                        default -> String.valueOf(authority.get("routePath"));
                    };
                    String scenarioCode=String.valueOf(scenario.get("scenarioCode"));
                    SmokeKey key=new SmokeKey(authorityId,status,command,scenarioCode,lane);
                    ExpectedSmoke value=new ExpectedSmoke(authority,input,outputFields,
                        expectedOutputValues,expectedHttpStatus,trigger,actor,command,
                        scenarioCode,from,to,observed,status,target,scopeType,project,artifact);
                    if(expected.putIfAbsent(key,value)!=null)return false;
                }
            }
        }
        return true;
    }

    private boolean actualExact(Map<String,Object> row,ExpectedSmoke declaration,
            Map<SmokeKey,Map<String,Object>> actualByKey){
        Map<String,Object> authority=declaration.authority();
        Map<String,Object> input=jsonMap(row.get("input")),output=jsonMap(row.get("output"));
        Map<String,Object> laneEvidence=jsonMap(row.get("laneEvidence"));
        String status=declaration.status(),lane=String.valueOf(row.get("lane"));
        int assignments=count(row,"assignmentCount");
        if(!Boolean.TRUE.equals(row.get("temporalExact"))||!Boolean.TRUE.equals(row.get("accountActive"))
                ||("FORBIDDEN".equals(status)?assignments!=0:assignments!=1)
                ||longValue(row,"authorityRevision")!=longValue(authority,"authorityRevision")
                ||!sameText(row,authority,"processCode")||!sameText(row,authority,"stepCode")
                ||!sameText(row,authority,"routePath")||!sameText(row,authority,"audience")
                ||!sameText(row,authority,"sourceHash")||!sameText(row,authority,"authorityHash")
                ||!declaration.scenario().equals(row.get("scenarioCode"))
                ||!declaration.actor().equals(row.get("actorCode"))
                ||!declaration.command().equals(row.get("commandCode"))
                ||("PROJECT".equals(declaration.scopeType())
                    ?!declaration.project().equals(row.get("projectId"))
                    :!String.valueOf(row.get("projectId")).matches("^[A-Z][A-Z0-9_-]{2,63}$"))
                ||!CompositeExecutableDesignAuthorityCompiler.stable(input).equals(
                    CompositeExecutableDesignAuthorityCompiler.stable(declaration.input()))
                ||!output.keySet().equals(declaration.outputFields())
                ||!declaration.from().equals(row.get("fromState"))
                ||!declaration.to().equals(row.get("toState"))
                ||!declaration.observed().equals(row.get("observedState"))
                ||!status.equals(row.get("expectedStatus"))||!status.equals(row.get("observedStatus"))
                ||!declaration.target().equals(row.get("targetRef"))
                ||!laneProofExact(row,laneEvidence,lane,declaration.target(),
                    declaration.artifact(),declaration.expectedHttpStatus(),status)
                ||!executionContextExact(row,laneEvidence,declaration)
                ||!outputValuesExact(output,input,declaration,laneEvidence,actualByKey))return false;
        String run=String.valueOf(laneEvidence.get("runId"));
        String artifact=String.valueOf(laneEvidence.get("artifactHash"));
        return String.valueOf(row.get("evidenceRef")).equals(
            "live:"+run+";lane:"+lane+";artifact:"+artifact);
    }

    private boolean executionContextExact(Map<String,Object> row,Map<String,Object> proof,
            ExpectedSmoke declaration){
        String executionId=String.valueOf(proof.get("executionId"));
        if(!executionId.matches("[0-9a-fA-F-]{36}"))return false;
        Integer count=jdbc.queryForObject("""
            select count(*) from framework_process_execution execution
             where execution.execution_id=?::uuid and execution.tenant_id=?
               and execution.project_id=? and execution.process_code=?
               and execution.current_state=?
            """,Integer.class,executionId,row.get("tenantId"),row.get("projectId"),
            row.get("processCode"),declaration.observed());
        return count!=null&&count==1;
    }

    private boolean outputValuesExact(Map<String,Object> output,Map<String,Object> input,
            ExpectedSmoke declaration,Map<String,Object> proof,
            Map<SmokeKey,Map<String,Object>> actualByKey){
        Map<String,Object> event=Map.of();
        if(declaration.expectedOutputValues().values().stream().filter(Map.class::isInstance)
                .map(Map.class::cast).anyMatch(row->"DATABASE_EVENT".equals(row.get("source")))){
            List<Map<String,Object>> events=jdbc.queryForList("""
                select event_id as "eventId",to_state as "toState"
                  from framework_process_execution_event
                 where execution_id=?::uuid and command_code=?
                """,proof.get("executionId"),declaration.command());
            if(events.size()!=1)return false;event=events.get(0);
        }
        Map<String,Object> reference=Map.of();
        Object referenceCode=declaration.trigger().get("referenceScenarioCode");
        if(referenceCode!=null){
            SmokeKey key=new SmokeKey(longValue(declaration.authority(),"authorityId"),
                "SUCCESS",declaration.command(),String.valueOf(referenceCode),"API");
            Map<String,Object> row=actualByKey.get(key);if(row==null)return false;
            reference=jsonMap(row.get("output"));
        }
        Map<String,Object> expected=new LinkedHashMap<>();
        for(String field:declaration.outputFields()){
            Map<String,Object> descriptor=map(declaration.expectedOutputValues().get(field));
            String source=String.valueOf(descriptor.get("source"));Object value;
            if("LITERAL".equals(source)){
                if(!descriptor.keySet().equals(Set.of("source","value"))
                        ||descriptor.get("value")==null)return false;
                value=descriptor.get("value");
            }else{
                if(!descriptor.keySet().equals(Set.of("source","path")))return false;
                String path=String.valueOf(descriptor.get("path"));
                Map<String,Object> origin=switch(source){
                    case "REQUEST" -> input;
                    case "DATABASE_EVENT" -> event;
                    case "DECLARED_STATE" -> Map.of("fromState",declaration.from(),
                        "toState",declaration.to());
                    case "REFERENCE_SCENARIO" -> reference;
                    default -> Map.of();
                };
                if(!origin.containsKey(path)||origin.get(path)==null)return false;value=origin.get(path);
            }
            expected.put(field,value);
        }
        return CompositeExecutableDesignAuthorityCompiler.stable(expected).equals(
            CompositeExecutableDesignAuthorityCompiler.stable(output));
    }

    private boolean referenceExecutionsExact(Map<SmokeKey,ExpectedSmoke> expected,
            Map<SmokeKey,Map<String,Object>> actual){
        for(Map.Entry<SmokeKey,ExpectedSmoke> entry:expected.entrySet()){
            SmokeKey key=entry.getKey();if(!"API".equals(key.lane()))continue;
            ExpectedSmoke declaration=entry.getValue();
            String status=declaration.status();
            Map<String,Object> proof=jsonMap(actual.get(key).get("laneEvidence"));
            if(Set.of("CONFLICT","RECOVERY").contains(status)){
                String reference=String.valueOf(declaration.trigger().get("referenceScenarioCode"));
                Map<String,Object> success=actual.get(new SmokeKey(key.authorityId(),"SUCCESS",
                    key.command(),reference,"API"));
                if(success==null)return false;Map<String,Object> successProof=jsonMap(success.get("laneEvidence"));
                boolean sameExecution=proof.get("executionId").equals(successProof.get("executionId"));
                boolean sameKey=proof.get("idempotencyKeyHash").equals(successProof.get("idempotencyKeyHash"));
                if(!sameExecution||("RECOVERY".equals(status)?!sameKey:sameKey))return false;
            }
            if("SUCCESS".equals(status)){
                Set<String> isolated=new TreeSet<>();isolated.add(String.valueOf(proof.get("executionId")));
                for(String otherStatus:List.of("VALIDATION_ERROR","FORBIDDEN")){
                    Map<String,Object> other=actual.entrySet().stream().filter(row->
                        row.getKey().authorityId()==key.authorityId()&&row.getKey().command().equals(key.command())
                        &&row.getKey().status().equals(otherStatus)&&row.getKey().lane().equals("API"))
                        .map(Map.Entry::getValue).findFirst().orElse(null);
                    if(other==null||!isolated.add(String.valueOf(
                            jsonMap(other.get("laneEvidence")).get("executionId"))))return false;
                }
            }
        }
        return true;
    }

    private static boolean laneProofExact(Map<String,Object> row,Map<String,Object> proof,
            String lane,String target,String artifact,int expectedHttpStatus,String status){
        Set<String> common=Set.of("schema","source","runId","targetRef","observed",
            "requestHash","responseHash","artifactHash","executionId","idempotencyKeyHash",
            "observedHttpStatus");
        Set<String> keys=new TreeSet<>(common);
        if("API".equals(lane))keys.addAll(Set.of("transportHash","httpStatus"));
        if("DATABASE".equals(lane))keys.addAll(Set.of("rereadHash","transactionHash"));
        if("BROWSER".equals(lane))keys.addAll(Set.of("domHash","screenshotHash","rendered",
            "runtimeObserved","accessDenied","domArtifactRef","screenshotArtifactRef"));
        String source=switch(lane){case "API"->"API_HTTP";
            case "DATABASE"->"POSTGRES_REREAD";default->"BROWSER_DOM";};
        if(!proof.keySet().equals(keys)||!"carbonet.composite-live-smoke-lane/v1".equals(proof.get("schema"))
                ||!source.equals(proof.get("source"))||!target.equals(proof.get("targetRef"))
                ||!Boolean.TRUE.equals(proof.get("observed"))
                ||!String.valueOf(proof.get("runId")).matches("[0-9a-f]{8}-[0-9a-f-]{27}")
                ||!artifact.equals(proof.get("artifactHash"))
                ||!String.valueOf(proof.get("executionId")).matches("[0-9a-fA-F-]{36}")
                ||!hashValue(proof.get("idempotencyKeyHash"))
                ||!(proof.get("observedHttpStatus") instanceof Number observed)
                ||observed.intValue()!=expectedHttpStatus
                ||!row.get("inputHash").equals(proof.get("requestHash"))
                ||!row.get("outputHash").equals(proof.get("responseHash")))return false;
        return switch(lane){
            case "API" -> hashValue(proof.get("transportHash"))
                &&proof.get("httpStatus") instanceof Number http&&http.intValue()==expectedHttpStatus;
            case "DATABASE" -> hashValue(proof.get("rereadHash"))&&hashValue(proof.get("transactionHash"));
            case "BROWSER" -> Boolean.TRUE.equals(proof.get("rendered"))
                &&Boolean.TRUE.equals(proof.get("accessDenied"))=="FORBIDDEN".equals(status)
                &&Boolean.TRUE.equals(proof.get("runtimeObserved"))!="FORBIDDEN".equals(status)
                &&hashValue(proof.get("domHash"))&&hashValue(proof.get("screenshotHash"))
                &&artifactReferenceExact(proof.get("domArtifactRef"),proof.get("domHash"),"dom.html")
                &&artifactReferenceExact(proof.get("screenshotArtifactRef"),
                    proof.get("screenshotHash"),"screenshot.png");
            default -> true;
        };
    }

    private static boolean artifactReferenceExact(Object reference,Object hash,String suffix){
        if(!hashValue(hash))return false;
        String value=String.valueOf(reference),digest=String.valueOf(hash);
        return value.matches("^[1-9][0-9]{0,18}/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-"+
                "[0-9a-f]{4}-[0-9a-f]{12}/[0-9a-f]{64}\\."+suffix.replace(".","\\.")+"$")
            &&value.endsWith("/"+digest+"."+suffix);
    }

    private record SmokeKey(long authorityId,String status,String command,String scenario,String lane)
            implements Comparable<SmokeKey>{
        @Override public int compareTo(SmokeKey other){
            int value=Long.compare(authorityId,other.authorityId);
            if(value==0)value=status.compareTo(other.status);
            if(value==0)value=command.compareTo(other.command);
            if(value==0)value=scenario.compareTo(other.scenario);
            return value==0?lane.compareTo(other.lane):value;
        }
    }
    private record SmokeCaseKey(long authorityId,String status,String command,String scenario) {}
    private record SmokeHashes(String account,String command,String input,String output,
        String state,String status,String executionId,String idempotencyKeyHash,String httpStatus) {}
    private record ExpectedSmoke(Map<String,Object> authority,Map<String,Object> input,
        Set<String> outputFields,Map<String,Object> expectedOutputValues,int expectedHttpStatus,
        Map<String,Object> trigger,String actor,String command,String scenario,String from,String to,
        String observed,String status,String target,String scopeType,String project,String artifact) {}

    private static boolean same(Map<String,Object> left,Map<String,Object> right,String key){
        return left.get(key)!=null&&left.get(key).equals(right.get(key));
    }
    private static boolean hash(Map<String,Object> value,String key){
        return String.valueOf(value.get(key)).matches("[0-9a-f]{64}");
    }
    private static boolean evidenceRefExact(Map<String,Object> row,Map<String,Object> result,
            Map<String,Object> evidence){
        String value=String.valueOf(row.get("evidenceRef"));
        return value.matches("^git:[0-9a-f]{40};release:[0-9a-f]{64};log:.+$")
            &&value.startsWith("git:"+result.get("commit")+";release:"+
                evidence.get("releaseHash")+";log:");
    }
    private static int count(Map<String,Object> row,String key){return ((Number)row.get(key)).intValue();}
    private static long longValue(Map<String,Object> row,String key){return ((Number)row.get(key)).longValue();}
    private static boolean sameText(Map<String,Object> left,Map<String,Object> right,String key){
        return String.valueOf(left.get(key)).equals(String.valueOf(right.get(key)));
    }
    private static boolean hashValue(Object value){return String.valueOf(value).matches("[0-9a-f]{64}");}
    @SuppressWarnings("unchecked") private static Map<String,Object> map(Object raw){
        return raw instanceof Map<?,?> value?(Map<String,Object>)value:Map.of();
    }
    private static List<Map<String,Object>> maps(Object raw){
        if(!(raw instanceof List<?> list))return List.of();List<Map<String,Object>> result=new ArrayList<>();
        for(Object value:list){Map<String,Object> row=map(value);if(row.isEmpty())return List.of();result.add(row);}
        return result;
    }
    private static List<String> strings(Object raw){
        if(!(raw instanceof List<?> list))return List.of();return list.stream().map(String::valueOf).toList();
    }
    @SuppressWarnings("unchecked") private static Map<String,Object> jsonMap(Object raw){
        if(raw==null)return Map.of();try{return JSON.readValue(String.valueOf(raw),LinkedHashMap.class);}
        catch(Exception invalid){return Map.of();}
    }
}
