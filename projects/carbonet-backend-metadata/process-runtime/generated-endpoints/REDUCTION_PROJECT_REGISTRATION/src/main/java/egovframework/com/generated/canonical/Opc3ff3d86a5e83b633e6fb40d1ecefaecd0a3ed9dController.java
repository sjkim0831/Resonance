package egovframework.com.generated.canonical;

@org.springframework.web.bind.annotation.RestController
@javax.annotation.processing.Generated(value="canonical-design", comments="designHash=b580b431a13b1dcd66fc3e2bf1f3294a4262733800da95fc415bf0f4e398d855;endpointHash=b6632e9d0412c5d116518f5de153e0092e0516d346b928798f85caefd8e7c012")
public final class Opc3ff3d86a5e83b633e6fb40d1ecefaecd0a3ed9dController {
    private final egovframework.com.platform.governance.service.ActorProcessGovernanceService service;
    private final egovframework.com.feature.auth.service.CurrentUserContextService currentUserContextService;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper;

    public Opc3ff3d86a5e83b633e6fb40d1ecefaecd0a3ed9dController(
            egovframework.com.platform.governance.service.ActorProcessGovernanceService service,
            egovframework.com.feature.auth.service.CurrentUserContextService currentUserContextService,
            com.fasterxml.jackson.databind.ObjectMapper objectMapper) {
        this.service=service;
        this.currentUserContextService=currentUserContextService;
        this.objectMapper=objectMapper;
    }

    @org.springframework.web.bind.annotation.PostMapping(path="/home/api/process-executions/{executionId}/commands/reduction_project_registration/reduction_project_registration_s1/admin", consumes="application/json")
    public org.springframework.http.ResponseEntity<?> execute(
            @org.springframework.web.bind.annotation.PathVariable("executionId") java.util.UUID executionId,
            @org.springframework.web.bind.annotation.RequestBody Opc3ff3d86a5e83b633e6fb40d1ecefaecd0a3ed9dRequest request,
            jakarta.servlet.http.HttpServletRequest servletRequest) {
        var context=currentUserContextService.resolve(servletRequest);
        if(context==null || !context.isAuthenticated() || context.getUserId()==null || context.getUserId().isBlank())
            return org.springframework.http.ResponseEntity.status(401).body(new Opc3ff3d86a5e83b633e6fb40d1ecefaecd0a3ed9dErrorResponse("AUTHENTICATION_REQUIRED","Authentication is required.",false));
        if(request==null || request.actorCode()==null || request.actorCode().isBlank() || request.actualReduction()==null || request.baselineEmission()==null || request.baselineYear()==null || request.baselineYear().isBlank() || request.businessName()==null || request.businessName().isBlank() || request.businessPurpose()==null || request.businessPurpose().isBlank() || request.capex()==null || request.effectiveFrom()==null || request.effectiveFrom().isBlank() || request.effectiveTo()==null || request.effectiveTo().isBlank() || request.expectedReduction()==null || request.idempotencyKey()==null || request.idempotencyKey().isBlank() || request.opex()==null || request.ownerActorCode()==null || request.ownerActorCode().isBlank() || request.projectId()==null || request.projectId().isBlank() || request.reductionMethod()==null || request.reductionMethod().isBlank() || request.targetReduction()==null || request.targetYear()==null || request.targetYear().isBlank() || request.tenantId()==null || request.tenantId().isBlank())
            return org.springframework.http.ResponseEntity.badRequest().body(new Opc3ff3d86a5e83b633e6fb40d1ecefaecd0a3ed9dErrorResponse("INVALID_REQUEST","Request failed",false));
        if(!"REDUCTION_MANAGER".equals(request.actorCode()))
            return org.springframework.http.ResponseEntity.status(403).body(new Opc3ff3d86a5e83b633e6fb40d1ecefaecd0a3ed9dErrorResponse("ACCESS_DENIED","Access denied",false));
        var payload=new java.util.LinkedHashMap<String,Object>();
        payload.put("actorCode", request.actorCode());
        payload.put("idempotencyKey", request.idempotencyKey());
        payload.put("projectId", request.projectId());
        payload.put("tenantId", request.tenantId());
        payload.put("processCode","REDUCTION_PROJECT_REGISTRATION");
        payload.put("stepCode","REDUCTION_PROJECT_REGISTRATION_S1");
        payload.put("commandCode","REDUCTION_PROJECT_REGISTRATION_REQUEST");
        payload.put("routePath","/admin/generated/reduction-project-registration/reduction-project-registration-s1");
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
                return org.springframework.http.ResponseEntity.badRequest().body(new Opc3ff3d86a5e83b633e6fb40d1ecefaecd0a3ed9dErrorResponse("INVALID_REQUEST","Request serialization failed",false));
            }
            var result=service.executeProcessCommand(executionId,payload,context.getUserId());
            if(!Boolean.TRUE.equals(result.get("success"))
                    || !(result.get("idempotent") instanceof Boolean)
                    || !(result.get("eventId") instanceof Number)
                    || !(result.get("toState") instanceof String)
                    || ((String)result.get("toState")).isBlank()
)
                return org.springframework.http.ResponseEntity.status(500).body(new Opc3ff3d86a5e83b633e6fb40d1ecefaecd0a3ed9dErrorResponse("INTERNAL_ERROR","Response contract mismatch",false));
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
                Opc3ff3d86a5e83b633e6fb40d1ecefaecd0a3ed9dRecoveryResponse response;
                try { response=objectMapper.convertValue(responsePayload,Opc3ff3d86a5e83b633e6fb40d1ecefaecd0a3ed9dRecoveryResponse.class); }
                catch(IllegalArgumentException mismatch) {
                    return org.springframework.http.ResponseEntity.status(500).body(new Opc3ff3d86a5e83b633e6fb40d1ecefaecd0a3ed9dErrorResponse("INTERNAL_ERROR","Response contract mismatch",false));
                }
                return org.springframework.http.ResponseEntity.status(200).body(response);
            }
            Opc3ff3d86a5e83b633e6fb40d1ecefaecd0a3ed9dSuccessResponse response;
            try { response=objectMapper.convertValue(responsePayload,Opc3ff3d86a5e83b633e6fb40d1ecefaecd0a3ed9dSuccessResponse.class); }
            catch(IllegalArgumentException mismatch) {
                return org.springframework.http.ResponseEntity.status(500).body(new Opc3ff3d86a5e83b633e6fb40d1ecefaecd0a3ed9dErrorResponse("INTERNAL_ERROR","Response contract mismatch",false));
            }
            return org.springframework.http.ResponseEntity.status(200).body(response);
        }
        catch(SecurityException denied) { return org.springframework.http.ResponseEntity.status(403).body(new Opc3ff3d86a5e83b633e6fb40d1ecefaecd0a3ed9dErrorResponse("ACCESS_DENIED","Access denied",false)); }
        catch(IllegalArgumentException invalid) { return org.springframework.http.ResponseEntity.badRequest().body(new Opc3ff3d86a5e83b633e6fb40d1ecefaecd0a3ed9dErrorResponse("INVALID_REQUEST","Request failed",false)); }
        catch(IllegalStateException conflict) { return org.springframework.http.ResponseEntity.status(409).body(new Opc3ff3d86a5e83b633e6fb40d1ecefaecd0a3ed9dErrorResponse("CONFLICT","Request conflicts with the current state",false)); }
        catch(Exception unexpected) { return org.springframework.http.ResponseEntity.status(500).body(new Opc3ff3d86a5e83b633e6fb40d1ecefaecd0a3ed9dErrorResponse("INTERNAL_ERROR","Internal processing failed",false)); }
    }
}
