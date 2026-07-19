package egovframework.com.feature.home.web;

import egovframework.com.feature.home.service.EmissionProjectRegistryService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Map;
import org.springframework.web.multipart.MultipartFile;
import egovframework.com.feature.auth.service.CurrentUserContextService;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequiredArgsConstructor
public class EmissionProjectRegistryController {
    private final EmissionProjectRegistryService service;
    private final CurrentUserContextService currentUserContextService;

    @GetMapping({"/home/api/emission-projects", "/en/home/api/emission-projects"})
    public Map<String, Object> list(@RequestParam(defaultValue = "") String keyword,
                                    @RequestParam(defaultValue = "") String status,
                                    @RequestParam(defaultValue = "") String site,
                                    @RequestParam(defaultValue = "1") int page,HttpServletRequest request) {
        var context=currentUserContextService.resolve(request);
        return service.listForActor(tenant(context),context.getUserId(),context.isWebmaster(),keyword,status,site,page);
    }

    @GetMapping({"/home/api/emission-projects/options", "/en/home/api/emission-projects/options"})
    public Map<String, Object> options(@RequestParam(defaultValue = "") String keyword,HttpServletRequest request) {var c=currentUserContextService.resolve(request);return service.options(tenant(c),c.getUserId(),keyword); }

    @GetMapping({"/home/api/emission-projects/name-availability", "/en/home/api/emission-projects/name-availability"})
    public Map<String, Object> nameAvailability(@RequestParam String name,HttpServletRequest request) { return Map.of("available",service.nameAvailable(tenant(currentUserContextService.resolve(request)),name)); }

    @GetMapping({"/home/api/emission-projects/{id}", "/en/home/api/emission-projects/{id}"})
    public ResponseEntity<?> detail(@PathVariable String id) {
        try { return ResponseEntity.ok(service.detail(id)); }
        catch (IllegalArgumentException e) { return ResponseEntity.notFound().build(); }
    }

    @PostMapping({"/home/api/emission-projects/{id}/copy", "/en/home/api/emission-projects/{id}/copy"})
    public ResponseEntity<?> copy(@PathVariable String id, HttpServletRequest request) {
        if (!authenticated(request)) return ResponseEntity.status(401).body(Map.of("message", "로그인이 필요합니다."));
        var context=currentUserContextService.resolve(request);
        try { return ResponseEntity.ok(Map.of("success",true,"id",service.copy(id,tenant(context),context.getUserId(),context.isWebmaster()))); }
        catch (IllegalArgumentException e) { return ResponseEntity.badRequest().body(Map.of("message", e.getMessage())); }
    }

    @GetMapping({"/home/api/emission-projects/{id}/activities","/en/home/api/emission-projects/{id}/activities"})
    public ResponseEntity<?> activities(@PathVariable String id,@RequestParam(defaultValue="") String keyword) { try{return ResponseEntity.ok(service.activities(id,keyword));}catch(IllegalArgumentException e){return ResponseEntity.notFound().build();} }

    @PostMapping({"/home/api/emission-projects/{id}/activities","/en/home/api/emission-projects/{id}/activities"})
    public ResponseEntity<?> saveActivity(@PathVariable String id,@RequestBody Map<String,Object> body,HttpServletRequest request) {var c=currentUserContextService.resolve(request);try{return ResponseEntity.ok(Map.of("success",true,"id",service.saveActivity(id,tenant(c),c.getUserId(),c.isWebmaster(),body)));}catch(SecurityException e){return ResponseEntity.status(403).body(Map.of("message",e.getMessage()));}catch(Exception e){return ResponseEntity.badRequest().body(Map.of("message",e.getMessage()));} }

    @PostMapping({"/home/api/emission-projects/{id}/activities/upload","/en/home/api/emission-projects/{id}/activities/upload"})
    public ResponseEntity<?> uploadActivities(@PathVariable String id,@RequestParam("file") MultipartFile file,HttpServletRequest request) {var c=currentUserContextService.resolve(request);try{return ResponseEntity.ok(Map.of("success",true,"count",service.uploadActivities(id,tenant(c),c.getUserId(),c.isWebmaster(),file)));}catch(SecurityException e){return ResponseEntity.status(403).body(Map.of("message",e.getMessage()));}catch(Exception e){return ResponseEntity.badRequest().body(Map.of("message",e.getMessage()));} }

