package egovframework.com.platform.governance.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;

/** Persistence, CAS, SOURCE projection, and immutable package binding. */
final class CompositeExecutableDesignAuthorityStore {
    private static final ObjectMapper JSON=new ObjectMapper();
    private final JdbcTemplate jdbc;
    private final ActorProcessGovernanceService host;
    private final CompositeExecutableDesignProjectionService projection;

    CompositeExecutableDesignAuthorityStore(JdbcTemplate jdbc,ActorProcessGovernanceService host,
            CompositeExecutableDesignProjectionService projection){
        this.jdbc=jdbc;this.host=host;this.projection=projection;
    }

    Map<String,Object> loadCompositeAuthorityHead(String process,String step,String route,
            String audience){
        List<Map<String,Object>> heads=jdbc.queryForList("""
            select authority_id as "authorityId",authority_revision as "authorityRevision",
                   step_code as "stepCode",route_path as "routePath",audience,
                   authority_hash as "authorityHash",document_set_hash as "documentSetHash",
                   contract_id as "contractId",selected_blueprint_id as "selectedBlueprintId",
                   source_hash as "sourceHash",design_set_hash as "designSetHash",
                   design_catalog_hash as "designCatalogHash",
                   endpoint_catalog_hash as "endpointCatalogHash",
                   package_binding_hash as "packageBindingHash",job_id as "jobId",
                   composite_json::text as "compositeJson"
              from integrated_design_authority where process_code=? and step_code=?
               and route_path=? and audience=? for update
            """,process,step,route,audience);
        if(heads.size()>1)throw new IllegalStateException("COMPOSITE_DESIGN_AUTHORITY_HEAD_NOT_EXACT");
        return heads.isEmpty()?Map.of():new LinkedHashMap<>(heads.get(0));
    }

    private static Map<String,Object> castMap(Object value){
        return requireMap(value,"compositeBatchPlan");
    }

    Map<String,Object> compositeDesignScope(Map<String,Object> body){
        String type=def(body,"scopeType","GLOBAL").toUpperCase(Locale.ROOT);
        if(!Set.of("GLOBAL","PROJECT").contains(type))throw new IllegalArgumentException(
            "COMPOSITE_DESIGN_SCOPE_TYPE_INVALID");
        String project=str(body,"projectId").toUpperCase(Locale.ROOT);
        String checksum=str(body,"contractSha256").toLowerCase(Locale.ROOT);
        Object rawVersion=body.get("designVersion");
        if("GLOBAL".equals(type)){
            if(!project.isBlank()||!checksum.isBlank()||rawVersion!=null)throw new IllegalArgumentException(
                "GLOBAL_COMPOSITE_SCOPE_FORBIDS_PROJECT_PROVENANCE");
            return Map.of("scopeType","GLOBAL");
        }
        if(!project.matches("^[A-Z][A-Z0-9_-]{2,63}$")
                ||!checksum.matches("^[0-9a-f]{64}$"))throw new IllegalArgumentException(
            "PROJECT_COMPOSITE_SCOPE_PROVENANCE_INVALID");
        long version;
        try{version=new BigDecimal(String.valueOf(rawVersion)).longValueExact();}
        catch(Exception error){throw new IllegalArgumentException(
            "designVersion must be an exact positive integer",error);}
        if(version<1||version>Integer.MAX_VALUE)throw new IllegalArgumentException(
            "designVersion must be a positive 32-bit integer");
        return Map.of("scopeType","PROJECT","projectId",project,"designVersion",(int)version,
            "contractSha256",checksum);
    }

    void validateCompositeDesignScope(String process,Map<String,Object> scope){
        Map<String,Object> existing=jdbc.queryForMap("""
            select count(*) filter(where scope_type='GLOBAL')::integer as "globalCount",
                   count(*) filter(where scope_type='PROJECT')::integer as "projectCount",
                   count(distinct project_id) filter(where scope_type='PROJECT')::integer
                     as "distinctProjectCount",
                   min(project_id) filter(where scope_type='PROJECT') as "boundProjectId"
              from integrated_design_scope_binding where process_code=?
            """,process);
        if("GLOBAL".equals(scope.get("scopeType"))
                &&((Number)existing.get("projectCount")).intValue()>0)
            throw new IllegalStateException("PROJECT_COMPOSITE_SCOPE_CANNOT_BE_RECLASSIFIED_GLOBAL");
        if("PROJECT".equals(scope.get("scopeType"))
                &&((Number)existing.get("globalCount")).intValue()>0)
            throw new IllegalStateException("GLOBAL_COMPOSITE_SCOPE_CANNOT_BE_SHARED_WITH_PROJECT");
        if("PROJECT".equals(scope.get("scopeType"))
                &&((Number)existing.get("projectCount")).intValue()>0
                &&(((Number)existing.get("distinctProjectCount")).intValue()!=1
                    ||!scope.get("projectId").equals(existing.get("boundProjectId"))))
            throw new IllegalStateException("PROJECT_COMPOSITE_PROCESS_SHARED");
    }

