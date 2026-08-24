package egovframework.com.generated.canonical;

@org.springframework.web.bind.annotation.RestController
@javax.annotation.processing.Generated(value="canonical-design", comments="designHash=7e63c67c869f8bf64658466d7150b7bf2145db6ec6857a9659122fd26a2b997b;endpointHash=7fb30e1dcba996baa4e63d9f0d70a8ffe12794c830302b3f10baf128b9987546")
public final class Op31c109eededd273d233c789872a075a0e25a32e0Controller {
    private final egovframework.com.platform.governance.service.ActorProcessGovernanceService service;
    private final egovframework.com.feature.auth.service.CurrentUserContextService currentUserContextService;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper;

    public Op31c109eededd273d233c789872a075a0e25a32e0Controller(
            egovframework.com.platform.governance.service.ActorProcessGovernanceService service,
            egovframework.com.feature.auth.service.CurrentUserContextService currentUserContextService,
            com.fasterxml.jackson.databind.ObjectMapper objectMapper) {
        this.service=service;
        this.currentUserContextService=currentUserContextService;
        this.objectMapper=objectMapper;
    }

    @org.springframework.web.bind.annotation.PostMapping(path="/home/api/process-executions/{executionId}/commands/reduction_project_registration/reduction_project_registration_s4/user", consumes="application/json")
    public org.springframework.http.ResponseEntity<?> execute(
            @org.springframework.web.bind.annotation.PathVariable("executionId") java.util.UUID executionId,
            @org.springframework.web.bind.annotation.RequestBody Op31c109eededd273d233c789872a075a0e25a32e0Request request,
            jakarta.servlet.http.HttpServletRequest servletRequest) {
        var context=currentUserContextService.resolve(servletRequest);
        if(context==null || !context.isAuthenticated() || context.getUserId()==null || context.getUserId().isBlank())
            return org.springframework.http.ResponseEntity.status(401).body(new Op31c109eededd273d233c789872a075a0e25a32e0ErrorResponse("AUTHENTICATION_REQUIRED","Authentication is required.",false));
        if(request==null || request.actorCode()==null || request.actorCode().isBlank() || request.actualReduction()==null || request.baselineEmission()==null || request.baselineYear()==null || request.baselineYear().isBlank() || request.capex()==null || request.decidedAt()==null || request.decidedAt().isBlank() || request.decisionCode()==null || request.decisionCode().isBlank() || request.expectedReduction()==null || request.idempotencyKey()==null || request.idempotencyKey().isBlank() || request.opex()==null || request.ownerActorCode()==null || request.ownerActorCode().isBlank() || request.projectId()==null || request.projectId().isBlank() || request.reductionMethod()==null || request.reductionMethod().isBlank() || request.rejectionReasonCode()==null || request.rejectionReasonCode().isBlank() || request.reviewComment()==null || request.reviewComment().isBlank() || request.targetReduction()==null || request.targetYear()==null || request.targetYear().isBlank() || request.tenantId()==null || request.tenantId().isBlank())
            return org.springframework.http.ResponseEntity.badRequest().body(new Op31c109eededd273d233c789872a075a0e25a32e0ErrorResponse("INVALID_REQUEST","Request failed",false));
        if(!"APPROVER".equals(request.actorCode()))
            return org.springframework.http.ResponseEntity.status(403).body(new Op31c109eededd273d233c789872a075a0e25a32e0ErrorResponse("ACCESS_DENIED","Access denied",false));
        var payload=new java.util.LinkedHashMap<String,Object>();
        payload.put("actorCode", request.actorCode());
        payload.put("idempotencyKey", request.idempotencyKey());
        payload.put("projectId", request.projectId());
        payload.put("tenantId", request.tenantId());
        payload.put("processCode","REDUCTION_PROJECT_REGISTRATION");
        payload.put("stepCode","REDUCTION_PROJECT_REGISTRATION_S4");
        payload.put("commandCode","REDUCTION_PROJECT_REGISTRATION_COMPLETE");
        payload.put("routePath","/generated/reduction-project-registration/reduction-project-registration-s4");
        payload.put("audience","USER");
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
                return org.springframework.http.ResponseEntity.badRequest().body(new Op31c109eededd273d233c789872a075a0e25a32e0ErrorResponse("INVALID_REQUEST","Request serialization failed",false));
            }
            var result=service.executeProcessCommand(executionId,payload,context.getUserId());
            if(!Boolean.TRUE.equals(result.get("success"))
                    || !(result.get("idempotent") instanceof Boolean)
                    || !(result.get("eventId") instanceof Number)
                    || !(result.get("toState") instanceof String)
                    || ((String)result.get("toState")).isBlank()
)
                return org.springframework.http.ResponseEntity.status(500).body(new Op31c109eededd273d233c789872a075a0e25a32e0ErrorResponse("INTERNAL_ERROR","Response contract mismatch",false));
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
                Op31c109eededd273d233c789872a075a0e25a32e0RecoveryResponse response;
                try { response=objectMapper.convertValue(responsePayload,Op31c109eededd273d233c789872a075a0e25a32e0RecoveryResponse.class); }
                catch(IllegalArgumentException mismatch) {
                    return org.springframework.http.ResponseEntity.status(500).body(new Op31c109eededd273d233c789872a075a0e25a32e0ErrorResponse("INTERNAL_ERROR","Response contract mismatch",false));
                }
                return org.springframework.http.ResponseEntity.status(200).body(response);
            }
            Op31c109eededd273d233c789872a075a0e25a32e0SuccessResponse response;
            try { response=objectMapper.convertValue(responsePayload,Op31c109eededd273d233c789872a075a0e25a32e0SuccessResponse.class); }
            catch(IllegalArgumentException mismatch) {
                return org.springframework.http.ResponseEntity.status(500).body(new Op31c109eededd273d233c789872a075a0e25a32e0ErrorResponse("INTERNAL_ERROR","Response contract mismatch",false));
            }
            return org.springframework.http.ResponseEntity.status(200).body(response);
        }
        catch(SecurityException denied) { return org.springframework.http.ResponseEntity.status(403).body(new Op31c109eededd273d233c789872a075a0e25a32e0ErrorResponse("ACCESS_DENIED","Access denied",false)); }
        catch(IllegalArgumentException invalid) { return org.springframework.http.ResponseEntity.badRequest().body(new Op31c109eededd273d233c789872a075a0e25a32e0ErrorResponse("INVALID_REQUEST","Request failed",false)); }
        catch(IllegalStateException conflict) { return org.springframework.http.ResponseEntity.status(409).body(new Op31c109eededd273d233c789872a075a0e25a32e0ErrorResponse("CONFLICT","Request conflicts with the current state",false)); }
        catch(Exception unexpected) { return org.springframework.http.ResponseEntity.status(500).body(new Op31c109eededd273d233c789872a075a0e25a32e0ErrorResponse("INTERNAL_ERROR","Internal processing failed",false)); }
    }
}