    @PostMapping({"/home/api/emission-projects/{id}/activities/{activityId}/factor","/en/home/api/emission-projects/{id}/activities/{activityId}/factor"})
    public ResponseEntity<?> mapFactor(@PathVariable String id,@PathVariable long activityId,@RequestBody Map<String,Object> body,HttpServletRequest request) {var c=currentUserContextService.resolve(request);try{return ResponseEntity.ok(Map.of("success",service.mapFactor(id,activityId,String.valueOf(body.get("factorId")),tenant(c),c.getUserId(),c.isWebmaster())>0));}catch(SecurityException e){return ResponseEntity.status(403).body(Map.of("message",e.getMessage()));}catch(IllegalStateException e){return ResponseEntity.status(409).body(Map.of("message",e.getMessage()));}catch(Exception e){return ResponseEntity.badRequest().body(Map.of("message",e.getMessage()));} }

    @PostMapping({"/home/api/emission-projects/{id}/activities/auto-map","/en/home/api/emission-projects/{id}/activities/auto-map"})
    public ResponseEntity<?> autoMap(@PathVariable String id,HttpServletRequest request) {var c=currentUserContextService.resolve(request);try{return ResponseEntity.ok(Map.of("success",true,"count",service.autoMap(id,tenant(c),c.getUserId(),c.isWebmaster())));}catch(SecurityException e){return ResponseEntity.status(403).body(Map.of("message",e.getMessage()));}catch(IllegalStateException e){return ResponseEntity.status(409).body(Map.of("message",e.getMessage()));}}

    @GetMapping({"/home/api/emission-projects/{id}/quality","/en/home/api/emission-projects/{id}/quality"})
    public ResponseEntity<?> latestQuality(@PathVariable String id,HttpServletRequest request) {var context=currentUserContextService.resolve(request);if(!context.isAuthenticated())return ResponseEntity.status(401).body(Map.of("message","로그인이 필요합니다."));try{return ResponseEntity.ok(service.latestQuality(id,tenant(context)));}catch(Exception e){return ResponseEntity.badRequest().body(Map.of("message",e.getMessage()));}}

    @PostMapping({"/home/api/emission-projects/{id}/quality","/en/home/api/emission-projects/{id}/quality"})
    public ResponseEntity<?> runQuality(@PathVariable String id,HttpServletRequest request) {var context=currentUserContextService.resolve(request);if(!context.isAuthenticated())return ResponseEntity.status(401).body(Map.of("message","로그인이 필요합니다."));try{return ResponseEntity.ok(service.runQuality(id,tenant(context),context.getUserId(),context.isWebmaster()));}catch(SecurityException e){return ResponseEntity.status(403).body(Map.of("message",e.getMessage()));}catch(Exception e){return ResponseEntity.badRequest().body(Map.of("message",e.getMessage()));}}

    @GetMapping({"/home/api/emission-projects/{id}/submissions","/en/home/api/emission-projects/{id}/submissions"})
    public ResponseEntity<?> submissions(@PathVariable String id,HttpServletRequest request) {var context=currentUserContextService.resolve(request);if(!context.isAuthenticated())return ResponseEntity.status(401).body(Map.of("message","로그인이 필요합니다."));try{return ResponseEntity.ok(service.submissions(id,tenant(context)));}catch(Exception e){return ResponseEntity.badRequest().body(Map.of("message",e.getMessage()));}}

    @PostMapping({"/home/api/emission-projects/{id}/submissions","/en/home/api/emission-projects/{id}/submissions"})
    public ResponseEntity<?> saveSubmission(@PathVariable String id,@RequestBody Map<String,Object> body,HttpServletRequest request) {var context=currentUserContextService.resolve(request);if(!context.isAuthenticated())return ResponseEntity.status(401).body(Map.of("message","로그인이 필요합니다."));try{return ResponseEntity.ok(service.saveSubmission(id,tenant(context),context.getUserId(),context.isWebmaster(),body));}catch(SecurityException e){return ResponseEntity.status(403).body(Map.of("message",e.getMessage()));}catch(Exception e){return ResponseEntity.badRequest().body(Map.of("message",e.getMessage()));}}

