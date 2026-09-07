package egovframework.com.platform.governance.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/** Runtime interpreter for the currently bound SOURCE_IMMEDIATE composite authority. */
final class CompositeRuntimePolicyService {
    private static final ObjectMapper JSON=new ObjectMapper();
    private final JdbcTemplate jdbc;

    CompositeRuntimePolicyService(JdbcTemplate jdbc){this.jdbc=jdbc;}

    String resolveActor(String project,String process,String step,String route,String audience){
        if(route==null||route.isBlank())return "";
        if(audience==null||audience.isBlank())throw new IllegalArgumentException(
            "COMPOSITE_RUNTIME_ROUTE_AND_AUDIENCE_REQUIRED_TOGETHER");
        String cleanRoute=ScreenDevelopmentNoteService.cleanRoute(route);
        List<Map<String,Object>> rows=loadScopedAuthorities(project,process,step,cleanRoute,audience);
        if(rows.size()!=1)throw new SecurityException("COMPOSITE_RUNTIME_SCOPE_OR_IDENTITY_NOT_AUTHORIZED");
        Map<String,Object> composite=jsonMap(String.valueOf(rows.get(0).get("compositeJson")));
        Map<String,Object> design=requireMap(composite.get("executableDesign"),"executableDesign");
        return String.valueOf(requireMap(design.get("ACTOR_RACI"),"ACTOR_RACI").get("actorCode"));
    }

    Map<String,Object> enforcePredicates(String project,String process,String step,String command,
            String currentState,String route,String audience,String requestJson){
        if(route.isBlank()!=audience.isBlank())throw new IllegalArgumentException(
            "COMPOSITE_RUNTIME_ROUTE_AND_AUDIENCE_REQUIRED_TOGETHER");
        List<Map<String,Object>> authorities=loadScopedAuthorities(project,process,step,route,audience);
        if(authorities==null||authorities.isEmpty()){
            Integer defined=jdbc.queryForObject(
                "select count(*) from integrated_design_authority where process_code=? and step_code=?",
                Integer.class,process,step);
            if(defined!=null&&defined>0)throw new SecurityException(
                "COMPOSITE_RUNTIME_SCOPE_OR_IDENTITY_NOT_AUTHORIZED");
            return Map.of();
        }
        if(authorities.size()!=1)throw new IllegalStateException(
            "COMPOSITE_RUNTIME_AUTHORITY_NOT_EXACT: route/audience required for multiple screens");
        return interpretAuthority(authorities.get(0),command,currentState,requestJson);
    }

    private Map<String,Object> interpretAuthority(Map<String,Object> row,String command,
            String currentState,String requestJson){
        Map<String,Object> selected=new LinkedHashMap<>(row);
        Map<String,Object> composite=jsonMap(String.valueOf(selected.get("compositeJson")));
        Map<String,Object> design=requireMap(composite.get("executableDesign"),"executableDesign");
        Map<String,Object> raci=requireMap(design.get("ACTOR_RACI"),"ACTOR_RACI");
        Map<String,Object> processAxis=requireMap(design.get("PROCESS"),"PROCESS");
        Object rawCommands=processAxis.get("commands");
        if(!(rawCommands instanceof List<?> commands)||commands.stream().filter(value->
                value instanceof Map<?,?> commandRow&&command.equals(commandRow.get("commandCode"))).count()!=1)
            throw new IllegalArgumentException("COMPOSITE_RUNTIME_COMMAND_NOT_EXACT");
        Map<String,Object> stateAxis=requireMap(design.get("STATE"),"STATE");
        Object rawStates=stateAxis.get("states");
        if(!(rawStates instanceof List<?> states))throw new IllegalStateException(
            "COMPOSITE_RUNTIME_STATE_CONTRACT_MISSING");
        List<Map<String,Object>> transitions=states.stream().filter(value->value instanceof Map<?,?> state
                &&command.equals(state.get("commandCode"))&&currentState.equals(state.get("fromState")))
            .map(value->requireMap(value,"STATE.states[]")).toList();
        if(transitions.size()!=1)throw new IllegalStateException(
            "COMPOSITE_RUNTIME_STATE_TRANSITION_NOT_EXACT");
        Map<String,Object> request=jsonMap(requestJson);request.put("CURRENT_STATE",currentState);
        enforcePredicateAxis(design,"BUSINESS_RULE",command,request);
        enforcePredicateAxis(design,"VALIDATION",command,request);
        selected.put("executableDesign",design);selected.put("actorCode",raci.get("actorCode"));
        selected.put("fromState",transitions.get(0).get("fromState"));
        selected.put("toState",transitions.get(0).get("toState"));return selected;
    }

