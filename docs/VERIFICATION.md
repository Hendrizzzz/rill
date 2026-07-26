# Rill verification record

Date: 2026-07-26
Status: repository release scope verified within the available local environment

The host was native Windows PowerShell, not the expected WSL2 environment.
Long-running commands were announced and serialized. Production images use
Java 21 and Node 24.18 even though the host Maven process used Java 25.

## Clean-state builds and automated tests

The prior local Compose stack and only its `rill_rill-data` volume were removed
before the final run.

### Frontend

A clean `node:24.18.0-bookworm-slim` container copied only source/config files,
then ran:

```text
npm ci --ignore-scripts
npm audit --audit-level=high
npm run typecheck
npm run lint
npm run test:coverage
npm run build
```

Results:

- clean install/audit: 260 packages, 0 vulnerabilities;
- TypeScript and ESLint: pass, 0 warnings;
- Vitest: 9 files, 60 tests passed;
- coverage gates passed for API/queue and deterministic typing modules; total
  source coverage was 43.88% lines because rendered UI is intentionally covered
  primarily by Playwright rather than shallow unit tests;
- Vite production output after the result-shortcut and smooth-chart fixes:
  JavaScript 284.52 KiB raw / 90.08 KiB gzip; CSS 23.03 KiB raw /
  7.48 KiB gzip.

### Backend

```text
.\mvnw.cmd --batch-mode --no-transfer-progress clean verify
```

Result: `BUILD SUCCESS`; 21 tests passed, 0 failures/errors/skips. The suite used
PostgreSQL 18.4 through Testcontainers and includes migration, MockMvc,
authorization, validation, idempotency, retention, limiter, and concurrency
cases.

Host Java 25 emitted Maven/Mockito future-compatibility agent warnings. They did
not occur in the Java 21 production image build and were not suppressed.

## Browser and interaction evidence

Against the built Compose/Nginx/Spring/PostgreSQL application:

- latest full guest matrix: 52 passed, 4 account-only cases correctly skipped
  across Chromium, Firefox, WebKit, and mobile Chromium;
- pending account result with server failure: 4 passed, one per browser project;
- complete account lifecycle in Chromium/local profile: 1 passed;
- the same registration, save, summary/history, export, logout/login, and delete
  lifecycle in the exact `prod` + Secure-cookie Compose profile over loopback:
  1 passed;
- a transient Firefox browser-context shutdown protocol error occurred during a
  focused rerun; rerunning Firefox alone passed, and the subsequent full matrix
  passed with no failure;
- after the chart-axis refinement, focused production checks passed for pointer
  and keyboard inspection in all four browser projects, axe in all four
  projects, and tap-to-pin/tap-outside-dismiss in mobile Chromium;
- after the error-flow and tooltip-positioning fixes, 13 focused production
  checks passed across the four browser projects, with 3 touch-only cases
  intentionally skipped outside mobile Chromium;
- after correcting substitution glyph presentation and conditional
  previous-word reopening, the focused production regression passed in
  Chromium, Firefox, WebKit, and mobile Chromium (4 passed);
- result Enter restart and smooth-path pointer/keyboard exploration passed in
  all four browser projects (8 passed). The real-touch tooltip regression
  passed twice consecutively in development and twice against production.

The browser cases cover keyboard completion/restart, wrong character rendering,
repeated Backspace, native `InputEvent` paste rejection, prompt/config focus,
history persistence/navigation/direct loading, personal records, pending-sync
visibility, modal focus/Escape return, three-theme axe scans, 320px reflow,
mobile theme contrast, pre-paint dark-theme initialization, fixed prompt
coordinates within a visual row, whole-line paging/reset, and clean
extra-character reflow. It also covers continuous pointer chart
scrubbing, tooltip containment, one-tab-stop range semantics, and
Home/End/arrow-key point selection. A mobile-width test-coordinate regression
was reproduced and corrected to target the inset plot rather than its y-axis
gutter. A separate real-touch regression exposed a selected-only range state
without a committed sample; non-mouse pointer-up now commits the nearest
time-based sample, while pointer cancellation preserves vertical scrolling,
and tapping outside dismisses it. Page-error listeners remained empty.

The final error-flow regression distinguishes ordinary substitutions from true
extras. A substitution retains the intended target glyph and its original
advance, marks it with the error color, and never renders the incorrect key.
The test measures every target glyph, its hidden sizing glyph, and adjacent
edges; extras then render the actually typed glyphs, reserve inline space, move
or wrap later words without overlap, keep the caret after the last extra, and
collapse back to the post-substitution layout after Backspace.
At an empty word boundary, the same regression proves one Backspace reopens an
imperfect previous word without deleting its final glyph, while an exactly
aligned previous word stays locked. Reducer cases cover substitution, missing,
and extra forms and prove that reopening reverses only provisional missing and
separator state while retaining historical attempt counters.
Tooltip containment is checked on both viewport axes. A WPM-scale unit case
proves `0/20/40/60/80` ticks for a 72-WPM peak.
The pace line is a dependency-free, shape-preserving monotone cubic path. It
passes through each measured sample while keeping every Bézier control point
inside its adjacent values, so the visual cannot invent an unmeasured peak or
dip. Hover, touch, and keyboard details remain anchored to actual samples.