    boolean bindCompositeDesignScope(String process,
            CompositeExecutableDesignAuthorityCompiler.Compilation compilation,
            Map<String,Object> authorityHead,Map<String,Object> scope,String actor){
        String step=String.valueOf(authorityHead.get("stepCode"));
        String route=String.valueOf(authorityHead.get("routePath"));
        String audience=String.valueOf(authorityHead.get("audience"));
        long revision=((Number)authorityHead.get("authorityRevision")).longValue();
        Map<String,Object> authority=jdbc.queryForMap("""
            select authority_id as "authorityId",authority_revision as "authorityRevision"
              from integrated_design_authority where process_code=? and step_code=?
               and route_path=? and audience=? and authority_revision=?
               and document_set_hash=? and authority_hash=?
            """,process,step,route,audience,revision,
            compilation.documentSetHash(),compilation.authorityHash());
        long authorityId=((Number)authority.get("authorityId")).longValue();
        Map<String,Object> material=new LinkedHashMap<>();material.put("scopeType",scope.get("scopeType"));
        if("PROJECT".equals(scope.get("scopeType"))){material.put("projectId",scope.get("projectId"));
            material.put("designVersion",scope.get("designVersion"));
            material.put("contractSha256",scope.get("contractSha256"));}
        material.put("processCode",process);material.put("stepCode",step);material.put("routePath",route);
        material.put("audience",audience);material.put("authorityId",authorityId);
        material.put("authorityRevision",revision);material.put("documentSetHash",compilation.documentSetHash());
        material.put("authorityHash",compilation.authorityHash());
        String provenanceHash=CompositeExecutableDesignAuthorityCompiler.hash(
            CompositeExecutableDesignAuthorityCompiler.stable(material));
        List<Map<String,Object>> existing="PROJECT".equals(scope.get("scopeType"))
            ?jdbc.queryForList("""
                select authority_id as "authorityId",authority_revision as "authorityRevision",
                       contract_sha256 as "contractSha256",document_set_hash as "documentSetHash",
                       authority_hash as "authorityHash",provenance_hash as "provenanceHash"
                  from integrated_design_scope_binding where scope_type='PROJECT'
                   and project_id=? and design_version=? and process_code=? and step_code=?
                   and route_path=? and audience=? for update
                """,scope.get("projectId"),scope.get("designVersion"),process,step,route,audience)
            :jdbc.queryForList("""
                select authority_id as "authorityId",authority_revision as "authorityRevision",
                       document_set_hash as "documentSetHash",authority_hash as "authorityHash",
                       provenance_hash as "provenanceHash"
                  from integrated_design_scope_binding where scope_type='GLOBAL'
                   and authority_id=? and authority_revision=? for update
                """,authorityId,revision);
        if(existing.size()>1)throw new IllegalStateException("COMPOSITE_SCOPE_BINDING_NOT_EXACT");
        if(!existing.isEmpty()){
            Map<String,Object> row=existing.get(0);
            boolean exact=authorityId==((Number)row.get("authorityId")).longValue()
                &&revision==((Number)row.get("authorityRevision")).longValue()
                &&compilation.documentSetHash().equals(row.get("documentSetHash"))
                &&compilation.authorityHash().equals(row.get("authorityHash"))
                &&provenanceHash.equals(row.get("provenanceHash"))
                &&(!"PROJECT".equals(scope.get("scopeType"))
                    ||scope.get("contractSha256").equals(row.get("contractSha256")));
            if(!exact)throw new IllegalStateException("COMPOSITE_SCOPE_PROVENANCE_CONFLICT");
            return false;
        }
        int inserted=jdbc.update("""
            insert into integrated_design_scope_binding(
              authority_id,authority_revision,scope_type,project_id,design_version,contract_sha256,
              process_code,step_code,route_path,audience,document_set_hash,authority_hash,
              provenance_hash,bound_by) values(?,?,?,?,?,?,?,?,?,?,?,?,?,?)
            """,authorityId,revision,scope.get("scopeType"),scope.get("projectId"),
            scope.get("designVersion"),scope.get("contractSha256"),process,step,route,audience,
            compilation.documentSetHash(),compilation.authorityHash(),provenanceHash,actor);
        if(inserted!=1)throw new IllegalStateException("COMPOSITE_SCOPE_BINDING_INSERT_NOT_EXACT");
        return true;
    }

    private static long nonNegativeLong(Map<String,Object> source,String field,long fallback){
        Object raw=source.get(field);if(raw==null)return fallback;
        try{long value=raw instanceof Number number?number.longValue():Long.parseLong(String.valueOf(raw));
            if(value<0)throw new NumberFormatException();return value;}
        catch(NumberFormatException error){throw new IllegalArgumentException(
            field+" must be a non-negative integer",error);}
    }

    Map<String,Object> bindAndPersistCompositeAuthority(String process,String step,
            String route,String audience,
            CompositeExecutableDesignAuthorityCompiler.Compilation compilation,
            Map<String,Object> authorityHead,Map<String,Object> canonicalReceipt,String actor,
            Map<String,Object> scope){
        Map<String,Object> receipt=new LinkedHashMap<>(canonicalReceipt);
        Map<String,Object> surfaces=projection.bindGeneratedCompositeSurfaces(
            process,step,audience,route,compilation,receipt);
        compilation.composite().put("generatedSurfaceBindings",surfaces.get("bindings"));
        compilation.composite().put("generatedSurfaceSetHash",surfaces.get("surfaceSetHash"));
        compilation.composite().put("generatedSurfaceOutputs",surfaces.get("outputs"));
        String packageBindingHash=CompositeExecutableDesignAuthorityCompiler.hash(
            CompositeExecutableDesignAuthorityCompiler.stable(Map.of(
                "authorityHash",compilation.authorityHash(),"sourceHash",receipt.get("sourceHash"),
                "designSetHash",receipt.get("designSetHash"),
                "designCatalogHash",receipt.get("designCatalogHash"),
                "endpointCatalogHash",receipt.get("endpointCatalogHash"),
                "surfaceSetHash",surfaces.get("surfaceSetHash"),
                "activationPolicy",CompositeExecutableDesignAuthorityCompiler.ACTIVATION_POLICY)));
        long authorityRevision=persistCompositeAuthority(process,step,route,audience,
            compilation,authorityHead,receipt,packageBindingHash,actor);
        Map<String,Object> persistedHead=new LinkedHashMap<>();persistedHead.put("stepCode",step);
        persistedHead.put("routePath",route);persistedHead.put("audience",audience);
        persistedHead.put("authorityRevision",authorityRevision);
        bindCompositeDesignScope(process,compilation,persistedHead,scope,actor);
        receipt.put("mutationKind","COMPOSITE_SOURCE_IMMEDIATE");receipt.put("sourceCommitted",true);
        receipt.put("authorityRevision",authorityRevision);receipt.put("authorityHash",compilation.authorityHash());
        receipt.put("documentSetHash",compilation.documentSetHash());receipt.put("packageBindingHash",packageBindingHash);
        receipt.put("axisCount",18);receipt.put("selectedBlueprintId",compilation.selectedBlueprintId());
        receipt.put("resolvedClosure",compilation.resolvedClosure());
        receipt.put("generatedSurfaceBindings",surfaces.get("bindings"));
        receipt.put("generatedSurfaceSetHash",surfaces.get("surfaceSetHash"));
        return receipt;
    }

