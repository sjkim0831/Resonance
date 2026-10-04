import egovframework.com.common.trace.*;
import egovframework.com.common.mapper.ObservabilityMapper;
import egovframework.com.common.web.TelemetryController;
import egovframework.com.common.error.ErrorEventService;
import egovframework.com.common.logging.AccessEventService;
import java.util.*;
import org.mockito.ArgumentCaptor;
import static org.mockito.Mockito.*;
public class TelemetryIdempotencyRegression {
 static void check(boolean v,String label){if(!v)throw new AssertionError(label);System.out.println("PASS "+label);}
 static FrontendTelemetryEvent event(String id){var e=new FrontendTelemetryEvent();e.setEventId(id);e.setTraceId("qa-isolated");e.setType("page_view");e.setPageId("/qa-fixture");return e;}
 public static void main(String[] args)throws Exception{
  var mapper=mock(ObservabilityMapper.class);Set<String> ids=new HashSet<>();
  when(mapper.insertFrontendTraceEvent(any())).thenAnswer(inv->ids.add(((TraceEventRecordVO)inv.getArgument(0)).getEventId())?1:0);
  var service=new TraceEventService(mapper,new com.fasterxml.jackson.databind.ObjectMapper(),null);
  var e=event("0123456789abcdef0123456789abcdef");
  var first=service.recordFrontendBatch(List.of(e));var second=service.recordFrontendBatch(List.of(e));
  check(first.newEvents().size()==1&&second.newEvents().isEmpty()&&second.acceptedCount()==1,"replay acknowledged without new row");
  check(second.acceptedEventIds().equals(List.of(e.getEventId())),"per-event acknowledgement");
  e.setPageId("/changed");check(service.recordFrontendBatch(List.of(e)).newEvents().size()==1,"changed payload cannot suppress another event");
  var invalid=event("invalid");check(service.recordFrontendBatch(List.of(invalid)).acceptedCount()==0,"invalid ID remains unacknowledged");
  check(service.recordFrontendBatch(Arrays.asList(null,event("bad"))).acceptedCount()==0,"invalid entries skipped safely");
  check(service.recordFrontendBatch(List.of(event(null))).acceptedCount()==1,"legacy client accepted");
  doThrow(new IllegalStateException("fixture unavailable")).when(mapper).insertFrontendTraceEvent(any());
  check(service.recordFrontendBatch(List.of(e)).acceptedCount()==0,"database failure never acknowledged");
  var fake=mock(TraceEventService.class);var access=mock(AccessEventService.class);var errors=mock(ErrorEventService.class);
  when(fake.recordFrontendBatch(any())).thenReturn(new TraceEventService.FrontendBatchResult(1,List.of(e.getEventId()),List.of()));
  var controller=new TelemetryController(fake,errors,access);var batch=new FrontendTelemetryBatchRequest();batch.setEvents(List.of(e));
  var response=controller.ingestEvents(batch,null).getBody();
  check(response.get("newCount").equals(0)&&response.get("acceptedCount").equals(1),"controller exposes replay status");
  verify(access).recordFrontendPageViews(eq(List.of()),isNull());verify(errors).recordFrontendTelemetryErrors(eq(List.of()));
  check(true,"replay excluded from access and error projections");
  batch.setEvents(Collections.nCopies(101,e));check(controller.ingestEvents(batch,null).getStatusCode().value()==400,"batch limit 100 enforced");
  var config=new org.apache.ibatis.session.Configuration();
  try(var input=new java.io.FileInputStream(args[0])){new org.apache.ibatis.builder.xml.XMLMapperBuilder(input,config,args[0],config.getSqlFragments()).parse();}
  var statement=config.getMappedStatement("ObservabilityMapper.insertFrontendTraceEvent");
  check(statement.getBoundSql(new TraceEventRecordVO()).getSql().contains("ON CONFLICT (EVENT_ID) DO NOTHING"),"actual MyBatis statement resolves idempotent SQL");
  service.recordRequestEvent(TraceContext.builder().traceId("qa-server-classification").requestUri("/api/frontend/session").httpMethod("GET").build(),"ERROR",2,500);
  var captured=ArgumentCaptor.forClass(TraceEventRecordVO.class);verify(mapper).insertTraceEvent(captured.capture());
  var classification=new com.fasterxml.jackson.databind.ObjectMapper().readTree(captured.getValue().getPayloadSummaryJson()).get("usageClassification");
  check("TECHNICAL_READ".equals(classification.get("activity").asText()),"server session read classified");
  check("ERROR_OR_SECURITY".equals(classification.get("attention").asText()),"technical request error remains visible");
  check("UNKNOWN".equals(classification.get("origin").asText())&&!classification.get("analyticsEligible").asBoolean(),"server request does not assert human origin");
  var rollupMapper=mock(ObservabilityMapper.class);var rollup=new TraceEventService(rollupMapper,new com.fasterxml.jackson.databind.ObjectMapper(),null);
  var session=TraceContext.builder().traceId("qa-rollup").requestUri("/api/frontend/session").httpMethod("GET").build();
  when(rollupMapper.aggregateTechnicalRequest(any())).thenReturn(1);
  rollup.recordRequestEvent(session,"SUCCESS",10,200);
  verify(rollupMapper).aggregateTechnicalRequest(any());verify(rollupMapper,never()).insertTraceEvent(any());
  check(true,"normal session request aggregated without raw trace");
  for(int status:new int[]{302,401,403,500})rollup.recordRequestEvent(session,status==302?"SUCCESS":"HTTP_ERROR",10,status);
  verify(rollupMapper,times(4)).insertTraceEvent(any());check(true,"redirect and all error statuses retain raw traces");
  rollup.recordRequestEvent(TraceContext.builder().requestUri("/api/frontend/session").httpMethod("POST").build(),"SUCCESS",10,200);
  rollup.recordRequestEvent(TraceContext.builder().requestUri("/admin/member/approve").httpMethod("GET").build(),"SUCCESS",10,200);
  verify(rollupMapper,times(6)).insertTraceEvent(any());check(true,"nonallowlisted methods and business routes unchanged");
  session=TraceContext.builder().traceId("qa-rollup-next").requestUri("/api/frontend/session").httpMethod("GET").build();
  when(rollupMapper.aggregateTechnicalRequest(any())).thenReturn(0);rollup.recordRequestEvent(session,"SUCCESS",10,200);
  verify(rollupMapper,times(7)).insertTraceEvent(any());check(true,"unconfirmed aggregate falls back to raw trace");
  when(rollupMapper.aggregateTechnicalRequest(any())).thenThrow(new IllegalStateException("fixture unavailable"));rollup.recordRequestEvent(session,"SUCCESS",10,200);
  verify(rollupMapper,times(8)).insertTraceEvent(any());check(true,"aggregate failure falls back to raw trace");
  var switchField=TraceEventService.class.getDeclaredField("technicalRollupEnabled");switchField.setAccessible(true);switchField.set(rollup,false);
  rollup.recordRequestEvent(session,"SUCCESS",10,200);verify(rollupMapper,times(9)).insertTraceEvent(any());check(true,"configuration switch restores individual tracing");
  check(config.getMappedStatement("ObservabilityMapper.aggregateTechnicalRequest").getBoundSql(Map.of("projectId","qa","route","/api/frontend/session","method","GET","status",200,"durationMs",1)).getSql().contains("request_count + 1"),"rollup SQL accumulates instead of discarding counts");
 }
}
