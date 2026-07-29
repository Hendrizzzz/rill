# Rill–Monkeytype parity test ledger

Status: reconciled current-worktree inventory; unresolved rows remain explicit  
Owner: Rill maintainers  
Created: 2026-07-27  
Normative Rill behavior: [`../product/TYPING_CONTRACT.md`](../product/TYPING_CONTRACT.md)  
Prior evidence: [`../VERIFICATION.md`](../VERIFICATION.md)

## Purpose and claim boundary

This ledger is the source of truth for comparing Rill's supported typing behavior
with Monkeytype. It has two jobs:

1. enumerate the meaningful behavior classes, boundaries, and failure modes; and
2. preserve enough evidence to reproduce every comparison.

It cannot enumerate every literal keystroke sequence, Unicode string,
millisecond timestamp, browser build, or network interleaving. Those spaces are
unbounded. “All possible cases” therefore means:

- every identified equivalence class;
- every important boundary on either side of a class;
- combinations known to interact;
- generated traces for the remaining combinatorial space; and
- an explicit inventory of unsupported or intentionally different features.

A green ledger supports a bounded claim:

> For the Rill release modes and settings listed here, the two products produce
> equivalent retained typing statistics and graph samples when given the same
> prompt, committed input events, and event timestamps.

It does **not** claim visual-design identity, feature-for-feature Monkeytype
identity, or equivalence for modes Rill does not implement.

The legacy row-by-row disposition below records the 2026-07-27 baseline:
312 rows — 37 `PASS`, 258 `BLOCKED`, 16 `N/A`, and one intentional `DIFF`.
It is retained as an inventory, not presented as the current numerical-parity
result. The generated [`PARITY_STATUS.md`](PARITY_STATUS.md), driven by
[`parity-program.json`](parity-program.json), reports the current three-lane
gates and pinned campaign without rewriting historical rows.

## Non-negotiable comparison rules

### Fix the oracle before typing

Monkeytype is a changing external product. Every comparison run must record:

- date, time zone, and run ID;
- exact Monkeytype URL and, when visible, version/build identifier;
- Monkeytype HTML/main-asset SHA-256 fingerprints and settings export/snapshot;
- exact Rill commit SHA or `WORKTREE` plus diff reference;
- browser name and full version;
- browser driver/controller and result-extractor versions;
- operating system, device type, zoom, and device-pixel ratio;
- Monkeytype language, mode, duration/word count, punctuation, numbers, and
  behavior settings that can change scoring;
- Rill settings;
- exact prompt text;
- exact committed event trace and monotonic timestamps;
- whether the run was deterministic/replayed or manually typed.

If the prompts, settings, input events, or timestamps differ, the run may be
useful exploratory evidence but cannot prove exact numerical equivalence.

### Evidence classes

Every case and run must name its oracle class. Results from unlike classes are
reported separately.

| Class | Oracle | What it can prove |
| --- | --- | --- |
| `MT-ENGINE` | A pinned, independently identified Monkeytype scoring implementation or extracted golden vectors | Exact metric and graph-sample equivalence for the same deterministic trace |
| `MT-LIVE` | The public Monkeytype website through trusted browser input | Real interaction and displayed-result behavior for the captured live trace |
| `RILL` | The normative Rill typing/API contract | Rill state, persistence, failure, and deployment behavior |
| `A11Y` | WCAG criteria plus named assistive-technology/browser expectations | Accessibility behavior; Monkeytype behavior is context only |
| `SEC-PERF` | The stated threat/performance requirement and measured evidence | Rill security or performance control |
| `EXPLORATORY` | Uncontrolled/manual observation | A lead only; never exact parity |

The gates are independent:

- exact numerical parity requires `MT-ENGINE` deterministic evidence;
- public-site integration uses representative `MT-LIVE` evidence against each
  live run's own captured trace; and
- Rill quality uses `RILL`, `A11Y`, and `SEC-PERF` evidence.

`MT-LIVE` is not a prerequisite for a mathematical equality claim because the
public site does not expose a controllable clock. Conversely, `MT-ENGINE`
evidence cannot prove live input integration, accessibility, or visual
behavior. A single run must not claim multiple classes unless it actually
contains each evidence form.

### Capture and replay protocol

Exact parity and live-browser realism are separate lanes:

1. **Live capture:** use trusted keyboard/IME/touch input on each website.
   Capture the prompt, ordered browser input events, `inputType`, composition
   sequence, actual site-observed elapsed times, settings, and extracted result.
   Do not pretend two live runs have identical millisecond timing.
2. **Deterministic replay:** feed one normalized trace into Rill's pure
   calculator and a pinned independent Monkeytype engine/golden-vector harness.
   Both receive the same integer-microsecond trace, the exact
   `elapsedUs / 1000` fractional-millisecond conversion, tie ordering, prompt,
   mode, and settings.
3. **Cross-check:** each live result must agree with the independent expectation
   derived from its own captured trace. The deterministic lane must produce
   exact cross-engine values from the shared trace.

The replay adapter must be versioned and document:

- prompt-provisioning method and proof that it does not change scoring mode;
- trace schema version, clock origin, timestamp rounding, and equal-time order;
- event source (`trusted`, `synthetic`, `IME`, or replay), `isTrusted`,
  `inputType`, key/code/modifiers, committed graphemes, and composition phases;
- whether a browser rejected or transformed an event;
- result/graph extraction selectors or API and extractor revision;
- any time mocking, site instrumentation, or source checkout/commit.

DOM-dispatched synthetic events cannot stand in for trusted-input evidence.
Browser automation that sends trusted protocol input is still live evidence
unless the application's clock is also deterministically controlled and
verified.

### Variant-completion rule

A row containing several values or platforms is a parent case. Give each
required variant a suffix in the evidence record, such as `ENV-013@80`,
`ENV-013@100`, and `ENV-013@400`. The parent may be `PASS` only when:

- every listed required variant has its own verdict and evidence;
- no required variant is `DIFF`, `BUG`, `BLOCKED`, `INVALID`, or `STALE`; and
- the parent row links a coverage manifest enumerating those variants.

Never overwrite an older run. New runs supersede it by link.

### Monkeytype drift and freshness

Every release comparison defines a **comparison epoch**: Monkeytype URL,
settings snapshot, HTML/main-asset fingerprints, extractor revision, browser
version, and observation date. A changed fingerprint or scoring-relevant
setting makes affected `MT-*` rows `STALE`; their previous evidence remains
valid only for its recorded epoch. A release parity statement must name its
epoch and must not aggregate `STALE` evidence as current.

### Compare semantics, not branding

Rill must retain its original interface. Pixel layout, colors, typography,
branding, animation curves, and proprietary Monkeytype assets are not parity
targets. The following are parity targets:

- accepted/rejected input and state transitions;
- correct, incorrect, extra, missed, and corrected counts;
- WPM, raw WPM, accuracy, and consistency;
- graph sample count, timestamps, WPM, raw, burst, and error values;
- final duration and completion reason where both products expose equivalent
  modes.

### Pass criteria

| Surface | Required result |
| --- | --- |
| Character counters | Exact integer equality in `MT-ENGINE`; each `MT-LIVE` result must match the oracle for its captured trace |
| Completion reason | Exact semantic equality |
| Duration | Exact for deterministic traces; live runs use their separately captured actual durations |
| WPM/raw/accuracy/consistency | Exact at two decimals from identical timestamps; visible headline values must round the same way |
| Graph sample timestamps and values | Exact before rendering |
| Smoothed path | Must pass through the samples without overshoot or invented extrema; pixel-identical interpolation is not required |
| Tooltip | Must expose the exact underlying sample and remain inside the viewport |
| Accessibility/interaction | Rill contract, WCAG expectations, and browser behavior apply; Monkeytype is reference evidence, not permission to copy a defect |
| Unsupported Monkeytype feature | `N/A`, with the product-scope difference recorded |

