# TypeThock implementation and verification plan

Status: implementation, hardening, and local verification complete
Last updated: 2026-07-26

## Delivery principles

- Build one complete vertical slice at a time.
- Keep typing-domain rules pure and tested before styling.
- Use the fewest dependencies that materially improve correctness.
- Never make account/API availability a prerequisite for guest typing.
- Run only one long-running build or test command at a time.
- Record meaningful plan changes in this document.

## Milestone 0 — repository and contracts

- Initialise Git and add ignore/editor/environment examples.
- Add Maven wrapper and Spring Boot module.
- Add Vite/React/TypeScript frontend with a committed npm lockfile.
- Add CI skeleton and root run/verification documentation.
- Encode result formulas, DTO constraints, API shapes, and design/security assumptions.

Proof gate:

- Backend application context starts with the test profile.
- Frontend strict typecheck and one smoke test pass.

## Milestone 1 — typing engine and guest product

- Seeded prompt generator with word/time modes and punctuation/number modifiers.
- Native `beforeinput`/composition adapter, pure typing reducer, deadline-first monotonic timing controller, pace buckets, score calculator, and shortcut/focus behavior following `docs/product/TYPING_CONTRACT.md`.
- Guest preference/history storage with schema versioning and corruption fallback.
- Test route, completion state, and core responsive visual system.
- Unit tests for state transitions, scoring, timing boundaries, prompt determinism, and storage.

Proof gate:

- Table-driven tests cover ready/running/completed/restart, correct/incorrect/extra/backspace/space/final-word/time-expiry cases.
- Browser guest flow completes via keyboard with no request/storage write per keystroke.
- Input adapter tests cover insert/delete/composition/rejected paste/replacement, and the accessible current target remains available.

## Milestone 2A — PostgreSQL schema and result contract

- Flyway schema for users, session hashes, results, idempotency, constraints/indexes, and production role grants.
- PostgreSQL Testcontainers migration, constraint, pagination, and concurrent-idempotency tests.
- Result create/history/summary with the exact bounded contract in `docs/architecture/API_CONTRACT.md`.

Proof gate:

- Real PostgreSQL migrations apply from empty state.
- Duplicate identical client ids return the original result; conflicting reuse is rejected.
- Formula, pace-bucket, quota/retention, cursor, and ownership tests pass.

## Milestone 2B — identity and session boundary

- Registration/login/logout/current-session endpoints.
- Opaque persistent sessions, explicit cookie policy, double-submit CSRF, exact development CORS, validation, problem responses, and layered auth rate limiting.
- BCrypt byte-limit and dummy-hash behavior.
- Ten-session limit plus expired-session cleanup.

Proof gate:

- Missing and mismatched CSRF is rejected on every mutation, including login/register; bootstrap, clearing, and post-logout rebootstrap behavior pass.
- Unauthenticated and cross-owner access is rejected.
- Raw passwords/session tokens do not appear in persistence, responses, or captured logs.

## Milestone 2C — account lifecycle and operational bounds

- Account export and password-confirmed deletion.
- 1,000-result rolling retention, bounded and rate-limited export, separate
  result-request/result-creation controls, and cleanup.
- Service, repository, MockMvc, security-negative, and production-configuration tests.

Proof gate:

- Export schema is versioned/bounded; deletion cascades all account data and clears cookies.
- Production rejects disabled Secure cookies and unsafe CORS.

## Milestone 3 — account/history integration

- Central same-origin API client with timeout, CSRF bootstrap, typed problems, and no dynamic destinations.
- Auth dialog and session state.
- Post-completion account save, idempotency, explicit local/account save states, and bounded unsynced queue.
- History/records route with accessible chart/table/mobile rows.
- Export and deletion UI.
- Frontend integration tests and backend-failure states.

Proof gate:

- Registration → typed test → stored result → history → export → logout works.
- API failure never blocks test completion/restart and reports unsynced status.
- No session credential enters local/session storage.
- Component/integration cases cover storage corruption/unavailability/quota, expired session during save, CSRF bootstrap failure, pagination retry, export/delete failure, queue saturation, and account switching.

## Milestone 4 — production packaging and hardening

- Nginx and backend container files plus Compose PostgreSQL deployment with a one-shot Flyway migration service and separate runtime database role.
- Production configuration validation, health checks, non-root containers where supported, graceful shutdown, log hygiene, and migration-job/app-start ordering.
- CI for backend verify, frontend lint/typecheck/unit/build, Playwright, audits, and container build.
- Operations, maintenance, backup/restore, deployment, and security documentation.
- Dependency audit, dangerous-pattern/secret scan, HTTP header checks, and bundle report.

Proof gate:

- Clean deterministic installs/builds pass.
- Runtime sends intended cookie and security headers.
- Dependency findings are evaluated, not auto-suppressed.
- A disposable Compose database backup and restore drill succeeds, or the exact environmental blocker is recorded.

