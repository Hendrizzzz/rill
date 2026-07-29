# Rill verification record

## Authoritative release verification

Last reconciled: 2026-07-30 (Asia/Manila)

Source binding: this record applies to the source in the same Git commit.
Provider-specific deployed commits and live observations are identified in the
dated deployment sections. The 2026-07-28 local matrix remains historical
baseline evidence; the 2026-07-30 sections contain the current deployment and
post-review delta evidence.

### Verified baseline gates

- Frontend: `npm run typecheck` and `npm run lint` passed with zero warnings;
  `npm run test:run` passed 229 tests in 15 files; `npm run build` transformed
  101 modules and produced 355.20 kB JavaScript (106.15 kB gzip) and 26.99 kB
  CSS (6.33 kB gzip).
- `npm run test:code-corpus` validated all 512 generated drills structurally.
  JavaScript passed 64/64 parse checks and 33 behavior cases; TypeScript passed
  64/64 strict semantic checks and the same 33 behavior cases; Python 3 passed
  64/64 compile checks; Java passed 64/64 compile checks in a standard-library
  wrapper. C, C++, C#, and Go were explicitly skipped because usable local
  compiler/SDK toolchains were unavailable.
- Backend: `.\mvnw.cmd --batch-mode --no-transfer-progress clean verify`
  returned `BUILD SUCCESS`; 40 tests passed with zero
  failures/errors/skips against PostgreSQL 18.4 through Testcontainers and
  Flyway V1-V7. Both an empty schema and a populated V1-to-V7 upgrade path
  completed. All eight code-language enums round-tripped through the API. A
  diagnostic compile with `-Dmaven.compiler.showDeprecation=true` identified
  two deprecated Jackson test calls; they were replaced, and the final
  diagnostic clean verify emitted no source deprecation warning. Remaining
  Java 25 notices come from Maven Guice and Mockito/Byte Buddy test tooling.
- Production browser matrix:
  `npx playwright test e2e/typing.spec.ts e2e/typing-behavior.spec.ts
  --workers=1 --reporter=line` against the isolated
  `http://127.0.0.1:4173` preview ran 148 cases across Chromium, Firefox,
  WebKit, and mobile Chromium: 138 passed, 10 capability-specific skips, zero
  failed.
  The skips are the disabled live-account lifecycle (four projects),
  touch-only coverage outside mobile Chromium (three), and Chromium-only
  forced-colors coverage (three).
- Code-mode browser coverage includes language switching, literal-space
  geometry, visible whitespace errors, Enter-only line progression, final-line
  completion, editor-like token deletion, screen-reader indentation text,
  internal horizontal caret following at 320 px, result/history persistence,
  four viewport sizes, and axe analysis.
- `npm audit --audit-level=high` reported zero vulnerabilities. `git diff
  --check` found no whitespace errors. A focused debug/private-key/TODO scan
  found no source matches; explanatory verification prose was the only TODO
  text match.

### Current performance and interaction evidence

An independent frontend reviewer ran a bounded headless-Chromium code-mode
smoke at 320 by 568 pixels over a 322-character Python drill. Its 311
before-input-to-next-frame samples measured 7.5 ms median, 14.0 ms p95, and
14.9 ms maximum, with zero long tasks, zero keystroke network requests, and no
document-level horizontal overflow. This is a single local synthetic run, not
a low-end-device or production latency benchmark.

No Computer Use automation was used. Playwright/browser automation exercised
the isolated preview; existing Compose services and other Codex sessions were
not stopped, restarted, or reconfigured. Temporary PostgreSQL Testcontainers
were automatically removed after the Maven processes exited.

### Current claim limits

- The local Node runtime was `v22.20.0`, below the repository's supported
  `>=22.22.0` floor. All stated local frontend commands passed, and CI is pinned
  to Node 24.18. Later commit-specific GitHub Actions results supersede the
  baseline's then-unverified workflow state.
