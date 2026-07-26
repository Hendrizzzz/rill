CREATE TABLE app_user (
    id UUID PRIMARY KEY,
    username VARCHAR(24) NOT NULL,
    username_normalized VARCHAR(24) NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_app_user_username_normalized UNIQUE (username_normalized),
    CONSTRAINT ck_app_user_username
        CHECK (username ~ '^[A-Za-z0-9_]{3,24}$'),
    CONSTRAINT ck_app_user_username_normalized
        CHECK (
            username_normalized = lower(username_normalized)
            AND username_normalized ~ '^[a-z0-9_]{3,24}$'
        )
);

CREATE TABLE auth_session (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    token_hash VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_auth_session_token_hash UNIQUE (token_hash),
    CONSTRAINT ck_auth_session_token_hash
        CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    CONSTRAINT ck_auth_session_expiry CHECK (expires_at > created_at)
);

CREATE INDEX ix_auth_session_user_created
    ON auth_session(user_id, created_at ASC);
CREATE INDEX ix_auth_session_expires
    ON auth_session(expires_at);

CREATE TABLE typing_result (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
    client_result_id UUID NOT NULL,
    mode VARCHAR(8) NOT NULL,
    mode_value INTEGER NOT NULL,
    punctuation BOOLEAN NOT NULL,
    numbers BOOLEAN NOT NULL,
    duration_ms INTEGER NOT NULL,
    typed_characters INTEGER NOT NULL,
    correct_attempts INTEGER NOT NULL,
    incorrect_attempts INTEGER NOT NULL,
    correct_characters INTEGER NOT NULL,
    missing_characters INTEGER NOT NULL,
    extra_attempts INTEGER NOT NULL,
    corrected_errors INTEGER NOT NULL,
    wpm NUMERIC(8, 2) NOT NULL,
    raw_wpm NUMERIC(8, 2) NOT NULL,
    accuracy NUMERIC(5, 2) NOT NULL,
    consistency NUMERIC(5, 2) NOT NULL,
    pace_buckets_json TEXT NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT uq_typing_result_client UNIQUE (user_id, client_result_id),
    CONSTRAINT ck_typing_result_mode CHECK (
        (mode = 'TIME' AND mode_value IN (15, 30, 60))
        OR (mode = 'WORDS' AND mode_value IN (10, 25, 50))
    ),
    CONSTRAINT ck_typing_result_duration CHECK (
        (mode = 'TIME' AND duration_ms = mode_value * 1000)
        OR (mode = 'WORDS' AND duration_ms BETWEEN 250 AND 600000)
    ),
    CONSTRAINT ck_typing_result_typed CHECK (
        typed_characters BETWEEN 1 AND 50000
        AND correct_attempts BETWEEN 0 AND 50000
        AND incorrect_attempts BETWEEN 0 AND 50000
        AND typed_characters = correct_attempts + incorrect_attempts
    ),
    CONSTRAINT ck_typing_result_character_ranges CHECK (
        correct_characters BETWEEN 0 AND typed_characters
        AND missing_characters BETWEEN 0 AND 50000
        AND extra_attempts BETWEEN 0 AND incorrect_attempts
        AND corrected_errors BETWEEN 0 AND typed_characters
    ),
    CONSTRAINT ck_typing_result_metrics CHECK (
        wpm BETWEEN 0 AND 999999.99
        AND raw_wpm BETWEEN 0 AND 999999.99
        AND accuracy BETWEEN 0 AND 100
        AND consistency BETWEEN 0 AND 100
    ),
    CONSTRAINT ck_typing_result_pace_size
        CHECK (octet_length(pace_buckets_json) BETWEEN 2 AND 65536)
);

CREATE INDEX ix_typing_result_user_completed
    ON typing_result(user_id, completed_at DESC, id DESC);
