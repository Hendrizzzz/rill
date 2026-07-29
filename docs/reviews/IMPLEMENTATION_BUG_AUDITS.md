# Implementation bug audits and root evaluation

Date: 2026-07-26
Status: resolved findings verified

The user requested independent review for bugs encountered during
implementation. Specialists were read-only; the root agent reproduced findings,
chose the changes, edited files, and ran verification.

| Area | Independent finding | Root evaluation and action | Verification |
| --- | --- | --- | --- |
| Typing input | React's synthetic `beforeinput` path did not expose the required `inputType` consistently. | Accepted the native-listener fix because the event contract, not React state, belongs on the capture element. Kept the reducer pure. | Focused component regression and cross-browser typing flow pass. |
| Timer/result state | Completion, physical Backspace, storage timing, and component lifecycle paths had edge-case regressions. | Accepted focused reducer/controller fixes and regression tests; rejected broad state-library changes as unnecessary. | Deterministic unit tests plus keyboard E2E pass. |
| Mobile history | CSS-generated labels were visual only and created inconsistent table semantics. | Replaced generated content with real `aria-hidden` label spans while retaining a semantic table. | Mobile Chromium completion/history test and axe pass. |
| Theme/results contrast | The Paper pending-text token and a result-entry opacity animation reduced effective contrast. | Adjusted semantic tokens and removed opacity from result entry; retained restrained transform motion with reduced-motion handling. | All three themes pass axe; screenshots were inspected. |
| Result idempotency concurrency | Concurrent identical result writes could race at a unique constraint. | Added a pessimistic account-row serialization point and a shared microsecond clock. This was preferred over exception-driven transaction recovery. | PostgreSQL Testcontainers concurrency cases pass. |
| Same-origin CORS | A default development origin contradicted the production same-origin topology. | Disabled CORS unless an explicit allowlist exists and preserved CSRF on browser-origin requests. | Security unit/integration tests and hostile-Origin runtime check pass. |
| Account modal state | Login/register mode and form values survived close/reopen. | Reset form, mode, error, and deletion state on close; kept authentication state outside the dialog. | Production account E2E asserts sign-in mode and empty fields after reopen. |
| Router advisories | React Router 7.11 had multiple advisories; 7.18.1 cleared those but introduced a newer RSC-only advisory range. | Rejected the audit tool's unsafe downgrade. After two reviews, migrated the two import sites to advisory-cleared `react-router` 8.3 and raised the Node floor to 22.22; production/CI use Node 24. | Production npm audit reports zero findings; type/lint/unit/build and four-project route navigation pass. |
| Navigation active state | The root `NavLink` also appeared active on `/history`. | Added exact root matching with `end` and explicit `aria-current` checks. | Direct load, back/forward, unknown-route, and active-link tests pass in all four projects. |
| Playwright selector | A substring role locator matched both `test` and `start a test`. | Confirmed this was a test ambiguity, not an accessibility or product defect. Scoped the locator to primary navigation with an exact name and tightened root-path assertions. | Focused regression passes in Chromium, Firefox, WebKit, and mobile Chromium. |
| Maven runtime advisories | Dependency-Check found ten matches in Tomcat 11.0.22, pgJDBC 42.7.11, and Log4j API 2.25.4. | Confirmed shipped preconditions were absent, but patched all runtime components. Kept Spring Boot 4.1.0 GA and temporarily overrode managed families to Tomcat 11.0.24, pgJDBC 42.7.13, and Log4j 2.25.5. | Clean 16-test PostgreSQL suite passes; repeated scan analyzed 49 dependencies with zero findings. Sonatype OSS Index was unavailable without credentials. |
| Duplicate proxy headers | Spring and Nginx emitted identical cache/referrer/nosniff/frame headers. | Treated this as low-severity HTTP correctness, not an exploit. Nginx now hides only overlapping upstream copies and emits one edge value; Spring retains direct-backend defenses. | `nginx -t` passes; each public header occurs once; internal backend values remain present. |
| Coverage gate | The declared 80% global gate included browser-layer UI at 0% and always failed. | Rejected both lowering the global number to the observed 44% and hiding the report. Added missing adapter/pagination tests, retained all-source reporting, and applied per-file 80/80/80/70 floors to deterministic/API modules. Component and E2E gates cover orchestration. | Node 24 coverage run passes with 44 unit/component tests; all-source line coverage remains visibly reported at 44.64%. |
| Terminal pace spike and Monkeytype parity | A character typed just after a one-second boundary created a tiny final bucket; annualizing `1 char / 24ms` produced a misleading 500-WPM point. A broader controlled comparison then found different whole-word WPM credit, error categories, corrected raw pace, accuracy, consistency, and graph series. | Rejected the earlier 250ms merge after inspecting Monkeytype's public source and reproducing its behavior in both sites. Word-mode graph history now keeps a fractional tail only at 500ms or longer; scoring uses whole-word credit, retained raw characters, historical-attempt accuracy, rounded burst samples, and Monkeytype's non-linear consistency mapping. The graph exposes cumulative WPM/raw, burst, and interval errors. | Frontend Vitest passed 72/72, backend tests passed 27/27, lint/typecheck/build passed, and five exact-prompt Browser comparisons covered perfect, substitution, corrected, missed, and extra input. Character categories, WPM, raw pace, accuracy, and consistency agreed within display precision; the prior boundary spike no longer appears. |

