package egovframework.com.feature.admin.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Locale;

@Service
public class CertificateAuthenticityService {

    private static final String HMAC_ALGORITHM = "HmacSHA256";
    private static final String DATA_DOMAIN = "carbonet-certificate-data-v1";
    private static final String PDF_DOMAIN = "carbonet-certificate-pdf-v1";
    private static final String ENVELOPE_PREFIX = "hmac-v1:";

    private final byte[] signingKey;
    private final String keyId;

    public CertificateAuthenticityService(
            @Value("${carbonet.certificate.signing-key-base64:${CARBONET_CERTIFICATE_SIGNING_KEY_BASE64:}}")
            String encodedSigningKey,
            @Value("${carbonet.certificate.signing-key-id:${CARBONET_CERTIFICATE_SIGNING_KEY_ID:primary}}")
            String configuredKeyId) {
        if (encodedSigningKey == null || encodedSigningKey.isBlank()) {
            throw new IllegalStateException("CARBONET_CERTIFICATE_SIGNING_KEY_BASE64 is required.");
        }
        try {
            this.signingKey = Base64.getDecoder().decode(encodedSigningKey.trim());
        } catch (IllegalArgumentException exception) {
            throw new IllegalStateException("The certificate signing key is not valid Base64.", exception);
        }
        if (signingKey.length < 32) {
            throw new IllegalStateException("The certificate signing key must contain at least 32 bytes.");
        }
        this.keyId = configuredKeyId == null || !configuredKeyId.matches("[A-Za-z0-9._-]{1,32}")
                ? "primary" : configuredKeyId;
    }

    public String signDataset(String certificateId, String payloadHash, String datasetHash) {
        return hmac(DATA_DOMAIN, certificateId, payloadHash, datasetHash)
                .substring(0, 24).toUpperCase(Locale.ROOT);
    }

    public boolean verifyDataset(String certificateId, String payloadHash, String datasetHash,
                                 String integrityCode) {
        if (integrityCode == null || !integrityCode.matches("[A-Fa-f0-9]{24}")) {
            return false;
        }
        return MessageDigest.isEqual(
                signDataset(certificateId, payloadHash, datasetHash).getBytes(StandardCharsets.US_ASCII),
                integrityCode.toUpperCase(Locale.ROOT).getBytes(StandardCharsets.US_ASCII));
    }

    public String signPdfEnvelope(String certificateId, String payloadHash, String datasetHash,
                                  String integrityCode, String pdfSha256, long pdfSizeBytes,
                                  String ocrEvidenceSha256) {
        return ENVELOPE_PREFIX + keyId + ":" + hmac(PDF_DOMAIN, certificateId, payloadHash,
                datasetHash, integrityCode, pdfSha256, Long.toString(pdfSizeBytes), ocrEvidenceSha256);
    }

    public boolean verifyPdfEnvelope(String envelope, String certificateId, String payloadHash,
                                     String datasetHash, String integrityCode, String pdfSha256,
                                     long pdfSizeBytes, String ocrEvidenceSha256) {
        if (envelope == null || !envelope.startsWith(ENVELOPE_PREFIX)) {
            return false;
        }
        String[] parts = envelope.split(":", 3);
        if (parts.length != 3 || !keyId.equals(parts[1]) || !parts[2].matches("[0-9a-f]{64}")) {
            return false;
        }
        String expected = signPdfEnvelope(certificateId, payloadHash, datasetHash, integrityCode,
                pdfSha256, pdfSizeBytes, ocrEvidenceSha256);
        return MessageDigest.isEqual(expected.getBytes(StandardCharsets.US_ASCII),
                envelope.getBytes(StandardCharsets.US_ASCII));
    }

    public boolean isSignedEnvelope(String value) {
        return value != null && value.startsWith(ENVELOPE_PREFIX);
    }

    private String hmac(String domain, String... fields) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(signingKey, HMAC_ALGORITHM));
            mac.update(domain.getBytes(StandardCharsets.UTF_8));
            for (String field : fields) {
                mac.update((byte) 0);
                mac.update((field == null ? "" : field).getBytes(StandardCharsets.UTF_8));
            }
            return HexFormat.of().formatHex(mac.doFinal());
        } catch (Exception exception) {
            throw new IllegalStateException("Certificate authenticity signature failed.", exception);
        }
    }
}
