package egovframework.com.platform.governance.web;

import egovframework.com.feature.auth.service.CurrentUserContextService;
import egovframework.com.platform.governance.service.ActorProcessGovernanceService;
import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Locale;
import java.util.Map;
import java.util.Set;

@RestController
@RequiredArgsConstructor
@RequestMapping({"/home/api/screen-context","/en/home/api/screen-context"})
public class ScreenContextApiController {
    private static final Set<String> ADMIN_AUTHOR_CODES=Set.of(
        "SYSTEM_MASTER","SYSTEM_ADMIN","ADMIN","OPERATION_ADMIN");
    private final ActorProcessGovernanceService service;
    private final CurrentUserContextService currentUserContextService;

    @GetMapping
    public ResponseEntity<?> find(@RequestParam(defaultValue="") String routePath,
                                  @RequestParam(defaultValue="") String pageId,
                                  @RequestParam(defaultValue="") String projectId,
                                  @RequestParam(defaultValue="") String processCode,
                                  @RequestParam(defaultValue="") String stepCode,
                                  @RequestParam(defaultValue="") String actorCode,
                                  @RequestParam(defaultValue="") String audience,
                                  @RequestParam(defaultValue="") String capabilityCode,
                                  HttpServletRequest request){
        try{
            var context=currentUserContextService.resolve(request);
            String requestedAudience=audience==null?"":audience.trim().toUpperCase(Locale.ROOT);
            if(!context.isAuthenticated()){
                if(isAnonymousPublicJoinRequest(routePath,requestedAudience)){
                    return ResponseEntity.ok(service.screenContext(
                        routePath,pageId,"",processCode,stepCode,actorCode,"PUBLIC",capabilityCode,
                        Set.of("PUBLIC"),"","",true));
                }
                return ResponseEntity.status(401).body(Map.of("success",false,"message","AUTHENTICATION_REQUIRED"));
            }
            boolean adminAudienceAllowed=canReadAdminAudience(context);
            if("ADMIN".equals(requestedAudience)&&!adminAudienceAllowed){
                return ResponseEntity.status(403).body(Map.of(
                    "success",false,"message","SCREEN_CONTEXT_AUDIENCE_FORBIDDEN"));
            }
            Set<String> allowedAudiences=adminAudienceAllowed
                ?Set.of("USER","PUBLIC","ADMIN"):Set.of("USER","PUBLIC");
            return ResponseEntity.ok(service.screenContext(
                routePath,pageId,projectId,processCode,stepCode,actorCode,audience,capabilityCode,allowedAudiences,
                context.getUserId(),context.getInsttId(),adminAudienceAllowed));
        }catch(SecurityException ignored){
            return ResponseEntity.status(403).body(Map.of("success",false,"message","SCREEN_CONTEXT_ACTOR_FORBIDDEN"));
        }catch(Exception ignored){
            return ResponseEntity.internalServerError().body(Map.of(
                "success",false,"message","SCREEN_CONTEXT_RESOLUTION_FAILED"));
        }
    }

    private boolean canReadAdminAudience(CurrentUserContextService.CurrentUserContext context){
        if(context.isWebmaster())return true;
        String author=context.getAuthorCode()==null?"":context.getAuthorCode().trim().toUpperCase(Locale.ROOT);
        if(author.startsWith("ROLE_"))author=author.substring("ROLE_".length());
        return ADMIN_AUTHOR_CODES.contains(author);
    }

    static boolean isAnonymousPublicJoinRequest(String routePath,String audience){
        if(!"PUBLIC".equalsIgnoreCase(audience))return false;
        String route=routePath==null?"":routePath.trim().split("\\?",2)[0].toLowerCase(Locale.ROOT);
        String canonicalRoute=route.startsWith("/en/")?route.substring(3):route;
        if(!canonicalRoute.startsWith("/join/"))return false;
        return Set.of("/login","/signin","/find","/password","/print").stream()
            .noneMatch(canonicalRoute::contains);
    }
}