    Map<String,Object> loadCompositeDesignSource(String process,String step,String route,
            CompositeExecutableDesignAuthorityCompiler.Selection selection){
        lockActiveRelayAccounts(selection.responsibleActors());
        List<Map<String,Object>> rows=jdbc.queryForList(
            ActorProcessGovernanceService.COMPOSITE_DESIGN_SOURCE_SQL,
            selection.actor(),selection.blueprintId(),selection.contractId(),process,step,
            selection.audience(),route);
        if(rows.size()!=1)throw new IllegalStateException(
            "COMPOSITE_DESIGN_CANONICAL_SOURCE_NOT_EXACT: contract="+selection.contractId()
                +", blueprint="+selection.blueprintId());
        Map<String,Object> source=new LinkedHashMap<>(rows.get(0));
        Map<String,Object> coverage=jdbc.queryForMap("""
            with requested as (
              select value permission_code from jsonb_array_elements_text(?::jsonb) value
            ), coverage as (
              select requested.permission_code,count(grant_row.*) grant_rows,
                     count(*) filter(where grant_row.effect='ALLOW') allow_rows,
                     count(*) filter(where grant_row.effect='DENY') deny_rows
                from requested left join framework_permission_grant_v1 grant_row
                  on grant_row.actor_code=? and grant_row.permission_code=requested.permission_code
                 and grant_row.use_at='Y'
               group by requested.permission_code
            )
            select count(*)::integer as "requirementCount",
                   count(*) filter(where grant_rows>0)::integer as "matchedCount",
                   count(*) filter(where grant_rows=1 and allow_rows=1)::integer as "allowCount",
                   coalesce(sum(deny_rows),0)::integer as "denyCount",
                   count(*) filter(where grant_rows<>1 or allow_rows<>1)::integer as "ambiguityCount"
              from coverage
            """,toJson(selection.permissionCodes()),selection.actor());
        source.put("permissionRequirementCount",coverage.get("requirementCount"));
        source.put("permissionMatchedCount",coverage.get("matchedCount"));
        source.put("permissionAllowCount",coverage.get("allowCount"));
        source.put("permissionDenyCount",coverage.get("denyCount"));
        source.put("permissionAmbiguityCount",coverage.get("ambiguityCount"));
        source.put("registeredNotificationTemplates",toJson(jdbc.queryForList("""
            select template_code from integrated_design_notification_template
             where active_yn='Y' order by template_code collate "C"
            """,String.class)));
        Map<String,Object> assets=jdbc.queryForMap("""
            with requested as (
              select upper("assetType") asset_type,"assetCode" asset_code
                from jsonb_to_recordset(?::jsonb) value("assetType" text,"assetCode" text)
            )
            select count(*)::integer as "requiredCount",
                   count(*) filter(where
                     (asset_type='THEME' and exists(select 1 from comtnthemedefinition registry
                       where registry.theme_id=asset_code and registry.use_at='Y' and registry.is_active='Y'))
                     or (asset_type='SECTION' and exists(select 1 from ui_section_registry registry
                       where registry.section_id=asset_code and registry.active_yn='Y'))
                     or (asset_type='COMPONENT' and exists(select 1 from ui_component_registry registry
                       where registry.component_id=asset_code and registry.active_yn='Y')))::integer
                     as "registeredCount",
                   (select count(*) from requested asset
                     join ui_component_registry component on component.component_id=asset.asset_code
                      and component.active_yn='Y' and upper(component.component_type)='JSON_FORM'
                    where asset.asset_type='COMPONENT')::integer as "jsonFormCount"
              from requested
            """,toJson(selection.assetBindings()));
        source.put("requiredAssetCount",assets.get("requiredCount"));
        source.put("registeredAssetCount",assets.get("registeredCount"));
        source.put("jsonFormAssetCount",assets.get("jsonFormCount"));
        return source;
    }

    private void lockActiveRelayAccounts(List<String> actors){
        actors.stream().distinct().sorted().forEach(this::lockActiveRelayAccount);
    }

