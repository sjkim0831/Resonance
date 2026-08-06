package egovframework.com.feature.home.web;

import egovframework.com.feature.auth.service.CurrentUserContextService;
import egovframework.com.feature.home.service.HomeMenuService;
import egovframework.com.feature.home.service.HomeMypageService;
import egovframework.com.platform.bootstrap.service.AdminShellBootstrapPageService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class HomePageControllerAuthenticationTest {

    @Test
    void homeHeaderUsesResolvedSessionWhenJwtCookieIsAbsent() {
        Fixture fixture = fixture(true, null);

        assertEquals(Boolean.TRUE, fixture.controller.homeApi(fixture.request).getBody().get("isLoggedIn"));
    }

    @Test
    void homeHeaderDoesNotTrustAnOrphanedJwtCookie() {
        Fixture fixture = fixture(false, new Cookie("accessToken", "stale-token"));

        assertEquals(Boolean.FALSE, fixture.controller.homeApi(fixture.request).getBody().get("isLoggedIn"));
    }

    private Fixture fixture(boolean authenticated, Cookie cookie) {
        AdminShellBootstrapPageService bootstrap = mock(AdminShellBootstrapPageService.class);
        HomeMenuService menus = mock(HomeMenuService.class);
        HomeMypageService mypage = mock(HomeMypageService.class);
        ReactAppViewSupport react = mock(ReactAppViewSupport.class);
        CurrentUserContextService users = mock(CurrentUserContextService.class);
        HttpServletRequest request = mock(HttpServletRequest.class);
        CurrentUserContextService.CurrentUserContext context = new CurrentUserContextService.CurrentUserContext();
        context.setAuthenticated(authenticated);
        when(request.getRequestURI()).thenReturn("/api/home");
        when(request.getCookies()).thenReturn(cookie == null ? null : new Cookie[]{cookie});
        when(users.resolve(request)).thenReturn(context);
        when(menus.getHomeMenu(false)).thenReturn(List.of());
        return new Fixture(new HomePageController(bootstrap, menus, mypage, react, users), request);
    }

    private record Fixture(HomePageController controller, HttpServletRequest request) { }
}
