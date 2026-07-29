# Trusted Browser observations and final-worktree limitation

Controller: Codex in-app Browser through its native browser-control interface  
Local URL: `http://127.0.0.1:8080/`  
Reference URL: `https://monkeytype.com/`  
Observed Monkeytype version: `v26.28.0`

## Rill observation

- Reloaded the local application and inspected its semantic DOM.
- Captured no console errors or warnings during the inspected flow.
- Used trusted keyboard input to prove both previous-word correction branches:
  an imperfect committed word reopened on Backspace, while a perfect committed
  word did not.
- Completed a ten-word test. The displayed result was 59 WPM, 100% accuracy,
  raw 59, consistency 0%, 11.0 seconds, and characters `54/0/0/0`.
- Inspected the result chart. It exposed WPM ticks 0, 100, 200, 300, 400, and
  500, x-axis time ticks, WPM/raw/burst/errors legend entries, and a visible
  range control.
- Hovered a plotted point. The tooltip included exact sample values and its
  measured bounding rectangle was fully contained by the chart figure.
- At 390 by 844 CSS pixels, `document.documentElement.scrollWidth` equaled
  `window.innerWidth` (390), so the inspected page had no horizontal overflow.

The screenshot endpoint was unavailable, so no screenshot artifact is claimed.
The current browser controller could not prove range-slider Arrow/Home/End
selection; the corresponding ledger rows remain blocked.

During final reconciliation, a reload exposed instruction text that differed
from the current source, proving port 8080 served an older bundle. An isolated
preview of the newly built `dist` was started, but Browser policy rejected
navigation to its port. The helper preview process was then terminated.

Accordingly, every observation above is retained as exploratory evidence for
the older served bundle. It does not support a `PASS` for the final worktree.

## Monkeytype

The live site loaded and exposed a typing test and version `v26.28.0`. It was
inspected as a changing external reference. No same-prompt, same-settings,
same-event-timestamp run was captured on both sites in this session.

The Rill and Monkeytype result numbers from unrelated prompts or timings are
not compared as exact evidence.
