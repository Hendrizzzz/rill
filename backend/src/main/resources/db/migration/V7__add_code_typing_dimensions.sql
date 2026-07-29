ALTER TABLE typing_result
    ADD COLUMN code_language VARCHAR(16),
    DROP CONSTRAINT ck_typing_result_content_type,
    DROP CONSTRAINT ck_typing_result_language,
    DROP CONSTRAINT ck_typing_result_mode,
    ADD CONSTRAINT ck_typing_result_content_type CHECK (
        content_type IN ('WORDS', 'QUOTE', 'CUSTOM', 'CODE')
    ),
    ADD CONSTRAINT ck_typing_result_language CHECK (
        language IN ('EN', 'ES')
        AND (content_type NOT IN ('QUOTE', 'CODE') OR language = 'EN')
    ),
    ADD CONSTRAINT ck_typing_result_code_language CHECK (
        (
            content_type = 'CODE'
            AND code_language IN (
                'CPP',
                'JAVA',
                'PYTHON3',
                'C',
                'CSHARP',
                'JAVASCRIPT',
                'TYPESCRIPT',
                'GO'
            )
        )
        OR (
            content_type <> 'CODE'
            AND code_language IS NULL
        )
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
            content_type IN ('QUOTE', 'CUSTOM', 'CODE')
            AND mode = 'WORDS'
            AND mode_value BETWEEN 2 AND 300
            AND punctuation = FALSE
            AND numbers = FALSE
        )
    );
