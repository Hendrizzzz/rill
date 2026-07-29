package com.rill.typing.auth;

import com.rill.typing.common.ApiException;
import com.rill.typing.config.RillProperties;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
final class AuthenticationRateLimiter {

    private static final Duration AUTH_WINDOW = Duration.ofMinutes(1);
    private static final Duration REGISTRATION_WINDOW = Duration.ofHours(1);

    private final Clock clock;
    private final int maxAuthAttempts;
    private final int maxRegistrations;
    private Window authWindow;
    private Window registrationWindow;

    AuthenticationRateLimiter(Clock clock, RillProperties properties) {
        this.clock = clock;
        this.maxAuthAttempts = properties.maxAuthAttemptsPerMinute();
        this.maxRegistrations = properties.maxRegistrationsPerHour();
    }

    synchronized void checkLogin() {
        Instant now = clock.instant();
        authWindow = consume(authWindow, maxAuthAttempts, AUTH_WINDOW, now);
    }

    synchronized void checkRegistration() {
        Instant now = clock.instant();
        Window nextRegistration =
                consume(
                        registrationWindow,
                        maxRegistrations,
                        REGISTRATION_WINDOW,
                        now);
        Window nextAuthentication =
                consume(authWindow, maxAuthAttempts, AUTH_WINDOW, now);
        registrationWindow = nextRegistration;
        authWindow = nextAuthentication;
    }

    private static Window consume(
            Window current, int limit, Duration duration, Instant now) {
        if (current == null || !current.expiresAt().isAfter(now)) {
            return new Window(1, now.plus(duration));
        }
        if (current.count() >= limit) {
            throw rateLimited();
        }
        return new Window(current.count() + 1, current.expiresAt());
    }

    private static ApiException rateLimited() {
        return new ApiException(
                HttpStatus.TOO_MANY_REQUESTS,
                "RATE_LIMITED",
                "Too many attempts",
                "Please wait before trying again.");
    }

    private record Window(int count, Instant expiresAt) {}
}
