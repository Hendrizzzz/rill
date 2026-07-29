package com.rill.typing.config;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Duration;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.Test;
import org.springframework.boot.test.context.runner.ApplicationContextRunner;

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

    @Test
    void requiresAuthenticatedTlsForApplicationAndMigrationConnections() {
        String verified =
                "jdbc:postgresql://ep-example-pooler.neon.tech/neondb"
                        + "?sslmode=verify-full&channelBinding=require"
                        + "&sslfactory=org.postgresql.ssl.DefaultJavaSSLFactory";

        assertThatCode(
                        () ->
                                ProductionSafetyConfiguration.validateDatabaseTransport(
                                        verified, verified.replace("-pooler", "")))
                .doesNotThrowAnyException();

        assertThatThrownBy(
                        () ->
                                ProductionSafetyConfiguration.validateDatabaseTransport(
                                        verified.replace("verify-full", "require"), verified))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("application")
                .hasMessageContaining("verify-full");

        assertThatThrownBy(
                        () ->
                                ProductionSafetyConfiguration.validateDatabaseTransport(
                                        verified, verified.replace("&channelBinding=require", "")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("migration")
                .hasMessageContaining("channelBinding");

        assertThatThrownBy(
                        () ->
                                ProductionSafetyConfiguration.validateDatabaseTransport(
                                        verified.replace(
                                                "&sslfactory=org.postgresql.ssl.DefaultJavaSSLFactory",
                                                ""),
                                        verified))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("application")
                .hasMessageContaining("DefaultJavaSSLFactory");

        assertThatThrownBy(
                        () ->
                                ProductionSafetyConfiguration.validateDatabaseTransport(
                                        verified,
                                        verified.replace(
                                                "&sslfactory=org.postgresql.ssl.DefaultJavaSSLFactory",
                                                "")))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("migration")
                .hasMessageContaining("DefaultJavaSSLFactory");

        assertThatThrownBy(
                        () ->
                                ProductionSafetyConfiguration.validateDatabaseTransport(
                                        verified
                                                + "&sslfactory="
                                                + "org.postgresql.ssl.NonValidatingFactory",
                                        verified))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("application");

        assertThatThrownBy(
                        () ->
                                ProductionSafetyConfiguration.validateDatabaseTransport(
                                        verified + "&sslmode=disable", verified))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("application");

        assertThatThrownBy(
                        () ->
                                ProductionSafetyConfiguration.validateDatabaseTransport(
                                        verified + "&channelBinding=disable", verified))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("application");

        assertThatThrownBy(
                        () ->
                                ProductionSafetyConfiguration.validateDatabaseTransport(
                                        verified.replace(
                                                "DefaultJavaSSLFactory",
                                                "defaultjavasslfactory"),
                                        verified))
                .isInstanceOf(IllegalStateException.class)
                .hasMessageContaining("application");
    }

    @Test
    void rejectsUnverifiedDatabaseTransportBeforeOrdinaryBeansAreCreated() {
        AtomicBoolean ordinaryBeanCreated = new AtomicBoolean();
        String verified =
                "jdbc:postgresql://ep-example.neon.tech/neondb"
                        + "?sslmode=verify-full&channelBinding=require"
                        + "&sslfactory=org.postgresql.ssl.DefaultJavaSSLFactory";

        new ApplicationContextRunner()
                .withInitializer(
                        context -> context.getEnvironment().setActiveProfiles("prod"))
                .withPropertyValues(
                        "rill.deployment.require-verified-database-tls=true",
                        "spring.datasource.url="
                                + verified.replace("verify-full", "require"),
                        "spring.flyway.url=" + verified)
                .withUserConfiguration(ProductionSafetyConfiguration.class)
                .withBean(
                        RillProperties.class,
                        () ->
                                properties(
                                        new RillProperties.Cookie(
                                                "RILL_SESSION",
                                                true,
                                                Duration.ofDays(7),
                                                Duration.ofMinutes(15)),
                                        List.of()))
                .withBean(
                        "ordinaryBean",
                        Object.class,
                        () -> {
                            ordinaryBeanCreated.set(true);
                            return new Object();
                        })
                .run(
                        context -> {
                            assertThat(context.getStartupFailure())
                                    .isInstanceOf(IllegalStateException.class)
                                    .hasMessage(
                                            "Production application database connections require "
                                                    + "sslmode=verify-full, channelBinding=require, and "
                                                    + "sslfactory=org.postgresql.ssl.DefaultJavaSSLFactory");
                            assertThat(ordinaryBeanCreated).isFalse();
                        });
    }

    private static RillProperties properties(
            RillProperties.Cookie cookie, List<String> origins) {
        return new RillProperties(cookie, origins, 10_000, 10, 120, 240, 30, 60);
    }
}
