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
import egovframework.com.feature.auth.service.CredentialMutationLockService;
import egovframework.com.feature.auth.service.CredentialRevocationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.apache.commons.codec.binary.Base64;
import org.egovframe.rte.fdl.cmmn.EgovAbstractServiceImpl;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
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
    private final CredentialMutationLockService credentialMutationLockService;
    private final CredentialRevocationService credentialRevocationService;

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
                    LoginResponseDTO employeeUser = fallbackEmployeeLogin(userId, loginVO.getUserPw());
                    return employeeUser;
                }
                if (!"P".equalsIgnoreCase(enterpriseUser.getMemberStatus())) {
                    log.warn("Blocked enterprise login before approval: userId={}, status={}", userId,
                            enterpriseUser.getMemberStatus());
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

    private LoginResponseDTO fallbackEmployeeLogin(String userId, String rawPassword) {
        LoginResponseDTO employeeUser = authLoginMapper.selectEmployeeLoginUser(userId);
        if (employeeUser == null) {
            return null;
        }
        if (!matchesPassword(rawPassword, userId, employeeUser.getUserPw())) {
            return null;
        }
        return employeeUser;
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
                return getLoginInfo(this::findGeneralMember, userId, result -> new LoginIncorrectDTO(
                        result.getMberId(), result.getPassword(), result.getMberNm(), userSe,
                        result.getEsntlId(), getLockAt(result.getLockAt()), getLockCnt(result.getLockCnt())));
            case "ENT": // 기업회원
                // enterprise 테이블에 없으면 employee 테이블 fallback (actionLogin과 동일)
                return findLoginInfoOrFallback(userId, userSe,
                        () -> findEnterpriseMember(userId).map(result -> new LoginIncorrectDTO(
                                result.getEntrprsMberId(), result.getEntrprsMberPassword(), result.getCmpnyNm(), userSe,
                                result.getEsntlId(), getLockAt(result.getLockAt()), getLockCnt(result.getLockCnt()))),
                        () -> findEmployeeMember(userId).map(result -> new LoginIncorrectDTO(
                                result.getEmplyrId(), result.getPassword(), result.getUserNm(), "USR",
                                result.getEsntlId(), getLockAt(result.getLockAt()), getLockCnt(result.getLockCnt()))));
            case "USR": // 업무사용자
                return getLoginInfo(this::findEmployeeMember, userId, result -> new LoginIncorrectDTO(
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

    private LoginIncorrectDTO findLoginInfoOrFallback(String userId, String userSe,
            java.util.function.Supplier<java.util.Optional<LoginIncorrectDTO>> primaryLookup,
            java.util.function.Supplier<java.util.Optional<LoginIncorrectDTO>> fallbackLookup) {
        java.util.Optional<LoginIncorrectDTO> primary = primaryLookup.get();
        if (primary.isPresent()) {
            return primary.get();
        }
        return fallbackLookup.get().orElse(null);
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
        if (matchesPassword(rawPassword, loginIncorrectVO.getUserId(), loginIncorrectVO.getUserPw())) {
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
                findGeneralMember(userId).ifPresent(gnrlMber -> {
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
                findEmployeeMember(userId).ifPresent(emplyrInfo -> {
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
        String normalizedSalt = userId.toLowerCase(java.util.Locale.ROOT);
        String normalizedEncoded = encryptPassword(rawPassword, normalizedSalt);
        String legacyEncoded = encryptPassword(rawPassword, userId);
        return Objects.equals(normalizedEncoded, storedPassword)
                || Objects.equals(legacyEncoded, storedPassword)
                || Objects.equals(rawPassword, storedPassword);
    }

    private String normalizeUserId(String userId) {
        return userId == null ? null : userId.trim();
    }

    @Override
    public void updateAuthInfo(String userId, String userSe, String authTy, String authDn, String authCi,
            String authDi) {
        switch (userSe) {
            case "GNR":
                genRepository.findById(userId).map(entity -> {
                    entity.setAuthTy(authTy);
                    entity.setAuthDn(authDn);
                    entity.setAuthCi(authCi);
                    entity.setAuthDi(authDi);
                    return genRepository.saveAndFlush(entity);
                }).orElseThrow(() -> new IllegalStateException("인증 대상 계정을 찾을 수 없습니다."));
                break;
            case "ENT":
                findEnterpriseMember(userId).map(entity -> {
                    entity.setAuthTy(authTy);
                    entity.setAuthDn(authDn);
                    entity.setAuthCi(authCi);
                    entity.setAuthDi(authDi);
                    return entRepository.saveAndFlush(entity);
                }).orElseThrow(() -> new IllegalStateException("인증 대상 계정을 찾을 수 없습니다."));
                break;
            case "USR":
                empRepository.findById(userId).map(entity -> {
                    entity.setAuthTy(authTy);
                    entity.setAuthDn(authDn);
                    entity.setAuthCi(authCi);
                    entity.setAuthDi(authDi);
                    return empRepository.saveAndFlush(entity);
                }).orElseThrow(() -> new IllegalStateException("인증 대상 계정을 찾을 수 없습니다."));
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
    public LoginResponseDTO resolveAuthenticatedLoginUser(String principalName) {
        if (ObjectUtils.isEmpty(principalName)) return null;
        var token = authLoginMapper.selectActiveAuthToken(principalName);
        if (token == null) return null;
        String storedId = token.entrySet().stream().filter(e -> "userId".equalsIgnoreCase(e.getKey()))
                .map(e -> Objects.toString(e.getValue(), "")).findFirst().orElse("");
        String storedType = token.entrySet().stream().filter(e -> "userSe".equalsIgnoreCase(e.getKey()))
                .map(e -> Objects.toString(e.getValue(), "")).findFirst().orElse("");
        if (!principalName.equalsIgnoreCase(storedId) || !List.of("ENT", "GNR", "USR").contains(storedType)) return null;
        return selectActiveIdentityAccount(storedType, storedId);
    }

    private LoginResponseDTO selectActiveIdentityAccount(String userSe, String userId) {
        // Use the same approved-account queries as password login, not legacy ENT status A.
        return switch (userSe) {
            case "ENT" -> authLoginMapper.selectEnterpriseLoginUser(userId);
            case "GNR" -> authLoginMapper.selectGeneralLoginUser(userId);
            case "USR" -> authLoginMapper.selectEmployeeLoginUser(userId);
            default -> null;
        };
    }

    @Override
    public long countExternalIdentityMatches(String authCi) {
        String ci = normalizeExternalIdentity(authCi);
        if (ObjectUtils.isEmpty(ci)) return 0;
        return entRepository.countByAuthCi(ci) + genRepository.countByAuthCi(ci) + empRepository.countByAuthCi(ci);
    }

    /** Link only after server-authenticated account and fresh provider verification.
     * A shared advisory lock serializes CI assignment across account types and JVMs.
     * Existing identities cannot be replaced by this first-link operation. */
    @Override
    @Transactional(rollbackFor = Exception.class)
    public void linkExternalIdentity(String userId, String userSe, String authTy, String authDn, String authCi, String authDi) {
        String ci = normalizeExternalIdentity(authCi);
        if (ObjectUtils.isEmpty(ci)) throw new IllegalArgumentException("본인확인 식별값을 확인하지 못했습니다.");
        credentialMutationLockService.acquireInCurrentTransaction("external-identity-link");
        credentialMutationLockService.acquireInCurrentTransaction(userId);
        LoginResponseDTO account = resolveAuthenticatedLoginUser(userId);
        if (account == null || !userSe.equals(account.getUserSe())) {
            throw new IllegalStateException("로그인 세션이 변경되었습니다. 다시 로그인해 주세요.");
        }
        String currentCi = normalizeExternalIdentity(account.getAuthCi());
        long matches = countExternalIdentityMatches(ci);
        if ((!ObjectUtils.isEmpty(currentCi) && !ci.equals(currentCi)) || matches > (ci.equals(currentCi) ? 1 : 0)) {
            throw new IllegalStateException("이미 다른 인증 연결이 존재합니다. 자동으로 덮어쓰지 않습니다. 관리자에게 계정 연결 확인을 요청해 주세요.");
        }
        updateAuthInfo(userId, userSe, authTy, authDn, ci, authDi);
        // saveAndFlush propagates SQL failures. Do not use a cached MyBatis account
        // select to read back a JPA update inside the same transaction.
    }

    @Override
    public LoginResponseDTO findLoginUserByExternalIdentity(String authCi, String authDi) {
        String normalizedCi = normalizeExternalIdentity(authCi);
        String normalizedDi = normalizeExternalIdentity(authDi);

        if (!ObjectUtils.isEmpty(normalizedCi)) {
            long matches = entRepository.countByAuthCi(normalizedCi)
                    + genRepository.countByAuthCi(normalizedCi)
                    + empRepository.countByAuthCi(normalizedCi);
            // A CI collision must not silently select the first account, even across account types.
            if (matches > 1) {
                return null;
            }
            if (matches == 1) {
                return findLoginUserByCi(normalizedCi);
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
            return selectActiveIdentityAccount("ENT", enterprise.get().getEntrprsMberId());
        }

        Optional<GnrlMber> general = genRepository.findFirstByAuthCi(authCi);
        if (general.isPresent()) {
            return selectActiveIdentityAccount("GNR", general.get().getMberId());
        }

        Optional<EmplyrInfo> employee = empRepository.findFirstByAuthCi(authCi);
        if (employee.isPresent()) {
            return selectActiveIdentityAccount("USR", employee.get().getEmplyrId());
        }

        return null;
    }

    private LoginResponseDTO findLoginUserByDi(String authDi) {
        Optional<EntrprsMber> enterprise = entRepository.findFirstByAuthDi(authDi);
        if (enterprise.isPresent()) {
            return selectActiveIdentityAccount("ENT", enterprise.get().getEntrprsMberId());
        }

        Optional<GnrlMber> general = genRepository.findFirstByAuthDi(authDi);
        if (general.isPresent()) {
            return selectActiveIdentityAccount("GNR", general.get().getMberId());
        }

        Optional<EmplyrInfo> employee = empRepository.findFirstByAuthDi(authDi);
        if (employee.isPresent()) {
            return selectActiveIdentityAccount("USR", employee.get().getEmplyrId());
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
    @Transactional(rollbackFor = Exception.class)
    public boolean resetPassword(String userId, String newPassword) {
        return resetPassword(userId, newPassword, null, null, "SELF_SERVICE");
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean resetPassword(String userId, String newPassword, String resetByUserId, String resetIp, String resetSource) {
        String normalizedUserId = normalizeUserId(userId);
        if (ObjectUtils.isEmpty(normalizedUserId) || ObjectUtils.isEmpty(newPassword)) {
            return false;
        }

        credentialMutationLockService.acquireInCurrentTransaction(normalizedUserId);
        String encPassword = encryptPassword(newPassword,
                normalizedUserId.toLowerCase(java.util.Locale.ROOT));
        LocalDateTime now = LocalDateTime.now();

        Optional<EntrprsMber> entOpt = findEnterpriseMember(normalizedUserId);
        if (entOpt.isPresent()) {
            EntrprsMber entity = entOpt.get();
            entity.setEntrprsMberPassword(encPassword);
            entity.setChgPwdLastPnttm(now);
            entity.setLockAt(null);
            entity.setLockCnt(0);
            entity.setLockLastPnttm(null);
            entRepository.save(entity);
            completePasswordReset(normalizedUserId, "ENT", resetByUserId, resetIp, resetSource, now);
            return true;
        }

        Optional<GnrlMber> gnrOpt = findGeneralMember(normalizedUserId);
        if (gnrOpt.isPresent()) {
            GnrlMber entity = gnrOpt.get();
            entity.setPassword(encPassword);
            entity.setChgPwdLastPnttm(now);
            entity.setLockAt(null);
            entity.setLockCnt(0);
            entity.setLockLastPnttm(null);
            genRepository.save(entity);
            completePasswordReset(normalizedUserId, "GNR", resetByUserId, resetIp, resetSource, now);
            return true;
        }

        Optional<EmplyrInfo> usrOpt = findEmployeeMember(normalizedUserId);
        if (usrOpt.isPresent()) {
            EmplyrInfo entity = usrOpt.get();
            entity.setPassword(encPassword);
            entity.setChgPwdLastPnttm(now);
            entity.setLockAt(null);
            entity.setLockCnt(0);
            entity.setLockLastPnttm(null);
            empRepository.save(entity);
            completePasswordReset(normalizedUserId, "USR", resetByUserId, resetIp, resetSource, now);
            return true;
        }

        return false;
    }

    @Override
    @Transactional(rollbackFor = Exception.class)
    public boolean resetPassword(String userId, String userSe, String newPassword, String resetByUserId,
            String resetIp, String resetSource) {
        String normalizedUserId = normalizeUserId(userId);
        if (ObjectUtils.isEmpty(normalizedUserId) || ObjectUtils.isEmpty(userSe) || ObjectUtils.isEmpty(newPassword)) {
            return false;
        }

        String normalizedUserSe = userSe.trim().toUpperCase(java.util.Locale.ROOT);
        if (!List.of("ENT", "GNR", "USR").contains(normalizedUserSe)) {
            return false;
        }

        credentialMutationLockService.acquireInCurrentTransaction(normalizedUserId);
        String encPassword = encryptPassword(newPassword,
                normalizedUserId.toLowerCase(java.util.Locale.ROOT));
        LocalDateTime now = LocalDateTime.now();

        if ("ENT".equals(normalizedUserSe)) {
            Optional<EntrprsMber> member = findEnterpriseMember(normalizedUserId)
                    .filter(entity -> List.of("A", "P").contains(String.valueOf(entity.getEntrprsMberStus()).toUpperCase(java.util.Locale.ROOT)));
            if (member.isEmpty()) {
                return false;
            }
            EntrprsMber entity = member.get();
            entity.setEntrprsMberPassword(encPassword);
            entity.setChgPwdLastPnttm(now);
            entity.setLockAt(null);
            entity.setLockCnt(0);
            entity.setLockLastPnttm(null);
            entRepository.save(entity);
            completePasswordReset(normalizedUserId, normalizedUserSe, resetByUserId, resetIp, resetSource, now);
            return true;
        }

        if ("GNR".equals(normalizedUserSe)) {
            Optional<GnrlMber> member = findGeneralMember(normalizedUserId)
                    .filter(entity -> "P".equalsIgnoreCase(entity.getMberStus()));
            if (member.isEmpty()) {
                return false;
            }
            GnrlMber entity = member.get();
            entity.setPassword(encPassword);
            entity.setChgPwdLastPnttm(now);
            entity.setLockAt(null);
            entity.setLockCnt(0);
            entity.setLockLastPnttm(null);
            genRepository.save(entity);
            completePasswordReset(normalizedUserId, normalizedUserSe, resetByUserId, resetIp, resetSource, now);
            return true;
        }

        if ("USR".equals(normalizedUserSe)) {
            Optional<EmplyrInfo> member = findEmployeeMember(normalizedUserId)
                    .filter(entity -> "P".equalsIgnoreCase(entity.getEmplyrStusCode()));
            if (member.isEmpty()) {
                return false;
            }
            EmplyrInfo entity = member.get();
            entity.setPassword(encPassword);
            entity.setChgPwdLastPnttm(now);
            entity.setLockAt(null);
            entity.setLockCnt(0);
            entity.setLockLastPnttm(null);
            empRepository.save(entity);
            completePasswordReset(normalizedUserId, normalizedUserSe, resetByUserId, resetIp, resetSource, now);
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

    private void completePasswordReset(String userId, String userSe, String resetByUserId, String resetIp,
            String resetSource, LocalDateTime resetPnttm) {
        savePasswordResetHistory(userId, userSe, resetByUserId, resetIp, resetSource, resetPnttm);
        credentialRevocationService.revokeAfterPasswordChange(userId);
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
            Optional<EntrprsMber> projectScoped = entRepository
                    .findFirstByEntrprsMberIdIgnoreCaseAndProjectId(normalizedUserId, projectId);
            if (projectScoped.isPresent()) {
                return projectScoped;
            }
        }
        return entRepository.findFirstByEntrprsMberIdIgnoreCase(normalizedUserId);
    }

    private Optional<EmplyrInfo> findEmployeeMember(String userId) {
        String normalizedUserId = normalizeUserId(userId);
        return ObjectUtils.isEmpty(normalizedUserId)
                ? Optional.empty()
                : empRepository.findFirstByEmplyrIdIgnoreCase(normalizedUserId);
    }

    private Optional<GnrlMber> findGeneralMember(String userId) {
        String normalizedUserId = normalizeUserId(userId);
        return ObjectUtils.isEmpty(normalizedUserId)
                ? Optional.empty()
                : genRepository.findFirstByMberIdIgnoreCase(normalizedUserId);
    }

    private String currentProjectId() {
        return projectRuntimeContext == null ? "" : safeValue(projectRuntimeContext.getProjectId());
    }

    private String safeValue(String value) {
        return value == null ? "" : value.trim();
    }

}
