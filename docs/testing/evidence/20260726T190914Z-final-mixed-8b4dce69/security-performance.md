# Current security and performance evidence

## Completed

```text
npm.cmd audit --audit-level=high
# 0 vulnerabilities

git diff --check
# exit 0
```

A focused repository scan found no credential/private-key patterns. The only
TODO-like match was explanatory documentation, and the three console matches
were output statements in verification scripts rather than application debug
logging.

The frontend production build completed successfully. No current backend test
result is claimed beyond package compilation because the reproducible workspace
test path remained sandbox-blocked.

## Blocked or historical only

- OWASP Dependency-Check could not refresh its data because the updater could
  not establish a loopback connection and ended with `NoDataException`.
  An earlier revision had a zero-finding report; that result is historical and
  is not promoted to the final worktree.
- The current performance script could not launch Chromium (`spawn EPERM`).
  Earlier p50/p95 browser measurements predate the latest implementation and
  are retained only as historical context.
- Docker/Testcontainers could not access `\\.\pipe\docker_engine`, so current
  database integration, container headers, runtime privileges, migrations,
  backup/restore, and clean-stack health were not rerun.
- No load test, image scan, gitleaks run, public TLS deployment, off-host
  monitoring, or production backup drill was performed.

These limits prevent a complete security, performance, or production-readiness
claim. They do not negate the specific current checks that completed.
