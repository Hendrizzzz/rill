# Rill typing contract

Status: normative release-1 contract
Last updated: 2026-07-28

This document removes ambiguity from the keystroke-critical path. The reducer, browser input adapter, score calculator, API validator, and tests must all follow it.

## Text and input scope

- Human-language prompt content is English or Spanish and consists of letters,
  spaces, the punctuation set `.,?!:;'-`, and digits. Code prompts additionally
  include the printable ASCII syntax used by their selected programming
  language.
- Prose targets are stored as word arrays. Code targets are stored as non-empty
  source-line arrays. Four-space leading indentation is preserved for display
  but treated as automatic structure; internal spaces remain significant input.
- Target units are segmented into Unicode grapheme clusters even though the
  bundled code corpus is ASCII.
- Committed browser input is split with `Intl.Segmenter` at grapheme granularity. The fallback is `Array.from`, documented as less complete for joined emoji.
- A non-ASCII grapheme is accepted as one incorrect attempt. Full multilingual prompt/IME authoring is out of scope.
- Auto-capitalisation, autocorrect, autocomplete, and spellcheck are disabled on the capture textarea.
- Paste, drop, replacement, undo, and redo insertion types are rejected without changing typing state. A polite status announces that paste is disabled.

## Domain state

```text
TestState
  status: ready | running | completed
  config: mode, modeValue, punctuation, numbers, contentType, language,
          codeLanguage, errorPolicy
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
  inputEvents[]
  resultSnapshot
```

`resultSnapshot` is created exactly once. A completed state does not accept typing actions.

## Input adapter

The real textarea is visually unobtrusive but not `display:none`, disabled, or removed from the accessibility tree.

Native browser events are translated outside the reducer:

| Browser event | Policy | Domain action |
| --- | --- | --- |
| `beforeinput: insertText` | Prevent default; segment non-null data; preserve order and one timestamp | `INSERT_BATCH` |
| Composition start/update | Allow the IME to compose, start timing, and expose pre-edit feedback; do not score intermediate data | `START` on composition start |
| Composition end | Segment the committed composition string, clear capture value, and discard data from an older run | `INSERT_BATCH` |
| `beforeinput: deleteContentBackward` | Prevent default | `BACKSPACE` |
| `beforeinput: deleteWordBackward` | Prevent default | `DELETE_WORD_BACKWARD` |
| `beforeinput: insertLineBreak` / `insertParagraph` | Insert a line boundary in code mode; block in prose mode | `INSERT_BATCH("\n")` for code |
| `beforeinput: insertFromPaste` / `insertFromDrop` | Prevent default, announce rejection | none |
| `beforeinput` replacement/history types | Prevent default | none |
| Unsupported mutation input type | Prevent default immediately | none |
| `keydown: Escape` | Only while capture owns focus and no dialog is open | `RESTART` |
| `keydown: Enter` | In completed state from the capture, result surface, or pace scrubber; native controls and dialogs retain Enter | `RESTART` |
| `keydown: Tab` | Plain forward Tab from the typing capture is intercepted; Shift/Ctrl/Alt/Meta variants remain native | focus the visible restart action without mutating the test |

- Printable `keydown` is not separately scored, avoiding duplicate physical-key and `beforeinput` handling.
- In code mode, leading indentation is structural and inserted automatically
  after each line break. Internal spaces remain scored characters within the
  active line. Structural indentation never enters `currentInput`, the input
  event log, attempt counters, WPM/raw WPM, or pace buckets.
  Enter commits a non-empty line; an empty Enter is ignored. Strict mode blocks
  a line boundary until the current line exactly matches its target.
- `Ctrl`/`Option` + Backspace performs word deletion. Other `Ctrl`, `Alt`, and
  `Meta` shortcuts are not scored.
- Key repeat generates repeated input events and is counted normally.
- The adapter clears any incidental textarea value after handling input.
- Clicking/tapping the prompt focuses the textarea. Blur never pauses elapsed time.
- The restart action remains visible while ready or running. Plain `Tab` from
  the capture focuses it; `Enter` activates the native button and returns focus
  to a fresh typing capture.
- A printable key pressed after focus lands on non-editable page chrome
  restores capture focus and is swallowed; the next key is scored.
- Arrow, Home, End, PageUp, and PageDown are prevented while capture owns
  focus so the hidden caret and page cannot move during a run.
- A modal has shortcut precedence: `Escape` closes the modal and never restarts a test.

The adapter has independent tests using realistic `InputEvent` and composition sequences. A resized Playwright viewport is not considered proof of a physical mobile software keyboard.

## Start and deadline semantics

- `ready` becomes `running` immediately before the first accepted
  `INSERT_GRAPHEME` or at IME composition start.
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
- Input is capped at 21 graphemes beyond the current target to bound layout
  growth and held-key work.
- Every accepted insertion is recorded in `inputEvents`.
- Historical attempt counters are never decremented by backspace, while the
  retained-character total used by raw WPM is derived from the final input.

Space is handled as a separator rather than inserted into `currentInput`:

- If `currentInput` is empty, space is ignored.
- For every non-final word, space commits the current word and is recorded as a
  separator attempt. The attempt is correct only when the input and target have
  equal lengths.