Never hide a difference behind a broad tolerance. If independent live typing
lands on different second boundaries, do not directly compare its numbers;
derive each site's expectation from its own trace and run the shared trace
through the deterministic lane.

## Status vocabulary

Use exactly one value in each matrix row:

| Status | Meaning |
| --- | --- |
| `NR` | Not run under this ledger |
| `RUN` | In progress; evidence incomplete |
| `PASS` | Pass criteria met and evidence linked |
| `DIFF` | Reproducible product difference |
| `BUG` | Confirmed Rill defect with code/reproduction evidence; owner and regression/issue link are required when remediation starts |
| `BLOCKED` | Environment or oracle prevents a valid comparison |
| `N/A` | Deliberate scope difference; rationale recorded |
| `INVALID` | Run cannot support a conclusion |
| `STALE` | Previously valid evidence belongs to an older comparison epoch or affected revision |

Do not convert prior prose or a screenshot alone into `PASS`. Import it through
a run record with reproducible settings, trace, results, and evidence.

Normal transitions are `NR → RUN → PASS/DIFF/BUG/BLOCKED/INVALID`. A code change,
oracle fingerprint change, expired environment, or affected-contract change
reopens the row as `STALE → RUN → …`; it does not delete its history.

## Evidence layout

Store new evidence below `docs/testing/evidence/<run-id>/`:

```text
<run-id>/
  manifest.json
  run.md
  trace.json
  rill-result.json
  monkeytype-result.json
  rill.png
  monkeytype.png
  browser-console.txt
  notes.md
```

Sensitive account data, cookies, tokens, passwords, and unredacted exports must
never be added. A screenshot is supporting evidence; the structured result and
event trace are the numerical oracle.

Use run IDs in the form
`YYYYMMDDTHHMMSSZ-<oracle>-<browser>-<8-char-random>`. `manifest.json` records:

- manifest, trace, and result schema versions;
- case and variant IDs with individual verdicts;
- comparison epoch and all software/tool revisions;
- exact capture/replay commands and extraction method;
- SHA-256 for every artifact;
- required/optional artifact completeness;
- redaction confirmation;
- superseded/superseding run IDs;
- owner, reviewer, due date, and retest date.

Optional evidence may include a video, HAR/network summary, accessibility
report, performance trace, or DOM snapshot when it materially supports a case.

## Normalized evidence schemas

The following version-1 shapes are normative for this ledger. Unknown fields
must be rejected by the evidence validator. JSON numbers must be finite.
Derived values never substitute for missing primitives. The trace and result
snippets illustrate their respective shapes; they are not one complete shared
test vector.

### Deterministic trace: `rill-parity-trace/1`

Use integer microseconds so sub-millisecond boundaries survive JSON
serialization. Adapters convert `elapsedUs / 1000` to the application's
millisecond clock.

```json
{
  "schema": "rill-parity-trace/1",
  "config": {
    "mode": "words",
    "modeValue": 10,
    "punctuation": false,
    "numbers": false
  },
  "prompt": {
    "text": "alpha beta",
    "graphemes": ["a", "l", "p", "h", "a", " ", "b", "e", "t", "a"]
  },
  "events": [
    {
      "sequence": 0,
      "elapsedUs": 0,
      "kind": "insert",
      "grapheme": "a"
    },
    {
      "sequence": 1,
      "elapsedUs": 1000000,
      "kind": "backspace"
    },
    {
      "sequence": 2,
      "elapsedUs": 1000000,
      "kind": "tick"
    }
  ]
}
```

Rules:

- `sequence` is a contiguous zero-based integer and resolves equal-time order;
- `elapsedUs` is a nonnegative safe integer and never decreases;
- `kind` is `insert`, `backspace`, or `tick`;
- `grapheme` is present only for `insert` and contains exactly one segmented
  grapheme;
- word index, correctness, counters, and buckets are derived outputs, not trace
  inputs;
- live-only focus/composition/key metadata belongs in the capture artifact and
  maps explicitly to this normalized trace.

### Normalized result: `rill-parity-result/1`

```json
{
  "schema": "rill-parity-result/1",
  "mode": "words",
  "modeValue": 10,
  "punctuation": false,
  "numbers": false,
  "promptSha256": "<sha256>",
  "traceSha256": "<sha256>",
  "durationMs": 1000,
  "completionReason": "finished",
  "typedCharacters": 5,
  "correctAttempts": 5,
  "incorrectAttempts": 0,
  "correctCharacters": 5,
  "incorrectCharacters": 0,
  "missingCharacters": 0,
  "extraAttempts": 0,
  "correctedErrors": 0,
  "wpm": "60.00",
  "rawWpm": "60.00",
  "accuracy": "100.00",
  "consistency": "100.00",
  "paceBuckets": [
    {
      "index": 0,
      "startMs": 0,
      "endMs": 1000,
      "durationMs": 1000,
      "typedCharacters": 5,
      "correctCharacters": 5,
      "rawCharacters": 5,
      "errors": 0,
      "wpm": "60.00",
      "rawWpm": "60.00",
      "burstWpm": "60.00"
    }
  ]
}
```

Metric strings are base-10 values rounded to exactly two decimal places.
Primitive integers and bucket order must match before metrics are compared.
For every field, the manifest records provenance as `direct-extraction`,
`independent-derivation`, or `not-exposed`. A parity gate cannot silently fill
a `not-exposed` primitive from Rill's own output.

### Independent reference-model requirements

The parity reference model must:

- consume `rill-parity-trace/1` rather than Rill state or result aggregates;
- derive word index, retained text, attempts, character categories, completion,
  buckets, and metrics prefix by prefix;
- not import or call Rill production reducers, calculators, validators, or
  backend services;
- identify the pinned Monkeytype source/build or independently extracted golden
  behavior on which each rule is based;
- emit `rill-parity-result/1` and an optional prefix-state stream;
- pass mutation checks proving the suite detects changes to word credit,
  separator classification, correction history, deadline inclusivity, 500 ms
  tail handling, bucket assignment, rounding, and consistency;
- store its revision and source fingerprint in every deterministic run.

Frontend/backend agreement is useful internal evidence, but it is not an
independent parity oracle.

### Manifest: `rill-parity-manifest/1`

The manifest contains the run metadata specified above plus:

- artifact path, media/schema type, SHA-256, byte length, and redaction state;
- every case/variant, oracle class, status, expected evidence, and supersession;
- field-level extraction/derivation provenance;
- the independent reference-model revision and mutation-test report;
- a deterministic serialization/hash of settings, prompt, trace, and normalized
  results.

## Run registry

Add one row per execution session. A deterministic session may cover multiple
case IDs when it uses one frozen environment. A mixed campaign row is an index
only and must preserve the environment and command boundaries in its evidence.

| Run ID | Epoch | Date | Rill revision | Oracle class | Browser/OS | Case/variant IDs | Derived result | Evidence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `20260726T174929Z-mixed-chromium-7feea96c` | Historical pre-reconciliation campaign | 2026-07-27 | `528e07f… + WORKTREE` | Mixed | Windows / Playwright and Docker | 311-row historical inventory | Superseded as current-revision proof; retained as dated evidence | [historical run](evidence/20260726T174929Z-mixed-chromium-7feea96c/run.md) |
| `20260726T190914Z-final-mixed-8b4dce69` | Pinned source `7feea96…`; live `v26.28.0` | 2026-07-27 | `528e07f… + source snapshot 3793a78…` | Mixed, separated in record | Windows / in-app Browser; CLI | All 312 rows | 37 pass, 258 blocked, 16 N/A, 1 diff | [current run](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md) |

