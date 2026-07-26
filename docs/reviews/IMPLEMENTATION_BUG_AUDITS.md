# Implementation bug audits and root evaluation

Date: 2026-07-26
Status: resolved findings verified; final system audit still pending

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

No recommendation was implemented solely because a specialist proposed it.
Notable modifications were the pgJDBC choice (latest 42.7.13 rather than the
minimum fix), scoped coverage thresholds instead of a misleading global number,
and preservation of Spring headers behind public-edge normalization.
