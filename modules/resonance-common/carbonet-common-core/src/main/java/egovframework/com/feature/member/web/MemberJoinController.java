package egovframework.com.feature.member.web;

import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Map;
import java.util.List;
import java.util.ArrayList;
import jakarta.annotation.Resource;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;

import org.springframework.stereotype.Controller;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.ui.Model;
import org.springframework.ui.ExtendedModelMap;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.multipart.MultipartFile;
import java.io.File;
import java.util.UUID;
import org.springframework.web.multipart.MultipartHttpServletRequest;

import egovframework.com.common.context.ProjectRuntimeContext;
import egovframework.com.feature.member.service.EnterpriseMemberService;
import egovframework.com.feature.member.service.MemberConsentHistoryService;
import egovframework.com.feature.member.service.support.InstitutionEvidenceFileSupport;
import egovframework.com.feature.member.model.vo.EntrprsMberFileVO;
import egovframework.com.feature.member.model.vo.EntrprsManageVO;
import egovframework.com.feature.member.model.vo.InstitutionStatusVO;
import egovframework.com.feature.member.model.vo.InsttFileVO;
import egovframework.com.feature.member.model.vo.InsttInfoVO;
import egovframework.com.feature.member.model.vo.MberManageVO;
import egovframework.com.feature.member.model.vo.CompanyListItemVO;
import egovframework.com.feature.member.dto.response.CompanySearchResponseDTO;
import egovframework.com.feature.member.dto.response.DuplicateCheckResponseDTO;
import egovframework.com.feature.home.web.ReactAppViewSupport;
import egovframework.com.common.util.ReactPageUrlMapper;
import lombok.extern.slf4j.Slf4j;

@Controller
@RequestMapping("/join")
@Slf4j
public class MemberJoinController {
    private static final String SESSION_JOIN_VO = "joinVO";
    private static final String SESSION_JOIN_STEP = "joinStep";

    private static final String SESSION_REAPPLY_TOKEN = "companyReapplyToken";
    private static final String SESSION_REAPPLY_TOKEN_EXPIRES_AT = "companyReapplyTokenExpiresAt";
    private static final String SESSION_REAPPLY_TOKEN_INSTT_ID = "companyReapplyTokenInsttId";
    private static final String SESSION_REAPPLY_TOKEN_BIZ_NO = "companyReapplyTokenBizNo";
    private static final String SESSION_REAPPLY_TOKEN_PROJECT_ID = "companyReapplyTokenProjectId";
    private static final long REAPPLY_TOKEN_TTL_MILLIS = 15L * 60L * 1000L;

    private static final String SESSION_REAPPLY_LOOKUP_WINDOW_STARTED_AT = "companyReapplyLookupWindowStartedAt";
    private static final String SESSION_REAPPLY_LOOKUP_COUNT = "companyReapplyLookupCount";
    private static final long REAPPLY_LOOKUP_WINDOW_MILLIS = 5L * 60L * 1000L;
    private static final int REAPPLY_LOOKUP_MAX_REQUESTS = 10;
    private static final String SESSION_STATUS_LOOKUP_WINDOW_STARTED_AT = "companyStatusLookupWindowStartedAt";
    private static final String SESSION_STATUS_LOOKUP_COUNT = "companyStatusLookupCount";
    private static final String SESSION_COMPANY_LOOKUP_GRANTS = "companyLookupGrants";
    private static final long COMPANY_LOOKUP_HANDLE_TTL_MILLIS = 5L * 60L * 1000L;
    private static final int COMPANY_LOOKUP_HANDLE_MAX_GRANTS = 20;
    private static final String SESSION_STATUS_DOWNLOAD_GRANTS = "companyStatusDownloadGrants";
    private static final long STATUS_DOWNLOAD_TOKEN_TTL_MILLIS = 15L * 60L * 1000L;
    private static final int STATUS_DOWNLOAD_TOKEN_MAX_GRANTS = 20;

    @Resource(name = "entrprsManageService")
    private EnterpriseMemberService entrprsManageService;

    @Resource
    private ReactAppViewSupport reactAppViewSupport;

    @Resource
    private MemberConsentHistoryService memberConsentHistoryService;

    @Resource
    private ProjectRuntimeContext projectRuntimeContext;

    @Resource
    private egovframework.com.common.security.PublicLookupRateLimitService publicLookupRateLimitService;

    @Value("${security.join.allow-unverified-identity:false}")
    private boolean allowUnverifiedIdentity;

    @GetMapping("/api/session")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> joinSessionApi(HttpSession session) {
        Map<String, Object> response = new java.util.LinkedHashMap<>();
        EntrprsManageVO joinVO = (EntrprsManageVO) session.getAttribute(SESSION_JOIN_VO);
        int step = getJoinStep(session);
        if (joinVO == null) {
            joinVO = new EntrprsManageVO();
            joinVO.setEntrprsSeCode("E");
            session.setAttribute(SESSION_JOIN_VO, joinVO);
            setJoinStep(session, 1);
            step = 1;
        }
        response.put("step", step);
        response.put("joinVO", joinVO);
        response.put("verifiedIdentity", hasVerifiedIdentity(joinVO));
        response.put("identityVerificationMode", allowUnverifiedIdentity ? "DEVELOPMENT_BYPASS" : "PROVIDER_REQUIRED");
        response.put("requiredSessionReady", hasRequiredJoinSessionValues(joinVO));
        response.put("membershipType", expandMembershipCode(joinVO.getEntrprsSeCode()));
        response.put("canViewStep1", true);
        response.put("canViewStep2", step >= 1);
        response.put("canViewStep3", step >= 2);
        response.put("canViewStep4", step >= 4);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/api/reset")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> resetJoinApi(HttpSession session) {
        session.removeAttribute(SESSION_JOIN_VO);
        session.removeAttribute(SESSION_JOIN_STEP);
        Map<String, Object> response = new java.util.LinkedHashMap<>();
        response.put("success", true);
        return ResponseEntity.ok(response);
    }

    /**
     * 가입 프로세스 초기화 (세션 비우기) 및 홈 이동
     */
    @GetMapping("/reset")
    public String resetJoin(HttpSession session) {
        session.removeAttribute(SESSION_JOIN_VO);
        session.removeAttribute(SESSION_JOIN_STEP);
        return "redirect:/home";
    }

    /**
     * Step 1: 회원유형 선택 화면
     * ?init=T 파라미터가 있으면 세션을 초기화함 (언어 전환 등에서 사용)
     */
    @GetMapping({"/step1", "/ko/step1", "/overseas/step1", "/ko/overseas/step1", "/en/step1", "/en/overseas/step1"})
    public String step1View(@RequestParam(value = "init", required = false) String init, HttpSession session,
            HttpServletRequest request,
            Model model) {
        if ("T".equals(init)) {
            session.removeAttribute(SESSION_JOIN_VO);
            session.removeAttribute(SESSION_JOIN_STEP);
        }
        return renderJoinPage(model, "join-wizard", isEnglishJoinRequest(request));
    }

    /**
     * Step 1 실시간 저장 API
     */
    @PostMapping("/saveStep1")
    @org.springframework.web.bind.annotation.ResponseBody
    public String saveStep1(@RequestParam("membership_type") String membershipType, HttpSession session) {
        EntrprsManageVO joinVO = (EntrprsManageVO) session.getAttribute(SESSION_JOIN_VO);
        if (joinVO == null) {
            joinVO = new EntrprsManageVO();
        }
        String normalizedMembershipType = normalizeMembershipCode(membershipType);
        if (!hasText(normalizedMembershipType)) {
            return "invalid_membership_type";
        }
        joinVO.setEntrprsSeCode(normalizedMembershipType);
        joinVO.setUserTy("USR02");
        session.setAttribute(SESSION_JOIN_VO, joinVO);
        setJoinStep(session, 1);
        return "success";
    }

    @PostMapping("/api/step1")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> saveStep1Api(@RequestParam("membership_type") String membershipType, HttpSession session) {
        Map<String, Object> response = new java.util.LinkedHashMap<>();
        EntrprsManageVO joinVO = (EntrprsManageVO) session.getAttribute(SESSION_JOIN_VO);
        if (joinVO == null) {
            joinVO = new EntrprsManageVO();
        }
        String normalizedMembershipType = normalizeMembershipCode(membershipType);
        if (!hasText(normalizedMembershipType)) {
            response.put("success", false);
            response.put("message", "유효한 회원 유형을 선택해 주세요.");
            return ResponseEntity.badRequest().body(response);
        }
        joinVO.setEntrprsSeCode(normalizedMembershipType);
        joinVO.setUserTy("USR02");
        session.setAttribute(SESSION_JOIN_VO, joinVO);
        setJoinStep(session, 1);
        response.put("success", true);
        response.put("step", 1);
        response.put("joinVO", joinVO);
        return ResponseEntity.ok(response);
    }

    /**
     * Step 2: 약관 동의 화면
     */
    @PostMapping({"/step2", "/ko/step2"})
    public String step2View(@RequestParam(value = "membership_type", required = false) String membershipType,
            HttpSession session, Model model) {
        EntrprsManageVO joinVO = (EntrprsManageVO) session.getAttribute(SESSION_JOIN_VO);
        if (joinVO == null) {
            joinVO = new EntrprsManageVO();
        }
        if (membershipType != null) {
            joinVO.setEntrprsSeCode(normalizeMembershipCode(membershipType));
        }
        if (!hasText(joinVO.getEntrprsSeCode())) {
            return "redirect:/join/step1?expired=1";
        }
        joinVO.setUserTy("USR02");
        session.setAttribute(SESSION_JOIN_VO, joinVO);
        setJoinStep(session, 2);
        model.addAttribute("joinVO", joinVO);
        return "redirect:/join/step2";
    }

    @GetMapping({"/step2", "/ko/step2", "/en/step2"})
    public String step2ReactView(HttpSession session, HttpServletRequest request, Model model) {
        boolean english = isEnglishJoinRequest(request);
        if (getJoinStep(session) < 1 || session.getAttribute(SESSION_JOIN_VO) == null) {
            return redirectJoinStep(english, "step1?expired=1");
        }
        return renderJoinPage(model, "join-terms", english);
    }

    /**
     * Step 2 실시간 저장 API (마케팅 동의 등)
     */
    @PostMapping("/saveStep2")
    @org.springframework.web.bind.annotation.ResponseBody
    public String saveStep2(@RequestParam("marketing_yn") String marketingYn, HttpSession session) {
        if (getJoinStep(session) < 2) {
            return "invalid_step";
        }
        EntrprsManageVO joinVO = (EntrprsManageVO) session.getAttribute(SESSION_JOIN_VO);
        if (joinVO == null) {
            joinVO = new EntrprsManageVO();
        }
        joinVO.setMarketingYn(marketingYn);
        session.setAttribute(SESSION_JOIN_VO, joinVO);
        return "success";
    }

    @PostMapping("/api/step2")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> saveStep2Api(
            @RequestParam("marketing_yn") String marketingYn,
            @RequestParam("agree_terms") String agreeTerms,
            @RequestParam("agree_privacy") String agreePrivacy,
            @RequestParam("agree_gwp") String agreeGwp,
            HttpSession session,
            HttpServletRequest request) {
        Map<String, Object> response = new java.util.LinkedHashMap<>();
        if (getJoinStep(session) < 1) {
            response.put("success", false);
            response.put("message", "회원유형 선택부터 다시 진행해 주세요.");
            return ResponseEntity.badRequest().body(response);
        }
        EntrprsManageVO joinVO = (EntrprsManageVO) session.getAttribute(SESSION_JOIN_VO);
        if (joinVO == null) {
            joinVO = new EntrprsManageVO();
        }
        boolean termsAgreed = "Y".equalsIgnoreCase(agreeTerms);
        boolean privacyAgreed = "Y".equalsIgnoreCase(agreePrivacy);
        boolean gwpAgreed = "Y".equalsIgnoreCase(agreeGwp);
        if (!termsAgreed || !privacyAgreed || !gwpAgreed) {
            response.put("success", false);
            response.put("message", "필수 약관에 모두 동의해 주세요.");
            return ResponseEntity.badRequest().body(response);
        }
        joinVO.setMarketingYn(marketingYn);
        memberConsentHistoryService.recordJoinConsents(
                session.getId(), joinVO.getEntrprsSeCode(), termsAgreed, privacyAgreed, gwpAgreed,
                "Y".equalsIgnoreCase(marketingYn), request);
        session.setAttribute(SESSION_JOIN_VO, joinVO);
        setJoinStep(session, 2);
        response.put("success", true);
        response.put("step", 2);
        response.put("joinVO", joinVO);
        return ResponseEntity.ok(response);
    }

    @PostMapping("/api/step3")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> saveStep3Api(@RequestParam("auth_method") String authMethod, HttpSession session) {
        Map<String, Object> response = new java.util.LinkedHashMap<>();
        if (getJoinStep(session) < 2) {
            response.put("success", false);
            response.put("message", "약관 동의 단계부터 다시 진행해 주세요.");
            return ResponseEntity.badRequest().body(response);
        }
        EntrprsManageVO joinVO = (EntrprsManageVO) session.getAttribute(SESSION_JOIN_VO);
        if (joinVO == null) {
            response.put("success", false);
            response.put("message", "세션이 만료되었습니다. 다시 시작해 주세요.");
            return ResponseEntity.badRequest().body(response);
        }
        if (!hasText(authMethod)) {
            response.put("success", false);
            response.put("message", "본인확인 수단을 선택해 주세요.");
            return ResponseEntity.badRequest().body(response);
        }
        joinVO.setAuthTy(normalizeAuthType(authMethod));
        if (!hasVerifiedIdentity(joinVO)) {
            response.put("success", false);
            response.put("message", "IDENTITY_PROVIDER_VERIFICATION_REQUIRED");
            return ResponseEntity.status(409).body(response);
        }
        session.setAttribute(SESSION_JOIN_VO, joinVO);
        setJoinStep(session, 4);
        response.put("success", true);
        response.put("step", 4);
        response.put("joinVO", joinVO);
        return ResponseEntity.ok(response);
    }

