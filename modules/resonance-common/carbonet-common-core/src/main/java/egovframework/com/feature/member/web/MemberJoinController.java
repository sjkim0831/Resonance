package egovframework.com.feature.member.web;

import java.util.Map;
import java.util.List;
import java.util.ArrayList;
import jakarta.annotation.Resource;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpSession;

import org.springframework.stereotype.Controller;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.ui.Model;
import org.springframework.ui.ExtendedModelMap;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseBody;
import org.springframework.web.multipart.MultipartFile;
import java.io.File;
import java.util.UUID;
import org.springframework.web.multipart.MultipartHttpServletRequest;

import egovframework.com.feature.member.service.EnterpriseMemberService;
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
import lombok.extern.slf4j.Slf4j;

@Controller
@RequestMapping("/join")
@Slf4j
public class MemberJoinController {
    private static final String SESSION_JOIN_VO = "joinVO";
    private static final String SESSION_JOIN_STEP = "joinStep";

    @Resource(name = "entrprsManageService")
    private EnterpriseMemberService entrprsManageService;

    @Resource
    private ReactAppViewSupport reactAppViewSupport;

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
            response.put("message", "유효한 회원유형을 선택해 주세요.");
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
    public ResponseEntity<Map<String, Object>> saveStep2Api(@RequestParam("marketing_yn") String marketingYn, HttpSession session) {
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
        joinVO.setMarketingYn(marketingYn);
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
        session.setAttribute(SESSION_JOIN_VO, joinVO);
        setJoinStep(session, 4);
        response.put("success", true);
        response.put("step", 4);
        response.put("joinVO", joinVO);
        return ResponseEntity.ok(response);
    }

