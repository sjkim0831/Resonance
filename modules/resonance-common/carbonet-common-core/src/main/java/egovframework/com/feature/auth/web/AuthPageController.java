package egovframework.com.feature.auth.web;

import egovframework.com.feature.auth.dto.request.LoginRequestDTO;
import egovframework.com.feature.auth.util.JwtTokenProvider;
import egovframework.com.feature.member.service.EnterpriseMemberService;
import egovframework.com.feature.member.model.vo.EntrprsManageVO;
import egovframework.com.feature.home.web.ReactAppViewSupport;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.util.ObjectUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.security.web.savedrequest.DefaultSavedRequest;
import org.springframework.http.ResponseEntity;
import org.springframework.web.util.UriComponentsBuilder;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.servlet.http.HttpSession;
import java.util.HashMap;
import java.util.Map;

@Controller("authPageController")
@RequestMapping({"/signin", "/ko/signin", "/en/signin", "/admin/login", "/en/admin/login"})
@RequiredArgsConstructor
public class AuthPageController {

    private final JwtTokenProvider jwtProvider;
    private final EnterpriseMemberService entrprsManageService;
    private final ReactAppViewSupport reactAppViewSupport;

    @GetMapping(value = "/index")
    public String login(LoginRequestDTO loginVO, Model model, HttpServletRequest request, HttpServletResponse response) {
        return this.loginView(null, loginVO, model, request, response);
    }

    @RequestMapping(value = "/loginView", method = { RequestMethod.GET, RequestMethod.POST })
    public String loginView(@RequestParam(value = "language", required = false) String language, LoginRequestDTO loginVO,
            Model model, HttpServletRequest request, HttpServletResponse response) {
        boolean adminLoginRequest = isAdminLoginRequest(request);
        String resolvedLanguage = resolveLanguage(language, request);
        if (adminLoginRequest && shouldRedirectToCanonicalAdminLogin(request, resolvedLanguage)) {
            return redirectToCanonicalAdminLogin(request, resolvedLanguage, "/loginView");
        }
        if (!adminLoginRequest && shouldRedirectToCanonicalPublicSignin(request, resolvedLanguage)) {
            return redirectToCanonicalSignin(request, resolvedLanguage, "/loginView");
        }
        if (!adminLoginRequest && isAdminMainRequested(request)) {
            // Gateway rewrite 환경에서 /signin/loginView 로 들어와도 admin 화면을 직접 렌더링해 루프 방지
            adminLoginRequest = true;
        }
        String accessToken = jwtProvider.getCookie(request, "accessToken");
        boolean hasValidAccessToken = !ObjectUtils.isEmpty(accessToken) && jwtProvider.accessValidateToken(accessToken) == 200;
        if (!ObjectUtils.isEmpty(accessToken) && !hasValidAccessToken) {
            jwtProvider.deleteCookie(request, response, "accessToken");
            jwtProvider.deleteCookie(request, response, "refreshToken");
            accessToken = "";
        }
        if (ObjectUtils.isEmpty(accessToken) || !hasValidAccessToken) {
            return reactAppViewSupport.render(model, adminLoginRequest ? "admin-login" : "signin-login",
                    "en".equals(resolvedLanguage), adminLoginRequest);
        } else {
            if (adminLoginRequest) {
                return "en".equals(resolvedLanguage) ? "redirect:/en/admin/" : "redirect:/admin/";
            }
            return "en".equals(resolvedLanguage) ? "redirect:/en/home" : "redirect:/home";
        }
    }

    private boolean isAdminMainRequested(HttpServletRequest request) {
        HttpSession session = request.getSession(false);
        if (session != null) {
            Object savedRequest = session.getAttribute("SPRING_SECURITY_SAVED_REQUEST");
            if (savedRequest instanceof DefaultSavedRequest) {
                String redirectUrl = ((DefaultSavedRequest) savedRequest).getRedirectUrl();
                if (!ObjectUtils.isEmpty(redirectUrl) && redirectUrl.contains("/admin")) {
                    return true;
                }
            }
        }

        String referer = request.getHeader("Referer");
        return !ObjectUtils.isEmpty(referer) && referer.contains("/admin");
    }

