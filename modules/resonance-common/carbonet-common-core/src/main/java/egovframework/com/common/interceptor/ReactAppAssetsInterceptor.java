package egovframework.com.common.interceptor;

import egovframework.com.feature.home.web.ReactAppAssetResolver;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.web.servlet.HandlerInterceptor;
import org.springframework.web.servlet.ModelAndView;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

@Component
@RequiredArgsConstructor
public class ReactAppAssetsInterceptor implements HandlerInterceptor {

    private final ReactAppAssetResolver assetResolver;

    @Override
    public void postHandle(HttpServletRequest request, HttpServletResponse response, Object handler, ModelAndView modelAndView) throws Exception {
        if (modelAndView != null && !modelAndView.getViewName().startsWith("redirect:")) {
            ReactAppAssetResolver.ReactAppAssets assets = assetResolver.resolveAssets();
            modelAndView.addObject("reactAppProdJs", assets.getJsPath());
            modelAndView.addObject("reactAppProdCss", assets.getCssPath());
        }
    }
}
