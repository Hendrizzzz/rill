# Rill

Rill is a quiet, keyboard-first typing practice application. The typing loop
runs entirely in the browser; an optional account preserves results across
devices through a Spring Boot API.

The product includes word and timed tests, punctuation and number modifiers,
deterministic prompts, restart shortcuts, detailed scoring, three original
themes, guest history, account history, JSON export, and password-confirmed
account deletion. It does not send a request for each keystroke.

## Stack

- React 19, strict TypeScript, Vite, and React Router 8
- Spring Boot 4.1 on Java 21
- PostgreSQL 18 with Flyway migrations
- Nginx as the same-origin static server and API proxy
- Vitest, Testing Library, Playwright, JUnit, MockMvc, and Testcontainers
- Docker Compose for the complete deployment topology

## Quick start

Requirements: Docker Desktop with Compose.

1. Copy `.env.example` to `.env`.
2. Keep the local profile values for local HTTP only. Change all three example
   database passwords if the data will matter.
3. Start the stack:

   ```text
   docker compose up --build --wait
   ```

4. Open `http://127.0.0.1:8080`.
5. Stop it with `docker compose down`. Add `--volumes` only when you
   intentionally want to erase the local database.

The bootstrap administrator, non-superuser Flyway owner, and DML-only
application role are separate. A one-shot permission gate revokes runtime
access to Flyway history before the backend starts.

## Development

Use Node 24.18 or newer within the supported Node 24 line, Java 21, and Docker.
The repository includes Maven wrappers.

Start PostgreSQL/backend with Compose, then run the frontend dev server:

```text
cd frontend
npm ci
npm run dev
```

Vite listens only on `127.0.0.1:5173` and proxies `/api` to the Compose web
endpoint on port 8080. Guest typing still works if the API is unavailable.

## Verification

Backend (requires a running Docker engine for PostgreSQL Testcontainers):

```text
cd backend
./mvnw verify
```

On Windows PowerShell use `.\mvnw.cmd verify`.

Frontend:

```text
cd frontend
npm ci
npm audit --audit-level=high
npm run typecheck
npm run lint
npm run test:run
npm run build
npx playwright install
npm run test:e2e
```

Account-lifecycle E2E runs against the full stack:

```text
E2E_BASE_URL=http://127.0.0.1:8080 E2E_ACCOUNT=true \
  npx playwright test --project=chromium --grep "account result"
```

PowerShell:

```powershell
$env:E2E_BASE_URL = "http://127.0.0.1:8080"
$env:E2E_ACCOUNT = "true"
npx playwright test --project=chromium --grep "account result"
```

The GitHub Actions workflow repeats the primary gates from clean dependency
installs. A workflow file existing locally is not evidence that it has run on
GitHub.

## Repository map

```text
backend/             Spring API, security, persistence, migrations, tests
frontend/            React app, typing engine, UI, unit and browser tests
ops/nginx/           same-origin proxy and browser security headers
ops/postgres/init/   bootstrap, migration-owner, and runtime-role grants
docs/product/        release scope and normative typing behavior
docs/architecture/   component, data, and HTTP contracts
docs/design/         visual, responsive, motion, and accessibility direction
docs/security/       implementation-grounded threat model
docs/operations/     deployment, migration, backup, and recovery runbook
docs/reviews/        specialist findings and root-agent evaluations
compose.yaml         production-shaped local topology
```

## Production boundary

Compose exposes only Nginx. A real deployment must put an HTTPS ingress in
front, use unique high-entropy database passwords, keep
`SPRING_PROFILES_ACTIVE=prod`, keep secure cookies enabled, and back up the
PostgreSQL volume. Do not publish the backend or database ports.

The included application-level rate limiters are process-local. Before running
multiple API replicas, add a shared limiter at the trusted ingress or in a
shared store.

See [deployment and maintenance](docs/operations/DEPLOYMENT.md),
[architecture](docs/architecture/ARCHITECTURE.md), and the
[threat model](docs/security/threat-model.md). Exact local evidence and
limitations are recorded in [verification](docs/VERIFICATION.md).

## Intentional release-1 limits

There is no password recovery because the product collects no email address.
There are no public leaderboards or anti-cheat claims; a client can fabricate
its own private result despite server-side range and formula validation.
Preference sync, OAuth, MFA, a service worker, telemetry, and distributed rate
limiting remain out of scope.