    private boolean isAdminLoginRequest(HttpServletRequest request) {
        String console = request.getParameter("console");
        if ("admin".equalsIgnoreCase(console)) {
            return true;
        }
        String requestUri = request.getRequestURI();
        if (!ObjectUtils.isEmpty(requestUri) && requestUri.startsWith("/admin/login")) {
            return true;
        }
        String requestUrl = request.getRequestURL() == null ? null : request.getRequestURL().toString();
        if (!ObjectUtils.isEmpty(requestUrl) && requestUrl.contains("/admin/login")) {
            return true;
        }
        String originalUri = request.getHeader("X-Original-Uri");
        if (!ObjectUtils.isEmpty(originalUri) && originalUri.startsWith("/admin/login")) {
            return true;
        }
        String forwardedPrefix = request.getHeader("X-Forwarded-Prefix");
        return !ObjectUtils.isEmpty(forwardedPrefix) && forwardedPrefix.contains("/admin");
    }

    @GetMapping("/authChoice")
    public String authChoice(@RequestParam(value = "language", required = false) String language, Model model,
            HttpServletRequest request) {
        return renderPublicSigninPage(language, model, request, "/authChoice", "signin-auth-choice");
    }

    @GetMapping("/findId")
    public String findId(@RequestParam(value = "language", required = false) String language, Model model,
            HttpServletRequest request) {
        return renderPublicSigninPage(language, model, request, "/findId", "signin-find-id");
    }

    @GetMapping("/findId/overseas")
    public String findIdOverseas(@RequestParam(value = "language", required = false) String language, Model model,
            HttpServletRequest request) {
        return renderPublicSigninPage(language, model, request, "/findId/overseas", "signin-find-id");
    }

    @GetMapping("/findPassword")
    public String findPassword(@RequestParam(value = "language", required = false) String language, Model model,
            HttpServletRequest request) {
        return renderPublicSigninPage(language, model, request, "/findPassword", "signin-find-password");
    }

    @GetMapping("/findPassword/overseas")
    public String findPasswordOverseas(@RequestParam(value = "language", required = false) String language, Model model,
            HttpServletRequest request) {
        return renderPublicSigninPage(language, model, request, "/findPassword/overseas", "signin-find-password");
    }

    @GetMapping("/findPassword/result")
    public String findPasswordResult(@RequestParam(value = "language", required = false) String language, Model model,
            HttpServletRequest request) {
        return renderPublicSigninPage(language, model, request, "/findPassword/result", "signin-find-password-result");
    }

    @GetMapping("/findId/result")
    public String findIdResult(@RequestParam(value = "language", required = false) String language,
            @RequestParam(value = "applcntNm", required = false) String applcntNm,
            @RequestParam(value = "email", required = false) String email,
            @RequestParam(value = "tab", required = false, defaultValue = "domestic") String tab,
            Model model, HttpServletRequest request) {
        return renderPublicSigninPage(language, model, request, "/findId/result", "signin-find-id-result");
    }

    @GetMapping("/api/findId/result")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> findIdResultApi(
            @RequestParam(value = "language", required = false) String language,
            @RequestParam(value = "applcntNm", required = false) String applcntNm,
            @RequestParam(value = "email", required = false) String email,
            @RequestParam(value = "tab", required = false, defaultValue = "domestic") String tab,
            HttpServletRequest request) {
        String resolvedLanguage = resolveLanguage(language, request);
        String normalizedTab = "overseas".equalsIgnoreCase(tab) ? "overseas" : "domestic";

        String foundId = null;
        if (!ObjectUtils.isEmpty(applcntNm) && !ObjectUtils.isEmpty(email)) {
            EntrprsManageVO searchVO = new EntrprsManageVO();
            searchVO.setApplcntNm(applcntNm.trim());
            searchVO.setApplcntEmailAdres(email.trim());
            try {
                foundId = entrprsManageService.selectEntrprsMberIdByNameAndEmail(searchVO);
            } catch (Exception ignored) {
                foundId = null;
            }
        }

        String languagePrefix = "en".equals(resolvedLanguage) ? "/en/signin" : "/signin";
        String passwordResetUrl = "overseas".equals(normalizedTab)
                ? languagePrefix + "/findPassword/overseas"
                : languagePrefix + "/findPassword";

        Map<String, Object> payload = new HashMap<>();
        payload.put("tab", normalizedTab);
        payload.put("found", !ObjectUtils.isEmpty(foundId));
        payload.put("maskedId", maskUserId(foundId));
        payload.put("passwordResetUrl", passwordResetUrl);
        return ResponseEntity.ok(payload);
    }