- C, C++, C#, and Go snippets received static review but no local compiler
  execution. C++ signed/unsigned warnings identified by independent review were
  fixed, but only a CI/host with working toolchains can close these skips.
- There are 16 distinct algorithm patterns, four intentionally repeated
  function-name drills per language, and eight languages: 512 drills, not 512
  distinct algorithms.
- History/export retain the code language and statistics, not the exact
  exercise ID; per-algorithm progression is deferred.
- No physical mobile keyboard, real screen reader, low-end-device benchmark,
  public Vercel deployment, off-host restore, distributed rate limiter, or
  multi-user load test was available. The Render API has since been verified
  over public TLS as recorded below.
- The earlier pinned-Monkeytype 10,000-trace parity campaign and broader
  Dependency-Check/Compose security evidence remain recorded below but were not
  rerun for this code-learning increment.
- Commit, push, CI, and provider claims are made only where a dated section
  records the exact source or run. Vercel is explicitly excluded until its
  account-controlled two-factor challenge is completed.

Historical release run date: 2026-07-26

Historical reconciliation date: 2026-07-27

Status: historical release evidence plus a conservative current-worktree audit

Git staging was attempted after the final command rerun but the managed
workspace denied creation of `.git/index.lock`; no final commit is claimed. The
tested application/source/spec state is bound to base commit `528e07f…` plus
source snapshot SHA-256
`3793a78ddd60218686469d3d42ee5f2e372b7f67891a5d90cc447760f74db1bd`.

The 2026-07-26 sections below are date-bounded historical evidence. They do not
automatically prove the later worktree. Their historical reconciliation is the
[final parity reconciliation](testing/evidence/20260726T190914Z-final-mixed-8b4dce69/run.md):
312 rows, 37 `PASS`, 258 `BLOCKED`, 16 `N/A`, and one intentional `DIFF`.

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
- Vitest: 9 files, 65 tests passed;
- coverage gates passed for API/queue and deterministic typing modules; total
  source coverage was 43.88% lines because rendered UI is intentionally covered
  primarily by Playwright rather than shallow unit tests;
- Latest Vite production output after the Monkeytype parity work:
  JavaScript 288.90 KiB raw / 91.29 KiB gzip; CSS 24.52 KiB raw /
  7.77 KiB gzip.

### Backend

```text
.\mvnw.cmd --batch-mode --no-transfer-progress clean verify
```

Result: `BUILD SUCCESS`; 22 tests passed, 0 failures/errors/skips. The suite used
PostgreSQL 18.4 through Testcontainers and includes migration, MockMvc,
authorization, validation, idempotency, retention, limiter, and concurrency
cases.

Host Java 25 emitted Maven/Mockito future-compatibility agent warnings. They did
not occur in the Java 21 production image build and were not suppressed.

### Monkeytype-parity patch recheck

After the scoring/graph changes and specialist audit fixes, the native host ran:

```text
npm run typecheck
npm run lint
npm test -- --run
npm run build
.\mvnw.cmd test
```

Results: typecheck/lint/build passed; Vitest passed 72 tests in 10 files; Maven
passed 27 tests with zero failures/errors/skips. Testcontainers created clean
PostgreSQL 18.4 database, validated and applied Flyway V1–V3, and exercised the
corrected-input constraint, legacy-graph fallback, and JavaScript-compatible
half-burst rounding. A separate upgrade fixture populated V1 with a legacy
counter combination before migrating through V3, proving the new constraint
does not block existing rows.

## Browser and interaction evidence

Against the built Compose/Nginx/Spring/PostgreSQL application:

- latest full guest matrix: 61 passed, 7 project-specific/account cases
  correctly skipped
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
- exploratory Browser comparisons against Monkeytype covered perfect,
  substitution, corrected, missed, and extra-character interaction shapes,
  but the sites used different generated prompts and independently sampled
  timestamps. Those observations are not controlled metric-parity evidence and
  are recorded as such in the campaign ledger. Timing boundary behavior is
  instead checked by executing the relevant functions extracted from the
  pinned Monkeytype source checkout;