    private static void enforcePredicateAxis(Map<String,Object> design,String axis,String command,
            Map<String,Object> request){
        Map<String,Object> payload=requireMap(design.get(axis),axis);Object raw=payload.get("rules");
        if(!(raw instanceof List<?> rules))throw new IllegalStateException(
            "COMPOSITE_RUNTIME_RULES_MISSING: "+axis);
        for(Object value:rules){
            Map<String,Object> rule=requireMap(value,axis+".rules[]");
            if(!command.equals(rule.get("commandCode")))continue;
            Object actual=request.get(String.valueOf(rule.get("fieldCode")));
            String operator=String.valueOf(rule.get("operator"));
            String expected=String.valueOf(rule.get("expectedValue"));
            boolean passed=switch(operator){
                case "REQUIRED" -> actual!=null&&!String.valueOf(actual).isBlank();
                case "EQ" -> actual!=null&&expected.equals(String.valueOf(actual));
                case "NE" -> actual!=null&&!expected.equals(String.valueOf(actual));
                case "GT","GTE","LT","LTE" -> compareNumbers(actual,expected,operator);
                default -> false;
            };
            if(!passed)throw new IllegalArgumentException(String.valueOf(rule.get("errorCode")));
        }
    }

    private static boolean compareNumbers(Object actual,String expected,String operator){
        if(actual==null)return false;
        try{
            int compared=new BigDecimal(String.valueOf(actual)).compareTo(new BigDecimal(expected));
            return switch(operator){case "GT"->compared>0;case "GTE"->compared>=0;
                case "LT"->compared<0;case "LTE"->compared<=0;default->false;};
        }catch(NumberFormatException invalid){return false;}
    }

    void queueNotifications(Map<String,Object> authority,UUID executionId,Long eventId,
            String tenant,String project,String process,String step,String command){
        if(authority==null||authority.isEmpty())return;
        Map<String,Object> design=requireMap(authority.get("executableDesign"),"executableDesign");
        Map<String,Object> notification=requireMap(design.get("NOTIFICATION"),"NOTIFICATION");
        Object raw=notification.get("events");
        if(!(raw instanceof List<?> events))throw new IllegalStateException(
            "COMPOSITE_RUNTIME_NOTIFICATION_EVENTS_MISSING");
        for(Object value:events){
            Map<String,Object> event=requireMap(value,"NOTIFICATION.events[]");
            if(!command.equals(event.get("commandCode")))continue;
            Map<String,Object> payload=new LinkedHashMap<>();
            payload.put("authorityHash",authority.get("authorityHash"));
            payload.put("authorityRevision",authority.get("authorityRevision"));
            payload.put("executionId",executionId.toString());payload.put("eventId",eventId);
            payload.put("tenantId",tenant);payload.put("projectId",project);
            payload.put("processCode",process);payload.put("stepCode",step);
            payload.put("commandCode",command);payload.put("event",event);
            String payloadHash=CompositeExecutableDesignAuthorityCompiler.hash(
                CompositeExecutableDesignAuthorityCompiler.stable(payload));
            jdbc.update("""
                insert into integrated_design_notification_outbox(
                  authority_id,authority_revision,authority_hash,execution_id,event_id,
                  tenant_id,project_id,process_code,step_code,command_code,event_code,
                  channel,recipient_actor_code,template_code,payload_hash)
                values(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) on conflict do nothing
                """,authority.get("authorityId"),authority.get("authorityRevision"),
                authority.get("authorityHash"),executionId,eventId,tenant,project,process,step,
                command,event.get("eventCode"),event.get("channel"),
                event.get("recipientActorCode"),event.get("templateCode"),payloadHash);
        }
    }

    void requirePermissions(String process,String step,String actor,String routePath,String audience,
            String project){
        String route=routePath==null?"":routePath.trim();
        String targetAudience=audience==null?"":audience.trim().toUpperCase(Locale.ROOT);
        if(route.isBlank()!=targetAudience.isBlank())throw new SecurityException(
            "COMPOSITE_PERMISSION_ROUTE_AND_AUDIENCE_REQUIRED_TOGETHER");
        if(!route.isBlank())route=ScreenDevelopmentNoteService.cleanRoute(route);
        if(!route.isBlank()&&authorizeComposite(process,step,actor,route,targetAudience,
                project==null?"":project))return;
        Boolean allowed=jdbc.queryForObject("select framework_authorize_step_permissions(?,?,?,?,?)",
            Boolean.class,process,step,actor,route,targetAudience);
        if(!Boolean.TRUE.equals(allowed))throw new SecurityException(
            "STEP_PERMISSION_DENIED: "+process+" / "+step+" / "+actor+" / "+
                (routePath==null?"":routePath)+" / "+(audience==null?"":audience));
    }