Final visual captures:

- `artifacts/visual/final-history-desktop.png` (1440×900);
- `artifacts/visual/final-history-mobile.png` (390×844);
- `frontend/output/playwright/prompt-proportional-desktop.png` (1440×900);
- `frontend/output/playwright/prompt-extra-flow-desktop.png` (1440×900);
- `frontend/output/playwright/pace-tooltip-desktop.png` (1440×900);
- `frontend/output/playwright/pace-tooltip-mobile.png` (390×844);
- `output/playwright/prompt-target-errors-desktop.png` (1440×900);
- `output/playwright/prompt-reopened-error-desktop.png` (1440×900);
- `output/playwright/prompt-reopened-error-mobile.png` (390×844);
- `output/playwright/pace-smooth-curve-desktop.png` (1440×900);
- `output/playwright/pace-smooth-curve-mobile.png` (390×844).

These are local, gitignored verification artifacts. All eleven were visually
inspected. Earlier inspection also covered the typing,
active, completion, account-dialog, Nocturne, and narrow/landscape states.

## Deployment and security evidence

```text
docker compose --env-file .env.example up --build --detach --wait
```

From an empty volume, PostgreSQL initialized, Flyway migrated, the permission
gate completed, and database/backend/web became healthy. Runtime checks showed:

- `rill_migrator`: not superuser, cannot create databases/roles;
- `rill_app`: cannot create schema objects, can DML application tables, cannot
  DML `flyway_schema_history`;
- one migration, zero users, and zero results after the destructive E2E account
  cleanup;
- backend user `rill`, web user `101`, read-only roots, `privileged=false`,
  all capabilities dropped, `no-new-privileges=true`;
- `/theme-init.js`: HTTP 200, JavaScript MIME type, correct body in the final
  image;
- stopping PostgreSQL caused readiness to return HTTP 503; restarting restored
  every service to healthy;
- document CSP/cache/COOP/CORP/permissions/referrer/HSTS/nosniff/frame headers
  were present;
- hostile `Origin` received no `Access-Control-Allow-Origin`;
- the four overlapping API headers each appeared exactly once.

The first readiness polling harness timed out because each failed DB health
probe waited for the configured connection timeout. A corrected single probe
returned 503, and the database was restored successfully.

The final two-minute container log scan found 0 `ERROR`, `FATAL`, exception, or
traceback matches.

### Dependency and source checks

```text
.\mvnw.cmd ... org.owasp:dependency-check-maven:12.2.2:check \
  -DfailBuildOnCVSS=0
```

Result: build success, 0 vulnerable dependencies, 0 vulnerabilities, and 0
suppressed findings using the cached/current NVD and CISA KEV data. Sonatype
OSS Index could not run without credentials, so this is not a claim of complete
supply-chain coverage.

The final high-confidence credential/private-key scan and focused
debug/TODO/dangerous-sink scan each returned 0 matches. Compose interpolation
validated successfully. No gitleaks or container-image scanner was available.

### Backup/restore

A custom-format dump was created by `rill_migrator`, restored into the explicit
disposable `rill_restore_check` database created by `postgres`, and queried:

```text
migrations:1
users:0
results:0
```

The disposable database and `/tmp/rill-final-backup.dump` were then removed.

## Performance evidence

Latest local production-Edge synthetic prompt measurement (not a load test):

- 180 synthetic `beforeinput`-to-next-frame samples after fonts loaded: median
  8.3 ms, p95 8.6 ms, max 8.9 ms;
- no long task above 50 ms during the isolated measured sequence;
- local navigation response start 3.3 ms and load/DOMContentLoaded 77.4 ms;
- reduced-motion matched and left 0 active animations;
- eight inspected viewport shapes had no horizontal overflow.

These measurements are useful regression evidence, not guarantees for other
hardware, networks, assistive technology, or production traffic.

## Not executed or externally dependent

- The GitHub Actions workflow was expanded and locally inspected but was not
  executed on GitHub.
- No physical mobile software keyboard or real screen reader was available.
- No public deployment, TLS certificate, DNS, firewall, registry, or off-host
  monitoring/backup was configured.
- No multi-user backend load test or worst-case 1,000-result export benchmark
  was run.
- UI modules remain lightly covered by Vitest; the behavior is exercised through
  the production Playwright matrix instead.
