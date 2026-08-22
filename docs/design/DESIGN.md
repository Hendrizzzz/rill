# TypeThock design direction

Status: approved direction for initial implementation
Last updated: 2026-07-26

## Concept: a quiet editorial instrument

TypeThock should resemble a well-made writing tool, not a game dashboard or productivity template. The memorable element is a broad field of text with a thin, warm caret moving through it. Nothing competes with the words while a test is active.

The composition is deliberately sparse but not generic:

- asymmetrical header with a small serif wordmark and practical controls;
- type area spanning the useful viewport rather than living in a card;
- hairline rules and tab-like text controls instead of pills;
- one warm accent, used mainly for caret/focus/current selection;
- results arranged like a compact editorial proof sheet, not metric cards;
- no gradients, glass, drop-shadow stacks, marketing hero, icon grid, or decorative dashboard.

## Typography

Fonts are self-hosted through pinned packages; the app makes no font CDN request.

| Role | Face | Use |
| --- | --- | --- |
| Wordmark and result emphasis | Newsreader Variable | restrained serif character; occasional italic, never body copy |
| UI, prompt, labels, numeric data | Recursive Variable | highly legible variable mono/sans system with a recognisable voice |
| Fallback | `ui-monospace`, `SFMono-Regular`, `Consolas`, monospace | deterministic fallback |

Type rules:

- Prompt: `clamp(1.55rem, 2.3vw, 2.35rem)`, line-height 1.55, mono axis, normal weight.
- Primary result: `clamp(4.5rem, 13vw, 10rem)`, line-height 0.82, tabular numbers.
- UI/body: 0.875–1rem, line-height 1.45.
- Labels: 0.7–0.75rem, uppercase only for short metadata, letter spacing 0.08em.
- Wordmark: 1.35rem Newsreader italic; it is never expanded into a large hero heading.
- Text measure: prompt approximately 34–52 monospace characters per visual line depending on viewport.

## Token plan

Tokens are CSS custom properties. Themes change semantic colors only; spacing, typography, radii, and motion remain stable.

### Color themes

| Token | Paper | Nocturne | Tide |
| --- | --- | --- | --- |
| `--canvas` | `#f1eee6` | `#171817` | `#102729` |
| `--ink` | `#25241f` | `#ebe6d9` | `#dbe9e2` |
| `--muted` | `#716d63` | `#a5a69d` | `#93aaa3` |
| `--faint` | `#d3cec1` | `#31332f` | `#244043` |
| `--accent` | `#cb5439` | `#e2ab4f` | `#e1a05c` |
| `--error` | `#b83b36` | `#ed7269` | `#ff8078` |
| `--success` | `#397b5d` | `#78bd95` | `#7dc3a3` |

Every theme must pass WCAG AA for normal UI text. The concrete `--muted` values above are used for small secondary labels; a separate lower-contrast `--faint` is restricted to large untyped prompt glyphs and non-text rules.

### Spacing and shape

- Base spacing unit: 4px.
- Page gutter: `clamp(1rem, 4vw, 4.5rem)`.
- Content width: `min(100%, 92rem)`; prompt width is separately capped by readable character measure.
- Vertical test position: around 42% of viewport height on desktop, naturally flowing on short/mobile screens.
- Borders: 1px semantic faint color.
- Radius: 2px controls, 4px dialogs; no fully rounded pills.
- Shadows: none on ordinary surfaces; dialogs use a single subtle 0 18px 60px shadow.

### Motion

- Caret movement: 90ms linear transform where it does not delay input.
- Control hover/focus: 140ms ease-out for color/underline.
- Results entry: 260ms ease-out, opacity plus 6px rise; no stagger longer than 80ms.
- Error feedback is immediate color/underline, not shake animation.
- Reduced motion disables transforms and nonessential transitions.
- No animation runs continuously except the caret blink in ready state; blinking stops while typing.

## Page composition

### Test route

1. Header: wordmark left; history, theme, and account actions right.
2. Mode rail: inline text controls above the prompt. It wraps intentionally on mobile and is disabled/dimmed while running.
3. Status line: mode-aware time/progress at left and save/account state at right. It reserves height to avoid layout shift.
4. Prompt field: dominant element, no bounding card. Only the current three-to-five lines remain in the strongest visual plane.
5. Shortcut footer: small, low-contrast key hints; hidden when the mobile keyboard makes them irrelevant.

