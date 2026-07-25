#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
source "$SCRIPT_DIR/runtime-teardown.sh"

BIND="${CITYBOUND_SMOKE_BIND:-127.0.0.1:$(runtime_allocate_loopback_port)}"
BIND_SIM="${CITYBOUND_SMOKE_BIND_SIM:-127.0.0.1:$(runtime_allocate_loopback_port)}"
while [[ "$BIND_SIM" == "$BIND" ]]; do
    BIND_SIM="127.0.0.1:$(runtime_allocate_loopback_port)"
done
CITY_DIR="${CITYBOUND_SMOKE_CITY_DIR:-}"
LOG_FILE="${CITYBOUND_SMOKE_LOG:-${TMPDIR:-/tmp}/citybound-server-smoke.log}"
REMOVE_CITY_DIR=0
TEARDOWN_FAILED=0

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
    if ! runtime_stop_child "server smoke cleanup" "$LOG_FILE.teardown"; then
        TEARDOWN_FAILED=1
    fi

    if [[ "$REMOVE_CITY_DIR" -eq 1 && "$TEARDOWN_FAILED" -eq 0 ]]; then
        rm -rf "$CITY_DIR"
    elif [[ "$REMOVE_CITY_DIR" -eq 1 ]]; then
        echo "Disposable city preserved at $CITY_DIR because teardown failed." >&2
    fi
    return "$TEARDOWN_FAILED"
}

trap cleanup EXIT

target/debug/citybound \
    --mode local \
    --bind "$BIND" \
    --bind-sim "$BIND_SIM" \
    "$CITY_DIR" \
    >"$LOG_FILE" 2>&1 &
SERVER_PID=$!
SERVER_COMMAND="target/debug/citybound"
SERVER_PORTS="${BIND##*:} ${BIND_SIM##*:}"

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
