package egovframework.com.feature.admin.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.ParameterizedTypeReference;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.net.URI;
import java.util.List;
import java.util.Map;

@Service
public class ReportOcrGatewayService {

    public static final int MAX_PAGES = 10;
    public static final long MAX_PAGE_BYTES = 12L * 1024L * 1024L;

    private final RestClient restClient;
    private final URI endpoint;

    public ReportOcrGatewayService(
            @Value("${carbonet.report-ocr.url:http://127.0.0.1:8091/v1/report-ocr}") String endpoint) {
        this.endpoint = URI.create(endpoint);
        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(3_000);
        requestFactory.setReadTimeout(180_000);
        this.restClient = RestClient.builder().requestFactory(requestFactory).build();
    }

    public Map<String, Object> recognize(List<MultipartFile> files) {
        if (files == null || files.isEmpty() || files.size() > MAX_PAGES) {
            throw new IllegalArgumentException("Between 1 and 10 report page images are required.");
        }
        MultiValueMap<String, Object> requestBody = new LinkedMultiValueMap<>();
        try {
            for (int index = 0; index < files.size(); index++) {
                MultipartFile file = files.get(index);
                if (file == null || file.isEmpty() || file.getSize() > MAX_PAGE_BYTES) {
                    throw new IllegalArgumentException("Each report page must be a non-empty image of at most 12 MB.");
                }
                String contentType = file.getContentType();
                if (contentType == null || !contentType.startsWith("image/")) {
                    throw new IllegalArgumentException("Only report page images can be OCR processed.");
                }
                int pageNumber = index + 1;
                ByteArrayResource resource = new ByteArrayResource(file.getBytes()) {
                    @Override
                    public String getFilename() {
                        return "page-" + pageNumber + ".png";
                    }
                };
                requestBody.add("files", resource);
            }
        } catch (IOException exception) {
            throw new IllegalArgumentException("The report page images could not be read.", exception);
        }
        try {
            return restClient.post()
                    .uri(endpoint)
                    .contentType(MediaType.MULTIPART_FORM_DATA)
                    .accept(MediaType.APPLICATION_JSON)
                    .body(requestBody)
                    .retrieve()
                    .body(new ParameterizedTypeReference<>() { });
        } catch (RestClientResponseException exception) {
            throw new ReportOcrUnavailableException(
                    "Report OCR returned HTTP " + exception.getStatusCode().value() + ".", exception);
        } catch (RuntimeException exception) {
            throw new ReportOcrUnavailableException("Report OCR is temporarily unavailable.", exception);
        }
    }

    public static class ReportOcrUnavailableException extends RuntimeException {
        public ReportOcrUnavailableException(String message) {
            super(message);
        }

        public ReportOcrUnavailableException(String message, Throwable cause) {
            super(message, cause);
        }
    }
}
