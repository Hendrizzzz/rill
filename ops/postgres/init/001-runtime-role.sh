#!/bin/sh
set -eu

if [ -z "${TYPETHOCK_MIGRATOR_DB_PASSWORD:-}" ] || [ -z "${TYPETHOCK_APP_DB_PASSWORD:-}" ]; then
  echo "TYPETHOCK_MIGRATOR_DB_PASSWORD and TYPETHOCK_APP_DB_PASSWORD are required" >&2
  exit 1
fi

psql --set=ON_ERROR_STOP=1 \
  --set=migrator_password="$TYPETHOCK_MIGRATOR_DB_PASSWORD" \
  --set=app_password="$TYPETHOCK_APP_DB_PASSWORD" \
  --username "$POSTGRES_USER" \
  --dbname "$POSTGRES_DB" <<'EOSQL'
SELECT format(
  'CREATE ROLE typethock_migrator LOGIN PASSWORD %L NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION',
  :'migrator_password'
)
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'typethock_migrator') \gexec

SELECT format('ALTER ROLE typethock_migrator PASSWORD %L', :'migrator_password') \gexec

SELECT format('CREATE ROLE typethock_app LOGIN PASSWORD %L', :'app_password')
WHERE NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'typethock_app') \gexec

SELECT format('ALTER ROLE typethock_app PASSWORD %L', :'app_password') \gexec

REVOKE ALL ON DATABASE typethock FROM PUBLIC;
GRANT CONNECT ON DATABASE typethock TO typethock_migrator, typethock_app;
ALTER DATABASE typethock OWNER TO typethock_migrator;
ALTER SCHEMA public OWNER TO typethock_migrator;
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO typethock_app;
ALTER DEFAULT PRIVILEGES FOR ROLE typethock_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO typethock_app;
ALTER DEFAULT PRIVILEGES FOR ROLE typethock_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO typethock_app;
EOSQL
