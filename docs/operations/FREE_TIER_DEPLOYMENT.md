# Rill zero-cost deployment

Last updated: 2026-07-30

## Scope and tradeoffs

This topology is intended for a public hobby launch with no monthly hosting
spend:

```text
browser -> Vercel static site and /api reverse proxy
        -> Render free Spring Boot service
        -> Neon free PostgreSQL
```

Vercel remains the browser-visible origin. Its external rewrite sends `/api`
requests to Render without exposing a second origin to frontend code. This
preserves Rill's `Secure`, `SameSite=Lax`, host-only session cookies and CSRF
header flow. Do not replace the rewrite with a browser-visible cross-origin API
URL.

The free services have no production SLA. Render sleeps after inactivity and
the first API request after sleep can take approximately a minute. The client
stops an account request after ten seconds, reports the account service as
offline, and offers an explicit retry; it does not hold the typing surface
hostage for the full cold start. Neon, Render, and Vercel enforce free-plan
storage, compute, transfer, and request limits that can change. Guest typing
remains functional while the API is waking, but account features do not.

For strict $0 operation, use a personal/non-commercial Vercel Hobby project and
do not attach a payment method to the Render workspace. Render currently
suspends services after free outbound bandwidth is exhausted when no payment
method is present; with a payment method it can bill overage. This trades
availability for a hard no-spend boundary.

## Static corpus boundary

Words, quotes, and code drills are immutable release assets, not database rows.
The current corpus is emitted in Vite's fingerprinted JavaScript assets and is
cached immutably by Vercel. When a corpus grows enough to justify separate
downloads, place versioned files under `frontend/public/corpora/<version>/` and
load only the selected language/mode. Never fetch a corpus per keystroke.

PostgreSQL stores only accounts, session hashes, typing results, and migration
metadata. The free Render manifest caps retained account results at 100 per
user to slow database growth. That is a storage control, not a global bound:
new accounts remain unlimited, dormant accounts are not retroactively pruned,
and unusual maximum-size pace payloads are much larger than ordinary results.
The 0.5 GB plan cannot serve an unlimited number of accounts.

## 1. Create Neon PostgreSQL

1. Create one free Neon project in a region close to Render's Singapore region.
2. In **Connect**, copy both:
   - the pooled hostname for the application;
   - the direct hostname for Flyway migrations.
3. Convert each URL to PostgreSQL JDBC form. Do not commit either value:

   ```text
   jdbc:postgresql://<pooled-host>/<database>?sslmode=verify-full&channelBinding=require&sslfactory=org.postgresql.ssl.DefaultJavaSSLFactory
   jdbc:postgresql://<direct-host>/<database>?sslmode=verify-full&channelBinding=require&sslfactory=org.postgresql.ssl.DefaultJavaSSLFactory
   ```

   `DefaultJavaSSLFactory` makes pgJDBC use the JVM trust store. Keep
   `sslmode=verify-full`: pgJDBC still validates the certificate chain and
   hostname, while avoiding a non-portable dependency on
   `$HOME/.postgresql/root.crt` inside the container.

4. Do not create `rill_app` with the Neon Console, CLI, or API: Neon grants
   those roles membership in `neon_superuser`. Connect to the direct hostname
   with `psql` as the Neon owner, using an interactive password prompt and
   authenticated TLS:

   ```text
   psql "host=<direct-host> dbname=<database> user=<owner> sslmode=verify-full channel_binding=require"
   ```

5. Create the ordinary PostgreSQL login, set its password interactively, and
   grant only runtime data access:

   ```sql
   CREATE ROLE rill_app LOGIN;
   \password rill_app

   GRANT CONNECT ON DATABASE neondb TO rill_app;
   GRANT USAGE ON SCHEMA public TO rill_app;
   GRANT SELECT, INSERT, UPDATE, DELETE
     ON ALL TABLES IN SCHEMA public TO rill_app;
   GRANT USAGE, SELECT
     ON ALL SEQUENCES IN SCHEMA public TO rill_app;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public
     GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO rill_app;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public
     GRANT USAGE, SELECT ON SEQUENCES TO rill_app;
   ```

   Replace `neondb` if the project uses a different database name.
6. Verify that the role was not elevated:

   ```sql
   SELECT rolname, rolsuper, rolcreaterole, rolcreatedb, rolreplication,
          rolbypassrls,
          pg_has_role(rolname, 'neon_superuser', 'member') AS neon_superuser
     FROM pg_roles
    WHERE rolname = 'rill_app';
   ```

   Every boolean privilege and `neon_superuser` value must be `false`.
7. Record both role credentials in a password manager.

The one Spring process holds both credentials: Flyway uses the Neon owner on
the direct hostname, while Hikari uses `rill_app` on the pooled hostname. This
limits ordinary SQL access, although arbitrary server-code execution could
still read both environment secrets. Production startup rejects database URLs
that do not use certificate and hostname verification plus channel binding.

## 2. Create the Render API

In Render, create a Blueprint from
`https://github.com/Hendrizzzz/typewriting`. Render reads `render.yaml` and
creates the `rill-typewriting-api` Docker web service on the free plan.

Provide these secret values when the Blueprint asks:

| Variable | Value |
| --- | --- |
| `RILL_DATABASE_URL` | Neon pooled JDBC URL |
| `RILL_DATABASE_USERNAME` | `rill_app` |
| `RILL_DATABASE_PASSWORD` | `rill_app` password |
| `RILL_FLYWAY_URL` | Neon direct JDBC URL |
| `RILL_FLYWAY_USERNAME` | Neon owner username |
| `RILL_FLYWAY_PASSWORD` | Neon owner password |