- For the final word in a word test, an exact word completes on its final
  grapheme. Space can submit an imperfect final word and is scored against that
  imperfect word in the same way as Monkeytype.
- Consecutive spaces after a commit are therefore ignored.

### Committing a word

- A non-empty current word may be committed even when incorrect.
- With `errorPolicy = strict`, an imperfect current word cannot be committed;
  the user must backspace and correct it. The incorrect historical attempts
  remain counted.
- Unfilled target positions at commit increment `missingCharacters`.
- Mismatched filled positions are already incorrect attempts and are not also marked missing.
- Extra positions remain extra attempts.
- At an empty current word, backspace reopens the immediately previous word
  when its final aligned input is imperfect (a substitution, missing suffix,
  or extra character).
- A perfectly aligned committed word remains locked.
- In a word test, an exact final word completes automatically on its final expected grapheme.
- An incorrect final word completes when the user submits it with space.
- In a time test, an active partial word that is still a correct target prefix
  receives partial credit at expiry; its untyped suffix is not marked missing.

### Backspace

- Backspace removes one grapheme from a non-empty current word.
- At an empty word boundary, one backspace removes the separator and reopens
  only an imperfect previous word; it does not delete a previous grapheme
  until the next backspace.
- Reopening removes that word's provisional missing-character count and final
  aligned separator, while historical attempt counters remain unchanged. If
  that separator was incorrect, removing it increments `correctedErrors` just
  like removing any other incorrect insertion.
- Removing a grapheme whose position was incorrect or extra increments `correctedErrors`.
- Removing a correct grapheme does not increment `correctedErrors`.
- Attempt counters remain historical; retyping adds a new attempt.
- Backspace on an empty current word does nothing when there is no previous
  word or the previous word is perfectly aligned.
- Word deletion removes every grapheme in the active word in one logical
  action. From an empty current word it reopens and clears an imperfect
  previous word, but never crosses a perfectly aligned previous word.
- In code mode, word deletion follows editor-like token boundaries within the
  current line: it first removes trailing spaces, then one identifier or
  punctuation run. It never crosses a perfectly completed line.
- The event log retains one deletion record per removed grapheme so result
  replay reconstructs the final retained input exactly.

### Unicode input

- Incoming text is normalized to NFC before it reaches the reducer.
- Directly typable Unicode spaces, including non-breaking, en/em, thin,
  narrow, ideographic, and zero-width variants, normalize to U+0020 and use
  ordinary separator behavior.
- Common smart apostrophes, quotes, commas, and dash variants normalize to the
  expected target glyph. A typed ellipsis expands to three periods when the
  target expects periods.
- Target and input positions use locale-aware grapheme segmentation when the
  platform supports `Intl.Segmenter`; the fallback uses Unicode code points.
- A displayed joined emoji or a precomposed accented character therefore
  occupies one typing position rather than multiple UTF-16 code units.

## Result counters and formulas

Final character counters use whole-word scoring compatible with Monkeytype:

- `typedCharacters` is the retained `allCorrect + incorrect + extra` count;
- `correctCharacters` credits aligned characters only when the complete word is
  correct, except that the active partial word at time expiry receives partial
  credit while it remains a correct target prefix;
- `incorrectCharacters`, `extraAttempts`, and `missingCharacters` describe the
  final retained word shapes;
- a separator after an imperfect same-length word is extra rather than correct;
- historical `correctAttempts` and `incorrectAttempts` still include corrected
  insertions and determine accuracy.

The following invariants hold:

```text
typedCharacters <= correctAttempts + incorrectAttempts
0 <= correctCharacters <= typedCharacters
0 <= incorrectCharacters <= typedCharacters
0 <= extraAttempts <= typedCharacters
0 <= correctedErrors <= incorrectAttempts
```

Canonical metrics:

```text
minutes = durationMilliseconds / 60_000
rawWpm = typedCharacters / 5 / minutes
wpm = correctCharacters / 5 / minutes
accuracy = correctAttempts / (correctAttempts + incorrectAttempts) * 100
```

If the accuracy denominator is zero, accuracy is `100`. Positive values are
rounded at the API/storage boundary with the JavaScript-compatible
`Math.round((value + Number.EPSILON) * 100) / 100` rule. Backend calculations
preserve the same division order; algebraically equivalent multiplication is
not substituted because it can cross a binary floating-point half boundary.

This separates:

- final useful progress (`correctCharacters`, WPM);
- retained printable work (`typedCharacters`, raw WPM);
- historical input precision (`correctAttempts`, `incorrectAttempts`, accuracy);
- final word shape (`incorrectCharacters`, `missingCharacters`, `extraAttempts`).

## Pace and consistency

- Input-event offsets are normalized to hundredths of a millisecond. A word
  result's aggregate duration is independently rounded to
  hundredths of a second (a 10ms grid), matching the pinned reference.
- A pace bucket contains `{ durationMs, typedCharacters, correctCharacters,
  rawCharacters, errors }`. `durationMs` may therefore have hundredth-
  millisecond precision.
