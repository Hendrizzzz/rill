ALTER TABLE typing_result
    DROP CONSTRAINT ck_typing_result_typed,
    DROP CONSTRAINT ck_typing_result_character_ranges;

ALTER TABLE typing_result
    ADD CONSTRAINT ck_typing_result_typed CHECK (
        typed_characters BETWEEN 1 AND 50000
        AND correct_attempts BETWEEN 0 AND 50000
        AND incorrect_attempts BETWEEN 0 AND 50000
        AND typed_characters <= correct_attempts + incorrect_attempts
    ),
    ADD CONSTRAINT ck_typing_result_character_ranges CHECK (
        correct_characters BETWEEN 0 AND typed_characters
        AND incorrect_characters BETWEEN 0 AND typed_characters
        AND missing_characters BETWEEN 0 AND 50000
        AND extra_attempts BETWEEN 0 AND typed_characters
        AND correct_characters + incorrect_characters + extra_attempts
            <= typed_characters
        AND corrected_errors BETWEEN 0
            AND correct_attempts + incorrect_attempts
    ) NOT VALID;
