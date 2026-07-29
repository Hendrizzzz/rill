# Final parity campaign reconciliation

Run ID: `20260726T190914Z-final-mixed-8b4dce69`  
Local date: 2026-07-27 (Asia/Manila)  
Rill base: `528e07f68a381351c61cb5c4c9b303adf84ecd8c` plus the inspected worktree diff  
Tested source snapshot SHA-256: `3793a78ddd60218686469d3d42ee5f2e372b7f67891a5d90cc447760f74db1bd`  
Pinned Monkeytype source: `7feea96c5df21a59af9553fa7c52eb33af5997b8`  
Observed live Monkeytype version: `v26.28.0`  
Host: Windows x64; frontend commands used Node 22.20.0

## Outcome and claim boundary

All 312 ledger rows have a current disposition:

| Disposition | Rows | Meaning |
| --- | ---: | --- |
| `PASS` | 37 | The exact assertion named by the row has current evidence. |
| `BLOCKED` | 258 | The required oracle, runtime, browser process, Docker service, device, or assistive technology was unavailable or was not run on the final worktree. |
| `N/A` | 16 | Outside the agreed Rill release scope. |
| `DIFF` | 1 | A reproduced and regression-tested intentional difference from pinned Monkeytype source behavior. |

This finishes the inventory and evidence reconciliation. It does **not** mean
that every edge case was executed, that the products are identical, or that
every previously passing historical run applies to this worktree. Historical
results remain useful context but were downgraded wherever the final revision
was not rerun.

Git staging was attempted after the final rerun but failed because the managed
workspace denied creation of `.git/index.lock`. No commit is claimed. Instead,
the manifest binds the tested application/source/spec state to the base commit
plus a deterministic SHA-256 over 128 Git-visible paths and contents, including
markers for deleted tracked files. Mutable audit records under `docs/testing/**`
and `docs/VERIFICATION.md` are excluded to avoid self-reference and are hashed
separately.

## Case coverage

The 37 current passing rows and their exact evidence are mapped in
[`case-coverage.md`](case-coverage.md). The strongest current lanes are:

- 115 frontend unit/component/model tests;
- a seven-vector executable audit of pinned Monkeytype timing source;
- a production frontend build;
- npm dependency and repository source checks.

Rill's generated model tests are independent implementations of the **Rill
contract**. They are not represented as an independent Monkeytype engine.

## Commands and current results

Frontend:

```text
npm.cmd test -- --run
# 12 files, 115 tests passed

npm.cmd run lint
# exit 0, zero warnings

npm.cmd run typecheck
# exit 0

npm.cmd run build
# exit 0; Vite 8.1.5; 98 modules
# JS 291.09 kB (91.95 kB gzip); CSS 22.36 kB (5.49 kB gzip)

npm.cmd run test:coverage
# 12 files, 115 tests passed; configured thresholds passed
# total line coverage 57.2%
```

Pinned source:

```text
$env:MONKEYTYPE_SOURCE_ROOT='C:\Users\hendrizzzz\AppData\Local\Temp\rill-monkeytype-audit'
npm.cmd run audit:monkeytype-timing
# exit 0; 7/7 source-derived vectors matched the pinned commit
```

Backend:

```text
.\mvnw.cmd --batch-mode --no-transfer-progress package "-Dmaven.test.skip=true"
# BUILD SUCCESS; executable Spring Boot jar built; tests skipped

mvn.cmd test "-Dtest=ApiIntegrationTest"
# test source compiled, then Testcontainers failed before test methods:
# access denied to \\.\pipe\docker_engine
```

The native workspace `mvn test` could not read its generated
`target/classes` through the managed sandbox during `testCompile`. An earlier
isolated-classpath attempt was not preserved with enough reconstructable
evidence, so its selected-unit result is not claimed here. The current
PostgreSQL integration suite remains blocked.

The first wrapper invocation failed because Maven Wrapper 3.3.4 indexed
`.Target[0]` when the local `.m2` directory was not a symlink and `Target` was
null. The wrapper now branches on null before selecting the first target. The
same wrapper package command then completed with `BUILD SUCCESS`.

## Live-browser observations

See [`live-browser.md`](live-browser.md). The trusted Browser session exercised
the older bundle served at port 8080 and inspected live Monkeytype. It is
retained as exploratory interaction evidence only. Policy blocked navigation to
the isolated final-build preview, so no final-worktree browser pass is claimed.

## Intentional difference

`TM-023` is the one current `DIFF`. Pinned Monkeytype source produces timer
boundaries `[1000]` when a word test ends at raw 1995 ms, dropping the final
normalized 2000 ms boundary. Rill deliberately produces `[1000, 2000]` so the
final bucket is retained. Neighboring 494.99, 495, 499, 500, and 1495 ms
vectors, including 501 ms, match the pinned source. This decision is executable in
`resultStats.test.ts` and is not hidden as parity.

## Blocked cases

The 258 `BLOCKED` rows remain individually listed in
[`../../MONKEYTYPE_PARITY_LEDGER.md`](../../MONKEYTYPE_PARITY_LEDGER.md). The
main blocking classes are:

- no deterministic adapter that feeds one exact trace into both Rill and a
  complete pinned Monkeytype scoring implementation;
- no same-prompt, same-settings, same-event-timestamp trusted live replay;
- browser process launch returned `spawn EPERM`, so the final Playwright E2E
  and performance suites did not enter their test bodies;
- port 8080 served an older bundle, and Browser policy rejected navigation to
  the isolated final-build preview; observations from the older bundle remain
  exploratory and do not create final-worktree browser passes;
- Docker's Windows named pipe was denied, blocking current PostgreSQL and
  Testcontainers integration execution;
- Maven's `clean` goal could not delete `backend/target` through the managed
  sandbox; the artifact was restored with a successful package command, but a
  current clean-state backend build is not claimed;
- the supported Node runtime download failed, so the final frontend suite ran
  on Node 22.20.0, below the declared 22.22.0 floor;
- current OWASP Dependency-Check data refresh failed because its updater could
  not establish a loopback connection;
- no physical Android/iOS keyboards, shipping Safari device, named screen
  readers, multi-user load environment, or public deployment were available;
- historical E2E, Compose, security, and performance evidence was not promoted
  to current `PASS` unless its exact assertion was rerun on this worktree.

Attempts to run the final browser suites:

```text
$env:E2E_BASE_URL='http://127.0.0.1:8080'; npm.cmd run test:e2e
# 96/96 reported failed before their test bodies; browser launch spawn EPERM

npm.cmd run test:perf
# browser launch spawn EPERM
```

These are environment blocks, not 96 observed product failures.

## Security and performance

See [`security-performance.md`](security-performance.md). Current npm audit and
source checks passed. Current browser performance, backend dependency refresh,
Docker runtime hardening, and load behavior remain blocked. No current
production-readiness or complete-security claim is made.

## Specialist review

The independent confirmation reviews and root adjudication are recorded in
[`specialist-reviews.md`](specialist-reviews.md).
