package com.rill.typing.result;

import com.rill.typing.auth.AuthService;
import com.rill.typing.auth.RillPrincipal;
import com.rill.typing.auth.UserAccount;
import com.rill.typing.common.ApiException;
import com.rill.typing.config.RillProperties;
import com.rill.typing.result.ResultDtos.CreateResultRequest;
import com.rill.typing.result.ResultDtos.PaceBucket;
import com.rill.typing.result.ResultDtos.PersonalRecord;
import com.rill.typing.result.ResultDtos.RecordKey;
import com.rill.typing.result.ResultDtos.ResultPage;
import com.rill.typing.result.ResultDtos.ResultSummary;
import com.rill.typing.result.ResultDtos.TypingResultResponse;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.util.Base64;
import java.util.List;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.json.JsonMapper;

@Service
public class TypingResultService {

    private final TypingResultRepository results;
    private final AuthService authService;
    private final ResultRateLimiter rateLimiter;
    private final ResultRequestRateLimiter requestRateLimiter;
    private final RillProperties properties;
    private final JsonMapper json;
    private final Clock clock;

    TypingResultService(
            TypingResultRepository results,
            AuthService authService,
            ResultRateLimiter rateLimiter,
            ResultRequestRateLimiter requestRateLimiter,
            RillProperties properties,
            JsonMapper json,
            Clock clock) {
        this.results = results;
        this.authService = authService;
        this.rateLimiter = rateLimiter;
        this.requestRateLimiter = requestRateLimiter;
        this.properties = properties;
        this.json = json;
        this.clock = clock;
    }

    @Transactional
    public CreateOutcome create(RillPrincipal principal, CreateResultRequest request) {
        requestRateLimiter.check(principal.id());
        validate(request);
        String paceJson = json.writeValueAsString(request.paceBuckets());
        UserAccount user = authService.requireUserForUpdate(principal);
        var existing =
                results.findByUserIdAndClientResultId(principal.id(), request.clientResultId());
        if (existing.isPresent()) {
            if (!sameRawInput(existing.get(), request, paceJson)) {
                throw new ApiException(
                        HttpStatus.CONFLICT,
                        "RESULT_IDEMPOTENCY_CONFLICT",
                        "Result identifier conflict",
                        "This result identifier was already used for different data.");
            }
            return new CreateOutcome(toResponse(existing.get(), 0), false);
        }

        rateLimiter.check(principal.id());
        Metrics metrics = deriveMetrics(request);
        TypingResultEntity entity =
                new TypingResultEntity(
                        user,
                        request.clientResultId(),
                        request.mode(),
                        request.modeValue(),
                        request.punctuation(),
                        request.numbers(),
                        request.contentType(),
                        request.language(),
                        request.codeLanguage(),
                        normalizedWordListVersion(request),
                        request.errorPolicy(),
                        request.durationMs(),
                        request.typedCharacters(),
                        request.correctAttempts(),
                        request.incorrectAttempts(),
                        request.correctCharacters(),
                        request.incorrectCharacters(),
                        request.missingCharacters(),
                        request.extraAttempts(),
                        request.correctedErrors(),
                        normalizedCompletionReason(request),
                        metrics.wpm(),
                        metrics.rawWpm(),
                        metrics.accuracy(),
                        metrics.consistency(),
                        paceJson,
                        clock.instant());
        results.saveAndFlush(entity);

        int pruned = pruneOldest(principal.id());
        return new CreateOutcome(toResponse(entity, pruned), true);
    }

    @Transactional(readOnly = true)
    public ResultPage page(RillPrincipal principal, int limit, String cursorText) {
        if (limit < 1 || limit > 50) {
            throw invalid("limit must be between 1 and 50");
        }
        PageRequest page = PageRequest.of(0, limit + 1);
        List<TypingResultEntity> found;
        if (cursorText == null || cursorText.isBlank()) {
            found = results.findAllByUserIdOrderByCompletedAtDescIdDesc(principal.id(), page);
        } else {
            Cursor cursor = decodeCursor(cursorText);
            found =
                    results.findPageAfter(
                            principal.id(), cursor.completedAt(), cursor.id(), page);
        }
        boolean hasMore = found.size() > limit;
        List<TypingResultEntity> visible =
                hasMore ? found.subList(0, limit) : found;
        String next =
                hasMore && !visible.isEmpty()
                        ? encodeCursor(visible.getLast())
                        : null;
        return new ResultPage(
                visible.stream().map(value -> toResponse(value, 0)).toList(), next);
    }

