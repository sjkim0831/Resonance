package egovframework.com.generated.canonical;

@org.springframework.web.bind.annotation.RestController
@javax.annotation.processing.Generated(value="canonical-design", comments="designHash=9e2d02438d7bdd1fd4a3f982f24122f9afc41bab8d9816da759bdb84a457aab9;endpointHash=efe3d260b52e873bb2297ef75b96f5494b23212834588485381c68c87193e5ca")
public final class Ope9274a5a189f709efbc3e673fea6956b2089ab11Controller {
    private final egovframework.com.platform.governance.service.ActorProcessGovernanceService service;
    private final egovframework.com.feature.auth.service.CurrentUserContextService currentUserContextService;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper;

    public Ope9274a5a189f709efbc3e673fea6956b2089ab11Controller(
            egovframework.com.platform.governance.service.ActorProcessGovernanceService service,
            egovframework.com.feature.auth.service.CurrentUserContextService currentUserContextService,
            com.fasterxml.jackson.databind.ObjectMapper objectMapper) {
        this.service=service;
        this.currentUserContextService=currentUserContextService;
        this.objectMapper=objectMapper;
    }

    @org.springframework.web.bind.annotation.PostMapping(path="/home/api/process-executions/{executionId}/commands/reduction_project_registration/reduction_project_registration_s3/admin", consumes="application/json")
    public org.springframework.http.ResponseEntity<?> execute(
            @org.springframework.web.bind.annotation.PathVariable("executionId") java.util.UUID executionId,
            @org.springframework.web.bind.annotation.RequestBody Ope9274a5a189f709efbc3e673fea6956b2089ab11Request request,
            jakarta.servlet.http.HttpServletRequest servletRequest) {
        var context=currentUserContextService.resolve(servletRequest);
        if(context==null || !context.isAuthenticated() || context.getUserId()==null || context.getUserId().isBlank())
            return org.springframework.http.ResponseEntity.status(401).body(new Ope9274a5a189f709efbc3e673fea6956b2089ab11ErrorResponse("AUTHENTICATION_REQUIRED","Authentication is required.",false));
        if(request==null || request.actorCode()==null || request.actorCode().isBlank() || request.actualReduction()==null || request.baselineEmission()==null || request.baselineYear()==null || request.baselineYear().isBlank() || request.capex()==null || request.decidedAt()==null || request.decidedAt().isBlank() || request.decisionCode()==null || request.decisionCode().isBlank() || request.expectedReduction()==null || request.idempotencyKey()==null || request.idempotencyKey().isBlank() || request.opex()==null || request.ownerActorCode()==null || request.ownerActorCode().isBlank() || request.projectId()==null || request.projectId().isBlank() || request.reductionMethod()==null || request.reductionMethod().isBlank() || request.rejectionReasonCode()==null || request.rejectionReasonCode().isBlank() || request.reviewComment()==null || request.reviewComment().isBlank() || request.targetReduction()==null || request.targetYear()==null || request.targetYear().isBlank() || request.tenantId()==null || request.tenantId().isBlank())
            return org.springframework.http.ResponseEntity.badRequest().body(new Ope9274a5a189f709efbc3e673fea6956b2089ab11ErrorResponse("INVALID_REQUEST","Request failed",false));
        if(!"VERIFIER".equals(request.actorCode()))
            return org.springframework.http.ResponseEntity.status(403).body(new Ope9274a5a189f709efbc3e673fea6956b2089ab11ErrorResponse("ACCESS_DENIED","Access denied",false));
        var payload=new java.util.LinkedHashMap<String,Object>();
        payload.put("actorCode", request.actorCode());
        payload.put("idempotencyKey", request.idempotencyKey());
        payload.put("projectId", request.projectId());
        payload.put("tenantId", request.tenantId());
        payload.put("processCode","REDUCTION_PROJECT_REGISTRATION");
        payload.put("stepCode","REDUCTION_PROJECT_REGISTRATION_S3");
        payload.put("commandCode","REDUCTION_PROJECT_REGISTRATION_REVIEW");
        payload.put("routePath","/admin/generated/reduction-project-registration/reduction-project-registration-s3");
        payload.put("audience","ADMIN");
        payload.put("requireDraft",true);
        var business=new java.util.LinkedHashMap<String,Object>();
        business.put("actualReduction", request.actualReduction());
        business.put("baselineEmission", request.baselineEmission());
        business.put("baselineYear", request.baselineYear());
        business.put("capex", request.capex());
        business.put("decidedAt", request.decidedAt());
        business.put("decisionCode", request.decisionCode());
        business.put("expectedReduction", request.expectedReduction());
        business.put("opex", request.opex());
        business.put("ownerActorCode", request.ownerActorCode());
        business.put("reductionMethod", request.reductionMethod());
        business.put("rejectionReasonCode", request.rejectionReasonCode());
        business.put("reviewComment", request.reviewComment());
        business.put("targetReduction", request.targetReduction());
        business.put("targetYear", request.targetYear());
        try {
            try { payload.put("requestJson",objectMapper.writeValueAsString(business)); }
            catch(Exception invalidJson) {
                return org.springframework.http.ResponseEntity.badRequest().body(new Ope9274a5a189f709efbc3e673fea6956b2089ab11ErrorResponse("INVALID_REQUEST","Request serialization failed",false));
            }
            var result=service.executeProcessCommand(executionId,payload,context.getUserId());
            if(!Boolean.TRUE.equals(result.get("success"))
                    || !(result.get("idempotent") instanceof Boolean)
                    || !(result.get("eventId") instanceof Number)
                    || !(result.get("toState") instanceof String)
                    || ((String)result.get("toState")).isBlank()
)
                return org.springframework.http.ResponseEntity.status(500).body(new Ope9274a5a189f709efbc3e673fea6956b2089ab11ErrorResponse("INTERNAL_ERROR","Response contract mismatch",false));
            var responsePayload=new java.util.LinkedHashMap<String,Object>();
            responsePayload.put("success",result.get("success"));
            responsePayload.put("idempotent",result.get("idempotent"));
            responsePayload.put("eventId",((Number)result.get("eventId")).longValue());
            responsePayload.put("toState",result.get("toState"));
            responsePayload.put("actualReduction",request.actualReduction());
            responsePayload.put("baselineEmission",request.baselineEmission());
            responsePayload.put("baselineYear",request.baselineYear());
            responsePayload.put("capex",request.capex());
            responsePayload.put("decidedAt",request.decidedAt());
            responsePayload.put("decisionCode",request.decisionCode());
            responsePayload.put("expectedReduction",request.expectedReduction());
            responsePayload.put("opex",request.opex());
            responsePayload.put("ownerActorCode",request.ownerActorCode());
            responsePayload.put("reductionMethod",request.reductionMethod());
            responsePayload.put("rejectionReasonCode",request.rejectionReasonCode());
            responsePayload.put("reviewComment",request.reviewComment());
            responsePayload.put("targetReduction",request.targetReduction());
            responsePayload.put("targetYear",request.targetYear());
            if(Boolean.TRUE.equals(result.get("idempotent"))) {
                responsePayload.put("recovered",true);
                Ope9274a5a189f709efbc3e673fea6956b2089ab11RecoveryResponse response;
                try { response=objectMapper.convertValue(responsePayload,Ope9274a5a189f709efbc3e673fea6956b2089ab11RecoveryResponse.class); }
                catch(IllegalArgumentException mismatch) {
                    return org.springframework.http.ResponseEntity.status(500).body(new Ope9274a5a189f709efbc3e673fea6956b2089ab11ErrorResponse("INTERNAL_ERROR","Response contract mismatch",false));
                }
                return org.springframework.http.ResponseEntity.status(200).body(response);
            }
            Ope9274a5a189f709efbc3e673fea6956b2089ab11SuccessResponse response;
            try { response=objectMapper.convertValue(responsePayload,Ope9274a5a189f709efbc3e673fea6956b2089ab11SuccessResponse.class); }
            catch(IllegalArgumentException mismatch) {
                return org.springframework.http.ResponseEntity.status(500).body(new Ope9274a5a189f709efbc3e673fea6956b2089ab11ErrorResponse("INTERNAL_ERROR","Response contract mismatch",false));
            }
            return org.springframework.http.ResponseEntity.status(200).body(response);
        }
        catch(SecurityException denied) { return org.springframework.http.ResponseEntity.status(403).body(new Ope9274a5a189f709efbc3e673fea6956b2089ab11ErrorResponse("ACCESS_DENIED","Access denied",false)); }
        catch(IllegalArgumentException invalid) { return org.springframework.http.ResponseEntity.badRequest().body(new Ope9274a5a189f709efbc3e673fea6956b2089ab11ErrorResponse("INVALID_REQUEST","Request failed",false)); }
        catch(IllegalStateException conflict) { return org.springframework.http.ResponseEntity.status(409).body(new Ope9274a5a189f709efbc3e673fea6956b2089ab11ErrorResponse("CONFLICT","Request conflicts with the current state",false)); }
        catch(Exception unexpected) { return org.springframework.http.ResponseEntity.status(500).body(new Ope9274a5a189f709efbc3e673fea6956b2089ab11ErrorResponse("INTERNAL_ERROR","Internal processing failed",false)); }
    }
}
