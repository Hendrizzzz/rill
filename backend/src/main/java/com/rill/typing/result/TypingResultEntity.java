package com.rill.typing.result;

import com.rill.typing.auth.UserAccount;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "typing_result")
public class TypingResultEntity {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private UserAccount user;

    @Column(name = "client_result_id", nullable = false)
    private UUID clientResultId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 8)
    private TestMode mode;

    @Column(name = "mode_value", nullable = false)
    private int modeValue;

    @Column(nullable = false)
    private boolean punctuation;

    @Column(nullable = false)
    private boolean numbers;

    @Column(name = "duration_ms", nullable = false)
    private int durationMs;

    @Column(name = "typed_characters", nullable = false)
    private int typedCharacters;

    @Column(name = "correct_attempts", nullable = false)
    private int correctAttempts;

    @Column(name = "incorrect_attempts", nullable = false)
    private int incorrectAttempts;

    @Column(name = "correct_characters", nullable = false)
    private int correctCharacters;

    @Column(name = "missing_characters", nullable = false)
    private int missingCharacters;

    @Column(name = "extra_attempts", nullable = false)
    private int extraAttempts;

    @Column(name = "corrected_errors", nullable = false)
    private int correctedErrors;

    @Column(nullable = false, precision = 8, scale = 2)
    private BigDecimal wpm;

    @Column(name = "raw_wpm", nullable = false, precision = 8, scale = 2)
    private BigDecimal rawWpm;

    @Column(nullable = false, precision = 5, scale = 2)
    private BigDecimal accuracy;

    @Column(nullable = false, precision = 5, scale = 2)
    private BigDecimal consistency;

    @Column(name = "pace_buckets_json", nullable = false, columnDefinition = "text")
    private String paceBucketsJson;

    @Column(name = "completed_at", nullable = false)
    private Instant completedAt;

    protected TypingResultEntity() {}

    public TypingResultEntity(
            UserAccount user,
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
            String paceBucketsJson,
            Instant completedAt) {
        this.id = UUID.randomUUID();
        this.user = user;
        this.clientResultId = clientResultId;
        this.mode = mode;
        this.modeValue = modeValue;
        this.punctuation = punctuation;
        this.numbers = numbers;
        this.durationMs = durationMs;
        this.typedCharacters = typedCharacters;
        this.correctAttempts = correctAttempts;
        this.incorrectAttempts = incorrectAttempts;
        this.correctCharacters = correctCharacters;
        this.missingCharacters = missingCharacters;
        this.extraAttempts = extraAttempts;
        this.correctedErrors = correctedErrors;
        this.wpm = wpm;
        this.rawWpm = rawWpm;
        this.accuracy = accuracy;
        this.consistency = consistency;
        this.paceBucketsJson = paceBucketsJson;
        this.completedAt = completedAt;
    }

    public UUID getId() {
        return id;
    }

    public UserAccount getUser() {
        return user;
    }

    public UUID getClientResultId() {
        return clientResultId;
    }

    public TestMode getMode() {
        return mode;
    }

    public int getModeValue() {
        return modeValue;
    }

    public boolean isPunctuation() {
        return punctuation;
    }

    public boolean isNumbers() {
        return numbers;
    }

    public int getDurationMs() {
        return durationMs;
    }

    public int getTypedCharacters() {
        return typedCharacters;
    }

    public int getCorrectAttempts() {
        return correctAttempts;
    }

    public int getIncorrectAttempts() {
        return incorrectAttempts;
    }

    public int getCorrectCharacters() {
        return correctCharacters;
    }

    public int getMissingCharacters() {
        return missingCharacters;
    }

    public int getExtraAttempts() {
        return extraAttempts;
    }

    public int getCorrectedErrors() {
        return correctedErrors;
    }

    public BigDecimal getWpm() {
        return wpm;
    }

    public BigDecimal getRawWpm() {
        return rawWpm;
    }

    public BigDecimal getAccuracy() {
        return accuracy;
    }

    public BigDecimal getConsistency() {
        return consistency;
    }

    public String getPaceBucketsJson() {
        return paceBucketsJson;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }
}
