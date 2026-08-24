package egovframework.com.generated.canonical;

@org.springframework.web.bind.annotation.RestController
@javax.annotation.processing.Generated(value="canonical-design", comments="designHash=0be074368fe0ed859c0343474d39c8152b9d35d6630806a91a5fe472d9c1a739;endpointHash=aa85d46b0ac592205db8d617001762e7ab57908ce31e73172513a420a74bb4d2")
public final class Opc454a75560d6da059be06e19b90a098b91acb6b1Controller {
    private final egovframework.com.platform.governance.service.ActorProcessGovernanceService service;
    private final egovframework.com.feature.auth.service.CurrentUserContextService currentUserContextService;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper;

    public Opc454a75560d6da059be06e19b90a098b91acb6b1Controller(
            egovframework.com.platform.governance.service.ActorProcessGovernanceService service,
            egovframework.com.feature.auth.service.CurrentUserContextService currentUserContextService,
            com.fasterxml.jackson.databind.ObjectMapper objectMapper) {
        this.service=service;
        this.currentUserContextService=currentUserContextService;
        this.objectMapper=objectMapper;
    }

    @org.springframework.web.bind.annotation.PostMapping(path="/home/api/process-executions/{executionId}/commands/reduction_performance/reduction_performance_s3/user", consumes="application/json")
    public org.springframework.http.ResponseEntity<?> execute(
            @org.springframework.web.bind.annotation.PathVariable("executionId") java.util.UUID executionId,
            @org.springframework.web.bind.annotation.RequestBody Opc454a75560d6da059be06e19b90a098b91acb6b1Request request,
            jakarta.servlet.http.HttpServletRequest servletRequest) {
        var context=currentUserContextService.resolve(servletRequest);
        if(context==null || !context.isAuthenticated() || context.getUserId()==null || context.getUserId().isBlank())
            return org.springframework.http.ResponseEntity.status(401).body(new Opc454a75560d6da059be06e19b90a098b91acb6b1ErrorResponse("AUTHENTICATION_REQUIRED","Authentication is required.",false));
        if(request==null || request.actorCode()==null || request.actorCode().isBlank() || request.actualReduction()==null || request.baselineEmission()==null || request.baselineYear()==null || request.baselineYear().isBlank() || request.capex()==null || request.decidedAt()==null || request.decidedAt().isBlank() || request.decisionCode()==null || request.decisionCode().isBlank() || request.expectedReduction()==null || request.idempotencyKey()==null || request.idempotencyKey().isBlank() || request.opex()==null || request.ownerActorCode()==null || request.ownerActorCode().isBlank() || request.projectId()==null || request.projectId().isBlank() || request.reductionMethod()==null || request.reductionMethod().isBlank() || request.rejectionReasonCode()==null || request.rejectionReasonCode().isBlank() || request.reviewComment()==null || request.reviewComment().isBlank() || request.targetReduction()==null || request.targetYear()==null || request.targetYear().isBlank() || request.tenantId()==null || request.tenantId().isBlank())
            return org.springframework.http.ResponseEntity.badRequest().body(new Opc454a75560d6da059be06e19b90a098b91acb6b1ErrorResponse("INVALID_REQUEST","Request failed",false));
        if(!"VERIFIER".equals(request.actorCode()))
            return org.springframework.http.ResponseEntity.status(403).body(new Opc454a75560d6da059be06e19b90a098b91acb6b1ErrorResponse("ACCESS_DENIED","Access denied",false));
        var payload=new java.util.LinkedHashMap<String,Object>();
        payload.put("actorCode", request.actorCode());
        payload.put("idempotencyKey", request.idempotencyKey());
        payload.put("projectId", request.projectId());
        payload.put("tenantId", request.tenantId());
        payload.put("processCode","REDUCTION_PERFORMANCE");
        payload.put("stepCode","REDUCTION_PERFORMANCE_S3");
        payload.put("commandCode","REDUCTION_PERFORMANCE_REVIEW");
        payload.put("routePath","/generated/reduction-performance/reduction-performance-s3");
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
                return org.springframework.http.ResponseEntity.badRequest().body(new Opc454a75560d6da059be06e19b90a098b91acb6b1ErrorResponse("INVALID_REQUEST","Request serialization failed",false));
            }
            var result=service.executeProcessCommand(executionId,payload,context.getUserId());
            if(!Boolean.TRUE.equals(result.get("success"))
                    || !(result.get("idempotent") instanceof Boolean)
                    || !(result.get("eventId") instanceof Number)
                    || !(result.get("toState") instanceof String)
                    || ((String)result.get("toState")).isBlank()
)
                return org.springframework.http.ResponseEntity.status(500).body(new Opc454a75560d6da059be06e19b90a098b91acb6b1ErrorResponse("INTERNAL_ERROR","Response contract mismatch",false));
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
                Opc454a75560d6da059be06e19b90a098b91acb6b1RecoveryResponse response;
                try { response=objectMapper.convertValue(responsePayload,Opc454a75560d6da059be06e19b90a098b91acb6b1RecoveryResponse.class); }
                catch(IllegalArgumentException mismatch) {
                    return org.springframework.http.ResponseEntity.status(500).body(new Opc454a75560d6da059be06e19b90a098b91acb6b1ErrorResponse("INTERNAL_ERROR","Response contract mismatch",false));
                }
                return org.springframework.http.ResponseEntity.status(200).body(response);
            }
            Opc454a75560d6da059be06e19b90a098b91acb6b1SuccessResponse response;
            try { response=objectMapper.convertValue(responsePayload,Opc454a75560d6da059be06e19b90a098b91acb6b1SuccessResponse.class); }
            catch(IllegalArgumentException mismatch) {
                return org.springframework.http.ResponseEntity.status(500).body(new Opc454a75560d6da059be06e19b90a098b91acb6b1ErrorResponse("INTERNAL_ERROR","Response contract mismatch",false));
            }
            return org.springframework.http.ResponseEntity.status(200).body(response);
        }
        catch(SecurityException denied) { return org.springframework.http.ResponseEntity.status(403).body(new Opc454a75560d6da059be06e19b90a098b91acb6b1ErrorResponse("ACCESS_DENIED","Access denied",false)); }
        catch(IllegalArgumentException invalid) { return org.springframework.http.ResponseEntity.badRequest().body(new Opc454a75560d6da059be06e19b90a098b91acb6b1ErrorResponse("INVALID_REQUEST","Request failed",false)); }
        catch(IllegalStateException conflict) { return org.springframework.http.ResponseEntity.status(409).body(new Opc454a75560d6da059be06e19b90a098b91acb6b1ErrorResponse("CONFLICT","Request conflicts with the current state",false)); }
        catch(Exception unexpected) { return org.springframework.http.ResponseEntity.status(500).body(new Opc454a75560d6da059be06e19b90a098b91acb6b1ErrorResponse("INTERNAL_ERROR","Internal processing failed",false)); }
    }
}
