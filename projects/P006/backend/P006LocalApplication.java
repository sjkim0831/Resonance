package p006.local;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.SpringBootConfiguration;
import org.springframework.boot.autoconfigure.EnableAutoConfiguration;
import org.springframework.context.annotation.Import;
import org.springframework.context.annotation.Bean;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import jakarta.servlet.Filter;
@SpringBootConfiguration
@EnableAutoConfiguration(excludeName={"org.springframework.boot.autoconfigure.security.servlet.SecurityAutoConfiguration","org.springframework.boot.autoconfigure.security.servlet.UserDetailsServiceAutoConfiguration","org.springframework.boot.actuate.autoconfigure.security.servlet.ManagementWebSecurityAutoConfiguration","org.springframework.boot.autoconfigure.session.SessionAutoConfiguration","org.springframework.boot.autoconfigure.orm.jpa.HibernateJpaAutoConfiguration"})
@Import({egovframework.com.web.P006ProjectAuthController.class,egovframework.com.web.P006FactorySceneController.class})
public class P006LocalApplication {
 public static void main(String[] args){SpringApplication.run(P006LocalApplication.class,args);}
 @Bean public FilterRegistrationBean<Filter> bootstrapGuard(){
  var bean=new FilterRegistrationBean<Filter>();
  bean.setFilter((request,response,chain)->{
   var req=(jakarta.servlet.http.HttpServletRequest)request;
   var res=(jakarta.servlet.http.HttpServletResponse)response;
   if(req.getRequestURI().equals("/actuator/p006/auth/bootstrap") && !java.util.Objects.equals(System.getenv("P006_BOOTSTRAP_TOKEN"),req.getHeader("X-P006-Bootstrap-Token"))){res.sendError(403);return;}
   chain.doFilter(request,response);
  });bean.setOrder(-100);return bean;
 }
}
