package com.typethock.typing.config;

import java.time.Duration;
import java.util.List;
import java.util.regex.Pattern;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.boot.context.properties.bind.DefaultValue;

@ConfigurationProperties("typethock")
public record TypeThockProperties(
        @DefaultValue Cookie cookie,
        @DefaultValue List<String> allowedOrigins,
        @DefaultValue("1000") int maxResultsPerAccount,
        @DefaultValue("10") int maxSessionsPerAccount,
        @DefaultValue("120") int maxResultsPerHour,
        @DefaultValue("240") int maxResultRequestsPerMinute,
        @DefaultValue("30") int maxAuthAttemptsPerMinute,
        @DefaultValue("60") int maxRegistrationsPerHour) {

    public TypeThockProperties {
        allowedOrigins = List.copyOf(allowedOrigins);
        if (maxResultsPerAccount < 1 || maxResultsPerAccount > 10_000) {
            throw new IllegalArgumentException(
                    "typethock.max-results-per-account must be between 1 and 10000");
        }
        if (maxSessionsPerAccount < 1 || maxSessionsPerAccount > 100) {
            throw new IllegalArgumentException(
                    "typethock.max-sessions-per-account must be between 1 and 100");
        }
        if (maxResultsPerHour < 1 || maxResultsPerHour > 10_000) {
            throw new IllegalArgumentException(
                    "typethock.max-results-per-hour must be between 1 and 10000");
        }
        if (maxResultRequestsPerMinute < 1 || maxResultRequestsPerMinute > 10_000) {
            throw new IllegalArgumentException(
                    "typethock.max-result-requests-per-minute must be between 1 and 10000");
        }
        if (maxAuthAttemptsPerMinute < 1 || maxAuthAttemptsPerMinute > 10_000) {
            throw new IllegalArgumentException(
                    "typethock.max-auth-attempts-per-minute must be between 1 and 10000");
        }
        if (maxRegistrationsPerHour < 1 || maxRegistrationsPerHour > 10_000) {
            throw new IllegalArgumentException(
                    "typethock.max-registrations-per-hour must be between 1 and 10000");
        }
        if (allowedOrigins.stream()
                .anyMatch(
                        origin ->
                                !(origin.startsWith("http://")
                                        || origin.startsWith("https://"))
                                        || origin.contains("*")
                                        || origin.endsWith("/"))) {
            throw new IllegalArgumentException(
                    "typethock.allowed-origins must contain exact HTTP(S) origins without wildcards or trailing slashes");
        }
    }

    public record Cookie(
            @DefaultValue("TYPETHOCK_SESSION") String name,
            @DefaultValue("false") boolean secure,
            @DefaultValue("7d") Duration maxAge,
            @DefaultValue("15m") Duration touchInterval) {

        private static final Pattern SAFE_NAME = Pattern.compile("[A-Za-z0-9_-]{1,64}");

        public Cookie {
            if (name == null || !SAFE_NAME.matcher(name).matches()) {
                throw new IllegalArgumentException("typethock.cookie.name is invalid");
            }
            if (maxAge == null
                    || maxAge.isNegative()
                    || maxAge.isZero()
                    || maxAge.compareTo(Duration.ofDays(30)) > 0) {
                throw new IllegalArgumentException(
                        "typethock.cookie.max-age must be greater than zero and at most 30 days");
            }
            if (touchInterval == null
                    || touchInterval.isNegative()
                    || touchInterval.isZero()
                    || touchInterval.compareTo(maxAge) >= 0) {
                throw new IllegalArgumentException(
                        "typethock.cookie.touch-interval must be greater than zero and shorter than max-age");
            }
        }
    }
}
