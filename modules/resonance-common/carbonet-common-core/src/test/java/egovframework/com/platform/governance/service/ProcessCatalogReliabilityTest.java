package egovframework.com.platform.governance.service;
import egovframework.com.platform.codex.service.CodexProvisioningService;
import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;
import static org.mockito.ArgumentMatchers.anyString;

class ProcessCatalogReliabilityTest {
    Map<String,Object> row(Object... pairs){Map<String,Object> m=new LinkedHashMap<>();for(int i=0;i<pairs.length;i+=2)m.put((String)pairs[i],pairs[i+1]);return m;}
    Map<String,Object> p(String code,Integer wave,Integer dev){return row("processCode",code,"domainCode","X","workflowOrder",wave,"developmentOrder",dev,"lifecycleStatus","ACTIVE");}
    Map<String,Object> s(String code,Object binding){return row("processCode","P","stepCode",code,"stepOrder",1,"screenResourceId",binding,"audience","USER","routePath",binding==null?null:"/test");}
    Map<String,Object> run(List<Map<String,Object>> ps,List<Map<String,Object>> ss,List<Map<String,Object>> rt){
        JdbcTemplate jdbc=mock(JdbcTemplate.class);
        when(jdbc.queryForList(anyString())).thenReturn(List.of(row("workTypeCode","X","sort_order",1,"use_at","Y")),ps,ss,rt);
        var service=new ActorProcessGovernanceService(jdbc,mock(ScreenDevelopmentNoteService.class),mock(CodexProvisioningService.class),mock(ScreenContractRuntimeService.class));
        var result=service.processCatalog();verify(jdbc,times(4)).queryForList(anyString());verifyNoMoreInteractions(jdbc);return result;
    }
    @SuppressWarnings("unchecked") List<Map<String,Object>> processes(Map<String,Object> r){return (List<Map<String,Object>>)((List<Map<String,Object>>)r.get("businessTypes")).get(0).get("processes");}
    @SuppressWarnings("unchecked") List<Map<String,Object>> steps(Map<String,Object> r){return (List<Map<String,Object>>)processes(r).get(0).get("steps");}
    Object count(Map<String,Object> r,String k){return ((Map<?,?>)r.get("counts")).get(k);}
    @Test void nullsLast(){var r=run(List.of(p("N",null,0),p("P",2,9)),List.of(),List.of());assertEquals("P",processes(r).get(0).get("processCode"));}
    @Test void tieBreakers(){var r=run(List.of(p("Z",1,2),p("B",1,1),p("A",1,1)),List.of(),List.of());assertEquals(List.of("A","B","Z"),processes(r).stream().map(x->x.get("processCode")).toList());}
    @Test void deterministic100(){List<Map<String,Object>> ps=new ArrayList<>(List.of(p("Z",null,0),p("A",1,2),p("B",1,2)));for(int i=0;i<100;i++){Collections.shuffle(ps,new Random(i));assertEquals(List.of("A","B","Z"),processes(run(ps,List.of(),List.of())).stream().map(x->x.get("processCode")).toList());}}
    @Test void multipleBindingsOneStep(){var r=run(List.of(p("P",1,1)),List.of(s("S",1),s("S",2)),List.of());assertEquals(1,steps(r).size());assertEquals(2,((List<?>)steps(r).get(0).get("screenBindings")).size());}
    @Test void duplicateBinding(){var r=run(List.of(p("P",1,1)),List.of(s("S",1),s("S",1)),List.of());assertEquals(1,((List<?>)steps(r).get(0).get("screenBindings")).size());}
    @Test void noBinding(){var r=run(List.of(p("P",1,1)),List.of(s("S",null)),List.of());assertEquals(List.of(),steps(r).get(0).get("screenBindings"));}
    @Test void distinctProcesses(){var r=run(List.of(p("P",1,1),p("P",1,1)),List.of(),List.of());assertEquals(1,count(r,"processes"));}
    @Test void distinctSteps(){var r=run(List.of(p("P",1,1)),List.of(s("S",1),s("S",2),s("T",null)),List.of());assertEquals(2,count(r,"steps"));}
    @Test void runtimeInvariant(){var rt=List.of(row("processCode","P","total",7L,"running",3L,"completed",4L));var a=run(List.of(p("P",1,1)),List.of(s("S",1)),rt);var b=run(List.of(p("P",1,1)),List.of(s("S",1),s("S",2)),rt);assertEquals(processes(a).get(0).get("runtimeSummary"),processes(b).get(0).get("runtimeSummary"));assertEquals(7L,((Map<?,?>)processes(b).get(0).get("runtimeSummary")).get("total"));}
    @Test void orphanRuntime(){var r=run(List.of(p("P",1,1)),List.of(),List.of(row("processCode","ABSENT","total",5L)));assertEquals(5L,r.get("orphanRuntimeCount"));}
}
