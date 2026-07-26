package com.rill.typing.config;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.Test;

class ProductionSafetyConfigurationTest {

    @Test
    void acceptsSecureSameOriginProductionConfiguration() {
        RillProperties properties =
                properties(new RillProperties.Cookie("RILL_SESSION", true, Duration.ofDays(7), Duration.ofMinutes(15)), List.of());

        assertThatCode(() -> ProductionSafetyConfiguration.validate(properties))
                .doesNotThrowAnyException();
    }

    @Test
    void rejectsInsecureCookiesAndCorsOrigins() {
        RillProperties.Cookie insecure =
                new RillProperties.Cookie(
                        "RILL_SESSION", false, Duration.ofDays(7), Duration.ofMinutes(15));
        assertThatThrownBy(
                        () ->
                                ProductionSafetyConfiguration.validate(
                                        properties(insecure, List.of())))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("Secure");

        RillProperties.Cookie secure =
                new RillProperties.Cookie(
                        "RILL_SESSION", true, Duration.ofDays(7), Duration.ofMinutes(15));
        assertThatThrownBy(
                        () ->
                                ProductionSafetyConfiguration.validate(
                                        properties(
                                                secure,
                                                List.of("https://unexpected.example"))))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("same-origin");
    }

    private static RillProperties properties(
            RillProperties.Cookie cookie, List<String> origins) {
        return new RillProperties(cookie, origins, 10_000, 10, 120, 240);
    }
}