- `typedCharacters` and `errors` are insertion counts in that interval.
  `correctCharacters` and `rawCharacters` are cumulative final-scoring totals at
  that boundary.
- Time tests have one bucket for each complete second and cover the configured
  duration exactly.
- Word-test graph boundaries use the raw normalized event time, not the rounded
  aggregate duration. A fractional final sample is retained when the raw
  fractional second rounds to `0.50` or above at two decimal places; the first
  retained edge is therefore `495ms`, while `494.99ms` is omitted.
- At `1.995s`, the pinned reference rounds the aggregate duration to `2.00s`
  but drops the entire second graph bucket. Rill deliberately emits the
  normalized `2.00s` boundary instead. This is an intentional safety
  difference: copying the reference would discard graph data and distort
  consistency.
- Zero-character full-second buckets are retained so pauses affect consistency.
- Burst pace is
  `round(typedCharacters / 5 / (durationMs / 1_000 / 60))`.
- Chart WPM and raw pace use cumulative `correctCharacters` and `rawCharacters`
  divided by elapsed chart time. Errors are displayed against a separate right
  axis.
- Consistency uses the population coefficient of variation of rounded burst
  pace and Monkeytype's non-linear mapping:

```text
cov = populationStandardDeviation / mean
consistency = 100 * (1 - tanh(cov + cov^3 / 3 + cov^5 / 5))
```

- One non-zero bucket produces `100`; no samples or a zero mean produce `0`.
- The server validates bucket structure and bounded cross-field totals, then
  derives consistency. The underlying counts remain client-reported and are
  not anti-cheat evidence.
- The rich pace payload is schema version 3 in guest browser storage. v2
  migrates to the original `words`/`en`/`normal` dimensions. Pre-release v1
  guest/pending data remains under its original key and is not overwritten or
  approximated because it lacks enough information for faithful whole-word
  scoring. The history UI discloses its presence.
- Historical account rows with the old two-field bucket shape retain aggregate
  result metrics but expose no pace graph; the API does not invent cumulative
  WPM/raw/error histories that were never recorded.

## Worked traces

Spaces below are submit/separator actions, not literal current-word content.

### Corrected first error

```text
target: cat
input:  x, backspace, c, a, t
typedCharacters: 3
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
typedCharacters: 2
correctAttempts: 1
incorrectAttempts: 1
incorrectCharacters: 1
missingCharacters: 1
correctCharacters: 0
accuracy: 50%
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
- Release 1 uses `en-v1`, `es-v1`, `quote-v1`, `custom-v1`, and `code-v2`,
  all with `generatorVersion = 1`.
- Word modes generate exactly the configured number of words.
- Time modes generate 500 words, enough for a 500-WPM 60-second run at one word per five-character WPM unit. If fewer than 60 words remain, the deterministic generator appends another 250 without resetting its PRNG.
- The rendered visual window contains at most 80 words. Its word set stays
  fixed during ordinary typing; the viewport advances only by a complete
  visual line when the active word reaches the third row. Near the end of the
  bounded window, it rebases on a complete row boundary. Stable prompt indices
  are React keys.
- Quote prompts select deterministically from the bundled, attributed
  public-domain corpus.
- Code prompts select deterministically from `code-v2`: 16 common algorithm
  patterns, four repetition drills per pattern, in eight programming languages
  (512 drills total). The UI states both counts so drills are not misrepresented
  as distinct algorithms.
- Code snippets, titles, invariant notes, and complexity labels are original
  Rill content. No LeetCode statement, example, editorial, source code, user
  submission, branding, or proprietary asset is included. The corpus is bundled
  locally and does not scrape or fetch a third-party service.
- A code result uses `WORDS` mode internally, with `modeValue` equal to its line
  count. `language` is `EN`; `codeLanguage` records one of `CPP`, `JAVA`,
  `PYTHON3`, `C`, `CSHARP`, `JAVASCRIPT`, `TYPESCRIPT`, or `GO`.
- Custom text is normalized to NFC and whitespace-collapsed, limited to 2–300
  words / 2,000 characters / 64 code points per word, and retained only in the
  current tab's session state. Prompt text is not written to local storage,
  account storage, logs, or the result API.
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
- Personal records are partitioned by `(mode, modeValue, punctuation, numbers,
  contentType, language, codeLanguage, wordListVersion, errorPolicy)`.
- Every result persists `wordListVersion` as the corpus/scoring contract
  identity. Pre-release code results without the field migrate to `code-v1`;
  structural-indentation results use `code-v2`, so their records never compete.
- Record ordering is WPM descending, accuracy descending, then earliest completion timestamp.

## Accessibility behavior

- The visual per-character prompt may be `aria-hidden` to avoid fragmented output.
- A separate accessible current-word element is referenced by the capture textarea and announces the target word only when the word boundary changes.
- Ready instructions identify the current word and available restart behavior.
- Completion moves no focus automatically; it updates a polite live region and makes the result heading the next logical reading target.
- A stable screen-reader-only summary identifies mode, progress, current target word, and completion result. It does not announce every character.
- Automated semantic/axe checks are necessary but not sufficient. A real screen-reader pass is desired evidence and must be disclosed if unavailable.
