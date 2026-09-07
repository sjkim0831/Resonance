package egovframework.com.feature.auth.service;

import egovframework.com.feature.auth.mapper.AuthLoginMapper;
import egovframework.com.feature.auth.util.JwtTokenProvider;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.JwtException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.ObjectUtils;

import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthTokenStoreService {

    public enum LogoutRevocationResult {
        REVOKED,
        INVALID_OR_MISSING_TOKEN
    }

    private static final DateTimeFormatter TOKEN_DATETIME =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss").withZone(ZoneId.systemDefault());

    private final AuthLoginMapper authLoginMapper;
    private final JwtTokenProvider jwtTokenProvider;
    private final CredentialMutationLockService credentialMutationLockService;

    @Transactional(rollbackFor = Exception.class)
    public void saveLoginToken(String userId, String userSe, String accessToken, String refreshToken,
            long refreshExpirationMillis, HttpServletRequest request) {
        if (ObjectUtils.isEmpty(userId) || ObjectUtils.isEmpty(accessToken)
                || ObjectUtils.isEmpty(refreshToken) || refreshExpirationMillis <= 0L) {
            throw new IllegalArgumentException("Complete token-store data is required before login can succeed");
        }

        credentialMutationLockService.acquireInCurrentTransaction(userId);
        Map<String, Object> params = new HashMap<>();
        params.put("userId", userId);
        params.put("userSe", safeString(userSe));
        params.put("tokenKey", jwtTokenProvider.generateTokenHash(refreshToken));
        params.put("accessTokenHash", jwtTokenProvider.generateTokenHash(accessToken));
        params.put("refreshTokenHash", jwtTokenProvider.generateTokenHash(refreshToken));
        params.put("expiresAt", TOKEN_DATETIME.format(Instant.now().plusMillis(refreshExpirationMillis)));
        params.put("clientIp", resolveClientIp(request));
        params.put("userAgent", request == null ? "" : safeString(request.getHeader("User-Agent")));

        authLoginMapper.deleteAuthTokenByUserId(userId);
        int inserted = authLoginMapper.insertAuthToken(params);
        if (inserted != 1) {
            throw new IllegalStateException("Authentication token was not persisted exactly once");
        }
    }

    public boolean isRefreshTokenAccepted(String userId, String refreshToken) {
        if (ObjectUtils.isEmpty(userId) || ObjectUtils.isEmpty(refreshToken)) {
            return false;
        }

        try {
            Map<String, Object> token = authLoginMapper.selectActiveAuthToken(userId);
            if (token == null || token.isEmpty()) {
                return false;
            }
            String expectedHash = mapString(token, "refreshTokenHash");
            if (!jwtTokenProvider.tokenHashMatches(expectedHash, refreshToken)) {
                return false;
            }
            return authLoginMapper.touchAuthToken(mapString(token, "tokenKey")) == 1;
        } catch (DataAccessException e) {
            log.error("Auth token store is unavailable. Refresh validation failed closed. userId={}", userId, e);
            return false;
        }
    }

    /**
     * Validate the current refresh hash and replace the token pair while holding the
     * same database row lock. Account-recovery deletion therefore happens strictly
     * before or after this rotation; a deleted row can never be reinserted here.
     */
    @Transactional(rollbackFor = Exception.class)
    public boolean rotateLoginToken(String userId, String userSe, String currentRefreshToken,
            String newAccessToken, String newRefreshToken, long refreshExpirationMillis,
            HttpServletRequest request) {
        if (ObjectUtils.isEmpty(userId) || ObjectUtils.isEmpty(currentRefreshToken)
                || ObjectUtils.isEmpty(newAccessToken) || ObjectUtils.isEmpty(newRefreshToken)
                || refreshExpirationMillis <= 0L) {
            return false;
        }

        credentialMutationLockService.acquireInCurrentTransaction(userId);
        Map<String, Object> storedToken = authLoginMapper.selectActiveAuthTokenForUpdate(userId);
        if (storedToken == null || storedToken.isEmpty()) {
            return false;
        }
        String expectedRefreshHash = mapString(storedToken, "refreshTokenHash");
        if (!jwtTokenProvider.tokenHashMatches(expectedRefreshHash, currentRefreshToken)) {
            return false;
        }
        String currentTokenKey = mapString(storedToken, "tokenKey");
        if (currentTokenKey.isEmpty()) {
            return false;
        }

        Map<String, Object> params = new HashMap<>();
        params.put("userId", userId);
        String normalizedUserSe = safeString(userSe);
        params.put("userSe", normalizedUserSe.isEmpty() ? mapString(storedToken, "userSe") : normalizedUserSe);
        params.put("currentTokenKey", currentTokenKey);
        params.put("tokenKey", jwtTokenProvider.generateTokenHash(newRefreshToken));
        params.put("accessTokenHash", jwtTokenProvider.generateTokenHash(newAccessToken));
        params.put("refreshTokenHash", jwtTokenProvider.generateTokenHash(newRefreshToken));
        params.put("expiresAt", TOKEN_DATETIME.format(Instant.now().plusMillis(refreshExpirationMillis)));
        params.put("clientIp", resolveClientIp(request));
        params.put("userAgent", request == null ? "" : safeString(request.getHeader("User-Agent")));
        return authLoginMapper.rotateAuthToken(params) == 1;
    }

    /**
     * Revoke the single persisted login session only after an access or refresh
     * token is bound to the current token-store row. Invalid/stale tokens never
     * select an account for revocation, while database and row-count failures
     * fail closed for the controller to surface as HTTP 503.
     */
    @Transactional(rollbackFor = Exception.class)
    public LogoutRevocationResult revokeLogoutTokens(String accessToken, String refreshToken) {
        try {
            String accessUser = resolveBoundUser(accessToken, true);
            String refreshUser = resolveBoundUser(refreshToken, false);
            if (!accessUser.isEmpty() && !refreshUser.isEmpty()
                    && !accessUser.equalsIgnoreCase(refreshUser)) {
                return LogoutRevocationResult.INVALID_OR_MISSING_TOKEN;
            }
            String canonicalUser = !accessUser.isEmpty() ? accessUser : refreshUser;
            if (canonicalUser.isEmpty()) {
                return LogoutRevocationResult.INVALID_OR_MISSING_TOKEN;
            }
            int deleted = authLoginMapper.deleteAuthTokenByUserId(canonicalUser);
            if (deleted != 1) {
                throw new IllegalStateException("Authentication token revocation did not delete exactly one row");
            }
            return LogoutRevocationResult.REVOKED;
        } catch (DataAccessException e) {
            throw new IllegalStateException("Authentication token store is unavailable during logout", e);
        }
    }

    public void revokeByRefreshToken(String userId, String refreshToken) {
        if (ObjectUtils.isEmpty(userId)) {
            return;
        }
        try {
            if (!ObjectUtils.isEmpty(refreshToken)) {
                authLoginMapper.deleteAuthTokenByTokenKey(jwtTokenProvider.generateTokenHash(refreshToken));
                return;
            }
            authLoginMapper.deleteAuthTokenByUserId(userId);
        } catch (DataAccessException e) {
            log.warn("Failed to revoke auth token from token store. userId={}", userId, e);
        }
    }

    /** Revoke every persisted refresh/access token for an account after credential recovery. */
    public void revokeAll(String userId) {
        if (ObjectUtils.isEmpty(userId)) {
            return;
        }
        try {
            authLoginMapper.deleteAuthTokenByUserId(userId);
        } catch (DataAccessException e) {
            throw new IllegalStateException("Failed to revoke active authentication tokens", e);
        }
    }

    private String resolveBoundUser(String token, boolean accessToken) {
        if (ObjectUtils.isEmpty(token)) {
            return "";
        }
        try {
            Claims claims = accessToken
                    ? jwtTokenProvider.accessExtractClaims(token)
                    : jwtTokenProvider.refreshExtractClaims(token);
            Object encodedUserId = claims == null ? null : claims.get("userId");
            if (ObjectUtils.isEmpty(encodedUserId)) {
                return "";
            }
            String claimedUser = safeString(jwtTokenProvider.decrypt(String.valueOf(encodedUserId)));
            if (claimedUser.isEmpty()) {
                return "";
            }
            Map<String, Object> storedToken = authLoginMapper.selectActiveAuthToken(claimedUser);
            String canonicalUser = mapString(storedToken, "userId");
            String expectedHash = mapString(storedToken,
                    accessToken ? "accessTokenHash" : "refreshTokenHash");
            if (canonicalUser.isEmpty() || !canonicalUser.equalsIgnoreCase(claimedUser)
                    || !jwtTokenProvider.tokenHashMatches(expectedHash, token)) {
                return "";
            }
            return canonicalUser;
        } catch (JwtException | IllegalArgumentException e) {
            return "";
        }
    }

    private String resolveClientIp(HttpServletRequest request) {
        if (request == null) {
            return "";
        }
        String forwardedFor = safeString(request.getHeader("X-Forwarded-For"));
        if (!forwardedFor.isEmpty()) {
            return safeString(forwardedFor.split(",")[0]);
        }
        String realIp = safeString(request.getHeader("X-Real-IP"));
        return realIp.isEmpty() ? safeString(request.getRemoteAddr()) : realIp;
    }

    private String safeString(String value) {
        return value == null ? "" : value.trim();
    }

    private String mapString(Map<String, Object> row, String key) {
        if (row == null || key == null) {
            return "";
        }
        Object value = row.get(key);
        if (value == null) {
            value = row.get(key.toUpperCase());
        }
        if (value == null) {
            String snakeKey = key.replaceAll("([a-z])([A-Z])", "$1_$2").toUpperCase();
            value = row.get(snakeKey);
        }
        if (value == null) {
            String normalizedKey = normalizeMapKey(key);
            for (Map.Entry<String, Object> entry : row.entrySet()) {
                if (normalizeMapKey(entry.getKey()).equals(normalizedKey)) {
                    value = entry.getValue();
                    break;
                }
            }
        }
        return value == null ? "" : String.valueOf(value).trim();
    }

    private String normalizeMapKey(Object key) {
        return key == null ? "" : String.valueOf(key).replaceAll("[^A-Za-z0-9]", "").toLowerCase(Locale.ROOT);
    }
}
