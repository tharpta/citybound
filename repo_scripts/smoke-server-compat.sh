#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
BIND="${CITYBOUND_SMOKE_BIND:-127.0.0.1:43210}"
BIND_SIM="${CITYBOUND_SMOKE_BIND_SIM:-127.0.0.1:43211}"
CITY_DIR="${CITYBOUND_SMOKE_CITY_DIR:-}"
LOG_FILE="${CITYBOUND_SMOKE_LOG:-${TMPDIR:-/tmp}/citybound-server-smoke.log}"
REMOVE_CITY_DIR=0

cd "$REPO_ROOT"

if [[ ! -x target/debug/citybound ]]; then
    echo "Missing target/debug/citybound. Run npm run build-server-debug-compat first." >&2
    exit 1
fi

"$SCRIPT_DIR/check-browser-dist-compat.sh"

if [[ -z "$CITY_DIR" ]]; then
    CITY_DIR="$(mktemp -d "${TMPDIR:-/tmp}/citybound-smoke-city.XXXXXX")"
    REMOVE_CITY_DIR=1
fi

rm -f "$LOG_FILE"

cleanup() {
    if [[ -n "${SERVER_PID:-}" ]] && kill -0 "$SERVER_PID" >/dev/null 2>&1; then
        kill -INT "$SERVER_PID" >/dev/null 2>&1 || true
        wait "$SERVER_PID" >/dev/null 2>&1 || true
    fi

    if [[ "$REMOVE_CITY_DIR" -eq 1 ]]; then
        rm -rf "$CITY_DIR"
    fi
}

trap cleanup EXIT

target/debug/citybound \
    --mode local \
    --bind "$BIND" \
    --bind-sim "$BIND_SIM" \
    "$CITY_DIR" \
    >"$LOG_FILE" 2>&1 &
SERVER_PID=$!

URL="http://$BIND/"

for _ in {1..80}; do
    if ! kill -0 "$SERVER_PID" >/dev/null 2>&1; then
        echo "Citybound server exited before smoke check completed." >&2
        tail -100 "$LOG_FILE" >&2 || true
        exit 1
    fi

    body="$(curl -s -w "\n%{http_code}" "$URL" || true)"
    status="$(printf '%s' "$body" | tail -n 1)"
    if [[ "$status" == "200" ]]; then
        page="$(printf '%s' "$body" | sed '$d')"
        sim_port="${BIND_SIM##*:}"
        if ! printf '%s' "$page" | grep -q "simulationPort: $sim_port"; then
            echo "Server page did not include expected simulation port $sim_port." >&2
            exit 1
        fi
        echo "Server smoke passed: $URL returned HTTP 200"
        exit 0
    fi

    sleep 0.25
done

echo "Timed out waiting for $URL to return HTTP 200." >&2
tail -100 "$LOG_FILE" >&2 || true
exit 1
