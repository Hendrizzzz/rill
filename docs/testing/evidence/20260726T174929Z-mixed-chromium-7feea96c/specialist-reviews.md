# Specialist reviews and root evaluation

Both specialists were independent, read-only reviewers. They did not edit code
or run the root test suites. Findings were kept separate and the root agent
reproduced or inspected each finding before accepting, modifying, or rejecting
it.

## Statistics, backend, and data-integrity reviewer

Initial ledger findings:

- high: primitive trace/result schemas and oracle provenance were incomplete;
- high: generated tests could self-confirm if they shared production helpers;
- high: account `completionReason` did not round-trip;
- medium: local fabricated metrics were trusted;
- medium: `correctedErrors` had a weaker bound than reachable typing behavior;
- medium: fractional timing boundaries and mutation resistance needed explicit
  coverage.

Root evaluation:

- accepted versioned trace/result/manifest requirements and source fingerprints;
- added an independent model that does not import reducer/scoring helpers;
- added eight mutation sentinels and generated prefix/metric/classification
  comparisons;
- implemented V4 completion-reason persistence;
- recomputed local metrics and enforced
  `correctedErrors <= incorrectAttempts` in frontend/backend/new database
  writes;
- preserved unknowable legacy rows with a `NOT VALID` migration constraint;
- corrected millisecond wording to exact microsecond normalization.

Later production review confirmed the Vite-inlined `data:` font violated the
strict production CSP. The root accepted the finding and used
`assetsInlineLimit: 0`; relaxing `font-src` was rejected as unnecessary. The
reviewer also correctly rejected interpreting two broad long tasks as proven
input latency. The root expanded instrumentation, repeated the run, and reports
the scoped measurements rather than the earlier inference.

## Browser, interaction, accessibility, and QA reviewer

Initial ledger findings:

- deterministic engine and public live evidence were conflated;
- parent rows could become false passes without variant manifests;
- reference drift, mobile realism, capture provenance, lifecycle, IME, and
  accessibility cases needed explicit treatment.

Root evaluation:

- separated `MT-ENGINE`, `MT-LIVE`, `RILL`, `A11Y`, `SEC-PERF`, and
  exploratory evidence classes;
- added variant-completion and fingerprint invalidation rules;
- expanded the input, graph, lifecycle, responsive, physical-device, and
  assistive-technology inventory;
- kept unavailable physical/live rows blocked rather than presenting emulation
  as physical evidence.

Bug review:

- confirmed that a clean account POST failed because the last accepted event
  could be fractionally later than the integer result duration;
- agreed backend rejection was correct and the product-side bucket boundary was
  wrong;
- supported the focused terminal-only 0.5 ms tolerance, with adjacent boundary
  regressions.

Final-run triage:

- a Firefox trace showed the result saved and rendered before reload;
- trusted typing took 37.35 seconds under four-worker contention, exceeding the
  30-second test budget;
- reload completed in 1.19 seconds, leaving only 1.78 seconds for the final
  assertion;
- classified the failure as test contention, not storage or navigation
  correctness.

The root independently reran the focused Firefox test (passed in 3.8 seconds),
raised only that multi-stage test to 60 seconds, and ran the complete production
matrix serially (82 passed, 10 skipped, 0 failed).

## Rejected or modified advice

- No new state library/event-log abstraction was adopted; release-1 limits and
  measured behavior did not justify it.
- Strict CSP was retained; `data:` was not added to `font-src`.
- A single long-task observation was retained as a diagnostic, not promoted to
  a latency guarantee.
- Browser emulation was not relabeled as physical mobile or shipping Safari.
- Different live prompts/timestamps were not counted as exact parity.

No implementation change was made solely because a specialist proposed it.

