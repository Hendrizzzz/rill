package com.rill.typing.result;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

public final class ResultDtos {
    private ResultDtos() {}

    public record PaceBucket(
            @Min(1) @Max(1000) int durationMs,
            @Min(0) @Max(50_000) int typedCharacters) {}

    public record CreateResultRequest(
            @NotNull UUID clientResultId,
            @NotNull TestMode mode,
            int modeValue,
            boolean punctuation,
            boolean numbers,
            @Min(1) @Max(600_000) int durationMs,
            @Min(1) @Max(50_000) int typedCharacters,
            @Min(0) @Max(50_000) int correctAttempts,
            @Min(0) @Max(50_000) int incorrectAttempts,
            @Min(0) @Max(50_000) int correctCharacters,
            @Min(0) @Max(50_000) int missingCharacters,
            @Min(0) @Max(50_000) int extraAttempts,
            @Min(0) @Max(50_000) int correctedErrors,
            @NotNull @Size(min = 1, max = 600) List<@Valid PaceBucket> paceBuckets) {}

    public record TypingResultResponse(
            UUID clientResultId,
            TestMode mode,
            int modeValue,
            boolean punctuation,
            boolean numbers,
            int durationMs,
            int typedCharacters,
            int correctAttempts,
            int incorrectAttempts,
            int correctCharacters,
            int missingCharacters,
            int extraAttempts,
            int correctedErrors,
            BigDecimal wpm,
            BigDecimal rawWpm,
            BigDecimal accuracy,
            BigDecimal consistency,
            List<PaceBucket> paceBuckets,
            Instant completedAt,
            int oldestResultsPruned) {}

    public record ResultPage(List<TypingResultResponse> items, String nextCursor) {}

    public record RecordKey(TestMode mode, int modeValue, boolean punctuation, boolean numbers) {}

    public record PersonalRecord(RecordKey key, TypingResultResponse result) {}

    public record ResultSummary(
            long totalRuns,
            long totalPracticeMs,
            BigDecimal highestWpm,
            BigDecimal averageAccuracy,
            List<PersonalRecord> records) {}
}