    private String resolveLanguage(String language, HttpServletRequest request) {
        String requestUri = request.getRequestURI();
        if (!ObjectUtils.isEmpty(requestUri)) {
            if (requestUri.startsWith("/en/signin")) {
                return "en";
            }
            if (requestUri.startsWith("/en/admin/login")) {
                return "en";
            }
            if (requestUri.startsWith("/ko/signin")) {
                return "ko";
            }
        }
        return "en".equalsIgnoreCase(language) ? "en" : "ko";
    }

    private boolean shouldRedirectToCanonicalPublicSignin(HttpServletRequest request, String language) {
        String requestUri = request.getRequestURI();
        if (ObjectUtils.isEmpty(requestUri) || !requestUri.contains("/signin")) {
            return false;
        }
        if (requestUri.startsWith("/ko/signin")) {
            return true;
        }
        return requestUri.startsWith("/signin") && "en".equals(language);
    }

    private boolean shouldRedirectToCanonicalAdminLogin(HttpServletRequest request, String language) {
        String requestUri = request.getRequestURI();
        if (ObjectUtils.isEmpty(requestUri)) {
            return false;
        }
        if (requestUri.startsWith("/en/admin/login")) {
            return !"en".equals(language);
        }
        return requestUri.startsWith("/admin/login") && "en".equals(language);
    }

    private String appendQuery(String base, String query) {
        if (ObjectUtils.isEmpty(query)) {
            return base;
        }
        String separator = base.contains("?") ? "&" : "?";
        return base + separator + query;
    }

    private String redirectToCanonicalAdminLogin(HttpServletRequest request, String language, String path) {
        String prefix = "en".equals(language) ? "/en/admin/login" : "/admin/login";
        UriComponentsBuilder builder = UriComponentsBuilder.fromPath(prefix + path);
        for (Map.Entry<String, String[]> entry : request.getParameterMap().entrySet()) {
            if ("language".equals(entry.getKey())) {
                continue;
            }
            for (String value : entry.getValue()) {
                builder.queryParam(entry.getKey(), value);
            }
        }
        return "redirect:" + builder.build().encode().toUriString();
    }

    private String redirectToCanonicalSignin(HttpServletRequest request, String language, String path) {
        String prefix = "en".equals(language) ? "/en/signin" : "/signin";
        UriComponentsBuilder builder = UriComponentsBuilder.fromPath(prefix + path);
        for (Map.Entry<String, String[]> entry : request.getParameterMap().entrySet()) {
            if ("language".equals(entry.getKey())) {
                continue;
            }
            for (String value : entry.getValue()) {
                builder.queryParam(entry.getKey(), value);
            }
        }
        return "redirect:" + builder.build().encode().toUriString();
    }

    private String renderPublicSigninPage(
            String language,
            Model model,
            HttpServletRequest request,
            String canonicalPath,
            String routeId) {
        String resolvedLanguage = resolveLanguage(language, request);
        if (shouldRedirectToCanonicalPublicSignin(request, resolvedLanguage)) {
            return redirectToCanonicalSignin(request, resolvedLanguage, canonicalPath);
        }
        return reactAppViewSupport.render(model, routeId, "en".equals(resolvedLanguage), false);
    }

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }

    private String maskUserId(String userId) {
        if (ObjectUtils.isEmpty(userId)) {
            return null;
        }
        String id = userId.trim();
        if (id.isEmpty()) {
            return null;
        }
        if (id.length() <= 2) {
            return id.charAt(0) + "*";
        }
        if (id.length() <= 4) {
            return id.substring(0, 1) + "**" + id.substring(id.length() - 1);
        }
        return id.substring(0, 3) + "****" + id.substring(id.length() - 2);
    }

    @RequestMapping(value = "/loginForbidden", method = { RequestMethod.GET, RequestMethod.POST })
    public String loginForbidden(
            @RequestParam(value = "language", required = false) String language,
            @RequestParam(value = "pathCode", required = false, defaultValue = "1") String pathCode,
            Model model,
            HttpServletRequest request) {
        model.addAttribute("pathCode", pathCode);
        return renderPublicSigninPage(language, model, request, "/loginForbidden", "signin-forbidden");
    }

}