    private boolean authorizeComposite(String process,String step,String actor,String route,
            String audience,String project){
        List<Map<String,Object>> heads=loadScopedAuthorities(project,process,step,route,audience);
        if(heads.size()>1)throw new IllegalStateException("COMPOSITE_PERMISSION_AUTHORITY_NOT_EXACT");
        if(heads.size()==1){assertCompositePermissionSet(heads.get(0),actor);return true;}
        Integer defined=jdbc.queryForObject(
            "select count(*) from integrated_design_authority where process_code=? and step_code=?",
            Integer.class,process,step);
        if(defined!=null&&defined>0)throw new SecurityException(
            "COMPOSITE_ROUTE_PERMISSION_AUTHORITY_MISSING");
        return false;
    }

    private List<Map<String,Object>> loadScopedAuthorities(String project,String process,String step,
            String route,String audience){
        String targetProject=project==null?"":project.trim().toUpperCase(Locale.ROOT);
        List<Map<String,Object>> rows=jdbc.queryForList("""
            select authority.authority_id as "authorityId",
                   authority.authority_revision as "authorityRevision",
                   authority.process_code as "processCode",authority.step_code as "stepCode",
                   authority.route_path as "routePath",authority.audience,
                   authority.document_set_hash as "documentSetHash",
                   authority.authority_hash as "authorityHash",
                   authority.composite_json::text as "compositeJson",
                   coalesce((select jsonb_agg(jsonb_build_object(
                     'authorityId',binding.authority_id,
                     'authorityRevision',binding.authority_revision,
                     'scopeType',binding.scope_type,'projectId',binding.project_id,
                     'designVersion',binding.design_version,
                     'contractSha256',binding.contract_sha256,
                     'processCode',binding.process_code,'stepCode',binding.step_code,
                     'routePath',binding.route_path,'audience',binding.audience,
                     'documentSetHash',binding.document_set_hash,
                     'authorityHash',binding.authority_hash,
                     'provenanceHash',binding.provenance_hash)
                     order by binding.binding_id)
                    from integrated_design_scope_binding binding
                   where binding.authority_id=authority.authority_id
                     and binding.authority_revision=authority.authority_revision),'[]'::jsonb)::text
                     as "scopeBindings"
              from integrated_design_authority authority
             where authority.process_code=? and authority.step_code=?
               and (?='' or authority.route_path=?)
               and (?='' or authority.audience=upper(?))
             order by authority.route_path collate "C",authority.audience collate "C"
             for share of authority
            """,process,step,route,route,audience,audience);
        for(Map<String,Object> row:rows){int expected=assertScopeBindings(row,targetProject);
            Integer locked=jdbc.queryForObject("""
                select count(*) from (select binding_id from integrated_design_scope_binding
                 where authority_id=? and authority_revision=? order by binding_id for share) locked
                """,Integer.class,row.get("authorityId"),row.get("authorityRevision"));
            if(locked==null||locked!=expected)throw new SecurityException(
                "COMPOSITE_RUNTIME_SCOPE_BINDING_CHANGED");}
        return rows;
    }

    private static int assertScopeBindings(Map<String,Object> authority,String project){
        Object raw=jsonValue(String.valueOf(authority.get("scopeBindings")));
        if(!(raw instanceof List<?> bindings)||bindings.isEmpty())throw new SecurityException(
            "COMPOSITE_RUNTIME_SCOPE_BINDING_MISSING");
        String expectedType="";String expectedProject="";
        for(Object value:bindings){
            Map<String,Object> binding=requireMap(value,"scopeBindings[]");
            String type=String.valueOf(binding.get("scopeType"));
            String bindingProject=binding.get("projectId")==null?"":String.valueOf(binding.get("projectId"));
            if(expectedType.isEmpty()){expectedType=type;expectedProject=bindingProject;}
            if(!expectedType.equals(type)||!expectedProject.equals(bindingProject)
                    ||number(authority,"authorityId").longValue()!=number(binding,"authorityId").longValue()
                    ||number(authority,"authorityRevision").longValue()!=
                        number(binding,"authorityRevision").longValue()
                    ||!authority.get("processCode").equals(binding.get("processCode"))
                    ||!authority.get("stepCode").equals(binding.get("stepCode"))
                    ||!authority.get("routePath").equals(binding.get("routePath"))
                    ||!authority.get("audience").equals(binding.get("audience"))
                    ||!authority.get("documentSetHash").equals(binding.get("documentSetHash"))
                    ||!authority.get("authorityHash").equals(binding.get("authorityHash")))
                throw new SecurityException("COMPOSITE_RUNTIME_SCOPE_BINDING_NOT_EXACT");
            Map<String,Object> material=new LinkedHashMap<>();material.put("scopeType",type);
            if("GLOBAL".equals(type)){
                if(!bindingProject.isBlank()||binding.get("designVersion")!=null
                        ||binding.get("contractSha256")!=null)
                    throw new SecurityException("COMPOSITE_RUNTIME_GLOBAL_SCOPE_FORGED");
            }else if("PROJECT".equals(type)){
                if(project.isBlank()||!project.equals(bindingProject)
                        ||binding.get("designVersion")==null||binding.get("contractSha256")==null)
                    throw new SecurityException("COMPOSITE_RUNTIME_PROJECT_SCOPE_DENIED");
                material.put("projectId",bindingProject);
                material.put("designVersion",number(binding,"designVersion").intValue());
                material.put("contractSha256",binding.get("contractSha256"));
            }else throw new SecurityException("COMPOSITE_RUNTIME_SCOPE_TYPE_INVALID");
            material.put("processCode",binding.get("processCode"));
            material.put("stepCode",binding.get("stepCode"));
            material.put("routePath",binding.get("routePath"));material.put("audience",binding.get("audience"));
            material.put("authorityId",number(binding,"authorityId").longValue());
            material.put("authorityRevision",number(binding,"authorityRevision").longValue());
            material.put("documentSetHash",binding.get("documentSetHash"));
            material.put("authorityHash",binding.get("authorityHash"));
            String provenance=CompositeExecutableDesignAuthorityCompiler.hash(
                CompositeExecutableDesignAuthorityCompiler.stable(material));
            if(!provenance.equals(binding.get("provenanceHash")))throw new SecurityException(
                "COMPOSITE_RUNTIME_SCOPE_PROVENANCE_INVALID");
        }
        return bindings.size();
    }

