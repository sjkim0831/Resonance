package egovframework.com.platform.governance.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.Collection;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.util.TreeSet;

/** Bounded transaction orchestration for the eighteen-axis executable authority. */
final class CompositeExecutableDesignApplicationService {
    private static final ObjectMapper JSON=new ObjectMapper();
    private record SaveRequest(String process,String step,String route,String type,String title,
        String content,String status,long expectedRevision,Map<String,Object> candidateAxis,
        Collection<String> requestedActors){}
    private record SaveLockContext(String audience,List<Map<String,Object>> authorityHeads,
        List<Map<String,Object>> documentHeads,long currentAuthorityRevision,String currentAuthorityHash){}
    private record SaveMutation(long revision,boolean changed,List<String> blockers){}
    private record CompileRequest(String process,boolean previewOnly,String selectedStep,
        String selectedRoute,String selectedAudience,boolean selectedIdentity,Map<String,Object> scope){}
    private record CompileRows(int contracts,List<Map<String,Object>> rows){}
    private final JdbcTemplate jdbc;
    private final ScreenDevelopmentNoteService screenDevelopmentNoteService;
    private final ScreenContractRuntimeService screenContractRuntimeService;
    private final ActorProcessGovernanceService host;
    private final CompositeExecutableDesignAuthorityStore store;
    private final CompositeDatabasePlanService databasePlans;
    private final CompositeExecutableDesignProjectionService projection;
    private final CompositeOperationalReceiptService operationalReceipts;

    CompositeExecutableDesignApplicationService(JdbcTemplate jdbc,
            ScreenDevelopmentNoteService screenDevelopmentNoteService,
            ScreenContractRuntimeService screenContractRuntimeService,
            ActorProcessGovernanceService host){
        this.jdbc=jdbc;this.screenDevelopmentNoteService=screenDevelopmentNoteService;
        this.screenContractRuntimeService=screenContractRuntimeService;this.host=host;
        this.databasePlans=new CompositeDatabasePlanService(jdbc);
        this.projection=new CompositeExecutableDesignProjectionService(jdbc);
        this.store=new CompositeExecutableDesignAuthorityStore(jdbc,host,projection);
        this.operationalReceipts=new CompositeOperationalReceiptService(jdbc);
    }

    /**
     * Persists one design axis with document and composite-authority CAS.  A
     * draft axis may be saved independently, but SOURCE is changed only after
     * all eighteen axes are READY and compile into one contradiction-free
     * authority.  The final projection reuses the one canonical process job.
     */
    @Transactional public Map<String,Object> saveIntegratedDesignDocument(
            Map<String,Object> body,String actor){
        return saveIntegratedDesignDocument(body,actor,actor);
    }

    private Map<String,Object> saveIntegratedDesignDocument(
            Map<String,Object> body,String actor,String documentOwner){
        SaveRequest request=parseSaveRequest(body,actor);
        String process=request.process(),step=request.step(),route=request.route(),type=request.type();
        String title=request.title(),content=request.content(),status=request.status();
        long expectedRevision=request.expectedRevision();
        Map<String,Object> candidateAxis=request.candidateAxis();
        host.lockCompositeProcessAuthority(process,request.requestedActors());
        SaveLockContext lock=lockSaveIdentity(request,body);
        String audience=lock.audience();
        List<Map<String,Object>> documentHeads=lock.documentHeads();
        long currentAuthorityRevision=lock.currentAuthorityRevision();
        String currentAuthorityHash=lock.currentAuthorityHash();

        SaveMutation mutation=persistDocumentAndValidateAxes(request,audience,documentOwner,documentHeads);
        long revision=mutation.revision();boolean changed=mutation.changed();
        List<String> blockers=mutation.blockers();
        Map<String,Object> sourceReceipt=Map.of();
        if(blockers.isEmpty()){
            Map<String,Object> compileRequest=new LinkedHashMap<>(body);
            compileRequest.put("processCode",process);compileRequest.put("stepCode",step);
            compileRequest.put("routePath",route);compileRequest.put("audience",audience);
            compileRequest.put("previewOnly",false);
            Map<String,Object> batch=compileIntegratedDesignProcess(compileRequest,actor);
            sourceReceipt=selectedCompositeBatchReceipt(batch,step,route,audience);
            operationalReceipts.trackDirectSave(process,batch,sourceReceipt);
        }
        return integratedDocumentReceipt(request,documentOwner,documentHeads,mutation,
            sourceReceipt,currentAuthorityRevision,currentAuthorityHash);
    }

