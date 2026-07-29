-- V1 through V8 accepted pre-release word results shorter than one second.
-- They are not eligible for history or records under the current persistence
-- policy, so remove only those rows before validating the stronger invariant.
DELETE FROM typing_result
WHERE mode = 'WORDS'
  AND duration_ms < 1000;

ALTER TABLE typing_result
    DROP CONSTRAINT ck_typing_result_duration,
    ADD CONSTRAINT ck_typing_result_duration CHECK (
        (mode = 'TIME' AND duration_ms = mode_value * 1000)
        OR (
            mode = 'WORDS'
            AND duration_ms BETWEEN 1000 AND 600000
            AND duration_ms % 10 = 0
        )
    );