    private static Number number(Map<String,Object> row,String key){
        Object value=row.get(key);if(value instanceof Number number)return number;
        throw new SecurityException("COMPOSITE_RUNTIME_SCOPE_NUMBER_INVALID: "+key);
    }

    private void assertCompositePermissionSet(Map<String,Object> head,String actor){
        Map<String,Object> composite=jsonMap(String.valueOf(head.get("compositeJson")));
        Map<String,Object> design=requireMap(composite.get("executableDesign"),"executableDesign");
        Map<String,Object> raci=requireMap(design.get("ACTOR_RACI"),"ACTOR_RACI");
        if(!actor.equals(raci.get("actorCode")))throw new SecurityException(
            "COMPOSITE_ROUTE_ACTOR_DENIED");
        Map<String,Object> authority=requireMap(design.get("AUTHORITY"),"AUTHORITY");
        List<?> raw=requireList(authority.get("permissionCodes"),"AUTHORITY.permissionCodes");
        List<String> permissions=raw.stream().map(String::valueOf).distinct().sorted().toList();
        if(permissions.size()!=raw.size()||permissions.isEmpty())throw new SecurityException(
            "COMPOSITE_ROUTE_PERMISSION_SET_INVALID");
        Map<String,Object> exact=jdbc.queryForMap("""
            with requested as (select value permission_code from jsonb_array_elements_text(?::jsonb) value),
            grants as (select requested.permission_code,count(grant_row.*)::integer grant_count,
                     count(*) filter(where grant_row.effect='ALLOW')::integer allow_count,
                     count(*) filter(where grant_row.effect='DENY')::integer deny_count
                from requested left join framework_permission_grant_v1 grant_row
                  on grant_row.actor_code=? and grant_row.permission_code=requested.permission_code
                 and grant_row.use_at='Y' group by requested.permission_code)
            select count(*) filter(where grant_count=1 and allow_count=1 and deny_count=0)::integer
                     as "allowedCount",count(*)::integer as "requiredCount" from grants
            """,toJson(permissions),actor);
        if(!exact.get("allowedCount").equals(exact.get("requiredCount")))throw new SecurityException(
            "COMPOSITE_ROUTE_PERMISSION_DENIED");
    }

    @SuppressWarnings("unchecked")
    private static Map<String,Object> jsonMap(String value){
        try{return JSON.readValue(value,LinkedHashMap.class);}
        catch(Exception invalid){throw new IllegalArgumentException("database returned invalid JSON",invalid);}
    }

    private static Object jsonValue(String value){
        try{return JSON.readValue(value,Object.class);}
        catch(Exception invalid){throw new IllegalArgumentException("database returned invalid JSON",invalid);}
    }

    @SuppressWarnings("unchecked")
    private static Map<String,Object> requireMap(Object value,String field){
        if(!(value instanceof Map<?,?>))throw new IllegalArgumentException(field+" must be an object");
        return (Map<String,Object>)value;
    }

    private static List<?> requireList(Object value,String field){
        if(!(value instanceof List<?> list))throw new IllegalArgumentException(field+" must be an array");
        return list;
    }

    private static String toJson(Object value){
        try{return JSON.writeValueAsString(value==null?Map.of():value);}
        catch(Exception invalid){throw new IllegalArgumentException("configuration must be JSON serializable",invalid);}
    }
}