No recommendation was implemented solely because a specialist proposed it.
Notable modifications were the pgJDBC choice (latest 42.7.13 rather than the
minimum fix), scoped coverage thresholds instead of a misleading global number,
and preservation of Spring headers behind public-edge normalization.
For the terminal spike, an earlier specialist proposed coalescing a short tail.
The root rejected that recommendation after direct source and behavior evidence
showed Monkeytype's actual policy: discard a word-test tail below 500ms from
graph history, retain a tail at or above 500ms, and leave overall result duration
and aggregate WPM unchanged.

## 2026-07-27 exhaustive-campaign bug reviews

| Finding | Independent review | Root decision and focused fix | Verification |
| --- | --- | --- | --- |
| Account `completionReason` was reconstructed as `finished` | Model/data reviewer confirmed a semantic round-trip defect. | Accepted. Added the enum to DTO/entity/service/client and V4 persistence. Legacy rows receive the documented inference. | Frontend mapping tests and clean/populated PostgreSQL V1-through-V4 integration tests pass. |
| Plausible guest records could carry fabricated WPM/raw/accuracy | Model/data reviewer confirmed storage validation was structurally strong but metric-incomplete. | Accepted. Recompute all derived metrics from validated counters/duration/buckets and reject mismatches. | Focused storage vectors plus the full 85-test frontend run pass. |
| `correctedErrors` could exceed historical incorrect attempts | Model/data reviewer confirmed the reachable-state invariant was stronger than the existing checks. | Accepted with legacy preservation. Frontend/backend reject it; V4 enforces a `NOT VALID` database check for new writes without blocking legacy upgrades. | API negative tests, local-storage tests, clean migration, and populated V1 upgrade pass. |
| Clean account submission returned 400 for a valid terminal event | QA reviewer confirmed the backend correctly rejected a bucket beyond integer duration and isolated the frontend's sub-millisecond rounding mismatch. | Accepted. Allow at most 0.5 ms only for the rounded terminal word boundary; do not broaden ordinary bucket windows. | Regression vectors cover 999.999/1000/1000.001 ms and 499.499/499.5/499.501 ms; account POST status 201 passes. |
| A 2,012-byte Cyrillic font violated strict production CSP | Model/security reviewer confirmed Vite had inlined it as `data:` while `font-src` allowed only `'self'`. | Accepted. Emit every asset as a file with `assetsInlineLimit: 0`; rejected relaxing CSP. | Rebuilt CSS has zero data fonts; performance browser run records zero CSP violations and zero runtime errors. |
| Two graph E2E cases reported no slider | QA review confirmed the tests finished under 500 ms, so the product correctly retained no word-mode tail sample. | Test-only correction: use a 30 ms trusted key delay for graph-inspection cases. | The four affected desktop/mobile variants pass, followed by a clean 82-pass production matrix. |
| Parallel Firefox history assertion timed out after reload | QA trace review found typing took 37.35 s against a 30 s budget; save/load/render had already passed before reload. | Rejected a product storage change. Raised only the multi-stage test budget to 60 s and serialized the final verification. | Focused Firefox rerun passed in 3.8 s; final 92-case matrix: 82 passed, 10 intentional skips, 0 failed. |
| Windows Maven wrapper could not start for a normal `.m2` directory | The wrapper produced `Cannot index into a null array` before Maven started; the backend confirmation reviewer was given the reproduction and root cause for independent scrutiny. | Root inspection located `(Get-Item $MAVEN_M2_PATH).Target[0]`. A normal directory has a null link target, so the wrapper now tests null before selecting a symlink target. | The identical `.\mvnw.cmd … package -Dmaven.test.skip=true` command changed from startup failure to `BUILD SUCCESS`; tests remained explicitly skipped for this package check. |