## Exact case record template

Copy this block to `docs/testing/evidence/<run-id>/run.md` for every run:

```markdown
# Parity run <run-id>

- Case IDs:
- Variant IDs:
- Oracle class(es):
- Comparison epoch:
- Operator:
- Started/completed:
- Rill revision and dirty-state hash:
- Rill URL:
- Monkeytype URL/build:
- Browser/version:
- Driver/controller/extractor versions:
- OS/device/DPR/zoom:
- Deterministic replay or manual:
- Input trust/source and time-control method:
- Settings on both sites:
- Settings snapshot/hash:
- Exact prompt:
- Prompt-provisioning method:
- Trace file:
- Trace/result schema versions:
- Pre-run storage/account state:
- Exact execution/capture/extraction commands:

## Per-case verdicts

| Case/variant | Oracle class | Status | Expected | Observed | Evidence | Owner | Retest date |
| --- | --- | --- | --- | --- | --- | --- | --- |

## Input trace

| Sequence | Elapsed ms | Word index | Event | Grapheme/input type | Accepted? |
| ---: | ---: | ---: | --- | --- | --- |

## Final statistics

| Statistic | Rill raw | Monkeytype raw | Displayed Rill | Displayed Monkeytype | Verdict |
| --- | ---: | ---: | --- | --- | --- |
| Duration ms | | | | | |
| Completion reason | | | | | |
| Typed characters | | | | | |
| Correct attempts | | | | | |
| Incorrect attempts | | | | | |
| WPM | | | | | |
| Raw WPM | | | | | |
| Accuracy | | | | | |
| Consistency | | | | | |
| Correct | | | | | |
| Incorrect | | | | | |
| Extra | | | | | |
| Missed | | | | | |
| Corrected errors | | | | | |

## Graph samples

| Index | Start/end/duration ms | Interval insertions R/MT | Cumulative correct R/MT | Cumulative raw R/MT | Errors R/MT | WPM R/MT | Raw R/MT | Burst R/MT | Verdict |
| ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- |

## State and interaction observations

- Initial state:
- Active state:
- Completion:
- Restart:
- Hover/focus/touch:
- Console/network:

## Verdict

- Registry result derived from per-case verdicts:
- Exact differences:
- Expected or defect:
- Issue/regression test:
- Evidence limitations:
- Reviewer/date:

## Evidence-completeness checklist

- [ ] Manifest validates and all SHA-256 values match.
- [ ] Prompt, settings, environment, and comparison epoch are frozen.
- [ ] Every case variant has its own verdict.
- [ ] Trace and both structured result artifacts are attached when applicable.
- [ ] Live and deterministic evidence are labeled separately.
- [ ] Capture/replay/extraction commands and tool revisions are recorded.
- [ ] Screenshots contain no secrets or personal account data.
- [ ] Console/network evidence is attached when required by the case.
- [ ] Failed evidence is retained and linked to any superseding pass.
- [ ] Independent reviewer signed the run.
```

## Trace notation

Structured JSON is authoritative. Human notes may use:

- `a@125` — insert grapheme `a` at 125 ms;
- `SP@500` — insert a space;
- `BS@650` — backward delete;
- `IME(é)@800` — commit one composition;
- `PASTE(text)@900`, `DROP(text)@900`, `UNDO@900` — rejected input types;
- `WAIT→2000` — no input until 2,000 ms;
- `BLUR@1000`, `FOCUS@2500` — document visibility/focus events;
- `ESC`, `ENTER`, `TAB`, `CTRL+A` — keyboard control events.

## Environment and configuration matrix

These rows establish that the comparison environment itself is controlled.

| ID | Pri | Case or boundary | Required observation | Status | Last run/evidence |
| --- | --- | --- | --- | --- | --- |
| ENV-001 | P0 | Same exact custom prompt on both sites | Prompt bytes and displayed graphemes match | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| ENV-002 | P0 | Deterministic shared trace; separately captured live traces | Engine trace hashes match; live results are evaluated against their own captured timing | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| ENV-003 | P0 | Time 15 seconds | Both use 15-second completion semantics | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| ENV-004 | P0 | Time 30 seconds | Both use 30-second completion semantics | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| ENV-005 | P0 | Time 60 seconds | Both use 60-second completion semantics | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| ENV-006 | P0 | Words 10 | Both stop after the same tenth target word | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| ENV-007 | P0 | Words 25 | Both stop after the same twenty-fifth target word | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| ENV-008 | P0 | Words 50 | Both stop after the same fiftieth target word | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| ENV-009 | P1 | Punctuation off/on | Same target punctuation and scoring | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| ENV-010 | P1 | Numbers off/on | Same target digits and scoring | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| ENV-011 | P1 | Punctuation and numbers together | Interaction produces the same target/scoring | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| ENV-012 | P0 | English word-list/version difference | Frozen prompt removes generator differences | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| ENV-013 | P1 | Browser zoom 80/100/125/200/400% | Statistics unchanged; Rill remains operable | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| ENV-014 | P1 | DPR 1/1.25/1.5/2/3 | Statistics and graph samples unchanged | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| ENV-015 | P1 | Clean guest state | No previous result/config contaminates run | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| ENV-016 | P1 | Existing history/account state | Current result remains independent | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| ENV-017 | P0 | Browser/site version recorded | Run can be reproduced or bounded in time | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| ENV-018 | P0 | Cache/service-worker/extension control | No stale bundle or input-changing extension | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| ENV-019 | P0 | Full Monkeytype behavior-settings snapshot | Stop/error/input modifiers are explicitly fixed, not assumed | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| ENV-020 | P0 | Prompt-provisioning method | Exact text is proven not to change the tested mode's scoring semantics | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| ENV-021 | P0 | Capture/replay adapter self-test | Known trace survives capture → serialize → replay without mutation | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| ENV-022 | P0 | Result extractor cross-check | Extracted raw values agree with every visible tooltip/headline sampled | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| ENV-023 | P0 | Site-fingerprint drift check | Changed assets reopen affected Monkeytype rows as `STALE` | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| ENV-024 | P1 | Locale/time zone/font/consent state | Formatting or overlays cannot contaminate result extraction/input | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |

## Input acceptance and editing matrix

