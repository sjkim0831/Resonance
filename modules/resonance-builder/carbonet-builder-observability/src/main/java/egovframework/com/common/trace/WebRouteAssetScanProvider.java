package egovframework.com.common.trace;

import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.stereotype.Component;
import org.springframework.web.method.HandlerMethod;
import org.springframework.web.servlet.mvc.method.RequestMappingInfo;
import org.springframework.web.servlet.mvc.method.annotation.RequestMappingHandlerMapping;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Component
@Slf4j
public class WebRouteAssetScanProvider implements AssetScanProvider {

    private final RequestMappingHandlerMapping handlerMapping;

    public WebRouteAssetScanProvider(
            @Qualifier("requestMappingHandlerMapping") RequestMappingHandlerMapping handlerMapping) {
        this.handlerMapping = handlerMapping;
    }

    @Override
    public List<SystemAssetInventoryVO> scan() {
        List<SystemAssetInventoryVO> assets = new ArrayList<>();
        Map<RequestMappingInfo, HandlerMethod> handlerMethods = handlerMapping.getHandlerMethods();

        for (Map.Entry<RequestMappingInfo, HandlerMethod> entry : handlerMethods.entrySet()) {
            RequestMappingInfo mappingInfo = entry.getKey();
            HandlerMethod handlerMethod = entry.getValue();

            // Skip internal or non-business endpoints if necessary
            String beanName = handlerMethod.getBeanType().getSimpleName();
            if (beanName.contains("BasicErrorController") || beanName.contains("ResourceHttpRequestHandler")) {
                continue;
            }

            Set<String> patterns = mappingInfo.getPatternsCondition().getPatterns();
            String path = patterns.isEmpty() ? "" : patterns.iterator().next();
            String methods = mappingInfo.getMethodsCondition().getMethods().stream()
                    .map(Enum::name)
                    .collect(Collectors.joining(","));

            SystemAssetInventoryVO asset = new SystemAssetInventoryVO();
            asset.setAssetId("API-" + generateApiId(path, methods));
            asset.setAssetType("API");
            asset.setAssetName(firstNonBlank(path, handlerMethod.getMethod().getName()));
            asset.setSourcePath(handlerMethod.getBeanType().getName());
            asset.setSourceSymbol(handlerMethod.getMethod().getName() + "(" + methods + ")");
            asset.setOwnerDomain(inferDomain(path));
            asset.setContentHash(generateHash(handlerMethod));
            asset.setActiveYn("Y");
            asset.setCreatedAt(LocalDateTime.now());
            asset.setUpdatedAt(LocalDateTime.now());
            
            assets.add(asset);
        }

        return assets;
    }

    @Override
    public List<SystemAssetCompositionVO> traceDependencies(List<SystemAssetInventoryVO> assets) {
        // Dependency tracing for APIs usually involves looking at what Services they call.
        // This is complex for static analysis without a parser, but we can placeholder it.
        return new ArrayList<>();
    }

    private String generateApiId(String path, String methods) {
        String safePath = path.replaceAll("[^a-zA-Z0-9]", "-").replaceAll("-{2,}", "-");
        if (safePath.startsWith("-")) safePath = safePath.substring(1);
        return (methods.isEmpty() ? "ANY" : methods.split(",")[0]) + "-" + (safePath.isEmpty() ? "root" : safePath);
    }

    private String generateHash(HandlerMethod method) {
        // In a real implementation, this might hash the bytecode or the source if available.
        return Integer.toHexString(method.toString().hashCode());
    }

    private String firstNonBlank(String primary, String fallback) {
        return (primary == null || primary.trim().isEmpty()) ? fallback : primary.trim();
    }

    private String inferDomain(String path) {
        if (path.startsWith("/admin/") || path.startsWith("/api/admin/")) return "admin";
        if (path.startsWith("/api/external/")) return "external";
        return "home";
    }
}
