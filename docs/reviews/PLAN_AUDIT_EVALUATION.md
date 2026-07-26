# Initial plan audit evaluation

Date: 2026-07-26
Reviewer independence: two separate review-only specialist agents; neither edited files or ran tests
Root evaluation status: complete

## Backend, security, and data-integrity audit

The backend specialist issued a conditional no-go for the original Milestone 2 and a go for repository/guest work.

| Finding | Root decision | Result |
| --- | --- | --- |
| Idempotency was promised without a schema/request conflict contract | Accept | Added server id plus `(user_id, client_result_id)` uniqueness, identical-retry `200`, conflicting-reuse `409`, and explicit cross-field constraints in `API_CONTRACT.md`. |
| H2 cannot prove PostgreSQL behavior | Accept | Replaced H2 integration claims with PostgreSQL 18 Testcontainers for migrations, constraints, pagination, and concurrency. |
| CSRF/session design lacked an implementation lifecycle | Accept with one modification | Selected `CookieCsrfTokenRepository`, named cookies/header, bootstrap, attributes, mutation coverage, and clearing/rebootstrap. Did not rotate after login because the double-submit token is not an auth credential and login is itself protected. |
| Boolean forwarded-header trust and configurable insecure production cookies were unsafe | Accept | Fixed the topology: external TLS ingress, only Nginx public, backend/database private, Secure cookies mandatory, no cookie decision from forwarded scheme. |
| Startup migrations contradicted a least-privilege runtime role | Accept | Production plan now uses a one-shot Flyway service/migration owner and a DML runtime role. |
| Result/session/export growth was unbounded | Accept, later tightened | Added 1,000-result rolling retention, bounded 10-session/account policy, hourly cleanup, bounded export/payload/page/bucket sizes, and request/result/auth controls. Final review reduced the original 10,000-row decision. |
| Password encoder/BCrypt limits and schema were unspecified | Accept with modification | Kept BCrypt for dependency/operational simplicity, but fixed strength 12, delegating prefix, 255-character hash column, 12-code-point minimum, 72-UTF-8-byte maximum, and dummy unknown-user verification. |
| Endpoint list lacked DTO/status/error/cursor contracts | Accept | Added `docs/architecture/API_CONTRACT.md`. |
| Username normalization was ambiguous | Accept | Release 1 uses an ASCII allowlist, lowercase normalization, and rejects surrounding whitespace. |
| Cursor order/index lacked a deterministic tie-breaker | Accept | Defined `(completed_at DESC, id DESC)` cursor/index. |
| Browser security-header ownership was split incorrectly | Accept | Nginx owns document headers; Spring owns sensitive API cache/defensive headers. |
| Health/observability was vague | Accept in part | Defined detail-free public health and a DB-aware readiness split. Dedicated domain counters were deferred and the final contract no longer claims they are implemented. |
| Payload bounds needed proxy and parser enforcement | Accept | Fixed a 64-KiB body limit and explicit counter/bucket/page bounds; implementation will also set parser/timeout limits. |
| Original Milestone 2 was too large | Accept | Split it into schema/results, identity/session, and account lifecycle gates. |
| Backup/restore promise lacked a proof gate | Accept | Added a disposable Compose restore drill gate. |
| TLS termination was ambiguous | Accept | External operator ingress terminates TLS; bundled Nginx is the only public Compose port. |

## Frontend, interaction, accessibility, and performance audit

The frontend specialist issued a no-go for the original Milestone 1 until the input and accessible-target contracts were defined.

| Finding | Root decision | Result |
| --- | --- | --- |
| Key-command reducer did not define mobile/composition/browser-input translation | Accept with scope clarification | Added a native `beforeinput`/composition adapter contract. Release-1 prompts remain English/ASCII, while committed graphemes are handled and non-ASCII input counts as an incorrect attempt. |
| Hiding the visual prompt removed the target from screen readers | Accept | Added a referenced accessible current-word element and stable mode/progress summary with word-boundary announcements. |
| Word/space/backspace/extra/missing/final-word scoring was ambiguous | Accept | Added normative state, counters, formulas, invariants, and worked traces in `TYPING_CONTRACT.md`. |
| Delayed animation frames could accept characters after a deadline | Accept | Deadline check now precedes every input; equality completes before accepting the character. |
| Main-reducer `TICK` could rerender the typing tree at frame rate | Accept | Isolated a maximum-10Hz display clock and an 80-word visual window; deadline correctness is independent of display ticks. |
| Consistency was not reproducible/server-derived | Accept | Defined duration/count pace buckets, sum invariants, bucket pace, population deviation, short/zero handling, and server derivation. |
| Unsynced results could cross account identities | Accept | Queues are account-id scoped; guest runs never auto-upload; account switching is a test case. |
| Shortcut/focus precedence was missing | Accept | Added a focused-element/state matrix: modal Escape wins, Tab remains native, Escape restarts from capture, and completed-state Enter restarts from non-conflicting result contexts while native controls retain it. |
| Viewport emulation cannot prove a software keyboard | Accept | Added cross-engine input tests and requires disclosure unless a physical mobile-keyboard check is available. |
| Time prompt supply/windowing was undefined | Accept | Versioned deterministic prompts generate 500 words and append before exhaustion; visual DOM is windowed to 80 words. |
| StrictMode could duplicate local persistence | Accept | Client result UUID deduplicates every local/queue/server store; remount regression is planned. |
| Personal-record partition/ties were undefined | Accept | Records partition by mode/value/modifiers and tie on WPM, accuracy, then earliest completion. |
| Responsive matrix missed narrow/landscape/zoom/dynamic-height cases | Accept | Added 320×568, 844×390, 200% reflow, and dynamic/short viewport checks. |
| Theme secondary contrast was an undefined derived value | Accept | Replaced it with concrete muted tokens; all semantic states still require rendered contrast checks. |
| Failure-state tests were incomplete | Accept | Added explicit storage, session, CSRF, pagination, export/delete, queue, and account-switch cases. |
| Login/register “tabs” semantics were ambiguous | Accept | Chose ordinary buttons with `aria-pressed`, not ARIA tabs. |

## Root verification of the revised plan

The revised contracts were checked for the reported contradictions:

- result idempotency now exists in both request contract and schema;
- WPM, raw WPM, accuracy, pace, and consistency have one definition shared by client/server plans;
- the example result payload satisfies its bucket/count invariants;
- PostgreSQL, migration-role, cookie, CSRF, proxy, TLS, retention, and password assumptions are explicit;
- browser target accessibility no longer depends on the `aria-hidden` visual glyph tree;
- mobile/software-keyboard behavior remains an evidence risk, not an assumed pass;
- no reviewer recommendation was accepted solely because a specialist proposed it.

The plan is now a go for implementation. Runtime correctness, usability, security headers, cross-browser behavior, real mobile keyboard behavior, and screen-reader behavior remain unverified until their respective proof gates are executed.
