# Independent final confirmation reviews

Two independent specialists performed read-only audits. Findings were evaluated
by the root agent and were not accepted automatically.

## Backend, timing, and data-integrity specialist

The specialist found:

- the earlier selected-five-test backend claim could not be reproduced from the
  bundle because the workspace `testCompile` path was sandbox-blocked;
- `ENV-023`, `TM-007`, `TM-010`, `TM-013`, `TM-014`, `TM-021`, and the mutable
  worktree provenance required tighter evidence;
- `TM-002` and `TM-003` lacked their exact stated timing vectors;
- the Windows Maven-wrapper null-target fix was correct and its package command
  succeeded with tests skipped.

Root evaluation:

- accepted the backend evidence gap and removed the selected-test claim;
- downgraded `ENV-023`, `TM-013`, and `TM-014`;
- added direct pinned-source 501 ms, deadline −1/equality/+1, normalized
  999.999/1000/1000.001, identical-timestamp, 999/1000/1001, exact-second, and
  zero-duration finite-metric regressions;
- retained `TM-021` only after correcting its test to apply production
  hundredth-millisecond normalization;
- independently reran the focused tests, then the complete frontend suite and
  pinned-source audit.

The closure audit found no remaining high-severity backend, timing-validation,
data-integrity, or security defect. Git staging was sandbox-blocked, so its
remaining provenance concern is handled by the deterministic tested-source
snapshot and artifact hashes recorded in the manifest rather than a commit.

## Frontend, interaction, and accessibility specialist

The specialist found:

- multiple rows were supported only by nearby tests or an incomplete DOM
  observation, especially environment, timing, focus, and screen-reader rows;
- `API-008` discarded a permanently invalid queued result without user
  feedback;
- the Shift+Tab instruction did not match focus order;
- monotone-path tests did not directly bound control points;
- port 8080 Browser evidence and mutable-worktree provenance were insufficient
  for final-worktree passes.

Root evaluation:

- downgraded every unsupported row instead of extrapolating from historical or
  adjacent evidence;
- added a visible, clearable sync alert and two `AuthProvider` tests;
- corrected the keyboard instruction;
- added convex-hull control-point assertions for the smoothed curve;
- detected that port 8080 served an older bundle, terminated the isolated helper
  preview after Browser policy rejected its port, and downgraded all
  final-worktree Browser passes.

The closure audit confirmed these changes and found no remaining high-severity
frontend/product issue. It identified two documentation inconsistencies about
the stale Browser session; both were corrected.

## Root adjudication

The final ledger is intentionally less green than the pre-audit draft:
37 `PASS`, 258 `BLOCKED`, 16 `N/A`, and one `DIFF`. The root accepted findings
only after inspecting source or reproducing the issue. The final available
frontend commands were rerun after the last code change: 12 files/115 tests,
coverage, lint, typecheck, build, seven pinned-source vectors, and npm audit all
passed. Backend tests, final-worktree Browser execution, Playwright/performance,
Docker integration, supported-Node execution, and current OWASP refresh remain
explicitly blocked.
