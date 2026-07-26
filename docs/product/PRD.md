# Rill product requirements

Status: release scope implemented and locally verified
Last updated: 2026-07-26

## Verdict

Rill is worth building as a focused, useful typing instrument and as a production-oriented full-stack reference project. The release should stay narrow: make repeated typing practice excellent, preserve meaningful history, and avoid social or competitive features that would distract from the core loop.

## Product intent

Rill helps an individual practise speed and accuracy without visual noise. A guest can open the app and begin immediately. An account is optional and exists to preserve results across devices, not to gate the typing experience.

The product must feel:

- Immediate: the typing loop works locally and performs no request per keystroke.
- Trustworthy: timing and scoring rules are deterministic and tested.
- Quiet: the text is the dominant visual element and controls recede while typing.
- Keyboard-first: start, type, restart, change modes, and review results without depending on a pointer.
- Resilient: guest tests and local history continue when the backend is unavailable.

## Release scope

### Core typing

- Time modes: 15, 30, and 60 seconds.
- Word modes: 10, 25, and 50 words.
- Optional punctuation and numbers.
- Deterministic, seeded prompt generation from a bundled English word list.
- Start on the first printable character.
- Correct, incorrect, extra, and missing-character presentation.
- Backspace correction without erasing the historical accuracy penalty.
- Live elapsed/remaining time and progress.
- Instant restart with `Escape`; restart from results with `Enter`.
- Pointer/touch focus recovery and a real input control for mobile software keyboards.
- No network request in the keystroke-critical path.

### Results and history

- Canonical WPM, raw WPM, accuracy, consistency, character counts, elapsed time, and option summary.
- Per-second pace samples rendered as a lightweight SVG chart with truthful
  raw-pace, character-count, and interval details on pointer hover or through a
  single keyboard range control.
- Guest history in versioned local storage, capped at the most recent 100 tests.
- Optional account registration, sign-in, sign-out, server-side result history, personal records, JSON data export, and account deletion.
- Cursor-paginated history; no unbounded result response.
- Clear “saved locally”, “saved to account”, “sync failed”, and empty states.

### Personalisation

- Three original themes: Paper, Nocturne, and Tide.
- Theme and test preferences stored locally; authentication secrets are never placed in Web Storage.
- Preferences remain device-local in release 1. Cross-device preference sync is deferred.

### Quality and operations

- Responsive layouts for desktop, laptop, tablet, and mobile.
- Semantic structure, visible focus, sufficient contrast, reduced-motion support, and screen-reader status announcements.
- Spring validation, consistent problem responses, database migrations, structured logs, health checks, safe configuration defaults, and graceful API failure handling.
- Reproducible dependency installs, CI, container images, Docker Compose deployment, and operator documentation.

## Explicit non-goals for release 1

- Competitive leaderboards, social profiles, friends, multiplayer, or anti-cheat guarantees.
- Email addresses, verification, password reset, OAuth, or multi-factor authentication.
- Administrator UI.
- Custom text uploads, arbitrary rich text, or multilingual word lists.
- Offline service worker/PWA caching.
- Native mobile or desktop applications.
- Telemetry, advertising, third-party analytics, or remote font/CDN dependencies.
- Distributed rate limiting. The included limiter protects a single API instance; a shared edge/Redis limiter is required before horizontal scaling.

## Scoring contract

Printable character attempts are counted; backspace and control keys are not.

```text
minutes = durationMilliseconds / 60_000
rawWpm = typedCharacters / 5 / minutes
wpm = correctCharacters / 5 / minutes
accuracy = correctAttempts / (typedCharacters + missingCharacters) * 100
```

- Values are rounded only for presentation. Stored values use fixed numeric precision.
- A corrected mistake remains an incorrect historical attempt for accuracy and raw WPM. Final-position correctness, attempt correctness, missing characters, extra attempts, and corrected errors are distinct counters.
- Consistency is server-derived from validated one-second pace buckets using the population coefficient of variation, clamped to 0–100.
- For a time test, the canonical duration is the configured limit.
- For a word test, duration runs from the first accepted character until the final target word is completed.
- The server recalculates WPM, raw WPM, and accuracy from validated counts and duration. It does not trust client-supplied display metrics.
- The normative event/counter/boundary rules and worked traces live in `docs/product/TYPING_CONTRACT.md`.

## State model

```text
ready -> running -> completed
  ^         |           |
  +---------+-----------+
        restart
```

- `ready`: configuration enabled, prompt visible, input focused when practical.
- `running`: configuration and navigation visually subdued and editing controls disabled; typing remains uninterrupted.
- `completed`: immutable result snapshot; save is independent from result display.
- Any state can transition to a new `ready` state through restart.
- API loading/failure is orthogonal to typing state and must never stall keystrokes.

## Acceptance criteria

1. A guest can complete every time and word mode, use both modifiers, restart, and see mathematically correct results.
2. The first printable key starts timing; navigation/modifier keys do not.
3. The timer uses a monotonic clock (`performance.now`) and is not derived from render counts or wall-clock time.
4. Backspace, incorrect characters, extra characters, consecutive spaces, focus loss, time expiry, and a final-word boundary have automated regression coverage.
5. No fetch/XHR occurs as a consequence of an individual keystroke.
6. An unavailable API leaves guest typing and local history operational and produces a clear non-blocking status.
7. Registration, sign-in, sign-out, result creation/history, export, and deletion enforce authentication/ownership at the API.
8. Secrets/session identifiers are absent from browser storage and source control.
9. Desktop and mobile browser checks show no horizontal overflow, hidden primary controls, clipped results, or inaccessible focus.
10. Backend verification, frontend unit tests/typecheck/build, end-to-end keyboard tests, dependency audits, and a clean container build either pass or are reported with exact blockers.

## Main risks

| Risk | Consequence | Planned control |
| --- | --- | --- |
| Timer drift or race at completion | Incorrect scores | Monotonic timestamps, immutable completion snapshot, fake-clock unit tests |
| Fragile typing state | Lost input or inconsistent restart | Pure reducer/domain functions, explicit transitions, focused regression tests |
| Mobile keyboard incompatibility | Core feature unusable on phones | Real textarea capture, touch-to-focus, mobile Playwright/manual viewport check |
| Client result tampering | Misleading stored records | Server-derived metrics, bounded inputs, no competitive leaderboard claim |
| Cookie/session mistakes | Account compromise | Random opaque tokens, only token hashes in DB, HttpOnly/SameSite cookies, expiry/revocation, CSRF |
| Account endpoint abuse | Resource exhaustion/guessing | Password hashing, generic auth failures, bounded payloads, single-instance rate limit |
| UI becoming dashboard-like | Typing area loses priority | No card grid, no decorative metrics before completion, screenshot-led visual review |
| Scope growth | Incomplete release | Non-goals above; defer social, email, admin, PWA, and custom content |

## Assumptions

- Release 1 is an internet-facing, single-tenant public web application for individual users.
- A production deployment uses HTTPS at the reverse proxy and one API instance initially.
- Stored data is low-sensitivity account data: username, password hash, opaque-session hash, and typing results. No email, payment, health, location, or uploaded content is collected.
- The operator supplies database credentials and secure runtime configuration outside source control.
- English prompts are acceptable for release 1.
- The target deployment is a public service for unrelated users. HTTPS terminates at an operator-managed ingress in front of the bundled Nginx container.
- Permanent account loss when a password is forgotten is an explicitly accepted release-1 tradeoff because no email or recovery identifier is collected.
