package com.typethock.typing.result;

import com.typethock.typing.common.ApiException;
import com.typethock.typing.config.TypeThockProperties;
import java.time.Clock;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.http.HttpStatus;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

@Component
final class ResultRateLimiter {

    private static final int MAX_KEYS = 50_000;
    private final Map<UUID, Window> windows = new ConcurrentHashMap<>();
    private final Clock clock;
    private final int limit;

    ResultRateLimiter(Clock clock, TypeThockProperties properties) {
        this.clock = clock;
        this.limit = properties.maxResultsPerHour();
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
                                return new Window(1, now.plus(1, ChronoUnit.HOURS));
                            }
                            return new Window(current.count() + 1, current.expiresAt());
                        });
        if (next.count() > limit) {
            throw rateLimited();
        }
    }

    @Scheduled(fixedDelayString = "PT1H")
    void deleteExpired() {
        Instant now = clock.instant();
        windows.entrySet().removeIf(entry -> !entry.getValue().expiresAt().isAfter(now));
    }

    private static ApiException rateLimited() {
        return new ApiException(
                HttpStatus.TOO_MANY_REQUESTS,
                "RATE_LIMITED",
                "Too many results",
                "Please wait before saving another result.");
    }

    private record Window(int count, Instant expiresAt) {}
}