    @PostMapping(value = "/api/step4/submit", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseBody
    @Transactional(rollbackFor = Exception.class)
    public ResponseEntity<Map<String, Object>> step4SubmitApi(
            @RequestParam(value = "membershipType", required = false) String membershipType,
            @RequestParam("mberId") String mberId,
            @RequestParam("password") String password,
            @RequestParam("mberNm") String mberNm,
            @RequestParam("insttNm") String insttNm,
            @RequestParam("insttId") String insttId,
            @RequestParam("representativeName") String representativeName,
            @RequestParam("bizrno") String bizrno,
            @RequestParam("zip") String zip,
            @RequestParam("adres") String adres,
            @RequestParam(value = "detailAdres", required = false) String detailAdres,
            @RequestParam(value = "deptNm", required = false) String deptNm,
            @RequestParam("moblphonNo1") String tel1,
            @RequestParam("moblphonNo2") String tel2,
            @RequestParam("moblphonNo3") String tel3,
            @RequestParam("applcntEmailAdres") String email,
            @RequestParam(value = "fileUploads", required = false) List<MultipartFile> fileUploads,
            HttpSession session) throws Exception {
        Map<String, Object> response = new java.util.LinkedHashMap<>();
        EntrprsManageVO joinVO = (EntrprsManageVO) session.getAttribute(SESSION_JOIN_VO);
        if (joinVO == null) {
            response.put("success", false);
            response.put("message", "세션이 만료되었습니다. 다시 시작해 주세요.");
            return ResponseEntity.badRequest().body(response);
        }
        if (getJoinStep(session) < 4 || !hasVerifiedIdentity(joinVO) || !hasRequiredJoinSessionValues(joinVO)) {
            response.put("success", false);
            response.put("message", "본인확인 단계부터 다시 진행해 주세요.");
            return ResponseEntity.badRequest().body(response);
        }
        Map<String, String> requiredFields = new java.util.LinkedHashMap<>();
        requiredFields.put("mberId", mberId);
        requiredFields.put("password", password);
        requiredFields.put("mberNm", mberNm);
        requiredFields.put("insttNm", insttNm);
        requiredFields.put("insttId", insttId);
        requiredFields.put("representativeName", representativeName);
        requiredFields.put("bizrno", bizrno);
        requiredFields.put("zip", zip);
        requiredFields.put("adres", adres);
        requiredFields.put("moblphonNo1", tel1);
        requiredFields.put("moblphonNo2", tel2);
        requiredFields.put("moblphonNo3", tel3);
        requiredFields.put("applcntEmailAdres", email);
        List<String> missingFields = requiredFields.entrySet().stream()
                .filter(entry -> !hasText(entry.getValue()))
                .map(Map.Entry::getKey)
                .toList();
        if (!missingFields.isEmpty()) {
            response.put("success", false);
            response.put("errorCode", "REQUIRED_FIELDS_MISSING");
            response.put("missingFields", missingFields);
            response.put("message", "필수 입력값을 모두 입력해 주세요.");
            return ResponseEntity.badRequest().body(response);
        }
        if (!hasValidEvidenceFiles(fileUploads)) {
            response.put("success", false);
            response.put("errorCode", "REQUIRED_FIELDS_MISSING");
            response.put("missingFields", List.of("fileUploads"));
            response.put("message", "증빙 파일을 1개 이상 업로드해 주세요.");
            return ResponseEntity.badRequest().body(response);
        }
        String resolvedMembershipType = resolveJoinMembershipType(membershipType, insttId, joinVO);
        if (!hasText(resolvedMembershipType)) {
            response.put("success", false);
            response.put("message", "회원 유형 정보를 확인할 수 없습니다. 처음부터 다시 진행해 주세요.");
            return ResponseEntity.badRequest().body(response);
        }

        joinVO.setEntrprsmberId(mberId);
        joinVO.setEntrprsMberPassword(password);
        joinVO.setApplcntNm(mberNm);
        joinVO.setCmpnyNm(insttNm);
        joinVO.setInsttId(insttId);
        joinVO.setCxfc(representativeName);
        joinVO.setBizrno(bizrno);
        joinVO.setZip(zip);
        joinVO.setAdres(adres);
        joinVO.setDetailAdres(detailAdres);
        joinVO.setDeptNm(safeTrim(deptNm));
        joinVO.setEntrprsSeCode(resolvedMembershipType);
        joinVO.setMarketingYn(normalizeMarketingYn(joinVO.getMarketingYn()));
        joinVO.setAuthTy(normalizeAuthType(joinVO.getAuthTy()));
        joinVO.setAreaNo(tel1);
        joinVO.setEntrprsMiddleTelno(tel2);
        joinVO.setEntrprsEndTelno(tel3);
        joinVO.setApplcntEmailAdres(email);
        joinVO.setEntrprsMberSttus("P");
        joinVO.setDeptNm(trimToLen(joinVO.getDeptNm(), 60));
        applyJoinDbDefaults(joinVO);
        List<EntrprsMberFileVO> evidenceFiles = saveJoinEvidenceFiles(joinVO.getEntrprsmberId(), fileUploads);
        joinVO.setBizRegFilePath(joinEvidencePaths(evidenceFiles));

        entrprsManageService.insertEntrprsmber(joinVO);
        entrprsManageService.insertEntrprsMberFiles(evidenceFiles);
        entrprsManageService.ensureEnterpriseSecurityMapping(joinVO.getUniqId());
        memberConsentHistoryService.linkMember(session.getId(), joinVO.getEntrprsmberId());

        response.put("success", true);
        response.put("mberId", joinVO.getEntrprsmberId());
        response.put("mberNm", joinVO.getApplcntNm());
        response.put("insttNm", joinVO.getCmpnyNm());
        session.removeAttribute(SESSION_JOIN_STEP);
        session.removeAttribute(SESSION_JOIN_VO);
        return ResponseEntity.ok(response);
    }

    /**
     * Step 3: 본인 인증 화면
     */
    @PostMapping({"/step3", "/ko/step3"})
    public String step3View(@RequestParam(value = "marketing_agree", required = false) String marketingAgree,
            HttpSession session, Model model) {
        if (getJoinStep(session) < 2 || session.getAttribute(SESSION_JOIN_VO) == null) {
            return "redirect:/join/step1?expired=1";
        }
        setJoinStep(session, 3);
        return "redirect:/join/step3";
    }

    @GetMapping({"/step3", "/ko/step3", "/en/step3"})
    public String step3ReactView(HttpSession session, HttpServletRequest request, Model model) {
        boolean english = isEnglishJoinRequest(request);
        if (getJoinStep(session) < 2 || session.getAttribute(SESSION_JOIN_VO) == null) {
            return redirectJoinStep(english, "step1?expired=1");
        }
        setJoinStep(session, 3);
        return renderJoinPage(model, "join-auth", english);
    }

    /**
     * Step 4: 정보 입력 화면
     */
    @PostMapping({"/step4", "/ko/step4"})
    public String step4View(@RequestParam(value = "auth_method", required = false) String authMethod,
            HttpSession session, Model model) {
        if (getJoinStep(session) < 3) {
            return "redirect:/join/step1?expired=1";
        }
        EntrprsManageVO joinVO = (EntrprsManageVO) session.getAttribute(SESSION_JOIN_VO);
        if (joinVO == null)
            return "redirect:/join/step1?expired=1";
        if (!hasText(authMethod)) {
            return "redirect:/join/step3";
        }

        // 본인확인 수단 코드만 저장한다.
        joinVO.setAuthTy(normalizeAuthType(authMethod));

        if (!hasVerifiedIdentity(joinVO)) {
            return "redirect:/join/step3?verificationRequired=1";
        }

        session.setAttribute(SESSION_JOIN_VO, joinVO);
        setJoinStep(session, 4);
        return "redirect:/join/step4";
    }

    @GetMapping({"/step4", "/ko/step4", "/en/step4"})
    public String step4View(HttpSession session, HttpServletRequest request, Model model) {
        boolean english = isEnglishJoinRequest(request);
        EntrprsManageVO joinVO = (EntrprsManageVO) session.getAttribute(SESSION_JOIN_VO);
        if (joinVO == null || getJoinStep(session) < 4) {
            return redirectJoinStep(english, "step1?expired=1");
        }
        if (!hasVerifiedIdentity(joinVO) || !hasRequiredJoinSessionValues(joinVO)) {
            return redirectJoinStep(english, "step3");
        }
        setJoinStep(session, 4);
        return renderJoinPage(model, "join-info", english);
    }

    /**
     * 아이디 중복 확인 API
     */
    @GetMapping("/checkId")
    @org.springframework.web.bind.annotation.ResponseBody
    public DuplicateCheckResponseDTO checkId(@RequestParam("mberId") String mberId) throws Exception {
        int cnt = entrprsManageService.checkIdDplct(mberId);
        return new DuplicateCheckResponseDTO(cnt > 0);
    }

    /**
     * 이메일 중복 확인 API
     */
    @GetMapping("/checkEmail")
    @org.springframework.web.bind.annotation.ResponseBody
    public DuplicateCheckResponseDTO checkEmail(@RequestParam("email") String email) throws Exception {
        int cnt = entrprsManageService.checkEmailDplct(email);
        return new DuplicateCheckResponseDTO(cnt > 0);
    }

    /**
     * Step 5: 가입 완료 처리
     */
    @PostMapping({"/step5", "/ko/step5"})
    @Transactional(rollbackFor = Exception.class)
    public String step5Process(@RequestParam(value = "membershipType", required = false) String membershipType,
            @RequestParam("mberId") String mberId,
            @RequestParam("password") String password,
            @RequestParam("mberNm") String mberNm,
            @RequestParam("insttNm") String insttNm,
            @RequestParam("insttId") String insttId,
            @RequestParam("representativeName") String representativeName,
            @RequestParam("bizrno") String bizrno,
            @RequestParam("zip") String zip,
            @RequestParam("adres") String adres,
            @RequestParam(value = "detailAdres", required = false) String detailAdres,
            @RequestParam(value = "deptNm", required = false) String deptNm,
            @RequestParam("moblphonNo1") String tel1,
            @RequestParam("moblphonNo2") String tel2,
            @RequestParam("moblphonNo3") String tel3,
            @RequestParam("applcntEmailAdres") String email,
            @RequestParam(value = "fileUploads", required = false) List<MultipartFile> fileUploads,
            HttpSession session, Model model) throws Exception {

        EntrprsManageVO joinVO = (EntrprsManageVO) session.getAttribute(SESSION_JOIN_VO);
        if (joinVO == null)
            return "redirect:/join/step1?expired=1";
        if (getJoinStep(session) < 4 || !hasVerifiedIdentity(joinVO) || !hasRequiredJoinSessionValues(joinVO)) {
            return "redirect:/join/step3";
        }
        if (!hasText(mberId) || !hasText(password) || !hasText(mberNm) || !hasText(insttNm) || !hasText(insttId) || !hasText(representativeName) ||
                !hasText(bizrno) || !hasText(zip) || !hasText(adres) || !hasText(tel1) || !hasText(tel2) || !hasText(tel3) || !hasText(email)) {
            return "redirect:/join/step4";
        }
        if (!hasValidEvidenceFiles(fileUploads)) {
            return "redirect:/join/step4";
        }
        String resolvedMembershipType = resolveJoinMembershipType(membershipType, insttId, joinVO);
        if (!hasText(resolvedMembershipType)) {
            return "redirect:/join/step1?expired=1";
        }

        // Merge data
        joinVO.setEntrprsmberId(mberId);
        joinVO.setEntrprsMberPassword(password);
        joinVO.setApplcntNm(mberNm);
        joinVO.setCmpnyNm(insttNm);
        joinVO.setInsttId(insttId);
        joinVO.setCxfc(representativeName);
        joinVO.setBizrno(bizrno);
        joinVO.setZip(zip);
        joinVO.setAdres(adres);
        joinVO.setDetailAdres(detailAdres);
        joinVO.setDeptNm(safeTrim(deptNm));
        joinVO.setEntrprsSeCode(resolvedMembershipType);
        joinVO.setMarketingYn(normalizeMarketingYn(joinVO.getMarketingYn()));
        joinVO.setAuthTy(normalizeAuthType(joinVO.getAuthTy()));
        joinVO.setAreaNo(tel1);
        joinVO.setEntrprsMiddleTelno(tel2);
        joinVO.setEntrprsEndTelno(tel3);
        joinVO.setApplcntEmailAdres(email);
        joinVO.setEntrprsMberSttus("P");
        joinVO.setDeptNm(trimToLen(joinVO.getDeptNm(), 60));
        applyJoinDbDefaults(joinVO);
        List<EntrprsMberFileVO> evidenceFiles = saveJoinEvidenceFiles(joinVO.getEntrprsmberId(), fileUploads);
        joinVO.setBizRegFilePath(joinEvidencePaths(evidenceFiles));

        // Save to DB
        entrprsManageService.insertEntrprsmber(joinVO);
        entrprsManageService.insertEntrprsMberFiles(evidenceFiles);
        entrprsManageService.ensureEnterpriseSecurityMapping(joinVO.getUniqId());
        memberConsentHistoryService.linkMember(session.getId(), joinVO.getEntrprsmberId());

        model.addAttribute("mberId", joinVO.getEntrprsmberId());
        model.addAttribute("mberNm", joinVO.getApplcntNm());
        model.addAttribute("insttNm", joinVO.getCmpnyNm());
        session.removeAttribute(SESSION_JOIN_STEP);
        session.removeAttribute(SESSION_JOIN_VO);

        return "redirect:/join/step5?mberId=" + urlEncode(joinVO.getEntrprsmberId())
                + "&mberNm=" + urlEncode(joinVO.getApplcntNm())
                + "&insttNm=" + urlEncode(joinVO.getCmpnyNm());
    }

    @GetMapping({"/step5", "/ko/step5", "/en/step5"})
    public String step5View(HttpSession session, HttpServletRequest request, Model model) {
        return renderJoinPage(model, "join-complete", isEnglishJoinRequest(request));
    }

    /** EN Step 2: Terms (form submit from step1 EN) */
    @PostMapping("/en/step2")
    public String step2EnProcess(@RequestParam(value = "membership_type", required = false) String membershipType,
            HttpSession session, Model model) {
        EntrprsManageVO joinVO = (EntrprsManageVO) session.getAttribute(SESSION_JOIN_VO);
        if (joinVO == null) {
            joinVO = new EntrprsManageVO();
        }
        if (membershipType != null) {
            joinVO.setEntrprsSeCode(normalizeMembershipCode(membershipType));
        }
        if (!hasText(joinVO.getEntrprsSeCode())) {
            return "redirect:/join/en/step1?expired=1";
        }
        joinVO.setUserTy("USR02");
        session.setAttribute(SESSION_JOIN_VO, joinVO);
        setJoinStep(session, 2);
        model.addAttribute("joinVO", joinVO);
        return "redirect:/join/en/step2";
    }

    /** EN Step 3: Verification (form submit from step2 EN) */
    @PostMapping("/en/step3")
    public String step3EnProcess(@RequestParam(value = "marketing_agree", required = false) String marketingAgree,
            HttpSession session) {
        if (getJoinStep(session) < 2 || session.getAttribute(SESSION_JOIN_VO) == null) {
            return "redirect:/join/en/step1?expired=1";
        }
        setJoinStep(session, 3);
        return "redirect:/join/en/step3";
    }

    /** EN Step 4: Info form (form submit from step3 EN) */
    @PostMapping("/en/step4")
    public String step4EnProcess(@RequestParam(value = "auth_method", required = false) String authMethod,
            HttpSession session, Model model) {
        if (getJoinStep(session) < 3) {
            return "redirect:/join/en/step1?expired=1";
        }
        EntrprsManageVO joinVO = (EntrprsManageVO) session.getAttribute(SESSION_JOIN_VO);
        if (joinVO == null)
            return "redirect:/join/en/step1?expired=1";
        if (!hasText(authMethod)) {
            return "redirect:/join/en/step3";
        }

        joinVO.setAuthTy(normalizeAuthType(authMethod));

        session.setAttribute(SESSION_JOIN_VO, joinVO);
        setJoinStep(session, 4);
        return "redirect:/join/en/step4";
    }

    /** EN Step 5: Complete (form submit from step4 EN) */
    @PostMapping("/en/step5")
    public String step5EnProcess(@RequestParam(value = "membershipType", required = false) String membershipType,
            @RequestParam("mberId") String mberId,
            @RequestParam("password") String password,
            @RequestParam("mberNm") String mberNm,
            @RequestParam("insttNm") String insttNm,
            @RequestParam("insttId") String insttId,
            @RequestParam("representativeName") String representativeName,
            @RequestParam("bizrno") String bizrno,
            @RequestParam("zip") String zip,
            @RequestParam("adres") String adres,
            @RequestParam(value = "detailAdres", required = false) String detailAdres,
            @RequestParam(value = "deptNm", required = false) String deptNm,
            @RequestParam("moblphonNo1") String tel1,
            @RequestParam("moblphonNo2") String tel2,
            @RequestParam("moblphonNo3") String tel3,
            @RequestParam("applcntEmailAdres") String email,
            @RequestParam(value = "fileUploads", required = false) List<MultipartFile> fileUploads,
            HttpSession session, Model model) throws Exception {

        EntrprsManageVO joinVO = (EntrprsManageVO) session.getAttribute(SESSION_JOIN_VO);
        if (joinVO == null)
            return "redirect:/join/en/step1?expired=1";
        if (getJoinStep(session) < 4 || !hasVerifiedIdentity(joinVO) || !hasRequiredJoinSessionValues(joinVO)) {
            return "redirect:/join/en/step3";
        }
        if (!hasText(mberId) || !hasText(password) || !hasText(mberNm) || !hasText(insttNm) || !hasText(insttId) || !hasText(representativeName) ||
                !hasText(bizrno) || !hasText(zip) || !hasText(adres) || !hasText(tel1) || !hasText(tel2) || !hasText(tel3) || !hasText(email)) {
            return "redirect:/join/en/step4";
        }
        if (!hasValidEvidenceFiles(fileUploads)) {
            return "redirect:/join/en/step4";
        }
        String resolvedMembershipType = resolveJoinMembershipType(membershipType, insttId, joinVO);
        if (!hasText(resolvedMembershipType)) {
            return "redirect:/join/en/step1?expired=1";
        }

        joinVO.setEntrprsmberId(mberId);
        joinVO.setEntrprsMberPassword(password);
        joinVO.setApplcntNm(mberNm);
        joinVO.setCmpnyNm(insttNm);
        joinVO.setInsttId(insttId);
        joinVO.setCxfc(representativeName);
        joinVO.setBizrno(bizrno);
        joinVO.setZip(zip);
        joinVO.setAdres(adres);
        joinVO.setDetailAdres(detailAdres);
        joinVO.setDeptNm(safeTrim(deptNm));
        joinVO.setEntrprsSeCode(resolvedMembershipType);
        joinVO.setMarketingYn(normalizeMarketingYn(joinVO.getMarketingYn()));
        joinVO.setAuthTy(normalizeAuthType(joinVO.getAuthTy()));
        joinVO.setAreaNo(tel1);
        joinVO.setEntrprsMiddleTelno(tel2);
        joinVO.setEntrprsEndTelno(tel3);
        joinVO.setApplcntEmailAdres(email);
        joinVO.setEntrprsMberSttus("P");
        joinVO.setDeptNm(trimToLen(joinVO.getDeptNm(), 60));
        applyJoinDbDefaults(joinVO);
        List<EntrprsMberFileVO> evidenceFiles = saveJoinEvidenceFiles(joinVO.getEntrprsmberId(), fileUploads);
        joinVO.setBizRegFilePath(joinEvidencePaths(evidenceFiles));

        entrprsManageService.insertEntrprsmber(joinVO);
        entrprsManageService.insertEntrprsMberFiles(evidenceFiles);
        entrprsManageService.ensureEnterpriseSecurityMapping(joinVO.getUniqId());

        model.addAttribute("mberId", joinVO.getEntrprsmberId());
        model.addAttribute("mberNm", joinVO.getApplcntNm());
        model.addAttribute("insttNm", joinVO.getCmpnyNm());
        session.removeAttribute(SESSION_JOIN_STEP);
        session.removeAttribute(SESSION_JOIN_VO);

        return "redirect:/join/en/step5?mberId=" + urlEncode(joinVO.getEntrprsmberId())
                + "&mberNm=" + urlEncode(joinVO.getApplcntNm())
                + "&insttNm=" + urlEncode(joinVO.getCmpnyNm());
    }

    // ==========================================
    // 신규 회원사(기업/기관) 등록 및 모달 검색 API
    // ==========================================

    @GetMapping({"/companyRegister", "/ko/companyRegister", "/en/companyRegister"})
    public String companyRegisterView(HttpServletRequest request, Model model) {
        return renderJoinPage(model, "join-company-register", isEnglishJoinRequest(request));
    }

    @GetMapping({"/companyRegisterComplete", "/ko/companyRegisterComplete", "/en/companyRegisterComplete"})
    public String companyRegisterCompleteView(HttpServletRequest request, Model model) {
        return renderJoinPage(model, "join-company-register-complete", isEnglishJoinRequest(request));
    }

    @GetMapping("/api/company-register/page")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> companyRegisterPageApi(HttpSession session) {
        Map<String, Object> response = new java.util.LinkedHashMap<>();
        response.put("membershipType", resolveScopedInstitutionType(session));
        response.put("canViewCompanyRegister", true);
        response.put("canUseCompanyRegister", true);
        return ResponseEntity.ok(response);
    }

    @PostMapping(value = "/api/company-register", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseBody
    public ResponseEntity<Map<String, Object>> companyRegisterSubmitApi(
            @RequestParam(value = "membershipType", required = false) String membershipType,
            @RequestParam("agencyName") String agencyName,
            @RequestParam("representativeName") String repName,
            @RequestParam("bizRegistrationNumber") String bizNo,
            @RequestParam("zipCode") String zipCode,
            @RequestParam("companyAddress") String addr,
            @RequestParam(value = "companyAddressDetail", required = false) String detailAddr,
            @RequestParam(value = "chargerName", required = false) String chargerNm,
            @RequestParam(value = "chargerEmail", required = false) String chargerEmail,
            @RequestParam(value = "chargerTel", required = false) String chargerTel,
            @RequestParam(value = "lang", defaultValue = "ko") String lang,
            @RequestParam("fileUploads") java.util.List<org.springframework.web.multipart.MultipartFile> fileUploads,
            HttpSession session) {
        Map<String, Object> response = new java.util.LinkedHashMap<>();
        try {
            InsttInfoVO vo = new InsttInfoVO();
            String scopedMembershipType = normalizeMembershipCode(membershipType);
            if (!hasText(scopedMembershipType)) {
                scopedMembershipType = resolveScopedInstitutionType(session);
            }
            String tempId = "INSTT_" + System.currentTimeMillis();
            if (tempId.length() > 20) {
                tempId = tempId.substring(0, 20);
            }
            vo.setInsttId(tempId);
            vo.setInsttNm(agencyName);
            vo.setReprsntNm(repName);
            vo.setBizrno(bizNo);
            vo.setZip(zipCode);
            vo.setAdres(addr);
            vo.setDetailAdres(detailAddr);
            vo.setChargerNm(chargerNm);
            vo.setChargerEmail(chargerEmail);
            vo.setChargerTel(chargerTel);
            vo.setInsttSttus("A");
            vo.setEntrprsSeCode(scopedMembershipType);

            List<InsttFileVO> insttFiles = saveInsttEvidenceFiles(tempId, fileUploads, 1);
            if (!insttFiles.isEmpty()) {
                vo.setBizRegFilePath(joinInsttEvidencePaths(insttFiles));
            }

            entrprsManageService.insertInsttInfo(vo);
            entrprsManageService.insertInsttFiles(insttFiles);
            String regDate = java.time.LocalDateTime.now().format(java.time.format.DateTimeFormatter.ofPattern("yyyy.MM.dd HH:mm:ss"));

            response.put("success", true);
            response.put("insttId", tempId);
            response.put("insttNm", agencyName);
            response.put("bizrno", bizNo);
            response.put("regDate", regDate);
            response.put("lang", lang);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Company register submit api failed", e);
            response.put("success", false);
            response.put("message", "처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
            return ResponseEntity.internalServerError().body(response);
        }
    }

    @PostMapping({"/companyRegisterSubmit", "/ko/companyRegisterSubmit"})
    public String companyRegisterSubmit(
            @RequestParam(value = "membershipType", required = false) String membershipType,
            @RequestParam("agencyName") String agencyName,
            @RequestParam("representativeName") String repName,
            @RequestParam("bizRegistrationNumber") String bizNo,
            @RequestParam("zipCode") String zipCode,
            @RequestParam("companyAddress") String addr,
            @RequestParam(value = "companyAddressDetail", required = false) String detailAddr,
            @RequestParam(value = "chargerName", required = false) String chargerNm,
            @RequestParam(value = "chargerEmail", required = false) String chargerEmail,
            @RequestParam(value = "chargerTel", required = false) String chargerTel,
            @RequestParam(value = "lang", defaultValue = "ko") String lang,
            @RequestParam("fileUploads") java.util.List<org.springframework.web.multipart.MultipartFile> fileUploads,
            HttpSession session,
            org.springframework.ui.Model model) {

        try {
            InsttInfoVO vo = new InsttInfoVO();
            String scopedMembershipType = normalizeMembershipCode(membershipType);
            if (!hasText(scopedMembershipType)) {
                scopedMembershipType = resolveScopedInstitutionType(session);
            }
            String tempId = "INSTT_" + System.currentTimeMillis();
            if (tempId.length() > 20)
                tempId = tempId.substring(0, 20);

            vo.setInsttId(tempId);
            vo.setInsttNm(agencyName);
            vo.setReprsntNm(repName);
            vo.setBizrno(bizNo);
            vo.setZip(zipCode);
            vo.setAdres(addr);
            vo.setDetailAdres(detailAddr);
            vo.setChargerNm(chargerNm);
            vo.setChargerEmail(chargerEmail);
            vo.setChargerTel(chargerTel);
            vo.setInsttSttus("A");
            vo.setEntrprsSeCode(scopedMembershipType);

            List<InsttFileVO> insttFiles = saveInsttEvidenceFiles(tempId, fileUploads, 1);
            if (!insttFiles.isEmpty()) {
                vo.setBizRegFilePath(joinInsttEvidencePaths(insttFiles));
            }

            entrprsManageService.insertInsttInfo(vo);
            entrprsManageService.insertInsttFiles(insttFiles);

            java.time.LocalDateTime now = java.time.LocalDateTime.now();
            java.time.format.DateTimeFormatter formatter = java.time.format.DateTimeFormatter
                    .ofPattern("yyyy.MM.dd HH:mm:ss");
            String regDate = now.format(formatter);

            model.addAttribute("insttNm", agencyName);
            model.addAttribute("bizrno", bizNo);
            model.addAttribute("regDate", regDate);

            if ("en".equals(lang)) {
                return "redirect:/join/en/companyRegisterComplete?insttNm=" + urlEncode(agencyName)
                        + "&bizrno=" + urlEncode(bizNo)
                        + "&regDate=" + urlEncode(regDate);
            }
            return "redirect:/join/companyRegisterComplete?insttNm=" + urlEncode(agencyName)
                    + "&bizrno=" + urlEncode(bizNo)
                    + "&regDate=" + urlEncode(regDate);

        } catch (Exception e) {
            log.error("Company register submit failed", e);
            String errorMessage = "처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
            if ("en".equals(lang)) {
                return "redirect:/join/en/companyRegister?errorMessage=" + urlEncode(errorMessage);
            }
            return "redirect:/join/companyRegister?errorMessage=" + urlEncode(errorMessage);
        }
    }

    @GetMapping("/checkCompanyNameDplct")
    @ResponseBody
    public String checkCompanyNameDplct(@RequestParam("agencyName") String agencyName) throws Exception {
        int count = entrprsManageService.checkCompanyNameDplct(agencyName);
        return String.valueOf(count);
    }

    @GetMapping("/searchCompany")
    @org.springframework.web.bind.annotation.ResponseBody
    public CompanySearchResponseDTO searchCompany(
            @RequestParam(value = "keyword", defaultValue = "") String keyword,
            @RequestParam(value = "page", defaultValue = "1") int page,
            @RequestParam(value = "size", defaultValue = "5") int size,
            @RequestParam(value = "status", required = false, defaultValue = "") String status,
            @RequestParam(value = "membershipType", required = false) String membershipType,
            HttpSession session) throws Exception {

        page = Math.max(page, 1);
        size = Math.max(1, Math.min(size, 50));
        int offset = (page - 1) * size;
        String normalizedKeyword = keyword == null ? "" : keyword.trim();
        String scopedMembershipType = normalizeMembershipCode(membershipType);
        if (!hasText(scopedMembershipType)) {
            scopedMembershipType = resolveScopedInstitutionType(session);
        }
        if (normalizedKeyword.length() > 100) {
            normalizedKeyword = normalizedKeyword.substring(0, 100);
        }
        java.util.Map<String, Object> params = new java.util.HashMap<>();
        params.put("keyword", normalizedKeyword);
        params.put("offset", offset);
        params.put("pageSize", size);
        params.put("status", status.trim());
        params.put("entrprsSeCode", scopedMembershipType);

        java.util.List<CompanyListItemVO> list = entrprsManageService.searchCompanyListPaged(params);
        int totalCnt = entrprsManageService.searchCompanyListTotCnt(params);
        return new CompanySearchResponseDTO(
                list,
                totalCnt,
                page,
                size,
                (int) Math.ceil((double) totalCnt / size));
    }

    @GetMapping("/searchCompanyAPI")
    @org.springframework.web.bind.annotation.ResponseBody
    public java.util.List<CompanyListItemVO> searchCompanyAPI(@RequestParam("keyword") String keyword, HttpSession session) throws Exception {
        return entrprsManageService.searchCompanyListPaged(buildCompanySearchParams(keyword, "", 0, 100, resolveScopedInstitutionType(session)));
    }

    @GetMapping({"/companyJoinStatusSearch", "/ko/companyJoinStatusSearch", "/en/companyJoinStatusSearch"})
    public String companyJoinStatusSearch(HttpServletRequest request, Model model) {
        return renderJoinPage(model, "join-company-status", isEnglishJoinRequest(request));
    }

    @GetMapping({"/companyJoinStatusGuide", "/ko/companyJoinStatusGuide", "/en/companyJoinStatusGuide"})
    public String companyJoinStatusGuide(HttpServletRequest request, Model model) {
        return renderJoinPage(model, "join-company-status-guide", isEnglishJoinRequest(request));
    }

    @PostMapping(value = "/api/company-status/detail", consumes = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public ResponseEntity<Map<String, Object>> companyJoinStatusDetailApi(
            @org.springframework.web.bind.annotation.RequestBody Map<String, String> lookup,
            HttpSession session,
            HttpServletRequest request) {
        String projectId = currentProjectId();
        if (!hasText(projectId)) {
            return reapplyProjectContextUnavailable();
        }
        ResponseEntity<Map<String, Object>> globalLimit = enforcePublicLookupRateLimit(
                projectId, "company-status-detail", request, true);
        if (globalLimit != null) {
            return globalLimit;
        }
        ResponseEntity<Map<String, Object>> sessionLimit = registerCompanyStatusLookup(session);
        if (sessionLimit != null) {
            return sessionLimit;
        }
        String lookupHandle = normalized(lookup == null ? null : lookup.get("lookupHandle"));
        Map<String, Object> handleGrant = hasText(lookupHandle)
                ? resolveCompanyLookupGrant(session, lookupHandle, projectId)
                : null;
        String bizNo = normalized(lookup == null ? null : lookup.get("bizNo"));
        String appNo = normalized(lookup == null ? null : lookup.get("appNo"));
        String repName = normalized(lookup == null ? null : lookup.get("repName"));
        String registeredContact = normalized(lookup == null ? null : lookup.get("registeredContact"));
        if (hasText(lookupHandle) && handleGrant == null) {
            return statusLookupUnavailable();
        }
        if (handleGrant == null && ((!hasText(bizNo) && !hasText(appNo)) || !hasText(repName)
                || !hasText(registeredContact) || bizNo.length() > 32 || appNo.length() > 20
                || repName.length() > 100 || registeredContact.length() > 254
                || !isValidRegisteredContact(registeredContact))) {
            return statusLookupUnavailable();
        }
        try {
            InsttInfoVO searchVO = new InsttInfoVO();
            searchVO.setProjectId(projectId);
            if (handleGrant != null) {
                searchVO.setInsttId(normalized(handleGrant.get("insttId")));
                searchVO.setReprsntNm(normalized(handleGrant.get("repName")));
            } else {
                searchVO.setReprsntNm(repName);
                searchVO.setBizrno(hasText(bizNo) ? normalizeBusinessNumber(bizNo) : null);
                searchVO.setInsttId(hasText(appNo) ? appNo : null);
            }
            InstitutionStatusVO result = entrprsManageService.selectInsttInfoForStatus(searchVO);
            boolean identityMatches = handleGrant != null
                    ? result != null
                        && constantTimeEquals(normalized(result.getInsttId()), normalized(handleGrant.get("insttId")))
                        && constantTimeEquals(normalized(result.getReprsntNm()), normalized(handleGrant.get("repName")))
                    : result != null
                        && constantTimeEquals(normalized(result.getReprsntNm()), repName)
                        && matchesRegisteredContact(result, registeredContact);
            if (result == null || result.isEmpty() || !identityMatches) {
                return statusLookupUnavailable();
            }
            String publicHandle = handleGrant == null
                    ? issueCompanyLookupHandle(session, projectId, result)
                    : lookupHandle;
            Map<String, Object> response = new java.util.LinkedHashMap<>();
            response.put("success", true);
            response.put("lookupHandle", publicHandle);
            response.put("result", toPublicStatusResult(result));
            response.put("insttFiles", toPublicStatusFiles(loadInsttFiles(result.getInsttId()), session,
                    projectId, result.getInsttId()));
            return noStore(ResponseEntity.ok(response));
        } catch (Exception e) {
            log.error("Company join status detail api failed", e);
            return statusLookupUnavailable();
        }
    }

    @GetMapping({"/companyJoinStatusDetail", "/ko/companyJoinStatusDetail", "/en/companyJoinStatusDetail"})
    public String companyJoinStatusDetail(
            @RequestParam(value = "lookupHandle", required = false) String lookupHandle,
            HttpServletRequest request,
            org.springframework.ui.Model model) throws Exception {
        return renderJoinPage(model, "join-company-status", isEnglishJoinRequest(request));
    }

    /**
     * Canonicalizes case-only route variants emitted by external design ledgers.
     * Exact controller mappings continue to win; unknown one-segment paths remain 404.
     */
    @GetMapping("/{routeToken}")
    public String canonicalJoinRouteFallback(HttpServletRequest request) {
        String requestUrl = request.getRequestURI();
        if (request.getQueryString() != null && !request.getQueryString().isBlank()) {
            requestUrl += "?" + request.getQueryString();
        }
        String canonical = ReactPageUrlMapper.toCanonicalMenuUrl(requestUrl);
        String requestPath = request.getRequestURI();
        String canonicalPath = canonical.contains("?") ? canonical.substring(0, canonical.indexOf('?')) : canonical;
        if (canonical.isEmpty() || canonicalPath.equals(requestPath)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND);
        }
        return "redirect:" + canonical;
    }

    @GetMapping({"/companyReapply", "/ko/companyReapply", "/en/companyReapply"})
    public String companyReapply(HttpServletRequest request, org.springframework.ui.Model model) throws Exception {
        return renderJoinPage(model, "join-company-reapply", isEnglishJoinRequest(request));
    }

    @PostMapping(value = "/api/company-reapply/page", consumes = MediaType.APPLICATION_JSON_VALUE)
    @ResponseBody
    public ResponseEntity<Map<String, Object>> companyReapplyPageApi(
            @org.springframework.web.bind.annotation.RequestBody Map<String, String> lookup,
            HttpSession session,
            HttpServletRequest request) {
        String projectId = currentProjectId();
        if (!hasText(projectId)) {
            return reapplyProjectContextUnavailable();
        }
        ResponseEntity<Map<String, Object>> globalLimit = enforcePublicLookupRateLimit(
                projectId, "company-reapply-page", request, false);
        if (globalLimit != null) {
            return globalLimit;
        }
        ResponseEntity<Map<String, Object>> sessionLimit = registerCompanyReapplyLookup(session);
        if (sessionLimit != null) {
            return sessionLimit;
        }
        String lookupHandle = normalized(lookup == null ? null : lookup.get("lookupHandle"));
        Map<String, Object> handleGrant = hasText(lookupHandle)
                ? resolveCompanyLookupGrant(session, lookupHandle, projectId)
                : null;
        String bizNo = normalized(lookup == null ? null : lookup.get("bizNo"));
        String repName = normalized(lookup == null ? null : lookup.get("repName"));
        String registeredContact = normalized(lookup == null ? null : lookup.get("registeredContact"));
        if (hasText(lookupHandle) && handleGrant == null) {
            return reapplyLookupUnavailable();
        }
        if (handleGrant == null && (!hasText(bizNo) || !hasText(repName) || !hasText(registeredContact)
                || bizNo.length() > 32 || repName.length() > 100 || registeredContact.length() > 254
                || !isValidBusinessNumber(bizNo) || !isValidRegisteredContact(registeredContact))) {
            return reapplyLookupUnavailable();
        }
        try {
            InsttInfoVO searchVO = new InsttInfoVO();
            searchVO.setProjectId(projectId);
            if (handleGrant != null) {
                searchVO.setInsttId(normalized(handleGrant.get("insttId")));
                searchVO.setReprsntNm(normalized(handleGrant.get("repName")));
            } else {
                searchVO.setReprsntNm(repName);
                searchVO.setBizrno(normalizeBusinessNumber(bizNo));
            }
            InstitutionStatusVO result = entrprsManageService.selectInsttInfoForStatus(searchVO);
            boolean identityMatches = handleGrant != null
                    ? result != null
                        && constantTimeEquals(normalized(result.getInsttId()), normalized(handleGrant.get("insttId")))
                        && constantTimeEquals(normalized(result.getReprsntNm()), normalized(handleGrant.get("repName")))
                    : result != null && matchesRegisteredContact(result, registeredContact);
            if (result == null || result.isEmpty() || !identityMatches || !"R".equals(result.getInsttSttus())) {
                return reapplyLookupUnavailable();
            }
            String publicHandle = handleGrant == null
                    ? issueCompanyLookupHandle(session, projectId, result)
                    : lookupHandle;
            String reapplyToken = issueCompanyReapplyToken(session, result, projectId);
            Map<String, Object> response = new java.util.LinkedHashMap<>();
            response.put("success", true);
            response.put("lookupHandle", publicHandle);
            response.put("result", toPublicReapplyResult(result));
            response.put("insttFiles", toPublicReapplyFiles(loadInsttFiles(result.getInsttId())));
            response.put("reapplyToken", reapplyToken);
            response.put("reapplyTokenExpiresInSeconds", REAPPLY_TOKEN_TTL_MILLIS / 1000L);
            return noStore(ResponseEntity.ok(response));
        } catch (Exception e) {
            log.error("Company reapply page api failed", e);
            return reapplyLookupUnavailable();
        }
    }

    @PostMapping(value = "/api/company-reapply", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseBody
    public ResponseEntity<Map<String, Object>> companyReapplySubmitApi(
            @RequestParam("insttId") String insttId,
            @RequestParam("agencyName") String agencyName,
            @RequestParam("representativeName") String repName,
            @RequestParam("bizRegistrationNumber") String bizNo,
            @RequestParam("zipCode") String zipCode,
            @RequestParam("companyAddress") String addr,
            @RequestParam(value = "companyAddressDetail", required = false) String detailAddr,
            @RequestParam(value = "chargerName", required = false) String chargerNm,
            @RequestParam(value = "chargerEmail", required = false) String chargerEmail,
            @RequestParam(value = "chargerTel", required = false) String chargerTel,
            @RequestParam(value = "applicantResponse", required = false) String applicantResponse,
            @RequestParam(value = "reapplyToken", required = false) String reapplyToken,
            @RequestParam(value = "fileUploads", required = false) java.util.List<org.springframework.web.multipart.MultipartFile> fileUploads,
            HttpSession session,
            HttpServletRequest request) {
        String projectId = currentProjectId();
        ResponseEntity<Map<String, Object>> globalLimit = enforcePublicLookupRateLimit(
                projectId, "company-reapply-submit", request, false);
        if (globalLimit != null) {
            return globalLimit;
        }
        return noStore(processCompanyReapply(insttId, agencyName, repName, bizNo, zipCode, addr, detailAddr,
                chargerNm, chargerEmail, chargerTel, applicantResponse, reapplyToken, fileUploads, session));
    }

    @PostMapping({"/companyReapplySubmit", "/ko/companyReapplySubmit", "/en/companyReapplySubmit"})
    @ResponseBody
    public ResponseEntity<Map<String, Object>> legacyCompanyReapplySubmit() {
        return noStore(ResponseEntity.status(HttpStatus.GONE).body(Map.of(
                "success", false,
                "errorCode", "LEGACY_REAPPLICATION_ENDPOINT_RETIRED",
                "message", "지원이 종료된 제출 경로입니다. 최신 재신청 화면을 이용해 주세요.")));
    }

    @GetMapping("/downloadInsttFile")
    public void downloadInsttFile(@RequestParam("downloadToken") String downloadToken,
            HttpSession session,
            jakarta.servlet.http.HttpServletResponse response) throws Exception {
        response.setHeader("Cache-Control", "no-store");
        response.setHeader("Pragma", "no-cache");
        String projectId = currentProjectId();
        if (!hasText(projectId)) {
            response.sendError(503, "Project context is unavailable.");
            return;
        }
        Map<String, Object> grant = resolveStatusDownloadGrant(session, downloadToken);
        if (grant == null || !constantTimeEquals(projectId, normalized(grant.get("projectId")))) {
            response.sendError(403, "Download authorization is invalid or expired.");
            return;
        }
        String fileId = normalized(grant.get("fileId"));
        InsttFileVO fileVO = entrprsManageService.selectInsttFileByFileId(fileId);
        if (fileVO == null
                || !constantTimeEquals(normalized(grant.get("insttId")), normalized(fileVO.getInsttId()))
                || !constantTimeEquals(normalized(grant.get("fileSha256")), normalized(fileVO.getFileSha256()))
                || !hasText(fileVO.getFileStrePath())) {
            response.sendError(404, "File not found or access denied.");
            return;
        }

        File file = new File(fileVO.getFileStrePath());
        File insttDir = resolveInsttUploadDir();
        String canonicalDir = insttDir.getCanonicalPath();
        if (!canonicalDir.endsWith(File.separator)) {
            canonicalDir += File.separator;
        }
        String canonicalFile = file.getCanonicalPath();
        if (!file.exists() || !canonicalFile.startsWith(canonicalDir)
                || !constantTimeEquals(fileVO.getFileSha256(), InstitutionEvidenceFileSupport.sha256(file.toPath()))) {
            response.sendError(404, "File not found or access denied.");
            return;
        }

        String originalName = fileVO.getOrignlFileNm();
        String fileName = hasText(originalName) ? originalName : file.getName();
        response.setContentType("application/octet-stream");
        response.setHeader("Content-Disposition",
                "attachment; filename=\"" + java.net.URLEncoder.encode(fileName, "UTF-8") + "\"");
        try (java.io.FileInputStream fis = new java.io.FileInputStream(file);
                java.io.OutputStream os = response.getOutputStream()) {
            byte[] buffer = new byte[4096];
            int bytesRead;
            while ((bytesRead = fis.read(buffer)) != -1) {
                os.write(buffer, 0, bytesRead);
            }
            os.flush();
        }
    }

    private List<InsttFileVO> loadInsttFiles(Object insttId) {
        String normalizedInsttId = insttId == null ? "" : String.valueOf(insttId).trim();
        if (!hasText(normalizedInsttId) || "null".equalsIgnoreCase(normalizedInsttId)) {
            return java.util.Collections.emptyList();
        }
        try {
            List<InsttFileVO> fileList = entrprsManageService.selectInsttFiles(normalizedInsttId);
            return fileList == null ? java.util.Collections.emptyList() : fileList;
        } catch (Exception e) {
            log.warn("Failed to load institution files. insttId={}", normalizedInsttId, e);
            return java.util.Collections.emptyList();
        }
    }

    private ResponseEntity<Map<String, Object>> processCompanyReapply(
            String insttId,
            String agencyName,
            String repName,
            String bizNo,
            String zipCode,
            String addr,
            String detailAddr,
            String chargerNm,
            String chargerEmail,
            String chargerTel,
            String applicantResponse,
            String reapplyToken,
            List<MultipartFile> fileUploads,
            HttpSession session) {
        String projectId = currentProjectId();
        if (!hasText(projectId)) {
            return reapplyProjectContextUnavailable();
        }
        ResponseEntity<Map<String, Object>> validation = validateCompanyReapplyRequest(
                insttId, agencyName, repName, bizNo, zipCode, addr, detailAddr, chargerNm, chargerEmail, chargerTel, applicantResponse, fileUploads);
        if (validation != null) {
            return validation;
        }
        if (!hasText(reapplyToken)) {
            return reapplyError(HttpStatus.FORBIDDEN, "REAPPLY_TOKEN_REQUIRED",
                    "재신청 조회 후 발급된 보안 토큰이 필요합니다.");
        }
        String normalizedInsttId = insttId.trim();
        String normalizedBizNo = normalizeBusinessNumber(bizNo);
        if (!consumeCompanyReapplyToken(session, reapplyToken, normalizedInsttId, bizNo, projectId)) {
            return reapplyError(HttpStatus.FORBIDDEN, "REAPPLY_TOKEN_INVALID_OR_EXPIRED",
                    "재신청 보안 토큰이 만료되었거나 유효하지 않습니다. 신청 내역을 다시 조회해 주세요.");
        }

        InstitutionStatusVO current;
        InsttInfoVO vo;
        int nextFileSn;
        try {
            InsttInfoVO searchVO = new InsttInfoVO();
            searchVO.setInsttId(normalizedInsttId);
            searchVO.setProjectId(projectId);
            current = entrprsManageService.selectInsttInfoForStatus(searchVO);
            boolean stableIdentityMatches = current != null && !current.isEmpty()
                    && constantTimeEquals(normalized(current.getInsttId()), normalizedInsttId)
                    && constantTimeEquals(normalizeBusinessNumber(current.getBizrno()), normalizedBizNo);
            if (!stableIdentityMatches || !"R".equals(current.getInsttSttus())) {
                return reapplyError(HttpStatus.CONFLICT, "REAPPLY_STATE_CONFLICT",
                        "재신청 대상이 이미 처리되었거나 상태가 변경되었습니다.");
            }

            vo = new InsttInfoVO();
            vo.setInsttId(normalizedInsttId);
            vo.setProjectId(projectId);
            vo.setInsttNm(agencyName.trim());
            vo.setReprsntNm(repName.trim());
            vo.setBizrno(normalizedBizNo);
            vo.setZip(zipCode.trim());
            vo.setAdres(addr.trim());
            vo.setDetailAdres(detailAddr == null ? null : detailAddr.trim());
            vo.setChargerNm(chargerNm.trim());
            vo.setChargerEmail(chargerEmail.trim());
            vo.setChargerTel(chargerTel.trim());
            vo.setInsttSttus("A");
            vo.setEntrprsSeCode(hasText(current.getEntrprsSeCode())
                    ? current.getEntrprsSeCode() : resolveScopedInstitutionType(null));

            List<InsttFileVO> existingFiles = entrprsManageService.selectInsttFiles(normalizedInsttId);
            nextFileSn = existingFiles == null ? 1 : existingFiles.size() + 1;
        } catch (Exception preparationError) {
            log.error("Company reapply preparation failed. insttId={}", normalizedInsttId, preparationError);
            return reapplyError(HttpStatus.INTERNAL_SERVER_ERROR, "REAPPLY_PERSISTENCE_FAILED",
                    "처리 중 오류가 발생했습니다. 신청 내역을 다시 조회한 뒤 재시도해 주세요.");
        }

        // Only this phase owns newly written physical files. If transactional persistence
        // fails or reports a conditional-update conflict, the DB rolls back and these files
        // must be removed. Once reapplyInstitution returns a receipt, its transaction has
        // committed and no later response/session failure may delete the committed evidence.
        List<InsttFileVO> savedFiles = java.util.Collections.emptyList();
        Map<String, Object> receipt;
        try {
            // 기존 증빙은 감사 추적을 위해 보존한다. 이번 재신청에서 추가한 증빙만
            // 원자 서비스와 audit evidence_file_count에 전달한다.
            savedFiles = saveInsttEvidenceFiles(normalizedInsttId, fileUploads, nextFileSn);
            vo.setBizRegFilePath(joinInsttEvidencePaths(savedFiles));
            receipt = entrprsManageService.reapplyInstitution(vo, savedFiles, current.getRjctRsn(), applicantResponse.trim());
            if (receipt == null || receipt.isEmpty()) {
                cleanupInsttEvidenceFiles(savedFiles);
                return reapplyError(HttpStatus.CONFLICT, "REAPPLY_STATE_CONFLICT",
                        "다른 요청에서 재신청이 먼저 처리되었습니다. 신청 상태를 다시 조회해 주세요.");
            }
        } catch (Exception persistenceError) {
            cleanupInsttEvidenceFiles(savedFiles);
            log.error("Company reapply persistence failed. insttId={}", normalizedInsttId, persistenceError);
            return reapplyError(HttpStatus.INTERNAL_SERVER_ERROR, "REAPPLY_PERSISTENCE_FAILED",
                    "처리 중 오류가 발생했습니다. 신청 내역을 다시 조회한 뒤 재시도해 주세요.");
        }

        Map<String, Object> response = new java.util.LinkedHashMap<>();
        response.put("success", true);
        response.put("insttId", normalizedInsttId);
        response.put("insttNm", agencyName.trim());
        response.put("bizrno", normalizedBizNo);
        response.put("status", "APPLIED");
        response.put("regDate", java.time.LocalDateTime.now()
                .format(java.time.format.DateTimeFormatter.ofPattern("yyyy.MM.dd HH:mm:ss")));
        String lookupHandle = "";
        try {
            InstitutionStatusVO committedIdentity = new InstitutionStatusVO();
            committedIdentity.setInsttId(normalizedInsttId);
            committedIdentity.setReprsntNm(repName.trim());
            lookupHandle = issueCompanyLookupHandle(session, projectId, committedIdentity);
        } catch (Exception handleError) {
            // Persistence is already committed. Preserve evidence and return the successful
            // receipt; the customer can open the status search page for a new handle.
            log.warn("Company reapply committed but status lookup handle could not be issued. insttId={}",
                    normalizedInsttId, handleError);
        }
        response.put("lookupHandle", lookupHandle);
        response.put("receipt", receipt);
        return ResponseEntity.ok(response);
    }

    private ResponseEntity<Map<String, Object>> validateCompanyReapplyRequest(
            String insttId, String agencyName, String repName, String bizNo, String zipCode, String addr, String detailAddr,
            String chargerNm, String chargerEmail, String chargerTel, String applicantResponse, List<MultipartFile> fileUploads) {
        List<String> missingFields = new ArrayList<>();
        addMissingField(missingFields, "insttId", insttId);
        addMissingField(missingFields, "agencyName", agencyName);
        addMissingField(missingFields, "representativeName", repName);
        addMissingField(missingFields, "bizRegistrationNumber", bizNo);
        addMissingField(missingFields, "zipCode", zipCode);
        addMissingField(missingFields, "companyAddress", addr);
        addMissingField(missingFields, "chargerName", chargerNm);
        addMissingField(missingFields, "chargerEmail", chargerEmail);
        addMissingField(missingFields, "chargerTel", chargerTel);
        addMissingField(missingFields, "applicantResponse", applicantResponse);
        if (!missingFields.isEmpty()) {
            Map<String, Object> response = new java.util.LinkedHashMap<>();
            response.put("success", false);
            response.put("errorCode", "REQUIRED_FIELDS_MISSING");
            response.put("message", "필수 입력 항목을 확인해 주세요.");
            response.put("missingFields", missingFields);
            return ResponseEntity.badRequest().body(response);
        }
        Map<String, Integer> lengthLimits = new java.util.LinkedHashMap<>();
        lengthLimits.put("insttId", InstitutionEvidenceFileSupport.MAX_INSTITUTION_ID_LENGTH);
        lengthLimits.put("agencyName", 200);
        lengthLimits.put("representativeName", 100);
        lengthLimits.put("bizRegistrationNumber", 20);
        lengthLimits.put("zipCode", 10);
        lengthLimits.put("companyAddress", 500);
        lengthLimits.put("companyAddressDetail", 500);
        lengthLimits.put("chargerName", 100);
        lengthLimits.put("chargerEmail", 254);
        lengthLimits.put("chargerTel", 30);
        lengthLimits.put("applicantResponse", 2000);
        Map<String, String> values = new java.util.LinkedHashMap<>();
        values.put("insttId", insttId);
        values.put("agencyName", agencyName);
        values.put("representativeName", repName);
        values.put("bizRegistrationNumber", bizNo);
        values.put("zipCode", zipCode);
        values.put("companyAddress", addr);
        values.put("companyAddressDetail", detailAddr);
        values.put("chargerName", chargerNm);
        values.put("chargerEmail", chargerEmail);
        values.put("chargerTel", chargerTel);
        values.put("applicantResponse", applicantResponse);
        List<String> oversizedFields = new ArrayList<>();
        for (Map.Entry<String, Integer> limit : lengthLimits.entrySet()) {
            String value = values.get(limit.getKey());
            if (value != null && value.length() > limit.getValue()) {
                oversizedFields.add(limit.getKey());
            }
        }
        if (!oversizedFields.isEmpty()) {
            Map<String, Object> response = new java.util.LinkedHashMap<>();
            response.put("success", false);
            response.put("errorCode", "FIELD_LENGTH_EXCEEDED");
            response.put("message", "입력 가능한 최대 길이를 초과한 항목이 있습니다.");
            response.put("invalidFields", oversizedFields);
            return ResponseEntity.badRequest().body(response);
        }
        if (!isValidBusinessNumber(bizNo)) {
            return reapplyError(HttpStatus.BAD_REQUEST, "INVALID_BUSINESS_NUMBER", "사업자등록번호는 숫자 10자리로 입력해 주세요.");
        }
        if (applicantResponse.trim().length() < 10) {
            return reapplyError(HttpStatus.BAD_REQUEST, "INVALID_APPLICANT_RESPONSE",
                    "보완·재신청 내용은 10자 이상 입력해 주세요.");
        }
        if (!isFiveDigitZipCode(zipCode)) {
            return reapplyError(HttpStatus.BAD_REQUEST, "INVALID_ZIP_CODE", "우편번호는 숫자 5자리로 입력해 주세요.");
        }
        if (!chargerEmail.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$")) {
            return reapplyError(HttpStatus.BAD_REQUEST, "INVALID_CHARGER_EMAIL", "담당자 이메일 형식을 확인해 주세요.");
        }
        if (!isValidTelephone(chargerTel)) {
            return reapplyError(HttpStatus.BAD_REQUEST, "INVALID_CHARGER_TEL", "담당자 연락처 형식을 확인해 주세요.");
        }
        if (!hasValidReapplyEvidenceFiles(fileUploads)) {
            return reapplyError(HttpStatus.BAD_REQUEST, "INVALID_EVIDENCE_FILE",
                    "PDF, JPG, JPEG, PNG 증빙을 최대 10개까지, 파일당 10MB 이하로 첨부해 주세요.");
        }
        return null;
    }

    private void addMissingField(List<String> missingFields, String fieldName, String value) {
        if (!hasText(value)) {
            missingFields.add(fieldName);
        }
    }

    private boolean isValidTelephone(String value) {
        int digitCount = 0;
        for (int i = 0; i < value.length(); i++) {
            char ch = value.charAt(i);
            if (Character.isDigit(ch)) {
                digitCount++;
            } else if (ch != '+' && ch != '-' && ch != '(' && ch != ')' && !Character.isWhitespace(ch)) {
                return false;
            }
        }
        return digitCount >= 8 && digitCount <= 15;
    }

    private boolean isValidBusinessNumber(String value) {
        if (!hasText(value)) {
            return false;
        }
        int digitCount = 0;
        String trimmed = value.trim();
        for (int i = 0; i < trimmed.length(); i++) {
            char ch = trimmed.charAt(i);
            if (Character.isDigit(ch)) {
                digitCount++;
            } else if (ch != '-') {
                return false;
            }
        }
        return digitCount == 10;
    }

    private String normalizeBusinessNumber(String value) {
        if (value == null) {
            return "";
        }
        StringBuilder digits = new StringBuilder(10);
        for (int i = 0; i < value.length(); i++) {
            if (Character.isDigit(value.charAt(i))) {
                digits.append(value.charAt(i));
            }
        }
        return digits.toString();
    }

    private boolean isFiveDigitZipCode(String value) {
        if (value == null || value.trim().length() != 5) {
            return false;
        }
        String trimmed = value.trim();
        for (int i = 0; i < trimmed.length(); i++) {
            if (!Character.isDigit(trimmed.charAt(i))) {
                return false;
            }
        }
        return true;
    }

    private boolean hasValidReapplyEvidenceFiles(List<MultipartFile> fileUploads) {
        if (fileUploads == null || fileUploads.isEmpty() || fileUploads.size() > 10) {
            return false;
        }
        boolean hasRealFile = false;
        for (MultipartFile file : fileUploads) {
            if (file == null || file.isEmpty()) {
                continue;
            }
            hasRealFile = true;
            if (file.getSize() <= 0L || file.getSize() > 10L * 1024L * 1024L) {
                return false;
            }
            String name = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase();
            String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase();
            boolean pdf = name.endsWith(".pdf") && "application/pdf".equals(contentType);
            boolean jpeg = (name.endsWith(".jpg") || name.endsWith(".jpeg"))
                    && ("image/jpeg".equals(contentType) || "image/jpg".equals(contentType));
            boolean png = name.endsWith(".png") && "image/png".equals(contentType);
            if (!pdf && !jpeg && !png) {
                return false;
            }
            byte[] header = new byte[8];
            int read = 0;
            try (java.io.InputStream input = file.getInputStream()) {
                while (read < header.length) {
                    int count = input.read(header, read, header.length - read);
                    if (count < 0) break;
                    read += count;
                }
            } catch (Exception readError) {
                return false;
            }
            boolean magicMatches = pdf && read >= 4
                    && header[0] == '%' && header[1] == 'P' && header[2] == 'D' && header[3] == 'F';
            magicMatches = magicMatches || (jpeg && read >= 3
                    && (header[0] & 0xff) == 0xff && (header[1] & 0xff) == 0xd8 && (header[2] & 0xff) == 0xff);
            magicMatches = magicMatches || (png && read >= 8
                    && (header[0] & 0xff) == 0x89 && header[1] == 'P' && header[2] == 'N' && header[3] == 'G'
                    && (header[4] & 0xff) == 0x0d && (header[5] & 0xff) == 0x0a
                    && (header[6] & 0xff) == 0x1a && (header[7] & 0xff) == 0x0a);
            if (!magicMatches) return false;
        }
        return hasRealFile;
    }

    private Map<String, Object> toPublicReapplyResult(InstitutionStatusVO result) {
        Map<String, Object> publicResult = new java.util.LinkedHashMap<>();
        publicResult.put("insttId", result.getInsttId());
        publicResult.put("insttNm", result.getInsttNm());
        publicResult.put("reprsntNm", result.getReprsntNm());
        publicResult.put("bizrno", result.getBizrno());
        publicResult.put("zip", result.getZip());
        publicResult.put("adres", result.getAdres());
        publicResult.put("insttSttus", result.getInsttSttus());
        publicResult.put("rjctRsn", result.getRjctRsn());
        publicResult.put("rjctPnttm", result.getRjctPnttm());
        publicResult.put("entrprsSeCode", result.getEntrprsSeCode());
        return publicResult;
    }

    private List<Map<String, Object>> toPublicReapplyFiles(List<InsttFileVO> files) {
        List<Map<String, Object>> publicFiles = new ArrayList<>();
        for (InsttFileVO file : files) {
            if (file == null) {
                continue;
            }
            Map<String, Object> publicFile = new java.util.LinkedHashMap<>();
            publicFile.put("fileSn", file.getFileSn());
            publicFile.put("orignlFileNm", file.getOrignlFileNm());
            publicFile.put("fileMg", file.getFileMg());
            publicFile.put("fileExtsn", file.getFileExtsn());
            publicFile.put("regDate", file.getRegDate());
            publicFiles.add(publicFile);
        }
        return publicFiles;
    }

    private String issueCompanyReapplyToken(HttpSession session, InstitutionStatusVO result, String projectId) {
        String token = UUID.randomUUID().toString();
        synchronized (session) {
            session.setAttribute(SESSION_REAPPLY_TOKEN, token);
            session.setAttribute(SESSION_REAPPLY_TOKEN_EXPIRES_AT,
                    System.currentTimeMillis() + REAPPLY_TOKEN_TTL_MILLIS);
            session.setAttribute(SESSION_REAPPLY_TOKEN_INSTT_ID, normalized(result.getInsttId()));
            session.setAttribute(SESSION_REAPPLY_TOKEN_BIZ_NO, normalizeBusinessNumber(result.getBizrno()));
            session.setAttribute(SESSION_REAPPLY_TOKEN_PROJECT_ID, normalized(projectId));
        }
        return token;
    }

    private boolean consumeCompanyReapplyToken(HttpSession session, String token, String insttId, String bizNo,
            String projectId) {
        if (session == null) {
            return false;
        }
        synchronized (session) {
            Object storedToken = session.getAttribute(SESSION_REAPPLY_TOKEN);
            Object expiresAt = session.getAttribute(SESSION_REAPPLY_TOKEN_EXPIRES_AT);
            boolean valid = storedToken instanceof String
                    && expiresAt instanceof Number
                    && ((Number) expiresAt).longValue() >= System.currentTimeMillis()
                    && constantTimeEquals((String) storedToken, token)
                    && constantTimeEquals(normalized(session.getAttribute(SESSION_REAPPLY_TOKEN_INSTT_ID)), normalized(insttId))
                    && constantTimeEquals(normalized(session.getAttribute(SESSION_REAPPLY_TOKEN_BIZ_NO)), normalizeBusinessNumber(bizNo))
                    && constantTimeEquals(normalized(session.getAttribute(SESSION_REAPPLY_TOKEN_PROJECT_ID)), normalized(projectId));
            clearCompanyReapplyToken(session);
            return valid;
        }
    }

    private void clearCompanyReapplyToken(HttpSession session) {
        session.removeAttribute(SESSION_REAPPLY_TOKEN);
        session.removeAttribute(SESSION_REAPPLY_TOKEN_EXPIRES_AT);
        session.removeAttribute(SESSION_REAPPLY_TOKEN_INSTT_ID);
        session.removeAttribute(SESSION_REAPPLY_TOKEN_BIZ_NO);
        session.removeAttribute(SESSION_REAPPLY_TOKEN_PROJECT_ID);
    }

    private boolean constantTimeEquals(String expected, String actual) {
        if (expected == null || actual == null) {
            return false;
        }
        return MessageDigest.isEqual(expected.getBytes(StandardCharsets.UTF_8), actual.getBytes(StandardCharsets.UTF_8));
    }

    private String normalized(Object value) {
        return value == null ? "" : String.valueOf(value).trim();
    }

    private String currentProjectId() {
        return projectRuntimeContext == null || projectRuntimeContext.getProjectId() == null
                ? "" : projectRuntimeContext.getProjectId().trim();
    }

    private boolean isValidRegisteredContact(String value) {
        if (!hasText(value)) {
            return false;
        }
        String trimmed = value.trim();
        return trimmed.matches("^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$") || isValidTelephone(trimmed);
    }

    private boolean matchesRegisteredContact(InstitutionStatusVO result, String suppliedContact) {
        String supplied = normalizeContact(suppliedContact);
        boolean emailMatch = constantTimeEquals(normalizeContact(result.getChargerEmail()), supplied);
        boolean telephoneMatch = constantTimeEquals(normalizeContact(result.getChargerTel()), supplied);
        return emailMatch | telephoneMatch;
    }

    private String normalizeContact(String value) {
        if (!hasText(value)) {
            return "";
        }
        String trimmed = value.trim();
        if (trimmed.indexOf('@') >= 0) {
            return trimmed.toLowerCase(java.util.Locale.ROOT);
        }
        StringBuilder digits = new StringBuilder();
        for (int i = 0; i < trimmed.length(); i++) {
            if (Character.isDigit(trimmed.charAt(i))) {
                digits.append(trimmed.charAt(i));
            }
        }
        return digits.toString();
    }

    private Map<String, Object> toPublicStatusResult(InstitutionStatusVO result) {
        Map<String, Object> value = new java.util.LinkedHashMap<>();
        value.put("insttId", result.getInsttId());
        value.put("insttNm", result.getInsttNm());
        value.put("reprsntNm", result.getReprsntNm());
        value.put("bizrno", result.getBizrno());
        value.put("entrprsSeCode", result.getEntrprsSeCode());
        value.put("insttSttus", result.getInsttSttus());
        value.put("rjctRsn", result.getRjctRsn());
        value.put("rjctPnttm", result.getRjctPnttm());
        value.put("frstRegistPnttm", result.getFrstRegistPnttm());
        value.put("lastUpdtPnttm", result.getLastUpdtPnttm());
        return value;
    }

    private List<Map<String, Object>> toPublicStatusFiles(List<InsttFileVO> files, HttpSession session,
            String projectId, String insttId) {
        List<Map<String, Object>> publicFiles = new ArrayList<>();
        if (files == null) {
            return publicFiles;
        }
        for (InsttFileVO file : files) {
            if (file == null || !hasText(file.getFileId()) || !hasText(file.getFileSha256())) {
                continue;
            }
            Map<String, Object> publicFile = new java.util.LinkedHashMap<>();
            publicFile.put("fileSn", file.getFileSn());
            publicFile.put("orignlFileNm", file.getOrignlFileNm());
            publicFile.put("fileMg", file.getFileMg());
            publicFile.put("fileExtsn", file.getFileExtsn());
            publicFile.put("regDate", file.getRegDate());
            publicFile.put("downloadToken", issueStatusDownloadToken(session, projectId, insttId,
                    file.getFileId(), file.getFileSha256()));
            publicFiles.add(publicFile);
        }
        return publicFiles;
    }

    @SuppressWarnings("unchecked")
    private String issueCompanyLookupHandle(HttpSession session, String projectId, InstitutionStatusVO result) {
        if (session == null || result == null || !hasText(result.getInsttId()) || !hasText(result.getReprsntNm())) {
            throw new IllegalStateException("Session and institution identity are required for a lookup handle.");
        }
        synchronized (session) {
            long now = System.currentTimeMillis();
            Object raw = session.getAttribute(SESSION_COMPANY_LOOKUP_GRANTS);
            Map<String, Map<String, Object>> existing = raw instanceof Map
                    ? (Map<String, Map<String, Object>>) raw
                    : java.util.Collections.emptyMap();
            java.util.LinkedHashMap<String, Map<String, Object>> grants = new java.util.LinkedHashMap<>();
            for (Map.Entry<String, Map<String, Object>> entry : existing.entrySet()) {
                Object expiresAt = entry.getValue() == null ? null : entry.getValue().get("expiresAt");
                if (expiresAt instanceof Number && ((Number) expiresAt).longValue() >= now) {
                    grants.put(entry.getKey(), new java.util.LinkedHashMap<>(entry.getValue()));
                }
            }
            while (grants.size() >= COMPANY_LOOKUP_HANDLE_MAX_GRANTS) {
                grants.remove(grants.keySet().iterator().next());
            }
            String handle = UUID.randomUUID().toString();
            Map<String, Object> grant = new java.util.LinkedHashMap<>();
            grant.put("projectId", projectId);
            grant.put("insttId", result.getInsttId());
            grant.put("repName", result.getReprsntNm());
            grant.put("expiresAt", now + COMPANY_LOOKUP_HANDLE_TTL_MILLIS);
            grants.put(handle, grant);
            session.setAttribute(SESSION_COMPANY_LOOKUP_GRANTS, grants);
            return handle;
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> resolveCompanyLookupGrant(HttpSession session, String handle, String projectId) {
        if (session == null || !hasText(handle) || handle.length() > 64 || !hasText(projectId)) {
            return null;
        }
        synchronized (session) {
            Object raw = session.getAttribute(SESSION_COMPANY_LOOKUP_GRANTS);
            if (!(raw instanceof Map)) {
                return null;
            }
            Map<String, Map<String, Object>> grants = (Map<String, Map<String, Object>>) raw;
            Map<String, Object> grant = grants.get(handle);
            Object expiresAt = grant == null ? null : grant.get("expiresAt");
            if (!(expiresAt instanceof Number) || ((Number) expiresAt).longValue() < System.currentTimeMillis()
                    || !constantTimeEquals(projectId, normalized(grant.get("projectId")))) {
                grants.remove(handle);
                session.setAttribute(SESSION_COMPANY_LOOKUP_GRANTS, grants);
                return null;
            }
            return new java.util.LinkedHashMap<>(grant);
        }
    }

    @SuppressWarnings("unchecked")
    private String issueStatusDownloadToken(HttpSession session, String projectId, String insttId,
            String fileId, String fileSha256) {
        if (session == null) {
            throw new IllegalStateException("Session is required for status file authorization.");
        }
        synchronized (session) {
            long now = System.currentTimeMillis();
            Map<String, Map<String, Object>> existing = session.getAttribute(SESSION_STATUS_DOWNLOAD_GRANTS) instanceof Map
                    ? (Map<String, Map<String, Object>>) session.getAttribute(SESSION_STATUS_DOWNLOAD_GRANTS)
                    : java.util.Collections.emptyMap();
            java.util.LinkedHashMap<String, Map<String, Object>> grants = new java.util.LinkedHashMap<>();
            for (Map.Entry<String, Map<String, Object>> entry : existing.entrySet()) {
                Object expiresAt = entry.getValue() == null ? null : entry.getValue().get("expiresAt");
                if (expiresAt instanceof Number && ((Number) expiresAt).longValue() >= now) {
                    grants.put(entry.getKey(), new java.util.LinkedHashMap<>(entry.getValue()));
                }
            }
            while (grants.size() >= STATUS_DOWNLOAD_TOKEN_MAX_GRANTS) {
                grants.remove(grants.keySet().iterator().next());
            }
            String token = UUID.randomUUID().toString();
            Map<String, Object> grant = new java.util.LinkedHashMap<>();
            grant.put("projectId", projectId);
            grant.put("insttId", insttId);
            grant.put("fileId", fileId);
            grant.put("fileSha256", fileSha256);
            grant.put("expiresAt", now + STATUS_DOWNLOAD_TOKEN_TTL_MILLIS);
            grants.put(token, grant);
            session.setAttribute(SESSION_STATUS_DOWNLOAD_GRANTS, grants);
            return token;
        }
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> resolveStatusDownloadGrant(HttpSession session, String token) {
        if (session == null || !hasText(token)) {
            return null;
        }
        synchronized (session) {
            Object raw = session.getAttribute(SESSION_STATUS_DOWNLOAD_GRANTS);
            if (!(raw instanceof Map)) {
                return null;
            }
            Map<String, Map<String, Object>> grants = (Map<String, Map<String, Object>>) raw;
            Map<String, Object> grant = grants.get(token);
            Object expiresAt = grant == null ? null : grant.get("expiresAt");
            if (!(expiresAt instanceof Number) || ((Number) expiresAt).longValue() < System.currentTimeMillis()) {
                grants.remove(token);
                session.setAttribute(SESSION_STATUS_DOWNLOAD_GRANTS, grants);
                return null;
            }
            return new java.util.LinkedHashMap<>(grant);
        }
    }

    private ResponseEntity<Map<String, Object>> statusLookupUnavailable() {
        return statusLookupUnavailable(HttpStatus.BAD_REQUEST);
    }

    private ResponseEntity<Map<String, Object>> statusLookupUnavailable(HttpStatus status) {
        return reapplyError(status, "STATUS_LOOKUP_NOT_AVAILABLE",
                "입력하신 정보로 조회 가능한 신청 내역을 확인할 수 없습니다.");
    }

    private ResponseEntity<Map<String, Object>> enforcePublicLookupRateLimit(
            String projectId, String endpointCode, HttpServletRequest request, boolean statusLookup) {
        String remoteAddress = request == null ? "" : normalized(request.getRemoteAddr());
        egovframework.com.common.security.PublicLookupRateLimitService.Decision decision =
                publicLookupRateLimitService == null
                        ? egovframework.com.common.security.PublicLookupRateLimitService.Decision.unavailable(
                                REAPPLY_LOOKUP_WINDOW_MILLIS / 1000L)
                        : publicLookupRateLimitService.check(projectId, endpointCode, remoteAddress,
                                REAPPLY_LOOKUP_MAX_REQUESTS, REAPPLY_LOOKUP_WINDOW_MILLIS / 1000L);
        if (decision.isAllowed()) {
            return null;
        }
        ResponseEntity<Map<String, Object>> denied = statusLookup
                ? statusLookupUnavailable(HttpStatus.TOO_MANY_REQUESTS)
                : reapplyError(HttpStatus.TOO_MANY_REQUESTS, "REAPPLY_LOOKUP_NOT_AVAILABLE",
                        "입력하신 정보로 조회 가능한 신청 내역을 확인할 수 없습니다.");
        org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
        headers.putAll(denied.getHeaders());
        headers.set("Retry-After", String.valueOf(Math.max(1L, decision.getRetryAfterSeconds())));
        return new ResponseEntity<>(denied.getBody(), headers, denied.getStatusCode());
    }

    private ResponseEntity<Map<String, Object>> registerCompanyStatusLookup(HttpSession session) {
        if (session == null) {
            return statusLookupUnavailable(HttpStatus.TOO_MANY_REQUESTS);
        }
        synchronized (session) {
            long now = System.currentTimeMillis();
            Object startedValue = session.getAttribute(SESSION_STATUS_LOOKUP_WINDOW_STARTED_AT);
            Object countValue = session.getAttribute(SESSION_STATUS_LOOKUP_COUNT);
            long startedAt = startedValue instanceof Number ? ((Number) startedValue).longValue() : now;
            int count = countValue instanceof Number ? ((Number) countValue).intValue() : 0;
            if (now - startedAt >= REAPPLY_LOOKUP_WINDOW_MILLIS) {
                startedAt = now;
                count = 0;
            }
            if (count >= REAPPLY_LOOKUP_MAX_REQUESTS) {
                return statusLookupUnavailable(HttpStatus.TOO_MANY_REQUESTS);
            }
            session.setAttribute(SESSION_STATUS_LOOKUP_WINDOW_STARTED_AT, startedAt);
            session.setAttribute(SESSION_STATUS_LOOKUP_COUNT, count + 1);
            return null;
        }
    }

    private ResponseEntity<Map<String, Object>> reapplyProjectContextUnavailable() {
        return reapplyError(HttpStatus.SERVICE_UNAVAILABLE, "REAPPLY_PROJECT_CONTEXT_UNAVAILABLE",
                "프로젝트 실행 컨텍스를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.");
    }

    private ResponseEntity<Map<String, Object>> reapplyLookupUnavailable() {
        return reapplyError(HttpStatus.BAD_REQUEST, "REAPPLY_LOOKUP_NOT_AVAILABLE",
                "입력하신 정보로 재신청 가능한 내역을 확인할 수 없습니다.");
    }

    private ResponseEntity<Map<String, Object>> registerCompanyReapplyLookup(HttpSession session) {
        if (session == null) {
            return reapplyError(HttpStatus.TOO_MANY_REQUESTS, "REAPPLY_LOOKUP_RATE_LIMIT_UNAVAILABLE",
                    "조회 보호 기능을 사용할 수 없습니다. 새 브라우저 세션에서 다시 시도해 주세요.");
        }
        synchronized (session) {
            long now = System.currentTimeMillis();
            Object startedValue = session.getAttribute(SESSION_REAPPLY_LOOKUP_WINDOW_STARTED_AT);
            Object countValue = session.getAttribute(SESSION_REAPPLY_LOOKUP_COUNT);
            long startedAt = startedValue instanceof Number ? ((Number) startedValue).longValue() : now;
            int count = countValue instanceof Number ? ((Number) countValue).intValue() : 0;
            if (now - startedAt >= REAPPLY_LOOKUP_WINDOW_MILLIS) {
                startedAt = now;
                count = 0;
            }
            if (count >= REAPPLY_LOOKUP_MAX_REQUESTS) {
                long remainingMillis = Math.max(1000L, REAPPLY_LOOKUP_WINDOW_MILLIS - (now - startedAt));
                Map<String, Object> response = new java.util.LinkedHashMap<>();
                response.put("success", false);
                response.put("errorCode", "REAPPLY_LOOKUP_RATE_LIMIT_EXCEEDED");
                response.put("message", "재신청 조회 횟수를 초과했습니다. 잠시 후 다시 시도해 주세요.");
                response.put("retryAfterSeconds", (remainingMillis + 999L) / 1000L);
                return ResponseEntity.status(HttpStatus.TOO_MANY_REQUESTS).body(response);
            }
            session.setAttribute(SESSION_REAPPLY_LOOKUP_WINDOW_STARTED_AT, startedAt);
            session.setAttribute(SESSION_REAPPLY_LOOKUP_COUNT, count + 1);
            return null;
        }
    }

    private ResponseEntity<Map<String, Object>> reapplyError(HttpStatus status, String errorCode, String message) {
        Map<String, Object> response = new java.util.LinkedHashMap<>();
        response.put("success", false);
        response.put("errorCode", errorCode);
        response.put("message", message);
        return noStore(ResponseEntity.status(status).body(response));
    }

    private ResponseEntity<Map<String, Object>> noStore(ResponseEntity<Map<String, Object>> response) {
        org.springframework.http.HttpHeaders headers = new org.springframework.http.HttpHeaders();
        headers.putAll(response.getHeaders());
        headers.set("Cache-Control", "no-store");
        headers.set("Pragma", "no-cache");
        return new ResponseEntity<>(response.getBody(), headers, response.getStatusCode());
    }

    private void cleanupInsttEvidenceFiles(List<InsttFileVO> files) {
        InstitutionEvidenceFileSupport.cleanup(files);
    }

    private void setJoinStep(HttpSession session, int step) {
        session.setAttribute(SESSION_JOIN_STEP, step);
    }

    private String renderJoinPage(Model model, String routeId, boolean english) {
        return reactAppViewSupport.render(model, routeId, english, false);
    }

    private String redirectJoinStep(boolean english, String stepPath) {
        return "redirect:" + (english ? "/join/en/" : "/join/") + stepPath;
    }

    private boolean isEnglishJoinRequest(HttpServletRequest request) {
        String requestUri = request == null ? "" : request.getRequestURI();
        return requestUri != null && requestUri.startsWith("/join/en/");
    }

    private int getJoinStep(HttpSession session) {
        Object stepObj = session.getAttribute(SESSION_JOIN_STEP);
        if (stepObj instanceof Integer) {
            return (Integer) stepObj;
        }
        if (stepObj instanceof String) {
            try {
                return Integer.parseInt((String) stepObj);
            } catch (NumberFormatException ignore) {
                return 0;
            }
        }
        return 0;
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private String urlEncode(String value) {
        return java.net.URLEncoder.encode(value == null ? "" : value, java.nio.charset.StandardCharsets.UTF_8);
    }

    private boolean hasVerifiedIdentity(EntrprsManageVO joinVO) {
        if (joinVO == null || !hasText(joinVO.getAuthTy())) {
            return false;
        }
        if (allowUnverifiedIdentity) {
            return true;
        }
        return isLiveIdentityValue(joinVO.getAuthCi()) && isLiveIdentityValue(joinVO.getAuthDi());
    }

    private boolean isLiveIdentityValue(String value) {
        return hasText(value) && !value.trim().toUpperCase().startsWith("MOCK-");
    }

    private boolean hasRequiredJoinSessionValues(EntrprsManageVO joinVO) {
        return hasText(joinVO.getEntrprsSeCode()) && hasText(joinVO.getUserTy()) && hasText(joinVO.getAuthTy());
    }

    private boolean hasValidEvidenceFiles(List<MultipartFile> fileUploads) {
        if (fileUploads == null || fileUploads.isEmpty()) {
            return false;
        }
        boolean hasRealFile = false;
        for (MultipartFile file : fileUploads) {
            if (file == null || file.isEmpty()) {
                continue;
            }
            hasRealFile = true;
            String name = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase();
            boolean extOk = name.endsWith(".pdf") || name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".png");
            if (!extOk) {
                return false;
            }
            if (file.getSize() > 10L * 1024L * 1024L) {
                return false;
            }
        }
        return hasRealFile;
    }

    private List<EntrprsMberFileVO> saveJoinEvidenceFiles(String memberId, List<MultipartFile> fileUploads) throws Exception {
        File dir = resolveInsttUploadDir();
        if (!dir.exists() && !dir.mkdirs()) {
            throw new Exception("Cannot create upload directory: " + dir.getAbsolutePath());
        }

        String safeMemberId = hasText(memberId) ? memberId.replaceAll("[^a-zA-Z0-9_-]", "") : "JOIN";
        if (!hasText(safeMemberId)) {
            safeMemberId = "JOIN";
        }

        List<EntrprsMberFileVO> savedFiles = new ArrayList<>();
        for (int i = 0; i < fileUploads.size(); i++) {
            MultipartFile file = fileUploads.get(i);
            if (file == null || file.isEmpty()) {
                continue;
            }

            String originalFileName = file.getOriginalFilename();
            String ext = "";
            if (originalFileName != null) {
                int lastDotIndex = originalFileName.lastIndexOf(".");
                if (lastDotIndex > -1) {
                    ext = originalFileName.substring(lastDotIndex).toLowerCase();
                }
            }

            String newFileName = safeMemberId + "_" + System.currentTimeMillis() + "_" + i + ext;
            File targetFile = new File(dir, newFileName);
            file.transferTo(targetFile);
            EntrprsMberFileVO fileVO = new EntrprsMberFileVO();
            fileVO.setFileId(safeMemberId + "_FILE_" + System.currentTimeMillis() + "_" + i);
            fileVO.setEntrprsmberId(memberId);
            fileVO.setFileSn(i + 1);
            fileVO.setStreFileNm(newFileName);
            fileVO.setOrignlFileNm(originalFileName == null ? newFileName : originalFileName);
            fileVO.setFileStrePath(targetFile.getAbsolutePath());
            fileVO.setFileMg(file.getSize());
            fileVO.setFileExtsn(ext);
            fileVO.setFileCn(file.getContentType());
            savedFiles.add(fileVO);
        }

        return savedFiles;
    }

    private String joinEvidencePaths(List<EntrprsMberFileVO> fileList) {
        if (fileList == null || fileList.isEmpty()) {
            return "";
        }
        List<String> paths = new ArrayList<>();
        for (EntrprsMberFileVO fileVO : fileList) {
            if (fileVO != null && hasText(fileVO.getFileStrePath())) {
                paths.add(fileVO.getFileStrePath());
            }
        }
        return String.join(",", paths);
    }

    private List<InsttFileVO> saveInsttEvidenceFiles(String insttId, List<MultipartFile> fileUploads, int startFileSn) throws Exception {
        File dir = resolveInsttUploadDir();
        if (!dir.exists() && !dir.mkdirs()) {
            throw new Exception("Cannot create upload directory: " + dir.getAbsolutePath());
        }

        String normalizedInsttId = InstitutionEvidenceFileSupport.requireInstitutionId(insttId);
        String projectId = currentProjectId();
        if (!hasText(projectId)) {
            throw new IllegalStateException("Project context is required for institution evidence storage.");
        }
        String safeProjectId = projectId.replaceAll("[^a-zA-Z0-9_-]", "");
        if (!hasText(safeProjectId)) {
            throw new IllegalStateException("Project context cannot be converted to a safe storage key.");
        }

        List<InsttFileVO> savedFiles = new ArrayList<>();
        if (fileUploads == null) {
            return savedFiles;
        }
        try {
        for (int i = 0; i < fileUploads.size(); i++) {
            MultipartFile file = fileUploads.get(i);
            if (file == null || file.isEmpty()) {
                continue;
            }

            String originalFileName = file.getOriginalFilename();
            String ext = "";
            if (originalFileName != null) {
                int lastDotIndex = originalFileName.lastIndexOf(".");
                if (lastDotIndex > -1) {
                    ext = originalFileName.substring(lastDotIndex).toLowerCase();
                }
            }

            String objectToken = InstitutionEvidenceFileSupport.newObjectToken();
            String newFileName = InstitutionEvidenceFileSupport.storageFileName(projectId, objectToken, ext);
            Path targetPath = dir.toPath().resolve(newFileName);
            Path stagingPath = Files.createTempFile(
                    dir.toPath(), safeProjectId + "_" + objectToken + "_", ".part");
            try {
                file.transferTo(stagingPath.toFile());
                String fileSha256 = InstitutionEvidenceFileSupport.sha256(stagingPath);
                InstitutionEvidenceFileSupport.moveStagedFile(stagingPath, targetPath);

                InsttFileVO fileVO = new InsttFileVO();
                fileVO.setFileId(InstitutionEvidenceFileSupport.fileId(objectToken));
                fileVO.setInsttId(normalizedInsttId);
                fileVO.setProjectId(projectId);
                fileVO.setScopeStatus("SCOPED");
                fileVO.setFileSha256(fileSha256);
                fileVO.setFileSn(startFileSn + savedFiles.size());
                fileVO.setStreFileNm(newFileName);
                fileVO.setOrignlFileNm(originalFileName == null ? newFileName : originalFileName);
                fileVO.setFileStrePath(targetPath.toAbsolutePath().toString());
                fileVO.setFileMg(Files.size(targetPath));
                fileVO.setFileExtsn(ext);
                fileVO.setFileCn(file.getContentType());
                savedFiles.add(fileVO);
            } catch (Exception fileError) {
                Files.deleteIfExists(stagingPath);
                Files.deleteIfExists(targetPath);
                throw fileError;
            }
        }
        } catch (Exception saveError) {
            cleanupInsttEvidenceFiles(savedFiles);
            throw saveError;
        }
        return savedFiles;
    }

    private String joinInsttEvidencePaths(List<InsttFileVO> fileList) {
        if (fileList == null || fileList.isEmpty()) {
            return "";
        }
        List<String> paths = new ArrayList<>();
        for (InsttFileVO fileVO : fileList) {
            if (fileVO != null && hasText(fileVO.getFileStrePath())) {
                paths.add(fileVO.getFileStrePath());
            }
        }
        return String.join(",", paths);
    }

    private File resolveInsttUploadDir() {
        String path = System.getProperty("carbosys.file.instt.dir");
        if (!hasText(path)) {
            path = System.getenv("CARBONET_FILE_INSTT_DIR");
        }
        if (!hasText(path)) {
            path = "./var/file/instt";
        }
        return new File(path).getAbsoluteFile();
    }

    private String normalizeMembershipCode(String membershipType) {
        String v = membershipType == null ? "" : membershipType.trim().toUpperCase();
        if ("EMITTER".equals(v)) return "E";
        if ("PERFORMER".equals(v)) return "P";
        if ("CENTER".equals(v)) return "C";
        if ("GOV".equals(v)) return "G";
        if ("E".equals(v) || "P".equals(v) || "C".equals(v) || "G".equals(v)) return v;
        return "";
    }

    private String expandMembershipCode(String membershipType) {
        String v = normalizeMembershipCode(membershipType);
        if ("E".equals(v)) return "EMITTER";
        if ("P".equals(v)) return "PERFORMER";
        if ("C".equals(v)) return "CENTER";
        if ("G".equals(v)) return "GOV";
        return "EMITTER";
    }

    private java.util.Map<String, Object> buildCompanySearchParams(String keyword, String status, int offset, int pageSize, String entrprsSeCode) {
        java.util.Map<String, Object> params = new java.util.HashMap<>();
        String normalizedKeyword = keyword == null ? "" : keyword.trim();
        if (normalizedKeyword.length() > 100) {
            normalizedKeyword = normalizedKeyword.substring(0, 100);
        }
        params.put("keyword", normalizedKeyword);
        params.put("offset", Math.max(0, offset));
        params.put("pageSize", Math.max(1, pageSize));
        params.put("status", status == null ? "" : status.trim());
        params.put("entrprsSeCode", hasText(entrprsSeCode) ? entrprsSeCode.trim() : "");
        return params;
    }

    private String resolveScopedInstitutionType(HttpSession session) {
        if (session == null) {
            return "";
        }
        EntrprsManageVO joinVO = (EntrprsManageVO) session.getAttribute(SESSION_JOIN_VO);
        if (joinVO == null) {
            return "";
        }
        return normalizeMembershipCode(joinVO.getEntrprsSeCode());
    }

    private String resolveJoinMembershipType(String membershipType, String insttId, EntrprsManageVO joinVO) {
        String normalizedMembershipType = normalizeMembershipCode(membershipType);
        if (hasText(normalizedMembershipType)) {
            return normalizedMembershipType;
        }

        String normalizedInsttId = insttId == null ? "" : insttId.trim();
        if (hasText(normalizedInsttId)) {
            try {
                InsttInfoVO insttInfoVO = new InsttInfoVO();
                insttInfoVO.setInsttId(normalizedInsttId);
                InstitutionStatusVO institutionStatus = entrprsManageService.selectInsttInfoForStatus(insttInfoVO);
                if (institutionStatus != null) {
                    normalizedMembershipType = normalizeMembershipCode(institutionStatus.getEntrprsSeCode());
                    if (hasText(normalizedMembershipType)) {
                        return normalizedMembershipType;
                    }
                }
            } catch (Exception e) {
                log.warn("Failed to resolve membership type from institution. insttId={}", normalizedInsttId, e);
            }
        }

        if (joinVO == null) {
            return "";
        }
        return normalizeMembershipCode(joinVO.getEntrprsSeCode());
    }

    private String normalizeMarketingYn(String marketingYn) {
        String v = marketingYn == null ? "" : marketingYn.trim().toUpperCase();
        if ("Y".equals(v) || "YES".equals(v) || "TRUE".equals(v) || "1".equals(v)) return "Y";
        if ("N".equals(v) || "NO".equals(v) || "FALSE".equals(v) || "0".equals(v)) return "N";
        return "N";
    }

    private String normalizeAuthType(String authType) {
        String v = authType == null ? "" : authType.trim().toUpperCase();
        if ("SIMPLE".equals(v)) return "S";
        if ("ONEPASS".equals(v)) return "O";
        if ("JOINT".equals(v)) return "J";
        if ("FINANCIAL".equals(v)) return "F";
        if ("CERT".equals(v)) return "C";
        if ("EMAIL".equals(v)) return "E";
        if ("S".equals(v) || "O".equals(v) || "J".equals(v) || "F".equals(v) || "C".equals(v) || "E".equals(v)) {
            return v;
        }
        return "";
    }

    private void applyJoinDbDefaults(EntrprsManageVO joinVO) {
        joinVO.setEntrprsmberId(trimToLen(joinVO.getEntrprsmberId(), 20));
        joinVO.setCmpnyNm(trimToLen(joinVO.getCmpnyNm(), 60));
        joinVO.setApplcntNm(trimToLen(joinVO.getApplcntNm(), 50));
        joinVO.setApplcntEmailAdres(trimToLen(joinVO.getApplcntEmailAdres(), 50));

        String normalizedBiz = digitsOnly(joinVO.getBizrno());
        if (normalizedBiz.length() > 10) {
            normalizedBiz = normalizedBiz.substring(0, 10);
        }
        joinVO.setBizrno(normalizedBiz);

        joinVO.setAreaNo(trimToLen(joinVO.getAreaNo(), 4));
        joinVO.setEntrprsMiddleTelno(trimToLen(joinVO.getEntrprsMiddleTelno(), 4));
        joinVO.setEntrprsEndTelno(trimToLen(joinVO.getEntrprsEndTelno(), 4));

        // step4 form does not collect address/zip, but DB requires NOT NULL
        if (!hasText(joinVO.getZip())) {
            joinVO.setZip("000000");
        } else {
            joinVO.setZip(trimToLen(digitsOnly(joinVO.getZip()), 6));
        }
        if (!hasText(joinVO.getAdres())) {
            joinVO.setAdres("주소미입력");
        } else {
            joinVO.setAdres(trimToLen(joinVO.getAdres(), 100));
        }

        // DB requires NOT NULL
        if (!hasText(joinVO.getEntrprsMberPasswordHint())) {
            joinVO.setEntrprsMberPasswordHint("AUTO");
        } else {
            joinVO.setEntrprsMberPasswordHint(trimToLen(joinVO.getEntrprsMberPasswordHint(), 100));
        }
        if (!hasText(joinVO.getEntrprsMberPasswordCnsr())) {
            joinVO.setEntrprsMberPasswordCnsr("AUTO");
        } else {
            joinVO.setEntrprsMberPasswordCnsr(trimToLen(joinVO.getEntrprsMberPasswordCnsr(), 100));
        }

        if (!hasText(joinVO.getEntrprsMberSttus())) {
            joinVO.setEntrprsMberSttus("P");
        }
    }

    private String trimToLen(String value, int maxLen) {
        if (value == null) return "";
        String v = value.trim();
        if (v.length() <= maxLen) return v;
        return v.substring(0, maxLen);
    }

    private String safeTrim(String value) {
        return value == null ? "" : value.trim();
    }

    private String digitsOnly(String value) {
        if (value == null) return "";
        return value.replaceAll("[^0-9]", "");
    }
}
