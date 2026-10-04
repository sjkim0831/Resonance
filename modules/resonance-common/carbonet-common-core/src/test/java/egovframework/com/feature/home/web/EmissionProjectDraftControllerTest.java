package egovframework.com.feature.home.web;

import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.feature.auth.service.CurrentUserContextService;
import egovframework.com.feature.home.service.EmissionProjectRegistryService;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.AbstractPlatformTransactionManager;
import org.springframework.transaction.support.DefaultTransactionStatus;
import org.springframework.http.ResponseEntity;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class EmissionProjectDraftControllerTest {
    @Test
    void createPersistsEverySetupFieldAndTenantComesFromAuthenticatedContext() {
        JdbcTemplate jdbc=mock(JdbcTemplate.class);
        CurrentUserContextService users=mock(CurrentUserContextService.class);
        EmissionProjectRegistryService registry=mock(EmissionProjectRegistryService.class);
        HttpServletRequest request=mock(HttpServletRequest.class);
        var context=new CurrentUserContextService.CurrentUserContext();
        context.setAuthenticated(true);context.setUserId("manager-1");context.setInsttId("TENANT-A");
        when(users.resolve(request)).thenReturn(context);
        when(jdbc.queryForObject(contains("framework_account_actor_assignment"),eq(Boolean.class),eq("TENANT-A"),eq("manager-1"))).thenReturn(true);
        when(registry.onboardingReadiness("TENANT-A")).thenReturn(Map.of("missing",List.of()));
        when(jdbc.queryForList(contains("SELECT project_id,settings_snapshot"),eq("TENANT-A"),eq("fixture-request-0001"))).thenReturn(List.of());
        when(jdbc.queryForList(contains("SELECT site_id,site_name"),eq(9001L),eq("TENANT-A"))).thenReturn(List.of(Map.of("site_id",9001L,"site_name","Fixture site")));
        AtomicReference<Object[]> stored=new AtomicReference<>();
        doAnswer(invocation->{stored.set(java.util.Arrays.copyOfRange(invocation.getArguments(),1,invocation.getArguments().length));return 1;}).when(jdbc).update(contains("INSERT INTO emission_project_registry"),any(Object[].class));
        var controller=new EmissionProjectDraftController(jdbc,users,registry,new NoopTransactionManager(),new ObjectMapper());

        ResponseEntity<?> response=controller.create(validRequest(),request);

        assertEquals(200,response.getStatusCode().value(),String.valueOf(response.getBody()));
        Map<?,?> body=(Map<?,?>)response.getBody();
        assertNotNull(body);assertEquals(false,body.get("replayed"));assertTrue(String.valueOf(body.get("id")).startsWith("PRJ-"));
        Object[] args=stored.get();assertNotNull(args);assertEquals(23,args.length);
        assertEquals("TENANT-A",args[1]);assertEquals("Scope 1, Scope 2",args[5]);assertEquals("manager-1",args[6]);
        assertEquals("2027-01-31",args[7].toString());assertEquals("2026-01-01",args[9].toString());assertEquals("2026-12-31",args[10].toString());
        assertEquals(2026,((Number)args[11]).intValue());assertEquals("OPERATIONAL_CONTROL",args[12]);assertEquals("ISO_14064_1",args[13]);
        assertEquals("FIXTURE-1",args[14]);assertEquals("LIMITED",args[15]);assertEquals("MONTHLY",args[16]);assertEquals(5,((Number)args[17]).intValue());
        assertEquals("[\"Scope 1\",\"Scope 2\"]",args[20]);assertEquals("manager-1",args[21]);
        verify(jdbc,never()).update(contains("tenantId"),any(Object[].class));
    }

    @Test
    void createRejectsMissingScopesBeforeAnyProjectWrite() {
        JdbcTemplate jdbc=mock(JdbcTemplate.class);
        CurrentUserContextService users=mock(CurrentUserContextService.class);
        EmissionProjectRegistryService registry=mock(EmissionProjectRegistryService.class);
        HttpServletRequest request=mock(HttpServletRequest.class);
        var context=new CurrentUserContextService.CurrentUserContext();
        context.setAuthenticated(true);context.setUserId("manager-1");context.setInsttId("TENANT-A");
        when(users.resolve(request)).thenReturn(context);
        when(jdbc.queryForObject(contains("framework_account_actor_assignment"),eq(Boolean.class),eq("TENANT-A"),eq("manager-1"))).thenReturn(true);
        when(registry.onboardingReadiness("TENANT-A")).thenReturn(Map.of("missing",List.of()));
        var controller=new EmissionProjectDraftController(jdbc,users,registry,new NoopTransactionManager(),new ObjectMapper());
        Map<String,Object> invalid=validRequest();invalid.remove("scopes");

        ResponseEntity<?> response=controller.create(invalid,request);

        assertEquals(400,response.getStatusCode().value());
        verify(jdbc,never()).update(contains("INSERT INTO emission_project_registry"),any(Object[].class));
    }

    private static Map<String,Object> validRequest(){
        return new java.util.LinkedHashMap<>(Map.ofEntries(
                Map.entry("name","Fixture project"),Map.entry("description","test fixture"),
                Map.entry("clientRequestId","fixture-request-0001"),Map.entry("periodStart","2026-01-01"),Map.entry("periodEnd","2026-12-31"),
                Map.entry("dueDate","2027-01-31"),Map.entry("reportingYear",2026),Map.entry("siteIds",List.of("9001")),
                Map.entry("scopes",List.of("Scope 1","Scope 2")),Map.entry("organizationBoundary","OPERATIONAL_CONTROL"),
                Map.entry("emissionStandard","ISO_14064_1"),Map.entry("methodologyVersion","FIXTURE-1"),
                Map.entry("verificationLevel","LIMITED"),Map.entry("collectionCycle","MONTHLY"),Map.entry("materialityThreshold",5),
                Map.entry("tenantId","ATTACKER-CONTROLLED")));
    }

    private static final class NoopTransactionManager extends AbstractPlatformTransactionManager {
        @Override protected Object doGetTransaction(){return new Object();}
        @Override protected void doBegin(Object transaction,TransactionDefinition definition){}
        @Override protected void doCommit(DefaultTransactionStatus status){}
        @Override protected void doRollback(DefaultTransactionStatus status){}
    }
}