### Completion route/state

- Large WPM figure occupies the left column.
- Accuracy, raw WPM, consistency, time, and character counts align to one baseline in the right column.
- Pace chart runs as a restrained plotting surface below, with up to five
  conventional raw-WPM intervals and compact elapsed-time ticks. A
  shape-preserving monotone curve connects measured samples without inventing
  peaks or dips. Hovering reveals a viewport-clamped paper tooltip at the
  nearest sample; tapping pins that sample until the user taps elsewhere. One
  transparent native range control exposes the same values to arrow-key and
  assistive-technology users. Interaction guidance is screen-reader-only
  rather than visible chart furniture.
- Primary actions are plain underlined text buttons: `again` and `change test`.
- Save status is adjacent to metadata and never blocks restarting.

### History route

- A record strip is a typographic row, not a set of cards.
- Results are a semantic table on wider screens and labelled rows on mobile.
- Filters use the same mode rail language.
- Empty state: “No saved runs yet. Finish a test and it will appear here.”
- Backend failure preserves locally available history and clearly labels account history as unavailable.

### Account dialog

- Compact modal with native form controls, visible labels, inline errors, password visibility toggle, and predictable focus return.
- Registration and login are tabs implemented as real buttons with an accessible selected state.
- Destructive account deletion is a separate confirmation view requiring the current password.

## State design

| State | Visible behavior |
| --- | --- |
| Initial | Prompt ready, first character/caret accented, controls enabled, concise focus hint |
| Active | Navigation/controls subdued, progress strong enough to scan, caret no longer blinks |
| Character error | Intended target glyph remains in place and changes to the error color; the incorrect key is not rendered |
| Extra characters | Red underlined glyphs extend the active word in flow; following words shift or wrap rather than being painted over |
| Completion | Immutable score sheet and immediate restart affordance |
| Loading | Reserved inline status; no full-screen spinner for background account work |
| Backend failure | One-line status near save/account action; guest flow unchanged |
| Empty history | Direct sentence and route back to test |
| Disabled | Reduced contrast plus native disabled semantics; never communicated by color alone |
| Keyboard focus | 2px accent outline with 3px offset or strong underline on text controls |
| Small screen | Header simplifies, controls wrap, prompt font clamps, results stack, 44px touch targets |

## Responsive rules

- 1920×1080 / 1536×864 / 1440×900: prompt uses 8–10 grid columns and sits slightly left of center.
- 1365×768: reduce vertical whitespace before reducing prompt size.
- 1024×768: history table remains; result columns tighten.
- 390×844: header actions use concise text, mode controls become two rows, prompt gets full width, result metrics form a two-column definition list.
- No horizontal scrolling at any supported viewport.
- Browser zoom to 200% must preserve reading and action order.

## Accessibility contract

- Landmarks: header, main, nav, footer.
- One visible page heading; visually quiet headings may use accessible-only text.
- Typing capture uses a real labelled textarea. The fragmented visual prompt may be `aria-hidden`, but a separate accessible current-word element is referenced by the textarea and announces the target word at word boundaries. A stable screen-reader-only summary exposes mode, progress, and the current target.
- Buttons are buttons; links navigate; tabs expose correct selected semantics.
- Focus is never trapped outside a modal and returns to its invoker on close.
- Completion and save failures use polite live announcements.
- Chart labels its raw-WPM and elapsed-time axes, shows concise average/peak
  context, and exposes every inspected sample through the native range value.
- Themes are checked individually for contrast.
- Login/register switching uses ordinary buttons with `aria-pressed`, not an ARIA tablist, so arrow-key tab semantics are not implied.

## Anti-pattern review list

Reject any implementation that introduces:

- a centered hero, tagline, or onboarding carousel before the typing test;
- rounded card grids for results/history;
- purple/blue gradients, glass blur, glow, or ornamental particles;
- oversized navigation icons without labels;
- placeholder marketing claims;
- animation that delays the first keystroke or restart;
- a tiny prompt floating inside unused viewport space;
- copied Monkeytype colors, layout measurements, wordmark, shortcuts, or assets.
