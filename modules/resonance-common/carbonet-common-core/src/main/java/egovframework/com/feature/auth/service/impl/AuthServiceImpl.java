package egovframework.com.feature.auth.service.impl;

import egovframework.com.common.context.ProjectRuntimeContext;
import egovframework.com.feature.auth.domain.entity.*;
import egovframework.com.feature.auth.domain.repository.EmployeeMemberRepository;
import egovframework.com.feature.auth.domain.repository.EnterpriseMemberRepository;
import egovframework.com.feature.auth.domain.repository.GeneralMemberRepository;
import egovframework.com.feature.auth.domain.repository.LoginPolicyRepository;
import egovframework.com.feature.auth.domain.repository.PasswordResetHistoryRepository;
import egovframework.com.feature.auth.dto.internal.LoginIncorrectDTO;
import egovframework.com.feature.auth.dto.internal.LoginPolicyDTO;
import egovframework.com.feature.auth.dto.request.LoginRequestDTO;
import egovframework.com.feature.auth.dto.response.LoginResponseDTO;
import egovframework.com.feature.auth.mapper.AuthLoginMapper;
import egovframework.com.feature.auth.service.AuthService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.apache.commons.codec.binary.Base64;
import org.egovframe.rte.fdl.cmmn.EgovAbstractServiceImpl;
import org.springframework.stereotype.Service;
import org.springframework.util.ObjectUtils;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Function;

@Service("egovLoginManageService")
@RequiredArgsConstructor
@Slf4j
public class AuthServiceImpl extends EgovAbstractServiceImpl implements AuthService {

    private final GeneralMemberRepository genRepository; // 일반회원
    private final EnterpriseMemberRepository entRepository; // 기업회원
    private final EmployeeMemberRepository empRepository; // 업무사용자
    private final LoginPolicyRepository loginPolicyRepository; // 로그인정책관리
    private final PasswordResetHistoryRepository passwordResetHistoryRepository;
    private final AuthLoginMapper authLoginMapper;
    private final ProjectRuntimeContext projectRuntimeContext;

    @Override
    public LoginResponseDTO actionLogin(LoginRequestDTO loginVO) {
        String userId = normalizeUserId(loginVO.getUserId());
        String userSe = loginVO.getUserSe();

        switch (userSe) {
            case "GNR":
                LoginResponseDTO generalUser = authLoginMapper.selectGeneralLoginUser(userId);
                if (generalUser == null) {
                    return null;
                }
                if (!matchesPassword(loginVO.getUserPw(), userId, generalUser.getUserPw())) {
                    return null;
                }
                return generalUser;
            case "ENT":
                LoginResponseDTO enterpriseUser = authLoginMapper.selectEnterpriseLoginUser(userId);
                if (enterpriseUser == null) {
                    return null;
                }
                if (!matchesPassword(loginVO.getUserPw(), userId, enterpriseUser.getUserPw())) {
                    return null;
                }
                return enterpriseUser;
            case "USR":
                LoginResponseDTO employeeUser = authLoginMapper.selectEmployeeLoginUser(userId);
                if (employeeUser == null) {
                    return null;
                }
                if (!matchesPassword(loginVO.getUserPw(), userId, employeeUser.getUserPw())) {
                    return null;
                }
                return employeeUser;
            default:
                return null;
        }
    }

    @Override
    public LoginPolicyDTO loginPolicy(LoginPolicyDTO loginPolicyVO) {
        LoginPolicy loginPolicy = loginPolicyRepository.findById(loginPolicyVO.getEmployerId()).orElse(null);
        if (!ObjectUtils.isEmpty(loginPolicy)) {
            loginPolicyVO.setEmployerId(loginPolicy.getEmployerId());
            loginPolicyVO.setLmttAt(loginPolicy.getLmttAt());
            loginPolicyVO.setIpInfo(loginPolicy.getIpInfo());
        }
        return loginPolicyVO;
    }

    @Override
    public LoginIncorrectDTO loginIncorrectList(LoginRequestDTO loginVO) {
        String userId = normalizeUserId(loginVO.getUserId());
        String userSe = loginVO.getUserSe();

        if (ObjectUtils.isEmpty(userId) || ObjectUtils.isEmpty(userSe)) {
            return null;
        }

        switch (userSe) {
            case "GNR": // 일반회원
                return getLoginInfo(genRepository::findById, userId, result -> new LoginIncorrectDTO(
                        result.getMberId(), result.getPassword(), result.getMberNm(), userSe,
                        result.getEsntlId(), getLockAt(result.getLockAt()), getLockCnt(result.getLockCnt())));
            case "ENT": // 기업회원
                return findEnterpriseMember(userId).map(result -> new LoginIncorrectDTO(
                        result.getEntrprsMberId(), result.getEntrprsMberPassword(), result.getCmpnyNm(), userSe,
                        result.getEsntlId(), getLockAt(result.getLockAt()), getLockCnt(result.getLockCnt())))
                        .orElse(null);
            case "USR": // 업무사용자
                return getLoginInfo(empRepository::findById, userId, result -> new LoginIncorrectDTO(
                        result.getEmplyrId(), result.getPassword(), result.getUserNm(), userSe,
                        result.getEsntlId(), getLockAt(result.getLockAt()), getLockCnt(result.getLockCnt())));
            default:
                return null;
        }
    }

