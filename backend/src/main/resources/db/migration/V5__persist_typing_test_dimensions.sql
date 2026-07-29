ALTER TABLE typing_result
    ADD COLUMN content_type VARCHAR(8) NOT NULL DEFAULT 'WORDS',
    ADD COLUMN language VARCHAR(2) NOT NULL DEFAULT 'EN',
    ADD COLUMN error_policy VARCHAR(8) NOT NULL DEFAULT 'NORMAL';

ALTER TABLE typing_result
    ALTER COLUMN content_type DROP DEFAULT,
    ALTER COLUMN language DROP DEFAULT,
    ALTER COLUMN error_policy DROP DEFAULT,
    DROP CONSTRAINT ck_typing_result_mode,
    DROP CONSTRAINT ck_typing_result_duration,
    ADD CONSTRAINT ck_typing_result_content_type CHECK (
        content_type IN ('WORDS', 'QUOTE', 'CUSTOM')
    ),
    ADD CONSTRAINT ck_typing_result_language CHECK (
        language IN ('EN', 'ES')
        AND (content_type <> 'QUOTE' OR language = 'EN')
    ),
    ADD CONSTRAINT ck_typing_result_error_policy CHECK (
        error_policy IN ('NORMAL', 'STRICT')
    ),
    ADD CONSTRAINT ck_typing_result_mode CHECK (
        (
            content_type = 'WORDS'
            AND (
                (mode = 'TIME' AND mode_value IN (15, 30, 60))
                OR (mode = 'WORDS' AND mode_value IN (10, 25, 50))
            )
        )
        OR (
            content_type IN ('QUOTE', 'CUSTOM')
            AND mode = 'WORDS'
            AND mode_value BETWEEN 2 AND 300
            AND punctuation = FALSE
            AND numbers = FALSE
        )
    ),
    ADD CONSTRAINT ck_typing_result_duration CHECK (
        (mode = 'TIME' AND duration_ms = mode_value * 1000)
        OR (
            mode = 'WORDS'
            AND duration_ms BETWEEN 250 AND 600000
            AND duration_ms % 10 = 0
        )
    );