    private static SaveRequest parseSaveRequest(Map<String,Object> body,String actor){
        if(actor==null||actor.isBlank()||!actor.equals(actor.trim())||actor.length()>100)
            throw new SecurityException("AUTHENTICATED_ACTOR_REQUIRED");
        String process=req(body,"processCode").trim().toUpperCase(Locale.ROOT);
        if(!process.matches("^[A-Z][A-Z0-9_:-]{1,79}$"))throw new IllegalArgumentException(
            "INVALID_PROCESS_CODE");
        String step=str(body,"stepCode").trim().toUpperCase(Locale.ROOT);
        if(!step.isEmpty()&&!step.matches("^[A-Z][A-Z0-9_:-]{1,99}$"))
            throw new IllegalArgumentException("INVALID_STEP_CODE");
        String route=str(body,"routePath");
        if(!route.isEmpty())route=ScreenDevelopmentNoteService.cleanRoute(route);
        String type=req(body,"documentType").trim().toUpperCase(Locale.ROOT);
        if(!CompositeExecutableDesignAuthorityCompiler.DOCUMENT_TYPES.contains(type))
            throw new IllegalArgumentException("UNSUPPORTED_DESIGN_DOCUMENT_TYPE: "+type);
        String title=req(body,"title");
        if(title.length()>300)throw new IllegalArgumentException("DESIGN_DOCUMENT_TITLE_TOO_LONG");
        String content=body.get("content")==null?"":String.valueOf(body.get("content"));
        if(content.length()>1_048_576)throw new IllegalArgumentException(
            "DESIGN_DOCUMENT_CONTENT_TOO_LARGE");
        String status=def(body,"status","DRAFT").toUpperCase(Locale.ROOT);
        if(!Set.of("DRAFT","READY","IN_REVIEW","APPROVED","VERIFIED").contains(status))
            throw new IllegalArgumentException("UNSUPPORTED_DESIGN_DOCUMENT_STATUS: "+status);
        long expectedRevision=nonNegativeLong(body,"revision",0);
        Map<String,Object> candidate=CompositeExecutableDesignAuthorityCompiler.READY_STATUSES.contains(status)
            ?CompositeExecutableDesignAuthorityCompiler.parseAxis(content,type,process,step,route):Map.of();
        Collection<String> requestedActors=Set.of();
        if("ACTOR_RACI".equals(type)&&!candidate.isEmpty()){
            Map<String,Object> payload=requireMap(candidate.get("payload"),"ACTOR_RACI.payload");
            Set<String> actors=new HashSet<>();actors.add(str(payload,"actorCode"));
            actors.add(str(payload,"ownerActorCode"));
            Object raw=payload.get("responsibleActorCodes");
            if(raw instanceof List<?> values)values.forEach(value->actors.add(String.valueOf(value)));
            requestedActors=actors;
        }
        return new SaveRequest(process,step,route,type,title,content,status,expectedRevision,
            candidate,requestedActors);
    }

    private SaveLockContext lockSaveIdentity(SaveRequest request,Map<String,Object> body){
        String audience=str(body,"audience").toUpperCase(Locale.ROOT);
        if(!request.candidateAxis().isEmpty()){
            String axisAudience=str(requireMap(request.candidateAxis().get("identity"),
                request.type()+".identity"),"audience").toUpperCase(Locale.ROOT);
            if(!audience.isBlank()&&!audience.equals(axisAudience))throw new IllegalArgumentException(
                "COMPOSITE_DESIGN_REQUEST_AUDIENCE_MISMATCH");
            audience=axisAudience;
        }
        if(audience.isBlank()){
            List<String> values=jdbc.queryForList("""
                select distinct upper(audience) from framework_professional_screen_contract
                 where process_code=? and step_code=? and lower(split_part(route_path,'?',1))=lower(?)
                """,String.class,request.process(),request.step(),request.route());
            if(values.size()!=1)throw new IllegalArgumentException("COMPOSITE_DESIGN_AUDIENCE_REQUIRED");
            audience=values.get(0);
        }
        if(!Set.of("USER","ADMIN").contains(audience))throw new IllegalArgumentException(
            "COMPOSITE_DESIGN_AUDIENCE_INVALID");
        lockSaveRows(request,audience);
        Map<String,Object> authorityHead=store.loadCompositeAuthorityHead(request.process(),
            request.step(),request.route(),audience);
        List<Map<String,Object>> authorityHeads=authorityHead.isEmpty()?List.of():List.of(authorityHead);
        if(authorityHeads.size()>1)throw new IllegalStateException("COMPOSITE_DESIGN_AUTHORITY_HEAD_NOT_EXACT");
        long currentAuthorityRevision=authorityHeads.isEmpty()?0L:
            ((Number)authorityHeads.get(0).get("authorityRevision")).longValue();
        long expectedAuthorityRevision=nonNegativeLong(body,"authorityRevision",0);
        if(expectedAuthorityRevision!=currentAuthorityRevision)throw new IllegalStateException(
            "STALE_COMPOSITE_DESIGN_AUTHORITY_REVISION: expected="+expectedAuthorityRevision+
                ", current="+currentAuthorityRevision);
        String currentHash=authorityHeads.isEmpty()?"":String.valueOf(
            authorityHeads.get(0).get("authorityHash"));
        String baseHash=str(body,"baseAuthorityHash").toLowerCase(Locale.ROOT);
        if((currentAuthorityRevision==0&&!baseHash.isBlank())
                ||currentAuthorityRevision>0&&!currentHash.equals(baseHash))
            throw new IllegalStateException("STALE_COMPOSITE_DESIGN_AUTHORITY_HASH");
        List<Map<String,Object>> documents=jdbc.queryForList("""
            select document_id as "documentId",revision,title,content,status,updated_by as "updatedBy"
              from integrated_design_document where process_code=? and step_code=?
               and route_path=? and audience=? and document_type=? for update
            """,request.process(),request.step(),request.route(),audience,request.type());
        if(documents.size()>1)throw new IllegalStateException("INTEGRATED_DESIGN_DOCUMENT_HEAD_NOT_EXACT");
        long currentRevision=documents.isEmpty()?0L:((Number)documents.get(0).get("revision")).longValue();
        if(currentRevision!=request.expectedRevision())throw new IllegalStateException(
            "STALE_DESIGN_DOCUMENT_REVISION: expected="+request.expectedRevision()+
                ", current="+currentRevision);
        return new SaveLockContext(audience,authorityHeads,documents,currentAuthorityRevision,currentHash);
    }

