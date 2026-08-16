package egovframework.com.platform.governance.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Exact current SOURCE, package, event, and artifact proof for physical completion. */
final class CompositePhysicalEvidenceService {
    private static final ObjectMapper JSON=new ObjectMapper();
    private final JdbcTemplate jdbc;

    CompositePhysicalEvidenceService(JdbcTemplate jdbc){this.jdbc=jdbc;}

    boolean isExact(long jobId,String process){
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
        if(rows.size()!=1)return false;Map<String,Object> row=rows.get(0);
        Map<String,Object> specification=jsonMap(row.get("specification"));
        Map<String,Object> result=jsonMap(row.get("result"));Map<String,Object> evidence=jsonMap(row.get("evidence"));
        if(!Set.of("VERIFIED","COMPLETED").contains(String.valueOf(row.get("jobStatus")))
                ||!"VERIFIED".equals(row.get("qualityStatus"))||count(row,"artifactCount")!=1
                ||count(row,"eventCount")!=1||count(row,"executionCount")!=1
                ||count(row,"authorityCount")<1||count(row,"authorityMismatchCount")!=0
                ||count(row,"scopeTypeCount")!=1||count(row,"projectCount")>1)return false;
        if(!(specification.get("compositeAuthorities") instanceof List<?> authorities)
                ||authorities.size()!=count(row,"authorityCount"))return false;
        String setHash=CompositeExecutableDesignAuthorityCompiler.hash(
            CompositeExecutableDesignAuthorityCompiler.stable(authorities));
        if(!setHash.equals(specification.get("compositeAuthoritySetHash"))
                ||!setHash.equals(evidence.get("compositeAuthoritySetHash")))return false;
        return "carbonet.canonical-generation-evidence/v1".equals(evidence.get("schema"))
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
    }

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
    @SuppressWarnings("unchecked") private static Map<String,Object> jsonMap(Object raw){
        if(raw==null)return Map.of();try{return JSON.readValue(String.valueOf(raw),LinkedHashMap.class);}
        catch(Exception invalid){return Map.of();}
    }
}
