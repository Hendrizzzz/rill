# Parity campaign run record

> Historical evidence notice: this run predates the final implementation and
> conservative ledger reconciliation. Its 131-pass count must not be used as
> the current-worktree result. The superseding record is
> [`../20260726T190914Z-final-mixed-8b4dce69/run.md`](../20260726T190914Z-final-mixed-8b4dce69/run.md).

Run ID: `20260726T174929Z-mixed-chromium-7feea96c`  
Local date: 2026-07-27 (Asia/Manila)  
Repository base: `528e07f68a381351c61cb5c4c9b303adf84ecd8c` plus the recorded worktree diff  
Reference source: Monkeytype commit `7feea96c5df21a59af9553fa7c52eb33af5997b8`  
Live reference epoch: Monkeytype `v26.28.0`, captured 2026-07-26T17:49:29.113Z  
Host: Windows 10/11 x64; tests ran natively on Windows, not the expected WSL2 host

## Outcome and claim boundary

All 311 ledger rows received a disposition:

| Disposition | Rows | Meaning |
| --- | ---: | --- |
| `PASS` | 131 | The row's stated Rill, independent-model, browser, accessibility, security, or performance oracle was exercised and passed. |
| `BLOCKED` | 164 | Required exact live Monkeytype replay, physical hardware, named assistive technology, or another unavailable environment was not available. |
| `N/A` | 16 | The behavior is outside the supported Rill release or cannot occur in its local prompt architecture. |

There are no remaining `NR`, `RUN`, `DIFF`, `BUG`, `INVALID`, or `STALE`
rows. This is **not** a claim that every Rill row is numerically identical to
the public Monkeytype website. Exact live parity remains blocked wherever the
same trusted input trace, timestamps, prompt, and settings could not be
captured and replayed on both products.

## Case coverage

The ledger itself is the coverage manifest and records one verdict and evidence
link for every row. Passing evidence came from the following independent lanes:

- Rill pure-model/unit tests: 11 files and 85 tests, including 300 generated
  trace/bucket cases, 2,000 metric vectors, 12,000 prefix actions, exhaustive
  small word classifications, sub-millisecond boundary vectors, and eight
  mutation sentinels.
- Spring Boot/PostgreSQL integration: 29 tests, including clean V1-through-V4
  migration, populated V1 upgrade, validation, idempotency, concurrency,
  authorization, rate limits, completion-reason round trip, and data isolation.
- Production browser matrix: 92 cases on Chromium, Firefox, Playwright WebKit,
  and mobile Chromium; 82 passed, 10 capability/configuration skips, 0 failed.
- Separate production account lifecycle: registration, result submission
  (`201` asserted), history, export, logout/login, and deletion passed in
  Chromium against the disposable PostgreSQL stack.
- Production performance smoke: 53 trusted committed characters, 0 typing
  network requests, 0 CSP violations, 0 runtime errors, and measured
  before-input-to-frame latency.
- Security checks: npm audit, OWASP Dependency-Check, hostile-origin request,
  production header inspection, source sink/secret searches, and clean
  container health/log checks.

Commands and meaningful results are recorded in
[`security-performance.md`](security-performance.md) and in the repository
[`VERIFICATION.md`](../../../VERIFICATION.md).

## Blocked cases

Blocked rows were kept blocked rather than converted to optimistic passes:

- exact `MT-LIVE` comparisons that require an identical custom prompt plus a
  captured trusted input/timestamp trace on both sites;
- live IME, dead-key, alternate-layout, dictation, handwriting, autocorrect,
  smart punctuation, and physical key-repeat behavior;
- physical Android/iOS keyboards, shipping Safari, device rotation, virtual
  keyboard, safe-area, text-scaling, and touch-target inspection;
- NVDA, JAWS, VoiceOver, and TalkBack sessions;
- browser zoom/DPR combinations not represented by the executed viewport
  emulation;
- suspend/resume, background throttling, bfcache, asynchronous font-loading,
  and longest-run latency profiling;
- maximum retained-history/export load and external multi-instance/runtime
  infrastructure checks.

The exact 164 row IDs remain visible as `BLOCKED` in
[`MONKEYTYPE_PARITY_LEDGER.md`](../../MONKEYTYPE_PARITY_LEDGER.md).

## Not applicable

Six cases are not applicable because Rill generates prompts synchronously in
the client and has no prompt API: `WD-019`, `UI-022`, `UI-023`, `API-023`,
`API-026`, and `API-027`.

Ten `SCOPE-*` cases cover intentionally unsupported or separate Monkeytype
features and visual/IP boundaries. They are release-scope decisions, not
unexecuted tests.

## Reference provenance

The independent TypeScript oracle was cross-checked against these files in the
pinned official repository:

- `frontend/src/ts/test/events/stats.ts`
- `frontend/src/ts/test/test-logic.ts`
- `packages/util/src/numbers.ts`

The public site was separately fingerprinted. It was exercised with trusted
browser input, but the live runs used different random prompts and elapsed
times and are therefore exploratory integration evidence only. See
[`live-comparison.md`](live-comparison.md).

## Bugs and focused resolutions

1. Account results lost `completionReason`. V4 persistence, API mapping, and
   clean/upgrade regressions were added.
2. Guest storage trusted fabricated WPM/raw/accuracy. Current-schema records
   are now recomputed and rejected when inconsistent.
3. `correctedErrors` allowed an impossible value above historical incorrect
   attempts. Frontend, backend, and new database writes enforce the stronger
   bound.
4. A sub-millisecond terminal event could fall into a bucket just beyond the
   rounded duration and make account submission return 400. Only the terminal
   rounded-word boundary now receives a 0.5 ms tolerance; adjacent boundaries
   are covered.
5. Vite inlined a small Cyrillic font as `data:` while production CSP allowed
   only same-origin fonts. All font assets are now emitted as files; CSP
   remains strict.
6. Two graph E2E tests completed too quickly to create a retained sample. Their
   trusted typing delay was corrected; product behavior was already correct.
7. A parallel Firefox run exhausted its 30-second test budget while
   `pressSequentially` took 37.35 seconds under contention. The trace proved
   persistence worked before reload; a focused rerun passed, the multi-stage
   test received 60 seconds, and the serial 92-case matrix passed.

Each product bug received focused regression coverage. Test-harness defects did
not result in product-code changes.

## Final verdict

Rill's supported release behavior has broad deterministic, integration,
production-browser, accessibility, security, and performance evidence. The
campaign does not satisfy the ledger's stricter desktop **exact live parity**
gate because the public Monkeytype site did not provide a verified identical
trusted trace/custom-prompt replay lane. Those rows remain visibly blocked.