## Milestone 5 — rendered QA and final review

- Playwright in Chromium, Firefox, and WebKit for core keyboard flows; primary screenshots at 1536×864 and 390×844 plus inspection at 1920×1080, 1440×900, 1365×768, 1024×768, 320×568, and 844×390 when practical.
- Keyboard, focus, reduced-motion, contrast, semantic, and axe checks.
- Console/network/storage inspection, API-offline behavior, layout overflow, 200% reflow, short/dynamic viewport behavior, and mobile software-input strategy review.
- A physical iOS/Android keyboard and real screen-reader pass are desired evidence; if unavailable they are explicitly reported as unverified rather than simulated by viewport resizing.
- Engine benchmark and production bundle-size evidence.
- Two independent final specialist reviews, one backend/security/data focused and one frontend/interaction/accessibility focused.
- Root-agent reproduction/evaluation of every finding, focused fixes, relevant regression tests, and clean-state rerun.

Proof gate:

- Agreed release scope is implemented with no known blocker.
- All executed checks and limitations are documented with exact commands/results.

## Planned commands

Commands may be adjusted to the generated wrappers/scripts, with changes recorded.

```text
backend/mvnw.cmd -f backend/pom.xml verify
npm ci --prefix frontend
npm run lint --prefix frontend
npm run typecheck --prefix frontend
npm run test:run --prefix frontend
npm run build --prefix frontend
npm run test:e2e --prefix frontend
npm audit --prefix frontend --audit-level=high
backend/mvnw.cmd -f backend/pom.xml org.owasp:dependency-check-maven:check
docker compose build
docker compose up --wait
```

The OWASP dependency check may depend on an external vulnerability feed and can be slow/rate-limited; any environmental failure will be reported rather than presented as a clean scan.

## Performance evidence plan

- Confirm the keystroke handler has no fetch/storage writes and constant-time domain updates for the active word.
- Run a small deterministic reducer benchmark outside the unit-test gate and report hardware/runtime plus distribution, not a marketing adjective.
- Record Vite production output and gzip sizes; investigate an initial JS chunk over 200 KiB gzip.
- Use browser performance entries during a synthetic typing run to inspect long tasks and visible dropped interaction; disclose that this is local, not a production load test.
- Backend load benchmarking is optional for release 1 because normal traffic is one result request per completed test; correctness, payload bounds, and rate limiting have higher value.

## Initial commit plan

Commits are only created if the user’s repository workflow permits it. Intended logical slices:

1. `chore: establish typethock project contracts and toolchains`
2. `feat: add deterministic guest typing experience`
3. `feat: add secure accounts and result persistence`
4. `feat: integrate history and account lifecycle`
5. `chore: harden deployment and verification`

## Plan change log

- 2026-07-26: selected a modular monolith and same-origin reverse proxy instead of microservices or a server-rendered frontend. The domain needs one deployable API and a latency-sensitive local interaction; additional services/SSR add no user value.
- 2026-07-26: selected opaque database-backed sessions instead of browser-stored JWTs. Revocation, logout, and reduced XSS exposure are more valuable than statelessness for this application.
- 2026-07-26: made guest/offline-degraded typing a release requirement. Backend reliability should not interrupt the keystroke-critical loop.
- 2026-07-26: deferred public leaderboards and anti-cheat. The server can validate formulas and bounds but cannot prove physical typing from a client report without a materially larger protocol and product scope.
- 2026-07-26: accepted the independent plan reviews’ contract findings. Added a normative input/scoring contract, deadline-first semantics, current-word accessibility, account-scoped queues, idempotency fields/conflict behavior, PostgreSQL Testcontainers, explicit cookie/CSRF rules, bounded data/session lifecycles, external TLS topology, and split backend milestones.
- 2026-07-26: retained BCrypt rather than adding Argon2, but constrained passwords to 72 UTF-8 bytes, uses algorithm-prefixed 255-character storage, strength 12, and a dummy verification path. This is simpler and avoids BCrypt truncation ambiguity.
- 2026-07-26: did not require CSRF rotation after login. The selected double-submit token is not an auth credential and login itself is protected; logout/deletion clears it and bootstrap reissues it.
- 2026-07-26: upgraded the frontend directly from React Router 7.11 to
  React Router 8.3 after two independent advisory reviews. The current v8
  release clears the known advisory set, preserves the declarative APIs used by
  TypeThock, and requires a Node 22.22 minimum; production and CI use Node 24.18.
- 2026-07-26: final review lowered default account retention from 10,000 to
  1,000. A 64-KiB result body made the original worst-case export too expensive;
  summary now uses aggregate/record queries and export is separately rate
  limited.
- 2026-07-26: final review split PostgreSQL bootstrap administration, Flyway
  ownership, and runtime DML into three roles. A post-migration gate revokes
  runtime access to Flyway history before application startup.