    @Transactional(readOnly = true)
    public ResultSummary summary(RillPrincipal principal) {
        long totalRuns = results.countByUserId(principal.id());
        long practiceMs = results.totalPracticeMsByUserId(principal.id());
        BigDecimal highest =
                results.highestWpmByUserId(principal.id())
                        .orElse(BigDecimal.ZERO.setScale(2));
        BigDecimal average =
                results.averageAccuracyByUserId(principal.id())
                        .map(value -> BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP))
                        .orElse(BigDecimal.ZERO.setScale(2));
        List<PersonalRecord> recordsList =
                results.findPersonalRecordsByUserId(principal.id()).stream()
                        .map(
                                result ->
                                        new PersonalRecord(
                                                new RecordKey(
                                                        result.getMode(),
                                                        result.getModeValue(),
                                                        result.isPunctuation(),
                                                        result.isNumbers(),
                                                        result.getContentType(),
                                                        result.getLanguage(),
                                                        result.getCodeLanguage(),
                                                        result.getWordListVersion(),
                                                        result.getErrorPolicy()),
                                                toResponse(result, 0)))
                        .toList();
        return new ResultSummary(totalRuns, practiceMs, highest, average, recordsList);
    }

    @Transactional(readOnly = true)
    public List<TypingResultResponse> export(RillPrincipal principal) {
        return results.findAllByUserIdOrderByCompletedAtDescIdDesc(principal.id()).stream()
                .map(value -> toResponse(value, 0))
                .toList();
    }

    private int pruneOldest(UUID userId) {
        long overflow = results.countByUserId(userId) - properties.maxResultsPerAccount();
        if (overflow <= 0) {
            return 0;
        }
        int count = Math.toIntExact(Math.min(overflow, Integer.MAX_VALUE));
        List<TypingResultEntity> oldest =
                results.findAllByUserIdOrderByCompletedAtAscIdAsc(
                        userId, PageRequest.of(0, count));
        results.deleteAllInBatch(oldest);
        return oldest.size();
    }

    private void validate(CreateResultRequest request) {
        boolean codeLanguageValid =
                request.contentType() == ContentType.CODE
                        ? request.codeLanguage() != null
                                && request.language() == TypingLanguage.EN
                        : request.codeLanguage() == null;
        boolean wordListVersionValid =
                request.wordListVersion() == null
                        || request.wordListVersion().equals(
                                wordListVersion(
                                        request.contentType(), request.language()))
                        || (request.contentType() == ContentType.CODE
                                && request.wordListVersion().equals("code-v1"));
        boolean modeValid;
        if (request.contentType() == ContentType.WORDS) {
            modeValid =
                    request.mode() == TestMode.TIME
                            ? request.modeValue() == 15
                                    || request.modeValue() == 30
                                    || request.modeValue() == 60
                            : request.modeValue() == 10
                                    || request.modeValue() == 25
                                    || request.modeValue() == 50;
        } else {
            modeValid =
                    request.mode() == TestMode.WORDS
                            && request.modeValue() >= 2
                            && request.modeValue() <= 300
                            && !request.punctuation()
                            && !request.numbers()
                            && (request.contentType() != ContentType.QUOTE
                                    || request.language() == TypingLanguage.EN)
                            && codeLanguageValid;
        }
        if (!modeValid || !codeLanguageValid || !wordListVersionValid) {
            throw invalid("test dimensions are not supported");
        }
        if (request.mode() == TestMode.TIME
                && request.durationMs() != request.modeValue() * 1000) {
            throw invalid("time mode duration must equal the selected duration");
        }
        if (request.mode() == TestMode.WORDS
                && (request.durationMs() < 1_000
                        || request.durationMs() > 600_000
                        || request.durationMs() % 10 != 0)) {
            throw invalid(
                    "word mode duration must be between 1000 and 600000 milliseconds on a 10 millisecond grid");
        }
        CompletionReason completionReason = normalizedCompletionReason(request);
        if ((request.mode() == TestMode.TIME
                        && completionReason != CompletionReason.TIME
                        && completionReason != CompletionReason.PROMPT_EXHAUSTED)
                || (request.mode() == TestMode.WORDS
                        && completionReason == CompletionReason.TIME)
                || (completionReason == CompletionReason.LIMIT
                        && (request.mode() != TestMode.WORDS
                                || request.durationMs() != 600_000))) {
            throw invalid("completionReason is not valid for this result");
        }
        int attempts = request.correctAttempts() + request.incorrectAttempts();
        if (request.typedCharacters() > attempts
                || request.correctCharacters() > request.typedCharacters()
                || request.incorrectCharacters() > request.typedCharacters()
                || request.extraAttempts() > request.typedCharacters()
                || request.correctCharacters()
                                + request.incorrectCharacters()
                                + request.extraAttempts()
                        > request.typedCharacters()
                || request.correctedErrors() > request.incorrectAttempts()) {
            throw invalid("character counters are inconsistent");
        }
        double totalDuration = 0;
        int totalInsertions = 0;
        int totalErrors = 0;
        for (int index = 0; index < request.paceBuckets().size(); index++) {
            PaceBucket bucket = request.paceBuckets().get(index);
            boolean isFinal = index == request.paceBuckets().size() - 1;
            int insertionsThroughBucket =
                    Math.addExact(totalInsertions, bucket.typedCharacters());
            if (!hasHundredthPrecision(bucket.durationMs())
                    || (!isFinal && Double.compare(bucket.durationMs(), 1000d) != 0)) {
                throw invalid(
                        "pace bucket duration must have hundredth-millisecond precision and all non-final buckets must be 1000 milliseconds");
            }
            if (bucket.errors() > bucket.typedCharacters()
                    || bucket.correctCharacters() > bucket.rawCharacters()
                    || bucket.rawCharacters() > insertionsThroughBucket) {
                throw invalid("pace bucket counters are inconsistent");
            }
            totalDuration += bucket.durationMs();
            totalInsertions = insertionsThroughBucket;
            totalErrors = Math.addExact(totalErrors, bucket.errors());
        }
        int completeSeconds = request.durationMs() / 1000;
        int remainder = request.durationMs() - completeSeconds * 1000;
        double completeSecondDuration = completeSeconds * 1000d;
        boolean chartDurationValid;
        if (request.mode() == TestMode.TIME) {
            chartDurationValid = approximatelyEqual(totalDuration, request.durationMs(), 0.005);
        } else if (remainder >= 500) {
            chartDurationValid =
                    isCanonicalRawDuration(totalDuration, request.durationMs());
        } else if (remainder == 0) {
            chartDurationValid =
                    approximatelyEqual(totalDuration, request.durationMs(), 0.005)
                            || (request.durationMs() >= 1000
                                    && approximatelyEqual(
                                            totalDuration,
                                            request.durationMs() - 1000d,
                                            0.005));
        } else {
            chartDurationValid =
                    approximatelyEqual(totalDuration, completeSecondDuration, 0.005);
        }
        boolean chartCoversCompletion =
                !request.paceBuckets().isEmpty()
                        && isCanonicalRawDuration(totalDuration, request.durationMs());
        if (!chartDurationValid
                || totalInsertions > attempts
                || totalErrors > request.incorrectAttempts()
                || (chartCoversCompletion
                        && (totalInsertions != attempts
                                || totalErrors != request.incorrectAttempts()
                                || request.paceBuckets().getLast().correctCharacters()
                                        != request.correctCharacters()
                                || request.paceBuckets().getLast().rawCharacters()
                                        != request.typedCharacters()))) {
            throw invalid("pace bucket totals do not match the result");
        }
        Metrics metrics = deriveMetrics(request);
        BigDecimal persistedMaximum = new BigDecimal("999999.99");
        if (metrics.wpm().compareTo(persistedMaximum) > 0
                || metrics.rawWpm().compareTo(persistedMaximum) > 0) {
            throw invalid("derived speed exceeds the supported range");
        }
    }

    private Metrics deriveMetrics(CreateResultRequest request) {
        double duration = request.durationMs();
        BigDecimal wpm = rounded(calculateWpm(request.correctCharacters(), duration));
        BigDecimal rawWpm = rounded(calculateWpm(request.typedCharacters(), duration));
        int denominator = request.correctAttempts() + request.incorrectAttempts();
        BigDecimal accuracy =
                denominator == 0
                        ? rounded(100)
                        : rounded((request.correctAttempts() / (double) denominator) * 100d);

        BigDecimal consistency = deriveConsistency(request.paceBuckets());
        return new Metrics(wpm, rawWpm, accuracy, consistency);
    }

    private static BigDecimal deriveConsistency(List<PaceBucket> buckets) {
        double[] pace = new double[buckets.size()];
        double sum = 0;
        for (int index = 0; index < buckets.size(); index++) {
            PaceBucket bucket = buckets.get(index);
            pace[index] =
                    Math.round(calculateWpm(bucket.typedCharacters(), bucket.durationMs()));
            sum += pace[index];
        }
        double mean = pace.length == 0 ? 0 : sum / pace.length;
        double consistency = 0;
        if (mean != 0) {
            double sumSquares = 0;
            for (double value : pace) {
                sumSquares += Math.pow(value - mean, 2);
            }
            double variance = sumSquares / pace.length;
            double cov = Math.sqrt(variance) / mean;
            consistency =
                    100
                            * (1
                                    - Math.tanh(
                                            cov
                                                    + Math.pow(cov, 3) / 3
                                                    + Math.pow(cov, 5) / 5));
        }
        return rounded(consistency);
    }

    private TypingResultResponse toResponse(TypingResultEntity entity, int pruned) {
        PacePayload pacePayload = readPaceBuckets(entity.getPaceBucketsJson());
        List<PaceBucket> pace = pacePayload.buckets();
        return new TypingResultResponse(
                entity.getClientResultId(),
                entity.getMode(),
                entity.getModeValue(),
                entity.isPunctuation(),
                entity.isNumbers(),
                entity.getContentType(),
                entity.getLanguage(),
                entity.getCodeLanguage(),
                entity.getWordListVersion(),
                entity.getErrorPolicy(),
                entity.getDurationMs(),
                entity.getTypedCharacters(),
                entity.getCorrectAttempts(),
                entity.getIncorrectAttempts(),
                entity.getCorrectCharacters(),
                entity.getIncorrectCharacters(),
                entity.getMissingCharacters(),
                entity.getExtraAttempts(),
                entity.getCorrectedErrors(),
                entity.getWpm(),
                entity.getRawWpm(),
                entity.getAccuracy(),
                pacePayload.legacy()
                        ? entity.getConsistency()
                        : deriveConsistency(pace),
                entity.getCompletionReason(),
                pace,
                entity.getCompletedAt(),
                pruned);
    }

    private PacePayload readPaceBuckets(String paceJson) {
        JsonNode tree = json.readTree(paceJson);
        if (!tree.isArray()
                || (!tree.isEmpty()
                        && (!tree.get(0).has("correctCharacters")
                                || !tree.get(0).has("rawCharacters")
                                || !tree.get(0).has("errors")))) {
            return new PacePayload(List.of(), true);
        }
        return new PacePayload(
                json.readValue(paceJson, new TypeReference<List<PaceBucket>>() {}),
                false);
    }

    private boolean sameRawInput(
            TypingResultEntity entity, CreateResultRequest request, String paceJson) {
        return entity.getClientResultId().equals(request.clientResultId())
                && entity.getMode() == request.mode()
                && entity.getModeValue() == request.modeValue()
                && entity.isPunctuation() == request.punctuation()
                && entity.isNumbers() == request.numbers()
                && entity.getContentType() == request.contentType()
                && entity.getLanguage() == request.language()
                && entity.getCodeLanguage() == request.codeLanguage()
                && entity.getWordListVersion().equals(
                        normalizedWordListVersion(request))
                && entity.getErrorPolicy() == request.errorPolicy()
                && entity.getDurationMs() == request.durationMs()
                && entity.getTypedCharacters() == request.typedCharacters()
                && entity.getCorrectAttempts() == request.correctAttempts()
                && entity.getIncorrectAttempts() == request.incorrectAttempts()
                && entity.getCorrectCharacters() == request.correctCharacters()
                && entity.getIncorrectCharacters() == request.incorrectCharacters()
                && entity.getMissingCharacters() == request.missingCharacters()
                && entity.getExtraAttempts() == request.extraAttempts()
                && entity.getCorrectedErrors() == request.correctedErrors()
                && entity.getCompletionReason() == normalizedCompletionReason(request)
                && json.readTree(entity.getPaceBucketsJson())
                        .equals(json.readTree(paceJson));
    }

    private static CompletionReason normalizedCompletionReason(CreateResultRequest request) {
        if (request.completionReason() != null) {
            return request.completionReason();
        }
        return request.mode() == TestMode.TIME
                ? CompletionReason.TIME
                : CompletionReason.FINISHED;
    }

    private static String wordListVersion(
            ContentType contentType, TypingLanguage language) {
        return switch (contentType) {
            case WORDS -> language == TypingLanguage.ES ? "es-v1" : "en-v1";
            case QUOTE -> "quote-v1";
            case CUSTOM -> "custom-v1";
            case CODE -> "code-v2";
        };
    }

    private static String normalizedWordListVersion(CreateResultRequest request) {
        if (request.wordListVersion() != null) {
            return request.wordListVersion();
        }
        return request.contentType() == ContentType.CODE
                ? "code-v1"
                : wordListVersion(request.contentType(), request.language());
    }

    private static BigDecimal rounded(double value) {
        long hundredths = Math.round((value + Math.ulp(1.0d)) * 100d);
        return BigDecimal.valueOf(hundredths, 2);
    }

    private static double calculateWpm(int characters, double durationMs) {
        if (durationMs <= 0) {
            return 0;
        }
        return characters / 5d / (durationMs / 1_000d / 60d);
    }

    private static boolean approximatelyEqual(
            double actual, double expected, double tolerance) {
        return Math.abs(actual - expected) <= tolerance;
    }

    private static boolean hasHundredthPrecision(double value) {
        return Double.isFinite(value)
                && BigDecimal.valueOf(value).stripTrailingZeros().scale() <= 2;
    }

    private static boolean isCanonicalRawDuration(
            double rawDuration, int aggregateDuration) {
        BigDecimal difference =
                BigDecimal.valueOf(rawDuration)
                        .subtract(BigDecimal.valueOf(aggregateDuration));
        return difference.compareTo(new BigDecimal("-5.00")) >= 0
                && difference.compareTo(new BigDecimal("4.99")) <= 0;
    }

    private static ApiException invalid(String detail) {
        return new ApiException(
                HttpStatus.BAD_REQUEST,
                "VALIDATION_FAILED",
                "Request validation failed",
                detail + ".");
    }

    private static String encodeCursor(TypingResultEntity entity) {
        String raw = entity.getCompletedAt() + "|" + entity.getId();
        return Base64.getUrlEncoder()
                .withoutPadding()
                .encodeToString(raw.getBytes(StandardCharsets.US_ASCII));
    }

    private static Cursor decodeCursor(String value) {
        try {
            if (value.length() > 256) {
                throw new IllegalArgumentException("cursor too long");
            }
            String decoded =
                    new String(
                            Base64.getUrlDecoder().decode(value),
                            StandardCharsets.US_ASCII);
            String[] parts = decoded.split("\\|", -1);
            if (parts.length != 2) {
                throw new IllegalArgumentException("cursor parts");
            }
            return new Cursor(Instant.parse(parts[0]), UUID.fromString(parts[1]));
        } catch (RuntimeException exception) {
            throw new ApiException(
                    HttpStatus.BAD_REQUEST,
                    "INVALID_CURSOR",
                    "Invalid cursor",
                    "Restart history pagination.");
        }
    }

    public record CreateOutcome(TypingResultResponse response, boolean created) {}

    private record Metrics(
            BigDecimal wpm,
            BigDecimal rawWpm,
            BigDecimal accuracy,
            BigDecimal consistency) {}

    private record PacePayload(List<PaceBucket> buckets, boolean legacy) {}

    private record Cursor(Instant completedAt, UUID id) {}
}