    private void lockSaveRows(SaveRequest request,String audience){
        String identity=String.join("\u001f",request.process(),request.step(),request.route(),audience);
        jdbc.query("select pg_advisory_xact_lock(hashtextextended(?,0))",row->{},
            "COMPOSITE_EXECUTABLE_DESIGN_AUTHORITY_V1:"+identity);
        jdbc.query("select pg_advisory_xact_lock(hashtextextended(?,0))",row->{},
            "INTEGRATED_DESIGN_DOCUMENT_V1:"+identity+"\u001f"+request.type());
        jdbc.queryForList("""
            select authority_id from integrated_design_authority where process_code=? and step_code=?
             and route_path=? and audience=? for update
            """,request.process(),request.step(),request.route(),audience);
    }

    private SaveMutation persistDocumentAndValidateAxes(SaveRequest request,String audience,
            String owner,List<Map<String,Object>> documentHeads){
        boolean changed=documentHeads.isEmpty()
            ||!request.title().equals(String.valueOf(documentHeads.get(0).get("title")))
            ||!request.content().equals(String.valueOf(documentHeads.get(0).get("content")))
            ||!request.status().equals(String.valueOf(documentHeads.get(0).get("status")));
        long revision=documentHeads.isEmpty()?0L:((Number)documentHeads.get(0).get("revision")).longValue();
        if(documentHeads.isEmpty())revision=requiredRevision(jdbc.queryForObject("""
            insert into integrated_design_document(process_code,step_code,route_path,audience,
              document_type,title,content,status,updated_by) values(?,?,?,?,?,?,?,?,?) returning revision
            """,Long.class,request.process(),request.step(),request.route(),audience,request.type(),
            request.title(),request.content(),request.status(),owner),"INTEGRATED_DESIGN_DOCUMENT_INSERT_NOT_EXACT");
        else if(changed)revision=requiredRevision(jdbc.queryForObject("""
            update integrated_design_document set title=?,content=?,status=?,active_yn='Y',updated_by=?
             where document_id=? and revision=? returning revision
            """,Long.class,request.title(),request.content(),request.status(),owner,
            documentHeads.get(0).get("documentId"),request.expectedRevision()),
            "INTEGRATED_DESIGN_DOCUMENT_CAS_NOT_EXACT");
        List<Map<String,Object>> rows=jdbc.queryForList("""
            select document_type as "documentType",content,status from integrated_design_document
             where process_code=? and step_code=? and route_path=? and audience=? and active_yn='Y'
             order by document_type
            """,request.process(),request.step(),request.route(),audience);
        Map<String,Map<String,Object>> heads=new LinkedHashMap<>();
        for(Map<String,Object> row:rows)if(heads.put(String.valueOf(row.get("documentType")),row)!=null)
            throw new IllegalStateException("COMPOSITE_DESIGN_AXIS_HEAD_NOT_EXACT: "+row.get("documentType"));
        List<String> blockers=new ArrayList<>();
        for(String type:CompositeExecutableDesignAuthorityCompiler.DOCUMENT_TYPES){
            Map<String,Object> row=heads.get(type);
            if(row==null){blockers.add("MISSING:"+type);continue;}
            if(!CompositeExecutableDesignAuthorityCompiler.READY_STATUSES.contains(
                    String.valueOf(row.get("status")))){blockers.add("NOT_READY:"+type);continue;}
            CompositeExecutableDesignAuthorityCompiler.parseAxis(String.valueOf(row.get("content")),
                type,request.process(),request.step(),request.route());
        }
        return new SaveMutation(revision,changed,blockers);
    }

    private static long requiredRevision(Long revision,String error){
        if(revision==null)throw new IllegalStateException(error);return revision;
    }

    private static Map<String,Object> integratedDocumentReceipt(SaveRequest request,String owner,
            List<Map<String,Object>> prior,SaveMutation mutation,Map<String,Object> source,
            long currentAuthorityRevision,String currentAuthorityHash){
        boolean committed=mutation.blockers().isEmpty();Map<String,Object> result=new LinkedHashMap<>();
        result.put("success",true);result.put("documentType",request.type());
        result.put("revision",mutation.revision());result.put("documentChanged",mutation.changed());
        result.put("updatedBy",mutation.changed()?owner:prior.get(0).get("updatedBy"));
        result.put("mutationKind",committed?"COMPOSITE_SOURCE_IMMEDIATE":"COMPOSITE_PENDING");
        result.put("sourceCommitted",committed);result.put("activationPolicy",committed
            ?CompositeExecutableDesignAuthorityCompiler.ACTIVATION_POLICY:"NONE");
        result.put("generationQueued",committed&&Boolean.TRUE.equals(source.get("generationQueued")));
        result.put("generationStatus",committed
            ?source.getOrDefault("generationStatus","PHYSICAL_QUEUED"):"NOT_APPLICABLE");
        result.put("physicalVerified",committed&&Boolean.TRUE.equals(source.get("physicalVerified")));
        result.put("jobStatus",committed?source.getOrDefault("jobStatus","PLANNED"):"NONE");
        result.put("jobCount",committed?source.get("jobCount"):0);
        result.put("endpointExpected",committed?source.get("endpointExpected"):0);
        result.put("sourceHash",committed?source.get("sourceHash"):"");
        result.put("designHash",committed?source.get("designHash"):"");
        result.put("authorityRevision",committed?source.get("authorityRevision"):currentAuthorityRevision);
        result.put("authorityHash",committed?source.get("authorityHash"):currentAuthorityHash);
        result.put("documentSetHash",committed?source.get("documentSetHash"):"");
        result.put("packageBindingHash",committed?source.get("packageBindingHash"):"");
        result.put("readyAxisCount",18-mutation.blockers().size());
        result.put("requiredAxisCount",CompositeExecutableDesignAuthorityCompiler.DOCUMENT_TYPES.size());
        result.put("blockers",mutation.blockers());result.put("sourceReceipt",source);
        result.put("message",committed
            ?"All 18 design axes compiled into one hash-bound SOURCE authority; the canonical job was queued or reused."
            :"Design axis saved; SOURCE remains unchanged until all 18 executable axes are READY.");return result;
    }

