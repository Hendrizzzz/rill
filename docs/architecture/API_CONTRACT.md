# Rill HTTP and persistence contract

Status: normative release-1 contract
Last updated: 2026-07-26

## General rules

- Base path: `/api`.
- Media type: `application/json`; account export uses `application/json` with attachment disposition.
- Unknown JSON fields are rejected.
- Request body limit is 64 KiB at Nginx and the application connector.
- API responses containing account/session/result data use `Cache-Control: no-store`.
- Timestamps are UTC ISO-8601 instants.
- Public resource ids are random UUIDs.
- Entities and password/session hashes are never serialized.

Errors use `application/problem+json`:

```json
{
  "type": "about:blank",
  "title": "Request validation failed",
  "status": 400,
  "detail": "One or more fields are invalid.",
  "instance": "/api/results",
  "code": "VALIDATION_FAILED",
  "requestId": "bounded-correlation-id",
  "fieldErrors": {
    "modeValue": "is not supported"
  }
}
```

`detail` and field errors never expose SQL, stack traces, hashes, cookies, or submitted passwords.

## Authentication and cookies

### Username

- Display username: 3–24 ASCII characters matching `[A-Za-z0-9_]+`.
- Normalized username: ASCII lowercase with `Locale.ROOT`.
- Leading/trailing whitespace is rejected, not silently trimmed.
- Uniqueness is enforced on the normalized database column.

### Password

- Minimum 12 Unicode code points.
- Maximum 72 UTF-8 bytes because release 1 uses BCrypt.
- No Unicode normalization or silent trimming.
- Stored through a delegating password encoder as `{bcrypt}...`, BCrypt strength 12.
- Hash column is `varchar(255)` for future algorithms.
- Unknown-user login performs verification against a fixed dummy hash before returning the same generic error as a wrong password.

### Session cookie

- Name: `RILL_SESSION`.
- Value: 32 cryptographically random bytes encoded Base64 URL-safe without padding.
- Only a SHA-256 hash of the value is stored.
- Attributes: `HttpOnly`, `Path=/`, `SameSite=Lax`, seven-day absolute `Max-Age`.
- Production always adds `Secure` and fails startup if secure cookies are disabled.
- A session is touched at most once per 15 minutes and is never extended beyond its absolute expiry.
- Maximum ten active sessions per account; creating another revokes the oldest.
- Logout/account deletion clears the cookie and deletes applicable session rows.
- Expired sessions are deleted hourly and opportunistically on lookup.

### CSRF

- Spring Security `CookieCsrfTokenRepository` uses readable cookie `XSRF-TOKEN` and header `X-XSRF-TOKEN`.
- CSRF cookie attributes: `Path=/`, `SameSite=Lax`, `Secure` in production. It is intentionally not HttpOnly because this is a double-submit token, not a credential.
- `GET /api/auth/session` forces token creation and returns the same token in `csrfToken`.
- All POST/PUT/PATCH/DELETE routes, including registration and login, require the token.
- Logout and account deletion clear it; the next session bootstrap issues a new one.
- The token is not rotated merely because login succeeds. It is not an authentication credential, login itself is CSRF-protected, and clearing/rebootstrap avoids stale post-logout state.

## Auth endpoints

### `GET /api/auth/session`

`200`:

```json
{
  "authenticated": true,
  "user": {
    "id": "b73a53f0-22d7-4f78-b952-6e72ef93314a",
    "username": "river_writer",
    "createdAt": "2026-07-26T08:00:00Z"
  },
  "csrfToken": "..."
}
```

For a guest, `authenticated` is false and `user` is absent/null. This endpoint never returns the auth-session token.

### `POST /api/auth/register`

Request: `{ "username": "...", "password": "..." }`
Success: `201`, same authenticated session body as above, plus `RILL_SESSION`.
Errors: `400 VALIDATION_FAILED`, `409 USERNAME_UNAVAILABLE`, `429 RATE_LIMITED`.

### `POST /api/auth/login`

Request: `{ "username": "...", "password": "..." }`
Success: `200`, authenticated session body and cookie.
Errors: `400 VALIDATION_FAILED`, `401 INVALID_CREDENTIALS`, `429 RATE_LIMITED`.

The failure is generic for unknown user and wrong password.

### `POST /api/auth/logout`

Success: `204`, current session revoked, auth and CSRF cookies cleared.
Unauthenticated: `401 AUTHENTICATION_REQUIRED`.

### `GET /api/account/export`

Success: `200`, attachment filename `rill-export-YYYY-MM-DD.json`.

```json
{
  "schemaVersion": 1,
  "exportedAt": "...",
  "account": { "id": "...", "username": "...", "createdAt": "..." },
  "results": []
}
```

The server retains at most 1,000 results per account and limits export to three
requests per account per 15 minutes. A result request is at most 64 KiB, so the
response has an explicit, conservative upper bound. Export does not contain
hashes, cookies, internal session rows, or secrets.

### `DELETE /api/account`