    private void lockActiveRelayAccount(String actor){
        Set<Long> readyAssignments=new HashSet<>();
        String assignmentPredicate="""
             assignment.actor_code=? and assignment.assignment_status='ACTIVE'
             and (assignment.valid_from is null or assignment.valid_from<=current_date)
             and (assignment.valid_until is null or assignment.valid_until>=current_date)
             and (assignment.project_id='*' or exists(select 1
               from framework_project_actor_assignment relay
              where relay.project_id=assignment.project_id
                and relay.actor_code=assignment.actor_code
                and lower(relay.user_id)=lower(assignment.account_id)
                and relay.active_yn='Y'))
            """;
        jdbc.query("""
            select assignment.assignment_id
              from framework_account_actor_assignment assignment
              join framework_actor_definition actor on actor.actor_code=assignment.actor_code
               and actor.use_at='Y'
              join comtnemplyrinfo account on lower(account.emplyr_id)=lower(assignment.account_id)
               and account.emplyr_sttus_code in('P','A')
              join comtnemplyrscrtyestbs security on security.scrty_dtrmn_trget_id=account.esntl_id
               and nullif(btrim(security.author_code),'') is not null
             where %s
             order by lower(assignment.account_id),assignment.tenant_id,
                      assignment.project_id,assignment.assignment_id
             for share of assignment,account,security
            """.formatted(assignmentPredicate),
            (org.springframework.jdbc.core.RowCallbackHandler)
                resultSet->readyAssignments.add(resultSet.getLong(1)),actor);
        jdbc.query("""
            select assignment.assignment_id
              from framework_account_actor_assignment assignment
              join framework_actor_definition actor on actor.actor_code=assignment.actor_code
               and actor.use_at='Y'
              join comtnentrprsmber account on lower(account.entrprs_mber_id)=lower(assignment.account_id)
               and account.entrprs_mber_sttus in('P','A')
              join comtnemplyrscrtyestbs security on security.scrty_dtrmn_trget_id=account.esntl_id
               and nullif(btrim(security.author_code),'') is not null
             where %s
             order by lower(assignment.account_id),assignment.tenant_id,
                      assignment.project_id,assignment.assignment_id
             for share of assignment,account,security
            """.formatted(assignmentPredicate),
            (org.springframework.jdbc.core.RowCallbackHandler)
                resultSet->readyAssignments.add(resultSet.getLong(1)),actor);
        jdbc.query("""
            select assignment.assignment_id
              from framework_account_actor_assignment assignment
              join framework_project_actor_assignment project_assignment
                on project_assignment.project_id=assignment.project_id
               and project_assignment.actor_code=assignment.actor_code
                and lower(project_assignment.user_id)=lower(assignment.account_id)
                and project_assignment.active_yn='Y'
             where %s and assignment.project_id<>'*'
             order by assignment.project_id,lower(assignment.account_id),assignment.assignment_id
             for share of assignment,project_assignment
            """.formatted(assignmentPredicate),
            resultSet->{},actor);
        if(readyAssignments.isEmpty())throw new IllegalStateException(
            "ACTIVE_RELAY_ACCOUNT_REQUIRED: "+actor);
    }

    void stageCompositeSource(
            CompositeExecutableDesignAuthorityCompiler.Compilation compilation,
            Map<String,Map<String,Object>> documents,Map<String,Object> source,String actor,
            boolean primaryCompatibility){
        Map<String,Object> projection=compilation.projection();
        String process=String.valueOf(compilation.resolvedClosure().get("processCode"));
        String step=String.valueOf(compilation.resolvedClosure().get("stepCode"));
        int stepWrites=primaryCompatibility?jdbc.update("""
            update framework_process_step set actor_code=?,command_code=?,from_state=?,to_state=?,
                   completion_rule=?,input_contract=?::jsonb::text,output_contract=?::jsonb::text,
                   api_contract=?,requires_notification=?,updated_at=current_timestamp
             where process_code=? and step_code=? and (actor_code is distinct from ?
                or command_code is distinct from ? or from_state is distinct from ?
                or to_state is distinct from ? or completion_rule is distinct from ?
                or framework_try_jsonb(input_contract) is distinct from ?::jsonb
                or framework_try_jsonb(output_contract) is distinct from ?::jsonb
                or api_contract is distinct from ?
                or requires_notification is distinct from ?)
            """,projection.get("stepActorCode"),projection.get("stepCommandCode"),
            projection.get("stepFromState"),projection.get("stepToState"),
            projection.get("stepCompletionRule"),toJson(projection.get("stepInputContract")),
            toJson(projection.get("stepOutputContract")),projection.get("stepApiContract"),
            projection.get("requiresNotification"),process,step,
            projection.get("stepActorCode"),projection.get("stepCommandCode"),
            projection.get("stepFromState"),projection.get("stepToState"),
            projection.get("stepCompletionRule"),toJson(projection.get("stepInputContract")),
            toJson(projection.get("stepOutputContract")),projection.get("stepApiContract"),
            projection.get("requiresNotification")):0;
        if(stepWrites>1)throw new IllegalStateException("COMPOSITE_STEP_SOURCE_WRITE_NOT_EXACT");
        int contractActorWrites=jdbc.update("""
            update framework_professional_screen_contract set actor_code=?,updated_by=?,updated_at=current_timestamp
             where contract_id=? and actor_code is distinct from ?
            """,projection.get("stepActorCode"),actor,compilation.contractId(),
            projection.get("stepActorCode"));
        if(contractActorWrites>1)throw new IllegalStateException("COMPOSITE_CONTRACT_ACTOR_WRITE_NOT_EXACT");
        if(Boolean.TRUE.equals(source.get("activeBinding"))){
            if(((Number)source.getOrDefault("bindingCount",0)).intValue()!=1)
                throw new IllegalStateException("COMPOSITE_ACTIVE_SCREEN_BINDING_NOT_EXACT");
            int bindingWrites=jdbc.update("""
                update framework_process_step_screen_binding binding set actor_code=?,updated_at=current_timestamp
                  from framework_screen_resource resource
                 where resource.screen_resource_id=binding.screen_resource_id
                   and binding.process_code=? and binding.step_code=?
                   and upper(binding.audience)=? and binding.binding_status='ACTIVE'
                   and lower(split_part(resource.route_key,'?',1))=?
                   and binding.actor_code is distinct from ?
                """,projection.get("stepActorCode"),process,step,
                compilation.resolvedClosure().get("audience"),
                compilation.resolvedClosure().get("routePath"),projection.get("stepActorCode"));
            if(bindingWrites>1)throw new IllegalStateException(
                "COMPOSITE_ACTIVE_SCREEN_BINDING_WRITE_NOT_EXACT");
        }else if(!Boolean.TRUE.equals(source.get("directIdentity")))throw new IllegalStateException(
            "COMPOSITE_AUXILIARY_SCREEN_BINDING_REQUIRED");
        if(!compilation.selectedAdopt()){
            int blueprintActorWrites=jdbc.update("""
                update framework_screen_blueprint set actor_code=?,updated_at=current_timestamp
                 where blueprint_id=? and validation_status='VALID' and actor_code is distinct from ?
                """,projection.get("stepActorCode"),compilation.selectedBlueprintId(),
                projection.get("stepActorCode"));
            if(blueprintActorWrites>1)throw new IllegalStateException(
                "COMPOSITE_BLUEPRINT_ACTOR_WRITE_NOT_EXACT");
        }
        Map<String,Object> staged=host.saveProfessionalScreenContract(
            compositeProfessionalMutation(compilation,documents,source),actor,
            compilation.selectedAdopt(),true);
        if(!"STAGED".equals(staged.get("status")))throw new IllegalStateException(
            "COMPOSITE_BATCH_SOURCE_STAGE_NOT_EXACT");
    }