    /** Atomically previews or compiles every screen identity of one process. */
    @Transactional public Map<String,Object> compileIntegratedDesignProcess(
            Map<String,Object> body,String actor){
        CompileRequest request=parseCompileRequest(body);
        String process=request.process(),selectedStep=request.selectedStep();
        String selectedRoute=request.selectedRoute(),selectedAudience=request.selectedAudience();
        boolean previewOnly=request.previewOnly(),selectedIdentity=request.selectedIdentity();
        Map<String,Object> scope=request.scope();
        host.lockCompositeProcessAuthority(process);
        store.validateCompositeDesignScope(process,scope);
        // The 18-axis documents are the source authority. Runtime compilation
        // must never regenerate them from compiler-owned compatibility rows:
        // doing so changes H0 after a claim and makes a bulk campaign revoke
        // itself. The migration function refresh_integrated_design_axis_documents
        // performs the one-time legacy backfill; every later design change
        // enters through the document save authority.
        Map<String,Object> generated=Map.of("updated_count",0L,
            "protected_count",jdbc.queryForObject("""
                select count(*)::bigint from integrated_design_document
                 where process_code=? and active_yn='Y'
                """,Long.class,process),"ambiguous_count",0L);
        if(previewOnly)return Map.of("success",true,"status","IN_REVIEW","processCode",process,
            "sourceCommitted",false,"generation",generated,"activationPolicy","NONE");
        CompileRows compileRows=loadCompileRows(request);
        int contracts=compileRows.contracts();List<Map<String,Object>> rows=compileRows.rows();
        List<Map<String,Object>> plans=buildCompositePlans(process,rows,true);
        if(selectedIdentity)plans.addAll(loadRebindPlans(request));
        validateCompositeScreenCompatibility(plans);
        List<Map<String,Object>> receipts=new ArrayList<>();
        Map<String,Object> unchanged=unchangedBatchReceipt(request,contracts,rows,plans,receipts,actor);
        if(!unchanged.isEmpty())return unchanged;

        int documentWrites=promoteMachineDrafts(rows);
        compileAndStagePlans(process,plans,actor);

        store.stageCompositeStepPermissions(process,plans,actor);

        host.generateProfessionalDesignGraph(process,actor);
        for(Map<String,Object> plan:plans){
            CompositeExecutableDesignAuthorityCompiler.Compilation compilation=
                (CompositeExecutableDesignAuthorityCompiler.Compilation)plan.get("compilation");
            screenContractRuntimeService.publishProfessionalContract(compilation.contractId(),actor);
        }
        Map<String,Object> finalReceipt=host.refreshAndQueueCanonicalProcess(process,actor,
            Map.of("triggerType","COMPOSITE_EXECUTABLE_DESIGN_AUTHORITY_BATCH"),
            ()->projection.projectCompositeExecutionSpecs(process,plans,actor));
        Map<String,Object> exactProjection=castMap(finalReceipt.get("exactProjection"));
        if(exactProjection.get("endpointExpected") instanceof Number endpointCount)
            finalReceipt.put("endpointExpected",endpointCount.intValue());
        if(((Number)finalReceipt.getOrDefault("jobCount",0)).intValue()!=1
                ||((Number)finalReceipt.getOrDefault("endpointExpected",0)).intValue()<1)
            throw new IllegalStateException("COMPOSITE_BATCH_FINAL_PUBLICATION_NOT_GENERATABLE: "
                +finalReceipt+" / "+jdbc.queryForList("""
                  select step_code as "stepCode",design_status as "designStatus",
                         approval_status as "approvalStatus",generation_status as "generationStatus",
                         blocker_codes as "blockerCodes"
                    from framework_step_execution_spec where process_code=? order by step_code
                  """,process));
        for(Map<String,Object> plan:plans){
            @SuppressWarnings("unchecked") List<Map<String,Object>> identityRows=
                (List<Map<String,Object>>)plan.get("rows");
            Map<String,Object> first=identityRows.get(0);
            receipts.add(store.bindAndPersistCompositeAuthority(process,
                String.valueOf(first.get("stepCode")),String.valueOf(first.get("routePath")),
                String.valueOf(first.get("audience")),
                (CompositeExecutableDesignAuthorityCompiler.Compilation)plan.get("compilation"),
                castMap(plan.get("authorityHead")),finalReceipt,actor,scope));
        }
        projection.bindCompositeProcessPackage(process,plans,receipts,finalReceipt,actor);
        Map<String,Object> resultCounts=jdbc.queryForMap("""
            select (select count(*) from integrated_design_document document
                     join framework_composite_design_target_identity target
                       on target.process_code=document.process_code
                      and target.step_code=document.step_code
                      and target.route_path=document.route_path
                      and target.audience=document.audience
                     where document.process_code=? and document.audience<>'' and document.active_yn='Y'
                       and (?='' or document.step_code=?) and (?='' or document.route_path=?)
                       and (?='' or document.audience=?))::integer as "documentCount",
                   (select count(*) from integrated_design_authority authority
                     join framework_composite_design_target_identity target
                       on target.process_code=authority.process_code
                      and target.step_code=authority.step_code
                      and target.route_path=authority.route_path
                      and target.audience=authority.audience
                     where authority.process_code=?
                       and (?='' or authority.step_code=?) and (?='' or authority.route_path=?)
                       and (?='' or authority.audience=?))::integer as "authorityCount",
                   (select count(*) from framework_development_job where process_code=?
                     and job_type='FULL_STACK_GENERATION'
                     and job_group_code=?||'_CANONICAL_PUBLICATION')::integer as "jobCount",
                   (select coalesce(max((framework_try_jsonb(specification_json)->>'endpointExpected')::integer),0)
                       from framework_development_job where process_code=?
                        and job_type='FULL_STACK_GENERATION'
                        and job_group_code=?||'_CANONICAL_PUBLICATION')::integer as "endpointExpected",
                   (select count(*) from integrated_design_authority authority
                      join framework_composite_design_target_identity target
                        on target.process_code=authority.process_code
                       and target.step_code=authority.step_code
                       and target.route_path=authority.route_path
                       and target.audience=authority.audience
                      join framework_development_job job on job.job_id=authority.job_id
                     where authority.process_code=? and job.process_code=?
                       and job.job_type='FULL_STACK_GENERATION'
                       and job.job_group_code=?||'_CANONICAL_PUBLICATION'
                       and (authority.source_hash<>framework_try_jsonb(job.specification_json)->>'sourceHash'
                         or authority.design_set_hash<>framework_try_jsonb(job.specification_json)->>'designSetHash'
                         or authority.design_catalog_hash<>framework_try_jsonb(job.specification_json)->>'designCatalogHash'
                         or authority.endpoint_catalog_hash<>framework_try_jsonb(job.specification_json)->>'endpointCatalogHash'))::integer
                     as "finalHeadMismatchCount"
            """,process,selectedStep,selectedStep,selectedRoute,selectedRoute,selectedAudience,selectedAudience,
                process,selectedStep,selectedStep,selectedRoute,selectedRoute,selectedAudience,selectedAudience,
                process,process,process,process,process,process,process);
        if(((Number)resultCounts.get("documentCount")).intValue()!=contracts*18
                ||((Number)resultCounts.get("authorityCount")).intValue()!=contracts
                ||((Number)resultCounts.get("jobCount")).intValue()!=1
                ||((Number)resultCounts.get("endpointExpected")).intValue()<1
                ||((Number)resultCounts.get("finalHeadMismatchCount")).intValue()!=0)
            throw new IllegalStateException("COMPOSITE_BATCH_PUBLICATION_NOT_EXACT: "+resultCounts);
        Map<String,Object> result=compositeBatchReceipt(process,contracts,documentWrites,1,receipts);
        result.put("reboundAuthorityCount",receipts.size());result.put("scopeBindingWriteCount",receipts.size());
        return result;
    }