    @PostMapping({"/home/api/emission-projects/{id}/submissions/{submissionId}/submit","/en/home/api/emission-projects/{id}/submissions/{submissionId}/submit"})
    public ResponseEntity<?> submitActivities(@PathVariable String id,@PathVariable long submissionId,@RequestBody Map<String,Object> body,HttpServletRequest request) {var context=currentUserContextService.resolve(request);if(!context.isAuthenticated())return ResponseEntity.status(401).body(Map.of("message","로그인이 필요합니다."));try{return ResponseEntity.ok(service.submitActivities(id,submissionId,tenant(context),context.getUserId(),context.isWebmaster(),body));}catch(SecurityException e){return ResponseEntity.status(403).body(Map.of("message",e.getMessage()));}catch(IllegalStateException e){return ResponseEntity.status(409).body(Map.of("message",e.getMessage()));}catch(Exception e){return ResponseEntity.badRequest().body(Map.of("message",e.getMessage()));}}

    @GetMapping({"/home/api/emission-projects/{id}/activity-requests","/en/home/api/emission-projects/{id}/activity-requests"})
    public ResponseEntity<?> activityRequests(@PathVariable String id,HttpServletRequest request){var c=currentUserContextService.resolve(request);try{return ResponseEntity.ok(service.activityRequests(id,tenant(c),c.getUserId(),c.isWebmaster()));}catch(SecurityException e){return ResponseEntity.status(403).body(Map.of("message",e.getMessage()));}}

    @PostMapping({"/home/api/emission-projects/{id}/activity-requests","/en/home/api/emission-projects/{id}/activity-requests"})
    public ResponseEntity<?> createActivityRequest(@PathVariable String id,@RequestBody Map<String,Object> body,HttpServletRequest request){var c=currentUserContextService.resolve(request);try{return ResponseEntity.ok(service.createActivityRequest(id,tenant(c),c.getUserId(),c.isWebmaster(),body));}catch(SecurityException e){return ResponseEntity.status(403).body(Map.of("message",e.getMessage()));}catch(Exception e){return ResponseEntity.badRequest().body(Map.of("message",e.getMessage()));}}

    @PostMapping({"/home/api/emission-projects/{id}/activity-requests/{requestId}/start","/en/home/api/emission-projects/{id}/activity-requests/{requestId}/start"})
    public ResponseEntity<?> startActivityRequest(@PathVariable String id,@PathVariable long requestId,HttpServletRequest request){var c=currentUserContextService.resolve(request);try{return ResponseEntity.ok(service.startActivityRequest(id,requestId,tenant(c),c.getUserId(),c.isWebmaster()));}catch(SecurityException e){return ResponseEntity.status(403).body(Map.of("message",e.getMessage()));}catch(IllegalStateException e){return ResponseEntity.status(409).body(Map.of("message",e.getMessage()));}}

    @GetMapping({"/home/api/emission-projects/{id}/review-workflow","/en/home/api/emission-projects/{id}/review-workflow"})
    public ResponseEntity<?> reviewWorkflow(@PathVariable String id,HttpServletRequest request) {var context=currentUserContextService.resolve(request);try{return ResponseEntity.ok(service.reviewWorkflow(id,tenant(context)));}catch(SecurityException e){return ResponseEntity.status(403).body(Map.of("message",e.getMessage()));}}

    @PostMapping({"/home/api/emission-projects/{id}/submissions/{submissionId}/verification/start","/en/home/api/emission-projects/{id}/submissions/{submissionId}/verification/start"})
    public ResponseEntity<?> startVerification(@PathVariable String id,@PathVariable long submissionId,HttpServletRequest request) {var context=currentUserContextService.resolve(request);try{return ResponseEntity.ok(service.startVerification(id,submissionId,tenant(context),context.getUserId(),context.isWebmaster()));}catch(SecurityException e){return ResponseEntity.status(403).body(Map.of("message",e.getMessage()));}catch(IllegalStateException e){return ResponseEntity.status(409).body(Map.of("message",e.getMessage()));}catch(Exception e){return ResponseEntity.badRequest().body(Map.of("message",e.getMessage()));}}