- the former tiny-tail 500-WPM point is omitted using the reference's rounded
  half-second graph cutoff (494.99ms omitted, 495ms retained). Rill deliberately
  preserves a full bucket at the reference's lossy 1.995s rollover and records
  that intentional difference. Pointer inspection showed a contained tooltip, visible
  WPM/error axes, and all WPM/raw/burst/error series. Browser console inspection
  reported no warnings or errors;
- a focused Chromium Playwright rerun passed four chart/history cases after an
  initial run exposed and corrected three stale test defects: a strict locator
  that now matched three paths, an ambiguous `100%` assertion, and an API route
  glob that also intercepted Vite's `/src/api/` modules.

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
and extra forms and prove that reopening reverses provisional missing and
separator state, counts removal of an incorrect separator as a correction, and
retains historical attempt counters.
Tooltip containment is checked on both viewport axes. A WPM-scale unit case
proves `0/20/40/60/80` ticks for a 72-WPM peak.
The pace line is a dependency-free, shape-preserving monotone cubic path. It
passes through each measured sample while keeping every Bézier control point
inside its adjacent values, so the visual cannot invent an unmeasured peak or
dip. Hover, touch, and keyboard details remain anchored to actual samples.

Historical visual captures (useful inspection artifacts, not proof of the
current final revision):

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
- `output/playwright/pace-smooth-curve-mobile.png` (390×844);
- `frontend/output/playwright/pace-terminal-window-desktop.png` (1280×1120).

These are local, gitignored verification artifacts. All twelve were visually
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
- three migrations, zero users, and zero results after the destructive E2E account
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

The later parity release also rebuilt the live stack over an existing V2
database. Flyway validated three migrations and applied V3 successfully; the
database, backend, and web containers became healthy, and the public health
endpoint returned HTTP 200 with `status: UP`.

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

## 2026-07-27 exhaustive parity campaign

The current campaign is recorded row by row in
[`testing/MONKEYTYPE_PARITY_LEDGER.md`](testing/MONKEYTYPE_PARITY_LEDGER.md).
Its current evidence bundle is
[`testing/evidence/20260726T190914Z-final-mixed-8b4dce69/run.md`](testing/evidence/20260726T190914Z-final-mixed-8b4dce69/run.md).

The reconciled 312-row disposition is 37 `PASS`, 258 `BLOCKED`, 16 `N/A`, and
one `DIFF`, with no unreviewed row. The one difference is deliberate: at raw
1995 ms, pinned Monkeytype source drops the normalized 2000 ms timer boundary,
while Rill retains it. This is regression-tested and disclosed as `TM-023`.

The blocked rows include exact cross-site trace replay, final-revision
Playwright and performance execution, PostgreSQL/Testcontainers integration,
physical mobile input, named screen readers, supported-Node reruns, and current
OWASP data refresh. This campaign therefore does not claim that all edge cases
ran or that Rill and Monkeytype are numerically identical.

Latest completed commands:

```text
npm run lint
# exit 0, zero warnings

npm run typecheck
# exit 0

npm test -- --run
# 12 files, 115 tests passed

npm run build
# exit 0; Vite 8.1.5 production build

npm run test:coverage
# 12 files, 115 tests passed; configured thresholds passed

npm run audit:monkeytype-timing
# 7/7 timing vectors matched pinned source commit 7feea96…

.\mvnw.cmd --batch-mode --no-transfer-progress package "-Dmaven.test.skip=true"
# BUILD SUCCESS; executable jar built; tests skipped

npm audit --audit-level=high
# 0 vulnerabilities
```

The host Node was 22.20.0, below the declared 22.22.0 floor. Downloading the
supported Node runtime failed, so the final 115-test suite was not rerun on the
supported runtime. A prior-revision Node 24 run remains historical only.

