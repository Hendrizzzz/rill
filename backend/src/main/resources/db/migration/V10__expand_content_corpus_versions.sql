ALTER TABLE typing_result
    DROP CONSTRAINT ck_typing_result_word_list_version;

ALTER TABLE typing_result
    ADD CONSTRAINT ck_typing_result_word_list_version CHECK (
        (content_type = 'WORDS' AND language = 'EN' AND word_list_version = 'en-v1')
        OR (content_type = 'WORDS' AND language = 'ES' AND word_list_version = 'es-v1')
        OR (
            content_type = 'QUOTE'
            AND word_list_version IN ('quote-v1', 'quote-v2', 'quote-v3')
        )
        OR (content_type = 'CUSTOM' AND word_list_version = 'custom-v1')
        OR (
            content_type = 'CODE'
            AND word_list_version IN ('code-v1', 'code-v2', 'code-v3', 'code-v4')
        )
    );
