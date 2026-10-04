import egovframework.com.common.filter.RequestExecutionLoggingFilter;
import egovframework.com.common.trace.*;
import egovframework.com.common.mapper.ObservabilityMapper;
import egovframework.com.common.logging.*;
import egovframework.com.common.audit.AuditTrailService;
import jakarta.servlet.*;
import jakarta.servlet.http.*;
import java.util.*;
import static org.mockito.Mockito.*;
public class SessionLedgerRegression {
 static void check(boolean v,String name){if(!v)throw new AssertionError(name);System.out.println("PASS "+name);}
 static void run(String name,int status,String method,String path,boolean storageFailure,String scope,boolean requestFailure,boolean contextAvailable,boolean enabled)throws Exception{
  var file=mock(RequestExecutionLogService.class);var access=mock(AccessEventService.class);var audit=mock(AuditTrailService.class);var mapper=mock(ObservabilityMapper.class);
  if(storageFailure)when(mapper.aggregateTechnicalRequest(any())).thenThrow(new IllegalStateException("isolated fixture"));else when(mapper.aggregateTechnicalRequest(any())).thenReturn(1);
  var trace=new TraceEventService(mapper,new com.fasterxml.jackson.databind.ObjectMapper(),null);
  var field=TraceEventService.class.getDeclaredField("technicalRollupEnabled");field.setAccessible(true);field.set(trace,enabled);
  var ctor=Arrays.stream(RequestExecutionLoggingFilter.class.getConstructors()).filter(c->c.getParameterCount()==9).findFirst().orElseThrow();
  var params=ctor.getParameterTypes();Object[] args=new Object[9];for(int i=0;i<9;i++)args[i]=mock(params[i]);args[0]=file;args[1]=access;args[2]=audit;args[8]=trace;
  var filter=(RequestExecutionLoggingFilter)ctor.newInstance(args);
  var request=mock(HttpServletRequest.class);var response=mock(HttpServletResponse.class);
  when(request.getRequestURI()).thenReturn(path);when(request.getMethod()).thenReturn(method);when(request.getParameterNames()).thenReturn(Collections.emptyEnumeration());when(request.getParameterMap()).thenReturn(Map.of());
  when(request.getAttribute("companyScopeDecision")).thenReturn(scope);when(response.getStatus()).thenReturn(status);
  boolean cookiePresent=name.startsWith("cookie present");
  if(cookiePresent)when(request.getCookies()).thenReturn(new Cookie[]{new Cookie("accessToken","isolated-invalid-fixture")});
  var ctx=TraceContext.builder().traceId("qa-ledger").requestId("qa-ledger-request").requestUri(path).httpMethod(method).build();
  if(contextAvailable)TraceContextHolder.set(ctx);else TraceContextHolder.clear();
  try{
   var invoke=RequestExecutionLoggingFilter.class.getDeclaredMethod("doFilterInternal",HttpServletRequest.class,HttpServletResponse.class,FilterChain.class);invoke.setAccessible(true);
   try{invoke.invoke(filter,request,response,(FilterChain)(req,res)->{if(requestFailure)throw new java.io.IOException("isolated fixture");});}catch(java.lang.reflect.InvocationTargetException e){if(!requestFailure)throw e;}
   boolean suppress=status==200&&method.equals("GET")&&path.equals("/api/frontend/session")&&!storageFailure&&(scope==null||(scope.equals("ANONYMOUS")&&!cookiePresent)||scope.equals("NOT_REQUIRED"))&&!requestFailure&&contextAvailable&&enabled;
   verify(file).append(any());
   if(suppress){verifyNoInteractions(access,audit);trace.recordRequestEvent(ctx,"SUCCESS",5,status);verify(mapper,times(1)).aggregateTechnicalRequest(any());verify(mapper,never()).insertTraceEvent(any());}
   else{verify(access).recordRequestLog(any(),any());verify(audit).record(any(),any(),any(),any(),any(),any(),any(),any(),any(),any(),any(),any(),any());}
   check(true,name);
  }finally{TraceContextHolder.clear();}
 }
 public static void main(String[] a)throws Exception{
  run("successful aggregate suppresses two duplicate ledgers and counts once",200,"GET","/api/frontend/session",false,null,false,true,true);
  run("aggregate failure retains access and audit",200,"GET","/api/frontend/session",true,null,false,true,true);
  run("cookie-free anonymous session polling aggregates",200,"GET","/api/frontend/session",false,"ANONYMOUS",false,true,true);
  run("cookie present anonymous request retains evidence",200,"GET","/api/frontend/session",false,"ANONYMOUS",false,true,true);
  run("no company scope required session polling aggregates",200,"GET","/api/frontend/session",false,"NOT_REQUIRED",false,true,true);
  run("global authorization decision preserved",200,"GET","/api/frontend/session",false,"ALLOW_GLOBAL",false,true,true);
  for(int status:new int[]{302,401,403,500})run("status "+status+" retains access and audit",status,"GET","/api/frontend/session",false,null,false,true,true);
  run("company scope decision retained even with HTTP 200",200,"GET","/api/frontend/session",false,"DENY",false,true,true);
  run("request exception retains access and audit",200,"GET","/api/frontend/session",false,null,true,true,true);
  run("business API unchanged",200,"POST","/api/member/update",false,null,false,true,true);
  run("no trace context retains original ledgers",200,"GET","/api/frontend/session",false,null,false,false,true);
  run("disabled optimization retains original ledgers",200,"GET","/api/frontend/session",false,null,false,true,false);
 }
}