The final Playwright command reported 96 failures before any test body because
the browser process could not spawn (`EPERM`). The performance script was
blocked by the same launch restriction. Testcontainers compiled but could not
access `\\.\pipe\docker_engine`; OWASP Dependency-Check could not establish
the loopback connection needed for its updater. None of those attempts is
represented as a product failure or a passing current check.

The backend wrapper package succeeded, but `mvn clean` could not delete the
existing `backend/target` through the managed sandbox. A current clean-state
backend build is therefore also not claimed.

Trusted in-app Browser checks completed against port 8080, but a final
reinspection proved that URL served an older bundle. Browser policy then
rejected navigation to the isolated final-build preview. Those interactions are
retained as exploratory evidence only; no final-worktree browser row is marked
pass. Live Monkeytype `v26.28.0` was inspected, but an identical
prompt/event/timestamp trace was not captured across both products.

Full commands, current evidence, historical boundaries, limitations, and
specialist adjudications are in the current campaign bundle.

## 2026-07-28 IDE-style code editor verification

This increment makes leading code indentation structural rather than typed:
authored two-space template levels are emitted as four-space levels, the caret
starts after that indentation, and the synthetic spaces do not enter input
events, attempts, WPM, raw pace, accuracy, or graph buckets. Internal spaces
remain ordinary scored input. The corpus identity is `code-v2`.

The editor presentation was informed by a live inspection of LeetCode's code
surface (fixed-width type, quiet gutter, restrained syntax hierarchy, strong
cursor, and compact metadata). Rill retains its own typography, palette,
layout, components, copy, source, and assets.

Completed commands from `frontend/`:

```text
npm.cmd run test:code-corpus
# exit 0
# JavaScript: 64/64 parsed; 33 behavior cases passed
# TypeScript: 64/64 strict semantic checks; 33 behavior cases passed
# Python 3: 64/64 compiled
# Java: 64/64 compiled in a java.util wrapper
# C, C++, C#, and Go skipped because those host toolchains were unavailable

npm.cmd run test:run
# 18 files, 247 tests passed

npm.cmd run typecheck
# exit 0

npm.cmd run lint
# exit 0, zero warnings

npm.cmd run build
# exit 0; Vite 8.1.5 production build, 103 modules transformed

npm.cmd audit --omit=dev
# 0 vulnerabilities reported

$env:E2E_BASE_URL='http://127.0.0.1:4174'; npm.cmd run test:e2e
# 138 passed, 10 capability/environment skips, 0 failed (2.2 minutes)
# Chromium, Firefox, WebKit, and mobile Chromium

$env:PERF_BASE_URL='http://127.0.0.1:4174'; npm.cmd run test:perf
# input-to-frame p50 7.1 ms, p95 15.5 ms, max 15.6 ms
# max event duration 24 ms; 0 long tasks, keystroke requests, runtime errors,
# CSP violations, and document-overflow findings

$env:PERF_MODE='code'; npm.cmd run test:perf
# 215-character Python drill, 208 measured beforeinput frames
# input-to-frame p50 7.3 ms, p95 14.7 ms, max 15.4 ms
# max event duration 32 ms; 0 long tasks, keystroke requests, runtime errors,
# CSP violations, and document-overflow findings

.\mvnw.cmd --batch-mode --no-transfer-progress package -DskipTests
# BUILD SUCCESS; 38 main and 4 test sources compiled, executable jar packaged
# tests explicitly skipped to avoid starting or changing the user's Docker stack
```

The ten Playwright skips are expected guards: touch-only exploration does not
run in the three desktop projects; forced-colors coverage runs only where the
engine exposes that capability; and the four account lifecycle variants
require the opt-in account E2E environment. The guest persistence path and
signed-in-unavailable fallback still ran.

Manual browser checks on the isolated production preview verified direct typing
at four- and eight-space structural levels, Ctrl+Backspace without indentation
loss, fixed 16 px prompt type, internal horizontal containment on narrow
screens, no document overflow, and active-line/caret visibility at 1920, 1440,
1024, 768, 390, and 320 CSS pixels. The browser console contained no errors or
warnings.

