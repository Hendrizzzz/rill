#!/bin/sh
set -eu

if [ -z "${RILL_MIGRATOR_DB_PASSWORD:-}" ] || [ -z "${RILL_APP_DB_PASSWORD:-}" ]; then
  echo "RILL_MIGRATOR_DB_PASSWORD and RILL_APP_DB_PASSWORD are required" >&2
  exit 1
fi

psql --set=ON_ERROR_STOP=1 \
  --set=migrator_password="$RILL_MIGRATOR_DB_PASSWORD" \
  --set=app_password="$RILL_APP_DB_PASSWORD" \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" <<'EOSQL'
SELECT format(
  'CREATE ROLE rill_migrator LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION',
  :'migrator_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rill_migrator') \gexec

SELECT format('ALTER ROLE rill_migrator PASSWORD %L', :'migrator_password') \gexec

SELECT format('CREATE ROLE rill_app LOGIN PASSWORD %L', :'app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'rill_app') \gexec

SELECT format('ALTER ROLE rill_app PASSWORD %L', :'app_password') \gexec

REVOKE ALL ON DATABASE rill FROM PUBLIC;
GRANT CONNECT ON DATABASE rill TO rill_migrator, rill_app;
ALTER DATABASE rill OWNER TO rill_migrator;
ALTER SCHEMA public OWNER TO rill_migrator;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO rill_app;
ALTER DEFAULT PRIVILEGES FOR ROLE rill_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO rill_app;
ALTER DEFAULT PRIVILEGES FOR ROLE rill_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO rill_app;
EOSQL