    void stageCompositeStepPermissions(String process,List<Map<String,Object>> plans,String actor){
        Map<String,List<Map<String,Object>>> byStep=new TreeMap<>();
        for(Map<String,Object> plan:plans){
            if(!Boolean.TRUE.equals(plan.get("primaryCompatibility")))continue;
            CompositeExecutableDesignAuthorityCompiler.Compilation compilation=
                (CompositeExecutableDesignAuthorityCompiler.Compilation)plan.get("compilation");
            String step=String.valueOf(compilation.resolvedClosure().get("stepCode"));
            @SuppressWarnings("unchecked") List<Map<String,Object>> permissions=(List<Map<String,Object>>)
                byStep.computeIfAbsent(step,ignored->new ArrayList<>());
            Map<String,Object> design=compilation.executableDesign();
            Map<String,Object> authority=requireMap(design.get("AUTHORITY"),"AUTHORITY");
            Map<String,Object> raci=requireMap(design.get("ACTOR_RACI"),"ACTOR_RACI");
            Object raw=authority.get("permissionCodes");
            if(!(raw instanceof List<?> codes))throw new IllegalStateException(
                "COMPOSITE_PERMISSION_CODES_REQUIRED");
            for(Object code:codes)permissions.add(Map.of("permissionCode",String.valueOf(code),
                "actorCode",String.valueOf(raci.get("actorCode"))));
        }
        for(Map.Entry<String,List<Map<String,Object>>> entry:byStep.entrySet()){
            List<Map<String,Object>> targets=entry.getValue().stream().distinct().sorted(
                java.util.Comparator.comparing(row->String.valueOf(row.get("permissionCode")))).toList();
            List<Map<String,Object>> scopes=jdbc.queryForList("""
                with requested as (
                  select "permissionCode" permission_code,"actorCode" actor_code
                    from jsonb_to_recordset(?::jsonb) value("permissionCode" text,"actorCode" text)
                )
                select requested.permission_code as "permissionCode",requested.actor_code as "actorCode",
                       min(grant_row.scope_type) as "scopeType",count(*)::integer as "grantCount"
                  from requested join framework_permission_grant_v1 grant_row
                    on grant_row.actor_code=requested.actor_code
                   and grant_row.permission_code=requested.permission_code
                   and grant_row.effect='ALLOW' and grant_row.use_at='Y'
                 group by requested.permission_code,requested.actor_code
                 order by requested.permission_code collate "C"
                """,toJson(targets));
            if(scopes.size()!=targets.size()||scopes.stream().anyMatch(row->
                    ((Number)row.get("grantCount")).intValue()!=1))throw new IllegalStateException(
                "COMPOSITE_PERMISSION_GRANT_PROJECTION_NOT_EXACT");
            String targetJson=toJson(scopes);
            jdbc.update("""
                update framework_permission_requirement_v1 requirement set use_at='N',updated_at=current_timestamp
                 where process_code=? and step_code=? and use_at='Y' and not exists(
                   select 1 from jsonb_to_recordset(?::jsonb)
                     value("permissionCode" text,"scopeType" text)
                    where value."permissionCode"=requirement.permission_code
                      and value."scopeType"=requirement.scope_type)
                """,process,entry.getKey(),targetJson);
            jdbc.update("""
                insert into framework_permission_requirement_v1(
                  process_code,step_code,permission_code,scope_type,resource_contract,guard_contract,use_at)
                select ?,?,"permissionCode","scopeType",
                       jsonb_build_object('processCode',?,'stepCode',?),
                       jsonb_build_object('actorCode',"actorCode",'source','COMPOSITE_EXECUTABLE_DESIGN'),'Y'
                  from jsonb_to_recordset(?::jsonb)
                    value("permissionCode" text,"actorCode" text,"scopeType" text)
                on conflict(process_code,step_code,permission_code,scope_type) do update set
                  resource_contract=excluded.resource_contract,guard_contract=excluded.guard_contract,
                  use_at='Y',updated_at=current_timestamp
                where framework_permission_requirement_v1.resource_contract is distinct from excluded.resource_contract
                   or framework_permission_requirement_v1.guard_contract is distinct from excluded.guard_contract
                   or framework_permission_requirement_v1.use_at<>'Y'
                """,process,entry.getKey(),process,entry.getKey(),targetJson);
        }
    }

