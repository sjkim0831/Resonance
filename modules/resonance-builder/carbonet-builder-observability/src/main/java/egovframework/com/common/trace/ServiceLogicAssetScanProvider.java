package egovframework.com.common.trace;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationContext;
import org.springframework.stereotype.Component;
import org.springframework.stereotype.Service;

import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
@Slf4j
public class ServiceLogicAssetScanProvider implements AssetScanProvider {

    private final ApplicationContext applicationContext;

    @Override
    public List<SystemAssetInventoryVO> scan() {
        List<SystemAssetInventoryVO> assets = new ArrayList<>();
        Map<String, Object> services = applicationContext.getBeansWithAnnotation(Service.class);

        for (Map.Entry<String, Object> entry : services.entrySet()) {
            Object serviceBean = entry.getValue();
            Class<?> serviceClass = serviceBean.getClass();
            
            // Handle CGLIB proxy classes
            if (serviceClass.getName().contains("$$")) {
                serviceClass = serviceClass.getSuperclass();
            }

            Method[] methods = serviceClass.getDeclaredMethods();
            for (Method method : methods) {
                if (Modifier.isPublic(method.getModifiers())) {
                    SystemAssetInventoryVO asset = new SystemAssetInventoryVO();
                    asset.setAssetId("FUNC-" + serviceClass.getSimpleName() + "-" + method.getName());
                    asset.setAssetType("FUNCTION");
                    asset.setAssetName(serviceClass.getSimpleName() + "." + method.getName());
                    asset.setSourcePath(serviceClass.getName());
                    asset.setSourceSymbol(method.getName());
                    asset.setOwnerDomain(inferDomain(serviceClass.getName()));
                    asset.setContentHash(generateHash(method));
                    asset.setActiveYn("Y");
                    asset.setCreatedAt(LocalDateTime.now());
                    asset.setUpdatedAt(LocalDateTime.now());
                    
                    assets.add(asset);
                }
            }
        }

        return assets;
    }

    @Override
    public List<SystemAssetCompositionVO> traceDependencies(List<SystemAssetInventoryVO> assets) {
        // Tracing dependencies between services (who injects whom) is easier.
        // But for now, we'll keep it simple to avoid long processing.
        return new ArrayList<>();
    }

    private String generateHash(Method method) {
        return Integer.toHexString(method.toString().hashCode());
    }

    private String inferDomain(String className) {
        if (className.contains(".admin.")) return "admin";
        if (className.contains(".platform.")) return "platform";
        if (className.contains(".auth.")) return "auth";
        return "shared";
    }
}
