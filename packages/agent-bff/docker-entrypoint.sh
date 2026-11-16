#!/bin/sh
set -eu

export POSTGRES_DB="${POSTGRES_DB:-agent_bff}"
export POSTGRES_USER="${POSTGRES_USER:-agent_bff}"
export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-agent_bff}"
export DATABASE_URL="${DATABASE_URL:-postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@127.0.0.1:5432/${POSTGRES_DB}}"

uploads_dir=/app/packages/agent-bff/uploads
mkdir -p "${uploads_dir}"
# Volume mounts can be owned by root or the host deployment user. The BFF runs
# as `app`, so fix the mounted directory here rather than relying on a chown
# performed during the image build.
chown app:app "${uploads_dir}"
chmod 0750 "${uploads_dir}"

mkdir -p /run/postgresql
chown postgres:postgres /run/postgresql

/usr/local/bin/docker-entrypoint.sh postgres &
postgres_pid=$!

app_pid=

terminate() {
  if [ -n "${app_pid}" ]; then
    kill -TERM "${app_pid}" 2>/dev/null || true
  fi
  kill -TERM "${postgres_pid}" 2>/dev/null || true
}

trap terminate INT TERM

ready=
attempt=0
while [ "${attempt}" -lt 60 ]; do
  if pg_isready -h 127.0.0.1 -p 5432 -U "${POSTGRES_USER}" -d "${POSTGRES_DB}" >/dev/null 2>&1; then
    ready=1
    break
  fi
  if ! kill -0 "${postgres_pid}" 2>/dev/null; then
    wait "${postgres_pid}"
    exit $?
  fi
  attempt=$((attempt + 1))
  sleep 1
done

if [ -z "${ready}" ]; then
  echo "PostgreSQL did not become ready" >&2
  terminate
  wait "${postgres_pid}" 2>/dev/null || true
  exit 1
fi

cd /app/packages/agent-bff
su-exec app node src/main.js &
app_pid=$!

while kill -0 "${app_pid}" 2>/dev/null; do
  if ! kill -0 "${postgres_pid}" 2>/dev/null; then
    echo "PostgreSQL exited unexpectedly" >&2
    terminate
    exit 1
  fi
  sleep 1
done

wait "${app_pid}"
status=$?
terminate
wait "${postgres_pid}" 2>/dev/null || true
exit "${status}"
