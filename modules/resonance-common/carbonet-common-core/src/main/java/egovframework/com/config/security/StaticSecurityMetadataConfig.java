package egovframework.com.config.security;

import org.egovframe.boot.security.bean.EgovReloadableFilterInvocationSecurityMetadataSource;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.access.ConfigAttribute;
import org.springframework.security.access.SecurityConfig;
import org.springframework.security.web.util.matcher.AntPathRequestMatcher;
import org.springframework.security.web.util.matcher.RequestMatcher;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;

@Configuration
public class StaticSecurityMetadataConfig {

    @Bean(name = "databaseSecurityMetadataSource")
    public EgovReloadableFilterInvocationSecurityMetadataSource databaseSecurityMetadataSource() {
        LinkedHashMap<RequestMatcher, Collection<ConfigAttribute>> requestMap = new LinkedHashMap<>();

        register(requestMap, "/uat/uia/**", "ROLE_ANONYMOUS");
        register(requestMap, "/uat/uap/**", "ROLE_ADMIN");
        register(requestMap, "/sec/ram/**", "ROLE_ADMIN");
        register(requestMap, "/sec/rgm/**", "ROLE_ADMIN");
        register(requestMap, "/sec/gmt/**", "ROLE_ADMIN");
        register(requestMap, "/sec/rmt/**", "ROLE_ADMIN");
        register(requestMap, "/mip/**", "ROLE_USER");
        register(requestMap, "/cop/bls/**", "ROLE_USER");
        register(requestMap, "/cop/bbs/**", "ROLE_USER");
        register(requestMap, "/cop/brd/**", "ROLE_USER");
        register(requestMap, "/cop/cmy/**", "ROLE_USER");
        register(requestMap, "/uss/olp/qmc/**", "ROLE_ADMIN");
        register(requestMap, "/uss/olp/qri/**", "ROLE_USER");
        register(requestMap, "/uss/olp/qtm/**", "ROLE_ADMIN");
        register(requestMap, "/uss/olp/qrm/**", "ROLE_ADMIN");
        register(requestMap, "/uss/olp/qqm/**", "ROLE_ADMIN");
        register(requestMap, "/uss/olp/qim/**", "ROLE_ADMIN");
        register(requestMap, "/sym/ccm/ccc/**", "ROLE_ADMIN");
        register(requestMap, "/sym/ccm/cde/**", "ROLE_ADMIN");
        register(requestMap, "/sym/ccm/cca/**", "ROLE_ADMIN");
        register(requestMap, "/ext/ops/**", "ROLE_USER");
        register(requestMap, "/adminmain/**", "ROLE_ADMIN");

        return new EgovReloadableFilterInvocationSecurityMetadataSource(requestMap);
    }

    private void register(
            LinkedHashMap<RequestMatcher, Collection<ConfigAttribute>> requestMap,
            String pattern,
            String authority
    ) {
        requestMap.put(new AntPathRequestMatcher(pattern), SecurityConfig.createList(authority));
    }
}