Request: `{ "password": "..." }`
Success: `204`, database cascades results/sessions and clears cookies.
Errors: `401 AUTHENTICATION_REQUIRED`, `403 PASSWORD_CONFIRMATION_FAILED`,
`429 RATE_LIMITED`.

## Result creation

### `POST /api/results`

Request:

```json
{
  "clientResultId": "e1c4d0dc-f456-43b3-b24f-e49779649484",
  "mode": "WORDS",
  "modeValue": 10,
  "punctuation": false,
  "numbers": false,
  "durationMs": 1000,
  "typedCharacters": 7,
  "correctAttempts": 6,
  "incorrectAttempts": 1,
  "correctCharacters": 5,
  "missingCharacters": 2,
  "extraAttempts": 0,
  "correctedErrors": 1,
  "paceBuckets": [
    { "durationMs": 1000, "typedCharacters": 7 }
  ]
}
```

Bounds and invariants:

- mode/value: `TIME` with 15/30/60 or `WORDS` with 10/25/50;
- time-mode duration equals the mode value multiplied by 1,000 milliseconds;
- word-mode duration: 250–600,000ms;
- 1–600 pace buckets; all non-final durations 1,000ms; final 1–1,000ms;
- bucket durations sum to `durationMs`;
- bucket typed counts sum to `typedCharacters`;
- each character counter is 0–50,000;
- `typedCharacters = correctAttempts + incorrectAttempts`;
- `correctCharacters <= typedCharacters`;
- `extraAttempts <= incorrectAttempts`;
- `correctedErrors <= typedCharacters`;
- a completed/persisted result has at least one typed character.

The server derives WPM, raw WPM, accuracy, consistency, and `completedAt`.
The submitted pace buckets remain canonical and exact. When the final bucket is
shorter than 250ms and has a predecessor, the server combines those two buckets
only for consistency analysis; the response still returns the unchanged raw
buckets. This prevents a few milliseconds at a second boundary from receiving
the statistical weight of a full sample.

First creation: `201` with canonical `TypingResult`.

An identical retry for the same authenticated user and `clientResultId`: `200` with the originally stored result. A reused id with different raw fields: `409 RESULT_IDEMPOTENCY_CONFLICT`.

Database shape uses a server-generated `id` plus non-null `client_result_id`, unique on `(user_id, client_result_id)`.

After insertion the service retains at most 1,000 results per account by
deleting the oldest rows in the same transaction. The response includes
`oldestResultsPruned` so data loss is not silent. The UI shows a one-time
retention notice.

## History and records

### `GET /api/results?limit=20&cursor=...`

- Default limit 20; allowed 1–50.
- Stable ordering: `(completed_at DESC, id DESC)`.
- Cursor is an opaque Base64 URL-safe encoding of the last `(completedAt,id)` tuple. It is parsed, bounded, and always combined with authenticated ownership.
- Invalid cursor: `400 INVALID_CURSOR`.
- Response: `{ "items": [...], "nextCursor": "..." }`; next cursor is null/absent at the end.
- Matching database index: `(user_id, completed_at DESC, id DESC)`.

### `GET /api/results/summary`

Returns total retained runs, total practice milliseconds, highest WPM, average accuracy, and records partitioned by `(mode, modeValue, punctuation, numbers)`.

Record tie-breaker: WPM descending, accuracy descending, earliest `completedAt`.

## Rate and resource controls

- Bundled Nginx is the public service and rate-limits `/api/auth/login` and `/api/auth/register` by its resolved source address. The backend port is private in production Compose.
- The API also maintains a bounded, expiring per-normalized-username login limiter so a distributed source cannot hammer one account indefinitely.
- Authenticated result requests are limited to 240 per account per minute
  before validation/database work, while novel stored results are separately
  limited to 120 per account per hour. Normal product traffic is one request
  per completed test.
- Nginx and API enforce 64-KiB request bodies, request/header timeouts, and no request buffering beyond what the small JSON contract needs.
- Pace arrays, page size, active sessions, retained results, and export size are bounded as above.
- If an external ingress sits before bundled Nginx, it must overwrite forwarding headers and own public-source rate limiting. The API does not infer cookie security from forwarded scheme headers.

## Deployment boundary

- Production HTTPS terminates at an operator-provided external ingress/reverse proxy.
- Bundled Nginx serves/proxies HTTP inside the deployment boundary and is the only Compose service with a host port.
- Spring Boot and PostgreSQL have no production host-port mapping.
- Secure cookies are configured explicitly and remain Secure even though internal hops are HTTP.
- Browser-document CSP/frame/referrer/permissions/nosniff headers are owned by Nginx.
- API cache-control and defensive headers are also set in Spring where appropriate.
- Public health exposes only aggregate `UP`/`DOWN` without component details. Internal liveness excludes the database; readiness includes database connectivity.
- Nginx access logs provide route/status traffic and the API logs unexpected
  exceptions with request IDs. Dedicated domain counters, dashboards, and
  alerting are deployment follow-up work; credentials, request bodies, cookies,
  and session values must not be logged.