    @PostMapping({"/home/api/emission-projects/{id}/submissions/{submissionId}/verification/decision","/en/home/api/emission-projects/{id}/submissions/{submissionId}/verification/decision"})
    public ResponseEntity<?> decideVerification(@PathVariable String id,@PathVariable long submissionId,@RequestBody Map<String,Object> body,HttpServletRequest request) {var context=currentUserContextService.resolve(request);try{return ResponseEntity.ok(service.decideVerification(id,submissionId,tenant(context),context.getUserId(),context.isWebmaster(),body));}catch(SecurityException e){return ResponseEntity.status(403).body(Map.of("message",e.getMessage()));}catch(IllegalStateException e){return ResponseEntity.status(409).body(Map.of("message",e.getMessage()));}catch(Exception e){return ResponseEntity.badRequest().body(Map.of("message",e.getMessage()));}}

    @PostMapping({"/home/api/emission-projects/{id}/submissions/{submissionId}/approval/decision","/en/home/api/emission-projects/{id}/submissions/{submissionId}/approval/decision"})
    public ResponseEntity<?> decideApproval(@PathVariable String id,@PathVariable long submissionId,@RequestBody Map<String,Object> body,HttpServletRequest request) {var context=currentUserContextService.resolve(request);try{return ResponseEntity.ok(service.decideApproval(id,submissionId,tenant(context),context.getUserId(),context.isWebmaster(),body));}catch(SecurityException e){return ResponseEntity.status(403).body(Map.of("message",e.getMessage()));}catch(IllegalStateException e){return ResponseEntity.status(409).body(Map.of("message",e.getMessage()));}catch(Exception e){return ResponseEntity.badRequest().body(Map.of("message",e.getMessage()));}}

    @GetMapping({"/home/api/emission-projects/{id}/reports","/en/home/api/emission-projects/{id}/reports"})
    public ResponseEntity<?> reports(@PathVariable String id,HttpServletRequest request) {var context=currentUserContextService.resolve(request);try{return ResponseEntity.ok(service.reportWorkflow(id,tenant(context)));}catch(SecurityException e){return ResponseEntity.status(403).body(Map.of("message",e.getMessage()));}}

    @PostMapping({"/home/api/emission-projects/{id}/reports","/en/home/api/emission-projects/{id}/reports"})
    public ResponseEntity<?> createReport(@PathVariable String id,@RequestBody Map<String,Object> body,HttpServletRequest request) {var context=currentUserContextService.resolve(request);try{return ResponseEntity.ok(service.createReport(id,tenant(context),context.getUserId(),context.isWebmaster(),body));}catch(SecurityException e){return ResponseEntity.status(403).body(Map.of("message",e.getMessage()));}catch(IllegalStateException e){return ResponseEntity.status(409).body(Map.of("message",e.getMessage()));}catch(Exception e){return ResponseEntity.badRequest().body(Map.of("message",e.getMessage()));}}

    @PostMapping({"/home/api/emission-projects/{id}/reports/{reportId}/finalize","/en/home/api/emission-projects/{id}/reports/{reportId}/finalize"})
    public ResponseEntity<?> finalizeReport(@PathVariable String id,@PathVariable long reportId,HttpServletRequest request) {var context=currentUserContextService.resolve(request);try{return ResponseEntity.ok(service.finalizeReport(id,reportId,tenant(context),context.getUserId(),context.isWebmaster()));}catch(SecurityException e){return ResponseEntity.status(403).body(Map.of("message",e.getMessage()));}catch(IllegalStateException e){return ResponseEntity.status(409).body(Map.of("message",e.getMessage()));}catch(Exception e){return ResponseEntity.badRequest().body(Map.of("message",e.getMessage()));}}

    @PostMapping({"/home/api/emission-projects/{id}/reports/{reportId}/issue","/en/home/api/emission-projects/{id}/reports/{reportId}/issue"})
    public ResponseEntity<?> issueReport(@PathVariable String id,@PathVariable long reportId,HttpServletRequest request) {var context=currentUserContextService.resolve(request);try{return ResponseEntity.ok(service.issueReportCertificate(id,reportId,tenant(context),context.getUserId(),context.isWebmaster()));}catch(SecurityException e){return ResponseEntity.status(403).body(Map.of("message",e.getMessage()));}catch(IllegalStateException e){return ResponseEntity.status(409).body(Map.of("message",e.getMessage()));}catch(Exception e){return ResponseEntity.badRequest().body(Map.of("message",e.getMessage()));}}

