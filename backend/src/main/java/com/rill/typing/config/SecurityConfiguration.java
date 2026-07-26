package com.rill.typing.config;

import com.rill.typing.auth.SessionAuthenticationFilter;
import com.rill.typing.common.ApiErrorHandler;
import jakarta.servlet.http.HttpServletResponse;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.boot.web.servlet.FilterRegistrationBean;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.security.config.Customizer;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.DelegatingPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.session.NullAuthenticatedSessionStrategy;
import org.springframework.security.web.csrf.CookieCsrfTokenRepository;
import org.springframework.security.web.csrf.CsrfFilter;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;
import tools.jackson.databind.json.JsonMapper;

@Configuration
public class SecurityConfiguration {

    @Bean
    PasswordEncoder passwordEncoder() {
        Map<String, PasswordEncoder> encoders = new LinkedHashMap<>();
        encoders.put("bcrypt", new BCryptPasswordEncoder(12));
        DelegatingPasswordEncoder encoder = new DelegatingPasswordEncoder("bcrypt", encoders);
        encoder.setDefaultPasswordEncoderForMatches(new BCryptPasswordEncoder(12));
        return encoder;
    }

    @Bean
    SecurityFilterChain securityFilterChain(
            HttpSecurity http,
            SessionAuthenticationFilter sessionFilter,
            RillProperties properties,
            JsonMapper objectMapper)
            throws Exception {
        CookieCsrfTokenRepository csrf = CookieCsrfTokenRepository.withHttpOnlyFalse();
        csrf.setCookieCustomizer(
                cookie ->
                        cookie.path("/")
                                .sameSite("Lax")
                                .secure(properties.cookie().secure()));

        if (!properties.allowedOrigins().isEmpty()) {
            http.cors(Customizer.withDefaults());
        }

        http.sessionManagement(
                        session ->
                                session.sessionCreationPolicy(SessionCreationPolicy.STATELESS)
                                        .sessionAuthenticationStrategy(
                                                new NullAuthenticatedSessionStrategy()))
                .csrf(
                        configurer ->
                                configurer
                                        .csrfTokenRepository(csrf)
                                        .sessionAuthenticationStrategy(
                                                new NullAuthenticatedSessionStrategy()))
                .requestCache(cache -> cache.disable())
                .formLogin(form -> form.disable())
                .httpBasic(basic -> basic.disable())
                .logout(logout -> logout.disable())
                .addFilterBefore(sessionFilter, CsrfFilter.class)
                .authorizeHttpRequests(
                        authorize ->
                                authorize
                                        .requestMatchers(HttpMethod.GET, "/api/auth/session")
                                        .permitAll()
                                        .requestMatchers(
                                                HttpMethod.POST,
                                                "/api/auth/register",
                                                "/api/auth/login")
                                        .permitAll()
                                        .requestMatchers("/actuator/health/**")
                                        .permitAll()
                                        .requestMatchers("/api/**")
                                        .authenticated()
                                        .anyRequest()
                                        .denyAll())
                .exceptionHandling(
                        exceptions ->
                                exceptions
                                        .authenticationEntryPoint(
                                                (request, response, exception) ->
                                                        writeSecurityError(
                                                                objectMapper,
                                                                response,
                                                                HttpStatus.UNAUTHORIZED,
                                                                "AUTHENTICATION_REQUIRED",
                                                                "Authentication required",
                                                                "Sign in to continue.",
                                                                request.getRequestURI()))
                                        .accessDeniedHandler(
                                                (request, response, exception) -> {
                                                    boolean csrfFailure =
                                                            exception.getClass()
                                                                    .getSimpleName()
                                                                    .contains("Csrf");
                                                    writeSecurityError(
                                                            objectMapper,
                                                            response,
                                                            HttpStatus.FORBIDDEN,
                                                            csrfFailure
                                                                    ? "CSRF_REJECTED"
                                                                    : "ACCESS_DENIED",
                                                            csrfFailure
                                                                    ? "Request verification failed"
                                                                    : "Access denied",
                                                            csrfFailure
                                                                    ? "Refresh the page and try again."
                                                                    : "You cannot perform this action.",
                                                            request.getRequestURI());
                                                }))
                .headers(
                        headers ->
                                headers
                                        .contentTypeOptions(Customizer.withDefaults())
                                        .frameOptions(frame -> frame.deny())
                                        .referrerPolicy(
                                                referrer ->
                                                        referrer.policy(
                                                                org.springframework.security.web
                                                                        .header.writers
                                                                        .ReferrerPolicyHeaderWriter
                                                                        .ReferrerPolicy
                                                                        .NO_REFERRER)));
        return http.build();
    }

    @Bean
    FilterRegistrationBean<SessionAuthenticationFilter> disableContainerRegistration(
            SessionAuthenticationFilter filter) {
        FilterRegistrationBean<SessionAuthenticationFilter> registration =
                new FilterRegistrationBean<>(filter);
        registration.setEnabled(false);
        return registration;
    }

    @Bean
    CorsConfigurationSource corsConfigurationSource(RillProperties properties) {
        CorsConfiguration configuration = new CorsConfiguration();
        configuration.setAllowedOrigins(properties.allowedOrigins());
        configuration.setAllowedMethods(List.of("GET", "POST", "DELETE", "OPTIONS"));
        configuration.setAllowedHeaders(List.of("Content-Type", "X-XSRF-TOKEN", "X-Request-Id"));
        configuration.setExposedHeaders(List.of("X-Request-Id"));
        configuration.setAllowCredentials(true);
        configuration.setMaxAge(3600L);
        UrlBasedCorsConfigurationSource source = new UrlBasedCorsConfigurationSource();
        source.registerCorsConfiguration("/api/**", configuration);
        return source;
    }

    private static void writeSecurityError(
            JsonMapper mapper,
            HttpServletResponse response,
            HttpStatus status,
            String code,
            String title,
            String detail,
            String instance)
            throws java.io.IOException {
        response.setStatus(status.value());
        response.setHeader(HttpHeaders.CACHE_CONTROL, "no-store");
        response.setContentType(MediaType.APPLICATION_PROBLEM_JSON_VALUE);
        mapper.writeValue(
                response.getOutputStream(),
                ApiErrorHandler.body(status, code, title, detail, instance, null));
    }
}
