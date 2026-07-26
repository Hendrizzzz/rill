# Rill deployment and maintenance

Last updated: 2026-07-26

## Supported topology

An operator-managed HTTPS ingress is public. It forwards to the bundled Nginx
container, which serves the static application and proxies same-origin API
requests. Spring Boot and PostgreSQL remain on private Compose networks.

```text
internet -> HTTPS ingress -> Rill Nginx -> Spring Boot -> PostgreSQL
```

The ingress must overwrite forwarding headers, preserve the public `Host`, set
its own source-address abuse controls, and must not expose the backend or
database directly. Rill does not infer cookie security from forwarded headers.

## Required production configuration

Create a deployment-only `.env` that is never committed:

```text
RILL_POSTGRES_ADMIN_PASSWORD=<unique high-entropy bootstrap/admin value>
RILL_MIGRATOR_DB_PASSWORD=<unique high-entropy value>
RILL_APP_DB_PASSWORD=<different unique high-entropy value>
RILL_SPRING_PROFILES_ACTIVE=prod
RILL_COOKIE_SECURE=true
RILL_BIND_ADDRESS=127.0.0.1
RILL_HTTP_PORT=8080
```

Restrict the file to the deployment account. Prefer an orchestrator secret
store when available. The `prod` profile fails startup if secure cookies are
disabled or production CORS is enabled.

The PostgreSQL admin secret is used only by the database container for
bootstrap and operator administration. Flyway uses a distinct non-superuser
schema owner, and the application uses a third DML-only role. Do not reuse any
of the three values.

The example binds Nginx to loopback so a host-level TLS proxy can reach it.
Adjust the bind address only when the surrounding network boundary requires it.

## Deploy or upgrade

1. Back up PostgreSQL.
2. Review new migration files. Migrations are forward-only.
3. Pull the reviewed source/image versions and dependency lockfiles.
4. Validate interpolation without printing secrets:

   ```text
   docker compose config --quiet
   ```

5. Build and start:

   ```text
   docker compose up --build --detach --wait
   ```

6. Confirm:

   ```text
   docker compose ps
   curl --fail http://127.0.0.1:8080/actuator/health
   ```

7. Exercise registration, one result save, history, logout, and login through
   the public HTTPS hostname before considering the rollout complete.

`migrate` must exit successfully before the backend starts. Never make the
runtime role a schema owner to work around a migration failure.

## Health and logs

- `/actuator/health` is the public aggregate health endpoint.
- Container health checks use internal liveness/readiness endpoints.
- `docker compose logs --since 10m backend web database` gathers recent logs.
- Request IDs appear in backend logs and problem responses.

The public health response deliberately omits database details. Logs must not be
shipped to a destination that cannot protect usernames and operational
metadata. Passwords, cookies, raw session tokens, and request bodies must never
be logged.

## Backup

Create a PostgreSQL custom-format dump inside the database container, copy it
out, and then remove only that temporary file:

```text
docker compose exec database pg_dump \
  --username rill_migrator --dbname rill \
  --format custom --file /tmp/rill-backup.dump
docker compose cp database:/tmp/rill-backup.dump ./rill-backup.dump
docker compose exec database rm /tmp/rill-backup.dump
```

Encrypt backups at rest, restrict access, copy them off the application host,
and define retention based on the deployment's recovery objectives. A backup is
not trustworthy until a restore drill has succeeded.

## Restore drill

Use a disposable database, never the active `rill` database:

```text
docker compose cp ./rill-backup.dump database:/tmp/rill-backup.dump
docker compose exec database createdb \
  --username postgres --owner rill_migrator rill_restore_check
docker compose exec database pg_restore \
  --username rill_migrator --dbname rill_restore_check \
  --exit-on-error /tmp/rill-backup.dump
docker compose exec database psql \
  --username rill_migrator --dbname rill_restore_check \
  --command "SELECT count(*) FROM flyway_schema_history;"
docker compose exec database dropdb \
  --username postgres rill_restore_check
docker compose exec database rm /tmp/rill-backup.dump
```

If any command fails, retain the source backup, investigate, and do not switch
production. For a real recovery, stop writers, restore to a newly provisioned
database, validate schema and representative account/result counts, rotate
credentials if exposure is suspected, then switch the application connection.

## Credential rotation

Rotate the administration, migration, and runtime credentials separately.
Update the secret store and PostgreSQL role in a coordinated maintenance
window, then recreate the affected service. Do not place the new password in
shell history or logs.

Because the initial role script runs only when a PostgreSQL volume is created,
changing `.env` alone does not rotate any existing database role, including
the bootstrap `postgres` role.

## Data lifecycle

- Sessions expire after seven days and the oldest is revoked above ten active
  sessions per account.
- Result history is capped at 1,000 rows per account.
- Account deletion cascades through sessions and results.
- Guest history is device-local and capped at 100 rows.

No email or recovery identifier is stored. A forgotten password means permanent
account loss in release 1.

## Scaling and incident notes

The API limiters are bounded but process-local. Do not horizontally scale the
backend until authentication and result-write limits are enforced by a trusted
shared edge or data store.

If session disclosure is suspected, stop public traffic, rotate database
credentials if relevant, delete affected/all `auth_session` rows, preserve
sanitized logs for investigation, and require users to sign in again. Raw
session values are not recoverable from their stored SHA-256 hashes.

TLS certificates, host patching, firewall rules, off-host monitoring, and
container-registry controls belong to the deployment platform and are not
implemented by this repository.