    /** Pure/read-only use of the exact production compiler and cross-screen closure. */
    Map<String,Object> inspectCompilerReadiness(String process){
        CompileRequest request=parseCompileRequest(Map.of(
            "processCode",process,"previewOnly",true,"scopeType","GLOBAL"));
        CompileRows compileRows=loadCompileRows(request);
        List<Map<String,Object>> rows=compileRows.rows();
        if(!rows.stream().allMatch(row->CompositeExecutableDesignAuthorityCompiler.READY_STATUSES
                .contains(String.valueOf(row.get("status")))))
            throw new IllegalStateException("COMPOSITE_BATCH_AXIS_STATUS_NOT_READY");
        List<Map<String,Object>> plans=buildCompositePlans(process,rows,false);
        validateCompositeScreenCompatibility(plans);
        return Map.of("success",true,"processCode",process,
            "identityCount",compileRows.contracts(),"documentCount",rows.size(),
            "requiredDocumentCount",compileRows.contracts()*18,"compilerClosure","PASS");
    }

    private CompileRequest parseCompileRequest(Map<String,Object> body){
        String process=req(body,"processCode").toUpperCase(Locale.ROOT);
        if(!process.matches("^[A-Z][A-Z0-9_:-]{1,79}$"))throw new IllegalArgumentException(
            "INVALID_PROCESS_CODE");
        String step=str(body,"stepCode").toUpperCase(Locale.ROOT),route=str(body,"routePath");
        if(!route.isBlank())route=ScreenDevelopmentNoteService.cleanRoute(route);
        String audience=str(body,"audience").toUpperCase(Locale.ROOT);
        boolean selected=!step.isBlank()||!route.isBlank()||!audience.isBlank();
        if(selected&&(step.isBlank()||route.isBlank()||!Set.of("USER","ADMIN").contains(audience)))
            throw new IllegalArgumentException("COMPOSITE_SELECTED_IDENTITY_REQUIRES_STEP_ROUTE_AUDIENCE");
        return new CompileRequest(process,Boolean.TRUE.equals(body.get("previewOnly")),step,route,
            audience,selected,store.compositeDesignScope(body));
    }

