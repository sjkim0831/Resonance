package egovframework.com.feature.member.web;
import egovframework.com.feature.home.web.ReactAppViewSupport;
import egovframework.com.feature.member.service.CompanyMemberInvitationService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.*;
import jakarta.servlet.http.HttpServletRequest;
import java.security.Principal;
import java.util.*;

@Controller @RequiredArgsConstructor
public class CompanyMemberInvitationController {
 private final CompanyMemberInvitationService service; private final ReactAppViewSupport view;
 @GetMapping({"/join/companyMemberInvite","/join/en/companyMemberInvite"}) public String page(Model m,HttpServletRequest r){return view.render(m,"join-company-member-invite",r.getRequestURI().contains("/en/"),false);}
 @GetMapping("/join/api/company-member-invitation") @ResponseBody public ResponseEntity<Map<String,Object>> inspect(@RequestParam String token){Map<String,Object>b=service.inspect(token);return ResponseEntity.status(Boolean.TRUE.equals(b.get("success"))?200:400).body(b);}
 @PostMapping("/join/api/company-member-invitation/activate") @ResponseBody public ResponseEntity<Map<String,Object>> activate(@RequestBody Map<String,Object>p){try{return ResponseEntity.ok(service.activate(t(p,"token"),t(p,"insttId"),t(p,"accountId"),t(p,"password"),t(p,"userName")));}catch(SecurityException e){return err(403,e.getMessage());}catch(org.springframework.dao.DuplicateKeyException e){return err(409,e.getMessage());}catch(IllegalArgumentException e){return err(400,e.getMessage());}catch(IllegalStateException e){return err(410,e.getMessage());}}
 @GetMapping("/api/company-member-invitations/context") @ResponseBody public ResponseEntity<Map<String,Object>> context(Principal p){try{return ResponseEntity.ok(service.context(p==null?"":p.getName()));}catch(SecurityException e){return err(403,e.getMessage());}}
 @PostMapping("/api/company-member-invitations") @ResponseBody public ResponseEntity<Map<String,Object>> issue(Principal principal,@RequestBody Map<String,Object>p){try{return ResponseEntity.ok(service.issue(principal==null?"":principal.getName(),t(p,"email"),t(p,"memberName"),t(p,"actorCode")));}catch(SecurityException e){return err(403,e.getMessage());}catch(IllegalArgumentException e){return err(400,e.getMessage());}}
 private String t(Map<String,Object>p,String k){Object v=p==null?null:p.get(k);return v==null?"":String.valueOf(v).trim();}private ResponseEntity<Map<String,Object>> err(int s,String msg){Map<String,Object>b=new LinkedHashMap<>();b.put("success",false);b.put("message",msg);return ResponseEntity.status(s).body(b);}
}