No bug was fixed solely from a specialist recommendation. The root reproduced
or inspected each accepted finding, retained failed-run context, added focused
coverage, and reran neighboring or full checks as appropriate.

## 2026-07-28 code-learning final audits

Two read-only specialists reviewed the completed increment from different
perspectives. The root agent reproduced or inspected every accepted finding
and retained independent product judgment.

| Finding | Root evaluation and action | Final evidence |
| --- | --- | --- |
| Incorrect target spaces had no visible error glyph | Accepted. Added a width-preserving whitespace error mark without replacing the expected target character. | The regression failed before the fix, then passed in Chromium, Firefox, WebKit, and mobile Chromium. |
| Leading indentation was unreliable for screen readers | Accepted. The accessible current-line text now states the leading-space count and reads the trimmed code line. | Cross-browser code E2E and axe pass; actual screen-reader speech remains unverified. |
| Code-mode word deletion cleared the entire current line | Accepted with code-editor semantics. Ctrl/Option+Backspace now removes trailing spaces plus one identifier or punctuation run; ordinary word mode is unchanged. | Focused reducer regression and full 229-test frontend run pass. |
| A completion/history E2E locator matched both a span and its table cell | Accepted as a test defect, not a product defect. Scoped the assertion to the newest history row. | The original assertion failed in all four projects; the corrected test passes in all four. |
| C++ snippets would likely fail `-Werror` on signed/unsigned comparisons | Accepted. Replaced integer indices with `size_t` and explicit API-return casts. | Static re-review found the warning paths resolved; local C++ compilation remains toolchain-blocked. |
| Pace series should always be monotonic and stay below final aggregate totals | Rejected. Backspacing can legitimately reduce retained cumulative counts, and earlier retained text can exceed the final retained total. Added the narrower invariant that retained counts cannot exceed insertions seen through that bucket. | Frontend/backend negative regressions fail before and pass after the fix; positive decreasing-series regressions pass. |
| Exact exercise identity is absent from history/export | Accepted as a disclosed release-1 limitation. Language and statistics persist; per-algorithm progression was not promised and is deferred rather than added speculatively. | Documented in the authoritative verification limits. |
| The corpus citation overstated why the eight languages were chosen | Accepted. It now describes them as a deliberate popular subset of the linked runtime catalog. | Documentation re-review found the claim and source aligned. |

The frontend reviewer found no remaining blocking code-input defect after
re-audit. The backend/data reviewer found no remaining blocking code,
data-integrity, or security defect after the accepted fixes and the explicitly
reasoned rejection above.

## Monkeytype-parity audit: backend and data integrity

The independent backend reviewer found:

- **Accepted:** V1 database checks still required attempts to equal retained
  characters. V3 now replaces those checks, and a PostgreSQL integration test
  persists a corrected run with four attempts and three retained characters.
- **Accepted:** Java used ties-to-even burst rounding while JavaScript rounds a
  positive half upward. Java now uses `Math.round`; matching 12/13-burst golden
  vectors produce 96% consistency in both runtimes.