    private Map<String,Object> compositeProfessionalMutation(
            CompositeExecutableDesignAuthorityCompiler.Compilation compilation,
            Map<String,Map<String,Object>> documents,Map<String,Object> source){
        Map<String,Object> mutation=new LinkedHashMap<>(source);
        mutation.put("contractId",compilation.contractId());
        compilation.projection().forEach((key,value)->mutation.put(key,
            value instanceof List<?>||value instanceof Map<?,?>?toJson(value):value));
        // Keep the typed migration contract on the professional source. The compatibility
        // projection contains entities only and would otherwise make the next compile lossy.
        mutation.put("dataContract",toJson(requireMap(
            compilation.executableDesign().get("DATABASE"),"DATABASE")));
        mutation.put("evidenceContract",toJson(compilation.evidence()));
        mutation.put("contractStatus",documents.values().stream().allMatch(row->
            "VERIFIED".equals(String.valueOf(row.get("status"))))?"VERIFIED":"APPROVED");
        mutation.put("compositeAuthorityMarker",toJson(Map.of(
            "authorityHash",compilation.authorityHash(),
            "documentSetHash",compilation.documentSetHash(),
            "executableDesignHash",compilation.executableDesignHash(),
            "executableDesign",compilation.executableDesign(),
            "artifactManifest",compilation.artifactManifest(),
            "activationPolicy",CompositeExecutableDesignAuthorityCompiler.ACTIVATION_POLICY)));
        if(compilation.selectedAdopt()){
            mutation.remove("layout");mutation.remove("theme");
            mutation.remove("assetBindings");mutation.remove("compositeAuthorityMarker");
        }
        return mutation;
    }

    private long persistCompositeAuthority(String process,String step,String route,String audience,
            CompositeExecutableDesignAuthorityCompiler.Compilation compilation,
            Map<String,Object> authorityHead,Map<String,Object> receipt,
            String packageBindingHash,String actor){
        Long revision;
        if(authorityHead.isEmpty())revision=jdbc.queryForObject("""
            insert into integrated_design_authority(
              process_code,step_code,route_path,audience,contract_id,selected_blueprint_id,
              ownership_strategy,document_set_hash,authority_hash,composite_json,
              source_hash,design_set_hash,design_catalog_hash,endpoint_catalog_hash,
              package_binding_hash,job_id,activation_policy,updated_by)
            values(?,?,?,?,?,?,?,?,?,?::jsonb,?,?,?,?,?,?,?,?) returning authority_revision
            """,Long.class,process,step,route,audience,compilation.contractId(),
            compilation.selectedBlueprintId(),compilation.ownershipStrategy(),
            compilation.documentSetHash(),compilation.authorityHash(),toJson(compilation.composite()),
            receipt.get("sourceHash"),receipt.get("designSetHash"),receipt.get("designCatalogHash"),
            receipt.get("endpointCatalogHash"),packageBindingHash,receipt.get("jobId"),
            CompositeExecutableDesignAuthorityCompiler.ACTIVATION_POLICY,actor);
        else revision=jdbc.queryForObject("""
            update integrated_design_authority set contract_id=?,selected_blueprint_id=?,
                   ownership_strategy=?,document_set_hash=?,authority_hash=?,composite_json=?::jsonb,
                   source_hash=?,design_set_hash=?,design_catalog_hash=?,endpoint_catalog_hash=?,
                   package_binding_hash=?,job_id=?,activation_policy=?,updated_by=?,updated_at=current_timestamp
             where authority_id=? and authority_revision=? and authority_hash=? returning authority_revision
            """,Long.class,compilation.contractId(),compilation.selectedBlueprintId(),
            compilation.ownershipStrategy(),compilation.documentSetHash(),compilation.authorityHash(),
            toJson(compilation.composite()),receipt.get("sourceHash"),receipt.get("designSetHash"),
            receipt.get("designCatalogHash"),receipt.get("endpointCatalogHash"),packageBindingHash,
            receipt.get("jobId"),CompositeExecutableDesignAuthorityCompiler.ACTIVATION_POLICY,actor,
            authorityHead.get("authorityId"),authorityHead.get("authorityRevision"),authorityHead.get("authorityHash"));
        if(revision==null)throw new IllegalStateException("COMPOSITE_DESIGN_AUTHORITY_CAS_NOT_EXACT");
        return revision;
    }

    boolean isCompositeAuthorityFinal(String process,Map<String,Object> authorityHead,
            CompositeExecutableDesignAuthorityCompiler.Compilation compilation){
        try{unchangedCompositeAuthorityReceipt(process,authorityHead,compilation);return true;}
        catch(IllegalStateException drift){return false;}
    }