    private CompileRows loadCompileRows(CompileRequest request){
        Map<String,Object> coverage=jdbc.queryForMap("""
            select count(*)::integer as "identityCount",
                   count(*) filter(where target.contract_count=1 and target.contract_id is not null)::integer
                     as "exactContractCount",coalesce(sum(target.contract_count),0)::integer as "contractCount"
              from framework_composite_design_target_identity target where target.process_code=?
               and (?='' or target.step_code=?) and (?='' or target.route_path=lower(?))
               and (?='' or target.audience=?)
            """,request.process(),request.selectedStep(),request.selectedStep(),request.selectedRoute(),
            request.selectedRoute(),request.selectedAudience(),request.selectedAudience());
        int contracts=((Number)coverage.get("identityCount")).intValue();
        if(contracts<1||contracts!=((Number)coverage.get("contractCount")).intValue()
                ||contracts!=((Number)coverage.get("exactContractCount")).intValue())
            throw new IllegalStateException("COMPOSITE_BATCH_CONTRACT_IDENTITY_NOT_EXACT");
        List<Map<String,Object>> rows=jdbc.queryForList("""
            select document.process_code as "processCode",document.step_code as "stepCode",
                   document.route_path as "routePath",document.audience,
                   document.document_type as "documentType",document.title,document.content,
                   document.status,document.revision,document.updated_by as "updatedBy"
              from integrated_design_document document join framework_composite_design_target_identity target
                on target.process_code=document.process_code and target.step_code=document.step_code
               and target.route_path=document.route_path and target.audience=document.audience
             where document.process_code=? and document.audience<>'' and document.active_yn='Y'
               and (?='' or document.step_code=?) and (?='' or document.route_path=?)
               and (?='' or document.audience=?) order by document.step_code collate "C",
                 document.route_path collate "C",document.audience collate "C",document.document_type collate "C"
            """,request.process(),request.selectedStep(),request.selectedStep(),request.selectedRoute(),
            request.selectedRoute(),request.selectedAudience(),request.selectedAudience());
        if(rows.size()!=contracts*18)throw new IllegalStateException(
            "COMPOSITE_BATCH_DOCUMENT_COVERAGE_NOT_EXACT: expected="+(contracts*18)+", actual="+rows.size());
        return new CompileRows(contracts,rows);
    }

    private List<Map<String,Object>> buildCompositePlans(String process,List<Map<String,Object>> rows,
            boolean stageSource){
        Map<String,List<Map<String,Object>>> identities=groupIdentityRows(rows);
        List<Map<String,Object>> plans=new ArrayList<>();
        for(List<Map<String,Object>> identityRows:identities.values()){
            if(identityRows.size()!=18)throw new IllegalStateException("COMPOSITE_BATCH_AXIS_COUNT_NOT_EXACT");
            Map<String,Map<String,Object>> heads=new LinkedHashMap<>();
            for(Map<String,Object> row:identityRows)heads.put(String.valueOf(row.get("documentType")),row);
            Map<String,Object> first=identityRows.get(0);String step=String.valueOf(first.get("stepCode"));
            String route=String.valueOf(first.get("routePath")),audience=String.valueOf(first.get("audience"));
            CompositeExecutableDesignAuthorityCompiler.Selection selection=
                CompositeExecutableDesignAuthorityCompiler.selection(process,step,route,heads);
            Map<String,Object> source=store.loadCompositeDesignSource(
                process,step,route,selection,stageSource);
            CompositeExecutableDesignAuthorityCompiler.Compilation compilation=
                CompositeExecutableDesignAuthorityCompiler.compile(process,step,route,audience,heads,source);
            databasePlans.validate(compilation);
            Map<String,Object> plan=new LinkedHashMap<>();plan.put("rows",identityRows);
            plan.put("source",source);plan.put("compilation",compilation);plan.put("stageSource",stageSource);
            plan.put("authorityHead",store.loadCompositeAuthorityHead(
                process,step,route,audience,stageSource));plans.add(plan);
        }
        return plans;
    }

    private static Map<String,List<Map<String,Object>>> groupIdentityRows(List<Map<String,Object>> rows){
        Map<String,List<Map<String,Object>>> identities=new LinkedHashMap<>();
        for(Map<String,Object> row:rows){
            String key=String.join("\u001f",String.valueOf(row.get("stepCode")),
                String.valueOf(row.get("routePath")),String.valueOf(row.get("audience")));
            identities.computeIfAbsent(key,ignored->new ArrayList<>()).add(row);
        }
        return identities;
    }

    private List<Map<String,Object>> loadRebindPlans(CompileRequest request){
        List<Map<String,Object>> rows=jdbc.queryForList("""
            select document.process_code as "processCode",document.step_code as "stepCode",
                   document.route_path as "routePath",document.audience,
                   document.document_type as "documentType",document.title,document.content,
                   document.status,document.revision,document.updated_by as "updatedBy"
              from integrated_design_document document join integrated_design_authority authority
                on authority.process_code=document.process_code and authority.step_code=document.step_code
               and authority.route_path=document.route_path and authority.audience=document.audience
              join framework_composite_design_target_identity target on target.process_code=document.process_code
               and target.step_code=document.step_code and target.route_path=document.route_path
               and target.audience=document.audience where document.process_code=? and document.active_yn='Y'
               and not(document.step_code=? and document.route_path=? and document.audience=?)
             order by document.step_code collate "C",document.route_path collate "C",
                      document.audience collate "C",document.document_type collate "C"
            """,request.process(),request.selectedStep(),request.selectedRoute(),request.selectedAudience());
        for(Map<String,Object> row:rows)if(!CompositeExecutableDesignAuthorityCompiler.READY_STATUSES.contains(
                String.valueOf(row.get("status"))))throw new IllegalStateException(
            "COMPOSITE_PROCESS_REBIND_AXIS_NOT_READY: "+row.get("documentType"));
        return buildCompositePlans(request.process(),rows,false);
    }