    private <T> LoginIncorrectDTO getLoginInfo(Function<String, Optional<T>> findByIdFunction, String userId,
            Function<T, LoginIncorrectDTO> mapper) {
        return findByIdFunction.apply(userId)
                .map(mapper)
                .orElse(null);
    }

    private String getLockAt(String lockAt) {
        return ObjectUtils.isEmpty(lockAt) ? "N" : lockAt;
    }

    private int getLockCnt(Integer lockCnt) {
        return ObjectUtils.isEmpty(lockCnt) ? 0 : lockCnt;
    }

    @Override
    public String loginIncorrectProcess(LoginRequestDTO loginVO, LoginIncorrectDTO loginIncorrectVO, String lockCount) {
        String processCode = "C";
        String userId = normalizeUserId(loginVO.getUserId());
        String userSe = loginVO.getUserSe();
        String rawPassword = loginVO.getUserPw();
        String lockAt = getLockAt(loginIncorrectVO.getLockAt());
        int lockCnt = getLockCnt(loginIncorrectVO.getLockCnt());
        int lockConfigCnt = Integer.parseInt(lockCount);

        if (ObjectUtils.isEmpty(userId) || ObjectUtils.isEmpty(userSe)) {
            return processCode;
        }

        // 비밀번호가 맞는 경우
        if (matchesPassword(rawPassword, userId, loginIncorrectVO.getUserPw())) {
            saveLoginIncorrect(userId, userSe, "E", lockCnt);
            return "E";
        }

        // 계정이 잠겨있는 경우
        if ("Y".equals(lockAt)) {
            return "L";
        }

        // 실패 횟수가 잠금 임계값에 도달한 경우
        if (lockCnt + 1 >= lockConfigCnt) {
            saveLoginIncorrect(userId, userSe, "L", lockCnt);
            return "L";
        }

        // 일반적인 실패 처리
        saveLoginIncorrect(userId, userSe, "C", lockCnt);
        return "C";
    }

    private void saveLoginIncorrect(String userId, String userSe, String processCode, int lockCnt) {
        LocalDateTime now = LocalDateTime.now();
        switch (userSe) {
            case "GNR": // 일반회원
                genRepository.findById(userId).ifPresent(gnrlMber -> {
                    updateLockStatus(gnrlMber, processCode, lockCnt, now);
                    genRepository.save(gnrlMber);
                });
                break;
            case "ENT": // 기업회원
                findEnterpriseMember(userId).ifPresent(entrprsMber -> {
                    updateLockStatus(entrprsMber, processCode, lockCnt, now);
                    entRepository.save(entrprsMber);
                });
                break;
            case "USR": // 업무사용자
                empRepository.findById(userId).ifPresent(emplyrInfo -> {
                    updateLockStatus(emplyrInfo, processCode, lockCnt, now);
                    empRepository.save(emplyrInfo);
                });
                break;
            default:
                break;
        }
    }

    // 공통 업데이트 로직
    private void updateLockStatus(CommonEntity entity, String processCode, int lockCnt, LocalDateTime now) {
        switch (processCode) {
            case "E":
                entity.setLockAt(null);
                entity.setLockCnt(0);
                entity.setLockLastPnttm(null);
                break;
            case "L":
                entity.setLockAt("Y");
                entity.setLockCnt(lockCnt + 1);
                entity.setLockLastPnttm(now);
                break;
            case "C":
                entity.setLockCnt(lockCnt + 1);
                entity.setLockLastPnttm(now);
                break;
            default:
                break;
        }
    }

    private String encryptPassword(String key, String salt) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            md.reset();
            md.update(salt.getBytes(StandardCharsets.UTF_8));
            return Base64.encodeBase64String(md.digest(key.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            log.debug("##### AuthServiceImpl NoSuchAlgorithmException >>> {}", e.getMessage());
            return "0";
        }
    }

