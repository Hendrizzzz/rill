# Rill typing contract

Status: normative release-1 contract
Last updated: 2026-07-26

This document removes ambiguity from the keystroke-critical path. The reducer, browser input adapter, score calculator, API validator, and tests must all follow it.

## Text and input scope

- Prompt content is English and consists of ASCII letters, spaces, the punctuation set `.,?!:;'-`, and digits.
- Target words are stored as arrays of Unicode grapheme clusters even though release-1 targets are ASCII.
- Committed browser input is split with `Intl.Segmenter` at grapheme granularity. The fallback is `Array.from`, documented as less complete for joined emoji.
- A non-ASCII grapheme is accepted as one incorrect attempt. Full multilingual prompt/IME authoring is out of scope.
- Auto-capitalisation, autocorrect, autocomplete, and spellcheck are disabled on the capture textarea.
- Paste, drop, replacement, undo, and redo insertion types are rejected without changing typing state. A polite status announces that paste is disabled.

## Domain state

```text
TestState
  status: ready | running | completed
  config: mode, modeValue, punctuation, numbers
  prompt: promptId, seed, wordListVersion, generatorVersion, words[]
  wordIndex
  committedWords[]
  currentInput[]
  startedAt
  deadline (time mode only)
  completedAt
  typedCharacters
  correctAttempts
  incorrectAttempts
  missingCharacters
  extraAttempts
  correctedErrors
  paceBuckets[]
  resultSnapshot
```

`resultSnapshot` is created exactly once. A completed state does not accept typing actions.

## Input adapter

The real textarea is visually unobtrusive but not `display:none`, disabled, or removed from the accessibility tree.

Native browser events are translated outside the reducer:

| Browser event | Policy | Domain action |
| --- | --- | --- |
| `beforeinput: insertText` | Prevent default; segment non-null data; preserve order | one `INSERT_GRAPHEME` per grapheme |
| Composition start/update | Allow the IME to compose; do not score intermediate data | none |
| Composition end | Segment the committed composition string, clear capture value | one `INSERT_GRAPHEME` per grapheme |
| `beforeinput: deleteContentBackward` | Prevent default | `BACKSPACE` |
| `beforeinput: insertFromPaste` / `insertFromDrop` | Prevent default, announce rejection | none |
| `beforeinput` replacement/history types | Prevent default | none |
| `keydown: Escape` | Only while capture owns focus and no dialog is open | `RESTART` |
| `keydown: Enter` | In completed state from the capture, result surface, or pace scrubber; native controls and dialogs retain Enter | `RESTART` |
| `keydown: Tab` | Never intercepted | native focus movement |

- Printable `keydown` is not separately scored, avoiding duplicate physical-key and `beforeinput` handling.
- `Ctrl`, `Alt`, and `Meta` shortcuts are not intercepted.
- Key repeat generates repeated input events and is counted normally.
- The adapter clears any incidental textarea value after handling input.
- Clicking/tapping the prompt focuses the textarea. Blur never pauses elapsed time.
- A modal has shortcut precedence: `Escape` closes the modal and never restarts a test.

The adapter has independent tests using realistic `InputEvent` and composition sequences. A resized Playwright viewport is not considered proof of a physical mobile software keyboard.

## Start and deadline semantics

- `ready` becomes `running` immediately before the first accepted `INSERT_GRAPHEME`.
- Rejected paste/drop/history events, backspace on an empty word, Tab, modifiers, and repeated space on an empty word do not start the clock.
- The controller passes one monotonic `performance.now()` timestamp with every action that can affect time.
- A time test stores `deadline = startedAt + modeValue * 1000`.
- Before processing every input, the reducer/controller checks the timestamp. If `now >= deadline`, it completes at the exact deadline before considering the input. A character at equality is not accepted.
- `requestAnimationFrame` and a timeout are wake-up/display mechanisms only. A delayed callback cannot extend a test.
- Elapsed time continues while the tab is blurred/backgrounded. When execution resumes after the deadline, the test completes at the deadline.
- Word tests have a 10-minute ceiling. At the ceiling they complete with the typed partial result and a `limit reached` status; the unfinished current word does not add missing characters unless the user explicitly committed it.