Two bugs were found during this verification rather than hidden:

- Chromium, Firefox, and WebKit rendered literal indentation whitespace at an
  unreliable width. The editor now gives the structural spacer an explicit
  `indent-columns * 1ch` width; the cross-engine geometry regression passes.
- The initial paper-theme code metadata color measured about 4.02:1 in the axe
  run. The semantic token was darkened and the full accessibility/browser
  matrix then passed.
- A final visual audit measured the paper error color at 4.4917:1. It was
  darkened to `#b23832` (about 4.764:1 on the code surface), and active error
  contrast plus axe now run in every theme.
- A wide-to-narrow WebKit run sampled before asynchronous resize alignment.
  The editor already observes both element and visual-viewport resize; the
  regression now waits for the complete visibility condition and passes in all
  four projects.
- Stored pre-field account queues were filtered by the new corpus-version
  validator. Missing versions now migrate by dimension (`code` becomes
  `code-v1`), explicit invalid versions remain rejected, and delayed `code-v1`
  payloads retain that identity through the API.
- Results now persist `wordListVersion` as their corpus/scoring contract. V8
  backfills historical rows and personal-record keys include the version, so
  `code-v1` and `code-v2` cannot compete.

Both ordinary words and the code-mode syntax layer were measured on the local
Chromium production preview. These are synthetic local smoke measurements, not
production latency guarantees or a concurrent-user load test. Physical mobile
keyboards and real screen readers remain unverified. The V8 migration and new
backend API integration assertions compiled but were not executed against
PostgreSQL because this run deliberately did not start or alter the user's
Docker services.

## 2026-07-30 zero-cost deployment preparation

The repository now contains a Render Blueprint for the Spring Boot API, a
Vercel project configuration for the Vite frontend and same-origin API rewrite,
and a Neon/Render/Vercel operator runbook. Git-triggered provider deployments
are disabled so the backend can be released and verified before the frontend.
Render startup requires certificate/hostname-verified PostgreSQL TLS with
channel binding and the JVM trust store, uses separate Flyway and runtime
credentials, and retains at most 100 results per account.

Completed checks:

```text
.\mvnw.cmd '-Dtest=DeploymentManifestTest,ProductionSafetyConfigurationTest,SecurityConfigurationTest' test
# 6 tests passed; BUILD SUCCESS

npm.cmd run typecheck
# exit 0

npm.cmd run lint
# exit 0

npm.cmd run test:run
# 18 files, 247 tests passed

npm.cmd run build
# Vite 8.1.5, 103 modules; 361.00 kB JS (107.87 kB gzip);
# 30.90 kB CSS (7.13 kB gzip)

npm.cmd audit
# 0 vulnerabilities

.\mvnw.cmd package -DskipTests
# BUILD SUCCESS

.\mvnw.cmd org.owasp:dependency-check-maven:12.2.2:check
# BUILD SUCCESS; report contained 49 dependencies and 0 identified
# vulnerabilities. OSS Index was disabled and no NVD API key was configured.

$env:E2E_BASE_URL='http://127.0.0.1:4174'; npm.cmd run test:e2e -- --project=chromium
# 35 passed, 2 expected capability/account skips, 0 failed
```

The browser run used an isolated production preview on port 4174. Its exact
process was stopped afterward and the port was confirmed released. Port 4173,
Docker, and the user's other running sessions were not changed.

Neon and Render have since accepted the production database and API
configuration. The Vercel project and public same-origin browser checks remain
blocked by the account's two-factor authentication gate. The provider evidence
and exact remaining boundary are recorded below.

## 2026-07-30 subsecond scoring and persistence boundary

Rill now keeps Monkeytype-compatible statistics for word tests that complete
in less than one second, including the canonical 1ms fallback, while marking
those results `too short · not saved`. They do not enter guest history, account
API traffic, or the offline retry queue. Results become persistable at 1,000ms
and remain on the 10ms duration grid.

