package com.typethock.typing.result;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
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
            @DecimalMin("0.01") @DecimalMax("1000") double durationMs,
            @Min(0) @Max(50_000) int typedCharacters,
            @Min(0) @Max(50_000) int correctCharacters,
            @Min(0) @Max(50_000) int rawCharacters,
            @Min(0) @Max(50_000) int errors) {}

    public record CreateResultRequest(
            @NotNull UUID clientResultId,
            @NotNull TestMode mode,
            int modeValue,
            boolean punctuation,
            boolean numbers,
            @NotNull ContentType contentType,
            @NotNull TypingLanguage language,
            CodeLanguage codeLanguage,
            String wordListVersion,
            @NotNull ErrorPolicy errorPolicy,
            @Min(1) @Max(600_000) int durationMs,
            @Min(1) @Max(50_000) int typedCharacters,
            @Min(0) @Max(50_000) int correctAttempts,
            @Min(0) @Max(50_000) int incorrectAttempts,
            @Min(0) @Max(50_000) int correctCharacters,
            @Min(0) @Max(50_000) int incorrectCharacters,
            @Min(0) @Max(50_000) int missingCharacters,
            @Min(0) @Max(50_000) int extraAttempts,
            @Min(0) @Max(50_000) int correctedErrors,
            CompletionReason completionReason,
            @NotNull @Size(max = 600) List<@Valid PaceBucket> paceBuckets) {}

    public record TypingResultResponse(
            UUID clientResultId,
            TestMode mode,
            int modeValue,
            boolean punctuation,
            boolean numbers,
            ContentType contentType,
            TypingLanguage language,
            CodeLanguage codeLanguage,
            String wordListVersion,
            ErrorPolicy errorPolicy,
            int durationMs,
            int typedCharacters,
            int correctAttempts,
            int incorrectAttempts,
            int correctCharacters,
            int incorrectCharacters,
            int missingCharacters,
            int extraAttempts,
            int correctedErrors,
            BigDecimal wpm,
            BigDecimal rawWpm,
            BigDecimal accuracy,
            BigDecimal consistency,
            CompletionReason completionReason,
            List<PaceBucket> paceBuckets,
            Instant completedAt,
            int oldestResultsPruned) {}

    public record ResultPage(List<TypingResultResponse> items, String nextCursor) {}

    public record RecordKey(
            TestMode mode,
            int modeValue,
            boolean punctuation,
            boolean numbers,
            ContentType contentType,
            TypingLanguage language,
            CodeLanguage codeLanguage,
            String wordListVersion,
            ErrorPolicy errorPolicy) {}

    public record PersonalRecord(RecordKey key, TypingResultResponse result) {}

    public record ResultSummary(
            long totalRuns,
            long totalPracticeMs,
            BigDecimal highestWpm,
            BigDecimal averageAccuracy,
            List<PersonalRecord> records) {}
}