## Word and character semantics

### Inserting a grapheme

For the current word:

- At an index within the target, an exact case-sensitive match increments `correctAttempts`.
- At an index within the target, a mismatch increments `incorrectAttempts`.
- Beyond the target length, an insertion increments `incorrectAttempts` and `extraAttempts`.
- Every accepted insertion increments `typedCharacters`.
- Historical attempt counters are never decremented by backspace.

Space is handled as a separator rather than inserted into `currentInput`:

- If `currentInput` is empty, space is ignored.
- For every non-final word, space commits the current word, increments `typedCharacters` and `correctAttempts` for the expected separator, and advances.
- For the final word in a word test, space submits/commits but is not counted because the target has no trailing separator.
- Consecutive spaces after a commit are therefore ignored.

### Committing a word

- A non-empty current word may be committed even when incorrect.
- Unfilled target positions at commit increment `missingCharacters`.
- Mismatched filled positions are already incorrect attempts and are not also marked missing.
- Extra positions remain extra attempts.
- At an empty current word, backspace reopens the immediately previous word
  when its final aligned input is imperfect (a substitution, missing suffix,
  or extra character).
- A perfectly aligned committed word remains locked.
- In a word test, an exact final word completes automatically on its final expected grapheme.
- An incorrect final word completes when the user submits it with space.
- In a time test, the current partial word is included visually and in final-position correctness at expiry, but its untyped suffix is not marked missing.

### Backspace

- Backspace removes one grapheme from a non-empty current word.
- At an empty word boundary, one backspace removes the separator and reopens
  only an imperfect previous word; it does not delete a previous grapheme
  until the next backspace.
- Reopening removes that word's provisional missing-character count and final
  aligned separator, while historical attempt counters remain unchanged.
- Removing a grapheme whose position was incorrect or extra increments `correctedErrors`.
- Removing a correct grapheme does not increment `correctedErrors`.
- Attempt counters remain historical; retyping adds a new attempt.
- Backspace on an empty current word does nothing when there is no previous
  word or the previous word is perfectly aligned.

## Result counters and formulas

`correctCharacters` is calculated from the final aligned text, not historical attempts:

- count each grapheme whose final position exactly matches its target;
- count one separator for every committed non-final word;
- do not count a trailing submit space.

The following invariants hold:

```text
typedCharacters = correctAttempts + incorrectAttempts
0 <= correctCharacters <= typedCharacters
0 <= extraAttempts <= incorrectAttempts
0 <= correctedErrors <= typedCharacters
```

Canonical metrics:

```text
minutes = durationMilliseconds / 60_000
rawWpm = typedCharacters / 5 / minutes
wpm = correctCharacters / 5 / minutes
accuracy = correctAttempts / (typedCharacters + missingCharacters) * 100
```

If the accuracy denominator is zero, accuracy is `100`. Values are rounded to two decimals with half-up rounding only at the API/storage/presentation boundary.

This separates:

- final useful progress (`correctCharacters`, WPM);
- physical printable work (`typedCharacters`, raw WPM);
- historical input precision (`correctAttempts`, `incorrectAttempts`, missing characters, accuracy).

## Pace and consistency

- A pace bucket contains `{ durationMs, typedCharacters }`.
- Buckets cover the entire canonical duration without gaps or overlap.
- All non-final buckets are exactly 1,000ms; the final bucket is 1–1,000ms.
- Zero-character buckets are retained so pauses affect consistency.
- The sum of bucket durations equals result duration.
- The sum of bucket characters equals `typedCharacters`.
- These exact buckets are the canonical storage/API representation.
- A final bucket shorter than 250ms is too small to stand as an independent
  annualized observation. For charting and consistency only, it is combined
  with the preceding bucket by adding both durations and character counts.
  A lone short bucket remains unchanged because there is no adjacent evidence.