Flyway V9 removes only pre-release word-mode rows below that boundary before
installing a validated database constraint. This prevents an upgrade failure
from the older 250ms policy and avoids retaining inflated legacy records.

Completed local checks:

```text
npm.cmd run test:coverage
# 18 files, 248 tests passed
# statements 73.32%, branches 67.79%, functions 64.91%, lines 73.43%

npm.cmd run test:code-corpus
# JavaScript 64/64 parsed and TypeScript 64/64 strictly validated;
# Python 64/64 and Java 64/64 compiled; C, C++, C#, and Go were skipped
# because their local toolchains were unavailable

npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
# all exit 0; Vite 8.1.5 built 103 modules

$env:MONKEYTYPE_SOURCE_ROOT='C:\Users\hendrizzzz\AppData\Local\Temp\rill-monkeytype-audit'
npm.cmd run test:parity:oracle
# pinned commit 7feea96c5df21a59af9553fa7c52eb33af5997b8; 1/1 passed

$env:RILL_PARITY_RUNS='10000'
npm.cmd run test:parity:campaign
# 5/5 campaign checks passed; 10,000 traces executed

$env:CI='true'
npx.cmd playwright test
# 142 passed, 10 expected capability/account skips, 0 failed in 6.9 minutes
# Chromium, Firefox, WebKit, and mobile Chromium

.\mvnw.cmd '-Dtest=RillPrincipalResolverTest,DeploymentManifestTest,ProductionSafetyConfigurationTest,SecurityConfigurationTest' test
# 8 tests passed; BUILD SUCCESS

.\mvnw.cmd -DskipTests package
# executable Spring Boot jar packaged; BUILD SUCCESS
```

The full browser suite started and stopped its own port 5173 server. Port 4173
remained owned by the user's existing process, and Docker was not started,
stopped, or used. PostgreSQL-backed API and Flyway upgrade tests compiled but
are left to the clean GitHub Actions container job. The local Node runtime was
22.20.0, below the repository's 22.22.0 floor; the definitive frontend CI job
uses Node 24.

## 2026-07-30 live Neon and Render verification

The free Neon project is in Singapore and uses a direct owner connection for
Flyway plus a pooled `rill_app` connection for ordinary runtime access. The
runtime role was checked after its password rotation:

```text
rolcanlogin = true
password_disabled = false
rolsuper = false
rolcreaterole = false
rolcreatedb = false
rolreplication = false
rolbypassrls = false
neon_superuser = false
```

Render accepted the free Blueprint and created
`https://rill-typewriting-api.onrender.com`. The first live startup reproduced
a pgJDBC portability defect:

```text
Could not open SSL root certificate file /app/.postgresql/root.crt
```

Two independent deployment/security reviewers traced that to pgJDBC 42.7.13's
default `LibPQFactory`. Both recommended
`org.postgresql.ssl.DefaultJavaSSLFactory` for the runtime and Flyway URLs,
while retaining `sslmode=verify-full` and `channelBinding=require`. Both also
identified that the original presence-only regex validator accepted duplicate
security parameters even though pgJDBC uses the last value. That finding was
accepted after reproducing the driver's behavior. The validator now requires
exactly one correctly cased value for each protected parameter and rejects
duplicate insecure overrides.

Focused verification used an isolated backend copy because another local
session held the shared `backend/target` directory:

```text
.\mvnw.cmd '-Dtest=ProductionSafetyConfigurationTest,DeploymentManifestTest' test
# 6 tests passed; 0 failures; BUILD SUCCESS
```

Render deployed commit `85a07354f2cb422129bc3ce2cbe3cd2650b993e9`.
Its container log reported `Started RillApplication in 145.099 seconds` on the
free instance and then `Your service is live`. This is a cold deployment
startup observation, not an application-request benchmark. The deployed
readiness endpoint returned:

