package com.typethock.typing.auth;

import com.typethock.typing.config.TypeThockProperties;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.util.Arrays;
import java.util.Optional;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

@Component
public class SessionAuthenticationFilter extends OncePerRequestFilter {

    private final SessionService sessionService;
    private final TypeThockProperties properties;

    SessionAuthenticationFilter(SessionService sessionService, TypeThockProperties properties) {
        this.sessionService = sessionService;
        this.properties = properties;
    }

    @Override
    protected void doFilterInternal(
            HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        Optional<String> token =
                Optional.ofNullable(request.getCookies()).stream()
                        .flatMap(Arrays::stream)
                        .filter(cookie -> properties.cookie().name().equals(cookie.getName()))
                        .map(Cookie::getValue)
                        .findFirst();
        token.flatMap(sessionService::authenticate)
                .ifPresent(
                        principal ->
                                SecurityContextHolder.getContext()
                                        .setAuthentication(
                                                UsernamePasswordAuthenticationToken.authenticated(
                                                        principal, null, java.util.List.of())));
        chain.doFilter(request, response);
    }
}
