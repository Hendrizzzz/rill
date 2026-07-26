package com.rill.typing.config;

import org.springframework.boot.ApplicationRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.context.annotation.Profile;

@Configuration(proxyBeanMethods = false)
@Profile("prod")
class ProductionSafetyConfiguration {

    @Bean
    ApplicationRunner productionSafety(RillProperties properties) {
        return arguments -> validate(properties);
    }

    static void validate(RillProperties properties) {
        if (!properties.cookie().secure()) {
            throw new IllegalStateException(
                    "Production requires Secure session and CSRF cookies");
        }
        if (!properties.allowedOrigins().isEmpty()) {
            throw new IllegalStateException(
                    "Production is same-origin; rill.allowed-origins must be empty");
        }
    }
}
