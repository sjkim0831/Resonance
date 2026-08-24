package egovframework.com.generated.canonical;

@org.springframework.web.bind.annotation.RestController
@javax.annotation.processing.Generated(value="canonical-design", comments="designHash=c56171e478b1a6b109edcb46451b58138115d72664bdf1f08b53c233f2ce6013;endpointHash=71f91afe26129c59ca331e185d95b95e64432d8ae546b744c128876e71de2a9a")
public final class Op46bf0976eed5b55a824a32a2fa36a84ce145b85eController {
    private final egovframework.com.platform.governance.service.ActorProcessGovernanceService service;
    private final egovframework.com.feature.auth.service.CurrentUserContextService currentUserContextService;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper;

    public Op46bf0976eed5b55a824a32a2fa36a84ce145b85eController(
            egovframework.com.platform.governance.service.ActorProcessGovernanceService service,
            egovframework.com.feature.auth.service.CurrentUserContextService currentUserContextService,
            com.fasterxml.jackson.databind.ObjectMapper objectMapper) {
        this.service=service;
        this.currentUserContextService=currentUserContextService;
        this.objectMapper=objectMapper;
    }

    @org.springframework.web.bind.annotation.PostMapping(path="/home/api/process-executions/{executionId}/commands/reduction_target_planning/reduction_target_planning_s1/admin", consumes="application/json")
    public org.springframework.http.ResponseEntity<?> execute(
            @org.springframework.web.bind.annotation.PathVariable("executionId") java.util.UUID executionId,
            @org.springframework.web.bind.annotation.RequestBody Op46bf0976eed5b55a824a32a2fa36a84ce145b85eRequest request,
            jakarta.servlet.http.HttpServletRequest servletRequest) {
        var context=currentUserContextService.resolve(servletRequest);
        if(context==null || !context.isAuthenticated() || context.getUserId()==null || context.getUserId().isBlank())
            return org.springframework.http.ResponseEntity.status(401).body(new Op46bf0976eed5b55a824a32a2fa36a84ce145b85eErrorResponse("AUTHENTICATION_REQUIRED","Authentication is required.",false));
        if(request==null || request.actorCode()==null || request.actorCode().isBlank() || request.actualReduction()==null || request.baselineEmission()==null || request.baselineYear()==null || request.baselineYear().isBlank() || request.businessName()==null || request.businessName().isBlank() || request.businessPurpose()==null || request.businessPurpose().isBlank() || request.capex()==null || request.effectiveFrom()==null || request.effectiveFrom().isBlank() || request.effectiveTo()==null || request.effectiveTo().isBlank() || request.expectedReduction()==null || request.idempotencyKey()==null || request.idempotencyKey().isBlank() || request.opex()==null || request.ownerActorCode()==null || request.ownerActorCode().isBlank() || request.projectId()==null || request.projectId().isBlank() || request.reductionMethod()==null || request.reductionMethod().isBlank() || request.targetReduction()==null || request.targetYear()==null || request.targetYear().isBlank() || request.tenantId()==null || request.tenantId().isBlank())
            return org.springframework.http.ResponseEntity.badRequest().body(new Op46bf0976eed5b55a824a32a2fa36a84ce145b85eErrorResponse("INVALID_REQUEST","Request failed",false));
        if(!"REDUCTION_MANAGER".equals(request.actorCode()))
            return org.springframework.http.ResponseEntity.status(403).body(new Op46bf0976eed5b55a824a32a2fa36a84ce145b85eErrorResponse("ACCESS_DENIED","Access denied",false));
        var payload=new java.util.LinkedHashMap<String,Object>();
        payload.put("actorCode", request.actorCode());
        payload.put("idempotencyKey", request.idempotencyKey());
        payload.put("projectId", request.projectId());
        payload.put("tenantId", request.tenantId());
        payload.put("processCode","REDUCTION_TARGET_PLANNING");
        payload.put("stepCode","REDUCTION_TARGET_PLANNING_S1");
        payload.put("commandCode","REDUCTION_TARGET_PLANNING_REQUEST");
        payload.put("routePath","/admin/generated/reduction-target-planning/reduction-target-planning-s1");
        payload.put("audience","ADMIN");
        payload.put("requireDraft",true);
        var business=new java.util.LinkedHashMap<String,Object>();
        business.put("actualReduction", request.actualReduction());
        business.put("baselineEmission", request.baselineEmission());
        business.put("baselineYear", request.baselineYear());
        business.put("businessName", request.businessName());
        business.put("businessPurpose", request.businessPurpose());
        business.put("capex", request.capex());
        business.put("effectiveFrom", request.effectiveFrom());
        business.put("effectiveTo", request.effectiveTo());
        business.put("expectedReduction", request.expectedReduction());
        business.put("opex", request.opex());
        business.put("ownerActorCode", request.ownerActorCode());
        business.put("reductionMethod", request.reductionMethod());
        business.put("targetReduction", request.targetReduction());
        business.put("targetYear", request.targetYear());
        try {
            try { payload.put("requestJson",objectMapper.writeValueAsString(business)); }
            catch(Exception invalidJson) {
                return org.springframework.http.ResponseEntity.badRequest().body(new Op46bf0976eed5b55a824a32a2fa36a84ce145b85eErrorResponse("INVALID_REQUEST","Request serialization failed",false));
            }
            var result=service.executeProcessCommand(executionId,payload,context.getUserId());
            if(!Boolean.TRUE.equals(result.get("success"))
                    || !(result.get("idempotent") instanceof Boolean)
                    || !(result.get("eventId") instanceof Number)
                    || !(result.get("toState") instanceof String)
                    || ((String)result.get("toState")).isBlank()
)
                return org.springframework.http.ResponseEntity.status(500).body(new Op46bf0976eed5b55a824a32a2fa36a84ce145b85eErrorResponse("INTERNAL_ERROR","Response contract mismatch",false));
            var responsePayload=new java.util.LinkedHashMap<String,Object>();
            responsePayload.put("success",result.get("success"));
            responsePayload.put("idempotent",result.get("idempotent"));
            responsePayload.put("eventId",((Number)result.get("eventId")).longValue());
            responsePayload.put("toState",result.get("toState"));
            responsePayload.put("actualReduction",request.actualReduction());
            responsePayload.put("baselineEmission",request.baselineEmission());
            responsePayload.put("baselineYear",request.baselineYear());
            responsePayload.put("businessName",request.businessName());
            responsePayload.put("businessPurpose",request.businessPurpose());
            responsePayload.put("capex",request.capex());
            responsePayload.put("effectiveFrom",request.effectiveFrom());
            responsePayload.put("effectiveTo",request.effectiveTo());
            responsePayload.put("expectedReduction",request.expectedReduction());
            responsePayload.put("opex",request.opex());
            responsePayload.put("ownerActorCode",request.ownerActorCode());
            responsePayload.put("reductionMethod",request.reductionMethod());
            responsePayload.put("targetReduction",request.targetReduction());
            responsePayload.put("targetYear",request.targetYear());
            if(Boolean.TRUE.equals(result.get("idempotent"))) {
                responsePayload.put("recovered",true);
                Op46bf0976eed5b55a824a32a2fa36a84ce145b85eRecoveryResponse response;
                try { response=objectMapper.convertValue(responsePayload,Op46bf0976eed5b55a824a32a2fa36a84ce145b85eRecoveryResponse.class); }
                catch(IllegalArgumentException mismatch) {
                    return org.springframework.http.ResponseEntity.status(500).body(new Op46bf0976eed5b55a824a32a2fa36a84ce145b85eErrorResponse("INTERNAL_ERROR","Response contract mismatch",false));
                }
                return org.springframework.http.ResponseEntity.status(200).body(response);
            }
            Op46bf0976eed5b55a824a32a2fa36a84ce145b85eSuccessResponse response;
            try { response=objectMapper.convertValue(responsePayload,Op46bf0976eed5b55a824a32a2fa36a84ce145b85eSuccessResponse.class); }
            catch(IllegalArgumentException mismatch) {
                return org.springframework.http.ResponseEntity.status(500).body(new Op46bf0976eed5b55a824a32a2fa36a84ce145b85eErrorResponse("INTERNAL_ERROR","Response contract mismatch",false));
            }
            return org.springframework.http.ResponseEntity.status(200).body(response);
        }
        catch(SecurityException denied) { return org.springframework.http.ResponseEntity.status(403).body(new Op46bf0976eed5b55a824a32a2fa36a84ce145b85eErrorResponse("ACCESS_DENIED","Access denied",false)); }
        catch(IllegalArgumentException invalid) { return org.springframework.http.ResponseEntity.badRequest().body(new Op46bf0976eed5b55a824a32a2fa36a84ce145b85eErrorResponse("INVALID_REQUEST","Request failed",false)); }
        catch(IllegalStateException conflict) { return org.springframework.http.ResponseEntity.status(409).body(new Op46bf0976eed5b55a824a32a2fa36a84ce145b85eErrorResponse("CONFLICT","Request conflicts with the current state",false)); }
        catch(Exception unexpected) { return org.springframework.http.ResponseEntity.status(500).body(new Op46bf0976eed5b55a824a32a2fa36a84ce145b85eErrorResponse("INTERNAL_ERROR","Internal processing failed",false)); }
    }
}