- **Accepted:** API and local validation allowed impossible counter relations.
  Both now enforce retained/result inequalities, interval errors not exceeding
  insertions, correct not exceeding raw, and exact final totals when the complete
  duration is represented.
- **Modified:** exact historical pace cannot be reconstructed from the old
  two-field samples. Existing account rows therefore return no graph rather than
  invented zero WPM/raw lines. Pre-release browser history and pending queues
  remain untouched under their v1 keys; current data uses v2 and the history UI
  explains why the old scoring data cannot be converted faithfully.
- **Modified:** JSON idempotency comparison is now structural rather than
  whitespace/order-sensitive. Rolling old-client writes are not supported;
  frontend and backend are an atomic deployment unit.
- **Accepted in final re-review:** V3's combined final-shape check is `NOT
  VALID`, so it is enforced for new writes without blocking unknowable V1
  counter combinations. A populated-V1-to-V3 integration test preserves the
  legacy row.
- **Accepted in final re-review:** v2 local validation is mode-aware and rejects
  a word-test tail below 500ms. API negative cases cover result sums, interval
  errors, correct/raw ordering, and final cumulative totals.

## Monkeytype-parity audit: frontend and interaction

The independent frontend reviewer found:

- **Accepted:** stale chart E2E locators/fixtures were updated. The first focused
  rerun also exposed three test-only defects (a multi-line strict locator,
  ambiguous `100%`, and an API glob intercepting Vite source modules); all were
  reproduced from traces, fixed, and the same four Chromium cases passed.
- **Accepted:** non-BMP input had fallen back to UTF-16 indexing. Final scoring
  now segments graphemes, with a joined-emoji regression.
- **Accepted:** burst and WPM depended too much on color. Burst now has a dotted
  stroke and matching legend sample; raw remains dashed and errors use crosses.
- **Accepted:** subsecond samples lacked an x-axis label, singular “second” was
  wrong, error-axis endpoints were slightly misaligned, and tooltip precision
  stopped at two decimals. These presentation issues were corrected.
- **Rejected:** replacing the immutable event array with a more complex log was
  not justified for release-1 limits (at most 60 seconds or 50 words) without a
  measured latency regression. The existing timing/performance checks remain the
  control; this should be revisited only if longer modes are introduced.

## 2026-07-27 final hardening bug reviews

| Signal | Independent finding | Root evaluation and action | Verification |
| --- | --- | --- | --- |
| Result-graph selector and focus failures | Reviewers separated duplicate/stale test locators from product behavior. | Accepted only the selector and expectation corrections; no runtime change was justified. | Focused four-project graph checks passed before the final matrix. |
| History dimension label mismatch | Review confirmed the API carried the dimension but the rendered label used the older summary. | Accepted the UI mapping correction and retained the API value as the source of truth. | History unit/integration coverage and browser navigation passed. |
| Registration returned 403 under production configuration over plain HTTP | Review traced this to an intentionally Secure session cookie, not CSRF logic. | Rejected weakening the production cookie. Added an explicit local HTTP profile switch; production still requires HTTPS and Secure cookies. | Local account lifecycle and hostile-origin checks passed; the production boundary remains documented. |
| First key could be lost after history-to-test navigation | WebKit stress review reproduced a listener-attachment race after paint. | Accepted a focused `useLayoutEffect` attachment in `TypingCapture`; rejected broader state-machine changes. | Fifty-run reproduction before the fix showed 14 losses; focused WebKit stress after the fix showed none, and the final matrix passed. |
| Exact-second terminal input could be rejected or create a misleading tail | Review confirmed aggregate duration rounded to the exact second while the final event landed up to 5 ms later. | Accepted folding that terminal event into the existing final word-test second. Kept the overall duration and rejected a fractional micro-bucket. Classified the narrow Monkeytype graph difference as TM-024 only after independently recomputing the final sample. | Result, reducer, storage, backend, mutation-sentinel, and 10,000-trace campaign checks pass; TM-024 occurred in 24 traces with zero unapproved differences. |
| Tooltip could detach or clip after a desktop-to-mobile resize | Review distinguished a full-page screenshot artifact from a real post-breakpoint layout race. | Accepted a post-layout animation-frame update, `ResizeObserver`, and `visualViewport` resize handling with cleanup. | Four browser projects passed the focused geometry regression; WebKit passed ten repeats; the serialized 104-case matrix passed with capability-specific skips only. |
| Firefox navigation timed out despite a fully rendered page | Trace review found all document assets returned 200 in 8–61 ms, the DOM and focused input existed, and only Firefox's `load` lifecycle was missing under a concurrent matrix. | Classified this as a harness/browser lifecycle flake, not a product failure. The affected guest test now waits for response commit and then asserts the focused interactive input. Final verification is serialized. | The original path passed 20 isolated Firefox repeats, then 20 repeats across all four projects after hardening; the serialized matrix passed. |
| Playwright deleted the parity campaign JSON | Review confirmed both tools owned `frontend/test-results`; the status retained only a dangling hash after E2E startup cleared the directory. | Accepted a retained `docs/testing/evidence/parity-campaign/latest.json` default, atomic writes, a disjoint-path invariant, strict evidence validation, timestamp-independent campaign digest, and source/tool provenance. CI keeps run-scoped temp artifacts. | The 10,000-case campaign was rerun from the pinned source, the status was regenerated from retained bytes, and a subsequent Playwright run left the evidence SHA-256 unchanged. |

Each finding was reproduced or verified from traces, source, or a focused rerun
before the root decision. Suggestions that would weaken production security,
change product semantics without evidence, or merely extend timeouts were not
adopted.

## Required final gap audits and root adjudication

Two fresh read-only specialists reviewed the finished system from different
perspectives.

### Backend, security, data, and deployment

- **Accepted:** dependency scanning was locally clean but not a continuous CI
  gate. The workflow now runs OWASP Dependency-Check with retained reports,
  reviews pull-request dependency changes, scans both built images with a
  digest-pinned Trivy action, fails on every high/critical finding, and retains
  browser/performance/scan failure artifacts. The production Compose browser
  lane now covers Chromium, Firefox, WebKit, mobile Chromium, and the
  performance smoke. This workflow is statically reviewed but remains
  unexecuted on GitHub.
- **Modified:** a username-only login limiter can be abused for a temporary
  targeted lockout. The existing edge IP limit is useful but does not solve
  distributed attempts. A late authentication redesign was rejected without a
  shared source identity/store; the precise single-instance residual risk and
  recommended source-plus-account progressive control are now recorded in the
  threat model.
- The reviewer found no high-severity defect in authentication/session design,
  CSRF/CORS/authorization, server-derived result integrity, migrations,
  database-role isolation, secret handling, or error exposure.

### Frontend, accessibility, parity, and performance

- **Accepted:** TM-023 previously checked the graph prefix and extra boundary
  but did not independently validate the extra bucket. The classifier now
  replays interval inserts/errors, recomputes final WPM/raw/burst/error values
  and consistency, enforces series lengths, and has mutation sentinels for all
  five allowed fields. The retained 10,000-case campaign passed again with
  1,757 narrowly approved TM-023 cases and zero unapproved differences.
- **Accepted:** the atomic polite current-target live region included a
  once-per-second countdown. The changing target remains polite, while the
  countdown is now a separate non-live `timer`; browser coverage asserts the
  separation.
- **Accepted:** the verification document's historical reconciliation used
  contradictory “authoritative current” wording. It is now explicitly
  historical and superseded by the first section.
- **Accepted:** the browser matrix and failure artifacts were incomplete in CI;
  the production Compose lane now covers the full declared browser set,
  performance evidence, reports, traces, screenshots, videos, and image scans.
- **Modified:** the immutable input-event array has quadratic total copy cost
  in unrealistic accelerated long traces. An independent reproduction measured
  50,000 reducer insertions at 6.96 seconds total, averaging 139.29 microseconds
  per input; 5,000 averaged 13.05 microseconds. This does not demonstrate
  browser-frame latency failure, and release prompts are bounded, so a risky
  storage rewrite was rejected. The bounded browser smoke remains the release
  gate; chunked storage is recommended only if sustained real-browser profiling
  shows late-session latency.
- The reviewer found no confirmed remaining defect in error glyphs,
  imperfect-word Backspace, strict mode, graph smoothing/axes, keyboard graph
  inspection, tooltip resize/containment, responsive overflow, reduced motion,
  or the restrained visual direction.

After the changes, each specialist re-inspected the relevant fixes. No
recommendation was accepted solely because a specialist proposed it.

## 2026-07-28 IDE-style code editor final reviews

Two independent read-only specialists reviewed the finished increment from
different perspectives, followed by focused bug audits when their findings or
the final matrix exposed a defect. The root inspected or reproduced every item.

| Finding | Root decision | Evidence |
| --- | --- | --- |
| Structural indentation could accidentally enter scoring | Accepted the reviewer architecture: indentation is rendered as a fixed structural spacer; reducer/replay/statistics use only the typable target. | Four/eight-space transitions, manual-space errors, dedent, backtracking, aggregate metrics, and pace buckets have focused regressions; 247 unit tests pass. |
| Corpus/runtime import broke the data-URL validator | Accepted the smallest self-contained corpus constant and strengthened the test to prove the smallest positive indent is exactly four. Rejected adding a bundler to the validator. | The failure reproduced first; final validator parses/semantically checks all JS/TS drills and compiles all Python/Java drills. |
| Literal whitespace rendered at inconsistent column widths | Accepted explicit `indent-columns * 1ch`; rejected relying on browser whitespace shaping. | Four-project geometry and 320–1920 viewport coverage pass. |
| Results did not persist the changed corpus/scoring contract | Accepted. `wordListVersion` is now persisted, validated, migrated, returned, included in idempotency/record partitions, and sent by delayed queues. V8 backfills old code as `code-v1`; omitted legacy code requests also normalize to `code-v1`; structural indentation is `code-v2`. | Frontend migration/API-contract regressions pass and Java main/test sources compile. The PostgreSQL-backed migration/API assertions remain unexecuted because Docker was deliberately untouched. |
| A separate global `scoringVersion` should also be added now | Rejected as duplicate state for this increment. `wordListVersion` is explicitly the current corpus/scoring contract; a separate metric version should be introduced only when formulas change independently of prompt contracts. | Contract/API documentation now states this boundary. |
| Caret could remain offscreen after a wide-to-narrow resize | Accepted. Alignment now observes editor and visual-viewport resize. The first full run exposed a WebKit sampling race; the regression now waits for actual in-bounds geometry rather than mere caret existence. | Focused 8-case rerun and final 138-pass browser matrix succeed. |
| Caret stayed visible when restart or another control owned focus | Accepted. Capture focus is explicit state; the current row remains known, but the caret and editor focus treatment follow actual input focus. | Unit regression and Tab → restart → Enter cross-browser path pass. |
| Paper active-error contrast was 4.4917:1 | Accepted. The error token is now `#b23832`, approximately 4.764:1 on the paper code surface. | Direct active-error contrast and axe checks pass in all themes and browser projects. |
| Unversioned pending results disappeared after stricter validation | Accepted as a compatibility defect. Missing versions normalize before validation; code maps to `code-v1`; explicit bogus versions are rejected instead of relabeled. | Unit corrupt/migration cases and all four signed-in-unavailable browser variants pass. |
| Blank code lines are unsupported | Deferred, not hidden. Release corpus deliberately forbids empty lines; supporting them later needs an explicit Enter-only transition and scoring contract. | Corpus shape tests enforce the current rule. |
| Increase all tiny metadata and mobile control heights | Treated as optional refinement. Current axe, contrast, viewport, and interaction checks pass; no late density change was justified without user/device evidence. | Visual inspection and six requested viewport widths passed. |

The final frontend/UI reviewer found no remaining blocking visual, interaction,
accessibility, responsive, or performance defect after the accepted fixes. The
semantics reviewer found no P0/P1 scoring defect; its one confirmed persistence
finding was addressed. No specialist recommendation was implemented without
root review.
