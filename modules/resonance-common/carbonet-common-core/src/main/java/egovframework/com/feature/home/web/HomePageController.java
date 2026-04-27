package egovframework.com.feature.home.web;

import egovframework.com.platform.bootstrap.service.AdminShellBootstrapPageService;
import egovframework.com.feature.home.service.HomeMenuService;
import egovframework.com.feature.home.service.HomeMypageService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Controller;
import org.springframework.ui.Model;
import org.springframework.web.bind.annotation.CookieValue;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.http.ResponseEntity;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.util.Locale;
import java.util.List;
import java.util.Map;

@Controller
@RequiredArgsConstructor
public class HomePageController {

    private final AdminShellBootstrapPageService adminShellBootstrapPageService;
    private final HomeMenuService homeMenuService;
    private final HomeMypageService homeMypageService;
    private final ReactAppViewSupport reactAppViewSupport;

    @RequestMapping(value = { "/" }, method = { RequestMethod.GET, RequestMethod.POST })
    public String root() {
        return "redirect:/home";
    }

    @RequestMapping(value = { "/home", "/en/home" }, method = { RequestMethod.GET, RequestMethod.POST })
    public String index(HttpServletRequest request, Model model) {
        return reactAppViewSupport.render(model, "home", isEnglishRequest(request), false);
    }

    @RequestMapping(value = { "/ko/home" }, method = { RequestMethod.GET, RequestMethod.POST })
    public String legacyKoHome() {
        return "redirect:/home";
    }

    @RequestMapping(value = { "/home/en" }, method = { RequestMethod.GET, RequestMethod.POST })
    public String legacyHomeEn() {
        return "redirect:/en/home";
    }

    @GetMapping({ "/api/home", "/api/en/home" })
    @ResponseBody
    public ResponseEntity<Map<String, Object>> homeApi(
            @CookieValue(value = "accessToken", required = false) String accessToken,
            HttpServletRequest request) {
        boolean english = isEnglishRequest(request);
        return ResponseEntity.ok(Map.of(
                "isLoggedIn", accessToken != null,
                "isEn", english,
                "homeMenu", homeMenuService.getHomeMenu(english)));
    }

    @RequestMapping(value = { "/mypage" }, method = { RequestMethod.GET, RequestMethod.POST })
    public String mypage() {
        return "redirect:/mypage/profile";
    }

    @RequestMapping(value = { "/ko/mypage" }, method = { RequestMethod.GET, RequestMethod.POST })
    public String legacyKoMypage() {
        return "redirect:/mypage/profile";
    }

    @RequestMapping(value = { "/mypage/index", "/ko/mypage/index" }, method = { RequestMethod.GET, RequestMethod.POST })
    public String legacyMypageIndex() {
        return "redirect:/mypage/profile";
    }

    @RequestMapping(value = { "/mypage/en" }, method = { RequestMethod.GET, RequestMethod.POST })
    public String legacyMypageEn() {
        return "redirect:/en/mypage/profile";
    }

    @RequestMapping(value = { "/en/mypage/index", "/mypage/index/en" }, method = { RequestMethod.GET, RequestMethod.POST })
    public String legacyMypageIndexEn() {
        return "redirect:/en/mypage/profile";
    }

    @RequestMapping(value = { "/en/mypage" }, method = { RequestMethod.GET, RequestMethod.POST })
    public String mypageEn() {
        return "redirect:/en/mypage/profile";
    }

    @GetMapping({ "/trade/list/page-data", "/en/trade/list/page-data" })
    @ResponseBody
    public ResponseEntity<Map<String, Object>> tradeListPageData(
            @RequestParam(value = "pageIndex", required = false) String pageIndexParam,
            @RequestParam(value = "searchKeyword", required = false) String searchKeyword,
            @RequestParam(value = "tradeStatus", required = false) String tradeStatus,
            @RequestParam(value = "settlementStatus", required = false) String settlementStatus,
            HttpServletRequest request) {
        return ResponseEntity.ok(adminShellBootstrapPageService.buildTradeListPageData(
                pageIndexParam,
                searchKeyword,
                tradeStatus,
                settlementStatus,
                isEnglishRequest(request)));
    }

    @GetMapping({ "/api/mypage/context", "/api/en/mypage/context" })
    @ResponseBody
    public ResponseEntity<Map<String, Object>> mypageContextApi(HttpServletRequest request) {
        return mypageResponse(homeMypageService.buildMypageContext(isEnglishRequest(request), request));
    }

