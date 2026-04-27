package egovframework.com.feature.auth.service;

import egovframework.com.feature.auth.mapper.AuthLoginMapper;
import egovframework.com.feature.auth.util.JwtTokenProvider;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataAccessException;
import org.springframework.stereotype.Service;
import org.springframework.util.ObjectUtils;

import jakarta.servlet.http.HttpServletRequest;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.Map;

@Service
@RequiredArgsConstructor
@Slf4j
public class AuthTokenStoreService {

    private static final DateTimeFormatter CUBRID_DATETIME =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss").withZone(ZoneId.systemDefault());

    private final AuthLoginMapper authLoginMapper;
    private final JwtTokenProvider jwtTokenProvider;

    public void saveLoginToken(String userId, String userSe, String accessToken, String refreshToken,
            long refreshExpirationMillis, HttpServletRequest request) {
        if (ObjectUtils.isEmpty(userId) || ObjectUtils.isEmpty(refreshToken)) {
            return;
        }

        Map<String, Object> params = new HashMap<>();
        params.put("userId", userId);
        params.put("userSe", safeString(userSe));
        params.put("tokenKey", jwtTokenProvider.generateTokenHash(refreshToken));
        params.put("accessTokenHash", jwtTokenProvider.generateTokenHash(accessToken));
        params.put("refreshTokenHash", jwtTokenProvider.generateTokenHash(refreshToken));
        params.put("expiresAt", CUBRID_DATETIME.format(Instant.now().plusMillis(refreshExpirationMillis)));
        params.put("clientIp", resolveClientIp(request));
        params.put("userAgent", request == null ? "" : safeString(request.getHeader("User-Agent")));

        try {
            authLoginMapper.deleteAuthTokenByUserId(userId);
            authLoginMapper.insertAuthToken(params);
        } catch (DataAccessException e) {
            log.warn("Auth token store is unavailable. Login continues with JWT-only validation. userId={}", userId, e);
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
            String actualHash = jwtTokenProvider.generateTokenHash(refreshToken);
            if (!expectedHash.equals(actualHash)) {
                return false;
            }
            authLoginMapper.touchAuthToken(mapString(token, "tokenKey"));
            return true;
        } catch (DataAccessException e) {
            log.warn("Auth token store is unavailable. Falling back to JWT-only refresh validation. userId={}", userId, e);
            return true;
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
            log.warn("Failed to revoke auth token from CUBRID token store. userId={}", userId, e);
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
        return value == null ? "" : String.valueOf(value).trim();
    }
}
