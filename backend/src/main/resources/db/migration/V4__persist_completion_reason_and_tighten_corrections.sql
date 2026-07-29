ALTER TABLE typing_result
    ADD COLUMN completion_reason VARCHAR(20);

-- V3 deliberately left this constraint NOT VALID so legacy rows remain readable.
-- PostgreSQL still enforces a NOT VALID check when an existing row is updated, so
-- temporarily remove and restore it around this metadata-only backfill.
ALTER TABLE typing_result
    DROP CONSTRAINT ck_typing_result_character_ranges;

UPDATE typing_result
SET completion_reason = CASE
    WHEN mode = 'TIME' THEN 'TIME'
    ELSE 'FINISHED'
END;

ALTER TABLE typing_result
    ALTER COLUMN completion_reason SET NOT NULL,
    ADD CONSTRAINT ck_typing_result_character_ranges CHECK (
        correct_characters BETWEEN 0 AND typed_characters
        AND incorrect_characters BETWEEN 0 AND typed_characters
        AND missing_characters BETWEEN 0 AND 50000
        AND extra_attempts BETWEEN 0 AND typed_characters
        AND correct_characters + incorrect_characters + extra_attempts
            <= typed_characters
        AND corrected_errors BETWEEN 0
            AND correct_attempts + incorrect_attempts
    ) NOT VALID,
    ADD CONSTRAINT ck_typing_result_completion_reason CHECK (
        completion_reason IN ('FINISHED', 'TIME', 'LIMIT', 'PROMPT_EXHAUSTED')
    ),
    ADD CONSTRAINT ck_typing_result_corrected_error_attempts CHECK (
        corrected_errors <= incorrect_attempts
    ) NOT VALID;