    private Map<String,Object> unchangedBatchReceipt(CompileRequest request,int contracts,
            List<Map<String,Object>> rows,List<Map<String,Object>> plans,List<Map<String,Object>> receipts,
            String actor){
        boolean allReady=rows.stream().allMatch(row->CompositeExecutableDesignAuthorityCompiler.READY_STATUSES
            .contains(String.valueOf(row.get("status"))));
        boolean exact=plans.stream().allMatch(plan->{Map<String,Object> head=castMap(plan.get("authorityHead"));
            CompositeExecutableDesignAuthorityCompiler.Compilation compilation=
                (CompositeExecutableDesignAuthorityCompiler.Compilation)plan.get("compilation");
            return !head.isEmpty()&&compilation.documentSetHash().equals(String.valueOf(head.get("documentSetHash")))
                &&compilation.authorityHash().equals(String.valueOf(head.get("authorityHash")))
                &&store.isCompositeAuthorityFinal(request.process(),head,compilation);});
        if(!allReady||!exact)return Map.of();int scopeWrites=0;
        for(Map<String,Object> plan:plans){Map<String,Object> head=castMap(plan.get("authorityHead"));
            CompositeExecutableDesignAuthorityCompiler.Compilation compilation=
                (CompositeExecutableDesignAuthorityCompiler.Compilation)plan.get("compilation");
            receipts.add(store.unchangedCompositeAuthorityReceipt(request.process(),head,compilation));
            if(store.bindCompositeDesignScope(request.process(),compilation,head,request.scope(),actor))scopeWrites++;}
        Map<String,Object> unchanged=compositeBatchReceipt(request.process(),contracts,0,0,receipts);
        unchanged.put("scopeBindingWriteCount",scopeWrites);return unchanged;
    }

    private int promoteMachineDrafts(List<Map<String,Object>> rows){
        int writes=0;for(Map<String,Object> row:rows){
            if(CompositeExecutableDesignAuthorityCompiler.READY_STATUSES.contains(
                    String.valueOf(row.get("status"))))continue;
            if(!Set.of("LIVE_CONTRACT_BACKFILL","COMPOSITE_MIGRATION_REQUIRED").contains(
                    String.valueOf(row.get("updatedBy"))))throw new IllegalStateException(
                "COMPOSITE_BATCH_PROTECTED_DRAFT_REQUIRES_OWNER: "+row.get("documentType"));
            Long revision=jdbc.queryForObject("""
                update integrated_design_document set status='READY',updated_by='LIVE_CONTRACT_BACKFILL'
                 where process_code=? and step_code=? and route_path=? and audience=?
                   and document_type=? and revision=? and content=? returning revision
                """,Long.class,row.get("processCode"),row.get("stepCode"),row.get("routePath"),
                row.get("audience"),row.get("documentType"),row.get("revision"),row.get("content"));
            if(revision==null)throw new IllegalStateException("COMPOSITE_BATCH_DOCUMENT_CAS_NOT_EXACT");
            row.put("revision",revision);row.put("status","READY");
            row.put("updatedBy","LIVE_CONTRACT_BACKFILL");writes++;}
        return writes;
    }

    private void compileAndStagePlans(String process,List<Map<String,Object>> plans,String actor){
        for(Map<String,Object> plan:plans){
            @SuppressWarnings("unchecked") List<Map<String,Object>> rows=(List<Map<String,Object>>)plan.get("rows");
            Map<String,Map<String,Object>> heads=new LinkedHashMap<>();
            for(Map<String,Object> row:rows)heads.put(String.valueOf(row.get("documentType")),row);
            Map<String,Object> first=rows.get(0);CompositeExecutableDesignAuthorityCompiler.Compilation compilation=
                CompositeExecutableDesignAuthorityCompiler.compile(process,String.valueOf(first.get("stepCode")),
                    String.valueOf(first.get("routePath")),String.valueOf(first.get("audience")),heads,
                    castMap(plan.get("source")));databasePlans.validate(compilation);
            plan.put("compilation",compilation);
            if(Boolean.TRUE.equals(plan.get("stageSource")))store.stageCompositeSource(compilation,heads,
                castMap(plan.get("source")),actor,Boolean.TRUE.equals(plan.get("primaryCompatibility")));
        }
    }

    private Map<String,Object> compositeBatchReceipt(String process,int contracts,int documentWrites,
            int refreshInvocations,List<Map<String,Object>> receipts){
        Map<String,Object> first=receipts.isEmpty()?Map.of():receipts.get(0);
        boolean physicalVerified=!receipts.isEmpty()&&receipts.stream().allMatch(receipt->
            Boolean.TRUE.equals(receipt.get("physicalVerified")));
        return new LinkedHashMap<>(Map.ofEntries(Map.entry("success",true),Map.entry("status",
                physicalVerified?"PHYSICAL_GENERATED_VERIFIED":"SOURCE_APPLIED_PHYSICAL_QUEUED"),Map.entry("processCode",process),
            Map.entry("screenCount",contracts),Map.entry("documentCount",contracts*18),
            Map.entry("documentWriteCount",documentWrites),Map.entry("authorityCount",contracts),
            Map.entry("reboundAuthorityCount",receipts.size()),
            Map.entry("jobCount",1),Map.entry("endpointExpected",first.getOrDefault("endpointExpected",0)),
            Map.entry("refreshInvocationCount",refreshInvocations),Map.entry("receipts",receipts),
            Map.entry("sourceStatus","APPLIED"),Map.entry("generationStatus",
                physicalVerified?"PHYSICAL_GENERATED_VERIFIED":"PHYSICAL_QUEUED"),
            Map.entry("physicalVerified",physicalVerified),
            Map.entry("activationPolicy",CompositeExecutableDesignAuthorityCompiler.ACTIVATION_POLICY)));
    }