| ID | Pri | Case or boundary | Expected parity/assertion | Status | Last run/evidence |
| --- | --- | --- | --- | --- | --- |
| IN-001 | P0 | First character correct | Starts timer once; one correct attempt | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-002 | P0 | First character incorrect | Starts timer once; one incorrect attempt | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-003 | P0 | Correct character in middle/end | Advances caret and counters exactly once | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-004 | P0 | Wrong character of equal width | Target glyph stays visible as an error in Rill; counts match | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-005 | P0 | Wrong narrow/wide character | No spacing drift; counts match | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-006 | P0 | Overtype beyond target length | Extra count and caret position match | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-007 | P0 | Backspace wrong current character | Retained text changes; historical attempt remains | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-008 | P0 | Backspace correct current character | Retained text changes; attempt history remains | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-009 | P0 | Backspace at empty current word after imperfect prior word | Reopens prior word | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-010 | P0 | Backspace at empty current word after perfect prior word | Does not reopen prior word | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-011 | P1 | Backspace repeatedly to word start | Stops at permitted boundary without underflow | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-012 | P1 | Backspace in ready state | Does not start timer or alter counters | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-013 | P0 | Space after perfect word | Commits once and advances once | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-014 | P0 | Space after wrong word | Variants: equal substitution, short/missing, overtyped, non-final, and imperfect final word; separator/categories match | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-015 | P1 | Repeated space on empty word | Ignored; no phantom word or timer start | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-016 | P1 | Leading space | Ignored consistently | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-017 | P0 | Correct error, then retype correctly | Corrected-error and accuracy semantics match | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-018 | P0 | Correct error, then type another error | Full attempt history is retained | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-019 | P0 | Several corrections in one position | Every accepted insertion affects attempt history | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-020 | P0 | Error remains at completion | Incorrect category matches | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-021 | P0 | Extra remains at completion | Extra category matches | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-022 | P0 | Missing remains at committed word | Missed category matches | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-023 | P1 | Entire word wrong | Whole-word WPM credit and error categories match | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-024 | P1 | Empty word attempted with space | No unintended empty target word | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-025 | P1 | Very long overtype sequence | Stable spacing/state and bounded handling | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-026 | P1 | Key repeat | Each committed repeat is one attempt | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-027 | P1 | Two graphemes in one `beforeinput` | Ordered, one action per grapheme | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-028 | P1 | Non-ASCII single code point | One incorrect grapheme attempt | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-029 | P1 | Combining grapheme (`e` + accent) | Treated as one grapheme when committed together | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-030 | P1 | Joined emoji/family emoji | No UTF-16 counter splitting | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-031 | P1 | IME composition commit | Intermediate composition not scored; commit scored once | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-032 | P1 | Composition canceled | No scored attempt | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-033 | P0 | Paste | Rejected without state/stat change | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-034 | P1 | Drop | Rejected without state/stat change | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-035 | P1 | Replacement text | Rejected without state/stat change | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-036 | P1 | Browser undo/redo input types | Rejected without state/stat change | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-037 | P1 | Ctrl/Alt/Meta shortcut | Not scored as printable input | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-038 | P1 | Tab | Native focus movement; not scored | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-039 | P1 | Newline/Enter while running | No target character inserted | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-040 | P1 | Input after completion | Result snapshot is immutable | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-041 | P1 | Ctrl/Option+Backspace (`deleteWordBackward`) | Accepted/rejected policy is explicit; no accidental one-character mismatch | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-042 | P1 | Delete/forward-delete input types | Accepted/rejected policy is explicit and counters remain coherent | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-043 | P1 | Dead-key composition | Intermediate dead key is not scored separately | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-044 | P1 | AltGraph/alternate keyboard layout | Produced grapheme, not physical key label, drives scoring | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-045 | P1 | Shift/Caps Lock case | Case-sensitive target behavior is explicit and counted once | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-046 | P1 | Num Lock/numpad digit | Produced digit follows the same target policy | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-047 | P1 | Mobile long-press accent | One committed grapheme; intermediate UI is not scored | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-048 | P1 | Autocorrect/replacement event sequence | Explicitly accepted or rejected without duplicate attempts | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-049 | P1 | Smart quote/dash substitution | Produced grapheme is handled explicitly; no silent normalization | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-050 | P1 | Backspace during composition | Composition and retained typing state cannot diverge | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-051 | P1 | Composition interrupted by blur/restart | No late or duplicate commit enters the wrong run | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-052 | P1 | Emoji variation selector/skin tone/flag | Extended grapheme is not split into attempts | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-053 | P1 | Indic conjunct or other complex grapheme | Segmentation limitation is measured and disclosed | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-054 | P1 | Dictation/handwriting insertion | Input type is accepted, rejected, or declared outside scope | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-055 | P0 | Duplicate `keydown` plus `beforeinput` delivery | Printable input is scored exactly once | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| IN-056 | P1 | Key repeat crossing deadline | Only pre-deadline committed events are accepted | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |

## Prompt and word-boundary matrix

| ID | Pri | Case or boundary | Expected parity/assertion | Status | Last run/evidence |
| --- | --- | --- | --- | --- | --- |
| WD-001 | P0 | One-letter word | Whole-word credit includes its boundary correctly | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| WD-002 | P0 | Long word | No spacing/counter drift across wraps | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| WD-003 | P1 | Repeated identical words | Word index, not text lookup, drives state | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| WD-004 | P1 | Narrow-letter word (`ill`) | Glyph width does not change logical indexing | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| WD-005 | P1 | Wide-letter word (`www`) | Glyph width does not change logical indexing | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| WD-006 | P0 | Apostrophe | Exact punctuation grapheme scoring | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| WD-007 | P0 | Hyphen | Exact punctuation grapheme scoring | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| WD-008 | P1 | Comma/period/colon/semicolon | Each punctuation boundary classified correctly | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| WD-009 | P1 | Question/exclamation mark | Each punctuation boundary classified correctly | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| WD-010 | P0 | Embedded digits | Exact target and counters | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| WD-011 | P1 | Multi-digit token | No numeric grouping or normalization | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| WD-012 | P0 | Partial correct current word at time expiry | Fractional WPM credit follows reference rule | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| WD-013 | P0 | Partial wrong current word at time expiry | No incorrect whole-word credit | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| WD-014 | P0 | Partial word corrected immediately before expiry | Final retained and attempt counters match | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| WD-015 | P0 | Final word in word mode without trailing space | Completion and credit match | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| WD-016 | P1 | Space typed after final word completion | No extra post-result mutation | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| WD-017 | P0 | Prompt wraps at current word | Logical caret/word remains stable | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| WD-018 | P1 | Resize changes line wrapping mid-test | State/statistics unchanged | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| WD-019 | P1 | Empty/malformed prompt response | Rill error/retry state; comparison marked N/A | N/A | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#not-applicable) |
| WD-020 | P1 | Prompt exhaustion in time mode | Explicit completion/failure contract, no crash | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| WD-021 | P0 | Extra character at word start/middle/end | Positional classification and following characters match | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| WD-022 | P0 | Missing character at word start/middle/end | No cascading substitution misclassification | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| WD-023 | P0 | Transposed adjacent characters | Incorrect/extra/missed categories match the reference | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| WD-024 | P0 | Repeated target letter omitted/duplicated | Alignment and category totals match | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| WD-025 | P0 | Wrong character followed by correct suffix | Target glyph positions and counters remain aligned | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| WD-026 | P1 | Several edits shift then restore word length | Final alignment and historical attempts remain distinct | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| WD-027 | P1 | Consecutive punctuation/digit boundaries | No implicit token normalization | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| WD-028 | P1 | Mixed ASCII target and non-ASCII input | Grapheme indexing remains stable through the word boundary | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |

## Timing and completion-boundary matrix

