#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
source "$SCRIPT_DIR/runtime-teardown.sh"

BIND="${CITYBOUND_SAVE_SMOKE_BIND:-127.0.0.1:$(runtime_allocate_loopback_port)}"
BIND_SIM="${CITYBOUND_SAVE_SMOKE_BIND_SIM:-127.0.0.1:$(runtime_allocate_loopback_port)}"
while [[ "$BIND_SIM" == "$BIND" ]]; do
    BIND_SIM="127.0.0.1:$(runtime_allocate_loopback_port)"
done
WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/citybound-save-reload.XXXXXX")"
CITY_DIR="$WORK_DIR/city"
FIRST_LOG="$WORK_DIR/first-start.log"
SECOND_LOG="$WORK_DIR/reload.log"
MINIMUM_SAVE_FILES=20
TEARDOWN_FAILED=0

cd "$REPO_ROOT"

if [[ ! -x target/debug/citybound ]]; then
    echo "Missing target/debug/citybound. Run npm run build-server-debug-compat first." >&2
    exit 1
fi

cleanup() {
    if ! runtime_stop_child "save smoke cleanup" "$WORK_DIR/cleanup.teardown"; then
        TEARDOWN_FAILED=1
    fi
    if [[ "$TEARDOWN_FAILED" -eq 0 ]]; then
        find "$WORK_DIR" -depth -delete
    else
        echo "Disposable save and diagnostics preserved at $WORK_DIR." >&2
    fi
    return "$TEARDOWN_FAILED"
}

trap cleanup EXIT

stop_server() {
    local label="$1"
    local log_file="$2"

    if ! runtime_stop_child "$label" "$log_file.teardown"; then
        tail -100 "$log_file" >&2 || true
        exit 1
    fi
}

run_server_once() {
    local label="$1"
    local log_file="$2"
    local url="http://$BIND/"

    local -a server_args=(
        --mode local
        --bind "$BIND"
        --bind-sim "$BIND_SIM"
        "$CITY_DIR"
    )
    target/debug/citybound "${server_args[@]}" >"$log_file" 2>&1 &
    SERVER_PID=$!
    SERVER_PORTS="${BIND##*:} ${BIND_SIM##*:}"
    if ! runtime_register_child "target/debug/citybound" "target/debug/citybound ${server_args[*]}"; then
        echo "Could not prove exact identity for spawned server PID $SERVER_PID." >&2
        exit 1
    fi

    for _ in {1..80}; do
        if ! kill -0 "$SERVER_PID" >/dev/null 2>&1; then
            echo "Citybound exited during $label." >&2
            tail -100 "$log_file" >&2 || true
            exit 1
        fi

        if [[ "$(curl -s -o /dev/null -w '%{http_code}' "$url" || true)" == "200" ]]; then
            sleep 0.5
            stop_server "$label" "$log_file"

            if ! grep -q "Simulation running." "$log_file"; then
                echo "Citybound did not report a running simulation during $label." >&2
                tail -100 "$log_file" >&2 || true
                exit 1
            fi
            if ! grep -q "Stopping Citybound safely..." "$log_file"; then
                echo "Citybound did not use the safe shutdown path during $label." >&2
                tail -100 "$log_file" >&2 || true
                exit 1
            fi
            return
        fi

        sleep 0.25
    done

    echo "Timed out waiting for Citybound during $label." >&2
    tail -100 "$log_file" >&2 || true
    exit 1
}

run_server_once "initial save creation" "$FIRST_LOG"

if ! grep -q "not found, creating" "$FIRST_LOG"; then
    echo "Initial startup did not create a new save directory." >&2
    exit 1
fi

for required_file in "Time_n" "PlanManager(CBPlanningLogic)_n"; do
    if [[ ! -f "$CITY_DIR/$required_file" ]]; then
        echo "Initial save is missing core actor file: $required_file" >&2
        exit 1
    fi
done

first_file_count="$(find "$CITY_DIR" -type f | wc -l | tr -d ' ')"
if (( first_file_count < MINIMUM_SAVE_FILES )); then
    echo "Initial save contains only $first_file_count files." >&2
    exit 1
fi

first_inventory="$(
    cd "$CITY_DIR"
    find . -type f -print | sort
)"

run_server_once "save reload" "$SECOND_LOG"

if grep -q "not found, creating" "$SECOND_LOG"; then
    echo "Reload startup tried to recreate the existing save directory." >&2
    exit 1
fi

second_inventory="$(
    cd "$CITY_DIR"
    find . -type f -print | sort
)"
missing_files="$(comm -23 <(printf '%s\n' "$first_inventory") <(printf '%s\n' "$second_inventory"))"
if [[ -n "$missing_files" ]]; then
    echo "Reload removed files from the initial save:" >&2
    printf '%s\n' "$missing_files" >&2
    exit 1
fi

second_file_count="$(printf '%s\n' "$second_inventory" | sed '/^$/d' | wc -l | tr -d ' ')"
echo "Save reload smoke passed: $first_file_count files created, $second_file_count present after reload."