    Map<String,Object> unchangedCompositeAuthorityReceipt(String process,
            Map<String,Object> authorityHead,
            CompositeExecutableDesignAuthorityCompiler.Compilation compilation){
        List<Map<String,Object>> jobs=jdbc.queryForList("""
            select job_id as "jobId",job_status as "jobStatus",quality_status as "qualityStatus",
                   evidence_ref as "evidenceRef",specification_json as "specificationJson",
                   (select count(*) from framework_process_artifact artifact
                     where artifact.process_code=? and artifact.contract_ref='AUTO:FULL_STACK_GENERATION'
                       and artifact.required and artifact.delivery_status='VERIFIED'
                       and nullif(artifact.evidence_ref,'') is not null)::integer as "verifiedArtifactCount"
              from framework_development_job where job_id=? and process_code=?
                and job_type='FULL_STACK_GENERATION' and job_group_code=?||'_CANONICAL_PUBLICATION'
                and 1=(select count(*) from framework_development_job canonical
                       where canonical.process_code=? and canonical.job_type='FULL_STACK_GENERATION'
                         and canonical.job_group_code=?||'_CANONICAL_PUBLICATION')
            """,process,authorityHead.get("jobId"),process,process,process,process);
        if(jobs.size()!=1)throw new IllegalStateException("COMPOSITE_DESIGN_UNCHANGED_JOB_NOT_EXACT");
        Map<String,Object> specification=jsonMap(String.valueOf(jobs.get(0).get("specificationJson")));
        int endpoints=specification.get("endpointExpected") instanceof Number number?number.intValue():0;
        List<String> hashes=List.of("sourceHash","designSetHash","designCatalogHash",
            "endpointCatalogHash","packageBindingHash").stream()
            .map(key->String.valueOf(authorityHead.get(key))).toList();
        if(endpoints<1||hashes.stream().anyMatch(value->!value.matches("[0-9a-f]{64}")))
            throw new IllegalStateException("COMPOSITE_DESIGN_UNCHANGED_HEAD_INVALID");
        if(!String.valueOf(authorityHead.get("sourceHash")).equals(specification.get("sourceHash"))
                ||!String.valueOf(authorityHead.get("designSetHash")).equals(specification.get("designSetHash"))
                ||!String.valueOf(authorityHead.get("designCatalogHash")).equals(specification.get("designCatalogHash"))
                ||!String.valueOf(authorityHead.get("endpointCatalogHash")).equals(specification.get("endpointCatalogHash")))
            throw new IllegalStateException("COMPOSITE_DESIGN_UNCHANGED_PACKAGE_DRIFT");
        Map<String,Object> composite=jsonMap(String.valueOf(authorityHead.get("compositeJson")));
        if(!compilation.authorityHash().equals(composite.get("authorityHash"))
                ||!(composite.get("generatedSurfaceBindings") instanceof List<?> bindings)
                ||bindings.size()!=6)throw new IllegalStateException("COMPOSITE_DESIGN_UNCHANGED_SURFACES_INVALID");
        validateCompositeJobPackage(specification,compilation,composite);
        Map<String,Object> liveReceipt=Map.of("sourceHash",authorityHead.get("sourceHash"));
        Map<String,Object> liveSurfaces=projection.bindGeneratedCompositeSurfaces(process,
            String.valueOf(authorityHead.get("stepCode")),String.valueOf(authorityHead.get("audience")),
            String.valueOf(authorityHead.get("routePath")),compilation,liveReceipt);
        if(!CompositeExecutableDesignAuthorityCompiler.stable(bindings).equals(
                CompositeExecutableDesignAuthorityCompiler.stable(liveSurfaces.get("bindings")))
                ||!String.valueOf(composite.get("generatedSurfaceSetHash")).equals(
                    liveSurfaces.get("surfaceSetHash")))
            throw new IllegalStateException("COMPOSITE_DESIGN_UNCHANGED_SURFACE_DRIFT");
        String expectedPackage=CompositeExecutableDesignAuthorityCompiler.hash(
            CompositeExecutableDesignAuthorityCompiler.stable(Map.of(
                "authorityHash",compilation.authorityHash(),"sourceHash",authorityHead.get("sourceHash"),
                "designSetHash",authorityHead.get("designSetHash"),
                "designCatalogHash",authorityHead.get("designCatalogHash"),
                "endpointCatalogHash",authorityHead.get("endpointCatalogHash"),
                "surfaceSetHash",liveSurfaces.get("surfaceSetHash"),
                "activationPolicy",CompositeExecutableDesignAuthorityCompiler.ACTIVATION_POLICY)));
        if(!expectedPackage.equals(authorityHead.get("packageBindingHash")))
            throw new IllegalStateException("COMPOSITE_DESIGN_UNCHANGED_PACKAGE_BINDING_DRIFT");
        String status=String.valueOf(jobs.get(0).get("jobStatus"));
        if(Set.of("FAILED","BLOCKED","CANCELLED").contains(status))throw new IllegalStateException(
            "COMPOSITE_DESIGN_PHYSICAL_GENERATION_REQUEUE_REQUIRED: "+status);
        if(!Set.of("PLANNED","RETRY","RUNNING","VERIFIED","COMPLETED").contains(status))
            throw new IllegalStateException("COMPOSITE_DESIGN_PHYSICAL_STATUS_INVALID: "+status);
        boolean verified=Set.of("VERIFIED","COMPLETED").contains(status)
            &&new CompositePhysicalEvidenceService(jdbc).isExact(
                ((Number)jobs.get(0).get("jobId")).longValue(),process);
        if(Set.of("VERIFIED","COMPLETED").contains(status)&&!verified)throw new IllegalStateException(
            "COMPOSITE_DESIGN_PHYSICAL_VERIFICATION_INCOMPLETE");
        Map<String,Object> receipt=new LinkedHashMap<>();
        receipt.put("success",true);receipt.put("status","UNCHANGED");
        receipt.put("generationQueued",Set.of("PLANNED","RETRY","RUNNING").contains(status));
        receipt.put("generationStatus",verified?"PHYSICAL_GENERATED_VERIFIED":"PHYSICAL_QUEUED");
        receipt.put("physicalVerified",verified);receipt.put("jobStatus",status);
        receipt.put("jobCount",1);receipt.put("jobId",jobs.get(0).get("jobId"));receipt.put("processCode",process);
        receipt.put("sourceHash",authorityHead.get("sourceHash"));receipt.put("designHash",authorityHead.get("designSetHash"));
        receipt.put("designSetHash",authorityHead.get("designSetHash"));receipt.put("designCatalogHash",authorityHead.get("designCatalogHash"));
        receipt.put("endpointCatalogHash",authorityHead.get("endpointCatalogHash"));receipt.put("endpointExpected",endpoints);
        receipt.put("activationPolicy",CompositeExecutableDesignAuthorityCompiler.ACTIVATION_POLICY);
        receipt.put("mutationKind","COMPOSITE_SOURCE_IMMEDIATE");receipt.put("sourceCommitted",true);
        receipt.put("authorityRevision",authorityHead.get("authorityRevision"));receipt.put("authorityHash",compilation.authorityHash());
        receipt.put("documentSetHash",compilation.documentSetHash());receipt.put("packageBindingHash",authorityHead.get("packageBindingHash"));
        receipt.put("axisCount",18);receipt.put("selectedBlueprintId",compilation.selectedBlueprintId());receipt.put("writeCount",0);
        receipt.put("resolvedClosure",composite.get("resolvedClosure"));receipt.put("generatedSurfaceBindings",composite.get("generatedSurfaceBindings"));
        receipt.put("generatedSurfaceSetHash",composite.get("generatedSurfaceSetHash"));return receipt;
    }

