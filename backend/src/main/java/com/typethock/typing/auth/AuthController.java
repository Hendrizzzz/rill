package com.typethock.typing.auth;

import com.typethock.typing.auth.AuthDtos.CredentialsRequest;
import com.typethock.typing.auth.AuthDtos.SessionResponse;
import com.typethock.typing.auth.AuthDtos.UserResponse;
import com.typethock.typing.config.TypeThockProperties;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import jakarta.validation.Valid;
import java.util.Arrays;
import java.util.Optional;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/auth")
public class AuthController {

    private final AuthService authService;
    private final SessionService sessionService;
    private final TypeThockProperties properties;

    AuthController(
            AuthService authService, SessionService sessionService, TypeThockProperties properties) {
        this.authService = authService;
        this.sessionService = sessionService;
        this.properties = properties;
    }

    @GetMapping("/session")
    SessionResponse session(Authentication authentication, CsrfToken csrfToken) {
        TypeThockPrincipal principal = TypeThockPrincipalResolver.find(authentication);
        return principal == null
                ? SessionResponse.guest(csrfToken.getToken())
                : new SessionResponse(true, UserResponse.from(principal), csrfToken.getToken());
    }

    @PostMapping("/register")
    ResponseEntity<SessionResponse> register(
            @Valid @RequestBody CredentialsRequest request,
            CsrfToken csrfToken,
            HttpServletResponse response) {
        UserAccount user = authService.register(request.username(), request.password());
        SessionService.IssuedSession issued = sessionService.create(user);
        setSessionCookie(response, issued.token(), properties.cookie().maxAge().toSeconds());
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(
                        new SessionResponse(
                                true, UserResponse.from(user), csrfToken.getToken()));
    }

    @PostMapping("/login")
    SessionResponse login(
            @Valid @RequestBody CredentialsRequest request,
            CsrfToken csrfToken,
            HttpServletResponse response) {
        UserAccount user = authService.login(request.username(), request.password());
        SessionService.IssuedSession issued = sessionService.create(user);
        setSessionCookie(response, issued.token(), properties.cookie().maxAge().toSeconds());
        return new SessionResponse(true, UserResponse.from(user), csrfToken.getToken());
    }

    @PostMapping("/logout")
    ResponseEntity<Void> logout(
            Authentication authentication,
            HttpServletRequest request,
            HttpServletResponse response) {
        TypeThockPrincipalResolver.require(authentication);
        cookieValue(request).ifPresent(sessionService::revoke);
        clearCookies(response);
        return ResponseEntity.noContent().build();
    }

    void clearCookies(HttpServletResponse response) {
        setSessionCookie(response, "", 0);
        ResponseCookie csrf =
                ResponseCookie.from("XSRF-TOKEN", "")
                        .httpOnly(false)
                        .secure(properties.cookie().secure())
                        .sameSite("Lax")
                        .path("/")
                        .maxAge(0)
                        .build();
        response.addHeader(HttpHeaders.SET_COOKIE, csrf.toString());
    }

    Optional<String> cookieValue(HttpServletRequest request) {
        return Optional.ofNullable(request.getCookies()).stream()
                .flatMap(Arrays::stream)
                .filter(cookie -> properties.cookie().name().equals(cookie.getName()))
                .map(Cookie::getValue)
                .findFirst();
    }

    private void setSessionCookie(HttpServletResponse response, String value, long maxAgeSeconds) {
        ResponseCookie cookie =
                ResponseCookie.from(properties.cookie().name(), value)
                        .httpOnly(true)
                        .secure(properties.cookie().secure())
                        .sameSite("Lax")
                        .path("/")
                        .maxAge(maxAgeSeconds)
                        .build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }

}
