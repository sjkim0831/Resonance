package egovframework.com.web;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/actuator/p006/auth")
public class P006ProjectAuthController {
    private final JdbcTemplate jdbc;
    private final BCryptPasswordEncoder passwords = new BCryptPasswordEncoder(12);
    private final SecureRandom random = new SecureRandom();

    public P006ProjectAuthController(JdbcTemplate jdbc) { this.jdbc = jdbc; }

    @GetMapping("/session")
    public Map<String,Object> session(HttpServletRequest request) {
        int accounts = jdbc.queryForObject("select count(*) from dt_project_account", Integer.class);
        String token = cookie(request, "P006_SESSION");
        if (token.isBlank()) return Map.of("authenticated",false,"bootstrapRequired",accounts==0);
        var rows = jdbc.query("select a.account_id,a.login_id,a.display_name from dt_project_session s join dt_project_account a on a.account_id=s.account_id where s.session_hash=? and s.expires_at>current_timestamp and a.status='ACTIVE'", (rs,n)->Map.of("accountId",rs.getString(1),"loginId",rs.getString(2),"displayName",rs.getString(3)), sha256(token));
        return rows.isEmpty()?Map.of("authenticated",false,"bootstrapRequired",accounts==0):Map.of("authenticated",true,"bootstrapRequired",false,"accountId",rows.get(0).get("accountId"),"loginId",rows.get(0).get("loginId"),"displayName",rows.get(0).get("displayName"));
    }

    @PostMapping("/bootstrap") @Transactional
    public ResponseEntity<?> bootstrap(@RequestBody Login command, HttpServletResponse response) {
        Integer count=jdbc.queryForObject("select count(*) from dt_project_account",Integer.class);
        if(count!=null&&count>0)return ResponseEntity.status(HttpStatus.CONFLICT).body(Map.of("message","초기 관리자가 이미 존재합니다."));
        validate(command,true);String id=UUID.randomUUID().toString();
        jdbc.update("insert into dt_project_account(account_id,login_id,password_hash,display_name) values (?,?,?,?)",id,command.loginId().trim(),passwords.encode(command.password()),command.displayName().trim());
        jdbc.update("insert into dt_account_role(account_id,role_code) values (?,'PROJECT_ADMIN')",id);
        return createSession(id,response);
    }

    @PostMapping("/login") @Transactional
    public ResponseEntity<?> login(@RequestBody Login command,HttpServletResponse response) {
        validate(command,false);var rows=jdbc.query("select account_id,password_hash from dt_project_account where login_id=? and status='ACTIVE'",(rs,n)->Map.of("id",rs.getString(1),"hash",rs.getString(2)),command.loginId().trim());
        if(rows.isEmpty()||!passwords.matches(command.password(),rows.get(0).get("hash")))return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("message","로그인 정보가 올바르지 않습니다."));
        return createSession(rows.get(0).get("id"),response);
    }

    @PostMapping("/logout") @Transactional
    public ResponseEntity<?> logout(HttpServletRequest request,HttpServletResponse response){String token=cookie(request,"P006_SESSION");if(!token.isBlank())jdbc.update("delete from dt_project_session where session_hash=?",sha256(token));response.addHeader(HttpHeaders.SET_COOKIE,"P006_SESSION=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0");return ResponseEntity.ok(Map.of("status","LOGGED_OUT"));}

    private ResponseEntity<?> createSession(String accountId,HttpServletResponse response){byte[] bytes=new byte[32];random.nextBytes(bytes);String token=Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);jdbc.update("delete from dt_project_session where expires_at<=current_timestamp");jdbc.update("insert into dt_project_session(session_hash,account_id,expires_at) values (?,?,current_timestamp+interval '8 hours')",sha256(token),accountId);response.addHeader(HttpHeaders.SET_COOKIE,"P006_SESSION="+token+"; Path=/; HttpOnly; SameSite=Lax; Max-Age="+Duration.ofHours(8).toSeconds());return ResponseEntity.ok(Map.of("status","AUTHENTICATED"));}
    private void validate(Login c,boolean display){if(c.loginId()==null||c.loginId().trim().length()<4||c.password()==null||c.password().isEmpty()||(display&&(c.password().length()<10||c.displayName()==null||c.displayName().isBlank())))throw new IllegalArgumentException(display?"ID 4자, 비밀번호 10자 이상을 입력하세요.":"로그인 ID와 비밀번호를 입력하세요.");}
    private String cookie(HttpServletRequest r,String n){if(r.getCookies()==null)return "";for(var c:r.getCookies())if(n.equals(c.getName()))return c.getValue();return "";}
    private String sha256(String v){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(v.getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException(e);}}
    public record Login(String loginId,String password,String displayName){}
    @ExceptionHandler(IllegalArgumentException.class) public ResponseEntity<?> invalid(IllegalArgumentException e){return ResponseEntity.badRequest().body(Map.of("message",e.getMessage()));}
}