    private boolean matchesPassword(String rawPassword, String userId, String storedPassword) {
        if (ObjectUtils.isEmpty(rawPassword) || ObjectUtils.isEmpty(userId) || ObjectUtils.isEmpty(storedPassword)) {
            return false;
        }
        String encoded = encryptPassword(rawPassword, userId);
        return Objects.equals(encoded, storedPassword) || Objects.equals(rawPassword, storedPassword);
    }

    private String normalizeUserId(String userId) {
        return userId == null ? null : userId.trim();
    }

    @Override
    public void updateAuthInfo(String userId, String userSe, String authTy, String authDn, String authCi,
            String authDi) {
        switch (userSe) {
            case "GNR":
                genRepository.findById(userId).ifPresent(entity -> {
                    entity.setAuthTy(authTy);
                    entity.setAuthDn(authDn);
                    entity.setAuthCi(authCi);
                    entity.setAuthDi(authDi);
                    genRepository.save(entity);
                });
                break;
            case "ENT":
                findEnterpriseMember(userId).ifPresent(entity -> {
                    entity.setAuthTy(authTy);
                    entity.setAuthDn(authDn);
                    entity.setAuthCi(authCi);
                    entity.setAuthDi(authDi);
                    entRepository.save(entity);
                });
                break;
            case "USR":
                empRepository.findById(userId).ifPresent(entity -> {
                    entity.setAuthTy(authTy);
                    entity.setAuthDn(authDn);
                    entity.setAuthCi(authCi);
                    entity.setAuthDi(authDi);
                    empRepository.save(entity);
                });
                break;
        }
    }

    @Override
    public LoginResponseDTO selectLoginUser(String userSe, String userId) {
        if (ObjectUtils.isEmpty(userSe) || ObjectUtils.isEmpty(userId)) {
            return null;
        }
        return authLoginMapper.selectLoginUser(userSe, normalizeUserId(userId));
    }

    @Override
    public LoginResponseDTO findLoginUserByExternalIdentity(String authCi, String authDi) {
        String normalizedCi = normalizeExternalIdentity(authCi);
        String normalizedDi = normalizeExternalIdentity(authDi);

        if (!ObjectUtils.isEmpty(normalizedCi)) {
            LoginResponseDTO byCi = findLoginUserByCi(normalizedCi);
            if (byCi != null) {
                return byCi;
            }
        }

        if (!ObjectUtils.isEmpty(normalizedDi)) {
            return findLoginUserByDi(normalizedDi);
        }

        return null;
    }

    private LoginResponseDTO findLoginUserByCi(String authCi) {
        Optional<EntrprsMber> enterprise = entRepository.findFirstByAuthCi(authCi);
        if (enterprise.isPresent()) {
            return authLoginMapper.selectLoginUser("ENT", enterprise.get().getEntrprsMberId());
        }

        Optional<GnrlMber> general = genRepository.findFirstByAuthCi(authCi);
        if (general.isPresent()) {
            return authLoginMapper.selectLoginUser("GNR", general.get().getMberId());
        }

        Optional<EmplyrInfo> employee = empRepository.findFirstByAuthCi(authCi);
        if (employee.isPresent()) {
            return authLoginMapper.selectLoginUser("USR", employee.get().getEmplyrId());
        }

        return null;
    }

    private LoginResponseDTO findLoginUserByDi(String authDi) {
        Optional<EntrprsMber> enterprise = entRepository.findFirstByAuthDi(authDi);
        if (enterprise.isPresent()) {
            return authLoginMapper.selectLoginUser("ENT", enterprise.get().getEntrprsMberId());
        }

        Optional<GnrlMber> general = genRepository.findFirstByAuthDi(authDi);
        if (general.isPresent()) {
            return authLoginMapper.selectLoginUser("GNR", general.get().getMberId());
        }

        Optional<EmplyrInfo> employee = empRepository.findFirstByAuthDi(authDi);
        if (employee.isPresent()) {
            return authLoginMapper.selectLoginUser("USR", employee.get().getEmplyrId());
        }

        return null;
    }

