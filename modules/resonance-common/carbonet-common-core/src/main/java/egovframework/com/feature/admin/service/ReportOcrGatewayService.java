package egovframework.com.feature.admin.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class ReportOcrGatewayService {

    public static final int MAX_PAGES = 10;
    public static final long MAX_PAGE_BYTES = 12L * 1024L * 1024L;

    private final ObjectMapper objectMapper;
    private final HttpClient httpClient;
    private final URI endpoint;

    public ReportOcrGatewayService(ObjectMapper objectMapper,
                                   @Value("${carbonet.report-ocr.url:http://127.0.0.1:8091/v1/report-ocr}") String endpoint) {
        this.objectMapper = objectMapper;
        this.endpoint = URI.create(endpoint);
        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(3))
                .build();
    }

    public Map<String, Object> recognize(List<MultipartFile> files) {
        if (files == null || files.isEmpty() || files.size() > MAX_PAGES) {
            throw new IllegalArgumentException("Between 1 and 10 report page images are required.");
        }
        String boundary = "carbonet-report-ocr-" + UUID.randomUUID();
        byte[] requestBody;
        try {
            requestBody = multipartBody(files, boundary);
        } catch (IOException exception) {
            throw new IllegalArgumentException("The report page images could not be read.", exception);
        }
        HttpRequest request = HttpRequest.newBuilder(endpoint)
                .timeout(Duration.ofSeconds(180))
                .header("Accept", "application/json")
                .header("Content-Type", "multipart/form-data; boundary=" + boundary)
                .POST(HttpRequest.BodyPublishers.ofByteArray(requestBody))
                .build();
        try {
            HttpResponse<byte[]> response = httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
            if (response.statusCode() != 200) {
                throw new ReportOcrUnavailableException("Report OCR returned HTTP " + response.statusCode() + ".");
            }
            return objectMapper.readValue(response.body(), new TypeReference<>() { });
        } catch (InterruptedException exception) {
            Thread.currentThread().interrupt();
            throw new ReportOcrUnavailableException("Report OCR was interrupted.", exception);
        } catch (IOException exception) {
            throw new ReportOcrUnavailableException("Report OCR is temporarily unavailable.", exception);
        }
    }

    private byte[] multipartBody(List<MultipartFile> files, String boundary) throws IOException {
        ByteArrayOutputStream output = new ByteArrayOutputStream();
        for (int index = 0; index < files.size(); index++) {
            MultipartFile file = files.get(index);
            if (file == null || file.isEmpty() || file.getSize() > MAX_PAGE_BYTES) {
                throw new IllegalArgumentException("Each report page must be a non-empty image of at most 12 MB.");
            }
            String contentType = file.getContentType();
            if (contentType == null || !contentType.startsWith("image/")) {
                throw new IllegalArgumentException("Only report page images can be OCR processed.");
            }
            write(output, "--" + boundary + "\r\n");
            write(output, "Content-Disposition: form-data; name=\"files\"; filename=\"page-" + (index + 1) + ".png\"\r\n");
            write(output, "Content-Type: " + contentType + "\r\n\r\n");
            output.write(file.getBytes());
            write(output, "\r\n");
        }
        write(output, "--" + boundary + "--\r\n");
        return output.toByteArray();
    }

    private void write(ByteArrayOutputStream output, String value) throws IOException {
        output.write(value.getBytes(StandardCharsets.UTF_8));
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
