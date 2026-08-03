# Basic typing interaction behavior

Status: executable regression matrix  
Last updated: 2026-08-03
Scope: common keyboard and word-boundary behavior that the scoring-only parity
campaign cannot exercise

## Why this suite exists

The deterministic parity campaign compares normalized domain events and final
statistics. It does not prove that a real browser delivers shortcuts,
`beforeinput`, focus changes, or word-boundary keys correctly. These cases are
therefore tested separately at the input-adapter, reducer, and rendered-browser
layers.

## Behavior matrix

| ID | Case | Expected behavior | Automated evidence |
| --- | --- | --- | --- |
| BI-001 | `Ctrl+Tab` while ready or running | Rill does not cancel the chord, start the timer, or mutate typing state; the browser remains responsible for changing tabs | `TypingCapture.test.tsx`; `typing-behavior.spec.ts` |
| BI-002 | `Ctrl+Shift+Tab` while ready or running | Same pass-through behavior for reverse tab navigation | `TypingCapture.test.tsx`; `typing-behavior.spec.ts` |
| BI-003 | Correct non-empty prefix then `Space` | Commit the unfinished word, classify its untyped suffix as missing, score the separator as incorrect, and activate the next word | `reducer.test.ts`; `typing-behavior.spec.ts` |
| BI-004 | `Space` on an empty word | Ignore it without advancing, starting, or adding a phantom attempt | `reducer.test.ts`; `typing-behavior.spec.ts` |
| BI-005 | Repeated `Space` after an early commit | Remain on the same next word with no additional missing characters | `reducer.test.ts`; `typing-behavior.spec.ts` |
| BI-006 | `Backspace` after an early commit | Reopen the imperfect previous word and remove its provisional missing count | `reducer.test.ts`; `typing-behavior.spec.ts` |
| BI-007 | Correct the reopened word and finish | Preserve the historical bad separator in accuracy while final retained characters are correct | `reducer.test.ts`; `typing-behavior.spec.ts` |
| BI-008 | Early `Space` in strict mode | Commit a non-empty non-final word and advance. If the committed word is imperfect, later accepted input remains marked incorrect until every retained mistake is corrected | `reducer.test.ts`; `typing.spec.ts` |
| BI-009 | Early `Space` on the final word | In normal mode, complete with the missing suffix and imperfect-word statistics. In strict mode, keep the final word editable while any retained mistake or missing suffix remains | `reducer.test.ts` |
| BI-010 | `Ctrl+Backspace` / native `deleteWordBackward` in the active word | Delete the whole current word as one logical edit while retaining historical attempts | `TypingCapture.test.tsx`; `reducer.test.ts`; `typing-behavior.spec.ts` |
| BI-011 | Word-delete at an empty word after an imperfect word | Reopen and clear the previous imperfect word, including its provisional separator/missing state | `reducer.test.ts`; `typing-behavior.spec.ts` |
| BI-012 | Word-delete at an empty word after a perfect word | Stop at the perfect-word boundary | `reducer.test.ts`; `typing-behavior.spec.ts` |
| BI-013 | Repeated word-delete, ready, completed, and deadline states | Never underflow; ready/completed results remain immutable; expiry wins at the deadline | `reducer.test.ts`; `parityModel.test.ts` |
| BI-014 | Keyboard/IME Unicode separator | Normalize directly typable Unicode spaces to U+0020 and apply ordinary Space behavior | `inputAdapter.test.ts`; `typing-behavior.spec.ts` |
| BI-015 | Two or more graphemes in one `beforeinput` | Preserve order and give the complete browser event one timestamp | `TypingCapture.test.tsx`; `reducer.test.ts`; `parityModel.test.ts` |
| BI-016 | IME composition lifecycle | Start timing on composition start, show pre-edit text, score the final composition once, and reject a late result from an older run | `TypingCapture.test.tsx`; `reducer.test.ts` |
| BI-017 | Backspace/Escape during active composition | Leave retained typing state unchanged until composition resolves | `TypingCapture.test.tsx` |
| BI-018 | Mobile smart punctuation | Normalize equivalent smart quotes, apostrophes, commas, dashes, and ellipsis to the expected target | `inputAdapter.test.ts`; `reducer.test.ts` |
| BI-019 | Excessive overtyping | Accept at most 21 extra graphemes beyond the target word | `reducer.test.ts`; `parityModel.test.ts` |
| BI-020 | Arrow/Home/End/Page keys while capture is focused | Prevent hidden-caret movement and page scrolling without scoring input | `TypingCapture.test.tsx` |
| BI-021 | Paste, drop, replacement, history, and unsupported mutations | Prevent the mutation before it reaches the hidden field and do not score it | `inputAdapter.test.ts`; `TypingCapture.test.tsx` |
| BI-022 | Printable key after non-editable focus leaves the prompt | Refocus the capture field and swallow the recovery key so it is not scored accidentally | `TypingPage.tsx`; `typing-behavior.spec.ts` |
| BI-023 | Plain `Tab` while ready, running, or completed | Focus the visible restart action without starting, restarting, or mutating the test; `Enter` then restarts | `TypingCapture.test.tsx`; `TypingPage.test.tsx`; `typing-behavior.spec.ts` |
| BI-024 | Restart keys | `Escape` restarts from ready, running, or completed state; `Enter` restarts only from completed state | `TypingCapture.test.tsx`; `typing-behavior.spec.ts` |
| BI-025 | Backspace through strict-tainted exact words | Reopen exact words that are red only because of an earlier retained mistake, continue back to that mistake, then restore the normal perfect-word boundary after correction | `reducer.test.ts`; `typing.spec.ts` |
| BI-026 | `Ctrl+Backspace` through strict-tainted words | Clear one active word per command and allow repeated commands to reach the retained mistake without underflowing or crossing a genuinely perfect pre-error boundary | `reducer.test.ts`; `typing.spec.ts` |