```text
HTTP/1.1 200 OK
Content-Type: application/vnd.spring-boot.actuator.v3+json
Cache-Control: no-cache, no-store, max-age=0, must-revalidate

{"status":"UP"}
```

Direct public-API smoke tests against Render used randomly generated
disposable accounts and deleted them in the same scripts:

```text
session bootstrap       200
registration            201
Secure HttpOnly session cookie confirmed
Secure CSRF cookie confirmed
account export          200, schemaVersion 1
account deletion        204
post-delete session     200, authenticated false

result creation         201
history read            200, matching client result id
summary read            200, one retained run
export                  200, one result
account deletion        204

missing-CSRF register   403
invalid register body   400, VALIDATION_FAILED
untrusted Origin GET    200, no Access-Control-Allow-Origin header
```

After Flyway completed, the Neon owner revoked runtime access to migration
metadata. The verification query returned:

```text
can_select  can_insert  can_update  can_delete
f           f           f           f
```

Two independent final reviewers then examined different release boundaries.
The backend/security reviewer found that Render's directly reachable hostname
could reach registration BCrypt and database work without a pre-work global
budget, that the production TLS-verification property had an unsafe false
fallback, and that the verification summary was stale. The
frontend/accessibility reviewer found that the invisible graph scrubber lost
its focus indication in Windows forced-colors mode and that the design
specification promised a password-visibility control which was absent. These
findings were accepted after source inspection.

The final delta adds a bounded, fixed-memory process-global limit before
database or BCrypt work, safe-by-default production database TLS validation,
an explicit forced-colors graph outline, and an accessible password show/hide
control. The authentication limiter updates its minute and hour windows
atomically so a request rejected by the short window cannot consume the longer
registration budget. The retained tradeoffs are documented: the limiter is
single-process and can itself be consumed temporarily, and the Spring process
still holds both runtime and Flyway credentials on this free topology.

Local post-review verification, without Docker or port 4173, returned:

```text
npm.cmd run typecheck
# passed

npm.cmd run lint
# passed with zero warnings

npm.cmd run test:run
# 18 files, 248 tests passed

npm.cmd run build
# 103 modules transformed; production build succeeded

npx.cmd playwright test e2e/typing.spec.ts --project=chromium --workers=1
  --grep "renders focus, errors, and graph encodings in forced colors|
           account password can be revealed and concealed"
# 2 tests passed

.\mvnw.cmd
  '-Dtest=AuthenticationRateLimiterTest,ProductionSafetyConfigurationTest,
          DeploymentManifestTest,SecurityConfigurationTest,
          RillPrincipalResolverTest' test
# 12 tests passed; 0 failures; 0 errors; BUILD SUCCESS
```

The Maven command used an isolated repository copy because another user
session owns the shared `backend/target`. Its first harness attempt omitted
`.github/workflows/verify.yml`, so one manifest test ended with
`NoSuchFileException` while the other eight tests passed. After copying that
repository file from its absolute source path, the complete focused suite
above passed. This was a test-fixture copy error, not an application defect.

The frontend review follow-up then reproduced a password-privacy state bug in
the first visibility-toggle revision. Expected behavior was a concealed,
empty field after closing/reopening the account dialog or switching between
sign-in and registration. Observed behavior was that `form.reset()` cleared the
value but preserved React's `visible` state, so a reopened field could remain
`type="text"`. The field is now remounted at dialog and mode boundaries. The
browser regression reveals the password, closes and reopens the dialog, then
reveals it again and switches account modes; both boundaries restore
`type="password"`, an empty value, and `aria-pressed="false"`. The focused
Chromium test passed after the fix.

Vercel is not deployed or claimed verified. GitHub authentication reaches
Vercel's six-digit authenticator challenge, and this environment has neither a
Vercel CLI session nor `VERCEL_TOKEN`. Until that account-controlled step is
completed, the Vercel production URL, same-origin rewrite, security headers,
SPA deep links, host-only cookie scope, and public browser workflows remain
unverified.