    @GetMapping({ "/api/mypage", "/api/en/mypage" })
    @ResponseBody
    public ResponseEntity<Map<String, Object>> mypageApi(HttpServletRequest request) {
        return mypageResponse(homeMypageService.buildMypagePayload(isEnglishRequest(request), request));
    }

    @GetMapping({ "/api/mypage/section/{section}", "/api/en/mypage/section/{section}" })
    @ResponseBody
    public ResponseEntity<Map<String, Object>> mypageSectionApi(@PathVariable("section") String section,
            HttpServletRequest request) {
        return mypageResponse(homeMypageService.buildMypageSectionPayload(isEnglishRequest(request), section, request));
    }

    @PostMapping({ "/api/mypage/profile", "/api/en/mypage/profile" })
    @ResponseBody
    public ResponseEntity<Map<String, Object>> updateMypageProfile(
            @RequestParam(value = "zip", required = false) String zip,
            @RequestParam(value = "address", required = false) String address,
            @RequestParam(value = "detailAddress", required = false) String detailAddress,
            HttpServletRequest request) {
        return mypageResponse(homeMypageService.updateProfile(
                isEnglishRequest(request), zip, address, detailAddress, request));
    }

    @PostMapping({ "/api/mypage/company", "/api/en/mypage/company" })
    @ResponseBody
    public ResponseEntity<Map<String, Object>> updateMypageCompany(
            @RequestParam(value = "companyName", required = false) String companyName,
            @RequestParam(value = "representativeName", required = false) String representativeName,
            @RequestParam(value = "zip", required = false) String zip,
            @RequestParam(value = "address", required = false) String address,
            @RequestParam(value = "detailAddress", required = false) String detailAddress,
            HttpServletRequest request) {
        return mypageResponse(homeMypageService.updateCompany(
                isEnglishRequest(request), companyName, representativeName, zip, address, detailAddress, request));
    }

    @PostMapping({ "/api/mypage/marketing", "/api/en/mypage/marketing" })
    @ResponseBody
    public ResponseEntity<Map<String, Object>> updateMypageMarketing(
            @RequestParam(value = "marketingYn", required = false) String marketingYn,
            HttpServletRequest request) {
        return mypageResponse(homeMypageService.updateMarketingPreference(
                isEnglishRequest(request), marketingYn, request));
    }

    @PostMapping({ "/api/mypage/staff", "/api/en/mypage/staff" })
    @ResponseBody
    public ResponseEntity<Map<String, Object>> updateMypageStaff(
            @RequestParam(value = "staffName", required = false) String staffName,
            @RequestParam(value = "deptNm", required = false) String deptNm,
            @RequestParam(value = "areaNo", required = false) String areaNo,
            @RequestParam(value = "middleTelno", required = false) String middleTelno,
            @RequestParam(value = "endTelno", required = false) String endTelno,
            HttpServletRequest request) {
        return mypageResponse(homeMypageService.updateStaffContact(
                isEnglishRequest(request), staffName, deptNm, areaNo, middleTelno, endTelno, request));
    }

    @PostMapping({ "/api/mypage/email", "/api/en/mypage/email" })
    @ResponseBody
    public ResponseEntity<Map<String, Object>> updateMypageEmail(
            @RequestParam(value = "email", required = false) String email,
            HttpServletRequest request) {
        return mypageResponse(homeMypageService.updateEmailAddress(isEnglishRequest(request), email, request));
    }

    @PostMapping({ "/api/mypage/password", "/api/en/mypage/password" })
    @ResponseBody
    public ResponseEntity<Map<String, Object>> updateMypagePassword(
            @RequestParam(value = "currentPassword", required = false) String currentPassword,
            @RequestParam(value = "newPassword", required = false) String newPassword,
            HttpServletRequest request) {
        return mypageResponse(homeMypageService.updatePassword(
                isEnglishRequest(request), currentPassword, newPassword, request));
    }

    private ResponseEntity<Map<String, Object>> mypageResponse(Map<String, Object> payload) {
        boolean authenticated = Boolean.TRUE.equals(payload.get("authenticated"));
        return authenticated
                ? ResponseEntity.ok(payload)
                : ResponseEntity.status(HttpServletResponse.SC_UNAUTHORIZED).body(payload);
    }

    private boolean isEnglishRequest(HttpServletRequest request) {
        String uri = request == null ? "" : request.getRequestURI();
        return uri != null && (uri.startsWith("/en/") || uri.startsWith("/api/en/"));
    }
}