The manifest fixes the production profile, secure cookies, small connection
pool, Flyway connection retries, startup migrations, Singapore region,
readiness health check, 100-result retention cap, a 30-attempt-per-minute
process-wide authentication budget, and a 60-registration-per-hour budget. A
deploy is healthy only when the API can query the database and all Flyway
migrations have succeeded.
After the first successful migration, connect as the Neon owner and remove the
runtime role's default access to Flyway metadata:

```sql
REVOKE ALL PRIVILEGES
  ON TABLE public.flyway_schema_history
  FROM rill_app;

SELECT has_table_privilege(
         'rill_app', 'public.flyway_schema_history', 'SELECT') AS can_select,
       has_table_privilege(
         'rill_app', 'public.flyway_schema_history', 'INSERT') AS can_insert,
       has_table_privilege(
         'rill_app', 'public.flyway_schema_history', 'UPDATE') AS can_update,
       has_table_privilege(
         'rill_app', 'public.flyway_schema_history', 'DELETE') AS can_delete;
```

All four values must be `false`. Repeat that check after migration-related
operator changes. The application does not need Flyway history access.

The Render hostname is necessarily public on the free plan; Vercel provides a
same-origin browser route, not a private origin. Direct callers still face
Spring authentication, CSRF, validation, a per-username login limiter, and the
pre-work process-global budgets, but they can bypass Vercel's edge and consume
free quota. The global budgets deliberately bound expensive work on the one
free instance; an attacker can also consume a budget temporarily, so they are
not a substitute for a source-aware distributed edge limiter.

If Render assigns a hostname other than
`rill-typewriting-api.onrender.com`, update the destination in
`frontend/vercel.json` before deploying Vercel.

## 3. Create the Vercel frontend

Import the same GitHub repository into Vercel with:

| Setting | Value |
| --- | --- |
| Framework | Vite |
| Root directory | `frontend` |
| Build command | from `vercel.json` |
| Output directory | from `vercel.json` |

No database or backend secret belongs in Vercel. `frontend/vercel.json` serves
the SPA, applies browser security headers, caches fingerprinted assets, forces
API responses to `no-store`, and proxies `/api/*` to Render.

Render keeps Git-triggered deployments disabled. Vercel deploys only pushes to
`main`; all other branches are denied by `frontend/vercel.json`, so preview
branches cannot reach the production API. A merge to `main` therefore updates
the production frontend automatically.

For the first release, deploy Render first and wait for readiness, then create
the Vercel project from `main`. For every later release:

1. review migrations for backward compatibility with the currently running API;
2. run CI and back up Neon;
3. when backend behavior changes, manually deploy the reviewed,
   backward-compatible Render revision and complete API/account smoke tests
   before merging;
4. merge the reviewed change to `main`; Vercel deploys production automatically;
5. repeat the public-origin smoke tests against the new Vercel build.

Never add a migration that removes a column/default or makes a field mandatory
while the old binary can still write. Use expand/contract releases: add
compatible schema first, deploy code that handles both forms, then contract in
a later release. Render health gating cannot roll back a migration after it has
changed the shared database.

## 4. Verify the public deployment

Use the Vercel production hostname for all browser checks:

1. Load `/` and directly load `/history`; both must render the SPA.
2. Inspect `/build.json` and confirm it matches the deployed source build.
3. Request `/api/auth/session`; expect `200`, `Cache-Control: no-store`, a CSRF
   token in JSON, and a host-only `XSRF-TOKEN` cookie with `Secure`,
   `SameSite=Lax`, and `Path=/`.
4. Register a disposable account, complete one test, open history, log out,
   log in, export the account, and delete the disposable account.
5. Confirm `RILL_SESSION` is host-only and has `Secure`, `HttpOnly`,
   `SameSite=Lax`, and `Path=/`; it must belong to the Vercel hostname, not the
   Render hostname.
6. Confirm static assets include a one-year immutable cache header.
7. Confirm CSP, HSTS, frame denial, no-sniff, referrer, permissions, COOP, and
   CORP headers on the HTML response.
8. Let Render sleep, then verify the UI communicates the temporary account
   failure and typing still works locally.

Do not call the deployment verified until these checks have run against the
actual public hostname.

## Operations on the free tier

- Watch Neon storage, transfer, and compute plus Render outbound bandwidth.
  Render's readiness checks query Neon while the API is awake, which contributes
  to usage. At 70% storage, stop account creation, export data, and reduce
  retention before accepting more accounts. Lowering the configured cap prunes
  a user only after that user saves again; an emergency cleanup must therefore
  be a reviewed database operation with a fresh backup.
- Install a PostgreSQL client compatible with the server. Use the direct Neon
  hostname and an interactive password prompt to create a custom-format dump
  without putting the password in shell history:

  ```text
  pg_dump \
    --dbname "postgresql://<owner>@<direct-host>/<database>?sslmode=verify-full&channel_binding=require" \
    --password --format custom \
    --file rill-YYYYMMDD.dump
  gpg --symmetric --cipher-algo AES256 rill-YYYYMMDD.dump
  ```

  Move the encrypted file to storage outside Neon and remove the unencrypted
  copy. Restore it periodically into a disposable Neon branch:

  ```text
  pg_restore \
    --dbname "postgresql://<owner>@<direct-branch-host>/<database>?sslmode=verify-full&channel_binding=require" \
    --password --exit-on-error rill-YYYYMMDD.dump
  ```

  Then compare Flyway history and representative row counts.
  Provider restore windows are not a substitute for an operator-owned backup.
- Keep one Render instance. The in-process abuse limiters are not suitable for
  horizontal scaling.
- Treat sustained cold starts, quota exhaustion, or growing account traffic as
  signals to move the API/database to paid capacity.
- Never add database credentials to Git, Vercel variables, frontend code, build
  arguments, screenshots, or support logs.
