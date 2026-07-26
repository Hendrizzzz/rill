package com.rill.typing.result;

import com.rill.typing.common.ApiException;
import com.rill.typing.config.RillProperties;
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
final class ResultRequestRateLimiter {

    private static final int MAX_KEYS = 50_000;
    private static final Duration WINDOW = Duration.ofMinutes(1);
    private final Map<UUID, Window> windows = new ConcurrentHashMap<>();
    private final Clock clock;
    private final int limit;

    ResultRequestRateLimiter(Clock clock, RillProperties properties) {
        this.clock = clock;
        this.limit = properties.maxResultRequestsPerMinute();
    }

    void check(UUID userId) {
        Instant now = clock.instant();
        if (windows.size() >= MAX_KEYS && !windows.containsKey(userId)) {
            throw rateLimited();
        }
        Window next =
                windows.compute(
                        userId,
                        (key, current) -> {
                            if (current == null || !current.expiresAt().isAfter(now)) {
                                return new Window(1, now.plus(WINDOW));
                            }
                            return new Window(current.count() + 1, current.expiresAt());
                        });
        if (next.count() > limit) {
            throw rateLimited();
        }
    }

    @Scheduled(fixedDelayString = "PT1M")
    void deleteExpired() {
        Instant now = clock.instant();
        windows.entrySet().removeIf(entry -> !entry.getValue().expiresAt().isAfter(now));
    }

    private static ApiException rateLimited() {
        return new ApiException(
                HttpStatus.TOO_MANY_REQUESTS,
                "RATE_LIMITED",
                "Too many result requests",
                "Please wait before sending another result.");
    }

    private record Window(int count, Instant expiresAt) {}
}