    @PostMapping({"/home/api/emission-projects/{id}/reports/{reportId}/download","/en/home/api/emission-projects/{id}/reports/{reportId}/download"})
    public ResponseEntity<?> recordDownload(@PathVariable String id,@PathVariable long reportId,HttpServletRequest request) {var context=currentUserContextService.resolve(request);try{service.recordReportDownload(id,reportId,tenant(context),context.getUserId(),request.getRemoteAddr(),request.getHeader("User-Agent"));return ResponseEntity.ok(Map.of("success",true));}catch(Exception e){return ResponseEntity.badRequest().body(Map.of("message",e.getMessage()));}}

    @GetMapping({"/home/api/report-access-history","/en/home/api/report-access-history"})
    public ResponseEntity<?> accessHistory(HttpServletRequest request){var c=currentUserContextService.resolve(request);return ResponseEntity.ok(service.reportAccessHistory(tenant(c),c.getUserId(),false));}

    @GetMapping({"/home/api/emission-projects/{id}/completion","/en/home/api/emission-projects/{id}/completion"})
    public ResponseEntity<?> completion(@PathVariable String id,HttpServletRequest request){var c=currentUserContextService.resolve(request);try{return ResponseEntity.ok(service.projectCompletion(id,tenant(c)));}catch(Exception e){return ResponseEntity.badRequest().body(Map.of("message",e.getMessage()));}}

    @GetMapping({"/home/api/emission-projects/{id}/calculation","/en/home/api/emission-projects/{id}/calculation"})
    public ResponseEntity<?> calculation(@PathVariable String id,HttpServletRequest request) {var c=currentUserContextService.resolve(request);try{return ResponseEntity.ok(service.calculationResult(id,tenant(c)));}catch(SecurityException e){return ResponseEntity.status(403).body(Map.of("message",e.getMessage()));}catch(Exception e){return ResponseEntity.badRequest().body(Map.of("message",e.getMessage()));} }

    @PostMapping({"/home/api/emission-projects/{id}/calculation","/en/home/api/emission-projects/{id}/calculation"})
    public ResponseEntity<?> calculate(@PathVariable String id,HttpServletRequest request) {var c=currentUserContextService.resolve(request);try{return ResponseEntity.ok(Map.of("success",true,"id",service.calculate(id,tenant(c),c.getUserId(),c.isWebmaster())));}catch(SecurityException e){return ResponseEntity.status(403).body(Map.of("message",e.getMessage()));}catch(IllegalStateException e){return ResponseEntity.status(409).body(Map.of("message",e.getMessage()));}catch(Exception e){return ResponseEntity.badRequest().body(Map.of("message",e.getMessage()));} }

    @GetMapping({"/home/api/emission-tasks","/en/home/api/emission-tasks"})
    public ResponseEntity<?> myTasks(@RequestParam(defaultValue="") String status,@RequestParam(defaultValue="") String period,HttpServletRequest request) { var context=currentUserContextService.resolve(request);if(!context.isAuthenticated())return ResponseEntity.status(401).body(Map.of("message","로그인이 필요합니다."));return ResponseEntity.ok(service.myTasks(tenant(context),context.getUserId(),context.isWebmaster(),status,period)); }

    @PostMapping({"/home/api/emission-tasks/{taskId}/status","/en/home/api/emission-tasks/{taskId}/status"})
    public ResponseEntity<?> updateTask(@PathVariable long taskId,@RequestBody Map<String,Object> body,HttpServletRequest request) {var context=currentUserContextService.resolve(request);if(!context.isAuthenticated())return ResponseEntity.status(401).body(Map.of("message","로그인이 필요합니다."));try{return ResponseEntity.ok(Map.of("success",service.updateTask(taskId,tenant(context),String.valueOf(body.get("status")),context.getUserId(),context.isWebmaster())>0));}catch(SecurityException e){return ResponseEntity.status(403).body(Map.of("message",e.getMessage()));}catch(IllegalStateException e){return ResponseEntity.status(409).body(Map.of("message",e.getMessage()));}catch(Exception e){return ResponseEntity.badRequest().body(Map.of("message",e.getMessage()));}}