| ID | Pri | Case or boundary | Expected parity/assertion | Status | Last run/evidence |
| --- | --- | --- | --- | --- | --- |
| TM-001 | P0 | First accepted input at 0 ms | Deterministic start, no divide-by-zero | PASS | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#case-coverage) |
| TM-002 | P0 | Input at 999/1000/1001 ms | Correct graph bucket assignment | PASS | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#case-coverage) |
| TM-003 | P0 | Input at every exact second | No duplicate/lost bucket events | PASS | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#case-coverage) |
| TM-004 | P0 | Word test ends with 0 ms remainder | Full-second graph only | PASS | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#case-coverage) |
| TM-005 | P0 | Word test ends at raw 494.99 ms | Tail omitted; aggregate duration is 490 ms | PASS | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#case-coverage) |
| TM-006 | P0 | Word test ends at raw 495 ms | Tail retained; aggregate duration is 500 ms | PASS | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#case-coverage) |
| TM-007 | P0 | Word test ends at raw 499/500/501 ms | Tail retained at the raw boundary; aggregate uses the 10 ms grid | PASS | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#case-coverage) |
| TM-008 | P0 | Historical 1 character/24 ms tail | No misleading 500-WPM graph point | PASS | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#case-coverage) |
| TM-009 | P0 | Word duration 1/10/11/999/1000 ms | Exact source-compatible statistics remain visible below one second, with an explicit `too short · not saved` state and no guest/account persistence; 1000ms is the minimum persisted result and later durations remain on the 10ms grid | AUTOMATED | `reducer.test.ts`, `storage.test.ts`, `typing.spec.ts`, `ApiIntegrationTest.minimumPersistableWordDurationRoundTrips`, `ApiIntegrationTest.subsecondAndNonCanonicalWordDurationsAreRejected` |
| TM-010 | P0 | Input at deadline −1/deadline/deadline +1 ms | Equality completes before accepting input | PASS | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#case-coverage) |
| TM-011 | P0 | Delayed timeout callback | Result duration stops at exact deadline | PASS | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#case-coverage) |
| TM-012 | P0 | Background tab across deadline | Completion remains exact after resume | PASS | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#case-coverage) |
| TM-013 | P1 | Blur/focus during running test | Timer continues; no pause inflation | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| TM-014 | P1 | Long pause within test | Zero/low burst sample and consistency match | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| TM-015 | P1 | Multiple events with identical timestamp | Stable ordering and counts | PASS | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#case-coverage) |
| TM-016 | P1 | Non-monotonic injected timestamp | Reducer/test harness handles or rejects explicitly | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| TM-017 | P1 | Very fast valid word test | Finite metrics, API range enforced | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| TM-018 | P1 | Ten-minute word-mode ceiling | Exact limit completion and partial-word policy | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| TM-019 | P1 | Clock/frame callback after restart | Stale callback cannot complete new run | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| TM-020 | P1 | Completion and restart in same frame | Exactly one immutable result | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| TM-021 | P0 | Events at 999.999/1000/1000.001 ms | Sub-millisecond capture normalizes and assigns the intended bucket | PASS | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#case-coverage) |
| TM-022 | P0 | Completion at 494.99/495/499/500/1495 ms | Event hundredth-ms normalization, aggregate 10 ms rounding, and graph-tail decisions match the pinned source | PASS | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#case-coverage) |
| TM-023 | P0 | Word test ends at raw 1995 ms | Monkeytype emits only the 1000 ms point; Rill intentionally preserves the normalized 2000 ms boundary instead of copying the reference data-loss defect | DIFF | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#intentional-difference) |
| TM-024 | P0 | Word test ends 0.01–4.99 ms after an exact second that its aggregate duration rounds back to | Monkeytype omits post-boundary terminal input from the graph; Rill folds it into the existing final second so the graph agrees with its retained counters and remains persistable, with independently recomputed final values | DIFF | `npm run test:parity:campaign` |

## Statistics and character-accounting matrix

| ID | Pri | Case or boundary | Expected parity/assertion | Status | Last run/evidence |
| --- | --- | --- | --- | --- | --- |
| ST-001 | P0 | Fully perfect trace | All headline and character metrics match | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| ST-002 | P0 | One retained substitution | WPM/raw/accuracy/categories match | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| ST-003 | P0 | One corrected substitution | Historical accuracy/raw behavior matches | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| ST-004 | P0 | One missed character | Missed and whole-word credit match | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| ST-005 | P0 | One extra character | Extra, raw, and accuracy match | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| ST-006 | P0 | Mixed incorrect/extra/missed word | Categories remain mutually consistent | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| ST-007 | P1 | Every character wrong | Zero/finite WPM and valid accuracy | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| ST-008 | P1 | Correct text after many deleted errors | Retained text perfect; historical accuracy lower | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| ST-009 | P1 | No graph samples (<500 ms word run) | Aggregate finite; consistency policy explicit | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| ST-010 | P1 | Exactly one graph sample | Consistency edge behavior matches | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| ST-011 | P0 | Constant burst samples | Consistency equals reference result | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| ST-012 | P0 | Highly variable burst samples | Nonlinear consistency mapping matches | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| ST-013 | P0 | Burst half-rounding vector | Positive `.5` values round identically | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| ST-014 | P1 | Intervals with zero insertions | Burst/consistency stay finite | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| ST-015 | P0 | Whole correct words plus partial prefix | Whole-word/fractional-tail credit matches | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| ST-016 | P0 | Correct-attempt denominator after corrections | Accuracy uses full accepted attempt history | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| ST-017 | P0 | Raw pace after corrections | Reference-retained/raw policy matches | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| ST-018 | P1 | Rounding below/at/above x.xx5 | Raw values and displayed rounding documented | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| ST-019 | P1 | Very low nonzero WPM | No accidental zero or negative result | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| ST-020 | P1 | Very high WPM near persistence limit | Finite result or explicit rejection | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| ST-021 | P0 | Counter invariants | `correctCharacters+incorrectCharacters+extraAttempts ≤ typedCharacters`; attempts and buckets agree | PASS | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#case-coverage) |
| ST-022 | P0 | Three-way recomputation | Frontend, backend aggregates, and independent trace model agree; prefix replay is covered by `GEN-013` | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| ST-023 | P1 | Idempotent resubmission with reordered JSON keys | Same result, no conflict | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| ST-024 | P1 | Same ID with changed semantic payload | Explicit conflict; no silent overwrite | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| ST-025 | P0 | Corrected-error upper bound | Generated results satisfy `correctedErrors ≤ incorrectAttempts` | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |

## Graph-data and graph-interaction matrix

