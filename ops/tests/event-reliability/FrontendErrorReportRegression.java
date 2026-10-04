import egovframework.com.feature.home.web.FrontendErrorReportController;
import egovframework.com.feature.home.dto.request.FrontendErrorReportRequest;
import egovframework.com.common.error.ErrorEventService;
import egovframework.com.platform.workbench.service.SrSelfHealingService;
import egovframework.com.platform.service.workbench.SrTicketWorkbenchPort;
import egovframework.com.platform.request.workbench.SrTicketCreateRequest;
import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.*;
import java.util.concurrent.atomic.AtomicInteger;
import org.mockito.ArgumentCaptor;
import static org.mockito.Mockito.*;

public class FrontendErrorReportRegression {
  static void check(boolean value, String name) {if(!value)throw new AssertionError(name);System.out.println("PASS " + name);}
  static FrontendErrorReportRequest request(String fingerprint) {
    var request=new FrontendErrorReportRequest();request.setFingerprint(fingerprint);
    request.setErrorType("WINDOW_ERROR");request.setPageId("test-only");request.setMessage("Isolated regression fixture");return request;
  }
  public static void main(String[] args) throws Exception {
    var healing=mock(SrSelfHealingService.class);var errors=mock(ErrorEventService.class);
    var tickets=mock(SrTicketWorkbenchPort.class);var http=mock(HttpServletRequest.class);
    when(healing.analyzeErrorPattern(any(),any(),any())).thenReturn(Map.of("shouldAutoHeal",false));
    when(tickets.createTicket(any(),any())).thenReturn(Map.of("success",true));
    var controller=new FrontendErrorReportController(healing,errors,tickets);
    String fingerprint=UUID.randomUUID().toString();
    var result=controller.reportError(request(fingerprint),http).getBody();
    var captor=ArgumentCaptor.forClass(SrTicketCreateRequest.class);
    verify(tickets).createTicket(captor.capture(),eq("SYSTEM-FRONTEND-ERROR"));
    check("ticket_created".equals(result.get("status")) && captor.getValue().getTicketId().equals(result.get("ticketId")),"real creation call and actual ticket ID");
    for(int i=1;i<10;i++)controller.reportError(request(fingerprint),http);
    check("deduplicated".equals(controller.reportError(request(fingerprint),http).getBody().get("status")),"11th report throttled");
    verify(tickets,times(10)).createTicket(any(),any());
    when(tickets.createTicket(any(),any())).thenThrow(new IllegalStateException("fixture unavailable"));
    check("logged".equals(controller.reportError(request(UUID.randomUUID().toString()),http).getBody().get("status")),"persistence exception never claims ticket created");
    doReturn(Map.of("success",false)).when(tickets).createTicket(any(),any());
    check("logged".equals(controller.reportError(request(UUID.randomUUID().toString()),http).getBody().get("status")),"negative persistence acknowledgement");
    when(healing.analyzeErrorPattern(any(),any(),any())).thenReturn(Map.of("shouldAutoHeal",true));
    when(healing.triggerSelfHealing(any(),any(),any())).thenReturn(Map.of("success",true,"requiresHumanApproval",true));
    check("logged".equals(controller.reportError(request(UUID.randomUUID().toString()),http).getBody().get("status")),"approval required is not self-healing completion");
    when(healing.analyzeErrorPattern(any(),any(),any())).thenReturn(Map.of("shouldAutoHeal",false));
    when(tickets.createTicket(any(),any())).thenReturn(Map.of("success",true));
    var pool=Executors.newFixedThreadPool(8);var count=new AtomicInteger();String concurrent=UUID.randomUUID().toString();
    try {var tasks=new java.util.ArrayList<Callable<Void>>();for(int i=0;i<40;i++)tasks.add(()->{if("ticket_created".equals(controller.reportError(request(concurrent),http).getBody().get("status")))count.incrementAndGet();return null;});for(var f:pool.invokeAll(tasks))f.get();}
    finally{pool.shutdown();}
    check(count.get()==10,"40 concurrent reports admit exactly 10");
    var realStore=new egovframework.com.platform.workbench.service.impl.SrTicketWorkbenchServiceImpl(new com.fasterxml.jackson.databind.ObjectMapper(),null,null);
    var file=java.nio.file.Files.createTempFile("ccus-sr-isolated-regression-", ".jsonl");
    try {
      var field=realStore.getClass().getDeclaredField("srTicketFilePath");field.setAccessible(true);field.set(realStore,file.toString());
      var realController=new FrontendErrorReportController(healing,errors,new egovframework.com.platform.workbench.service.SrTicketWorkbenchPortBridge(realStore));
      var persisted=realController.reportError(request(UUID.randomUUID().toString()),http).getBody();
      var row=new com.fasterxml.jackson.databind.ObjectMapper().readTree(java.nio.file.Files.readString(file));
      check("ticket_created".equals(persisted.get("status")) && row.get("ticketId").asText().equals(persisted.get("ticketId")),"actual SR writer persisted matching ticket ID in isolated file");
      check("IDLE".equals(row.get("queueStatus").asText()),"saved ticket does not queue automatic code execution");
    } finally {java.nio.file.Files.deleteIfExists(file);}
  }
}
