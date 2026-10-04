package egovframework.com.common.logging;
import java.nio.file.*;
import java.util.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.platform.observability.service.AdminAccessHistoryPageService;
import static org.mockito.Mockito.*;
public class AccessHistoryTailRegression {
 static void check(boolean ok,String label){if(!ok)throw new AssertionError(label);System.out.println("PASS "+label);}
 public static void main(String[] args)throws Exception{
  var mapper=new ObjectMapper();var svc=new FileRequestExecutionLogService(mapper);
  var path=Files.createTempFile("ccus-tail-fixture-",".jsonl");
  try{
   try(var out=Files.newBufferedWriter(path)){
    for(int i=0;i<30000;i++){var row=new RequestExecutionLogVO();row.setLogId("fixture-"+i);row.setRequestUri("/qa/한글/"+i);row.setParameterSummary("x".repeat(512));out.write(mapper.writeValueAsString(row));out.newLine();if(i%113==0){out.write("invalid-json\n\n");}}
   }
   var enabled=FileRequestExecutionLogService.class.getDeclaredField("enabled");enabled.setAccessible(true);enabled.set(svc,true);
   var file=FileRequestExecutionLogService.class.getDeclaredField("requestLogFile");file.setAccessible(true);file.set(svc,path.toString());
   long t=System.nanoTime();var old=svc.searchRecent(x->true,1,500).getItems();long fullMs=(System.nanoTime()-t)/1000000;
   t=System.nanoTime();var tail=svc.readRecentTail(path,x->true,500);long tailMs=(System.nanoTime()-t)/1000000;
   check(mapper.writeValueAsString(old).equals(mapper.writeValueAsString(tail.items())),"latest 500 rows identical including order and Korean text");
   check(tail.bytesRead()<Files.size(path)/10,"tail reads less than 10 percent of fixture");
   check(svc.readRecentMatching(x->false,500).isEmpty(),"empty filtered result");
   System.out.println("BENCH fileBytes="+Files.size(path)+" tailBytes="+tail.bytesRead()+" fullMs="+fullMs+" tailMs="+tailMs);
   var logs=mock(RequestExecutionLogService.class);when(logs.readRecentMatching(any(),eq(500))).thenReturn(List.of());
   var ctor=AdminAccessHistoryPageService.class.getConstructors()[0];Object[] params=Arrays.stream(ctor.getParameterTypes()).map(c->mock(c)).toArray();params[0]=logs;
   var page=ctor.newInstance(params);
   for(String method:List.of("buildAccessHistoryCompanyOptions","buildAccessHistoryCompanyNameMap")){var m=AdminAccessHistoryPageService.class.getDeclaredMethod(method);m.setAccessible(true);m.invoke(page);}
   verify(logs,times(2)).readRecentMatching(any(),eq(500));verify(logs,never()).searchRecent(any(),anyInt(),anyInt());check(true,"both company lookups avoid full scan");
  }finally{Files.deleteIfExists(path);}
  if(args.length>0){var live=Paths.get(args[0]);long start=System.nanoTime();var result=svc.readRecentTail(live,x->true,500);check(result.items().size()==500,"live file newest 500 parsed");System.out.println("LIVE fileBytes="+Files.size(live)+" tailBytes="+result.bytesRead()+" elapsedMs="+((System.nanoTime()-start)/1000000));}
 }
}
