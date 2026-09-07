package egovframework.com.feature.auth.util;

import egovframework.com.feature.auth.dto.response.LoginResponseDTO;
import egovframework.com.feature.auth.mapper.AuthLoginMapper;
import org.egovframe.boot.crypto.service.impl.EgovEnvCryptoServiceImpl;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataAccessResourceFailureException;

import java.lang.reflect.Field;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class JwtTokenProviderAccessRevocationTest {

    private JwtTokenProvider provider;
    private AuthLoginMapper mapper;

    @BeforeEach
    void setUp() throws Exception {
        EgovEnvCryptoServiceImpl crypto = mock(EgovEnvCryptoServiceImpl.class);
        when(crypto.encrypt(anyString())).thenAnswer(invocation -> invocation.getArgument(0));
        when(crypto.decrypt(anyString())).thenAnswer(invocation -> invocation.getArgument(0));

        provider = new JwtTokenProvider(crypto);
        mapper = mock(AuthLoginMapper.class);
        provider.setAuthLoginMapper(mapper);
        setField("accessSecret", Base64.getEncoder().encodeToString(
                "revocation-contract-signing-key-32".getBytes(StandardCharsets.UTF_8)));
        setField("accessExpiration", "60000");
    }

    @Test
    void acceptsOnlyTheExactPersistedAccessToken() {
        String token = accessToken("member01");
        when(mapper.selectActiveAuthToken("member01"))
                .thenReturn(Map.of("accessTokenHash", provider.generateTokenHash(token)));

        assertEquals(200, provider.accessValidateToken(token));
    }

    @Test
    void acceptsPostgresFoldedAliasKey() {
        String token = accessToken("member01");
        when(mapper.selectActiveAuthToken("member01"))
                .thenReturn(Map.of("accesstokenhash", provider.generateTokenHash(token)));

        assertEquals(200, provider.accessValidateToken(token));
    }

    @Test
    void rejectsTokenImmediatelyAfterStoreRowIsDeleted() {
        String token = accessToken("member01");
        when(mapper.selectActiveAuthToken("member01")).thenReturn(null);

        assertEquals(401, provider.accessValidateToken(token));
    }

    @Test
    void rejectsAValidJwtWhenAnotherAccessTokenReplacedIt() {
        String token = accessToken("member01");
        when(mapper.selectActiveAuthToken("member01"))
                .thenReturn(Map.of("accessTokenHash", provider.generateTokenHash("replacement-token")));

        assertEquals(401, provider.accessValidateToken(token));
    }

    @Test
    void failsClosedWhenTokenStoreCannotBeRead() {
        String token = accessToken("member01");
        when(mapper.selectActiveAuthToken("member01"))
                .thenThrow(new DataAccessResourceFailureException("store unavailable"));

        assertEquals(503, provider.accessValidateToken(token));
    }

    @Test
    void failsClosedWhenRuntimeMapperIsNotInjected() throws Exception {
        String token = accessToken("member01");
        Field mapperField = JwtTokenProvider.class.getDeclaredField("authLoginMapper");
        mapperField.setAccessible(true);
        mapperField.set(provider, null);

        assertEquals(401, provider.accessValidateToken(token));
    }

    private String accessToken(String userId) {
        LoginResponseDTO login = new LoginResponseDTO();
        login.setUserId(userId);
        login.setName("member");
        login.setUniqId("UNIQ-1");
        login.setAuthorList("/home/**");
        return provider.createAccessToken(login);
    }

    private void setField(String name, Object value) throws Exception {
        Field field = JwtTokenProvider.class.getDeclaredField(name);
        field.setAccessible(true);
        field.set(provider, value);
    }
}
