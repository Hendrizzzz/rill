ALTER TABLE typing_result
    ADD COLUMN incorrect_characters integer NOT NULL DEFAULT 0;

ALTER TABLE typing_result
    ALTER COLUMN incorrect_characters DROP DEFAULT;