| ID | Pri | Case or boundary | Expected parity/assertion | Status | Last run/evidence |
| --- | --- | --- | --- | --- | --- |
| GR-001 | P0 | WPM series | Correct cumulative points and solid encoding | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| GR-002 | P0 | Raw series | Correct points and dashed encoding | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| GR-003 | P0 | Burst series | Correct interval points and dotted encoding | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| GR-004 | P0 | Error series | Correct per-window counts and cross markers | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| GR-005 | P0 | WPM Y axis | Zero and readable automatic intervals include all points | PASS | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#case-coverage) |
| GR-006 | P0 | Error Y axis | Aligned endpoints and sufficient range | PASS | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#case-coverage) |
| GR-007 | P0 | X axis | Seconds/subseconds label every useful boundary | PASS | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#case-coverage) |
| GR-008 | P0 | Average/peak summary | Derived from intended series; no omitted-tail peak | PASS | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#case-coverage) |
| GR-009 | P0 | Smooth interpolation | Passes through samples with no overshoot | PASS | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#case-coverage) |
| GR-010 | P1 | One sample | No invalid path or misleading curve | PASS | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#case-coverage) |
| GR-011 | P1 | No samples | Honest empty graph state | PASS | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#case-coverage) |
| GR-012 | P1 | All samples equal | Stable scale and straight semantic trend | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| GR-013 | P1 | Sharp rise/fall | Curve does not invent negative or higher peak | PASS | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#case-coverage) |
| GR-014 | P0 | Pointer first/last point | Tooltip stays fully inside viewport | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| GR-015 | P0 | Pointer every middle point | Nearest point and values are correct | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| GR-016 | P1 | Pointer leaves chart | Tooltip dismissal is predictable | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| GR-017 | P0 | Keyboard Arrow/Home/End | Exact sample announced and selected | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| GR-018 | P1 | Touch tap and outside dismissal | Tooltip pins/dismisses without hover dependency | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| GR-019 | P1 | Tooltip at narrow/mobile viewport edge | No clipping or horizontal page overflow | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| GR-020 | P1 | Tooltip with 3-digit/4-digit values | Layout remains readable and contained | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| GR-021 | P1 | Series distinguishability without color | Line patterns/markers and legend remain clear | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| GR-022 | P1 | Paper/nocturne/tide themes | Contrast and semantic values remain correct | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| GR-023 | P1 | Reduced motion | No unnecessary chart/result animation | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| GR-024 | P1 | Resize after completion | Reflow preserves samples, tooltip, and axes | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| GR-025 | P1 | Touch first/middle/last point | Every point can be selected without hover | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| GR-026 | P1 | Touch drag/scrub and `pointercancel` | No stuck tooltip, accidental value, or lost page control | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| GR-027 | P1 | Vertical page scroll beginning on chart | Chart does not trap the intended scroll gesture | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| GR-028 | P1 | Orientation change with a selected point | Selection is retained or dismissed predictably, never clipped | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| GR-029 | P1 | Resize/theme switch while chart has focus | Focus and selected sample remain coherent | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| GR-030 | P1 | Screen-reader repeated sample navigation | Concise changed values are announced without a noisy full-chart replay | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| GR-031 | P1 | Zero-error and high-error scales | Error axis stays intelligible at both extremes | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| GR-032 | P0 | Corrected errors by interval | Error markers follow attempted errors, including later-corrected input | PASS | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#case-coverage) |

## State, restart, focus, and navigation matrix

| ID | Pri | Case or boundary | Expected parity/assertion | Status | Last run/evidence |
| --- | --- | --- | --- | --- | --- |
| UI-001 | P0 | Initial ready state | No timer/stat mutation before accepted input | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| UI-002 | P0 | Active state | Controls do not shift the typing surface | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| UI-003 | P0 | Completion state | Snapshot and graph appear once | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| UI-004 | P0 | Escape while running | Fresh prompt/state and focused capture | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| UI-005 | P0 | Enter from completed capture/result/chart | Fresh test without accidental typing | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| UI-006 | P1 | Escape while account dialog open | Closes dialog; does not restart | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| UI-007 | P1 | Enter on native control/dialog | Activates control; does not global-restart | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| UI-008 | P1 | Click/tap prompt after blur | Capture focus restored | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| UI-009 | P1 | Focus leaves and returns | Logical caret/state unchanged | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| UI-010 | P1 | Config change while ready | New prompt/config resets correctly | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| UI-011 | P1 | Config change during run | Explicitly prevented or reset; never mixes configs | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| UI-012 | P1 | Rapid repeated restart | No stale prompt/result/timer | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| UI-013 | P1 | Navigate away/back during ready/run/result | Defined state and no hidden double timer | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| UI-014 | P1 | Browser back/forward | Correct page and active navigation state | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| UI-015 | P1 | Small-screen controls and typing surface | No layout jump, overlap, or inaccessible control | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| UI-016 | P1 | Network panel during typing | No request on each keystroke | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| UI-017 | P1 | Reload/crash mid-test | No corrupt or falsely completed result | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| UI-018 | P1 | Page freeze/resume or system suspend | Deadline and recovery behavior are explicit | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| UI-019 | P1 | Back-forward cache restore | No resurrected listener, timer, or stale result | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| UI-020 | P1 | Same origin open in multiple tabs | Config/history events do not corrupt active typing | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| UI-021 | P1 | Offline transition during run | Keystroke path and guest completion continue | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| UI-022 | P1 | Rapid restart with out-of-order prompt responses | Only the newest prompt becomes active | N/A | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#not-applicable) |
| UI-023 | P1 | Rapid config changes with aborted requests | No stale prompt/config pairing | N/A | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#not-applicable) |
| UI-024 | P1 | Route unmount/remount while callbacks are pending | Listeners/timers are cleaned up exactly once | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| UI-025 | P1 | Async web-font load during typing | No logical caret drift or disruptive layout shift | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |

## Persistence, API, history, and failure matrix

These cases verify Rill reliability. Monkeytype comparison is `N/A` where there
is no portable external API or equivalent account setup.

| ID | Pri | Case or boundary | Expected Rill behavior | Status | Last run/evidence |
| --- | --- | --- | --- | --- | --- |
| API-001 | P0 | Guest result save/reload | Exact current-schema result survives | PASS | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#case-coverage) |
| API-002 | P1 | Guest retention limit | Deterministic newest-first pruning | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| API-003 | P1 | Malformed or structurally corrupt local storage | Safe empty fallback; no crash | PASS | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#case-coverage) |
| API-004 | P1 | Unavailable/quota-full local storage | Clear non-destructive failure | PASS | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#case-coverage) |
| API-005 | P0 | Register/login/save/history/logout/login | Every server-supported result field round-trips; variants cover word/time/limit/exhaustion | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| API-006 | P0 | Network fails at result submission | Pending queue retains result | PASS | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#case-coverage) |
| API-007 | P0 | Pending retry succeeds | One server result; queue entry removed | PASS | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#case-coverage) |
| API-008 | P1 | Permanent validation failure | Invalid pending item discarded with feedback | PASS | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#case-coverage) |
| API-009 | P1 | Duplicate client result ID/same payload | Idempotent success | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| API-010 | P1 | Duplicate ID/different payload | Conflict; original remains | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| API-011 | P0 | Invalid counter relationships | API rejects without persistence | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| API-012 | P0 | Invalid bucket duration/order/totals | API rejects without persistence | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| API-013 | P1 | Missing/unknown JSON field or type | Stable problem response, no internals leaked | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| API-014 | P1 | Oversized payload/counters | Validated/rejected within limits | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| API-015 | P1 | Concurrent identical submissions | Exactly one stored result | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| API-016 | P1 | Concurrent different submissions | No cross-account/cross-result corruption | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| API-017 | P0 | Legacy account pace shape | Aggregate consistency preserved; graph empty | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| API-018 | P0 | Populated V1 database upgraded through V4 | Rows preserved; new writes constrained | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| API-019 | P1 | Pre-release browser v1 history exists | Preserved/disclosed; not falsely converted | PASS | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#case-coverage) |
| API-020 | P1 | Pagination first/middle/last/invalid cursor | Stable order, no duplicate/missing row | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| API-021 | P1 | Delete account with results/pending data | Server deletion and local ownership handling | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| API-022 | P1 | Backend unavailable on initial load | Typing remains usable as designed; clear status | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| API-023 | P1 | Prompt endpoint failure/malformed response | Retry/error state, no placeholder scoring | N/A | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#not-applicable) |
| API-024 | P1 | Server/client clock or locale difference | ISO times/order stable; scoring uses duration, not wall clock | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| API-025 | P1 | Offline/online transition during queue flush | No loss, duplicate, or endless retry loop | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| API-026 | P1 | Out-of-order prompt responses | Obsolete response cannot replace current prompt | N/A | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#not-applicable) |
| API-027 | P1 | Request aborted by navigation/restart | No unhandled rejection or late state mutation | N/A | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#not-applicable) |
| API-028 | P0 | Account `completionReason` round-trip: word/time/limit/exhaustion | Original semantic reason survives or the unsupported field is removed/disclosed | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| API-029 | P1 | Account `completedAt` round-trip | Server-canonical timestamp is documented and tested instead of claimed client-exact | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| API-030 | P1 | Structurally valid local result with false WPM/raw/accuracy | Derived metrics are recomputed/rejected rather than trusted | PASS | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#case-coverage) |
| API-031 | P0 | Payload where `correctedErrors > incorrectAttempts` | API/local/DB validation rejects it | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |

## Browser, accessibility, and responsive matrix

| ID | Pri | Case or boundary | Required Rill behavior | Status | Last run/evidence |
| --- | --- | --- | --- | --- | --- |
| BR-001 | P0 | Current Chromium desktop | Core trace and chart pass | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| BR-002 | P0 | Current Firefox desktop | Core trace and chart pass | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| BR-003 | P0 | Playwright WebKit on its recorded host OS | Core trace and chart pass; not mislabeled as shipping Safari | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| BR-004 | P1 | Mobile Chromium emulation | Core touch/layout pass; label as emulation | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| BR-005 | P1 | Physical Android keyboard | Composition/autocorrect behavior recorded | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| BR-006 | P1 | Physical iOS keyboard | Composition/autocorrect behavior recorded | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| BR-007 | P1 | Windows/macOS/Linux physical keyboard | Key/control differences recorded | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| BR-008 | P1 | 320×568 viewport | No clipping/horizontal page scroll | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| BR-009 | P1 | 768×1024 viewport | Intentional tablet composition | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| BR-010 | P1 | 1366×768 viewport | Typing/results remain dominant and visible | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| BR-011 | P1 | 1920×1080 and ultrawide | Line length/position remain deliberate | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| BR-012 | P0 | Keyboard-only complete workflow | Every action reachable with visible focus | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| BR-013 | P1 | Generic screen-reader semantic smoke test | Landmarks, names, focus order/restoration, non-noisy typing status, result reading order, graph alternative, and point announcement | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| BR-014 | P1 | Automated accessibility scan | No serious/critical violation and every moderate finding evaluated through `BR-032` | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| BR-015 | P1 | 200% text zoom/400% page zoom | Content remains operable and understandable | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| BR-016 | P1 | Forced colors/high contrast | Focus, errors, and graph series remain identifiable | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| BR-017 | P1 | `prefers-reduced-motion` | Motion reduced without losing state feedback | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| BR-018 | P1 | Pointer coarse/fine and no-hover | Equivalent tooltip/result access | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| BR-019 | P1 | Slow CPU/background throttling | Deadline and immutable completion remain correct | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| BR-020 | P1 | Console/runtime inspection | No hidden exception, warning loop, or failed asset | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| BR-021 | P1 | Shipping Safari on macOS/iOS | Physical Safari behavior is recorded separately from Playwright WebKit | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| BR-022 | P1 | 390×844 and safe-area/notch | Dynamic viewport and insets do not clip controls/tooltip | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| BR-023 | P1 | 1024×768 landscape | Tablet/compact-desktop composition remains deliberate | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| BR-024 | P1 | 1440×900 and 1536×864 | Common laptop/desktop layouts remain balanced | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| BR-025 | P1 | Portrait↔landscape orientation change | Test state survives; layout and focus recover | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| BR-026 | P1 | Virtual keyboard opens/closes | Visual viewport changes do not hide current line/caret | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| BR-027 | P1 | OS text scaling and browser minimum font size | Content remains understandable and operable | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| BR-028 | P1 | Touch target sizing | Interactive targets meet the documented 44×44 intent or justified equivalent | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| BR-029 | P1 | NVDA + Firefox and NVDA + Chrome | Names, landmarks, focus, results, and chart navigation are usable | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| BR-030 | P1 | VoiceOver + Safari | Names, focus, typing feedback, results, and graph alternative are usable | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| BR-031 | P1 | TalkBack + Chrome | Mobile focus, typing feedback, controls, and results are usable | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| BR-032 | P1 | Accessibility finding review | Every automated moderate-or-higher finding is evaluated, not silently tolerated | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |

## Generated and model-based coverage

These rows cover combinations that should not be handwritten one by one.
Generated tests must store their seed and minimize any failing trace.

| ID | Pri | Generator/property | Required invariant | Status | Last run/evidence |
| --- | --- | --- | --- | --- | --- |
| GEN-001 | P0 | Random correct/wrong/space/backspace traces | Rill and an independently implemented Rill-contract model agree prefix by prefix; counters never negative | PASS | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#case-coverage) |
| GEN-002 | P0 | Random timestamps around second boundaries | Rill and an independently implemented Rill-contract model assign identical buckets/totals | PASS | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#case-coverage) |
| GEN-003 | P0 | Random retained word/input pairs | Independent classifier and Rill emit identical categories/invariants | PASS | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#case-coverage) |
| GEN-004 | P1 | Random corrected-error histories | Independent model confirms retained text and historical accuracy separation | PASS | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#case-coverage) |
| GEN-005 | P0 | Random bucket vectors | Frontend, backend, and independent model derive identical metrics | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| GEN-006 | P0 | Random positive half-rounding vectors | JavaScript, Java, and independent decimal oracle agree | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| GEN-007 | P1 | Random resize/hover sample positions | Tooltip remains contained and points to intended sample | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| GEN-008 | P1 | Pairwise mode/config/browser matrix | Every parameter pair appears in a valid run | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| GEN-009 | P1 | High-risk 3-way: correction × boundary × mode | Same counters and buckets on both sites | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| GEN-010 | P1 | High-risk 3-way: extra × wrap × viewport | No logical or visual position drift | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| GEN-011 | P1 | High-risk 3-way: expiry × blur × delayed callback | One exact completion | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| GEN-012 | P0 | Mutation tests for scoring/validation/reference harness | Required mutations are killed; shared-wrong implementations cannot self-confirm | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| GEN-013 | P0 | Prefix-by-prefix state-model comparison | After every event, word index, retained text, attempts, categories, state, and completion match the independent model | PASS | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#case-coverage) |
| GEN-014 | P1 | Random sub-millisecond traces | Integer-microsecond normalization and millisecond conversion preserve boundary decisions | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |

## Security and performance controls

These are release controls rather than Monkeytype-parity assertions.