- This analysis step preserves exact total duration and characters. It does not
  pad, cap, discard, or replace measured input, and it does not change overall
  WPM/raw WPM.
- Each resulting analysis bucket's raw pace is
  `typedCharacters * 12_000 / durationMs`.
- Consistency uses the population standard deviation of analysis-bucket raw
  pace:

```text
consistency = 100 * max(0, 1 - standardDeviation / max(mean, 1))
```

- One bucket produces `100`.
- A zero mean produces `100`, though a persisted completed test normally has at least one character.
- The server validates bucket structure/cross-field sums and derives
  consistency. Stored legacy results are rederived on read, and guest results
  are rederived on load, so historical displays use the same analysis policy.
  The underlying counts remain client-reported and are not anti-cheat evidence.

## Worked traces

Spaces below are submit/separator actions, not literal current-word content.

### Corrected first error

```text
target: cat
input:  x, backspace, c, a, t
typedCharacters: 4
correctAttempts: 3
incorrectAttempts: 1
missingCharacters: 0
extraAttempts: 0
correctedErrors: 1
correctCharacters: 3
accuracy: 75%
```

### Early final submit

```text
target: cat
input:  c, space
typedCharacters: 1
correctAttempts: 1
incorrectAttempts: 0
missingCharacters: 2
correctCharacters: 1
accuracy: 33.33%
```

### Extra character in an active non-final word

```text
target: cat dog
input so far: c, a, t, t
typedCharacters: 4
correctAttempts: 3
incorrectAttempts: 1
extraAttempts: 1
status: running
```

An exact final `cat` would already have completed on `t`, so a later extra
character is intentionally ignored in that state.

### Intermediate separator

```text
target: cat dog
input:  c, a, t, space
typedCharacters: 4
correctAttempts: 4
correctCharacters so far: 4
current word: dog
```

### Ignored repeated spaces

After committing `cat`, any additional space while the next `currentInput` is empty changes no counter and does not advance.

## Prompt supply and identity

- Prompt identity is `(seed, wordListVersion, generatorVersion, config)`.
- Release 1 uses `wordListVersion = en-v1` and `generatorVersion = 1`.
- Word modes generate exactly the configured number of words.
- Time modes generate 500 words, enough for a 500-WPM 60-second run at one word per five-character WPM unit. If fewer than 60 words remain, the deterministic generator appends another 250 without resetting its PRNG.
- The rendered visual window contains at most 80 words. Its word set stays
  fixed during ordinary typing; the viewport advances only by a complete
  visual line when the active word reaches the third row. Near the end of the
  bounded window, it rebases on a complete row boundary. Stable prompt indices
  are React keys.
- Prompt generation never fetches over the network.

## Persistence and records

- Every result gets a client UUID before completion persistence.
- Local guest history and an account’s unsynced queue deduplicate by that UUID, including across StrictMode remounts.
- Unsynced entries are namespaced by the originating stable account id and retried only for that same authenticated id.
- Guest results never upload automatically after registration/sign-in.
- The queue is capped at 20 entries per account. Saturation never silently
  evicts an existing entry: the new result remains on the completion screen,
  automatic persistence is rejected, and the user sees a non-blocking failure
  notice.
- Personal records are partitioned by `(mode, modeValue, punctuation, numbers)`.
- Record ordering is WPM descending, accuracy descending, then earliest completion timestamp.

## Accessibility behavior

- The visual per-character prompt may be `aria-hidden` to avoid fragmented output.
- A separate accessible current-word element is referenced by the capture textarea and announces the target word only when the word boundary changes.
- Ready instructions identify the current word and available restart behavior.
- Completion moves no focus automatically; it updates a polite live region and makes the result heading the next logical reading target.
- A stable screen-reader-only summary identifies mode, progress, current target word, and completion result. It does not announce every character.
- Automated semantic/axe checks are necessary but not sufficient. A real screen-reader pass is desired evidence and must be disclosed if unavailable.
