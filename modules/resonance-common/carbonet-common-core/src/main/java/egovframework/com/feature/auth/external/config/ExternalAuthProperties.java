package egovframework.com.feature.auth.external.config;

import lombok.Getter;
import lombok.Setter;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

import java.util.Arrays;
import java.util.List;

@Component
@ConfigurationProperties(prefix = "security.external-auth")
@Getter
@Setter
public class ExternalAuthProperties {

    private boolean enabled = true;
    private boolean mockSuccessEnabled = false;
    private List<String> methodOrder = Arrays.asList("SIMPLE", "JOINT", "FINANCIAL");
    private Kisa kisa = new Kisa();

    @Getter
    @Setter
    public static class Kisa {
        private static final String DEFAULT_PUBLIC_KEY_JWK = "{\"alg\":\"RSA-OAEP-256\",\"e\":\"AQAB\",\"ext\":true,\"key_ops\":[\"encrypt\"],\"kty\":\"RSA\",\"n\":\"wvjQmXeGaW8tKl79qxyQKsmC4YEYTpFzRUe4869UK_UZBueenlgDgOXKCTQhULB1xKynGaphS_5GXROQthI8416DIz88WJhZhnLuRfklAq9dhaDr-hHIzo40ICBAuXlX2Zx8rBN1WCt9ThVw-ljAmVpHAFWtkTU-Z9e1bzNKtaT_hYa1o-CK9_dnhUTomvWj_5cvUT41liLw3Kv0Nsy-ROmO6tTcpRWUc6d6MLyzRluQie9TsiCOUGT9m02mdwo6LM-oLw85OeavFnCPCHwBy8VaeKdBXXO6LucCFExhktCKejwvlvD_wZFhCc6cufsqAsRDLOlfLpRStk6EQkO7Rx1Bpx332d9xaYDW-hMg_SCo85nu4mppW6QwGauq7OACpu0CQVCjhdSco_uzqRU2G7x8LyaM-RGysFaSyxFqICjNXe5XZJAEMR-lkXkImw6ZfXNpVqXqBZtbFwccMqaAveXP4g8GhB4iRZoDjUt8gKCZ8bgKMrkcsQnzpS-p2Zhj_GraEhHhFRSUG9ZytRe7qATNlseARIPaaoLIW-t0-7134E9TdZaEVM44sqDdKP5IGne5OZctscsiIQKLJxOUkkjiZXy1RyIV-TqbA-8F8FqZGKIl1FNU6wWu6svV2wQNmNitILJ7lKIdXZJS3pzR016uWcz454OQufkWxstIOnk\"}";

        private boolean enabled = true;
        private String adapterVersion = "v1";
        private String sdkJarPath;
        private String decryptToolPath;
        private String clientId;
        private String serviceCode;
        private String caCode;
        private String publicKeyJwk;
        private String requestTitle = "탄소중립 CCUS 통합관리본부";
        private String prepareEndpoint;
        private String resultEndpoint;
        private String callbackScheme;

        public String getPublicKeyJwk() {
            return publicKeyJwk == null || publicKeyJwk.trim().isEmpty()
                    ? DEFAULT_PUBLIC_KEY_JWK
                    : publicKeyJwk.trim();
        }
    }
}