    private String normalizeExternalIdentity(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    @Override
    public boolean resetPassword(String userId, String newPassword) {
        return resetPassword(userId, newPassword, null, null, "SELF_SERVICE");
    }

    @Override
    public boolean resetPassword(String userId, String newPassword, String resetByUserId, String resetIp, String resetSource) {
        if (ObjectUtils.isEmpty(userId) || ObjectUtils.isEmpty(newPassword)) {
            return false;
        }

        String encPassword = encryptPassword(newPassword, userId);
        LocalDateTime now = LocalDateTime.now();

        Optional<EntrprsMber> entOpt = findEnterpriseMember(userId);
        if (entOpt.isPresent()) {
            EntrprsMber entity = entOpt.get();
            entity.setEntrprsMberPassword(encPassword);
            entity.setChgPwdLastPnttm(now);
            entity.setLockAt(null);
            entity.setLockCnt(0);
            entity.setLockLastPnttm(null);
            entRepository.save(entity);
            savePasswordResetHistorySafely(userId, "ENT", resetByUserId, resetIp, resetSource, now);
            return true;
        }

        Optional<GnrlMber> gnrOpt = genRepository.findById(userId);
        if (gnrOpt.isPresent()) {
            GnrlMber entity = gnrOpt.get();
            entity.setPassword(encPassword);
            entity.setChgPwdLastPnttm(now);
            entity.setLockAt(null);
            entity.setLockCnt(0);
            entity.setLockLastPnttm(null);
            genRepository.save(entity);
            savePasswordResetHistorySafely(userId, "GNR", resetByUserId, resetIp, resetSource, now);
            return true;
        }

        Optional<EmplyrInfo> usrOpt = empRepository.findById(userId);
        if (usrOpt.isPresent()) {
            EmplyrInfo entity = usrOpt.get();
            entity.setPassword(encPassword);
            entity.setChgPwdLastPnttm(now);
            entity.setLockAt(null);
            entity.setLockCnt(0);
            entity.setLockLastPnttm(null);
            empRepository.save(entity);
            savePasswordResetHistorySafely(userId, "USR", resetByUserId, resetIp, resetSource, now);
            return true;
        }

        return false;
    }

    @Override
    public List<PasswordResetHistory> findRecentPasswordResetHistories(String userId) {
        String normalizedUserId = normalizeUserId(userId);
        if (ObjectUtils.isEmpty(normalizedUserId)) {
            return java.util.Collections.emptyList();
        }
        return passwordResetHistoryRepository.findTop10ByTargetUserIdOrderByResetPnttmDesc(normalizedUserId);
    }

    @Override
    public Page<PasswordResetHistory> searchPasswordResetHistories(String searchKeyword, String resetSource, String insttId, Pageable pageable) {
        String normalizedKeyword = searchKeyword == null ? "" : searchKeyword.trim();
        String normalizedSource = resetSource == null ? "" : resetSource.trim();
        String normalizedInsttId = insttId == null ? "" : insttId.trim();
        return passwordResetHistoryRepository.searchPasswordResetHistories(normalizedSource, normalizedInsttId, normalizedKeyword, pageable);
    }

    private void savePasswordResetHistory(String userId, String userSe, String resetByUserId, String resetIp,
            String resetSource, LocalDateTime resetPnttm) {
        PasswordResetHistory history = new PasswordResetHistory();
        history.setHistId(UUID.randomUUID().toString().replace("-", ""));
        history.setTargetUserId(userId);
        history.setTargetUserSe(userSe);
        history.setResetSource(ObjectUtils.isEmpty(resetSource) ? "UNKNOWN" : resetSource);
        history.setResetByUserId(normalizeAuditValue(resetByUserId));
        history.setResetIp(normalizeAuditValue(resetIp));
        history.setResetPnttm(resetPnttm == null ? LocalDateTime.now() : resetPnttm);
        passwordResetHistoryRepository.save(history);
    }

    private void savePasswordResetHistorySafely(String userId, String userSe, String resetByUserId, String resetIp,
            String resetSource, LocalDateTime resetPnttm) {
        try {
            savePasswordResetHistory(userId, userSe, resetByUserId, resetIp, resetSource, resetPnttm);
        } catch (Exception e) {
            log.warn("Failed to save credential reset audit history. userId={}, userSe={}", userId, userSe, e);
        }
    }

    private String normalizeAuditValue(String value) {
        String normalized = value == null ? "" : value.trim();
        return normalized.isEmpty() ? "SYSTEM" : normalized;
    }

    private Optional<EntrprsMber> findEnterpriseMember(String userId) {
        String normalizedUserId = normalizeUserId(userId);
        if (ObjectUtils.isEmpty(normalizedUserId)) {
            return Optional.empty();
        }
        String projectId = currentProjectId();
        if (!projectId.isEmpty()) {
            Optional<EntrprsMber> projectScoped = entRepository.findByEntrprsMberIdAndProjectId(normalizedUserId, projectId);
            if (projectScoped.isPresent()) {
                return projectScoped;
            }
        }
        return entRepository.findById(normalizedUserId);
    }

    private String currentProjectId() {
        return projectRuntimeContext == null ? "" : safeValue(projectRuntimeContext.getProjectId());
    }

    private String safeValue(String value) {
        return value == null ? "" : value.trim();
    }

}