| ID | Pri | Case or boundary | Required Rill behavior | Status | Last run/evidence |
| --- | --- | --- | --- | --- | --- |
| NF-001 | P0 | HTML/script-like typed input | Rendered as text; no execution | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| NF-002 | P0 | Malicious API strings/JSON | Validation or safe storage; no SQL/script injection | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| NF-003 | P0 | Cross-account result/history access | Denied without data disclosure | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| NF-004 | P0 | Cross-site state-changing request | CSRF/origin controls work as configured | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| NF-005 | P1 | Hostile/unlisted CORS origin | No unintended credentialed access | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| NF-006 | P1 | Authentication abuse/rate limit | Stable throttled response and recovery | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| NF-007 | P1 | Keystroke critical-path profiling | No network request; bounded scripting/render work | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| NF-008 | P1 | Longest supported test trace | No growing layout shift or input-latency cliff | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| NF-009 | P1 | History maximum/pagination | Bounded response/render cost | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| NF-010 | P1 | Production headers/error responses | No secrets, stack traces, or duplicate policy headers | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| NF-011 | P1 | Dependency audit | Findings evaluated; no unexplained high/critical issue | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |
| NF-012 | P1 | Production clean build/start/health | Reproducible and healthy from documented inputs | BLOCKED | [campaign](evidence/20260726T190914Z-final-mixed-8b4dce69/run.md#blocked-cases) |

## Intentional scope differences

These must remain visible so that “parity” is never misreported as complete
Monkeytype feature equivalence.

| ID | Monkeytype capability | Rill release-1 position | Status | Evidence/rationale |
| --- | --- | --- | --- | --- |
| SCOPE-001 | Quote tests | Not implemented | N/A | Product scope |
| SCOPE-002 | Zen/custom free typing | Not implemented | N/A | Product scope |
| SCOPE-003 | Languages beyond the Rill English prompt set | Not implemented as target generation | N/A | Product scope |
| SCOPE-004 | Alternative word lists/difficulties | Not implemented | N/A | Product scope |
| SCOPE-005 | Stop-on-error/freedom/master behaviors | Not implemented | N/A | Product scope |
| SCOPE-006 | Funbox/caret/sound appearance options | Not parity targets | N/A | Original product/design requirement |
| SCOPE-007 | Multiplayer/leaderboards | Not implemented | N/A | Product scope |
| SCOPE-008 | Monkeytype account/import/export ecosystem | Not a portable oracle | N/A | Separate products |
| SCOPE-009 | Exact chart interpolation and pixel design | Intentionally original; sample semantics are the target | N/A | IP/design boundary |
| SCOPE-010 | Monkeytype bugs or inaccessible behavior | Must not be copied automatically | N/A | Rill correctness/accessibility takes priority |

## Mandatory release subset

A release cannot claim supported-mode **desktop parity** unless all of these are
current `PASS` results under the required oracle class:

- `ENV-001` through `ENV-012`, plus `ENV-017` through `ENV-023`;
- `IN-001` through `IN-024`, `IN-027` through `IN-040`,
  `IN-055`, and `IN-056`;
- `WD-001`, `WD-006` through `WD-018`, and `WD-021` through `WD-025`;
- `TM-001` through `TM-012`, `TM-015`, and `TM-017` through `TM-022`;
- all `ST-*`;
- all `GR-*`;
- `UI-001` through `UI-012`, `UI-016`, and `UI-024`;
- `API-001`, `API-005` through `API-018`, `API-022`, and `API-028` through
  `API-031`;
- `BR-001` through `BR-004`, `BR-012` through `BR-020`, `BR-022` through
  `BR-024`, and `BR-032`;
- `GEN-001` through `GEN-006`, `GEN-008`, `GEN-009`, and `GEN-011` through
  `GEN-013`;
- all P0 `NF-*` controls.

Additional claim profiles have additional gates:

| Claim profile | Additional required rows |
| --- | --- |
| Physical mobile input parity | `BR-005`, `BR-006`, `BR-021`, `BR-025` through `BR-028`, `BR-030`, `BR-031`, `IN-031`, `IN-032`, `IN-043`, and `IN-047` through `IN-054`, on at least one current physical Android and one current physical iOS device |
| Named screen-reader support | `BR-029` through `BR-032` for every browser/AT pair named in the release report |
| Full responsive-layout support | `BR-008` through `BR-011` and `BR-022` through `BR-028`, including every listed variant |

If physical mobile rows are unavailable, the release may claim responsive
browser/emulation coverage but not physical mobile input parity.

Any `NR`, `DIFF`, `BUG`, `BLOCKED`, `INVALID`, or `STALE` row in the applicable
subset must be named in the release report. Reports aggregate counts separately
for `MT-ENGINE`, `MT-LIVE`, `RILL`, `A11Y`, and `SEC-PERF`; they must never
collapse Rill-only evidence into “all the same.”

## Difference triage

For every `DIFF`:

1. reproduce with a frozen prompt and deterministic timestamped trace;
2. state expected and observed values;
3. locate the first divergent event, counter, or graph bucket;
4. determine whether the reference changed, the setup was invalid, Rill has a
   defect, or Rill intentionally follows a safer/correcter contract;
5. add the smallest regression test that proves the decision;
6. fix only after evaluating the evidence;
7. rerun the case, neighboring boundaries, and generated related traces;
8. retain the failed and passing run records.

## Gaps discovered and resolved during ledger audit

The model audit found three implementation defects. Each was reproduced,
reviewed, fixed, covered by a focused regression, and superseded by the passing
campaign evidence:

- `AUDIT-20260727-MODEL-01` (`API-028`): account `completionReason` is now
  persisted and round-tripped through API, entity, V4 migration, and client
  mapping. The server timestamp remains intentionally canonical and is tested
  separately by `API-029`.
- `AUDIT-20260727-MODEL-02` (`API-030`): current browser-history validation now
  recomputes WPM, raw WPM, accuracy, and consistency from validated primitives
  and rejects plausible but fabricated metrics.
- `AUDIT-20260727-MODEL-03` (`API-031`): frontend, backend, and new database
  writes enforce `correctedErrors <= incorrectAttempts`. The V4 database
  constraint is `NOT VALID` so unknowable legacy rows remain upgradeable while
  new writes receive the stronger guarantee.

## Audit log

| Date | Reviewer | Perspective | Findings | Root evaluation | Revision |
| --- | --- | --- | --- | --- | --- |
| 2026-07-27 | `parity_ledger_qa_audit` | Browser, input, accessibility, evidence workflow | 5 high, 7 medium, 4 low; deterministic/live conflation, variant false-pass risk, oracle drift, mobile realism, provenance, and lifecycle/input gaps | Accepted evidence classes, capture/replay protocol, variant manifests, fingerprint invalidation, provenance hashes, per-case verdicts, expanded input/graph/lifecycle/responsive cases, and status history. Modified physical-device advice into explicit claim-profile gates rather than blocking a desktop-only claim. Used fingerprint/release invalidation rather than an arbitrary time expiry. | `WORKTREE` |
| 2026-07-27 | `parity_ledger_model_audit` | Statistics, reducer, timing, data integrity | 3 high, 5 medium, 2 low; missing primitive schemas, self-confirming generated tests, account round-trip mismatch, stronger correction invariant, and fractional boundaries | Accepted normative trace/result/manifest shapes, independent prefix model and mutation gate, primitive bucket comparison, fractional cases, and provenance. Confirmed and recorded three existing implementation gaps as `BUG`; changed account-time expectations to distinguish server-canonical timestamps. | `WORKTREE` |
| 2026-07-27 | `parity_ledger_qa_audit` | Final confirmation | No remaining high/medium QA-artifact finding | Confirmed after root reconciliation; no additional change required. | `WORKTREE` |
| 2026-07-27 | `parity_ledger_model_audit` | Final confirmation | Two medium documentation inconsistencies: millisecond wording contradicted the microsecond schema, and `IN-028` was absent from the desktop gate | Accepted both. Replay now requires exact microsecond normalization/fractional conversion, and the mandatory range includes `IN-028`. All earlier high findings were confirmed resolved. | `WORKTREE` |
| 2026-07-27 | `final_backend_parity_audit` | Backend, timing, data integrity, provenance | No remaining high-severity defect; identified unreproducible backend-test evidence, exact timing-vector gaps, and mutable-worktree provenance | Removed the backend selected-test claim; downgraded unsupported rows; added direct timing regressions; verified the Maven-wrapper fix. Final provenance is bound separately after the tested-source commit. | `WORKTREE` |
| 2026-07-27 | `final_frontend_parity_audit` | Frontend, interaction, accessibility, evidence | No remaining high-severity product issue; identified permanent-discard feedback, focus-copy, curve-bound, stale-browser, and PASS-evidence gaps | Added user feedback/tests, corrected copy, bounded curve controls, downgraded unsupported rows, and invalidated stale-port Browser passes. | `WORKTREE` |