    @PostMapping({"/home/api/emission-task-notifications/{notificationId}/read","/en/home/api/emission-task-notifications/{notificationId}/read"})
    public ResponseEntity<?> readTaskNotification(@PathVariable long notificationId,HttpServletRequest request) {var context=currentUserContextService.resolve(request);if(!context.isAuthenticated())return ResponseEntity.status(401).body(Map.of("message","로그인이 필요합니다."));return ResponseEntity.ok(Map.of("success",service.readWorkflowNotification(notificationId,tenant(context),context.getUserId(),context.isWebmaster())>0));}

    @PostMapping({"/home/api/emission-projects", "/en/home/api/emission-projects"})
    public ResponseEntity<?> create(@RequestBody Map<String, Object> body, HttpServletRequest request) {
        var context=currentUserContextService.resolve(request);
        if (!context.isAuthenticated()) return ResponseEntity.status(401).body(Map.of("message", "로그인이 필요합니다."));
        if(!context.isWebmaster()&&!context.getUserId().equalsIgnoreCase(String.valueOf(body.getOrDefault("owner","")))) return ResponseEntity.status(403).body(Map.of("message","PROJECT_OWNER_MUST_BE_CURRENT_USER"));
        try { String id=service.create(tenant(context),body); return ResponseEntity.ok(service.creationResult(id,tenant(context))); }
        catch (IllegalArgumentException e) { return ResponseEntity.badRequest().body(Map.of("message", e.getMessage())); }
    }

    @DeleteMapping({"/home/api/emission-projects/{id}", "/en/home/api/emission-projects/{id}"})
    public ResponseEntity<?> delete(@PathVariable String id, HttpServletRequest request) {
        if (!authenticated(request)) return ResponseEntity.status(401).body(Map.of("message", "로그인이 필요합니다."));
        var context=currentUserContextService.resolve(request);
        try { return ResponseEntity.ok(Map.of("success",service.delete(id,tenant(context),context.getUserId(),context.isWebmaster())>0)); }
        catch(SecurityException e) { return ResponseEntity.status(403).body(Map.of("success",false,"message",e.getMessage())); }
    }

    private boolean authenticated(HttpServletRequest request) {
        if (request.getCookies() == null) return false;
        for (var cookie : request.getCookies()) if ("accessToken".equals(cookie.getName()) && !cookie.getValue().isBlank()) return true;
        return false;
    }
    private String tenant(CurrentUserContextService.CurrentUserContext context) {
        // Keep project creation and the admin site registry on one source of
        // truth even while a development actor simulation is active.
        if (context.isWebmaster()) return "DEFAULT";
        return context.getInsttId().isBlank()?"DEFAULT":context.getInsttId();
    }

    @ModelAttribute
    public void enforceAuthenticatedTenant(HttpServletRequest request) {
        var context=currentUserContextService.resolve(request);
        if(!context.isAuthenticated()) throw new ResponseStatusException(HttpStatus.UNAUTHORIZED,"AUTHENTICATION_REQUIRED");
        String uri=request.getRequestURI();
        int marker=uri.indexOf("/emission-projects/");
        if(marker<0) return;
        String remainder=uri.substring(marker+"/emission-projects/".length());
        String projectId=remainder.split("/",2)[0];
        if(projectId.isBlank()||"options".equals(projectId)||"name-availability".equals(projectId)) return;
        try { service.assertProjectParticipant(projectId,tenant(context),context.getUserId(),context.isWebmaster()); }
        catch(SecurityException e) { throw new ResponseStatusException(HttpStatus.FORBIDDEN,e.getMessage()); }
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String,Object>> handleScopedStatus(ResponseStatusException exception) {
        return ResponseEntity.status(exception.getStatusCode()).body(Map.of(
            "success",false,
            "message",exception.getReason()==null?"REQUEST_DENIED":exception.getReason()
        ));
    }
}