## Reference observations

On 2026-07-28, the public Monkeytype page identified itself as `v26.28.0`.
In a 10-word normal test whose first targets were `must stand`, trusted browser
input `m`, `u`, `Space` produced:

- `must` became a typed error;
- `m` and `u` remained correct;
- the untyped `s` and `t` remained part of the target;
- `stand` became active; and
- another `Space` at the empty `stand` input did not advance.

The same rendered-browser sequence in Rill used `path ground`: `p`, `a`,
`Space` committed `path`, marked `t` and `h` missing, and activated `ground`.

The pinned Monkeytype source at
`7feea96c5df21a59af9553fa7c52eb33af5997b8` independently confirms both
policies:

- ordinary `Ctrl+Tab` is not prevented unless the prompt contains a literal tab;
- normal mode advances from a non-empty unfinished word on `Space`.

## Evidence boundary

Web applications cannot perform browser-chrome tab switching themselves. The
automated assertion is therefore the relevant application contract: Rill must
leave `Ctrl+Tab` and `Ctrl+Shift+Tab` uncancelled and must not mutate its typing
state. The browser or operating system owns the actual tab change.

The public-site observations establish live interaction behavior, not
identical-timestamp numerical parity. Deterministic scoring comparison,
including the documented `TM-023` and `TM-024` classifications, remains
covered by the pinned engine campaign.

## Remaining environment-dependent cases

These are tracked separately and are not implied by the completed matrix above:

- real browser-background lifecycle after `Ctrl+Tab`, including focus return,
  elapsed time, deadline expiry, and exactly-once acceptance of the next key;
- physical Option+Backspace delivery on macOS (the native
  `deleteWordBackward` path and an Alt-modified fallback are covered
  automatically, but this machine is Windows);
- composition interrupted by an actual browser tab switch or visibility
  change; and
- physical browser-chrome focus behavior after focus has already left the page;
  while the typing capture owns focus, plain `Tab` is verified to focus Rill's
  visible restart action.

## Specialist audit and engineering decisions

An independent source audit compared Rill with pinned Monkeytype commit
`7feea96c5df21a59af9553fa7c52eb33af5997b8`. The accepted findings were
whole-word deletion, Unicode separators, same-event timestamps, IME lifecycle
guards and feedback, smart punctuation, bounded overtyping, navigation-key
blocking, focus recovery, and immediate rejection of unsupported mutations.

The following findings were deliberately not copied:

- Monkeytype's UTF-16 character assumptions: Rill remains grapheme-aware.
- Rendering the entered wrong glyph: Rill keeps the expected glyph in place
  and marks it red, preserving stable spacing.
- Command palette, zen mode, funboxes, freedom/confidence modes, and
  literal-tab prompts: these are product
  features, not universal single-player typing-input behavior.
- Monkeytype separates freedom, stop-on-error, and confidence settings. Rill's
  cascading-red strict policy is an intentional product contract rather than
  a claim that one Monkeytype setting behaves identically.
- Monkeytype's configurable command palette and alternate quick-restart
  bindings remain absent. Rill now exposes the familiar visible restart action
  and `Tab`-then-`Enter` sequence directly.
- Aggregate word-delete events: Rill emits one retained-input deletion event
  per removed grapheme because its replay/statistics model requires that
  granularity.

## Latest verification

Run date: 2026-08-03 (Asia/Manila)

Completed and verified:

- `npm test -- --run` - 260 tests passed in 19 files.
- `npm.cmd run typecheck` - passed.
- `npm.cmd run lint` - passed with zero warnings.
- `npm.cmd run build` - passed; Vite transformed 103 modules and produced a
  362.49 kB JavaScript bundle (108.34 kB gzip).
- A production-preview strict correction trace passed 4/4 in Chromium,
  Firefox, WebKit, and mobile Chromium. It covered forward Space, cascading
  red input, plain Backspace reopening, repeated `Ctrl+Backspace` from empty
  boundaries, origin repair, and green retyping.
- A separate Playwright CLI visual probe reproduced `xonsider face`, reopened
  `face` with Backspace, and traversed to `consider` with repeated word
  deletion. The screenshot showed the expected stable red target glyphs,
  caret, layout, and no error overlay.