    @PostMapping(value = "/api/step4/submit", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseBody
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
        if (!hasText(mberId) || !hasText(password) || !hasText(mberNm) || !hasText(insttNm) || !hasText(insttId)
                || !hasText(representativeName) || !hasText(bizrno) || !hasText(zip) || !hasText(adres)
                || !hasText(tel1) || !hasText(tel2) || !hasText(tel3) || !hasText(email)) {
            response.put("success", false);
            response.put("message", "필수 입력값을 모두 입력해 주세요.");
            return ResponseEntity.badRequest().body(response);
        }
        if (!hasValidEvidenceFiles(fileUploads)) {
            response.put("success", false);
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
        joinVO.setEntrprsMberSttus("A");
        joinVO.setDeptNm(trimToLen(joinVO.getDeptNm(), 60));
        applyJoinDbDefaults(joinVO);
        List<EntrprsMberFileVO> evidenceFiles = saveJoinEvidenceFiles(joinVO.getEntrprsmberId(), fileUploads);
        joinVO.setBizRegFilePath(joinEvidencePaths(evidenceFiles));

        entrprsManageService.insertEntrprsmber(joinVO);
        entrprsManageService.insertEntrprsMberFiles(evidenceFiles);
        entrprsManageService.ensureEnterpriseSecurityMapping(joinVO.getUniqId());

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
        joinVO.setEntrprsMberSttus("A");
        joinVO.setDeptNm(trimToLen(joinVO.getDeptNm(), 60));
        applyJoinDbDefaults(joinVO);
        List<EntrprsMberFileVO> evidenceFiles = saveJoinEvidenceFiles(joinVO.getEntrprsmberId(), fileUploads);
        joinVO.setBizRegFilePath(joinEvidencePaths(evidenceFiles));

        // Save to DB
        entrprsManageService.insertEntrprsmber(joinVO);
        entrprsManageService.insertEntrprsMberFiles(evidenceFiles);
        entrprsManageService.ensureEnterpriseSecurityMapping(joinVO.getUniqId());

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
        joinVO.setEntrprsMberSttus("A");
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

    @GetMapping("/api/company-status/detail")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> companyJoinStatusDetailApi(
            @RequestParam(value = "bizNo", required = false) String bizNo,
            @RequestParam(value = "appNo", required = false) String appNo,
            @RequestParam("repName") String repName) {
        Map<String, Object> response = new java.util.LinkedHashMap<>();
        try {
            InsttInfoVO searchVO = new InsttInfoVO();
            searchVO.setReprsntNm(repName);
            searchVO.setBizrno(bizNo);
            searchVO.setInsttId(appNo);
            InstitutionStatusVO result = entrprsManageService.selectInsttInfoForStatus(searchVO);
            if (result == null || result.isEmpty()) {
                response.put("success", false);
                response.put("message", "입력하신 정보와 일치하는 신청 내역이 없습니다.");
                return ResponseEntity.badRequest().body(response);
            }
            response.put("success", true);
            response.put("result", result);
            response.put("insttFiles", loadInsttFiles(result.getInsttId()));
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Company join status detail api failed", e);
            response.put("success", false);
            response.put("message", "조회 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
            return ResponseEntity.internalServerError().body(response);
        }
    }

    @GetMapping({"/companyJoinStatusDetail", "/ko/companyJoinStatusDetail", "/en/companyJoinStatusDetail"})
    public String companyJoinStatusDetail(
            @RequestParam(value = "bizNo", required = false) String bizNo,
            @RequestParam(value = "appNo", required = false) String appNo,
            @RequestParam("repName") String repName,
            HttpServletRequest request,
            org.springframework.ui.Model model) throws Exception {
        return renderJoinPage(model, "join-company-status", isEnglishJoinRequest(request));
    }

    @GetMapping({"/companyReapply", "/ko/companyReapply", "/en/companyReapply"})
    public String companyReapply(
            @RequestParam("bizNo") String bizNo,
            @RequestParam("repName") String repName,
            HttpServletRequest request,
            org.springframework.ui.Model model) throws Exception {
        return renderJoinPage(model, "join-company-reapply", isEnglishJoinRequest(request));
    }

    @GetMapping("/api/company-reapply/page")
    @ResponseBody
    public ResponseEntity<Map<String, Object>> companyReapplyPageApi(
            @RequestParam("bizNo") String bizNo,
            @RequestParam("repName") String repName) {
        Map<String, Object> response = new java.util.LinkedHashMap<>();
        try {
            InsttInfoVO searchVO = new InsttInfoVO();
            searchVO.setReprsntNm(repName);
            searchVO.setBizrno(bizNo);
            InstitutionStatusVO result = entrprsManageService.selectInsttInfoForStatus(searchVO);
            if (result == null || result.isEmpty()) {
                response.put("success", false);
                response.put("message", "입력하신 정보와 일치하는 신청 내역이 없습니다.");
                return ResponseEntity.badRequest().body(response);
            }
            if (!"R".equals(result.getInsttSttus())) {
                response.put("success", false);
                response.put("message", "반려된 건만 재신청이 가능합니다.");
                response.put("result", result);
                return ResponseEntity.badRequest().body(response);
            }
            response.put("success", true);
            response.put("result", result);
            response.put("insttFiles", loadInsttFiles(result.getInsttId()));
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Company reapply page api failed", e);
            response.put("success", false);
            response.put("message", "조회 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
            return ResponseEntity.internalServerError().body(response);
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
            @RequestParam(value = "fileUploads", required = false) java.util.List<org.springframework.web.multipart.MultipartFile> fileUploads) {
        Map<String, Object> response = new java.util.LinkedHashMap<>();
        try {
            String normalizedInsttId = insttId == null ? "" : insttId.trim();

            InsttInfoVO searchVO = new InsttInfoVO();
            searchVO.setInsttId(normalizedInsttId);
            searchVO.setReprsntNm(repName);
            searchVO.setBizrno(bizNo);
            InstitutionStatusVO current = entrprsManageService.selectInsttInfoForStatus(searchVO);
            if (current == null || current.isEmpty()) {
                response.put("success", false);
                response.put("message", "재신청 대상 정보를 찾을 수 없습니다.");
                return ResponseEntity.badRequest().body(response);
            }
            String insttSttus = String.valueOf(current.getInsttSttus());
            if (!"R".equals(insttSttus)) {
                response.put("success", false);
                response.put("message", "반려된 건만 재신청이 가능합니다.");
                return ResponseEntity.badRequest().body(response);
            }

            InsttInfoVO vo = new InsttInfoVO();
            vo.setInsttId(normalizedInsttId);
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
            vo.setEntrprsSeCode(hasText(current.getEntrprsSeCode()) ? current.getEntrprsSeCode() : resolveScopedInstitutionType(null));

            List<InsttFileVO> existingFiles = entrprsManageService.selectInsttFiles(normalizedInsttId);
            int nextFileSn = existingFiles == null ? 1 : existingFiles.size() + 1;
            List<InsttFileVO> insttFiles = saveInsttEvidenceFiles(normalizedInsttId, fileUploads, nextFileSn);

            if (!insttFiles.isEmpty()) {
                vo.setBizRegFilePath(joinInsttEvidencePaths(insttFiles));
            } else {
                vo.setBizRegFilePath(current.getBizRegFilePath());
            }

            entrprsManageService.updateInsttInfo(vo);
            entrprsManageService.insertInsttFiles(insttFiles);
            response.put("success", true);
            response.put("insttId", normalizedInsttId);
            response.put("insttNm", agencyName);
            response.put("bizrno", bizNo);
            response.put("regDate", java.time.LocalDateTime.now()
                    .format(java.time.format.DateTimeFormatter.ofPattern("yyyy.MM.dd HH:mm:ss")));
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            log.error("Company reapply submit api failed", e);
            response.put("success", false);
            response.put("message", "처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
            return ResponseEntity.internalServerError().body(response);
        }
    }

    @PostMapping({"/companyReapplySubmit", "/ko/companyReapplySubmit", "/en/companyReapplySubmit"})
    public String companyReapplySubmit(
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
            @RequestParam(value = "fileUploads", required = false) java.util.List<org.springframework.web.multipart.MultipartFile> fileUploads,
            HttpServletRequest request,
            org.springframework.ui.Model model) {

        try {
            boolean english = request.getRequestURI() != null && request.getRequestURI().startsWith("/join/en/");
            String normalizedInsttId = insttId == null ? "" : insttId.trim();

            InsttInfoVO searchVO = new InsttInfoVO();
            searchVO.setInsttId(normalizedInsttId);
            searchVO.setReprsntNm(repName);
            searchVO.setBizrno(bizNo);
            InstitutionStatusVO current = entrprsManageService.selectInsttInfoForStatus(searchVO);
            if (current == null || current.isEmpty()) {
                model.addAttribute("errorMessage", "재신청 대상 정보를 찾을 수 없습니다.");
                return "redirect:/join/companyJoinStatusSearch";
            }

            String insttSttus = String.valueOf(current.getInsttSttus());
            if (!"R".equals(insttSttus)) {
                model.addAttribute("errorMessage", "반려된 건만 재신청이 가능합니다.");
                return "redirect:/join/companyJoinStatusDetail?bizNo=" + urlEncode(bizNo) + "&repName=" + urlEncode(repName);
            }

            InsttInfoVO vo = new InsttInfoVO();
            vo.setInsttId(normalizedInsttId);
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
            vo.setEntrprsSeCode(hasText(current.getEntrprsSeCode()) ? current.getEntrprsSeCode() : resolveScopedInstitutionType(null));

            List<InsttFileVO> existingFiles = entrprsManageService.selectInsttFiles(normalizedInsttId);
            int nextFileSn = existingFiles == null ? 1 : existingFiles.size() + 1;
            List<InsttFileVO> insttFiles = saveInsttEvidenceFiles(normalizedInsttId, fileUploads, nextFileSn);

            if (!insttFiles.isEmpty()) {
                vo.setBizRegFilePath(joinInsttEvidencePaths(insttFiles));
            } else {
                vo.setBizRegFilePath(current.getBizRegFilePath());
            }

            entrprsManageService.updateInsttInfo(vo);
            entrprsManageService.insertInsttFiles(insttFiles);

            String regDate = java.time.LocalDateTime.now()
                    .format(java.time.format.DateTimeFormatter.ofPattern("yyyy.MM.dd HH:mm:ss"));
            String redirectPath = (english ? "/join/en/companyJoinStatusDetail" : "/join/companyJoinStatusDetail") + "?bizNo=" + urlEncode(bizNo)
                    + "&repName=" + urlEncode(repName)
                    + "&submitted=1"
                    + "&insttNm=" + urlEncode(agencyName)
                    + "&regDate=" + urlEncode(regDate);
            return "redirect:" + redirectPath;

        } catch (Exception e) {
            log.error("Company reapply submit failed", e);
            boolean english = request.getRequestURI() != null && request.getRequestURI().startsWith("/join/en/");
            return "redirect:" + (english ? "/join/en/companyReapply" : "/join/companyReapply") + "?bizNo=" + urlEncode(bizNo)
                    + "&repName=" + urlEncode(repName)
                    + "&errorMessage=" + urlEncode("처리 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.");
        }
    }

    @GetMapping("/downloadInsttFile")
    public void downloadInsttFile(@RequestParam("fileId") String fileId,
            jakarta.servlet.http.HttpServletResponse response) throws Exception {
        InsttFileVO fileVO = entrprsManageService.selectInsttFileByFileId(fileId);
        if (fileVO == null || !hasText(fileVO.getFileStrePath())) {
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
        // Security check: only allow files within the configured instt directory
        if (!file.exists() || !canonicalFile.startsWith(canonicalDir)) {
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
        return hasText(joinVO.getAuthTy());
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

        String safeInsttId = hasText(insttId) ? insttId.replaceAll("[^a-zA-Z0-9_-]", "") : "INSTT";
        if (!hasText(safeInsttId)) {
            safeInsttId = "INSTT";
        }

        List<InsttFileVO> savedFiles = new ArrayList<>();
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

            String newFileName = safeInsttId + "_" + System.currentTimeMillis() + "_" + i + ext;
            File targetFile = new File(dir, newFileName);
            file.transferTo(targetFile);

            InsttFileVO fileVO = new InsttFileVO();
            fileVO.setFileId(safeInsttId + "_FILE_" + System.currentTimeMillis() + "_" + i);
            fileVO.setInsttId(insttId);
            fileVO.setFileSn(startFileSn + savedFiles.size());
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
            joinVO.setEntrprsMberSttus("A");
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
