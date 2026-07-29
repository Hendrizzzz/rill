ALTER TABLE typing_result
    ADD COLUMN word_list_version VARCHAR(16);

-- V3/V4 intentionally preserve legacy rows that cannot satisfy the richer
-- retained-scoring checks. PostgreSQL enforces NOT VALID checks on UPDATE, so
-- suspend them around this metadata-only backfill and restore them unchanged.
ALTER TABLE typing_result
    DROP CONSTRAINT ck_typing_result_character_ranges,
    DROP CONSTRAINT ck_typing_result_corrected_error_attempts;

UPDATE typing_result
SET word_list_version = CASE
    WHEN content_type = 'WORDS' AND language = 'ES' THEN 'es-v1'
    WHEN content_type = 'WORDS' THEN 'en-v1'
    WHEN content_type = 'QUOTE' THEN 'quote-v1'
    WHEN content_type = 'CUSTOM' THEN 'custom-v1'
    WHEN content_type = 'CODE' THEN 'code-v1'
END;

ALTER TABLE typing_result
    ALTER COLUMN word_list_version SET NOT NULL,
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
    ADD CONSTRAINT ck_typing_result_corrected_error_attempts CHECK (
        corrected_errors <= incorrect_attempts
    ) NOT VALID,
    ADD CONSTRAINT ck_typing_result_word_list_version CHECK (
        (content_type = 'WORDS' AND language = 'EN' AND word_list_version = 'en-v1')
        OR (content_type = 'WORDS' AND language = 'ES' AND word_list_version = 'es-v1')
        OR (content_type = 'QUOTE' AND word_list_version = 'quote-v1')
        OR (content_type = 'CUSTOM' AND word_list_version = 'custom-v1')
        OR (
            content_type = 'CODE'
            AND word_list_version IN ('code-v1', 'code-v2')
        )
    );
