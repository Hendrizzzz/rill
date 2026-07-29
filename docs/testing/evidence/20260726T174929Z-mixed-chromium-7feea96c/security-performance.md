# Security, performance, and production evidence

## Builds and automated tests

| Command | Result |
| --- | --- |
| Node 24.18.0 `eslint . --max-warnings 0` | Exit 0; zero warnings. |
| Node 24.18.0 `tsc -b --pretty false` | Exit 0. |
| Node 24.18.0 `vitest run` | 11 files, 85 tests passed in 27.63 seconds. |
| `npm run build` | Exit 0; Vite 8.1.5 production build. Main JS 289.50 kB raw/91.48 kB gzip; CSS 21.87/5.41 kB. |
| `.\mvnw.cmd --batch-mode --no-transfer-progress verify` | Build success; 29 tests, 0 failures/errors/skips; PostgreSQL 18.4; clean and populated upgrade paths through V4. |
| `E2E_BASE_URL=http://127.0.0.1:18080 npx playwright test --workers=1 --reporter=list` | 82 passed, 10 skipped, 0 failed in 4.5 minutes. |
| Account lifecycle with `E2E_ACCOUNT=true` | 1 passed; result POST status 201 asserted; registration/history/export/logout/login/deletion exercised. |

The host Node was 22.20.0, below the declared 22.22 minimum, so lint,
typechecking, and the complete deterministic frontend suite were repeated
through an isolated Node 24.18.0 executable. The production image and CI also
pin Node 24.18.0.

The ten general-matrix skips are deliberate project/capability skips: touch is
run only in the mobile project, forced-colors only in Chromium, and the
destructive account lifecycle only when `E2E_ACCOUNT=true`.

## Trusted-input performance smoke

Command:

```text
PERF_BASE_URL=http://127.0.0.1:18080 npm run test:perf
```

Measured in Chromium 151.0.7922.34:

```text
prompt characters: 53
wall duration: 1747.9965 ms
navigation load: 228.4 ms
resources: 7
transferred bytes: 229158
decoded bytes: 447596
beforeinput-to-frame samples: 53
p50: 7.9 ms
p95: 15.1 ms
max: 15.4 ms
Event Timing max: 48 ms
typing network requests: 0
long tasks in measured interval: 0
CSP violations: 0
data-font references in CSS: 0
console/page errors: 0
horizontal overflow: false
layout shift with recent input: 0.0000268887
layout shift without recent input: 0
```

The script uses trusted Playwright keyboard input, captures
`beforeinput`-to-animation-frame samples, Event Timing entries at or above the
browser threshold, long tasks, layout shifts, network requests, CSP violations,
and runtime errors. This is one local warm production run, not a multi-device
latency guarantee or server load test.

An earlier broad smoke attempt observed two long tasks and a font CSP
violation. The long-task observation was not treated as input-latency proof;
the harness was scoped and instrumented. The CSP defect was fixed by emitting
all fonts as same-origin files rather than relaxing policy.

## Dependency and source checks

Frontend:

```text
npm audit --audit-level=high --json
```

Result: 289 dependencies, 0 vulnerabilities.

Backend:

```text
.\mvnw.cmd --batch-mode --no-transfer-progress \
  org.owasp:dependency-check-maven:12.2.2:check \
  -DfailBuildOnCVSS=7 -Dformats=HTML,JSON
```

Result: build success; 49 dependencies analyzed; 0 vulnerable dependencies and
0 findings. NVD/CISA KEV data was available. Sonatype OSS Index was disabled
without credentials, so this does not prove complete supply-chain coverage.

Focused source searches found no private-key/API-key material and no dangerous
DOM sink in application code. Local storage is parsed through current-schema
validation; object URLs are created only for authenticated export downloads.

## Runtime controls

The disposable Compose stack started from an empty volume, applied migrations
V1 through V4, and reported PostgreSQL, backend, and web healthy.

- Public health returned HTTP 200 with `status: UP`.
- Hostile-origin preflight returned 401 without
  `Access-Control-Allow-Origin`.
- Document responses included CSP, no-cache, COOP, CORP, Permissions-Policy,
  no-referrer, HSTS, `nosniff`, and frame denial.
- Explicit Flyway `filesystem:/flyway/sql` configuration removed the
  default-location warning; rerun validation found schema V4 current.
- Runtime logs were checked for error/fatal/exception/traceback patterns.

Known gaps: no container-image scanner, OSS Index credentials, external TLS
ingress, multi-instance abuse test, physical-device performance run, or
maximum-history/export load test.