    private static void validateCompositeJobPackage(Map<String,Object> specification,
            CompositeExecutableDesignAuthorityCompiler.Compilation compilation,
            Map<String,Object> composite){
        if(!(specification.get("compositeAuthorities") instanceof List<?> raw)||raw.isEmpty()
                ||!compilation.executableDesignHash().equals(composite.get("executableDesignHash")))
            throw new IllegalStateException("COMPOSITE_JOB_EXECUTABLE_PACKAGE_MISSING");
        List<Map<String,Object>> bindings=new ArrayList<>();
        for(Object value:raw)bindings.add(requireMap(value,"job.compositeAuthorities[]"));
        String setHash=CompositeExecutableDesignAuthorityCompiler.hash(
            CompositeExecutableDesignAuthorityCompiler.stable(bindings));
        if(!setHash.equals(specification.get("compositeAuthoritySetHash")))throw new IllegalStateException(
            "COMPOSITE_JOB_EXECUTABLE_PACKAGE_HASH_DRIFT");
        Map<String,Object> closure=compilation.resolvedClosure();
        List<Map<String,Object>> selected=bindings.stream().filter(binding->
            closure.get("stepCode").equals(binding.get("stepCode"))
                &&closure.get("routePath").equals(binding.get("routePath"))
                &&closure.get("audience").equals(binding.get("audience"))).toList();
        if(selected.size()!=1)throw new IllegalStateException("COMPOSITE_JOB_AUTHORITY_BINDING_NOT_EXACT");
        Map<String,Object> binding=selected.get(0);
        if(!compilation.authorityHash().equals(binding.get("authorityHash"))
                ||!compilation.documentSetHash().equals(binding.get("documentSetHash"))
                ||!compilation.executableDesignHash().equals(binding.get("executableDesignHash"))
                ||!compilation.sharedStepHash().equals(binding.get("sharedStepHash"))
                ||!CompositeExecutableDesignAuthorityCompiler.stable(compilation.executableDesign()).equals(
                    CompositeExecutableDesignAuthorityCompiler.stable(binding.get("executableDesign")))
                ||!CompositeExecutableDesignAuthorityCompiler.stable(compilation.artifactManifest()).equals(
                    CompositeExecutableDesignAuthorityCompiler.stable(binding.get("artifactManifest")))
                ||!CompositeExecutableDesignAuthorityCompiler.stable(
                    composite.get("generatedSurfaceBindings")).equals(
                    CompositeExecutableDesignAuthorityCompiler.stable(
                        binding.get("generatedSurfaceBindings"))))
            throw new IllegalStateException("COMPOSITE_JOB_EXECUTABLE_PACKAGE_DRIFT");
    }



    private static String req(Map<String,Object> body,String key){
        String value=str(body,key);if(value.isBlank())throw new IllegalArgumentException(key+" is required");
        return value;
    }
    private static String str(Map<String,Object> body,String key){
        Object value=body.get(key);return value==null?"":String.valueOf(value).trim();
    }
    private static String def(Map<String,Object> body,String key,String fallback){
        String value=str(body,key);return value.isBlank()?fallback:value;
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
    private static Map<String,Object> requireMap(Object value,String field){
        if(!(value instanceof Map<?,?> map))throw new IllegalStateException(field+" must be an object");
        return new LinkedHashMap<>((Map<String,Object>)map);
    }
    private static List<?> requireList(Object value,String field){
        if(!(value instanceof List<?> list))throw new IllegalStateException(field+" must be an array");
        return list;
    }
}
