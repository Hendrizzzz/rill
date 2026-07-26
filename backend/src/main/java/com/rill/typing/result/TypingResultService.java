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
import java.util.ArrayList;
import java.util.Base64;
import java.util.List;
import java.util.Objects;
import java.util.UUID;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import tools.jackson.core.type.TypeReference;
import tools.jackson.databind.json.JsonMapper;

@Service
public class TypingResultService {

    private static final int MINIMUM_PACE_ANALYSIS_WINDOW_MS = 250;

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
                        request.durationMs(),
                        request.typedCharacters(),
                        request.correctAttempts(),
                        request.incorrectAttempts(),
                        request.correctCharacters(),
                        request.missingCharacters(),
                        request.extraAttempts(),
                        request.correctedErrors(),
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
                                                        result.isNumbers()),
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
        boolean modeValid =
                request.mode() == TestMode.TIME
                        ? request.modeValue() == 15
                                || request.modeValue() == 30
                                || request.modeValue() == 60
                        : request.modeValue() == 10
                                || request.modeValue() == 25
                                || request.modeValue() == 50;
        if (!modeValid) {
            throw invalid("modeValue is not supported for this mode");
        }
        if (request.mode() == TestMode.TIME
                && request.durationMs() != request.modeValue() * 1000) {
            throw invalid("time mode duration must equal the selected duration");
        }
        if (request.mode() == TestMode.WORDS
                && (request.durationMs() < 250 || request.durationMs() > 600_000)) {
            throw invalid("word mode duration must be between 250 and 600000 milliseconds");
        }
        if (request.typedCharacters()
                != request.correctAttempts() + request.incorrectAttempts()) {
            throw invalid("typedCharacters must equal correctAttempts plus incorrectAttempts");
        }
        if (request.correctCharacters() > request.typedCharacters()
                || request.extraAttempts() > request.incorrectAttempts()
                || request.correctedErrors() > request.typedCharacters()) {
            throw invalid("character counters are inconsistent");
        }
        int totalDuration = 0;
        int totalTyped = 0;
        for (int index = 0; index < request.paceBuckets().size(); index++) {
            PaceBucket bucket = request.paceBuckets().get(index);
            boolean isFinal = index == request.paceBuckets().size() - 1;
            if (!isFinal && bucket.durationMs() != 1000) {
                throw invalid("all non-final pace buckets must be 1000 milliseconds");
            }
            totalDuration = Math.addExact(totalDuration, bucket.durationMs());
            totalTyped = Math.addExact(totalTyped, bucket.typedCharacters());
        }
        if (totalDuration != request.durationMs()
                || totalTyped != request.typedCharacters()) {
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
        BigDecimal wpm = rounded(request.correctCharacters() * 12_000d / duration);
        BigDecimal rawWpm = rounded(request.typedCharacters() * 12_000d / duration);
        int denominator = request.typedCharacters() + request.missingCharacters();
        BigDecimal accuracy =
                denominator == 0
                        ? rounded(100)
                        : rounded(request.correctAttempts() * 100d / denominator);

        BigDecimal consistency = deriveConsistency(request.paceBuckets());
        return new Metrics(wpm, rawWpm, accuracy, consistency);
    }

    private static BigDecimal deriveConsistency(List<PaceBucket> buckets) {
        List<Double> pace =
                paceAnalysisBuckets(buckets).stream()
                        .map(bucket -> bucket.typedCharacters() * 12_000d / bucket.durationMs())
                        .toList();
        double mean = pace.stream().mapToDouble(Double::doubleValue).average().orElse(0);
        double consistency = 100;
        if (pace.size() > 1 && mean != 0) {
            double variance =
                    pace.stream()
                                    .mapToDouble(value -> Math.pow(value - mean, 2))
                                    .sum()
                            / pace.size();
            consistency =
                    100 * Math.max(0, 1 - Math.sqrt(variance) / Math.max(mean, 1));
        }
        return rounded(consistency);
    }

    private static List<PaceBucket> paceAnalysisBuckets(List<PaceBucket> buckets) {
        if (buckets.size() < 2
                || buckets.getLast().durationMs() >= MINIMUM_PACE_ANALYSIS_WINDOW_MS) {
            return buckets;
        }

        List<PaceBucket> analyzed = new ArrayList<>(buckets);
        PaceBucket finalBucket = analyzed.removeLast();
        PaceBucket previousBucket = analyzed.removeLast();
        analyzed.add(
                new PaceBucket(
                        previousBucket.durationMs() + finalBucket.durationMs(),
                        previousBucket.typedCharacters() + finalBucket.typedCharacters()));
        return analyzed;
    }

    private TypingResultResponse toResponse(TypingResultEntity entity, int pruned) {
        List<PaceBucket> pace =
                json.readValue(
                        entity.getPaceBucketsJson(),
                        new TypeReference<List<PaceBucket>>() {});
        return new TypingResultResponse(
                entity.getClientResultId(),
                entity.getMode(),
                entity.getModeValue(),
                entity.isPunctuation(),
                entity.isNumbers(),
                entity.getDurationMs(),
                entity.getTypedCharacters(),
                entity.getCorrectAttempts(),
                entity.getIncorrectAttempts(),
                entity.getCorrectCharacters(),
                entity.getMissingCharacters(),
                entity.getExtraAttempts(),
                entity.getCorrectedErrors(),
                entity.getWpm(),
                entity.getRawWpm(),
                entity.getAccuracy(),
                deriveConsistency(pace),
                pace,
                entity.getCompletedAt(),
                pruned);
    }

    private static boolean sameRawInput(
            TypingResultEntity entity, CreateResultRequest request, String paceJson) {
        return entity.getClientResultId().equals(request.clientResultId())
                && entity.getMode() == request.mode()
                && entity.getModeValue() == request.modeValue()
                && entity.isPunctuation() == request.punctuation()
                && entity.isNumbers() == request.numbers()
                && entity.getDurationMs() == request.durationMs()
                && entity.getTypedCharacters() == request.typedCharacters()
                && entity.getCorrectAttempts() == request.correctAttempts()
                && entity.getIncorrectAttempts() == request.incorrectAttempts()
                && entity.getCorrectCharacters() == request.correctCharacters()
                && entity.getMissingCharacters() == request.missingCharacters()
                && entity.getExtraAttempts() == request.extraAttempts()
                && entity.getCorrectedErrors() == request.correctedErrors()
                && Objects.equals(entity.getPaceBucketsJson(), paceJson);
    }

    private static BigDecimal rounded(double value) {
        return BigDecimal.valueOf(value).setScale(2, RoundingMode.HALF_UP);
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

    private record Cursor(Instant completedAt, UUID id) {}
}
