package egovframework.com.platform.workbench.tools;

import egovframework.com.CarbonetApplication;
import egovframework.com.platform.request.workbench.SrTicketApprovalRequest;
import egovframework.com.platform.request.workbench.SrTicketCreateRequest;
import egovframework.com.platform.service.workbench.SrTicketWorkbenchPort;
import org.springframework.boot.WebApplicationType;
import org.springframework.boot.builder.SpringApplicationBuilder;
import org.springframework.context.ConfigurableApplicationContext;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Map;

public class SrTicketSafePlanTool {

    private static final DateTimeFormatter TS_FORMAT = DateTimeFormatter.ofPattern("yyyyMMddHHmmss");

    public static void main(String[] args) throws Exception {
        String actorId = property("sr.plan.actor-id", "SYSTEM_TOOL");
        String ticketId = property("sr.plan.ticket-id", "SR-PLAN-" + LocalDateTime.now().format(TS_FORMAT));
        String pageId = property("sr.plan.page-id", "codex-request");
        String pageLabel = property("sr.plan.page-label", "Codex Execution Console");
        String routePath = property("sr.plan.route-path", "/admin/system/codex-request");
        String menuCode = property("sr.plan.menu-code", "A1900103");
        String summary = property("sr.plan.summary", "Safe PLAN validation for Codex execution console");
        String instruction = property("sr.plan.instruction",
                "Review this SR ticket in read-only mode and provide a safe implementation plan. Do not modify any files.");
        String commandPrompt = property("sr.plan.command-prompt",
                "Inspect the repository in read-only mode. Return a concise plan with target files, risks, and verification steps.");
        boolean deleteAfter = Boolean.parseBoolean(property("sr.plan.delete-after", "false"));

        try (ConfigurableApplicationContext context = new SpringApplicationBuilder(CarbonetApplication.class)
                .web(WebApplicationType.NONE)
                .run(args)) {
            SrTicketWorkbenchPort service = context.getBean(SrTicketWorkbenchPort.class);

            SrTicketCreateRequest createRequest = new SrTicketCreateRequest();
            createRequest.setTicketId(ticketId);
            createRequest.setPageId(pageId);
            createRequest.setPageLabel(pageLabel);
            createRequest.setRoutePath(routePath);
            createRequest.setMenuCode(menuCode);
            createRequest.setMenuLookupUrl(routePath);
            createRequest.setSurfaceId("codex-request-runtime");
            createRequest.setSurfaceLabel("Runtime Configuration");
            createRequest.setEventId("codex-ticket-plan");
            createRequest.setEventLabel("SR Ticket Plan");
            createRequest.setTargetId("codex-request-plan-result");
            createRequest.setTargetLabel("Plan Result");
            createRequest.setSummary(summary);
            createRequest.setInstruction(instruction);
            createRequest.setGeneratedDirection("Validate the runner path with a safe PLAN before any BUILD execution.");
            createRequest.setCommandPrompt(commandPrompt);

            Map<String, Object> created = service.createTicket(createRequest, actorId);

            SrTicketApprovalRequest approvalRequest = new SrTicketApprovalRequest();
            approvalRequest.setDecision("APPROVE");
            approvalRequest.setComment("Approved for safe PLAN validation.");
            service.updateApproval(ticketId, approvalRequest, actorId);
            service.prepareExecution(ticketId, actorId);
            Map<String, Object> planResult = service.planTicket(ticketId, actorId);
            Map<String, Object> detail = service.getTicketDetail(ticketId);
            Map<String, Object> artifact = service.getTicketArtifact(ticketId, "plan-result");

            System.out.println("safePlan.created=" + created.get("success"));
            System.out.println("safePlan.ticketId=" + ticketId);
            System.out.println("safePlan.planMessage=" + planResult.get("message"));
            System.out.println("safePlan.ticketDetail=" + detail);
            System.out.println("safePlan.planArtifact=" + artifact);

            if (deleteAfter) {
                Map<String, Object> deleted = service.deleteTicket(ticketId, actorId);
                System.out.println("safePlan.deleted=" + deleted.get("success"));
            }
        }
    }

    private static String property(String key, String defaultValue) {
        String value = System.getProperty(key, "");
        return value == null || value.trim().isEmpty() ? defaultValue : value.trim();
    }
}
// agent note: updated by FreeAgent Ultra
