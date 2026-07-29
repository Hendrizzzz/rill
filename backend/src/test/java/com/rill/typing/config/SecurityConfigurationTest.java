package com.rill.typing.config;

import static org.assertj.core.api.Assertions.assertThat;

import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;

class SecurityConfigurationTest {

    @Test
    void configuredCorsUsesOnlyExactAllowedOrigins() {
        RillProperties properties =
                new RillProperties(
                        new RillProperties.Cookie(
                                "RILL_SESSION",
                                false,
                                Duration.ofDays(7),
                                Duration.ofMinutes(15)),
                        List.of("http://127.0.0.1:5173"),
                        10_000,
                        10,
                        120,
                        240,
                        30,
                        60);
        CorsConfigurationSource source =
                new SecurityConfiguration().corsConfigurationSource(properties);
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRequestURI("/api/auth/register");
        CorsConfiguration configuration = source.getCorsConfiguration(request);

        assertThat(configuration).isNotNull();
        assertThat(configuration.checkOrigin("http://127.0.0.1:5173"))
                .isEqualTo("http://127.0.0.1:5173");
        assertThat(configuration.checkOrigin("https://attacker.example")).isNull();
        assertThat(configuration.getAllowCredentials()).isTrue();
    }
}
