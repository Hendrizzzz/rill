# Final specialist audit evaluation

Date: 2026-07-26
Reviewers: two independent, review-only specialist agents
Root evaluation: complete

Neither final reviewer edited files or ran a test suite. The root agent
inspected and reproduced each accepted finding, implemented changes, and ran
the checks recorded in `docs/VERIFICATION.md`.

## Backend, security, and data integrity

| Finding | Root decision | Resolution |
| --- | --- | --- |
| Concurrent login could exceed the active-session cap | Accept | Session creation now locks the account row before insert/prune. A 24-worker PostgreSQL regression proves the cap remains ten. |
| Accepted counts could derive a WPM outside the database numeric range | Accept | Validation rejects derived WPM/raw WPM above `999999.99`; a crafted maximum-count/250ms request now returns `400 VALIDATION_FAILED`. |
| Readiness excluded PostgreSQL | Accept | Readiness explicitly includes `readinessState,db`; stopping PostgreSQL produced HTTP 503 and recovery returned the stack to healthy. |
| Password-confirmed deletion allowed unbounded BCrypt work inside a transaction | Accept | Five attempts/account/15 minutes are allowed, the sixth returns 429, and BCrypt now runs between short repository transactions rather than holding a database connection. |
| Idempotent result retries bypassed the creation quota while still doing database work | Accept | A separate 240-request/account/minute limiter runs before validation, JSON serialization, and locking. Novel results retain the 120/hour quota. |
| Summary/export could materialize an excessive retained payload | Accept with modification | Summary uses scalar aggregates plus at most one record/entity per test partition. Default retention is 1,000, each result request is 64 KiB maximum, and export is limited to three/account/15 minutes. Export still materializes its bounded result list; maximum-shape load measurement remains recommended. |
| Flyway used the PostgreSQL bootstrap superuser and runtime could modify Flyway history | Accept | Compose now separates bootstrap administrator, non-superuser migration owner, and DML runtime roles. A post-migration gate revokes runtime access to `flyway_schema_history`; runtime privilege queries verify the boundary. |
| CI only built images and initially omitted the new admin secret | Accept | CI now starts Compose from empty state and runs the Chromium account E2E. All three CI-only secrets are explicit. The workflow was inspected locally but has not run on GitHub. |
| Domain-specific metrics/logging was claimed but absent | Accept documentation correction | The contract now claims only observed Nginx route/status logs, request IDs, and unexpected-exception logging. Dedicated counters/dashboards are a documented deployment follow-up. |
| Supply-chain/image/runtime hardening could go further | Defer, disclose | Maven-wrapper checksums, action/image digest pinning, image scanning, container resource quotas, and log rotation remain operator/next-release work. Dependency and source scans were still executed. |

The reviewer found no authentication bypass, cross-account access, secret leak,
SQL injection, or critical deployment blocker.

## Frontend, interaction, accessibility, and visual quality

| Finding | Root decision | Resolution |
| --- | --- | --- |
| Pending prompt colors failed mobile AA contrast | Accept | Theme tokens now measure 4.79:1 (Paper), 5.48:1 (Nocturne), and 5.26:1 (Tide). A 320/390px, three-theme browser assertion enforces at least 4.5:1. |
| Unsynced account queue silently evicted, mixed permanent/retryable failures, and was invisible in History | Accept with one contract refinement | Queue outcomes are typed, capped at 20/account without eviction, permanent 4xx poison entries are removed while older entries continue, retryable entries remain account-scoped, and pending rows/records appear in History. On saturation the new result is explicitly reported unsaved rather than claimed as retained history. Unit and four-engine offline-history checks cover this. |
| Declared personal records were absent from the UI | Accept | History loads account-wide summary/partitioned records and renders a restrained records section. Pending results merge into totals and record comparisons without double counting the loaded server page. |
| Prompt focus surface was pointer-only | Accept | Native click activation focuses the capture input, so Enter/Space activation works as well as pointer-down. |
| Screen-reader mode/progress text was incomplete and completion left stale descriptions | Accept | Instructions now include mode and progress/remaining time; completion removes `aria-describedby` from the hidden capture field. |
| “Again” and “change test” were identical | Accept | Again restarts into typing; change test restarts and focuses the first configuration control. |
| Held Backspace could not repeat | Accept | Repeat remains ignored for normal keys but is allowed for Backspace; unit and browser regressions cover it. |
| Plausible corrupt local data could crash date formatting | Accept | Local result parsing now checks dates, supported modes, integer/range/counter invariants, metrics, and pace shape before History can render it. |
| Saved dark theme could flash Paper | Accept | A blocking same-origin bootstrap script applies the stored theme before first paint. A clean-image packaging bug found during verification was separately specialist-reviewed; the image now copies `public/` and Nginx fails exactly if the script is absent. |
| Export link could not show API failures | Accept | Export uses the typed client, reports inline failures/session expiry, and creates the download only after a successful response. |
| Component/E2E scenarios were incomplete | Accept in part | Browser coverage added repeated correction, native paste rejection, keyboard focus, change-test focus, dark-theme startup, mobile contrast, pending-history failure, personal records, and export. More isolated component tests for `AuthProvider`, `AccountDialog`, and `HistoryPage` remain useful but are not represented as completed. |

The visual reviewer found the design restrained, distinctive, editorial, and
manually composed rather than a generic card/gradient dashboard. Root inspection
of the final desktop/mobile history captures agreed; no visual blocker remains.

## Unverified recommendations

- Physical iOS/Android software-keyboard behavior.
- A manual pass with NVDA, JAWS, VoiceOver, or TalkBack.
- Maximum-shape export/load measurement and multi-instance rate limiting.
- A real external TLS ingress, production alerting stack, and off-host backup.
- Execution of the checked-in workflow on GitHub-hosted runners.
