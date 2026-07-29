ALTER TABLE typing_result
    ADD COLUMN word_list_version VARCHAR(16);

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
