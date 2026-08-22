package com.typethock.typing.auth;

import com.typethock.typing.common.ApiException;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
final class AccountExportRateLimiter {

    private static final int MAX_ATTEMPTS = 3;
    private static final int MAX_KEYS = 50_000;
    private static final Duration WINDOW = Duration.ofMinutes(15);
    private final Map<UUID, Window> attempts = new ConcurrentHashMap<>();
    private final Clock clock;

    AccountExportRateLimiter(Clock clock) {
        this.clock = clock;
    }

    void check(UUID userId) {
        Instant now = clock.instant();
        if (attempts.size() >= MAX_KEYS && !attempts.containsKey(userId)) {
            throw rateLimited();
        }
        Window next =
                attempts.compute(
                        userId,
                        (key, current) -> {
                            if (current == null || !current.expiresAt().isAfter(now)) {
                                return new Window(1, now.plus(WINDOW));
                            }
                            return new Window(current.count() + 1, current.expiresAt());
                        });
        if (next.count() > MAX_ATTEMPTS) {
            throw rateLimited();
        }
    }

    @Scheduled(fixedDelayString = "PT15M")
    void deleteExpired() {
        Instant now = clock.instant();
        attempts.entrySet().removeIf(entry -> !entry.getValue().expiresAt().isAfter(now));
    }

    private static ApiException rateLimited() {
        return new ApiException(
                HttpStatus.TOO_MANY_REQUESTS,
                "RATE_LIMITED",
                "Too many exports",
                "Please wait before exporting this account again.");
    }

    private record Window(int count, Instant expiresAt) {}
}
