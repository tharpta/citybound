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
SERVER_BIN="${CITYBOUND_SMOKE_SERVER:-target/debug/citybound}"
SERVER_SCRIPT="${CITYBOUND_SMOKE_SERVER_SCRIPT:-}"
REMOVE_CITY_DIR=0
TEARDOWN_FAILED=0

cd "$REPO_ROOT"

if [[ ! -x "$SERVER_BIN" ]]; then
    echo "Missing target/debug/citybound. Run npm run build-server-debug-compat first." >&2
    exit 1
fi

if [[ "${CITYBOUND_SMOKE_SKIP_DIST_CHECK:-0}" != "1" ]]; then
    "$SCRIPT_DIR/check-browser-dist-compat.sh"
fi

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

run_smoke() {
    local -a server_args=(
        --mode local
        --bind "$BIND"
        --bind-sim "$BIND_SIM"
        "$CITY_DIR"
    )
    local -a command_args=()
    if [[ -n "$SERVER_SCRIPT" ]]; then
        command_args+=("$SERVER_SCRIPT")
    fi
    command_args+=("${server_args[@]}")
    local expected_argv="$SERVER_BIN ${command_args[*]}"
    local url="http://$BIND/"
    local body status page sim_port

    "$SERVER_BIN" "${command_args[@]}" >"$LOG_FILE" 2>&1 &
    SERVER_PID=$!
    SERVER_PORTS="${BIND##*:} ${BIND_SIM##*:}"
    if ! runtime_register_child "$SERVER_BIN" "$expected_argv"; then
        echo "Could not prove exact identity for spawned server PID $SERVER_PID." >&2
        return 1
    fi
    if [[ "${CITYBOUND_SMOKE_TEST_INVALIDATE_IDENTITY:-0}" == "1" ]]; then
        SERVER_START_TOKEN="test-invalidated-$SERVER_START_TOKEN"
    fi

    for _ in {1..80}; do
        if ! kill -0 "$SERVER_PID" >/dev/null 2>&1; then
            echo "Citybound server exited before smoke check completed." >&2
            tail -100 "$LOG_FILE" >&2 || true
            return 1
        fi

        body="$(curl -s -w "\n%{http_code}" "$url" || true)"
        status="$(printf '%s' "$body" | tail -n 1)"
        if [[ "$status" == "200" ]]; then
            page="$(printf '%s' "$body" | sed '$d')"
            sim_port="${BIND_SIM##*:}"
            if ! printf '%s' "$page" | grep -q "simulationPort: $sim_port"; then
                echo "Server page did not include expected simulation port $sim_port." >&2
                return 1
            fi
            echo "Server smoke passed: $url returned HTTP 200"
            return 0
        fi

        sleep 0.25
    done

    echo "Timed out waiting for $url to return HTTP 200." >&2
    tail -100 "$LOG_FILE" >&2 || true
    return 1
}

body_status=0
run_smoke || body_status=$?
teardown_status=0
cleanup || teardown_status=$?
if [[ "$teardown_status" -ne 0 ]]; then
    exit "$teardown_status"
fi
exit "$body_status"
