package egovframework.com.platform.governance.web;

import egovframework.com.common.interceptor.AdminMainAuthInterceptor;
import egovframework.com.feature.auth.domain.repository.EmployeeMemberRepository;
import egovframework.com.feature.auth.service.CurrentUserContextService;
import egovframework.com.feature.auth.util.JwtTokenProvider;
import egovframework.com.feature.member.service.EnterpriseMemberService;
import egovframework.com.framework.authority.service.FrameworkAuthorityPolicyService;
import egovframework.com.platform.codex.service.AuthGroupManageService;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.web.bind.annotation.PostMapping;

import java.lang.reflect.Method;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ActorProcessGovernancePostAuthorizationContractTest {
    private static final Map<String,AuthorizationClass> EXPECTED=expectedAuthorization();

    @Test
    void all52PostEndpointsHaveExactlyOneAuthorizationClass(){
        Set<String> actual=new LinkedHashSet<>();
        for(Method method:ActorProcessGovernanceApiController.class.getDeclaredMethods()){
            PostMapping mapping=method.getAnnotation(PostMapping.class);
            if(mapping==null)continue;
            assertEquals(1,mapping.value().length,"POST mapping must expose one canonical endpoint: "+method.getName());
            assertTrue(actual.add(mapping.value()[0]),"duplicate POST endpoint: "+mapping.value()[0]);
        }

        assertEquals(52,actual.size());
        assertEquals(EXPECTED.keySet(),actual);
        assertEquals(39,count(AuthorizationClass.DESIGN_ADMIN));
        assertEquals(6,count(AuthorizationClass.SYSTEM_REPORT_ADMIN));
        assertEquals(2,count(AuthorizationClass.PROCESS_ACTOR));
        assertEquals(3,count(AuthorizationClass.INTERNAL_WORKER));
        assertEquals(1,count(AuthorizationClass.ACCOUNT_ASSIGNMENT));
        assertEquals(1,count(AuthorizationClass.LEGACY_FEATURE));
    }

    @Test
    void interceptorBypassMatchesOnlyEndpointLocalAuthorizationContracts() throws Exception {
        AdminMainAuthInterceptor interceptor=new AdminMainAuthInterceptor(
                mock(JwtTokenProvider.class),mock(AuthGroupManageService.class),mock(EnterpriseMemberService.class),
                mock(EmployeeMemberRepository.class),mock(FrameworkAuthorityPolicyService.class),
                mock(CurrentUserContextService.class));
        Method local=AdminMainAuthInterceptor.class.getDeclaredMethod(
                "isLocallyGuardedAdminOperation",HttpServletRequest.class,String.class);
        Method worker=AdminMainAuthInterceptor.class.getDeclaredMethod(
                "isWorkerControlEndpoint",HttpServletRequest.class,String.class);
        local.setAccessible(true);worker.setAccessible(true);
        HttpServletRequest request=mock(HttpServletRequest.class);
        when(request.getMethod()).thenReturn("POST");

        for(var entry:EXPECTED.entrySet()){
            String endpoint=entry.getKey().replace("{executionId}","123e4567-e89b-12d3-a456-426614174000");
            String path="/admin/api/system/actor-process"+endpoint;
            boolean localResult=(boolean)local.invoke(interceptor,request,path);
            boolean workerResult=(boolean)worker.invoke(interceptor,request,path);
            if(entry.getValue()==AuthorizationClass.INTERNAL_WORKER){
                assertFalse(localResult,entry.getKey());
                assertTrue(workerResult,entry.getKey());
            }else if(entry.getValue()==AuthorizationClass.LEGACY_FEATURE){
                assertFalse(localResult,entry.getKey());
                assertFalse(workerResult,entry.getKey());
            }else{
                assertTrue(localResult,entry.getKey());
                assertFalse(workerResult,entry.getKey());
            }
        }
    }

    private static long count(AuthorizationClass authorizationClass){
        return EXPECTED.values().stream().filter(value->value==authorizationClass).count();
    }

    private static Map<String,AuthorizationClass> expectedAuthorization(){
        Map<String,AuthorizationClass> result=new LinkedHashMap<>();
        register(result,AuthorizationClass.DESIGN_ADMIN,
                "/process-closing/audit","/assets/refresh","/process-archetypes/bind-screen",
                "/design-assets/preflight","/actors","/work-types","/delivery/blueprints","/delivery/apply",
                "/processes","/steps","/development/plan","/development/bootstrap-process",
                "/development/direct","/design/save-and-generate","/development/approve",
                "/development/preflight","/design/validate","/design/generate-professional-graph",
                "/screen-workflow-test","/screen-workflow-test-cases","/qa-sessions","/common-features/install",
                "/professional-screen-contracts","/professional-factory/execute","/professional-factory/evidence",
                "/professional-factory/assemble-assets","/backend/verify","/backend/runtime-smoke",
                "/development/retry","/development/request","/references/scan","/generation/compile",
                "/generation/compile-and-queue","/generation/adopt-existing","/generation/queue",
                "/cases","/artifacts","/runs","/standard-pack");
        register(result,AuthorizationClass.SYSTEM_REPORT_ADMIN,
                "/system-test-report/audit","/system-test-report/audit-batches/start",
                "/system-test-report/audit-batches/{auditBatchId}/complete",
                "/system-test-report/audit-batches/{auditBatchId}/fail","/system-test-report/reviews",
                "/professional-screen-contracts/preview");
        register(result,AuthorizationClass.PROCESS_ACTOR,
                "/executions/start","/executions/{executionId}/commands");
        register(result,AuthorizationClass.INTERNAL_WORKER,
                "/development/claim","/development/heartbeat","/development/complete");
        register(result,AuthorizationClass.ACCOUNT_ASSIGNMENT,"/assignments");
        register(result,AuthorizationClass.LEGACY_FEATURE,"/delivery/validate");
        return Collections.unmodifiableMap(result);
    }

    private static void register(Map<String,AuthorizationClass> target,AuthorizationClass authorizationClass,String... endpoints){
        for(String endpoint:endpoints){
            if(target.putIfAbsent(endpoint,authorizationClass)!=null)
                throw new IllegalStateException("Duplicate POST authorization classification: "+endpoint);
        }
    }

    private enum AuthorizationClass{
        DESIGN_ADMIN,SYSTEM_REPORT_ADMIN,PROCESS_ACTOR,INTERNAL_WORKER,ACCOUNT_ASSIGNMENT,LEGACY_FEATURE
    }
}
