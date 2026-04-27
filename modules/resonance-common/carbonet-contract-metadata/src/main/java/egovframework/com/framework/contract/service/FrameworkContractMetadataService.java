package egovframework.com.framework.contract.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import egovframework.com.framework.contract.model.FrameworkContractMetadataVO;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.InputStream;

@Service
public class FrameworkContractMetadataService {

    private static final String RESOURCE_PATH = "framework/contracts/framework-contract-metadata.json";

    private final ObjectMapper objectMapper;

    private volatile FrameworkContractMetadataVO cachedMetadata;

    public FrameworkContractMetadataService(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    public FrameworkContractMetadataVO getMetadata() {
        FrameworkContractMetadataVO cached = cachedMetadata;
        if (cached != null) {
            return cached;
        }
        synchronized (this) {
            if (cachedMetadata == null) {
                cachedMetadata = loadMetadata();
            }
            return cachedMetadata;
        }
    }

    private FrameworkContractMetadataVO loadMetadata() {
        ClassPathResource resource = new ClassPathResource(RESOURCE_PATH);
        try (InputStream inputStream = resource.getInputStream()) {
            return objectMapper.readValue(inputStream, FrameworkContractMetadataVO.class);
        } catch (IOException e) {
            throw new IllegalStateException("Failed to load framework contract metadata: " + RESOURCE_PATH, e);
        }
    }
}
