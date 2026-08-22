package com.typethock.typing.auth;

import com.typethock.typing.common.ApiException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;

@Component
final class LoginRateLimiter {

    private static final int MAX_ATTEMPTS = 10;
    private static final Duration WINDOW = Duration.ofMinutes(15);
    private static final int MAX_KEYS = 10_000;
    private final Map<String, Window> attempts = new ConcurrentHashMap<>();
    private final Clock clock;

    LoginRateLimiter(Clock clock) {
        this.clock = clock;
    }

    void check(String normalizedUsername) {
        Instant now = clock.instant();
        if (attempts.size() >= MAX_KEYS) {
            attempts.entrySet().removeIf(entry -> entry.getValue().expiresAt().isBefore(now));
            if (attempts.size() >= MAX_KEYS && !attempts.containsKey(normalizedUsername)) {
                throw new ApiException(
                        HttpStatus.TOO_MANY_REQUESTS,
                        "RATE_LIMITED",
                        "Too many attempts",
                        "Please wait before trying again.");
            }
        }
        Window next =
                attempts.compute(
                        normalizedUsername,
                        (key, current) -> {
                            if (current == null || !current.expiresAt().isAfter(now)) {
                                return new Window(1, now.plus(WINDOW));
                            }
                            return new Window(current.count() + 1, current.expiresAt());
                        });
        if (next.count() > MAX_ATTEMPTS) {
            throw new ApiException(
                    HttpStatus.TOO_MANY_REQUESTS,
                    "RATE_LIMITED",
                    "Too many attempts",
                    "Please wait before trying again.");
        }
    }

    void clear(String normalizedUsername) {
        attempts.remove(normalizedUsername);
    }

    private record Window(int count, Instant expiresAt) {}
}