    private static void validateCompositeScreenCompatibility(List<Map<String,Object>> plans){
        Map<String,String> transitions=new TreeMap<>(),operations=new TreeMap<>(),tables=new TreeMap<>();
        Set<String> databaseModes=new TreeSet<>();
        Map<String,Map<String,Object>> primary=new TreeMap<>();
        for(Map<String,Object> plan:plans){
            @SuppressWarnings("unchecked") List<Map<String,Object>> rows=
                (List<Map<String,Object>>)plan.get("rows");
            String step=String.valueOf(rows.get(0).get("stepCode"));
            CompositeExecutableDesignAuthorityCompiler.Compilation compilation=
                (CompositeExecutableDesignAuthorityCompiler.Compilation)plan.get("compilation");
            Map<String,Object> design=compilation.executableDesign();
            Map<String,Object> state=requireMap(design.get("STATE"),"STATE");
            for(Object raw:requireList(state.get("states"),"STATE.states")){
                Map<String,Object> row=requireMap(raw,"STATE.states[]");
                String key=String.join("\u001f",step,String.valueOf(row.get("commandCode")),
                    String.valueOf(row.get("fromState")));
                String previous=transitions.putIfAbsent(key,
                    CompositeExecutableDesignAuthorityCompiler.stable(row));
                if(previous!=null&&!previous.equals(
                        CompositeExecutableDesignAuthorityCompiler.stable(row)))throw new IllegalStateException(
                    "COMPOSITE_CROSS_SCREEN_STATE_CONTRADICTION: "+key);
            }
            Map<String,Object> api=requireMap(design.get("API"),"API");
            for(Object raw:requireList(api.get("operations"),"API.operations")){
                Map<String,Object> row=requireMap(raw,"API.operations[]");
                String key=String.join("\u001f",step,String.valueOf(row.get("method")),
                    String.valueOf(row.get("path")));
                String previous=operations.putIfAbsent(key,
                    CompositeExecutableDesignAuthorityCompiler.stable(row));
                if(previous!=null&&!previous.equals(
                        CompositeExecutableDesignAuthorityCompiler.stable(row)))throw new IllegalStateException(
                    "COMPOSITE_CROSS_SCREEN_API_CONTRADICTION: "+key);
            }
            Map<String,Object> database=requireMap(design.get("DATABASE"),"DATABASE");
            databaseModes.add(String.valueOf(database.get("migrationMode")));
            for(Object raw:requireList(database.get("schemaChanges"),"DATABASE.schemaChanges")){
                Map<String,Object> change=requireMap(raw,"DATABASE.schemaChanges[]");
                String table=String.valueOf(change.get("tableName"));
                String definition=CompositeExecutableDesignAuthorityCompiler.stable(change);
                String previous=tables.putIfAbsent(table,definition);
                if(previous!=null&&!previous.equals(definition))throw new IllegalStateException(
                    "COMPOSITE_CROSS_SCREEN_DATABASE_CONTRADICTION: "+table);
            }
            Map<String,Object> source=castMap(plan.get("source"));
            if(Boolean.TRUE.equals(source.get("directIdentity"))){
                String audience=String.valueOf(rows.get(0).get("audience"));
                String route=String.valueOf(rows.get(0).get("routePath"));
                String rank=("USER".equals(audience)?"0":"1")+"\u001f"+route;
                Map<String,Object> candidate=primary.get(step);
                if(candidate==null||rank.compareTo(String.valueOf(candidate.get("rank")))<0)
                    primary.put(step,Map.of("rank",rank,"plan",plan));
            }
        }
        if(databaseModes.size()!=1)throw new IllegalStateException(
            "COMPOSITE_CROSS_SCREEN_DATABASE_MODE_CONTRADICTION: "+databaseModes);
        primary.values().forEach(value->castMap(value.get("plan")).put("primaryCompatibility",true));
    }

    private static Map<String,Object> selectedCompositeBatchReceipt(Map<String,Object> batch,
            String step,String route,String audience){
        Object raw=batch.get("receipts");
        if(!(raw instanceof List<?> receipts))throw new IllegalStateException(
            "COMPOSITE_SELECTED_BATCH_RECEIPT_MISSING");
        for(Object value:receipts){
            Map<String,Object> receipt=requireMap(value,"compositeBatch.receipt");
            Map<String,Object> closure=requireMap(receipt.get("resolvedClosure"),
                "compositeBatch.receipt.resolvedClosure");
            if(step.equals(closure.get("stepCode"))&&route.equals(closure.get("routePath"))
                    &&audience.equals(closure.get("audience"))){
                Map<String,Object> selected=new LinkedHashMap<>(receipt);
                selected.put("refreshInvocationCount",batch.get("refreshInvocationCount"));
                return selected;
            }
        }
        throw new IllegalStateException("COMPOSITE_SELECTED_BATCH_RECEIPT_NOT_EXACT");
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
    private static long nonNegativeLong(Map<String,Object> source,String field,long fallback){
        Object raw=source.get(field);if(raw==null)return fallback;
        try{long value=raw instanceof Number number?number.longValue():Long.parseLong(String.valueOf(raw));
            if(value<0)throw new NumberFormatException();return value;}
        catch(NumberFormatException error){throw new IllegalArgumentException(
            field+" must be a non-negative integer",error);}
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
    @SuppressWarnings("unchecked")
    private static Map<String,Object> canonicalObject(Object value,String field){
        if(!(value instanceof Map<?,?> map))throw new IllegalStateException(field+" must be an object");
        return new LinkedHashMap<>((Map<String,Object>)map);
    }
}