- Earlier on 2026-07-28, `$env:E2E_BASE_URL='http://127.0.0.1:4174'; npm.cmd run test:e2e` -
  138 passed, 10 capability/environment skips, and 0 failed across Chromium,
  Firefox, WebKit, and mobile Chromium. This full matrix supersedes the smaller
  focused browser totals retained below as useful historical evidence.
- `npm.cmd run test:code-corpus` validated all 64 JavaScript and TypeScript
  drills plus 33 behavior cases in each language, compiled all 64 Python and
  Java drills, and explicitly skipped C, C++, C#, and Go because those host
  toolchains were unavailable.
- `$env:E2E_BASE_URL='http://127.0.0.1:4173'; npx.cmd playwright test
  e2e/typing-behavior.spec.ts --workers=1` - 32/32 passed: all eight scenarios
  in Chromium, Firefox, WebKit, and mobile Chromium. This covers uncancelled
  `Ctrl+Tab`/`Ctrl+Shift+Tab`, plain `Tab` restart focus, early Space and
  correction, whole-word deletion and the perfect-word boundary, Unicode
  separators, stable IME pre-edit placement, focus recovery, exactly-once and
  canceled composition, and Escape/completed-Enter restart.
- The first current 32-case rerun ended 20 passed/12 failed because three E2E
  checks still expected the deliberately removed `.is-active` visual class.
  Runtime behavior and semantic current-word state were correct. The stale
  visual assertions were replaced with caret/current-target assertions; the
  clean serial rerun then passed 32/32.
- `$env:E2E_BASE_URL='http://127.0.0.1:4173';
  $env:E2E_EXPECTED_BUILD_ID='source-7bb064a2a42c739a'; npx.cmd playwright test
  e2e/typing.spec.ts --grep "serves the expected source build|has no automated
  accessibility violations|reflows without horizontal overflow|keeps all
  primary states operable" --workers=1` - 16/16 passed across all four
  projects. The lane verified the exact source build, three themes and primary
  states with axe, the visible restart control, 320 px overflow behavior, and
  nine viewports from 320x568 through 2560x1080.
- A focused four-project rerun of the two corrected prompt-state scenarios
  passed 8/8.
- `$env:E2E_BASE_URL='http://127.0.0.1:4173'; npm.cmd run test:e2e --
  e2e/typing.spec.ts --grep "keeps prompt type fixed and wraps" --workers=1`
  - 4/4 passed across Chromium, Firefox, WebKit, and mobile Chromium. Each
  project checked 12 viewports from 320x568 through 2560x1080, for 48 layout
  checks total. The lane verifies a fixed 32 px prompt size, natural word
  wrapping, prompt and word bounds, centered frame geometry, and no horizontal
  overflow.
- A broader exact-build responsive, accessibility, and prompt-geometry lane
  passed 28/28 across the same four projects.
- Read-only Chromium visual probes at 1920x1080 and 390x844 confirmed the
  prompt fills the restrained content column, keeps the same word size, and
  gains wrapped rows instead of shrinking on the narrow viewport. The restart
  control remained centered and visible without scrolling. Screenshots showed
  no clipping, overlap, horizontal overflow, error overlay, or stale loading
  state. There were zero page exceptions and no warnings; the preview recorded
  only its existing missing `favicon.ico` resource.
- With `MONKEYTYPE_SOURCE_ROOT` set to the clean pinned checkout at
  `7feea96c5df21a59af9553fa7c52eb33af5997b8`,
  `npm.cmd run test:parity:oracle` passed its full-field canary and
  `npm.cmd run test:parity:campaign` passed all 5 campaign tests. The campaign
  executed 10,000 seeded traces: 8,219 exact matches, 1,757 documented
  `TM-023` rollover corrections, 24 documented `TM-024` terminal-rollover
  corrections, and 0 unclassified differences. The machine-readable evidence
  is `docs/testing/evidence/parity-campaign/latest.json`.
- The current source and rendered reruns preserve the reconciled specialist
  decisions: Rill remains grapheme-aware; wrong input marks the stable expected
  glyph rather than substituting the entered glyph; graph rollover corrections
  remain limited to TM-023/TM-024; plain `Tab` focuses Rill's restart action
  while modified browser-tab chords remain browser-owned; and
  word deletion retains per-grapheme replay events. No previously accepted
  audit finding regressed.

Environment limitation:

- Browser security correctly protected the user's existing port-4173 tab from
  automation. A separate production preview on port 4174 was controlled
  successfully without navigating or stopping the user's session. It supplied
  the current manual viewport, structural-indent, caret, Ctrl+Backspace, and
  console checks; mathematical parity still comes from the clean pinned source
  oracle rather than the live website.
- Web applications and Playwright cannot prove an operating-system browser tab
  switch. The verified application contract is that the Ctrl+Tab chords are not
  canceled and do not mutate or start the test.
- IME coverage uses correctly constructed synthetic browser
  `CompositionEvent`s. Physical IME candidate-window behavior, composition
  interrupted by an actual tab switch, and macOS Option+Backspace delivery
  remain environment-dependent.
- The available Node runtime is `v22.20.0`, below this repository's declared
  `>=22.22.0` engine floor. The commands above did pass on it, but a supported
  Node 22.22+ or 24 clean-state rerun remains required.
