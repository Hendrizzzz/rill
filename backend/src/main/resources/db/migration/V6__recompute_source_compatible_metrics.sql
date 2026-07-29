-- Earlier releases used algebraically equivalent arithmetic and NUMERIC
-- half-up rounding. Both can cross a floating-point half-boundary differently
-- from the client/source oracle. Recompute the persisted fields that affect
-- summaries and personal-record ordering with the canonical operation order.
--
-- V3/V4 intentionally preserve legacy rows that cannot satisfy the richer
-- retained-scoring checks. PostgreSQL enforces a NOT VALID check on UPDATE,
-- so suspend both checks inside this transactional migration and restore them
-- unchanged afterward. The migration rewrites metrics only, never counters.
ALTER TABLE typing_result
    DROP CONSTRAINT ck_typing_result_character_ranges,
    DROP CONSTRAINT ck_typing_result_corrected_error_attempts;

UPDATE typing_result
SET wpm = (
        floor(
            (
                (
                    correct_characters::DOUBLE PRECISION
                    / 5::DOUBLE PRECISION
                    / (
                        duration_ms::DOUBLE PRECISION
                        / 1000::DOUBLE PRECISION
                        / 60::DOUBLE PRECISION
                    )
                    + 2.220446049250313E-16::DOUBLE PRECISION
                )
                * 100::DOUBLE PRECISION
            )
            + 0.5::DOUBLE PRECISION
        )
        / 100::DOUBLE PRECISION
    ),
    raw_wpm = (
        floor(
            (
                (
                    typed_characters::DOUBLE PRECISION
                    / 5::DOUBLE PRECISION
                    / (
                        duration_ms::DOUBLE PRECISION
                        / 1000::DOUBLE PRECISION
                        / 60::DOUBLE PRECISION
                    )
                    + 2.220446049250313E-16::DOUBLE PRECISION
                )
                * 100::DOUBLE PRECISION
            )
            + 0.5::DOUBLE PRECISION
        )
        / 100::DOUBLE PRECISION
    ),
    accuracy = (
        CASE
            WHEN correct_attempts + incorrect_attempts = 0 THEN 100
            ELSE
                floor(
                    (
                        (
                            correct_attempts::DOUBLE PRECISION
                            / (
                                correct_attempts::DOUBLE PRECISION
                                + incorrect_attempts::DOUBLE PRECISION
                            )
                            * 100::DOUBLE PRECISION
                            + 2.220446049250313E-16::DOUBLE PRECISION
                        )
                        * 100::DOUBLE PRECISION
                    )
                    + 0.5::DOUBLE PRECISION
                )
                / 100::DOUBLE PRECISION
        END
    );

ALTER TABLE typing_result
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
    ) NOT VALID;
