package egovframework.com.generated.canonical;

@org.springframework.web.bind.annotation.RestController
@javax.annotation.processing.Generated(value="canonical-design", comments="designHash=ba54bf32bb660b1249a4df5d4ff23c7cf5d9e05b0077de647cbaccb834289247;endpointHash=0abfc27eb78baad12b7c3c653ae0bc6f3002b2099951a57bd12b1d33ee72a0e6")
public final class Op3dc54121ad8c16d9d60d28e7424830ac4ce4a050Controller {
    private final egovframework.com.platform.governance.service.ActorProcessGovernanceService service;
    private final egovframework.com.feature.auth.service.CurrentUserContextService currentUserContextService;
    private final com.fasterxml.jackson.databind.ObjectMapper objectMapper;

    public Op3dc54121ad8c16d9d60d28e7424830ac4ce4a050Controller(
            egovframework.com.platform.governance.service.ActorProcessGovernanceService service,
            egovframework.com.feature.auth.service.CurrentUserContextService currentUserContextService,
            com.fasterxml.jackson.databind.ObjectMapper objectMapper) {
        this.service=service;
        this.currentUserContextService=currentUserContextService;
        this.objectMapper=objectMapper;
    }

    @org.springframework.web.bind.annotation.PostMapping(path="/home/api/process-executions/{executionId}/commands/reduction_performance/reduction_performance_s2/admin", consumes="application/json")
    public org.springframework.http.ResponseEntity<?> execute(
            @org.springframework.web.bind.annotation.PathVariable("executionId") java.util.UUID executionId,
            @org.springframework.web.bind.annotation.RequestBody Op3dc54121ad8c16d9d60d28e7424830ac4ce4a050Request request,
            jakarta.servlet.http.HttpServletRequest servletRequest) {
        var context=currentUserContextService.resolve(servletRequest);
        if(context==null || !context.isAuthenticated() || context.getUserId()==null || context.getUserId().isBlank())
            return org.springframework.http.ResponseEntity.status(401).body(new Op3dc54121ad8c16d9d60d28e7424830ac4ce4a050ErrorResponse("AUTHENTICATION_REQUIRED","Authentication is required.",false));
        if(request==null || request.actorCode()==null || request.actorCode().isBlank() || request.actualReduction()==null || request.baselineEmission()==null || request.baselineYear()==null || request.baselineYear().isBlank() || request.capex()==null || request.dueAt()==null || request.dueAt().isBlank() || request.expectedReduction()==null || request.idempotencyKey()==null || request.idempotencyKey().isBlank() || request.nextActorCode()==null || request.nextActorCode().isBlank() || request.opex()==null || request.ownerActorCode()==null || request.ownerActorCode().isBlank() || request.projectId()==null || request.projectId().isBlank() || request.reductionMethod()==null || request.reductionMethod().isBlank() || request.targetReduction()==null || request.targetYear()==null || request.targetYear().isBlank() || request.taskComment()==null || request.taskComment().isBlank() || request.tenantId()==null || request.tenantId().isBlank())
            return org.springframework.http.ResponseEntity.badRequest().body(new Op3dc54121ad8c16d9d60d28e7424830ac4ce4a050ErrorResponse("INVALID_REQUEST","Request failed",false));
        if(!"REDUCTION_MANAGER".equals(request.actorCode()))
            return org.springframework.http.ResponseEntity.status(403).body(new Op3dc54121ad8c16d9d60d28e7424830ac4ce4a050ErrorResponse("ACCESS_DENIED","Access denied",false));
        var payload=new java.util.LinkedHashMap<String,Object>();
        payload.put("actorCode", request.actorCode());
        payload.put("idempotencyKey", request.idempotencyKey());
        payload.put("projectId", request.projectId());
        payload.put("tenantId", request.tenantId());
        payload.put("processCode","REDUCTION_PERFORMANCE");
        payload.put("stepCode","REDUCTION_PERFORMANCE_S2");
        payload.put("commandCode","REDUCTION_PERFORMANCE_EXECUTE");
        payload.put("routePath","/admin/generated/reduction-performance/reduction-performance-s2");
        payload.put("audience","ADMIN");
        payload.put("requireDraft",true);
        var business=new java.util.LinkedHashMap<String,Object>();
        business.put("actualReduction", request.actualReduction());
        business.put("baselineEmission", request.baselineEmission());
        business.put("baselineYear", request.baselineYear());
        business.put("capex", request.capex());
        business.put("dueAt", request.dueAt());
        business.put("expectedReduction", request.expectedReduction());
        business.put("nextActorCode", request.nextActorCode());
        business.put("opex", request.opex());
        business.put("ownerActorCode", request.ownerActorCode());
        business.put("reductionMethod", request.reductionMethod());
        business.put("targetReduction", request.targetReduction());
        business.put("targetYear", request.targetYear());
        business.put("taskComment", request.taskComment());
        try {
            try { payload.put("requestJson",objectMapper.writeValueAsString(business)); }
            catch(Exception invalidJson) {
                return org.springframework.http.ResponseEntity.badRequest().body(new Op3dc54121ad8c16d9d60d28e7424830ac4ce4a050ErrorResponse("INVALID_REQUEST","Request serialization failed",false));
            }
            var result=service.executeProcessCommand(executionId,payload,context.getUserId());
            if(!Boolean.TRUE.equals(result.get("success"))
                    || !(result.get("idempotent") instanceof Boolean)
                    || !(result.get("eventId") instanceof Number)
                    || !(result.get("toState") instanceof String)
                    || ((String)result.get("toState")).isBlank()
)
                return org.springframework.http.ResponseEntity.status(500).body(new Op3dc54121ad8c16d9d60d28e7424830ac4ce4a050ErrorResponse("INTERNAL_ERROR","Response contract mismatch",false));
            var responsePayload=new java.util.LinkedHashMap<String,Object>();
            responsePayload.put("success",result.get("success"));
            responsePayload.put("idempotent",result.get("idempotent"));
            responsePayload.put("eventId",((Number)result.get("eventId")).longValue());
            responsePayload.put("toState",result.get("toState"));
            responsePayload.put("actualReduction",request.actualReduction());
            responsePayload.put("baselineEmission",request.baselineEmission());
            responsePayload.put("baselineYear",request.baselineYear());
            responsePayload.put("capex",request.capex());
            responsePayload.put("dueAt",request.dueAt());
            responsePayload.put("expectedReduction",request.expectedReduction());
            responsePayload.put("nextActorCode",request.nextActorCode());
            responsePayload.put("opex",request.opex());
            responsePayload.put("ownerActorCode",request.ownerActorCode());
            responsePayload.put("reductionMethod",request.reductionMethod());
            responsePayload.put("targetReduction",request.targetReduction());
            responsePayload.put("targetYear",request.targetYear());
            responsePayload.put("taskComment",request.taskComment());
            if(Boolean.TRUE.equals(result.get("idempotent"))) {
                responsePayload.put("recovered",true);
                Op3dc54121ad8c16d9d60d28e7424830ac4ce4a050RecoveryResponse response;
                try { response=objectMapper.convertValue(responsePayload,Op3dc54121ad8c16d9d60d28e7424830ac4ce4a050RecoveryResponse.class); }
                catch(IllegalArgumentException mismatch) {
                    return org.springframework.http.ResponseEntity.status(500).body(new Op3dc54121ad8c16d9d60d28e7424830ac4ce4a050ErrorResponse("INTERNAL_ERROR","Response contract mismatch",false));
                }
                return org.springframework.http.ResponseEntity.status(200).body(response);
            }
            Op3dc54121ad8c16d9d60d28e7424830ac4ce4a050SuccessResponse response;
            try { response=objectMapper.convertValue(responsePayload,Op3dc54121ad8c16d9d60d28e7424830ac4ce4a050SuccessResponse.class); }
            catch(IllegalArgumentException mismatch) {
                return org.springframework.http.ResponseEntity.status(500).body(new Op3dc54121ad8c16d9d60d28e7424830ac4ce4a050ErrorResponse("INTERNAL_ERROR","Response contract mismatch",false));
            }
            return org.springframework.http.ResponseEntity.status(200).body(response);
        }
        catch(SecurityException denied) { return org.springframework.http.ResponseEntity.status(403).body(new Op3dc54121ad8c16d9d60d28e7424830ac4ce4a050ErrorResponse("ACCESS_DENIED","Access denied",false)); }
        catch(IllegalArgumentException invalid) { return org.springframework.http.ResponseEntity.badRequest().body(new Op3dc54121ad8c16d9d60d28e7424830ac4ce4a050ErrorResponse("INVALID_REQUEST","Request failed",false)); }
        catch(IllegalStateException conflict) { return org.springframework.http.ResponseEntity.status(409).body(new Op3dc54121ad8c16d9d60d28e7424830ac4ce4a050ErrorResponse("CONFLICT","Request conflicts with the current state",false)); }
        catch(Exception unexpected) { return org.springframework.http.ResponseEntity.status(500).body(new Op3dc54121ad8c16d9d60d28e7424830ac4ce4a050ErrorResponse("INTERNAL_ERROR","Internal processing failed",false)); }
    }
}
