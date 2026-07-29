# Current passing-case coverage

This file maps every current `PASS` row to evidence on the final worktree. A
row is not inferred from a nearby historical test.

## Timing source

- `TM-001` through `TM-008`, `TM-010` through `TM-015`, `TM-021`, and
  `TM-022`, except `TM-013` and `TM-014`: `resultStats.test.ts`,
  `reducer.test.ts`, and the pinned source
  audit cover timer start, normalization, 494.99/495/499/500/1495 ms
  boundaries, the explicit 501 ms case, stable equal-timestamp ordering,
  deadline −1/equality/+1, expiry, and retained final buckets.
- `TM-023` is not a pass; its pinned-source difference is documented in
  [`run.md#intentional-difference`](run.md#intentional-difference).

## State and graph

- `ST-021`: reducer, result-statistics, parity-model, and storage tests assert
  nonnegative counters and attempt/category invariants.
- `GR-005` through `GR-011`, `GR-013`, and `GR-032`:
  `PaceChart.test.tsx` verifies both axes, labels, summaries, bounded monotone
  smoothing, one/no-sample states, sharp turns, and corrected error windows.

## Persistence and API-facing client behavior

- `API-001`, `API-003`, `API-004`: `storage.test.ts` validates anonymous
  history persistence, limits, schema handling, and malformed-record rejection.
- `API-006` through `API-008`: `pendingResults.test.ts` covers retry queues,
  deduplication, successful removal, and permanent-failure discard. A focused
  `AuthProvider.test.tsx` case proves that a discard becomes a clearable,
  user-facing sync notice.
- `API-019`: storage and pending-result tests reject or upgrade known legacy
  shapes without executing untrusted content.
- `API-030`: browser-history validation recomputes derived headline metrics
  from validated primitives and rejects fabricated WPM/raw/accuracy values.

Backend integration-dependent API rows remain blocked even when equivalent
validation logic has frontend unit coverage.

## Generated contract coverage

- `GEN-001` through `GEN-004` and `GEN-013`:
  `parityModel.test.ts` compares generated traces, timestamps, retained word
  pairs, correction histories, and every state prefix against separately
  implemented Rill-contract models. Seeds are fixed in source for reproduction.

These rows prove internal Rill contract consistency. They do not prove
Monkeytype parity and are intentionally not labeled `MT-ENGINE`.

## Current frontend command evidence

```text
npm.cmd test -- --run
# 12 test files; 115 passed

npm.cmd run test:coverage
# 12 test files; 115 passed; configured thresholds passed
# total line coverage 57.2%
# resultStats.ts 100% lines
# reducer.ts 93.33% lines
# storage.ts 88% lines
# PaceChart.tsx 79.87% lines
# API client area 85.62% lines
```
